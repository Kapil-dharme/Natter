import { verifyToken } from "../services/authentication.js"
import { Server } from "socket.io";
import { Message } from "../model/message.js"
import { createAdapter } from "@socket.io/redis-adapter";
import { Conversation } from "../model/conversation.js";
import Redis from "ioredis";
import { User } from "../model/user.js"

let io;
let redis;

const QUEUE_TTL_SECONDS = 60 * 60 * 24 * 7;

async function isUserOnline(userId) {
    const sockets = await io.in(String(userId)).fetchSockets();
    return sockets.length > 0;
}

async function getOnlineUserIds() {
    const sockets = await io.fetchSockets();

    return [
        ...new Set(
            sockets
                .map(s => s.data?.userId)
                .filter(Boolean)
        )
    ];
}

async function queueMessage(userId, payload) {
    const key = `message_queue:${userId}`;

    await redis.rpush(key, JSON.stringify(payload));
    await redis.expire(key, QUEUE_TTL_SECONDS);
}

async function drainQueue(userId) {
    const key = `message_queue:${userId}`;

    const results = await redis
        .multi()
        .lrange(key, 0, -1)
        .del(key)
        .exec();

    const items = results?.[0]?.[1] || [];

    const messages = [];

    for (const item of items) {
        try {
            messages.push(JSON.parse(item));
        } catch (error) {
            console.error("Invalid queued message:", error);
        }
    }

    return messages;
}

async function getVisibleOnlineUsers(viewerId) {
    const ids = await getOnlineUserIds();

    if (ids.length === 0) {
        return [];
    }

    const hiddenFrom = await User.find({
        _id: { $in: ids },
        blockedUsers: viewerId
    }).select("_id");

    const hidden = new Set(hiddenFrom.map(u => String(u._id)));

    return ids.filter(id => !hidden.has(id));
}

export function initIO(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    const pubClient = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        reconnectOnError: () => true,
        maxRetriesPerRequest: null,
    });
    const subClient = pubClient.duplicate();

    redis = pubClient;

    pubClient.on("connect", () => console.log("Redis pubClient connected"));
    pubClient.on("error", (err) => console.error("Redis pubClient error:", err));
    pubClient.on("close", () => console.log("Redis pubClient closed, reconnecting..."));

    subClient.on("connect", () => console.log("Redis subClient connected"));
    subClient.on("error", (err) => console.error("Redis subClient error:", err));
    subClient.on("close", () => console.log("Redis subClient closed, reconnecting..."));

    io.adapter(createAdapter(pubClient, subClient));

    io.use(async (socket, next) => {
        const ntoken = socket.handshake.auth?.token || socket.handshake.headers?.cookie;

        if (!ntoken) return next(new Error("Authentication error: Token missing"));

        const cookieEntry = ntoken.split(";").find((c) => {
            return c.trim().startsWith("accesstoken");
        });

        if (!cookieEntry) {
            return next(new Error("Authentication error: Token missing"));
        }

        const ytoken = cookieEntry.split("=");
        const token = ytoken[1];

        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }

        try {
            const decoded = await verifyToken(token, process.env.ACCESS_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const uid = socket.user.id.toString();

        socket.data.userId = uid;
        socket.join(uid);

        socket.emit("online_users", await getVisibleOnlineUsers(uid));

        const unnotifiedMessages = await Message.find({
            sender: socket.user.id,
            status: "read",
            notifiedSender: false
        });

        socket.on('get_online_users', async () => {
            socket.emit('online_users', await getVisibleOnlineUsers(uid));
        });

        unnotifiedMessages.forEach(msg => {
            socket.emit("message_read_ack", { messageId: msg._id });
        });

        const idsToUpdate = unnotifiedMessages.map(msg => msg._id);

        if (idsToUpdate.length > 0) {
            await Message.updateMany(
                { _id: { $in: idsToUpdate } },
                { notifiedSender: true }
            );
        }

        const queuedMessages = await drainQueue(uid);

        queuedMessages.forEach(msg => {
            socket.emit("receive_message", msg);
        });

        const connectedUser = await User.findById(uid).select("blockedUsers");

        socket.broadcast
            .except((connectedUser?.blockedUsers || []).map(String))
            .emit("online", uid);

        socket.on("disconnect", async () => {
            try {
                const stillOnline = await isUserOnline(uid);

                if (stillOnline) {
                    return;
                }

                const lastSeen = new Date();
                const disconnectedUser = await User.findByIdAndUpdate(
                    uid,
                    { lastSeen },
                    { new: true }
                ).select("blockedUsers");

                socket.broadcast
                    .except((disconnectedUser?.blockedUsers || []).map(String))
                    .emit("offline", { uid, lastSeen });
            } catch (error) {
                console.error("disconnect socket error:", error);
            }
        });

        socket.on("send_message", async (data) => {
            try {
                const participants = data.participants;
                let delivered = false;

                const savedMessage = await Message.findById(data.messageId)
                    .populate({
                        path: "sender",
                        select: "userName profileURL"
                    })
                    .populate({
                        path: "replyTo",
                        populate: {
                            path: "sender",
                            select: "userName profileURL"
                        }
                    });

                if (!savedMessage) {
                    return;
                }

                const conversation = await Conversation.findById(
                    savedMessage.conversationID
                );

                if (!conversation) {
                    return;
                }

                for (const participantId of participants) {

                    if (String(participantId) === String(uid)) {
                        continue;
                    }

                    if (conversation.type === "direct") {
                        const recipient = await User.findById(participantId)
                            .select("blockedUsers");

                        const recipientBlockedSender =
                            recipient?.blockedUsers?.some(
                                id => String(id) === String(uid)
                            );

                        if (recipientBlockedSender) {
                            continue;
                        }
                    }

                    let replyToForUser = savedMessage.replyTo || null;

                    if (savedMessage.replyTo) {

                        const userClearedAt =
                            conversation.clearedAt?.get(
                                String(participantId)
                            );

                        const userJoinedAt =
                            conversation.memberJoinedAt?.get(
                                String(participantId)
                            );

                        const replyCreatedAt =
                            new Date(savedMessage.replyTo.createdAt);

                        let replyIsVisible = true;

                        if (
                            conversation.type === "group" &&
                            userJoinedAt
                        ) {
                            const visibleFrom =
                                userClearedAt &&
                                    new Date(userClearedAt) >
                                    new Date(userJoinedAt)
                                    ? new Date(userClearedAt)
                                    : new Date(userJoinedAt);

                            if (replyCreatedAt < visibleFrom) {
                                replyIsVisible = false;
                            }

                        } else if (userClearedAt) {

                            if (
                                replyCreatedAt <=
                                new Date(userClearedAt)
                            ) {
                                replyIsVisible = false;
                            }
                        }

                        if (!replyIsVisible) {
                            replyToForUser = {
                                _id: savedMessage.replyTo._id,
                                unavailable: true
                            };
                        }
                    }

                    const payload = {
                        sender: savedMessage.sender,
                        _id: savedMessage._id,
                        conversationId: savedMessage.conversationID,
                        content: savedMessage.content,
                        encryptionIv: savedMessage.encryptionIv || null,
                        type: savedMessage.type,
                        fileName: data.fileName || null,
                        status: "delivered",
                        createdAt: savedMessage.createdAt,
                        replyTo: replyToForUser
                    };

                    const recipientOnline = await isUserOnline(participantId);

                    if (!recipientOnline) {

                        await queueMessage(String(participantId), payload);

                    } else {

                        socket
                            .to(String(participantId))
                            .emit("receive_message", payload);

                        delivered = true;
                    }
                }

                if (delivered) {
                    await Message.findByIdAndUpdate(
                        savedMessage._id,
                        {
                            status: "delivered"
                        }
                    );

                    socket.emit(
                        "message_delivered",
                        savedMessage._id
                    );
                }

            } catch (error) {
                console.error(
                    "send_message socket error:",
                    error
                );
            }
        });
        socket.on("delete_message", async (data) => {
            try {
                const {
                    messageId,
                    conversationId,
                    participants,
                    lastMessage,
                    lastMessageAt
                } = data;

                if (
                    !messageId ||
                    !conversationId ||
                    !Array.isArray(participants)
                ) {
                    return;
                }

                for (const participantId of participants) {
                    io.to(String(participantId)).emit("message_deleted", {
                        messageId,
                        conversationId,
                        lastMessage: lastMessage || null,
                        lastMessageAt: lastMessageAt || null
                    });
                }

            } catch (error) {
                console.error("delete_message socket error:", error);
            }
        });

        socket.on("message_read", async (data) => {
            try {
                await Message.findByIdAndUpdate(data.messageId, { status: "read" });
            } catch (error) {
                socket.emit("error_event", { message: "cannot find the message." });
                return;
            }

            const senderOnline = await isUserOnline(data.senderId);

            if (!senderOnline) return;

            socket.to(String(data.senderId)).emit("message_read_ack", {
                messageId: data.messageId
            });
            await Message.findByIdAndUpdate(data.messageId, { notifiedSender: true });
        });
    });

    return io;
}

export function getIO() {
    if (!io) {
        throw new Error("Socket.io has not been initialized. Call initIO(httpServer) first.");
    }
    return io;
}

export async function isOnline(userId) {
    return isUserOnline(userId);
}
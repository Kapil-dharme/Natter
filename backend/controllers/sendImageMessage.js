import mongoose from "mongoose";
import { Message } from "../model/message.js";
import { Conversation } from "../model/conversation.js";
import { User } from "../model/user.js";
import { updateConversationLastMessage } from "../services/conversation.js";
import { PushSubscription } from "../model/pushSubscription.js";
import webpush from "../utils/webPush.js";

export const imageMessage = async (req, res) => {
    try {
        const { conversationID, replyTo } = req.body;

        const sender = req.user.id;

        if (!sender) {
            return res.status(401).json({
                message: "please login again."
            });
        }

        if (!conversationID) {
            return res.status(400).json({
                message: "conversation not found."
            });
        }

        if (req.fileValidationError) {
            return res.status(400).json({
                message: req.fileValidationError
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "please attach an image."
            });
        }

        const conversation = await Conversation.findById(
            conversationID
        );

        if (!conversation) {
            return res.status(404).json({
                message: "conversation not found."
            });
        }

        let recipientBlockedSender = false;

        if (conversation.type === "direct") {
            const otherUserId = conversation.participants.find(
                id => String(id) !== String(sender)
            );

            const senderUser = await User.findById(sender)
                .select("blockedUsers");

            const otherUser = await User.findById(otherUserId)
                .select("blockedUsers");

            if (
                senderUser?.blockedUsers?.some(
                    id => String(id) === String(otherUserId)
                )
            ) {
                return res.status(403).json({
                    message: "You have blocked this user. Unblock them to send messages."
                });
            }

            recipientBlockedSender = Boolean(
                otherUser?.blockedUsers?.some(
                    id => String(id) === String(sender)
                )
            );
        }

        let replyMessage = null;

        if (replyTo) {
            if (!mongoose.isValidObjectId(replyTo)) {
                return res.status(400).json({
                    message: "invalid reply message."
                });
            }

            replyMessage = await Message.findOne({
                _id: replyTo,
                conversationID
            });

            if (!replyMessage) {
                return res.status(400).json({
                    message: "reply message not found."
                });
            }
        }

        const content = req.file.path;

        const message = await Message.create({
            conversationID,
            sender,
            type: "image",
            content,
            replyTo: replyMessage ? replyMessage._id : null
        });

        await updateConversationLastMessage(
            conversationID,
            message
        );

        const populatedMessage = await Message.findById(message._id)
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

        if (
            populatedMessage.replyTo &&
            conversation
        ) {
            const userId = String(req.user.id);

            const clearedAt =
                conversation.clearedAt?.get(userId);

            const memberJoinedAt =
                conversation.memberJoinedAt?.get(userId);

            let visibleFrom = null;

            if (
                conversation.type === "group" &&
                memberJoinedAt
            ) {
                visibleFrom = new Date(memberJoinedAt);

                if (
                    clearedAt &&
                    new Date(clearedAt) > visibleFrom
                ) {
                    visibleFrom = new Date(clearedAt);
                }
            } else if (clearedAt) {
                visibleFrom = new Date(clearedAt);
            }

            const replyCreatedAt =
                new Date(
                    populatedMessage.replyTo.createdAt
                );

            if (
                visibleFrom &&
                replyCreatedAt <= visibleFrom
            ) {
                populatedMessage.replyTo = {
                    _id: populatedMessage.replyTo._id,
                    unavailable: true
                };
            }
        }

        if (conversation && !recipientBlockedSender) {
            const recipientIds = conversation.participants
                .map(id => String(id))
                .filter(id => id !== String(sender));

            const subscriptions = await PushSubscription.find({
                userId: { $in: recipientIds }
            });

            const senderName =
                populatedMessage.sender?.userName || "Someone";

            const payload = JSON.stringify({
                title: `${senderName} sent you a photo`,
                body: "Open Natter to view it",
                conversationId: String(conversation._id)
            });

            await Promise.all(
                subscriptions.map(async (subscription) => {
                    try {
                        await webpush.sendNotification(
                            {
                                endpoint: subscription.endpoint,
                                keys: {
                                    p256dh: subscription.keys.p256dh,
                                    auth: subscription.keys.auth
                                }
                            },
                            payload
                        );
                    } catch (error) {
                        console.error(
                            "Image push notification error:",
                            {
                                statusCode: error.statusCode,
                                body: error.body,
                                message: error.message,
                                endpoint: subscription.endpoint
                            }
                        );

                        if (
                            error.statusCode === 404 ||
                            error.statusCode === 410
                        ) {
                            await PushSubscription.deleteOne({
                                _id: subscription._id
                            });
                        }
                    }
                })
            );
        }

        return res.status(201).json({
            message: "image sent.",
            data: populatedMessage
        });

    } catch (error) {
        console.error(
            "imageMessage error:",
            error
        );

        return res.status(500).json({
            message: "Internal server error."
        });
    }
};
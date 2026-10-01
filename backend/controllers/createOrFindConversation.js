import { User } from "../model/user.js";
import { Conversation } from "../model/conversation.js";
import { Message } from "../model/message.js";
import mongoose from "mongoose";

export const createOrFindConversation = async (req, res) => {
    try {
        const { participantId } = req.body;

        const currentUser = req.user.id;

        if (!participantId) {
            return res.status(400).json({
                message: "please send a query"
            });
        }

        if (participantId == currentUser) {
            return res.status(400).json({
                message: "you can't start conversation to yourself"
            });
        }

        if (!mongoose.isValidObjectId(participantId)) {
            return res.status(400).json({
                message: "invalid participant id"
            });
        }

        const participantExist = await User.findOne({
            _id: participantId
        });

        if (!participantExist) {
            return res.status(404).json({
                message: "user don't exist"
            });
        }

        const existing = await Conversation.findOne({
            type: "direct",
            participants: {
                $all: [currentUser, participantId]
            }
        })
            .populate({
                path: "participants",
                select: "userName profileURL lastSeen"
            })
            .populate("lastMessage");

        if (existing) {

            if (
                existing.deletedFor?.some(
                    id => String(id) === String(currentUser)
                )
            ) {
                existing.deletedFor = existing.deletedFor.filter(
                    id => String(id) !== String(currentUser)
                );

                await existing.save();
            }

            const clearedAt = existing.clearedAt?.get(
                String(currentUser)
            );

            if (
                clearedAt &&
                existing.lastMessage?.createdAt &&
                new Date(existing.lastMessage.createdAt) <= new Date(clearedAt)
            ) {
                existing.lastMessage = null;
                existing.lastMessageAt = null;
            }

            return res.status(200).json({
                conversation: existing
            });
        }

        const created = await Conversation.create({
            type: "direct",
            participants: [
                req.user.id,
                participantId
            ]
        });

        const populated = await Conversation.findById(created._id)
            .populate({
                path: 'participants',
                select: 'userName profileURL'
            })
            .populate('lastMessage');

        return res.status(201).json({
            conversation: populated
        });

    } catch (error) {
        console.log("createOrFindConversation error:", error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
};


export const getConversations = async (req, res) => {
    try {

        const userId = req.user.id.toString();

        const conversations = await Conversation.find({
            participants: req.user.id,
            deletedFor: {
                $ne: req.user.id
            }
        })
            .sort({
                lastMessageAt: -1
            })
            .populate({
                path: 'participants',
                select: 'userName profileURL lastSeen'
            })
            .populate({
                path: 'groupAdmin',
                select: 'userName profileURL'
            })
            .populate('lastMessage');

        const formattedConversations = conversations.map(conversation => {

            const clearedAt = conversation.clearedAt?.get(userId);
            const memberJoinedAt = conversation.memberJoinedAt?.get(userId);

            if (conversation.type === 'group' && memberJoinedAt) {

                const lastMessageCreatedAt =
                    conversation.lastMessage?.createdAt
                        ? new Date(conversation.lastMessage.createdAt)
                        : null;

                const visibleFrom = clearedAt &&
                    new Date(clearedAt) > new Date(memberJoinedAt)
                    ? new Date(clearedAt)
                    : new Date(memberJoinedAt);

                if (
                    lastMessageCreatedAt &&
                    lastMessageCreatedAt < visibleFrom
                ) {
                    conversation.lastMessage = null;
                    conversation.lastMessageAt = null;
                }
            }
            else if (
                clearedAt &&
                conversation.lastMessage?.createdAt &&
                new Date(conversation.lastMessage.createdAt) <= new Date(clearedAt)
            ) {

                conversation.lastMessage = null;
                conversation.lastMessageAt = null;
            }

            return conversation;
        });

        return res.status(200).json({
            conversations: formattedConversations
        });

    } catch (error) {

        console.log(
            'getConversations error:',
            error
        );

        return res.status(500).json(
            "Failed to load conversations."
        );
    }
};


export const conversationAndParticipantGuard = async (req, res) => {
    try {

        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                message: "Invalid conversation id."
            });
        }

        const conversation = await Conversation.findById(
            conversationId
        );

        if (!conversation) {
            return res.status(404).json({
                message: "Unauthorized conversation"
            });
        }

        const userId = String(req.user.id);

        const participantIDS = conversation.participants.map(
            ele => String(ele)
        );

        if (!participantIDS.includes(userId)) {
            return res.status(403).json({
                message: "Unauthorized conversation."
            });
        }

        const deletedForUser = conversation.deletedFor?.some(
            id => String(id) === userId
        );

        if (deletedForUser) {
            return res.status(404).json({
                message: "Conversation deleted."
            });
        }

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const clearedAt =
            conversation.clearedAt?.get(userId) || null;

        const memberJoinedAt =
            conversation.memberJoinedAt?.get(userId) || null;

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


        const messageQuery = {
            conversationID: conversationId
        };

        if (visibleFrom) {
            messageQuery.createdAt = {
                $gt: visibleFrom
            };
        }

        const messages = await Message.find(messageQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
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

        for (const message of messages) {

            if (!message.replyTo) {
                continue;
            }

            const replyCreatedAt =
                new Date(message.replyTo.createdAt);


            if (
                visibleFrom &&
                replyCreatedAt <= visibleFrom
            ) {

                message.replyTo = {
                    _id: message.replyTo._id,
                    unavailable: true
                };
            }
        }

        return res.status(200).json({
            chatMessages: messages
        });

    } catch (error) {

        console.log(
            "conversationAndParticipantGuard error:",
            error
        );

        return res.status(500).json({
            message: "Failed to load messages."
        });
    }
};


export const clearChat = async (req, res) => {
    try {

        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                message: "Invalid conversation id."
            });
        }

        const conversation = await Conversation.findById(
            conversationId
        );

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found."
            });
        }

        const userId = req.user.id.toString();

        const isParticipant = conversation.participants.some(
            id => String(id) === userId
        );

        if (!isParticipant) {
            return res.status(403).json({
                message: "Unauthorized conversation."
            });
        }

        conversation.clearedAt.set(
            userId,
            new Date()
        );

        conversation.deletedFor =
            conversation.deletedFor?.filter(
                id => String(id) !== userId
            ) || [];

        await conversation.save();

        return res.status(200).json({
            message: "Chat cleared successfully."
        });

    } catch (error) {

        console.log(
            "clearChat error:",
            error
        );

        return res.status(500).json({
            message: "Failed to clear chat."
        });
    }
};

export const deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                message: "Invalid conversation id."
            });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found."
            });
        }

        const userId = req.user.id.toString();

        const isParticipant = conversation.participants.some(
            id => String(id) === userId
        );

        if (!isParticipant) {
            return res.status(403).json({
                message: "Unauthorized conversation."
            });
        }

        conversation.clearedAt.set(userId, new Date());

        const alreadyDeleted = conversation.deletedFor?.some(
            id => String(id) === userId
        );

        if (!alreadyDeleted) {
            conversation.deletedFor.push(req.user.id);
        }

        await conversation.save();

        return res.status(200).json({
            message: "Conversation deleted successfully.",
            conversationId
        });

    } catch (error) {
        console.error("deleteConversation error:", error);

        return res.status(500).json({
            message: "Failed to delete conversation."
        });
    }
};
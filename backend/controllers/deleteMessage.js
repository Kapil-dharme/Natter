import mongoose from "mongoose";
import { Message } from "../model/message.js";
import { Conversation } from "../model/conversation.js";

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                message: "Please login again."
            });
        }

        if (!mongoose.isValidObjectId(messageId)) {
            return res.status(400).json({
                message: "Invalid message id."
            });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                message: "Message not found."
            });
        }

        if (String(message.sender) !== String(userId)) {
            return res.status(403).json({
                message: "You can only delete your own messages."
            });
        }

        const conversationId = message.conversationID;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found."
            });
        }
        const isParticipant = conversation.participants.some(
            participant => String(participant) === String(userId)
        );

        if (!isParticipant) {
            return res.status(403).json({
                message: "You are not a participant of this conversation."
            });
        }

        const wasLastMessage =
            conversation.lastMessage &&
            String(conversation.lastMessage) === String(message._id);

        await Message.findByIdAndDelete(messageId);

        let lastMessage = null;
        if (wasLastMessage) {

            lastMessage = await Message.findOne({
                conversationID: conversationId
            })
                .sort({ createdAt: -1 });

            if (lastMessage) {
                conversation.lastMessage = lastMessage._id;
                conversation.lastMessageAt = lastMessage.createdAt;
            } else {
                conversation.lastMessage = null;
                conversation.lastMessageAt = null;
            }

            await conversation.save();

        } else if (conversation.lastMessage) {

            lastMessage = await Message.findById(
                conversation.lastMessage
            );
        }

        return res.status(200).json({
            message: "Message deleted permanently.",
            messageId,
            conversationId,
            lastMessage,
            lastMessageAt: lastMessage?.createdAt || null
        });

    } catch (error) {
        console.error("deleteMessage error:", error);

        return res.status(500).json({
            message: "Failed to delete message."
        });
    }
};
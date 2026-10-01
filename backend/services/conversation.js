import { Conversation } from "../model/conversation.js";

export const updateConversationLastMessage = async (
    conversationID,
    message
) => {
    try {

        const conversation = await Conversation.findById(
            conversationID
        );

        if (!conversation) {
            throw new Error("Conversation not found.");
        }

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;

        const senderId = String(message.sender);

        conversation.deletedFor =
            conversation.deletedFor?.filter(
                id => String(id) === senderId
            ) || [];

        await conversation.save();

        return conversation;

    } catch (error) {

        console.log(
            "updateConversationLastMessage error:",
            error
        );

        throw new Error("Internal server error.");
    }
};
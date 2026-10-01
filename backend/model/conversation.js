import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({

    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ],

    type: {
        type: String,
        enum: ["direct", "group"]
    },

    groupName: {
        type: String,
    },

    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },

    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message"
    },

    lastMessageAt: {
        type: Date
    },

    groupPhoto: {
        type: String,
        default: null
    },

    clearedAt: {
        type: Map,
        of: Date,
        default: {}
    },
    
    memberJoinedAt: {
        type: Map,
        of: Date,
        default: {}
    },

    deletedFor: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ]

}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model(
    "conversation",
    conversationSchema
);

import mongoose from "mongoose"

const messageSchema = new mongoose.Schema({

    conversationID: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "conversation",

        required: true,

    },

    sender: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "user",

        required: true,

    },

    type: {

        type: String,

        enum: ["text", "image", "file"],

        required: true,

    },

    content: {

        type: String,

        required: true,

    },

    encryptionIv: {

        type: String,

        default: null

    },

    replyTo: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "message",

        default: null

    },

    status: {

        type: String,

        enum: ["sent", "delivered", "read"],

        default: "sent"

    },

    notifiedSender: {

        type: Boolean,

        default: false

    },

}, { timestamps: true })

messageSchema.index({ conversationID: 1, createdAt: -1 });

export const Message = mongoose.model("message", messageSchema);


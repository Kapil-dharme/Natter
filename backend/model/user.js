import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        maxlength: [20],
        required: true,
        unique: true,
        trim: true
    },

    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    profileURL: {
        type: String,
        default: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?_=20150327203541"
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],

    pushNotificationsDisabled: {
        type: Boolean,
        default: false
    },
    pushNotificationsConfigured: {
        type: Boolean,
        default: false
    },

    OTP: {
        type: Number,
        default: null
    },

    otpExpiry: {
        type: Date,
        default: null
    },

    unverifiedExpiry: {
        type: Date,
        default: null
    },

    lastOtpSentAt: {
        type: Date,
        default: null
    },

    lastSeen: {
        type: Date,
        default: null
    },

    encryptionPublicKey: {
        type: String,
        default: null
    },

    encryptedPrivateKey: {
        type: String,
        default: null
    }

}, { timestamps: true });

export const User =
    mongoose.models.user || mongoose.model("user", userSchema);
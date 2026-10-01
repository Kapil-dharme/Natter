import mongoose from "mongoose";
import { User } from "../model/user.js";

export const getBlockRelation = async (currentUserId, otherUserId) => {
    const currentUser = await User.findById(currentUserId).select("blockedUsers");
    const otherUser = await User.findById(otherUserId).select("blockedUsers");

    const iBlockedThem = Boolean(
        currentUser?.blockedUsers?.some(
            id => String(id) === String(otherUserId)
        )
    );

    const theyBlockedMe = Boolean(
        otherUser?.blockedUsers?.some(
            id => String(id) === String(currentUserId)
        )
    );

    return { iBlockedThem, theyBlockedMe };
};

export const blockUser = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        if (String(currentUserId) === String(userId)) {
            return res.status(400).json({
                message: "You cannot block yourself."
            });
        }

        const userToBlock = await User.findById(userId);

        if (!userToBlock) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        await User.findByIdAndUpdate(
            currentUserId,
            {
                $addToSet: {
                    blockedUsers: userId
                }
            }
        );

        return res.status(200).json({
            message: "User blocked successfully."
        });

    } catch (error) {
        console.error("blockUser error:", error);

        return res.status(500).json({
            message: "Failed to block user."
        });
    }
};


export const unblockUser = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        await User.findByIdAndUpdate(
            currentUserId,
            {
                $pull: {
                    blockedUsers: userId
                }
            }
        );

        return res.status(200).json({
            message: "User unblocked successfully."
        });

    } catch (error) {
        console.error("unblockUser error:", error);

        return res.status(500).json({
            message: "Failed to unblock user."
        });
    }
};


export const getBlockedUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const user = await User.findById(currentUserId)
            .populate({
                path: "blockedUsers",
                select: "_id userName profileURL"
            })
            .select("blockedUsers");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        return res.status(200).json({
            blockedUsers: user.blockedUsers || []
        });

    } catch (error) {
        console.error("getBlockedUsers error:", error);

        return res.status(500).json({
            message: "Failed to get blocked users."
        });
    }
};


export const checkBlockStatus = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        const currentUser = await User.findById(currentUserId)
            .select("blockedUsers");

        const otherUser = await User.findById(userId)
            .select("_id");

        if (!currentUser || !otherUser) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const iBlockedThem =
            currentUser.blockedUsers.some(
                id => String(id) === String(userId)
            );

        return res.status(200).json({
            iBlockedThem,
            blocked: iBlockedThem
        });

    } catch (error) {
        console.error("checkBlockStatus error:", error);

        return res.status(500).json({
            message: "Failed to check block status."
        });
    }
};
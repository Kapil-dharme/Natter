import { Conversation } from "../model/conversation.js";
import { Message } from "../model/message.js";
import { getIO } from "../services/socketio.js";

export const createGroup = async (req, res) => {
    try {
        console.log("body:", req.body);
        console.log("file:", req.file);

        const { groupName, participantIds } = req.body;
        const creatorId = req.user.id;
        const groupPhoto = req.file?.path || null;

        if (!groupName || !groupName.trim()) {
            return res.status(400).json({
                message: "Group name is required"
            });
        }

        if (
            !participantIds ||
            !Array.isArray(participantIds) ||
            participantIds.length < 2
        ) {
            return res.status(400).json({
                message: "At least 2 participants are required"
            });
        }

        const uniqueParticipants = [
            ...new Set([
                ...participantIds.map(String),
                String(creatorId)
            ])
        ];

        const joinedAt = new Date();

        const memberJoinedAt = {};

        uniqueParticipants.forEach(participantId => {
            memberJoinedAt[participantId] = joinedAt;
        });

        const conversation = await Conversation.create({
            type: "group",
            groupName: groupName.trim(),
            groupAdmin: creatorId,
            participants: uniqueParticipants,
            groupPhoto: groupPhoto,
            memberJoinedAt: memberJoinedAt
        });

        const populated = await conversation.populate(
            "participants",
            "userName profileURL"
        );

        const io = getIO();

        uniqueParticipants.forEach(participantId => {
            io.to(participantId).emit(
                "group_created",
                populated
            );
        });

        res.status(201).json(populated);

        console.log(
            "group created:",
            JSON.stringify(populated, null, 2)
        );

    } catch (error) {
        console.error(
            "createGroup error:",
            error
        );

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const renameGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { groupName } = req.body;
        const userId = req.user.id;

        if (!groupName || !groupName.trim()) {
            return res.status(400).json({ message: "Group name is required" });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Not a group conversation" });
        }

        if (String(conversation.groupAdmin) !== String(userId)) {
            return res.status(403).json({ message: "Only the group admin can rename the group" });
        }

        conversation.groupName = groupName.trim();
        await conversation.save();

        const populated = await conversation.populate("participants", "userName profileURL");

        const io = getIO();
        populated.participants.forEach(participant => {
            io.to(String(participant._id)).emit("group_renamed", {
                conversationId,
                groupName: conversation.groupName
            });
        });

        res.status(200).json(populated);
    } catch (error) {
        console.error("renameGroup error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addParticipants = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { participantIds } = req.body;
        const userId = req.user.id;

        if (
            !participantIds ||
            !Array.isArray(participantIds) ||
            participantIds.length === 0
        ) {
            return res.status(400).json({
                message: "participantIds array is required"
            });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        if (conversation.type !== "group") {
            return res.status(400).json({
                message: "Not a group conversation"
            });
        }

        if (String(conversation.groupAdmin) !== String(userId)) {
            return res.status(403).json({
                message: "Only the group admin can add participants"
            });
        }

        const existingIds = conversation.participants.map(String);

        const newParticipantIds = participantIds.filter(
            id => !existingIds.includes(String(id))
        );

        conversation.participants.push(
            ...newParticipantIds
        );

        const joinedAt = new Date();

        for (const participantId of newParticipantIds) {
            conversation.memberJoinedAt.set(
                String(participantId),
                joinedAt
            );
        }

        await conversation.save();

        const updated = await Conversation.findById(
            conversationId
        ).populate(
            "participants",
            "userName profileURL"
        );

        const io = getIO();

        updated.participants.forEach(participant => {
            const pid = String(participant._id);

            if (existingIds.includes(pid)) {
                io.to(pid).emit(
                    "group_updated",
                    updated
                );
            } else {
                io.to(pid).emit(
                    "group_created",
                    updated
                );
            }
        });

        res.status(200).json(updated);

    } catch (error) {
        console.error(
            "addParticipants error:",
            error
        );

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const removeParticipant = async (req, res) => {
    try {
        const { conversationId, participantId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Not a group conversation" });
        }

        if (String(conversation.groupAdmin) !== String(userId)) {
            return res.status(403).json({ message: "Only the group admin can remove participants" });
        }

        if (String(participantId) === String(userId)) {
            return res.status(400).json({ message: "Use the leave endpoint to remove yourself" });
        }

        if (String(participantId) === String(conversation.groupAdmin)) {
            return res.status(400).json({ message: "Cannot remove the group admin" });
        }

        const isParticipant = conversation.participants.some(
            (p) => String(p) === String(participantId)
        );
        if (!isParticipant) {
            return res.status(404).json({ message: "User is not a participant of this group" });
        }

        await Conversation.findByIdAndUpdate(conversationId, {
            $pull: { participants: participantId },
        });

        const updated = await Conversation.findById(conversationId).populate(
            "participants",
            "userName profileURL"
        );

        const io = getIO();
        updated.participants.forEach(participant => {
            io.to(String(participant._id)).emit("group_updated", updated);
        });
        io.to(String(participantId)).emit("group_removed", { conversationId });

        res.status(200).json(updated);
    } catch (error) {
        console.error("removeParticipant error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Not a group conversation" });
        }

        const isParticipant = conversation.participants.some(
            (p) => String(p) === String(userId)
        );
        if (!isParticipant) {
            return res.status(403).json({ message: "You are not a participant of this group" });
        }

        conversation.participants = conversation.participants.filter(
            (p) => String(p) !== String(userId)
        );

        if (conversation.participants.length === 0) {
            await Message.deleteMany({ conversationId });
            await Conversation.findByIdAndDelete(conversationId);
            return res.status(200).json({ message: "Group deleted as last member left" });
        }

        if (String(conversation.groupAdmin) === String(userId)) {
            conversation.groupAdmin = conversation.participants[0];
        }

        await conversation.save();

        const populated = await conversation.populate("participants", "userName profileURL");

        const io = getIO();
        populated.participants.forEach(participant => {
            io.to(String(participant._id)).emit("group_updated", populated);
        });

        res.status(200).json(populated);
    } catch (error) {
        console.error("leaveGroup error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Not a group conversation" });
        }

        if (String(conversation.groupAdmin) !== String(userId)) {
            return res.status(403).json({ message: "Only the group admin can delete the group" });
        }

        const participantIds = conversation.participants.map(String);

        await Message.deleteMany({ conversationId });
        await Conversation.findByIdAndDelete(conversationId);

        const io = getIO();
        participantIds.forEach(participantId => {
            io.to(participantId).emit("group_deleted", { conversationId });
        });

        res.status(200).json({ message: "Group deleted successfully" });
    } catch (error) {
        console.error("deleteGroup error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateGroupPhoto = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const groupPhoto = req.file?.path || null;

        if (!groupPhoto) return res.status(400).json({ message: "No photo uploaded" });

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        if (String(conversation.groupAdmin) !== String(userId)) {
            return res.status(403).json({ message: "Only admin can change group photo" });
        }

        conversation.groupPhoto = groupPhoto;
        await conversation.save();

        const populated = await conversation.populate("participants", "userName profileURL");

        const io = getIO();
        populated.participants.forEach(p => {
            io.to(String(p._id)).emit("group_updated", populated);
        });

        res.status(200).json(populated);
    } catch (error) {
        console.error("updateGroupPhoto error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

import { User } from "../model/user.js"
import { Conversation } from "../model/conversation.js";
import mongoose from "mongoose"

export const searchUser = async (req, res) => {
  try {
    const searchName = req.query.query?.trim() || '';
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 15, 50);
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(req.user.id)
      .select("blockedUsers");

    const blockedUsers = currentUser?.blockedUsers || [];

    const filter = {
      _id: {
        $ne: req.user.id,
        $nin: blockedUsers
      },
      isVerified: true,
      ...(searchName && {
        userName: {
          $regex: searchName,
          $options: "i"
        }
      })
    };

    const users = await User.find(filter)
      .select("userName profileURL isVerified")
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      user: users
    });

  } catch (error) {
    console.error("searchUser error:", error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

export const singleConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        message: "Invalid conversation id."
      });
    }

    const conversation = await Conversation.findById(
      conversationId
    )
      .populate({
        path: "participants",
        select: "userName profileURL lastSeen isVerified"
      })
      .populate({
        path: "groupAdmin",
        select: "userName profileURL isVerified"
      })
      .populate("lastMessage");

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found."
      });
    }

    const userId = req.user.id.toString();

    const participantExists = conversation.participants.some(
      participant =>
        String(participant._id) === userId
    );

    if (!participantExists) {
      return res.status(403).json({
        message: "Unauthorized conversation."
      });
    }

    const unverifiedParticipant = conversation.participants.some(
      participant => participant.isVerified !== true
    );

    if (unverifiedParticipant) {
      return res.status(403).json({
        message: "This conversation contains an unverified user."
      });
    }

    return res.status(200).json({
      conversation
    });

  } catch (error) {

    console.error(
      "singleConversation error:",
      error
    );

    return res.status(500).json({
      message: "Failed to load conversation.",
      error: error.message
    });
  }
};


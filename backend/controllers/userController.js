
import { User } from '../model/user.js';
import { Conversation } from '../model/conversation.js';
import { getIO } from '../services/socketio.js';

export const updateProfile = async (req, res) => {
  try {
    const updates = {};

    if (req.body.userName) {
      updates.userName = req.body.userName;
    }

    if (req.file) {
      updates.profileURL = req.file.path;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'Nothing to update'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      {
        returnDocument: 'after'
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const conversations = await Conversation.find({
      participants: user._id
    }).select('participants');

    const recipientIds = new Set();

    conversations.forEach(conversation => {
      conversation.participants.forEach(participantId => {
        const id = String(participantId);

        if (id !== String(user._id)) {
          recipientIds.add(id);
        }
      });
    });

    const io = getIO();

    recipientIds.forEach(recipientId => {
      io.to(recipientId).emit('profile_updated', {
        _id: user._id,
        userName: user.userName,
        profileURL: user.profileURL
      });
    });

    return res.status(200).json({
      user
    });

  } catch (error) {
    console.error('updateProfile error:', error);

    return res.status(500).json({
      message: 'Server error'
    });
  }
};


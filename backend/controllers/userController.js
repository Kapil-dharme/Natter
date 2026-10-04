import { User } from '../model/user.js';
import { Conversation } from '../model/conversation.js';
import { getIO } from '../services/socketio.js';
import { validateUsername } from '../utils/username.js';

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    let changed = false;
    const requestedName = req.body.userName;

    const wantsRename =
      typeof requestedName === 'string' &&
      requestedName.trim() !== '' &&
      requestedName.trim() !== user.userName;

    if (wantsRename) {
      const result = validateUsername(requestedName);

      if (!result.ok) {
        return res.status(400).json({
          message: result.message
        });
      }

      if (user.usernameChangedAt) {
        const nextAllowed = new Date(
          user.usernameChangedAt.getTime() + COOLDOWN_MS
        );

        if (nextAllowed > new Date()) {
          const formattedDate = nextAllowed.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
          });

          return res.status(429).json({
            message: 'Username can be changed again on ' + formattedDate,
            nextAllowedAt: nextAllowed.toISOString()
          });
        }
      }

      const taken = await User.exists({
        usernameKey: result.key,
        _id: { $ne: user._id }
      });

      if (taken) {
        return res.status(409).json({
          message: 'Username already taken'
        });
      }

      user.userName = result.username;
      user.usernameKey = result.key;
      user.usernameChangedAt = new Date();
      changed = true;
    }

    if (req.file) {
      user.profileURL = req.file.path;
      changed = true;
    }

    if (!changed) {
      return res.status(400).json({
        message: 'Nothing to update'
      });
    }

    await user.save();

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

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      user: safeUser
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Username already taken'
      });
    }

    console.error('updateProfile error:', error);

    return res.status(500).json({
      message: 'Server error'
    });
  }
};
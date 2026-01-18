import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profilePicture: user.profilePicture,
      isOAuthUser: user.isOAuthUser,
      hasApiKey1: !!user.geminiApiKey1,
      hasApiKey2: !!user.geminiApiKey2,
      currentApiKeyIndex: user.currentApiKeyIndex,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { name, phone, geminiApiKey1, geminiApiKey2 } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update basic info
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    
    // Update API keys
    if (geminiApiKey1 !== undefined) {
      user.geminiApiKey1 = geminiApiKey1;
      // If this was the current key and it's being cleared, switch to key 2
      if (!geminiApiKey1 && user.currentApiKeyIndex === 1 && user.geminiApiKey2) {
        user.currentApiKeyIndex = 2;
      }
    }
    
    if (geminiApiKey2 !== undefined) {
      user.geminiApiKey2 = geminiApiKey2;
      // If this was the current key and it's being cleared, switch to key 1
      if (!geminiApiKey2 && user.currentApiKeyIndex === 2 && user.geminiApiKey1) {
        user.currentApiKeyIndex = 1;
      }
    }
    
    // Ensure at least one API key exists for all users
    if (!user.geminiApiKey1 && !user.geminiApiKey2) {
      return res.status(400).json({ error: 'At least one Gemini API key is required for all users' });
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isOAuthUser: user.isOAuthUser,
        hasApiKey1: !!user.geminiApiKey1,
        hasApiKey2: !!user.geminiApiKey2,
        currentApiKeyIndex: user.currentApiKeyIndex,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Switch API key (for failover)
router.post('/switch-api-key', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const newApiKey = await user.switchToBackupApiKey();
    
    if (!newApiKey) {
      return res.status(400).json({ error: 'No backup API key available' });
    }
    
    res.json({
      message: 'Switched to backup API key',
      currentApiKeyIndex: user.currentApiKeyIndex,
      hasBackupKey: user.currentApiKeyIndex === 1 ? !!user.geminiApiKey2 : !!user.geminiApiKey1
    });
  } catch (error) {
    console.error('Switch API key error:', error);
    res.status(500).json({ error: 'Failed to switch API key' });
  }
});

export default router;
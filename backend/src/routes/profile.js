import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { testWhatsAppConnection } from '../services/whatsappService.js';

const router = express.Router();

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const includeKeys = req.query.includeKeys === 'true';
    
    const profileData = {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profilePicture: user.profilePicture,
      isOAuthUser: user.isOAuthUser,
      hasApiKey1: !!user.geminiApiKey1,
      hasApiKey2: !!user.geminiApiKey2,
      currentApiKeyIndex: user.currentApiKeyIndex,
      hasResendApiKey: !!user.resendApiKey,
      hasWhatsAppApiKey: !!user.whatsappApiKey,
      whatsappPhone: user.whatsappPhone,
      whatsappEnabled: user.whatsappEnabled,
      emailEnabled: user.emailEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    // Include actual API keys if requested (for showing current keys)
    if (includeKeys) {
      profileData.currentGeminiApiKey1 = user.geminiApiKey1;
      profileData.currentGeminiApiKey2 = user.geminiApiKey2;
      profileData.currentResendApiKey = user.resendApiKey;
      profileData.currentWhatsAppApiKey = user.whatsappApiKey;
      profileData.currentVoiceAppId = user.voiceAppId;
      profileData.currentVoiceAppCertificate = user.voiceAppCertificate;
    }
    
    res.json(profileData);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      phone, 
      geminiApiKey1, 
      geminiApiKey2, 
      resendApiKey, 
      whatsappApiKey, 
      whatsappPhone,
      whatsappEnabled,
      emailEnabled
    } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update basic info
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    
    // Update WhatsApp configuration
    if (whatsappApiKey !== undefined) {
      user.whatsappApiKey = whatsappApiKey.trim() || null;
    }
    if (whatsappPhone !== undefined) {
      user.whatsappPhone = whatsappPhone.trim() || null;
    }
    if (whatsappEnabled !== undefined) {
      user.whatsappEnabled = whatsappEnabled;
    }
    
    // Update notification preferences
    if (emailEnabled !== undefined) {
      user.emailEnabled = emailEnabled;
    }
    
    // Update Resend API key
    if (resendApiKey !== undefined) {
      user.resendApiKey = resendApiKey.trim() || null;
    }
    
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
    
    // Ensure at least one Gemini API key exists (required for all users)
    if (geminiApiKey1 !== undefined || geminiApiKey2 !== undefined) {
      if (!user.geminiApiKey1 && !user.geminiApiKey2) {
        return res.status(400).json({ error: 'At least one Gemini API key is required' });
      }
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
        hasResendApiKey: !!user.resendApiKey,
        hasWhatsAppApiKey: !!user.whatsappApiKey,
        whatsappPhone: user.whatsappPhone,
        whatsappEnabled: user.whatsappEnabled,
        emailEnabled: user.emailEnabled,
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

// Test WhatsApp connection
router.post('/test-whatsapp', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const whatsappPhone = user.whatsappPhone || user.phone;
    if (!user.whatsappApiKey || !whatsappPhone) {
      return res.status(400).json({ error: 'WhatsApp API key and phone number are required' });
    }
    
    const success = await testWhatsAppConnection(whatsappPhone, user.whatsappApiKey);
    
    if (success) {
      res.json({ message: 'WhatsApp test message sent successfully!' });
    } else {
      res.status(500).json({ error: 'Failed to send WhatsApp test message. Please check your API key and phone number.' });
    }
  } catch (error) {
    console.error('WhatsApp test error:', error);
    res.status(500).json({ error: 'Failed to test WhatsApp connection' });
  }
});

export default router;
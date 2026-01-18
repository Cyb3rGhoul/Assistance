import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Traditional registration (now requires API key)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, geminiApiKey } = req.body;
    
    if (!geminiApiKey || !geminiApiKey.trim()) {
      return res.status(400).json({ error: 'Gemini API key is required for all users' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({ 
      email, 
      password, 
      name,
      isOAuthUser: false,
      geminiApiKey1: geminiApiKey.trim(),
      currentApiKeyIndex: 1
    });
    await user.save();

    const token = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email, 
        name,
        isOAuthUser: false
      },
      message: 'Account created successfully with your personal API key.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Traditional login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if this is an OAuth user trying to login with password
    if (user.isOAuthUser) {
      return res.status(400).json({ 
        error: 'This account uses Google OAuth. Please sign in with Google.',
        isOAuthAccount: true
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        isOAuthUser: false
      },
      message: user.isOAuthUser ? undefined : 'Note: Email reminders are only available for Google OAuth users.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

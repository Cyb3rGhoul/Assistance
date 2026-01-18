import express from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// In-memory store for OAuth states (in production, use Redis or database)
const stateStore = new Map();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 10 * 60 * 1000);

// Helper function to get OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
  );
};

// Generate Google OAuth URL
router.get('/google', (req, res) => {
  try {
    // Check if OAuth is properly configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URL) {
      return res.status(500).json({ 
        error: 'Google OAuth is not properly configured. Please check environment variables.' 
      });
    }

    const oauth2Client = getOAuth2Client();
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state with timestamp
    stateStore.set(state, {
      timestamp: Date.now(),
      used: false
    });
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state,
    });
    
    res.json({ url });
  } catch (error) {
    console.error('OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Verify state to prevent CSRF attacks
    const stateData = stateStore.get(state);
    if (!stateData || stateData.used || Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      console.error('State verification failed:', { state, stateData });
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=state_mismatch`);
    }
    
    // Mark state as used and remove it
    stateStore.delete(state);
    
    const oauth2Client = getOAuth2Client();
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info from Google
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });
    
    const { data } = await oauth2.userinfo.get();
    
    // Check if user exists or create new user
    let user = await User.findOne({ 
      $or: [
        { googleId: data.id },
        { email: data.email }
      ]
    });
    
    if (user) {
      // Update existing user with Google info if not already set
      if (!user.googleId) {
        user.googleId = data.id;
        user.isOAuthUser = true;
        user.profilePicture = data.picture;
        await user.save();
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Redirect to frontend with token
      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&success=true`);
    } else {
      // Create temporary token for signup process
      const tempToken = jwt.sign(
        { 
          googleId: data.id,
          email: data.email,
          name: data.name,
          profilePicture: data.picture,
          temp: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '10m' } // Short expiry for temp token
      );
      
      // Redirect to frontend signup page with temp token
      return res.redirect(`${process.env.FRONTEND_URL}/signup?oauth=google&token=${tempToken}&email=${encodeURIComponent(data.email)}&name=${encodeURIComponent(data.name)}`);
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// Complete OAuth signup with API key
router.post('/google/complete-signup', async (req, res) => {
  try {
    const { geminiApiKey, resendApiKey } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const tempToken = authHeader.split(' ')[1];
    
    // Verify temp token
    let googleData;
    try {
      googleData = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (!googleData.temp) {
        return res.status(400).json({ error: 'Invalid token type' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    if (!geminiApiKey) {
      return res.status(400).json({ error: 'Gemini API key is required' });
    }
    
    if (!resendApiKey) {
      return res.status(400).json({ error: 'Resend API key is required for email notifications' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { googleId: googleData.googleId },
        { email: googleData.email }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user with Google OAuth data
    const user = new User({
      googleId: googleData.googleId,
      email: googleData.email,
      name: googleData.name,
      profilePicture: googleData.profilePicture,
      isOAuthUser: true,
      geminiApiKey1: geminiApiKey,
      resendApiKey: resendApiKey,
      currentApiKeyIndex: 1
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        isOAuthUser: true
      }
    });
    
  } catch (error) {
    console.error('Complete signup error:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
});

// Debug endpoint to check OAuth configuration
router.get('/debug', (req, res) => {
  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasRedirectUrl: !!process.env.GOOGLE_REDIRECT_URL,
    redirectUrl: process.env.GOOGLE_REDIRECT_URL,
    clientIdPrefix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'NOT_SET',
    stateStoreSize: stateStore.size
  });
});

export default router;
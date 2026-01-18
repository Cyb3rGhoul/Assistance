import express from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

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
    req.session.state = state;
    
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
    if (state !== req.session.state) {
      return res.status(403).json({ error: 'State mismatch. Possible CSRF attack.' });
    }
    
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
    } else {
      // Create new user - redirect to signup with Google data
      req.session.googleUserData = {
        googleId: data.id,
        email: data.email,
        name: data.name,
        profilePicture: data.picture
      };
      
      // Redirect to frontend signup page with Google data
      return res.redirect(`${process.env.FRONTEND_URL}/signup?oauth=google&email=${encodeURIComponent(data.email)}&name=${encodeURIComponent(data.name)}`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Clear session data
    delete req.session.state;
    delete req.session.googleUserData;
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&success=true`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// Complete OAuth signup with API key
router.post('/google/complete-signup', async (req, res) => {
  try {
    const { geminiApiKey } = req.body;
    
    if (!req.session.googleUserData) {
      return res.status(400).json({ error: 'No Google user data found. Please restart the OAuth process.' });
    }
    
    if (!geminiApiKey) {
      return res.status(400).json({ error: 'Gemini API key is required' });
    }
    
    const googleData = req.session.googleUserData;
    
    // Create new user with Google OAuth data
    const user = new User({
      googleId: googleData.googleId,
      email: googleData.email,
      name: googleData.name,
      profilePicture: googleData.profilePicture,
      isOAuthUser: true,
      geminiApiKey1: geminiApiKey,
      currentApiKeyIndex: 1
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Clear session data
    delete req.session.googleUserData;
    
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
    clientIdPrefix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'NOT_SET'
  });
});

export default router;
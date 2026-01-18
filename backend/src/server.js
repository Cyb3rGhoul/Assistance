import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import profileRoutes from './routes/profile.js';
import taskRoutes from './routes/tasks.js';
import voiceRoutes from './routes/voice.js';
import linkRoutes from './routes/links.js';
import { startReminderCron } from './services/reminderService.js';
import { startKeepAlive } from './services/keepAliveService.js';

dotenv.config();

const app = express();

app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true // Allow credentials for session cookies
}));
app.use(express.json());

// Session middleware for OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/links', linkRoutes);

// Health check endpoint for keep-alive
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'ARIA Backend is alive'
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    startReminderCron();
    startKeepAlive();
  })
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ARIA Server running on port ${PORT}`);
});

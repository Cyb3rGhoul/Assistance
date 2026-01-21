import express from 'express';
import { sendWhatsAppReminder } from '../services/whatsappService.js';
import User from '../models/User.js';

const router = express.Router();

// Test endpoint to send WhatsApp message to a user
router.post('/test-send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }
    
    // Find user by phone number
    const user = await User.findOne({
      $or: [
        { whatsappPhone: phone },
        { phone: phone }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.whatsappApiKey) {
      return res.status(400).json({ error: 'User does not have WhatsApp API key configured' });
    }
    
    // Send the message
    const success = await sendWhatsAppReminder(
      message,
      user.whatsappPhone || user.phone,
      user.whatsappApiKey
    );
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Test message sent successfully',
        phone: user.whatsappPhone || user.phone
      });
    } else {
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
    
  } catch (error) {
    console.error('Test send error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
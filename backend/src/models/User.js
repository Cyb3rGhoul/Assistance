import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for OAuth users
  name: { type: String, required: true },
  phone: { type: String }, // Optional phone number for WhatsApp notifications
  
  // Google OAuth fields
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  isOAuthUser: { type: Boolean, default: false },
  
  // Gemini API keys with failover support (REQUIRED for all users)
  geminiApiKey1: { type: String, required: true }, // Primary API key (required)
  geminiApiKey2: { type: String }, // Secondary API key for failover (optional)
  currentApiKeyIndex: { type: Number, default: 1 }, // 1 for primary, 2 for secondary
  
  // Resend API key for email notifications (REQUIRED for all users)
  resendApiKey: { type: String, required: true },
  
  // WhatsApp API configuration (OPTIONAL)
  whatsappApiKey: { type: String }, // Whatabot API key for WhatsApp reminders
  whatsappPhone: { type: String }, // User's WhatsApp phone number (with country code) - defaults to main phone
  whatsappEnabled: { type: Boolean, default: false }, // Toggle for WhatsApp reminders
  
  // Notification preferences
  emailEnabled: { type: Boolean, default: true }, // Toggle for email reminders (always enabled by default)
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  // Only hash password if it exists and is modified (for non-OAuth users)
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false; // OAuth users don't have passwords
  return bcrypt.compare(password, this.password);
};

// Method to get current active API key
userSchema.methods.getCurrentApiKey = function() {
  return this.currentApiKeyIndex === 1 ? this.geminiApiKey1 : this.geminiApiKey2;
};

// Method to switch to backup API key
userSchema.methods.switchToBackupApiKey = async function() {
  this.currentApiKeyIndex = this.currentApiKeyIndex === 1 ? 2 : 1;
  await this.save();
  return this.getCurrentApiKey();
};

// Method to check if user has valid API keys
userSchema.methods.hasValidApiKeys = function() {
  return !!(this.geminiApiKey1 || this.geminiApiKey2);
};

export default mongoose.model('User', userSchema);

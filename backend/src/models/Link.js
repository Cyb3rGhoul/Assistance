import mongoose from 'mongoose';

const linkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  favicon: { type: String },
  autoTags: [{ type: String }], // AI-generated tags
  userTags: [{ type: String }], // User-added tags
  category: { type: String }, // AI-generated category
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for better search performance
linkSchema.index({ userId: 1, autoTags: 1 });
linkSchema.index({ userId: 1, userTags: 1 });
linkSchema.index({ userId: 1, category: 1 });

export default mongoose.model('Link', linkSchema);
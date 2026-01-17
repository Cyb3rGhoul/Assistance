import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  dueDate: { type: Date },
  reminderTime: { type: Date },
  completed: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Helper function to convert time to IST
taskSchema.methods.toIST = function(date) {
  if (!date) return null;
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  return new Date(date.getTime() + istOffset);
};

// Virtual for IST display
taskSchema.virtual('reminderTimeIST').get(function() {
  return this.toIST(this.reminderTime);
});

taskSchema.virtual('dueDateIST').get(function() {
  return this.toIST(this.dueDate);
});

// Index for efficient reminder queries
taskSchema.index({ reminderTime: 1, reminderSent: 1, completed: 1 });
taskSchema.index({ userId: 1, completed: 1 });

export default mongoose.model('Task', taskSchema);

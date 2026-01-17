import cron from 'node-cron';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendTaskReminder, sendMorningSummary, sendEveningReport } from './emailService.js';

export const startReminderCron = () => {
  // Check every minute for task reminders (5 min before due time)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);
      
      const tasks = await Task.find({
        reminderTime: { 
          $gte: now, 
          $lte: fiveMinutesLater 
        },
        reminderSent: false,
        completed: false
      }).populate('userId');

      for (const task of tasks) {
        // Send email reminder only
        await sendTaskReminder(task, task.userId.email);
        
        task.reminderSent = true;
        await task.save();
      }
    } catch (error) {
      console.error('Reminder cron error:', error);
    }
  });

  // Morning summary at 8:00 AM IST every day
  cron.schedule('30 2 * * *', async () => { // 2:30 UTC = 8:00 AM IST
    try {
      const users = await User.find();
      
      for (const user of users) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const tasks = await Task.find({
          userId: user._id,
          $or: [
            { dueDate: { $gte: todayStart, $lte: todayEnd } },
            { dueDate: null, completed: false }
          ]
        });
        
        if (tasks.length > 0) {
          // Send email summary only
          await sendMorningSummary(user.email, tasks);
        }
      }
      console.log('✉️ Morning summaries sent');
    } catch (error) {
      console.error('Morning summary error:', error);
    }
  });

  // Evening report at 8:00 PM IST every day
  cron.schedule('30 14 * * *', async () => { // 14:30 UTC = 8:00 PM IST
    try {
      const users = await User.find();
      
      for (const user of users) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const completedTasks = await Task.find({
          userId: user._id,
          completed: true,
          updatedAt: { $gte: todayStart, $lte: todayEnd }
        });
        
        const pendingTasks = await Task.find({
          userId: user._id,
          completed: false
        });
        
        // Send email report only
        await sendEveningReport(user.email, completedTasks, pendingTasks);
      }
      console.log('✉️ Evening reports sent');
    } catch (error) {
      console.error('Evening report error:', error);
    }
  });

  console.log('⏰ Reminder service started (Email only)');
};

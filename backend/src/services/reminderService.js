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
        await sendTaskReminder(task, task.userId.email);
        task.reminderSent = true;
        await task.save();
      }
    } catch (error) {
      console.error('Reminder cron error:', error);
    }
  });

  // Morning summary at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
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
          await sendMorningSummary(user.email, tasks);
        }
      }
      console.log('✉️ Morning summaries sent');
    } catch (error) {
      console.error('Morning summary error:', error);
    }
  });

  // Evening report at 8:00 PM every day
  cron.schedule('0 20 * * *', async () => {
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
        
        await sendEveningReport(user.email, completedTasks, pendingTasks);
      }
      console.log('✉️ Evening reports sent');
    } catch (error) {
      console.error('Evening report error:', error);
    }
  });

  console.log('⏰ Reminder service started (5-min alerts, 8AM summaries, 8PM reports)');
};

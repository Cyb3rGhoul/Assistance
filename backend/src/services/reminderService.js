import cron from 'node-cron';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendTaskReminder, sendMorningSummary, sendEveningReport } from './emailService.js';

export const startReminderCron = () => {
  console.log('Reminder service started');
  
  // Check every 5 minutes for task reminders (5 min before due time)
  cron.schedule('*/5 * * * *', async () => {
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

      // Only log when there are actual reminders to send
      if (tasks.length > 0) {
        console.log(`Sending ${tasks.length} reminder(s)`);
        
        for (const task of tasks) {
          console.log(`Processing reminder for: ${task.title} (due: ${task.reminderTime.toISOString()})`);
          
          // Send reminder to user's email (all users get reminders now)
          const emailSent = await sendTaskReminder(task, task.userId.email, task.userId.resendApiKey);
          
          if (emailSent) {
            task.reminderSent = true;
            await task.save();
            console.log(`Reminder sent: ${task.title}`);
          } else {
            console.log(`Failed reminder: ${task.title}`);
          }
        }
      }
    } catch (error) {
      console.error('Reminder cron error:', error);
    }
  });

  // Morning summary at 8:00 AM IST every day
  cron.schedule('30 2 * * *', async () => { // 2:30 UTC = 8:00 AM IST
    try {
      console.log('Running morning summary...');
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
          // Send morning summary to all users
          const tasksByUser = {};
          tasks.forEach(task => {
            if (!tasksByUser[task.userId.email]) {
              tasksByUser[task.userId.email] = [];
            }
            tasksByUser[task.userId.email].push(task);
          });
          
          // Send summary to each user
          for (const [email, userTasks] of Object.entries(tasksByUser)) {
            const user = await User.findOne({ email });
            const emailSent = await sendMorningSummary(email, userTasks, user?.resendApiKey);
            if (emailSent) {
              console.log(`Morning summary sent to ${email}`);
            } else {
              console.log(`Failed morning summary to ${email}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Morning summary error:', error);
    }
  });

  // Evening report at 8:00 PM IST every day
  cron.schedule('30 14 * * *', async () => { // 14:30 UTC = 8:00 PM IST
    try {
      console.log('Running evening report...');
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
        
        // Send evening report to all users
        const emailSent = await sendEveningReport(user.email, completedTasks, pendingTasks, user.resendApiKey);
        if (emailSent) {
          console.log(`Evening report sent to ${user.email}`);
        } else {
          console.log(`Failed evening report to ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Evening report error:', error);
    }
  });

  // Clean startup message
  console.log('Reminder service started');
};

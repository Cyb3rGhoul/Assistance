import cron from 'node-cron';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendTaskReminder, sendMorningSummary, sendEveningReport } from './emailService.js';
import { sendTaskReminderWhatsApp, sendMorningSummaryWhatsApp, sendEveningReportWhatsApp } from './whatsappService.js';

export const startReminderCron = () => {
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
        for (const task of tasks) {
          // Get full user data to access resendApiKey
          const User = (await import('../models/User.js')).default;
          const user = await User.findById(task.userId._id);
          
          if (!user || !user.resendApiKey) {
            continue;
          }
          
          // Send reminder to user's email (if enabled)
          let emailSent = false;
          if (user.emailEnabled && user.resendApiKey) {
            emailSent = await sendTaskReminder(task, user.email, user.resendApiKey);
          }
          
          // Send WhatsApp reminder (if enabled and configured)
          let whatsappSent = false;
          if (user.whatsappEnabled && user.whatsappApiKey) {
            const whatsappPhone = user.whatsappPhone || user.phone;
            if (whatsappPhone) {
              whatsappSent = await sendTaskReminderWhatsApp(task, whatsappPhone, user.whatsappApiKey);
            }
          }
          
          if (emailSent || whatsappSent) {
            task.reminderSent = true;
            await task.save();
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
      const users = await User.find();
      
      for (const user of users) {
        if (!user.resendApiKey) {
          continue;
        }
        
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
          // Send email morning summary (if enabled)
          if (user.emailEnabled && user.resendApiKey) {
            await sendMorningSummary(user.email, tasks, user.resendApiKey);
          }
          
          // Send WhatsApp morning summary (if enabled and configured)
          if (user.whatsappEnabled && user.whatsappApiKey) {
            const whatsappPhone = user.whatsappPhone || user.phone;
            if (whatsappPhone) {
              await sendMorningSummaryWhatsApp(tasks, whatsappPhone, user.whatsappApiKey);
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
      const users = await User.find();
      
      for (const user of users) {
        if (!user.resendApiKey) {
          continue;
        }
        
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
        
        // Send evening report (if email enabled)
        if (user.emailEnabled && user.resendApiKey) {
          await sendEveningReport(user.email, completedTasks, pendingTasks, user.resendApiKey);
        }
        
        // Send WhatsApp evening report (if enabled and configured)
        if (user.whatsappEnabled && user.whatsappApiKey) {
          const whatsappPhone = user.whatsappPhone || user.phone;
          if (whatsappPhone) {
            await sendEveningReportWhatsApp(completedTasks, pendingTasks, whatsappPhone, user.whatsappApiKey);
          }
        }
      }
    } catch (error) {
      console.error('Evening report error:', error);
    }
  });

  // Clean startup message
  console.log('Reminder service started');
};

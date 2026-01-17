import cron from 'node-cron';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendTaskReminder, sendMorningSummary, sendEveningReport } from './emailService.js';

export const startReminderCron = () => {
  console.log('⏰ Starting reminder service...');
  
  // Check every minute for task reminders (5 min before due time)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);
      
      // Log current time for debugging
      const istTime = now.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log(`🔍 Checking reminders at ${istTime} IST`);
      
      const tasks = await Task.find({
        reminderTime: { 
          $gte: now, 
          $lte: fiveMinutesLater 
        },
        reminderSent: false,
        completed: false
      }).populate('userId');

      if (tasks.length > 0) {
        console.log(`📧 Found ${tasks.length} task(s) to remind`);
      }

      for (const task of tasks) {
        console.log(`📤 Sending reminder for: ${task.title}`);
        // Send email reminder only
        const emailSent = await sendTaskReminder(task, task.userId.email);
        
        if (emailSent) {
          task.reminderSent = true;
          await task.save();
          console.log(`✅ Reminder sent and marked for: ${task.title}`);
        } else {
          console.log(`❌ Failed to send reminder for: ${task.title}`);
        }
      }
    } catch (error) {
      console.error('❌ Reminder cron error:', error);
    }
  });

  // Morning summary at 8:00 AM IST every day
  cron.schedule('30 2 * * *', async () => { // 2:30 UTC = 8:00 AM IST
    try {
      console.log('🌅 Running morning summary job...');
      const users = await User.find();
      console.log(`👥 Found ${users.length} user(s) for morning summary`);
      
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
          console.log(`📧 Sending morning summary to ${user.email} (${tasks.length} tasks)`);
          const emailSent = await sendMorningSummary(user.email, tasks);
          if (emailSent) {
            console.log(`✅ Morning summary sent to ${user.email}`);
          } else {
            console.log(`❌ Failed to send morning summary to ${user.email}`);
          }
        } else {
          console.log(`📭 No tasks for ${user.email}, skipping morning summary`);
        }
      }
      console.log('✉️ Morning summaries completed');
    } catch (error) {
      console.error('❌ Morning summary error:', error);
    }
  });

  // Evening report at 8:00 PM IST every day
  cron.schedule('30 14 * * *', async () => { // 14:30 UTC = 8:00 PM IST
    try {
      console.log('🌙 Running evening report job...');
      const users = await User.find();
      console.log(`👥 Found ${users.length} user(s) for evening report`);
      
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
        
        console.log(`📧 Sending evening report to ${user.email} (${completedTasks.length} completed, ${pendingTasks.length} pending)`);
        const emailSent = await sendEveningReport(user.email, completedTasks, pendingTasks);
        if (emailSent) {
          console.log(`✅ Evening report sent to ${user.email}`);
        } else {
          console.log(`❌ Failed to send evening report to ${user.email}`);
        }
      }
      console.log('✉️ Evening reports completed');
    } catch (error) {
      console.error('❌ Evening report error:', error);
    }
  });

  // Log cron job schedule
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: true
  });
  
  console.log('⏰ Reminder service started (Email only)');
  console.log(`🕐 Current IST time: ${currentTime}`);
  console.log('📅 Schedule:');
  console.log('   • Task reminders: Every minute');
  console.log('   • Morning summary: 8:00 AM IST daily');
  console.log('   • Evening report: 8:00 PM IST daily');
};

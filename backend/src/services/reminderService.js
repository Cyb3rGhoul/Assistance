import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Task from '../models/Task.js';
import User from '../models/User.js';

const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const startReminderCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const tasks = await Task.find({
        reminderTime: { $lte: now },
        reminderSent: false,
        completed: false
      }).populate('userId');

      for (const task of tasks) {
        await sendReminderEmail(task);
        task.reminderSent = true;
        await task.save();
      }
    } catch (error) {
      console.error('Reminder cron error:', error);
    }
  });
  console.log('⏰ Reminder service started');
};

async function sendReminderEmail(task) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: task.userId.email,
      subject: `⏰ Reminder: ${task.title}`,
      html: `
        <h2>Task Reminder</h2>
        <p><strong>${task.title}</strong></p>
        <p>${task.description || ''}</p>
        <p>Due: ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'No due date'}</p>
      `
    });
    console.log(`✉️ Reminder sent for: ${task.title}`);
  } catch (error) {
    console.error('Email send error:', error);
  }
}

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

// Email transporter - created lazily to ensure env vars are loaded
function getEmailTransporter() {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = process.env.EMAIL_PASS?.trim();
  const emailProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'auto';
  
  if (!emailUser || !emailPass) {
    throw new Error('Email configuration missing. Please set EMAIL_USER and EMAIL_PASS in .env file');
  }
  
  // Auto-detect provider from email address if not specified
  let host, port, secure, fromEmail;
  const isGmail = emailUser.includes('@gmail.com');
  const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com');
  
  if (emailProvider === 'brevo' || emailProvider === 'sendinblue') {
    // Brevo (Sendinblue) SMTP - FREE: 300 emails/day, 9,000/month
    // Get credentials from: https://app.brevo.com/settings/keys/api
    host = 'smtp-relay.brevo.com';
    port = 587;
    secure = false;
    fromEmail = emailUser; // Use your verified sender email
  } else if (emailProvider === 'sendpulse') {
    // SendPulse SMTP - FREE: 12,000 emails/month
    // Get credentials from: https://sendpulse.com/settings/smtp
    host = 'smtp.sendpulse.com';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  } else if (emailProvider === 'smtp2go') {
    // SMTP2GO - FREE: 1,000 emails/month
    // Get credentials from: https://www.smtp2go.com/settings/users/
    host = 'mail.smtp2go.com';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  } else if (emailProvider === 'mailgun') {
    // Mailgun - FREE: 100 emails/day (first 3 months)
    // Get credentials from: https://app.mailgun.com/app/sending/domains
    host = 'smtp.mailgun.org';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  } else if (emailProvider === 'gmail' || (emailProvider === 'auto' && isGmail)) {
    // Gmail SMTP configuration (recommended - still supports app passwords)
    host = 'smtp.gmail.com';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  } else if (emailProvider === 'outlook' || (emailProvider === 'auto' && isOutlook)) {
    // Outlook SMTP - Note: Microsoft has disabled basic auth for many accounts
    host = 'smtp-mail.outlook.com';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  } else {
    // Default to Gmail
    host = 'smtp.gmail.com';
    port = 587;
    secure = false;
    fromEmail = emailUser;
  }
  
  const config = {
    host: host,
    port: port,
    secure: secure,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  };
  
  // Add TLS options for better compatibility
  if (emailProvider === 'brevo' || emailProvider === 'sendinblue' || emailProvider === 'sendpulse' || emailProvider === 'smtp2go' || emailProvider === 'mailgun') {
    config.requireTLS = true;
  } else if (isGmail) {
    config.requireTLS = true;
  } else if (isOutlook) {
    config.requireTLS = true;
    config.tls = {
      ciphers: 'SSLv3'
    };
  }
  
  return { transporter: nodemailer.createTransport(config), fromEmail: fromEmail || emailUser };
}

const router = express.Router();
router.use(authenticateToken);

router.post('/process', async (req, res) => {
  try {
    const { command } = req.body;
    
    console.log('Processing command:', command);
    
    // Validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not set or is empty');
    }
    
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey.length);
    console.log('API Key starts with AIza:', apiKey.startsWith('AIza'));
    
    // Initialize AI client with validated API key
    // Explicitly set vertexai to false to prevent default credentials lookup
    const ai = new GoogleGenAI({
      apiKey: apiKey.trim(),
      vertexai: false
    });

    // First, get all user tasks to help AI identify tasks by title
    const allTasks = await Task.find({ userId: req.user.userId });
    const tasksList = allTasks.map(t => ({
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      reminderTime: t.reminderTime,
      completed: t.completed
    }));

    const prompt = `You are ARIA, a voice assistant. Parse this command and return ONLY a JSON object (no markdown, no extra text):
Command: "${command}"

Available tasks:
${JSON.stringify(tasksList, null, 2)}

Return format:
{
  "action": "create|list|update|delete|complete|sendEmail",
  "task": {
    "title": "task title (for matching existing tasks)",
    "description": "details or null",
    "dueDate": "ISO date string or null (only if mentioned)",
    "reminderTime": "ISO date string or null (only if mentioned)"
  },
  "taskId": "task id from available tasks if updating/deleting/completing (match by title)",
  "updateFields": {
    "title": "new title or null",
    "description": "new description or null",
    "dueDate": "new ISO date string or null",
    "reminderTime": "new ISO date string or null"
  },
  "email": {
    "subject": "email subject or null",
    "body": "email body/content or null"
  },
  "response": "natural language response to user"
}

IMPORTANT RULES:
- For "update": Only include fields in "updateFields" that the user explicitly mentioned to change
- For "update": Match the task by title from available tasks and set "taskId"
- For "delete": Match the task by title from available tasks and set "taskId"
- For "complete": Match the task by title from available tasks and set "taskId"
- For "sendEmail": Extract subject and body from the user's command. If user says "send me an email" without details, use a default subject like "Message from ARIA" and ask what they want to send
- If task title is ambiguous, use the most recent or most relevant task
- For updates: If user says "update the date", only set "updateFields.dueDate", leave others null
- For updates: If user says "change the title", only set "updateFields.title", leave others null

Examples:
- "remind me to buy groceries tomorrow at 5pm" → action: create
- "what are my tasks today" → action: list
- "mark buy groceries as complete" → action: complete, taskId: (match from tasks)
- "delete the grocery task" → action: delete, taskId: (match from tasks)
- "update the meeting date to tomorrow" → action: update, taskId: (match "meeting"), updateFields: {dueDate: "2024-...", title: null, description: null, reminderTime: null}
- "change the meeting title to team meeting" → action: update, taskId: (match "meeting"), updateFields: {title: "team meeting", description: null, dueDate: null, reminderTime: null}
- "send me an email" → action: sendEmail, email: {subject: "Message from ARIA", body: "This is a message sent via voice command from ARIA assistant."}
- "send me an email about the meeting tomorrow" → action: sendEmail, email: {subject: "Meeting Tomorrow", body: "Reminder: You have a meeting scheduled for tomorrow."}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    
    const text = response.text.trim();
    
    console.log('Gemini response:', text);
    
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    let responseData = { ...parsed };

    switch (parsed.action) {
      case 'create':
        const newTask = new Task({ ...parsed.task, userId: req.user.userId });
        await newTask.save();
        responseData.taskCreated = newTask;
        break;

      case 'list':
        const tasks = await Task.find({ userId: req.user.userId, completed: false });
        responseData.tasks = tasks;
        if (tasks.length === 0) {
          responseData.response = "You have no pending tasks.";
        } else {
          responseData.response = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.title).join(', ')}`;
        }
        break;

      case 'update':
        let taskToUpdateId = parsed.taskId;
        
        if (!taskToUpdateId && parsed.task?.title) {
          // Try to find task by title if taskId not provided
          const taskToUpdate = await Task.findOne({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: req.user.userId 
          });
          if (!taskToUpdate) {
            throw new Error(`Task "${parsed.task.title}" not found`);
          }
          taskToUpdateId = taskToUpdate._id;
        }

        if (!taskToUpdateId) {
          throw new Error('Task ID or title is required for update');
        }

        // Build update object with only specified fields
        const updateData = { updatedAt: new Date() };
        if (parsed.updateFields) {
          if (parsed.updateFields.title !== null && parsed.updateFields.title !== undefined && parsed.updateFields.title !== '') {
            updateData.title = parsed.updateFields.title;
          }
          if (parsed.updateFields.description !== null && parsed.updateFields.description !== undefined) {
            updateData.description = parsed.updateFields.description || null;
          }
          if (parsed.updateFields.dueDate !== null && parsed.updateFields.dueDate !== undefined) {
            updateData.dueDate = parsed.updateFields.dueDate ? new Date(parsed.updateFields.dueDate) : null;
          }
          if (parsed.updateFields.reminderTime !== null && parsed.updateFields.reminderTime !== undefined) {
            updateData.reminderTime = parsed.updateFields.reminderTime ? new Date(parsed.updateFields.reminderTime) : null;
          }
        }

        const updatedTask = await Task.findOneAndUpdate(
          { _id: taskToUpdateId, userId: req.user.userId },
          updateData,
          { new: true }
        );

        if (!updatedTask) {
          throw new Error('Task not found or you do not have permission to update it');
        }

        responseData.taskUpdated = updatedTask;
        if (!responseData.response) {
          const updatedFields = Object.keys(updateData).filter(k => k !== 'updatedAt');
          responseData.response = `Updated task "${updatedTask.title}": ${updatedFields.join(', ')}`;
        }
        break;

      case 'complete':
        let taskToCompleteId = parsed.taskId;
        
        if (!taskToCompleteId && parsed.task?.title) {
          // Try to find task by title if taskId not provided
          const taskToComplete = await Task.findOne({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: req.user.userId 
          });
          if (!taskToComplete) {
            throw new Error(`Task "${parsed.task.title}" not found`);
          }
          taskToCompleteId = taskToComplete._id;
        }

        if (!taskToCompleteId) {
          throw new Error('Task ID or title is required to complete');
        }

        const completedTask = await Task.findOneAndUpdate(
          { _id: taskToCompleteId, userId: req.user.userId },
          { completed: true, updatedAt: new Date() },
          { new: true }
        );

        if (!completedTask) {
          throw new Error('Task not found or you do not have permission to complete it');
        }

        responseData.taskCompleted = completedTask;
        if (!responseData.response) {
          responseData.response = `Marked "${completedTask.title}" as complete`;
        }
        break;

      case 'delete':
        let taskToDeleteId = parsed.taskId;
        
        if (!taskToDeleteId && parsed.task?.title) {
          // Try to find task by title if taskId not provided
          const taskToDelete = await Task.findOne({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: req.user.userId 
          });
          if (!taskToDelete) {
            throw new Error(`Task "${parsed.task.title}" not found`);
          }
          taskToDeleteId = taskToDelete._id;
        }

        if (!taskToDeleteId) {
          throw new Error('Task ID or title is required to delete');
        }

        const deletedTask = await Task.findOneAndDelete({ 
          _id: taskToDeleteId, 
          userId: req.user.userId 
        });

        if (!deletedTask) {
          throw new Error('Task not found or you do not have permission to delete it');
        }

        responseData.taskDeleted = deletedTask;
        if (!responseData.response) {
          responseData.response = `Deleted task: ${deletedTask.title}`;
        }
        break;

      case 'sendEmail':
        // Get recipient email - use configured email or default to cyber.ghoul019@gmail.com
        const recipientEmail = process.env.RECIPIENT_EMAIL?.trim() || 'cyber.ghoul019@gmail.com';
        
        // Get user's email from database (for logging purposes)
        const user = await User.findById(req.user.userId);
        const userEmail = user?.email || 'Unknown';

        // Validate and get email transporter
        let emailConfig;
        try {
          emailConfig = getEmailTransporter();
        } catch (configError) {
          throw new Error(`Email configuration error: ${configError.message}. Please check your .env file has EMAIL_USER and EMAIL_PASS set correctly.`);
        }

        // Prepare email content
        const emailSubject = parsed.email?.subject || 'Message from ARIA';
        const emailBody = parsed.email?.body || 'This is a message sent via voice command from ARIA assistant.';

        // Send email
        try {
          await emailConfig.transporter.sendMail({
            from: emailConfig.fromEmail,
            to: recipientEmail,
            subject: emailSubject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6366f1;">${emailSubject}</h2>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${emailBody.replace(/\n/g, '<br>')}</p>
                </div>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
                  This email was sent via ARIA voice assistant.
                </p>
              </div>
            `,
            text: emailBody
          });

          console.log(`✉️ Email sent to: ${recipientEmail} (requested by user: ${userEmail})`);

          responseData.emailSent = true;
          if (!responseData.response) {
            responseData.response = `Email sent successfully to ${recipientEmail}`;
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
          
          // Provide more helpful error messages
          if (emailError.code === 'EAUTH') {
            const isOutlook = emailUser && (emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com'));
            
            if (isOutlook && emailError.response?.includes('basic authentication is disabled')) {
              throw new Error('Outlook has disabled basic authentication. Recommended: Use Brevo (FREE 300 emails/day). Sign up at https://www.brevo.com, get SMTP credentials from Settings > SMTP & API, then set EMAIL_PROVIDER=brevo in .env. Or use Gmail: https://myaccount.google.com/apppasswords');
            } else {
              const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'auto';
              if (provider === 'brevo' || provider === 'sendinblue') {
                throw new Error('Brevo authentication failed. Get SMTP credentials from https://app.brevo.com/settings/keys/api. Make sure EMAIL_USER is your Brevo SMTP username and EMAIL_PASS is your SMTP password.');
              } else {
                throw new Error('Email authentication failed. Please check your EMAIL_USER and EMAIL_PASS in .env file. For free service, try Brevo: https://www.brevo.com (300 emails/day free). For Gmail: https://myaccount.google.com/apppasswords');
              }
            }
          } else if (emailError.code === 'ECONNECTION') {
            throw new Error('Could not connect to email server. Please check your internet connection and email server settings.');
          } else {
            throw new Error(`Failed to send email: ${emailError.message}`);
          }
        }
        break;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Voice processing error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: error.message, 
      response: "Sorry, I couldn't process that command.",
      details: error.toString()
    });
  }
});

export default router;

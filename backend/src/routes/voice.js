import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import Task from '../models/Task.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.post('/process', async (req, res) => {
  try {
    const { command } = req.body;
    
    console.log('Processing command:', command);
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not set or is empty');
    }
    
    console.log('API Key exists:', !!apiKey);
    
    const ai = new GoogleGenAI({
      apiKey: apiKey.trim(),
      vertexai: false
    });

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

Current date and time: ${new Date().toISOString()}

Available tasks:
${JSON.stringify(tasksList, null, 2)}

Return format:
{
  "action": "create|list|update|delete|complete|sendEmail",
  "task": {
    "title": "task title",
    "description": "details or null",
    "dueDate": "ISO date string or null",
    "reminderTime": "ISO date string or null"
  },
  "taskId": "task id from available tasks if updating/deleting/completing",
  "updateFields": {
    "title": "new title or null",
    "description": "new description or null",
    "dueDate": "new ISO date string or null",
    "reminderTime": "new ISO date string or null"
  },
  "response": "natural language response to user"
}

IMPORTANT RULES:
- For "update": Only include fields in "updateFields" that the user explicitly mentioned
- For "update/delete/complete": Match the task by title from available tasks and set "taskId"
- For "sendEmail": Use when user asks to send/email task list (e.g., "send my tasks to email", "email me my tasks")
- Parse dates naturally: "today 6pm" = today at 18:00, "tomorrow 5pm" = tomorrow at 17:00
- Always return full ISO date format for dates

Examples:
- "remind me to buy groceries tomorrow at 5pm" → action: create
- "what are my tasks today" → action: list
- "mark buy groceries as complete" → action: complete, taskId: (match from tasks)
- "delete the grocery task" → action: delete, taskId: (match from tasks)
- "send my tasks to my email" → action: sendEmail
- "email me all my tasks" → action: sendEmail`;

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
        const resendApiKey = process.env.RESEND_API_KEY;
        
        if (!resendApiKey || resendApiKey.trim() === '') {
          throw new Error('Email service not configured. Please add RESEND_API_KEY to .env file.');
        }

        const resend = new Resend(resendApiKey);
        const userTasks = await Task.find({ userId: req.user.userId });
        const pendingTasks = userTasks.filter(t => !t.completed);
        const completedTasks = userTasks.filter(t => t.completed);

        const emailHtml = `
          <div style="font-family: 'Roboto Mono', monospace; max-width: 600px; margin: 0 auto; background: #000000; color: #e5e5e5; padding: 40px 20px;">
            <div style="border: 1px solid #27272a; padding: 32px; background: #18181b;">
              <h1 style="color: #22d3ee; margin: 0 0 8px 0; font-size: 32px; font-weight: 700;">[ARIA]</h1>
              <p style="color: #71717a; margin: 0 0 32px 0; font-size: 12px; letter-spacing: 2px;">&gt; TASK_REPORT</p>
              
              <div style="margin-bottom: 24px;">
                <div style="display: inline-block; background: #22d3ee; color: #000; padding: 8px 16px; margin-right: 8px;">
                  <span style="font-weight: 700; font-size: 24px;">${pendingTasks.length}</span>
                  <span style="font-size: 12px; margin-left: 4px;">PENDING</span>
                </div>
                <div style="display: inline-block; background: #10b981; color: #000; padding: 8px 16px;">
                  <span style="font-weight: 700; font-size: 24px;">${completedTasks.length}</span>
                  <span style="font-size: 12px; margin-left: 4px;">COMPLETED</span>
                </div>
              </div>
              
              ${pendingTasks.length > 0 ? `
                <div style="border: 1px solid #27272a; padding: 16px; margin-bottom: 16px; background: #09090b;">
                  <p style="color: #71717a; margin: 0 0 12px 0; font-size: 10px; letter-spacing: 1px;">&gt; PENDING_TASKS</p>
                  ${pendingTasks.map(task => `
                    <div style="border-left: 2px solid #22d3ee; padding: 12px; margin-bottom: 8px; background: #18181b;">
                      <p style="margin: 0; color: #e5e5e5; font-size: 14px; font-weight: 600;">${task.title}</p>
                      ${task.description ? `<p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">${task.description}</p>` : ''}
                      ${task.reminderTime ? `<p style="margin: 4px 0 0 0; color: #22d3ee; font-size: 11px;">⏰ ${new Date(task.reminderTime).toLocaleString()}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="border: 1px dashed #27272a; padding: 20px; text-align: center; margin-bottom: 16px;">
                  <p style="margin: 0; color: #71717a; font-size: 12px;">NO_PENDING_TASKS</p>
                </div>
              `}
              
              ${completedTasks.length > 0 ? `
                <div style="border: 1px solid #27272a; padding: 16px; background: #09090b;">
                  <p style="color: #71717a; margin: 0 0 12px 0; font-size: 10px; letter-spacing: 1px;">&gt; COMPLETED_TASKS</p>
                  ${completedTasks.map(task => `
                    <div style="border-left: 2px solid #10b981; padding: 12px; margin-bottom: 8px; background: #18181b; opacity: 0.6;">
                      <p style="margin: 0; color: #e5e5e5; font-size: 14px; text-decoration: line-through;">${task.title}</p>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              <p style="color: #71717a; font-size: 10px; margin: 24px 0 0 0; text-align: center; letter-spacing: 1px;">
                &gt; POWERED_BY: ARIA_ASSISTANT
              </p>
            </div>
          </div>
        `;

        try {
          await resend.emails.send({
            from: 'ARIA Assistant <onboarding@resend.dev>',
            to: 'cyber.ghoul019@gmail.com',
            subject: `[ARIA] Task Report - ${pendingTasks.length} Pending, ${completedTasks.length} Completed`,
            html: emailHtml
          });

          console.log('✉️ Task list email sent to: cyber.ghoul019@gmail.com');
          responseData.emailSent = true;
          if (!responseData.response) {
            responseData.response = `Task list sent to your email. You have ${pendingTasks.length} pending and ${completedTasks.length} completed tasks.`;
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
          throw new Error('Failed to send email. Please check RESEND_API_KEY configuration.');
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

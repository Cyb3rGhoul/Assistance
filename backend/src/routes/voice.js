import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import Task from '../models/Task.js';
import Link from '../models/Link.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Helper function to parse time in IST
function parseTimeToIST(timeString) {
  if (!timeString) return null;
  
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  
  // Convert current time to IST for reference
  const nowIST = new Date(now.getTime() + istOffset);
  
  // Parse the time string and create IST date
  const parsedDate = new Date(timeString);
  
  // If parsing failed, try manual parsing for common formats
  if (isNaN(parsedDate.getTime())) {
    // Handle formats like "today 6pm", "tomorrow 5:30pm", etc.
    const lowerTime = timeString.toLowerCase();
    
    let targetDate = new Date(nowIST);
    
    if (lowerTime.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (lowerTime.includes('today')) {
      // Keep current date
    } else if (lowerTime.includes('next week')) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    // Extract time
    const timeMatch = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3];
      
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      targetDate.setHours(hours, minutes, 0, 0);
      
      // Convert back to UTC for storage
      return new Date(targetDate.getTime() - istOffset);
    }
  }
  
  // If we have a valid parsed date, convert from IST to UTC
  return new Date(parsedDate.getTime() - istOffset);
}

router.post('/process', async (req, res) => {
  try {
    const { command } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not set or is empty');
    }
    
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

    // Get current IST time for reference
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);

    const prompt = `You are ARIA, a voice assistant. Parse this command and return ONLY a JSON object (no markdown, no extra text):
Command: "${command}"

Current IST date and time: ${nowIST.toISOString()} (India Standard Time)

Available tasks:
${JSON.stringify(tasksList, null, 2)}

Return format:
{
  "action": "create|list|update|delete|complete|sendEmail|saveLink|searchLinks",
  "task": {
    "title": "task title",
    "description": "details or null",
    "dueDate": "ISO date string or null",
    "reminderTime": "ISO date string or null"
  },
  "link": {
    "url": "full URL if saving a link"
  },
  "searchQuery": "search term for links",
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
- For "sendEmail": Use when user asks to send/email task list
- For "saveLink": Use when user provides a URL to save/bookmark
- For "searchLinks": Use when user asks to search/find links by keywords
- Parse dates naturally in IST: "today 6pm" = today at 18:00 IST, "tomorrow 5pm" = tomorrow at 17:00 IST
- Always return full ISO date format for dates (will be converted to IST automatically)
- Convert 12-hour to 24-hour format: 6pm = 18:00, 6am = 06:00

Examples:
- "remind me to buy groceries tomorrow at 5pm" → action: create
- "save this link https://example.com" → action: saveLink
- "bookmark https://github.com/user/repo" → action: saveLink
- "what are my tasks today" → action: list
- "mark buy groceries as complete" → action: complete, taskId: (match from tasks)
- "send my tasks to email" → action: sendEmail
- "search for react links" → action: searchLinks, searchQuery: "react"
- "find links about javascript" → action: searchLinks, searchQuery: "javascript"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    
    const text = response.text.trim();
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    let responseData = { ...parsed };

    switch (parsed.action) {
      case 'create':
        // Parse times to IST
        const taskData = { ...parsed.task, userId: req.user.userId };
        if (taskData.dueDate) {
          taskData.dueDate = parseTimeToIST(taskData.dueDate);
        }
        if (taskData.reminderTime) {
          taskData.reminderTime = parseTimeToIST(taskData.reminderTime);
        }
        
        const newTask = new Task(taskData);
        await newTask.save();
        responseData.taskCreated = newTask;
        break;

      case 'saveLink':
        if (!parsed.link?.url) {
          throw new Error('URL is required to save a link');
        }
        
        // Fetch page metadata
        let title = parsed.link.url;
        let description = '';
        let favicon = '';
        
        try {
          const linkResponse = await fetch(parsed.link.url);
          const html = await linkResponse.text();
          
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) title = titleMatch[1].trim();
          
          const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
          if (descMatch) description = descMatch[1].trim();
          
          const faviconMatch = html.match(/<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\'][^>]*>/i);
          if (faviconMatch) {
            favicon = faviconMatch[1];
            if (favicon.startsWith('/')) {
              const urlObj = new URL(parsed.link.url);
              favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
            }
          }
        } catch (fetchError) {
          console.log('Could not fetch page metadata:', fetchError.message);
        }
        
        // AI categorization
        let autoTags = [];
        let category = 'General';
        
        try {
          const categoryPrompt = `Analyze this link and return ONLY a JSON object:
URL: ${parsed.link.url}
Title: ${title}
Description: ${description}

Return format:
{
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2"] (max 2 relevant tags, lowercase, most important only)
}`;

          const categoryResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: categoryPrompt,
          });
          
          const responseText = categoryResponse.text.trim();
          // Remove markdown code blocks if present
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
          const aiResult = JSON.parse(cleanedResponse);
          category = aiResult.category || 'General';
          autoTags = aiResult.tags || [];
        } catch (aiError) {
          // AI categorization failed, use defaults
        }
        
        const newLink = new Link({
          userId: req.user.userId,
          url: parsed.link.url,
          title,
          description,
          favicon,
          autoTags,
          userTags: [],
          category
        });
        
        await newLink.save();
        responseData.linkSaved = newLink;
        if (!responseData.response) {
          responseData.response = `Saved link: ${title} (Category: ${category})`;
        }
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
            updateData.dueDate = parsed.updateFields.dueDate ? parseTimeToIST(parsed.updateFields.dueDate) : null;
          }
          if (parsed.updateFields.reminderTime !== null && parsed.updateFields.reminderTime !== undefined) {
            updateData.reminderTime = parsed.updateFields.reminderTime ? parseTimeToIST(parsed.updateFields.reminderTime) : null;
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

      case 'searchLinks':
        const searchQuery = parsed.searchQuery || '';
        if (!searchQuery) {
          throw new Error('Search query is required');
        }

        const searchResults = await Link.find({
          userId: req.user.userId,
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { autoTags: { $in: [new RegExp(searchQuery, 'i')] } },
            { userTags: { $in: [new RegExp(searchQuery, 'i')] } },
            { category: { $regex: searchQuery, $options: 'i' } }
          ]
        }).sort({ createdAt: -1 });

        responseData.links = searchResults;
        if (searchResults.length === 0) {
          responseData.response = `No links found for "${searchQuery}".`;
        } else {
          // Return the actual links with clickable URLs
          let linksList = `Found ${searchResults.length} link${searchResults.length > 1 ? 's' : ''} for "${searchQuery}":\n\n`;
          
          searchResults.forEach((link, index) => {
            linksList += `${index + 1}. ${link.title}\n`;
            linksList += `   🔗 ${link.url}\n`;
            if (link.description) {
              linksList += `   📝 ${link.description.substring(0, 100)}${link.description.length > 100 ? '...' : ''}\n`;
            }
            linksList += `   📂 ${link.category} | 🏷️ ${[...link.autoTags, ...link.userTags].join(', ')}\n\n`;
          });
          
          responseData.response = linksList;
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
                      ${task.reminderTime ? `<p style="margin: 4px 0 0 0; color: #22d3ee; font-size: 11px;">⏰ ${new Date(task.reminderTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>` : ''}
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
    res.status(500).json({ 
      error: error.message, 
      response: "Sorry, I couldn't process that command."
    });
  }
});

export default router;
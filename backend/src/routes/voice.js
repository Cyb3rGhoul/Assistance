import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import Task from '../models/Task.js';
import Link from '../models/Link.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Simple in-memory session store for pending confirmations
const pendingConfirmations = new Map();

// Clean up old confirmations (older than 5 minutes)
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [userId, session] of pendingConfirmations.entries()) {
    if (session.timestamp < fiveMinutesAgo) {
      pendingConfirmations.delete(userId);
    }
  }
}, 60000); // Clean up every minute

// Helper function to get user's API key with failover
async function getUserApiKey(userId, attemptFailover = false) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // ALL users must have their own API keys now
  let apiKey = user.getCurrentApiKey();
  
  if (!apiKey && attemptFailover) {
    // Try to switch to backup key
    apiKey = await user.switchToBackupApiKey();
  }
  
  if (!apiKey) {
    throw new Error('No valid Gemini API key found. Please add your API key in profile settings.');
  }
  
  return { apiKey: apiKey.trim(), user };
}

// Helper function to make Gemini API call with failover
async function callGeminiWithFailover(userId, prompt, isRetry = false) {
  try {
    const { apiKey, user } = await getUserApiKey(userId, isRetry);
    
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    // If this is the first attempt and we get an API error, try failover
    if (!isRetry && (error.message.includes('API_KEY') || error.message.includes('quota') || error.message.includes('limit'))) {
      console.log('Primary API key failed, attempting failover...');
      return callGeminiWithFailover(userId, prompt, true);
    }
    throw error;
  }
}

// Helper function to parse time in IST
function parseTimeToIST(timeString) {
  if (!timeString) return null;
  
  try {
    // Parse the ISO string from AI
    const parsedDate = new Date(timeString);
    
    if (isNaN(parsedDate.getTime())) {
      // If direct parsing failed, try manual parsing
      return parseManualTime(timeString);
    }
    
    // The AI gives us a time like "2026-01-21T10:00:00.000Z" when user says "10:00 AM tomorrow"
    // We need to treat this as IST time and convert to UTC for storage
    
    // Extract components from AI's time (treating it as IST)
    const year = parsedDate.getUTCFullYear();
    const month = parsedDate.getUTCMonth();
    const day = parsedDate.getUTCDate();
    const hours = parsedDate.getUTCHours();
    const minutes = parsedDate.getUTCMinutes();
    
    // Create UTC time that represents the IST time
    // IST is UTC+5:30, so to store IST time as UTC, we subtract 5:30
    const utcTime = Date.UTC(year, month, day, hours, minutes, 0, 0);
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    
    return new Date(utcTime - istOffsetMs);
    
  } catch (error) {
    console.error('Time parsing error:', error);
    return parseManualTime(timeString);
  }
}

// Fallback manual time parsing
function parseManualTime(timeString) {
  const lowerTime = timeString.toLowerCase();
  
  // Get current date in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffset);
  
  let targetYear = nowIST.getUTCFullYear();
  let targetMonth = nowIST.getUTCMonth();
  let targetDay = nowIST.getUTCDate();
  
  // Adjust date based on keywords
  if (lowerTime.includes('tomorrow')) {
    targetDay += 1;
  } else if (lowerTime.includes('next week')) {
    targetDay += 7;
  }
  // 'today' or no date keyword uses current date
  
  // Extract time
  const timeMatch = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let targetHours = 0;
  let targetMinutes = 0;
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const ampm = timeMatch[3];
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    targetHours = hours;
    targetMinutes = minutes;
  }
  
  // Create UTC time that represents the IST time
  const utcTime = Date.UTC(targetYear, targetMonth, targetDay, targetHours, targetMinutes, 0, 0);
  
  return new Date(utcTime - istOffset);
}

router.post('/process', async (req, res) => {
  try {
    const { command } = req.body;
    
    // Get user to check if they have API access
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has API keys (required for all users now)
    if (!user.hasValidApiKeys()) {
      return res.status(400).json({ 
        error: 'Please add your Gemini API key in profile settings to use voice commands.',
        needsApiKey: true
      });
    }

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

    // Check for pending confirmations
    const pendingConfirmation = pendingConfirmations.get(req.user.userId);
    let contextInfo = '';
    if (pendingConfirmation) {
      if (pendingConfirmation.action === 'delete') {
        contextInfo = `\nPENDING CONFIRMATION: User has a pending delete confirmation for task "${pendingConfirmation.taskTitle}". If user says "yes", "confirm", "delete it", use action "confirmDelete".`;
      } else if (pendingConfirmation.action === 'deleteAll') {
        contextInfo = `\nPENDING CONFIRMATION: User has a pending delete all confirmation for ${pendingConfirmation.taskCount} tasks. If user says "yes", "confirm", "delete all", use action "confirmDeleteAll".`;
      } else if (pendingConfirmation.action === 'deleteLink') {
        contextInfo = `\nPENDING CONFIRMATION: User has a pending delete confirmation for link "${pendingConfirmation.linkTitle}". If user says "yes", "confirm", "delete it", use action "confirmDeleteLink".`;
      }
    }

    const prompt = `You are ARIA, a voice assistant. Parse this command and return ONLY a JSON object (no markdown, no extra text):
Command: "${command}"

Current IST date and time: ${nowIST.toISOString()} (India Standard Time)${contextInfo}

Available tasks:
${JSON.stringify(tasksList, null, 2)}

MULTI-COMMAND SUPPORT:
If the user gives multiple commands in one sentence, process ALL of them and return an array of actions.
Examples:
- "mark task1 as done and delete task2" → return array with complete and delete actions
- "add new task and mark old task as complete" → return array with create and complete actions
- "delete task1, mark task2 as done, and add remind me to call mom" → return array with delete, complete, and create actions

Return format for SINGLE command:
{
  "action": "create|list|listAll|update|delete|deleteAll|complete|sendEmail|saveLink|searchLinks|deleteLink|confirmDelete|confirmDeleteAll|confirmDeleteLink",
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
  "confirmAction": "delete|deleteAll - the action being confirmed",
  "confirmTarget": "task or link details being confirmed for deletion",
  "multipleMatches": ["array of matching items when multiple found"],
  "updateFields": {
    "title": "new title or null",
    "description": "new description or null",
    "dueDate": "new ISO date string or null",
    "reminderTime": "new ISO date string or null"
  },
  "response": "natural language response to user"
}

Return format for MULTIPLE commands:
{
  "multipleCommands": true,
  "commands": [
    {
      "action": "...",
      "task": {...},
      "taskId": "...",
      // ... other fields as needed for each command
    },
    {
      "action": "...",
      "task": {...},
      // ... second command
    }
  ],
  "response": "natural language response covering all actions performed"
}

IMPORTANT RULES:
- For "update": Only include fields in "updateFields" that the user explicitly mentioned
- For "update/delete/complete": Match the task by title from available tasks and set "taskId"
- For "delete": If multiple tasks match, use action "delete" with "multipleMatches" array and ask user to specify
- For "delete": If single match found, use action "delete" and ask for confirmation before deleting
- For "confirmDelete": Use when user confirms deletion with "yes", "correct", "delete it", "confirm", etc. AND there's a previous delete request context
- For "confirmDeleteAll": Use when user confirms delete all with "yes", "correct", etc. AND there's a previous deleteAll request context
- For "deleteAll": Ask for confirmation before deleting all tasks
- If user says "yes", "correct", "delete it", "confirm" but no clear context, ask them to be more specific
- For "sendEmail": Use when user asks to send/email task list
- For "saveLink": Use when user provides a URL to save/bookmark
- For "deleteLink": Use when user wants to delete a saved link, ask for confirmation first
- For "searchLinks": Use when user asks to search/find links by keywords - ALL link searches are silent (no voice response)
- For "list": Use when user asks for pending/incomplete tasks only
- For "listAll": Use when user asks "what's on my plate", "tell me all my tasks", "show me everything", "all tasks", "what do I have"
- Parse dates naturally in IST: "today 6pm" = today at 18:00 IST, "tomorrow 5pm" = tomorrow at 17:00 IST
- When providing ISO dates, calculate the correct UTC time that represents the IST time
- For example: "2:35 PM IST today" should be converted to UTC and provided as ISO string
- Convert 12-hour to 24-hour format: 6pm = 18:00, 6am = 06:00, 10:00 a.m. = 10:00, 10:00 p.m. = 22:00
- For time-only updates (like "edit time to 10:00 a.m."), set both dueDate and reminderTime to today at that time
- When user says "edit time" or "change time", they usually mean the reminder time
- For multiple commands, process them in the order mentioned by the user
- If any command in a multi-command sequence requires confirmation, handle it appropriately

Examples:
- "remind me to buy groceries tomorrow at 5pm" → single action: create
- "mark buy groceries as done and add call mom at 3pm" → multiple commands: complete + create
- "delete meeting task and mark presentation as complete" → multiple commands: delete + complete
- "add new task, mark old task done, and delete another task" → multiple commands: create + complete + delete
- "save this link https://example.com and mark task as done" → multiple commands: saveLink + complete
- "what are my tasks today" → single action: list
- "tell me all my tasks" → single action: listAll
- "mark buy groceries as complete" → single action: complete
- "delete meeting task" → single action: delete (ask for confirmation first)
- "yes delete it" → single action: confirmDelete
- "delete all tasks" → single action: deleteAll (ask for confirmation first)
- "send my tasks to email" → single action: sendEmail
- "search for react links" → single action: searchLinks`;

    // Use the new API key system with failover
    const aiResponse = await callGeminiWithFailover(req.user.userId, prompt);
    
    const text = aiResponse.trim();
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    let responseData = { ...parsed };

    // Handle multiple commands
    if (parsed.multipleCommands && parsed.commands) {
      const results = [];
      let overallResponse = [];

      for (const command of parsed.commands) {
        try {
          const result = await processCommand(command, req.user.userId, true); // Pass true for multi-command
          results.push(result);
          if (result.response) {
            overallResponse.push(result.response);
          }
        } catch (error) {
          results.push({ error: error.message, command: command.action });
          overallResponse.push(`Error with ${command.action}: ${error.message}`);
        }
      }

      responseData = {
        multipleCommands: true,
        results: results,
        response: parsed.response || overallResponse.join(' ')
      };
    } else {
      // Handle single command (existing logic)
      const result = await processCommand(parsed, req.user.userId);
      responseData = { ...responseData, ...result };
    }

    res.json(responseData);
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({ 
      error: error.message,
      response: "Sorry, I couldn't process that command. Please try again."
    });
  }
});

// Extract command processing logic into a separate function
async function processCommand(parsed, userId, isMultiCommand = false) {
  let responseData = {};

  switch (parsed.action) {
    case 'create':
      // Parse times to IST
      const taskData = { ...parsed.task, userId: userId };
      
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
          // Silently handle metadata fetch errors
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

          const categoryResponse = await callGeminiWithFailover(userId, categoryPrompt);
          
          const responseText = categoryResponse.trim();
          // Remove markdown code blocks if present
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
          const aiResult = JSON.parse(cleanedResponse);
          category = aiResult.category || 'General';
          autoTags = aiResult.tags || [];
        } catch (aiError) {
          // AI categorization failed, use defaults
        }
        
        const newLink = new Link({
          userId: userId,
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
        const tasks = await Task.find({ userId: userId, completed: false });
        responseData.tasks = tasks;
        if (tasks.length === 0) {
          responseData.response = "You have no pending tasks.";
        } else {
          responseData.response = `You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.title).join(', ')}`;
        }
        break;

      case 'listAll':
        const allUserTasks = await Task.find({ userId: userId }).sort({ createdAt: -1 });
        const pendingTasks = allUserTasks.filter(t => !t.completed);
        const completedTasks = allUserTasks.filter(t => t.completed);
        
        responseData.allTasks = allUserTasks;
        responseData.pendingTasks = pendingTasks;
        responseData.completedTasks = completedTasks;
        
        if (allUserTasks.length === 0) {
          responseData.response = "You have no tasks at all. Your plate is completely clean!";
        } else {
          let response = `Here's everything on your plate:\n\n`;
          
          if (pendingTasks.length > 0) {
            response += `PENDING TASKS (${pendingTasks.length}):\n`;
            pendingTasks.forEach((task, index) => {
              response += `${index + 1}. ${task.title}`;
              if (task.description) response += ` - ${task.description}`;
              if (task.reminderTime) {
                response += ` - Reminder: ${task.reminderTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })} IST`;
              }
              response += `\n`;
            });
            response += `\n`;
          }
          
          if (completedTasks.length > 0) {
            response += `COMPLETED TASKS (${completedTasks.length}):\n`;
            completedTasks.forEach((task, index) => {
              response += `${index + 1}. ${task.title}`;
              if (task.description) response += ` - ${task.description}`;
              response += `\n`;
            });
          }
          
          if (pendingTasks.length === 0) {
            response += `Great job! All your tasks are completed. You have ${completedTasks.length} completed task${completedTasks.length > 1 ? 's' : ''}.`;
          }
          
          responseData.response = response;
        }
        break;

      case 'update':
        let taskToUpdateId = parsed.taskId;
        
        if (!taskToUpdateId && parsed.task?.title) {
          const taskToUpdate = await Task.findOne({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: userId 
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
            // Reset reminderSent when reminderTime is updated
            updateData.reminderSent = false;
          }
        }

        const updatedTask = await Task.findOneAndUpdate(
          { _id: taskToUpdateId, userId: userId },
          updateData,
          { new: true }
        );

        if (!updatedTask) {
          throw new Error('Task not found or you do not have permission to update it');
        }

        responseData.taskUpdated = updatedTask;
        if (!responseData.response) {
          const updatedFields = Object.keys(updateData).filter(k => k !== 'updatedAt');
          let responseText = `Updated task "${updatedTask.title}": `;
          
          // Show specific field updates with values
          const fieldDescriptions = [];
          if (updateData.title) fieldDescriptions.push(`title to "${updateData.title}"`);
          if (updateData.description !== undefined) fieldDescriptions.push(`description to "${updateData.description || 'none'}"`);
          if (updateData.dueDate !== undefined) {
            const dueDateIST = updateData.dueDate ? new Date(updateData.dueDate.getTime() + 5.5 * 60 * 60 * 1000) : null;
            fieldDescriptions.push(`due date to ${dueDateIST ? dueDateIST.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }) + ' IST' : 'none'}`);
          }
          if (updateData.reminderTime !== undefined) {
            fieldDescriptions.push(`reminder time to ${updateData.reminderTime ? updateData.reminderTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }) + ' IST' : 'none'}`);
          }
          
          responseText += fieldDescriptions.join(', ');
          responseData.response = responseText;
        }
        break;

      case 'complete':
        let taskToCompleteId = parsed.taskId;
        
        if (!taskToCompleteId && parsed.task?.title) {
          const taskToComplete = await Task.findOne({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: userId 
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
          { _id: taskToCompleteId, userId: userId },
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
        let taskToDelete = null;
        
        if (!taskToDeleteId && parsed.task?.title) {
          // Search for matching tasks
          const matchingTasks = await Task.find({ 
            title: { $regex: new RegExp(parsed.task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            userId: userId 
          });
          
          if (matchingTasks.length === 0) {
            throw new Error(`Task "${parsed.task.title}" not found`);
          } else if (matchingTasks.length > 1) {
            // Multiple matches - ask user to specify
            responseData.multipleMatches = matchingTasks.map(t => ({
              id: t._id,
              title: t.title,
              description: t.description
            }));
            responseData.response = `Found ${matchingTasks.length} tasks matching "${parsed.task.title}":\n\n` +
              matchingTasks.map((t, i) => `${i + 1}. ${t.title}${t.description ? ` - ${t.description}` : ''}`).join('\n') +
              '\n\nPlease specify which one you want to delete by saying the number or the full title.';
            break;
          } else {
            // Single match - ask for confirmation
            taskToDelete = matchingTasks[0];
            taskToDeleteId = taskToDelete._id;
          }
        } else if (taskToDeleteId) {
          taskToDelete = await Task.findOne({ _id: taskToDeleteId, userId: userId });
        }

        if (!taskToDelete) {
          throw new Error('Task not found or you do not have permission to delete it');
        }

        // In multi-command scenarios, delete immediately without confirmation
        // In single command scenarios, ask for confirmation
        if (isMultiCommand) {
          // Delete immediately in multi-command
          const deletedTask = await Task.findOneAndDelete({ 
            _id: taskToDelete._id, 
            userId: userId 
          });

          if (deletedTask) {
            responseData.taskDeleted = deletedTask;
            responseData.response = `Deleted task: "${deletedTask.title}"`;
          } else {
            responseData.response = "Task not found or already deleted.";
          }
        } else {
          // Ask for confirmation in single command
          pendingConfirmations.set(userId, {
            action: 'delete',
            taskId: taskToDelete._id,
            taskTitle: taskToDelete.title,
            timestamp: Date.now()
          });
          
          responseData.confirmAction = 'delete';
          responseData.confirmTarget = {
            id: taskToDelete._id,
            title: taskToDelete.title,
            description: taskToDelete.description
          };
          responseData.response = `Are you sure you want to delete the task "${taskToDelete.title}"? Say "yes" or "delete it" to confirm.`;
        }
        break;

      case 'deleteAll':
        // Ask for confirmation before deleting all tasks
        const taskCount = await Task.countDocuments({ userId: userId });
        
        if (taskCount === 0) {
          responseData.response = "No tasks found to delete.";
          break;
        }
        
        pendingConfirmations.set(userId, {
          action: 'deleteAll',
          taskCount: taskCount,
          timestamp: Date.now()
        });
        
        responseData.confirmAction = 'deleteAll';
        responseData.confirmTarget = { count: taskCount };
        responseData.response = `Are you sure you want to delete all ${taskCount} task${taskCount > 1 ? 's' : ''}? This cannot be undone. Say "yes" or "delete all" to confirm.`;
        break;

      case 'deleteLink':
        // Find matching links for deletion
        if (!parsed.searchQuery && !parsed.link?.url) {
          responseData.response = "Please specify which link you want to delete by providing keywords or the URL.";
          break;
        }
        
        let linkQuery = {};
        if (parsed.link?.url) {
          linkQuery.url = parsed.link.url;
        } else if (parsed.searchQuery) {
          linkQuery = {
            $or: [
              { title: { $regex: parsed.searchQuery, $options: 'i' } },
              { description: { $regex: parsed.searchQuery, $options: 'i' } },
              { autoTags: { $in: [new RegExp(parsed.searchQuery, 'i')] } },
              { userTags: { $in: [new RegExp(parsed.searchQuery, 'i')] } },
              { category: { $regex: parsed.searchQuery, $options: 'i' } }
            ]
          };
        }
        
        const matchingLinks = await Link.find({ ...linkQuery, userId: userId });
        
        if (matchingLinks.length === 0) {
          responseData.response = `No links found matching "${parsed.searchQuery || parsed.link.url}".`;
          break;
        } else if (matchingLinks.length > 1) {
          // Multiple matches - ask user to specify
          responseData.multipleMatches = matchingLinks.map(l => ({
            id: l._id,
            title: l.title,
            url: l.url,
            category: l.category
          }));
          responseData.response = `Found ${matchingLinks.length} links matching "${parsed.searchQuery}":\n\n` +
            matchingLinks.map((l, i) => `${i + 1}. ${l.title}\n   Link: ${l.url}\n   Category: ${l.category}`).join('\n\n') +
            '\n\nPlease specify which one you want to delete by saying the number or being more specific.';
          break;
        } else {
          // Single match - ask for confirmation
          const linkToDelete = matchingLinks[0];
          
          pendingConfirmations.set(userId, {
            action: 'deleteLink',
            linkId: linkToDelete._id,
            linkTitle: linkToDelete.title,
            linkUrl: linkToDelete.url,
            timestamp: Date.now()
          });
          
          responseData.response = `Are you sure you want to delete the link "${linkToDelete.title}" (${linkToDelete.url})? Say "yes" or "delete it" to confirm.`;
        }
        break;

      case 'searchLinks':
        const searchQuery = parsed.searchQuery || '';
        if (!searchQuery) {
          throw new Error('Search query is required');
        }

        // Enhanced search with partial matching
        const searchResults = await Link.find({
          userId: userId,
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { autoTags: { $in: [new RegExp(searchQuery, 'i')] } },
            { userTags: { $in: [new RegExp(searchQuery, 'i')] } },
            { category: { $regex: searchQuery, $options: 'i' } },
            { url: { $regex: searchQuery, $options: 'i' } },
            // Partial word matching in tags
            { autoTags: { $elemMatch: { $regex: `.*${searchQuery}.*`, $options: 'i' } } },
            { userTags: { $elemMatch: { $regex: `.*${searchQuery}.*`, $options: 'i' } } }
          ]
        }).sort({ createdAt: -1 });

        responseData.links = searchResults;
        
        // ALL link searches are now silent - no voice response
        if (searchResults.length === 0) {
          responseData.response = `No links found for "${searchQuery}".`;
        } else {
          // Return only the URLs, one per line, without any extra text
          responseData.response = searchResults.map(link => link.url).join('\n');
        }
        break;

      case 'confirmDelete':
        // User confirmed deletion - check if there's a pending confirmation
        const pendingDelete = pendingConfirmations.get(userId);
        
        if (!pendingDelete || pendingDelete.action !== 'delete') {
          responseData.response = "I don't have any pending delete confirmation. Please specify which task you want to delete.";
          break;
        }
        
        const deletedTask = await Task.findOneAndDelete({ 
          _id: pendingDelete.taskId, 
          userId: userId 
        });

        if (!deletedTask) {
          responseData.response = "Task not found or already deleted.";
        } else {
          responseData.taskDeleted = deletedTask;
          responseData.response = `Successfully deleted task: "${deletedTask.title}"`;
        }
        
        // Clear the pending confirmation
        pendingConfirmations.delete(userId);
        break;

      case 'confirmDeleteAll':
        // User confirmed delete all - check if there's a pending confirmation
        const pendingDeleteAll = pendingConfirmations.get(userId);
        
        if (!pendingDeleteAll || pendingDeleteAll.action !== 'deleteAll') {
          responseData.response = "I don't have any pending delete all confirmation. Please say 'delete all tasks' first.";
          break;
        }
        
        const deleteResult = await Task.deleteMany({ userId: userId });
        
        responseData.deletedCount = deleteResult.deletedCount;
        if (deleteResult.deletedCount === 0) {
          responseData.response = "No tasks found to delete.";
        } else {
          responseData.response = `Successfully deleted all ${deleteResult.deletedCount} task${deleteResult.deletedCount > 1 ? 's' : ''}. Your task list is now empty.`;
        }
        
        // Clear the pending confirmation
        pendingConfirmations.delete(userId);
        break;

      case 'confirmDeleteLink':
        // User confirmed link deletion
        const pendingDeleteLink = pendingConfirmations.get(userId);
        
        if (!pendingDeleteLink || pendingDeleteLink.action !== 'deleteLink') {
          responseData.response = "I don't have any pending link delete confirmation. Please specify which link you want to delete.";
          break;
        }
        
        const deletedLink = await Link.findOneAndDelete({ 
          _id: pendingDeleteLink.linkId, 
          userId: userId 
        });

        if (!deletedLink) {
          responseData.response = "Link not found or already deleted.";
        } else {
          responseData.linkDeleted = deletedLink;
          responseData.response = `Successfully deleted link: "${deletedLink.title}" (${deletedLink.url})`;
        }
        
        // Clear the pending confirmation
        pendingConfirmations.delete(userId);
        break;

      case 'sendEmail':
        // Get user to access their API key and email
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }
        
        const resendApiKey = user.resendApiKey;
        
        if (!resendApiKey || resendApiKey.trim() === '') {
          throw new Error('Email service not configured. Please add your Resend API key in profile settings.');
        }

        const resend = new Resend(resendApiKey);
        const userTasks = await Task.find({ userId: userId });
        const emailPendingTasks = userTasks.filter(t => !t.completed);
        const emailCompletedTasks = userTasks.filter(t => t.completed);

        const emailHtml = `
          <div style="font-family: 'Roboto Mono', monospace; max-width: 600px; margin: 0 auto; background: #000000; color: #e5e5e5; padding: 40px 20px;">
            <div style="border: 1px solid #27272a; padding: 32px; background: #18181b;">
              <h1 style="color: #22d3ee; margin: 0 0 8px 0; font-size: 32px; font-weight: 700;">[ARIA]</h1>
              <p style="color: #71717a; margin: 0 0 32px 0; font-size: 12px; letter-spacing: 2px;">&gt; TASK_REPORT</p>
              
              <div style="margin-bottom: 24px;">
                <div style="display: inline-block; background: #22d3ee; color: #000; padding: 8px 16px; margin-right: 8px;">
                  <span style="font-weight: 700; font-size: 24px;">${emailPendingTasks.length}</span>
                  <span style="font-size: 12px; margin-left: 4px;">PENDING</span>
                </div>
                <div style="display: inline-block; background: #10b981; color: #000; padding: 8px 16px;">
                  <span style="font-weight: 700; font-size: 24px;">${emailCompletedTasks.length}</span>
                  <span style="font-size: 12px; margin-left: 4px;">COMPLETED</span>
                </div>
              </div>
              
              ${emailPendingTasks.length > 0 ? `
                <div style="border: 1px solid #27272a; padding: 16px; margin-bottom: 16px; background: #09090b;">
                  <p style="color: #71717a; margin: 0 0 12px 0; font-size: 10px; letter-spacing: 1px;">&gt; PENDING_TASKS</p>
                  ${emailPendingTasks.map(task => `
                    <div style="border-left: 2px solid #22d3ee; padding: 12px; margin-bottom: 8px; background: #18181b;">
                      <p style="margin: 0; color: #e5e5e5; font-size: 14px; font-weight: 600;">${task.title}</p>
                      ${task.description ? `<p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">${task.description}</p>` : ''}
                      ${task.reminderTime ? `<p style="margin: 4px 0 0 0; color: #22d3ee; font-size: 11px;">⏰ ${new Date(task.reminderTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })} IST</p>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="border: 1px dashed #27272a; padding: 20px; text-align: center; margin-bottom: 16px;">
                  <p style="margin: 0; color: #71717a; font-size: 12px;">NO_PENDING_TASKS</p>
                </div>
              `}
              
              ${emailCompletedTasks.length > 0 ? `
                <div style="border: 1px solid #27272a; padding: 16px; background: #09090b;">
                  <p style="color: #71717a; margin: 0 0 12px 0; font-size: 10px; letter-spacing: 1px;">&gt; COMPLETED_TASKS</p>
                  ${emailCompletedTasks.map(task => `
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
            to: user.email,
            subject: `[ARIA] Task Report - ${emailPendingTasks.length} Pending, ${emailCompletedTasks.length} Completed`,
            html: emailHtml
          });

          responseData.emailSent = true;
          if (!responseData.response) {
            responseData.response = `Task list sent to your email (${user.email}). You have ${emailPendingTasks.length} pending and ${emailCompletedTasks.length} completed tasks.`;
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
          throw new Error('Failed to send email. Please check RESEND_API_KEY configuration.');
        }
        break;

      default:
        throw new Error(`Unknown action: ${parsed.action}`);
    }

    return responseData;
}

export default router;
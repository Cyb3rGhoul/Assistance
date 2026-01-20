/**
 * WhatsApp Service using Whatabot API
 * 
 * Whatabot allows sending WhatsApp messages to yourself for free.
 * Setup: Add +5491132704925 and send activation message
 */

/**
 * Send WhatsApp reminder using Whatabot API
 * @param {string} message - Message to send
 * @param {string} phoneNumber - WhatsApp phone number (with country code, e.g., +1234567890)
 * @param {string} apiKey - Whatabot API key
 * @returns {Promise<boolean>} - Success status
 */
export const sendWhatsAppReminder = async (message, phoneNumber, apiKey) => {
  try {
    if (!message || !phoneNumber || !apiKey) {
      console.error('Whatabot reminder failed: Missing required parameters');
      return false;
    }

    // Encode the message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Whatabot API endpoint
    const url = `http://api.whatabot.net/whatsapp/sendMessage?text=${encodedMessage}&apikey=${apiKey}&phone=${phoneNumber}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Aria-Assistant/1.0'
      }
    });
    
    if (response.ok) {
      console.log(`Whatabot reminder sent successfully to ${phoneNumber}`);
      return true;
    } else {
      console.error(`Whatabot reminder failed: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Whatabot reminder error:', error);
    return false;
  }
};

/**
 * Send task reminder via WhatsApp
 * @param {Object} task - Task object
 * @param {string} phoneNumber - WhatsApp phone number
 * @param {string} apiKey - Whatabot API key
 * @returns {Promise<boolean>} - Success status
 */
export const sendTaskReminderWhatsApp = async (task, phoneNumber, apiKey) => {
  const message = `🔔 *Task Reminder*

📋 *Task:* ${task.title}

${task.description ? `📝 *Description:* ${task.description}\n\n` : ''}⏰ *Due:* ${task.dueDate ? new Date(task.dueDate).toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'No due date'}

${task.priority ? `🚨 *Priority:* ${task.priority.toUpperCase()}\n\n` : ''}Don't forget to complete this task! 💪

_Sent by Aria Assistant_`;

  return await sendWhatsAppReminder(message, phoneNumber, apiKey);
};

/**
 * Send morning summary via WhatsApp
 * @param {Array} tasks - Array of tasks for today
 * @param {string} phoneNumber - WhatsApp phone number
 * @param {string} apiKey - Whatabot API key
 * @returns {Promise<boolean>} - Success status
 */
export const sendMorningSummaryWhatsApp = async (tasks, phoneNumber, apiKey) => {
  const pendingTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);
  
  let message = `🌅 *Good Morning!*

📅 *Today's Summary*

`;

  if (pendingTasks.length > 0) {
    message += `📋 *Pending Tasks (${pendingTasks.length}):*\n`;
    pendingTasks.slice(0, 5).forEach((task, index) => {
      const priority = task.priority ? ` (${task.priority.toUpperCase()})` : '';
      message += `${index + 1}. ${task.title}${priority}\n`;
    });
    
    if (pendingTasks.length > 5) {
      message += `... and ${pendingTasks.length - 5} more tasks\n`;
    }
    message += '\n';
  }

  if (completedTasks.length > 0) {
    message += `✅ *Completed Today (${completedTasks.length}):*\n`;
    completedTasks.slice(0, 3).forEach((task, index) => {
      message += `${index + 1}. ${task.title}\n`;
    });
    
    if (completedTasks.length > 3) {
      message += `... and ${completedTasks.length - 3} more completed\n`;
    }
    message += '\n';
  }

  if (pendingTasks.length === 0 && completedTasks.length === 0) {
    message += `🎉 No tasks for today! Enjoy your free time! 😊\n\n`;
  }

  message += `Have a productive day! 💪

_Sent by Aria Assistant_`;

  return await sendWhatsAppReminder(message, phoneNumber, apiKey);
};

/**
 * Send evening report via WhatsApp
 * @param {Array} completedTasks - Tasks completed today
 * @param {Array} pendingTasks - Remaining pending tasks
 * @param {string} phoneNumber - WhatsApp phone number
 * @param {string} apiKey - Whatabot API key
 * @returns {Promise<boolean>} - Success status
 */
export const sendEveningReportWhatsApp = async (completedTasks, pendingTasks, phoneNumber, apiKey) => {
  let message = `🌙 *Good Evening!*

📊 *Today's Report*

`;

  if (completedTasks.length > 0) {
    message += `✅ *Completed Today (${completedTasks.length}):*\n`;
    completedTasks.slice(0, 5).forEach((task, index) => {
      message += `${index + 1}. ${task.title}\n`;
    });
    
    if (completedTasks.length > 5) {
      message += `... and ${completedTasks.length - 5} more completed\n`;
    }
    message += '\n🎉 Great job today! 👏\n\n';
  } else {
    message += `📝 No tasks completed today. Tomorrow is a new opportunity! 💪\n\n`;
  }

  if (pendingTasks.length > 0) {
    message += `⏳ *Still Pending (${pendingTasks.length}):*\n`;
    const urgentTasks = pendingTasks.filter(task => task.priority === 'high').slice(0, 3);
    const otherTasks = pendingTasks.filter(task => task.priority !== 'high').slice(0, 2);
    
    if (urgentTasks.length > 0) {
      message += `🚨 *High Priority:*\n`;
      urgentTasks.forEach((task, index) => {
        message += `${index + 1}. ${task.title}\n`;
      });
    }
    
    if (otherTasks.length > 0) {
      message += `📋 *Other Tasks:*\n`;
      otherTasks.forEach((task, index) => {
        message += `${index + 1}. ${task.title}\n`;
      });
    }
    
    const remainingCount = pendingTasks.length - urgentTasks.length - otherTasks.length;
    if (remainingCount > 0) {
      message += `... and ${remainingCount} more tasks\n`;
    }
    message += '\n';
  } else {
    message += `🎊 All tasks completed! You're amazing! 🌟\n\n`;
  }

  message += `Rest well and prepare for tomorrow! 😴

_Sent by Aria Assistant_`;

  return await sendWhatsAppReminder(message, phoneNumber, apiKey);
};

/**
 * Test WhatsApp connection
 * @param {string} phoneNumber - WhatsApp phone number
 * @param {string} apiKey - Whatabot API key
 * @returns {Promise<boolean>} - Success status
 */
export const testWhatsAppConnection = async (phoneNumber, apiKey) => {
  const message = `🧪 *Test Message*

Your WhatsApp integration is working! 🎉

This is a test message from Aria Assistant to confirm your CallMeBot setup is configured correctly.

_Sent by Aria Assistant_`;

  return await sendWhatsAppReminder(message, phoneNumber, apiKey);
};
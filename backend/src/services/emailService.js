import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendTaskReminder(task, userEmail) {
  if (!resend) {
    console.warn('⚠️ Resend API key not configured. Skipping email.');
    return false;
  }
  
  try {
    await resend.emails.send({
      from: 'ARIA Assistant <onboarding@resend.dev>',
      to: userEmail,
      subject: `⏰ Reminder: ${task.title}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 16px;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <h1 style="color: #667eea; margin: 0 0 24px 0; font-size: 28px; font-weight: 700;">⏰ Task Reminder</h1>
            
            <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 24px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 24px;">
              <h2 style="color: #1a202c; margin: 0 0 12px 0; font-size: 22px; font-weight: 600;">${task.title}</h2>
              ${task.description ? `<p style="color: #4a5568; margin: 0; line-height: 1.6; font-size: 16px;">${task.description}</p>` : ''}
            </div>
            
            ${task.dueDate ? `
              <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <p style="margin: 0; color: #92400e; font-weight: 600;">
                  📅 Due: ${new Date(task.dueDate).toLocaleString('en-US', { 
                    timeZone: 'Asia/Kolkata',
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })} IST
                </p>
              </div>
            ` : ''}
            
            <p style="color: #718096; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              Sent by ARIA - Your AI Assistant
            </p>
          </div>
        </div>
      `
    });
    console.log(`✉️ Reminder sent for: ${task.title}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendMorningSummary(userEmail, tasks) {
  if (!resend) {
    console.warn('⚠️ Resend API key not configured. Skipping email.');
    return false;
  }
  
  const pendingTasks = tasks.filter(t => !t.completed);
  
  try {
    await resend.emails.send({
      from: 'ARIA Assistant <onboarding@resend.dev>',
      to: userEmail,
      subject: `🌅 Good Morning! Your Tasks for Today`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); padding: 40px 20px; border-radius: 16px;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <h1 style="color: #fdcb6e; margin: 0 0 24px 0; font-size: 28px; font-weight: 700;">🌅 Good Morning!</h1>
            
            <p style="color: #4a5568; font-size: 16px; margin-bottom: 24px;">Here's your task summary for today:</p>
            
            ${pendingTasks.length > 0 ? `
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="color: #2d3748; margin: 0 0 16px 0; font-size: 18px;">📋 Pending Tasks (${pendingTasks.length})</h3>
                ${pendingTasks.map(task => `
                  <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid #667eea;">
                    <p style="margin: 0; color: #1a202c; font-weight: 600; font-size: 16px;">${task.title}</p>
                    ${task.description ? `<p style="margin: 8px 0 0 0; color: #718096; font-size: 14px;">${task.description}</p>` : ''}
                    ${task.dueDate ? `<p style="margin: 8px 0 0 0; color: #e53e3e; font-size: 13px;">⏰ ${new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })} IST</p>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="background: #c6f6d5; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; color: #22543d; font-size: 18px; font-weight: 600;">🎉 No pending tasks! Enjoy your day!</p>
              </div>
            `}
            
            <p style="color: #718096; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              Have a productive day! 💪
            </p>
          </div>
        </div>
      `
    });
    console.log(`✉️ Morning summary sent to: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Morning summary error:', error);
    return false;
  }
}

export async function sendEveningReport(userEmail, completedTasks, pendingTasks) {
  if (!resend) {
    console.warn('⚠️ Resend API key not configured. Skipping email.');
    return false;
  }
  
  try {
    await resend.emails.send({
      from: 'ARIA Assistant <onboarding@resend.dev>',
      to: userEmail,
      subject: `🌙 Daily Report: ${completedTasks.length} Completed, ${pendingTasks.length} Pending`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 16px;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <h1 style="color: #667eea; margin: 0 0 24px 0; font-size: 28px; font-weight: 700;">🌙 Your Daily Report</h1>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
              <div style="background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%); padding: 20px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #22543d;">${completedTasks.length}</p>
                <p style="margin: 8px 0 0 0; color: #22543d; font-weight: 600;">✅ Completed</p>
              </div>
              <div style="background: linear-gradient(135deg, #fed7d7 0%, #fc8181 100%); padding: 20px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #742a2a;">${pendingTasks.length}</p>
                <p style="margin: 8px 0 0 0; color: #742a2a; font-weight: 600;">⏳ Pending</p>
              </div>
            </div>
            
            ${completedTasks.length > 0 ? `
              <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="color: #22543d; margin: 0 0 16px 0; font-size: 18px;">✅ Completed Today</h3>
                ${completedTasks.map(task => `
                  <div style="padding: 12px; border-bottom: 1px solid #c6f6d5;">
                    <p style="margin: 0; color: #2d3748; font-weight: 600;">${task.title}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${pendingTasks.length > 0 ? `
              <div style="background: #fff5f5; padding: 20px; border-radius: 8px;">
                <h3 style="color: #742a2a; margin: 0 0 16px 0; font-size: 18px;">⏳ Still Pending</h3>
                ${pendingTasks.map(task => `
                  <div style="padding: 12px; border-bottom: 1px solid #fed7d7;">
                    <p style="margin: 0; color: #2d3748; font-weight: 600;">${task.title}</p>
                    ${task.dueDate ? `<p style="margin: 4px 0 0 0; color: #e53e3e; font-size: 13px;">⏰ ${new Date(task.dueDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })} IST</p>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <p style="color: #718096; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              Rest well! See you tomorrow 🌟
            </p>
          </div>
        </div>
      `
    });
    console.log(`✉️ Evening report sent to: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Evening report error:', error);
    return false;
  }
}

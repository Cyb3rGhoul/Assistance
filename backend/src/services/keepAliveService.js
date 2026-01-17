// Keep Alive Service - Prevents Render from sleeping the backend
// Pings the server every minute to maintain activity
// Sleep hours: 12:05 AM - 4:30 AM IST (no pings during sleep time)

import cron from 'node-cron';

const BACKEND_URL = process.env.BACKEND_URL || 'https://your-app-name.onrender.com';

// Check if current time is within sleep hours (12:05 AM - 4:30 AM IST)
const isWithinSleepHours = () => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  
  // Sleep from 00:05 to 04:30 IST
  if (hours === 0 && minutes >= 5) return true; // 12:05 AM - 12:59 AM
  if (hours >= 1 && hours <= 3) return true;    // 1:00 AM - 3:59 AM  
  if (hours === 4 && minutes < 30) return true; // 4:00 AM - 4:29 AM
  
  return false;
};

export const startKeepAlive = () => {
  // Only run keep-alive in production (Render)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🏠 Development mode - Keep-alive disabled');
    return;
  }

  // Ping every 5 minutes to keep Render service active (except during sleep hours)
  cron.schedule('*/5 * * * *', async () => {
    // Check if we're in sleep hours
    if (isWithinSleepHours()) {
      // Silent during sleep hours - no logs to avoid spam
      return;
    }

    try {
      // Simple health check ping
      const response = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        timeout: 5000 // 5 second timeout
      });

      if (response.ok) {
        // Only log once every 30 minutes to reduce spam (since we ping every 5 min)
        if (now.getMinutes() % 30 === 0) {
          const istTime = now.toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`💓 Keep-alive active at ${istTime} IST`);
        }
      }
    } catch (error) {
      // Silently handle errors to avoid spam
      // Only log critical errors
      if (!error.message.includes('timeout') && !error.message.includes('ECONNREFUSED')) {
        console.log(`🔄 Keep-alive error: ${error.message}`);
      }
    }
  });

  console.log('💓 Keep-alive service started (Production mode)');
  console.log('😴 Sleep hours: 12:05 AM - 4:30 AM IST (no pings)');
  console.log('🔄 Ping frequency: Every 5 minutes');
  console.log(`🎯 Target: ${BACKEND_URL}/api/health`);
};
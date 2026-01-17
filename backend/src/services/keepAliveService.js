// Keep Alive Service - Prevents services from sleeping due to inactivity
// Pings the server every 5 minutes to maintain activity
// Works in both development and production modes
// Sleep hours: 12:05 AM - 4:30 AM IST (no pings during sleep time)

import cron from 'node-cron';

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
  const isDev = process.env.NODE_ENV !== 'production';
  const mode = isDev ? 'Development' : 'Production';
  const BACKEND_URL = process.env.BACKEND_URL || (isDev ? 'http://localhost:5000' : 'https://assistance-p1pr.onrender.com');
  
  console.log(`Keep-alive service started (${mode})`);

  // Ping every 5 minutes to keep service active (except during sleep hours)
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date();

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
        // Log every 10 minutes to reduce spam (pings every 5 min, logs at 0, 10, 20, 30, 40, 50)
        if (now.getMinutes() % 10 === 0) {
          const istTime = now.toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`Keep-alive active at ${istTime} IST`);
        }
      }
    } catch (error) {
      const istTime = now.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`Keep-alive error at ${istTime} IST:`, error.message);
    }
  });
};
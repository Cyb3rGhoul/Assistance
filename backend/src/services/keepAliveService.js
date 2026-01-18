// Keep Alive Service - Prevents services from sleeping due to inactivity
// Pings the server every 5 minutes to maintain activity 24/7
// Works in both development and production modes
// Logs every 15 minutes to reduce spam

import cron from 'node-cron';

export const startKeepAlive = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  const mode = isDev ? 'Development' : 'Production';
  const BACKEND_URL = process.env.BACKEND_URL || (isDev ? 'http://localhost:5000' : 'https://assistance-p1pr.onrender.com');
  
  console.log(`Keep-alive service started (${mode})`);

  // Ping every 5 minutes to keep service active 24/7
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Simple health check ping - no logs to reduce spam
      await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        timeout: 5000 // 5 second timeout
      });
    } catch (error) {
      // Only log errors, not successful pings
      const istTime = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`Keep-alive error at ${istTime} IST:`, error.message);
    }
  });
};
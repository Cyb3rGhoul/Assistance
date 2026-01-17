// Time utility functions for consistent IST/UTC conversion

/**
 * Format a UTC date string for display in IST
 */
export function formatDateTimeIST(dateString: string): string {
  const date = new Date(dateString);
  
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Convert UTC date to IST date string for form input (YYYY-MM-DD)
 */
export function utcToISTDate(utcDateString: string): string {
  const date = new Date(utcDateString);
  
  return date.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Convert UTC date to IST time string for form input (HH:MM)
 */
export function utcToISTTime(utcDateString: string): string {
  const date = new Date(utcDateString);
  
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Convert IST date and time strings to UTC ISO string for storage
 */
export function istToUTC(dateString: string, timeString: string): string {
  // Parse the date and time components
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Create UTC date directly using Date.UTC to avoid timezone issues
  // IST is UTC+5:30, so to convert IST to UTC we subtract 5.5 hours
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  
  // Create the IST time as if it were UTC, then subtract offset
  const utcTime = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - istOffset;
  
  return new Date(utcTime).toISOString();
}

/**
 * Get current IST time for debugging
 */
export function getCurrentIST(): string {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}
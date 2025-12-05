/**
 * Formats a date as relative time (e.g., "2 hours ago", "yesterday", "3 days ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const diffInMs = now.getTime() - then.getTime();
  
  // Handle future dates (shouldn't happen, but just in case)
  if (diffInMs < 0) {
    return 'just now';
  }
  
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInDays === 1) {
    return 'yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  } else if (diffInYears === 1) {
    return '1 year ago';
  } else {
    // For very old dates, show the date
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[then.getMonth()];
    const day = then.getDate();
    const year = then.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year === currentYear) {
      return `${month} ${day}`;
    } else {
      return `${month} ${day}, ${year}`;
    }
  }
}


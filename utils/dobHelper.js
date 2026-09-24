/**
 * Smart DOB Formatter & Checkpoint Validator Helper
 * 
 * Features:
 * 1. Independent editing of Month, Day, or Year without digit shifting or trapping backspaces.
 * 2. Strict Checkpoint validation:
 *    - Month: 01 - 12
 *    - Day: 01 - 31 (verified against exact days in month, including leap year handling for Feb)
 *    - Year: past 100 years up to Current Year (no future dates allowed)
 */

export function formatDob(text, prevText = '') {
  if (!text) return '';

  // Filter out any non-digit and non-slash characters immediately
  const sanitized = text.replace(/[^\d/]/g, '');
  if (!sanitized) return '';

  const isDeleting = prevText && text.length < prevText.length;

  // 1. If text contains slashes (editing an existing MM/DD/YYYY string or user typed slashes)
  if (sanitized.includes('/')) {
    const parts = sanitized.split('/');
    let month = (parts[0] || '').replace(/\D/g, '');
    let day = (parts[1] || '').replace(/\D/g, '');
    let year = (parts[2] || '').replace(/\D/g, '');

    // Handle spillover digits from month to day, and day to year
    if (month.length > 2) {
      day = month.slice(2) + day;
      month = month.slice(0, 2);
    }
    if (day.length > 2) {
      year = day.slice(2) + year;
      day = day.slice(0, 2);
    }
    year = year.slice(0, 4);

    // Handle backspacing when deleting over slashes
    if (isDeleting && prevText.endsWith('/') && !text.endsWith('/')) {
      if (parts.length === 2 && !parts[1] && month.length > 0) {
        month = month.slice(0, -1);
      } else if (parts.length >= 3 && !parts[2] && day.length > 0) {
        day = day.slice(0, -1);
      }
    }

    if (year.length > 0 || parts.length >= 3 || (text.endsWith('/') && parts.length === 2 && day.length === 2)) {
      return text.endsWith('/') && year.length === 0 ? `${month}/${day}/` : `${month}/${day}/${year}`;
    } else if (day.length > 0 || parts.length >= 2 || (text.endsWith('/') && month.length === 2)) {
      return text.endsWith('/') && day.length === 0 ? `${month}/` : `${month}/${day}`;
    } else {
      return month;
    }
  }

  // 2. Pure digits (continuous typing or pasting)
  const clean = sanitized.replace(/\D/g, '').slice(0, 8);
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
  } else if (clean.length > 2) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
}

export function validateDob(dobString, isRequired = true) {
  if (!dobString || !dobString.trim()) {
    return isRequired ? 'Date of birth is required' : null;
  }

  const trimmed = dobString.trim();

  if (/[^\d/]/.test(trimmed)) {
    return 'Date of birth must contain numbers only';
  }

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length < 8) {
    return 'Please enter a complete date of birth (MM/DD/YYYY)';
  }

  const month = parseInt(cleanDigits.slice(0, 2), 10);
  const day = parseInt(cleanDigits.slice(2, 4), 10);
  const year = parseInt(cleanDigits.slice(4, 8), 10);
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;

  if (month < 1 || month > 12) {
    return 'Invalid month (must be 01 to 12)';
  }

  if (day < 1 || day > 31) {
    return 'Invalid day (must be 01 to 31)';
  }

  // Calculate days in specific month (accounting for leap year in Feb)
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return month === 2
      ? `February ${year} only has ${daysInMonth} days`
      : `Selected month only has ${daysInMonth} days`;
  }

  if (year < minYear || year > currentYear) {
    return `Year must be between ${minYear} and ${currentYear}`;
  }

  const dateObj = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (dateObj > today) {
    return 'Date of birth cannot be in the future';
  }

  return null;
}

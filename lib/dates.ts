/**
 * Timezone utilities for Cambodia (UTC+7 / Asia/Phnom_Penh).
 * All dates stored and compared must reflect the local Cambodian calendar day.
 */

export const CAMBODIA_TIMEZONE = 'Asia/Phnom_Penh';

/**
 * Returns the current date in Cambodia (UTC+7) as a 'YYYY-MM-DD' formatted string.
 */
export function getCambodiaTodayStr(dateInput: Date = new Date()): string {
  // Use Intl.DateTimeFormat to compute year, month, and day in UTC+7
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMBODIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateInput); // en-CA yields YYYY-MM-DD
}

/**
 * Converts any UTC date or ISO timestamp into Cambodia local calendar 'YYYY-MM-DD'.
 */
export function formatToCambodiaDate(timestampMs: number | string | Date): string {
  const d = new Date(timestampMs);
  if (isNaN(d.getTime())) return '';
  return getCambodiaTodayStr(d);
}

/**
 * Validates a YYYY-MM-DD date string:
 * - Checks regex format
 * - Checks calendar validity (leap years: Feb 29 2024 vs 2025, days in month)
 * - Optionally checks whether date is in the future relative to Cambodia time
 */
export function validateTransactionDate(
  dateStr: string,
  allowFuture: boolean = false
): { valid: boolean; error?: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: 'ទម្រង់កាលបរិច្ឆេទមិនត្រឹមត្រូវ (Date must be YYYY-MM-DD)' };
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);

  if (year < 2000 || year > 2100) {
    return { valid: false, error: 'ឆ្នាំមិនត្រឹមត្រូវ (Invalid year range)' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: 'ខែមិនត្រឹមត្រូវ (Invalid month)' };
  }

  // Days in month check with leap year handling
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      valid: false,
      error: `ថ្ងៃមិនត្រឹមត្រូវសម្រាប់ខែនេះ (Day ${day} is invalid for month ${month}/${year})`,
    };
  }

  if (!allowFuture) {
    const todayCambodia = getCambodiaTodayStr();
    if (dateStr > todayCambodia) {
      return {
        valid: false,
        error: 'កាលបរិច្ឆេទមិនអាចជាថ្ងៃអនាគត (Date cannot be in the future)',
      };
    }
  }

  return { valid: true };
}

/**
 * Parses month key from date string for monthly grouping tables.
 */
export function getMonthKeyFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

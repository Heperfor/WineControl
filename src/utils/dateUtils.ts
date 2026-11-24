/**
 * Returns YYYY-MM-DD formatted in the user's local timezone (avoids UTC date-shift issues).
 */
export const getLocalIsoDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

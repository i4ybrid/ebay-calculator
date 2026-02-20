// List of keywords/phrases to remove
const SANITIZE_REMOVE_KEYWORDS = [
  "in.hand",
  "free.shipping",
  "free.ship",
  "new",
  "sold.out",
];

/**
 * Sanitizes the item description by converting non-alphanumeric characters into regex 'any match',
 * removing specified keywords/phrases, converting to lowercase, and trimming leading/trailing '.' characters.
 */
export function sanitizeDescription(description) {
  description = description.toLowerCase();
  // Convert non-alphanumeric characters to 'any match' regex (.)
  let sanitized = description.replace(/[^a-zA-Z0-9]/g, '.');
  // Remove specified keywords/phrases
  SANITIZE_REMOVE_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  // Remove years formatted as 19xx, 20xx, and 20xx-xx
  sanitized = sanitized.replace(/\b(19|20)\d{2}\b/g, '');
  sanitized = sanitized.replace(/\b(19|20)\d{2}-\d{2}\b/g, '');
  // Trim leading/trailing '.' characters and consolidate for Sql LIKE statement
  sanitized = sanitized.replace(/^\.+|\.+$/g, '').trim();
  sanitized = sanitized.replace(/\.+/g, '%');
  return sanitized;
}




export const formatDateISO = (date) => {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export function convertSQLDate(sqlDate) {
  if (!sqlDate) { return ''; }
  const date = new Date(sqlDate / 1000);
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`
}

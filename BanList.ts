
/**
 * لیست سیاه (Banned Users List)
 */
export const BANNED_IDENTIFIERS: string[] = [
  'tiN6W65agYaoWn0KyblSV1QrvZl2', // UID کاربر اول
  'whale'                        // یوزرنیم کاربر دوم
];

export const isUserBanned = (uid: string, username: string): boolean => {
  if (!uid || !username) return false;
  const normalizedUsername = username.toLowerCase().trim();
  // چک کردن UID یا یوزرنیم در لیست BANNED_IDENTIFIERS
  return BANNED_IDENTIFIERS.includes(uid) || BANNED_IDENTIFIERS.includes(normalizedUsername);
};

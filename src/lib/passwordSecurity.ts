const COMMON_PASSWORDS = new Set([
  "123456789012","1234567890","12345678","123456789","123456",
  "password","password123","password1234","qwerty","qwerty123",
  "qwertyuiop","admin123","adminadmin","letmein","welcome123",
  "iloveyou","000000000000","111111111111","1111111111",
  "aaaaaaaaaaaa","abcdefghijkl","abcdefghijk","asdfghjkl123",
]);

export function validateNewPassword(password: string): string | null {
  const normalized = password.trim().toLowerCase();

  if (password.length < 12) {
    return "كلمة المرور يجب أن تكون 12 حرفًا أو أكثر.";
  }

  if (COMMON_PASSWORDS.has(normalized)) {
    return "كلمة المرور شائعة وضعيفة جدًا. اختاري كلمة مرور مختلفة.";
  }

  if (/^(.)\1+$/.test(password)) {
    return "لا تستخدمي نفس الحرف أو الرقم مكررًا.";
  }

  if (/^(0123456789|1234567890|9876543210|0987654321)/.test(password)) {
    return "لا تستخدمي تسلسلًا رقميًا سهل التخمين.";
  }

  return null;
}

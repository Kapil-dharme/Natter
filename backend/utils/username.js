const ALLOWED = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

const RESERVED = [
  "admin",
  "administrator",
  "support",
  "helpdesk",
  "help",
  "natter",
  "nattersupport",
  "natterteam",
  "official",
  "moderator",
  "mod",
  "system",
  "root",
  "staff",
  "team",
  "security",
  "service",
  "customercare",
  "owner",
  "founder",
  "developer",
  "dev",
  "api",
  "auth",
  "login",
  "logout",
  "signup",
  "register",
  "settings",
  "profile",
  "user",
  "users",
  "null",
  "undefined",
  "anonymous",
  "everyone",
  "verified",
  "bot"
];

export const toUsernameKey = (name) =>
  name
    .toLowerCase()
    .replace(/_/g, "")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[1il]/g, "l")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/3/g, "e");

const RESERVED_KEYS = new Set(RESERVED.map(toUsernameKey));
const BLOCKED_PARTS = ["natter"].map(toUsernameKey);

export const validateUsername = (input) => {
  if (typeof input !== "string") {
    return { ok: false, message: "Username is required" };
  }
  const username = input.trim();
  if (!ALLOWED.test(username)) {
    return {
      ok: false,
      message: "Invalid username",
    };
  }
  const key = toUsernameKey(username);
  if (RESERVED_KEYS.has(key) || BLOCKED_PARTS.some((part) => key.includes(part))) {
    return { ok: false, message: "Username not available" };
  }
  return { ok: true, username, key };
};
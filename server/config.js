import dotenv from "dotenv";

dotenv.config();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeTelegramAuthMode(value, fallback = "widget") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "local" || normalized === "widget") {
    return normalized;
  }

  return fallback;
}

function parseReminderOffsets(value) {
  const source = String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return source.length ? source : [1440, 60, 15];
}

export const config = {
  port: Number(process.env.PORT || 3001),
  clientUrl: process.env.CLIENT_URL || "http://127.0.0.1:5173",
  apiBaseUrl: process.env.API_BASE_URL || "http://127.0.0.1:3001",
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret-change-me",
  adminEmail: process.env.ADMIN_EMAIL || "admin@repetly.local",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin12345",
  adminFullName: process.env.ADMIN_FULL_NAME || "Repetly Admin",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  vkClientId: process.env.VK_CLIENT_ID || "",
  vkClientSecret: process.env.VK_CLIENT_SECRET || "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL || "",
  telegramPollingEnabled: parseBoolean(process.env.TELEGRAM_POLLING_ENABLED),
  telegramLinkTtlMinutes: Number(process.env.TELEGRAM_LINK_TTL_MINUTES || 15),
  telegramReminderOffsetsMinutes: parseReminderOffsets(process.env.TELEGRAM_REMINDER_OFFSETS_MINUTES),
  isProduction: process.env.NODE_ENV === "production",
  sessionCookieSecure: parseBoolean(process.env.SESSION_COOKIE_SECURE, process.env.NODE_ENV === "production"),
  telegramAuthMode: normalizeTelegramAuthMode(process.env.TELEGRAM_AUTH_MODE, "widget"),
};

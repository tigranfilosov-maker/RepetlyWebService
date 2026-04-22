import crypto from "node:crypto";
import { execFile } from "node:child_process";
import https from "node:https";
import { promisify } from "node:util";
import { config } from "./config.js";
import { all, get, run } from "./db.js";
import { upsertSocialUser } from "./auth-service.js";

const DEFAULT_REMINDER_OFFSETS = Object.freeze([1440, 60, 15]);
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LINK_CODE_LENGTH = 8;
const REMINDER_GRACE_MS = 1000 * 60 * 5;
const TELEGRAM_AUTH_REQUEST_TTL_MS = 1000 * 60 * 15;
const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

function normalizeBotUsername(value) {
  return String(value || "").trim().replace(/^@/, "");
}

function hashSecret(secret) {
  return crypto.createHash("sha256").update(String(secret || "")).digest("hex");
}

function createId() {
  return crypto.randomUUID();
}

function createLinkCode() {
  const bytes = crypto.randomBytes(LINK_CODE_LENGTH);
  let code = "";

  for (let index = 0; index < LINK_CODE_LENGTH; index += 1) {
    code += LINK_CODE_ALPHABET[bytes[index] % LINK_CODE_ALPHABET.length];
  }

  return code;
}

function createTelegramAuthToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function addMinutes(timestamp, minutes) {
  return new Date(timestamp.getTime() + minutes * 60 * 1000);
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseReminderOffsets(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const normalized = [...new Set(
    source
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0 && item <= 60 * 24 * 14),
  )].sort((left, right) => right - left);

  return normalized.length ? normalized : [...DEFAULT_REMINDER_OFFSETS];
}

function toIntegerBoolean(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value ? 1 : 0;
}

function isFutureIso(value) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function buildAppUrl(pathname = "") {
  const base = new URL(config.clientUrl);

  if (!pathname) {
    return base.toString();
  }

  return new URL(pathname, base).toString();
}

function safeTimingCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isSqliteUniqueError(error) {
  return error?.code === "SQLITE_CONSTRAINT" && /UNIQUE/i.test(error.message || "");
}

function toHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function getEntryStartDate(entry) {
  return new Date(`${entry.date}T${String(entry.start_hour).padStart(2, "0")}:00:00`);
}

function getEntryEndDate(entry) {
  return new Date(`${entry.date}T${String(entry.end_hour).padStart(2, "0")}:00:00`);
}

function formatDateTimeRange(entry) {
  const startDate = getEntryStartDate(entry);

  return {
    startDate,
    endDate: getEntryEndDate(entry),
    dateLabel: startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    timeLabel: `${toHourLabel(entry.start_hour)} - ${toHourLabel(entry.end_hour)}`,
  };
}

function resolveCounterpartyLabel(role) {
  if (role === "teacher") {
    return "Student";
  }

  if (role === "student") {
    return "Teacher";
  }

  return "Participant";
}

function formatLessonDetails(entry) {
  const { dateLabel, timeLabel } = formatDateTimeRange(entry);
  const partnerLabel = resolveCounterpartyLabel(entry.user_role);
  const lines = [
    `Lesson: ${entry.title}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
  ];

  if (entry.partner_name) {
    lines.push(`${partnerLabel}: ${entry.partner_name}`);
  }

  if (entry.lesson_link) {
    lines.push(`Link: ${entry.lesson_link}`);
  }

  if (entry.details) {
    lines.push(`Notes: ${entry.details.slice(0, 280)}`);
  }

  return lines.join("\n");
}

function formatReminderLeadTime(offsetMinutes) {
  if (offsetMinutes % (60 * 24) === 0) {
    const days = offsetMinutes / (60 * 24);
    return days === 1 ? "in 1 day" : `in ${days} days`;
  }

  if (offsetMinutes % 60 === 0) {
    const hours = offsetMinutes / 60;
    return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
  }

  return offsetMinutes === 1 ? "in 1 minute" : `in ${offsetMinutes} minutes`;
}

function mapConnectionRecord(row) {
  if (!row) {
    return null;
  }

  const reminderOffsetsMinutes = parseReminderOffsets(row.reminder_offsets_json);

  return {
    id: row.id,
    userId: row.user_id,
    userFullName: row.user_full_name || "",
    userRole: row.user_role || "",
    telegramUserId: row.telegram_user_id || "",
    telegramUsername: row.telegram_username || "",
    telegramChatId: row.telegram_chat_id || "",
    linkedStatus: row.linked_status || "unlinked",
    isLinked: row.linked_status === "linked" && Boolean(row.telegram_chat_id),
    linkedAt: row.linked_at || null,
    unlinkedAt: row.unlinked_at || null,
    lastInteractionAt: row.last_interaction_at || null,
    linkExpiresAt: row.link_expires_at || null,
    hasPendingLink: isFutureIso(row.link_expires_at) && Boolean(row.link_token_hash || row.link_code_hash),
    preferences: {
      notificationsEnabled: Boolean(row.notifications_enabled),
      messages: Boolean(row.notify_messages),
      system: Boolean(row.notify_system),
      lessons: Boolean(row.notify_lessons),
      reminders: Boolean(row.notify_reminders),
      reminderOffsetsMinutes,
    },
  };
}

async function ensureConnectionRecord(userId) {
  const timestamp = nowIso();

  await run(
    `
      INSERT OR IGNORE INTO telegram_connections (
        id,
        user_id,
        linked_status,
        notifications_enabled,
        notify_messages,
        notify_system,
        notify_lessons,
        notify_reminders,
        reminder_offsets_json,
        created_at,
        updated_at
      ) VALUES (?, ?, 'unlinked', 1, 1, 1, 1, 1, ?, ?, ?)
    `,
    [createId(), userId, JSON.stringify(DEFAULT_REMINDER_OFFSETS), timestamp, timestamp],
  );
}

async function getConnectionByUserId(userId) {
  await ensureConnectionRecord(userId);

  return get(
    `
      SELECT tc.*, u.full_name AS user_full_name, u.role AS user_role
      FROM telegram_connections tc
      INNER JOIN users u ON u.id = tc.user_id
      WHERE tc.user_id = ?
      LIMIT 1
    `,
    [userId],
  );
}

async function getConnectionByTelegramIdentity({ telegramUserId, telegramChatId }) {
  if (!telegramUserId && !telegramChatId) {
    return null;
  }

  return get(
    `
      SELECT tc.*, u.full_name AS user_full_name, u.role AS user_role
      FROM telegram_connections tc
      INNER JOIN users u ON u.id = tc.user_id
      WHERE tc.linked_status = 'linked'
        AND (
          (? != '' AND tc.telegram_user_id = ?)
          OR (? != '' AND tc.telegram_chat_id = ?)
        )
      LIMIT 1
    `,
    [telegramUserId || "", telegramUserId || "", telegramChatId || "", telegramChatId || ""],
  );
}

async function touchTelegramIdentity({ telegramUserId, telegramChatId, telegramUsername }) {
  const existing = await getConnectionByTelegramIdentity({ telegramUserId, telegramChatId });

  if (!existing) {
    return null;
  }

  const timestamp = nowIso();

  await run(
    `
      UPDATE telegram_connections
      SET telegram_username = ?, telegram_chat_id = ?, last_interaction_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [telegramUsername || existing.telegram_username || null, telegramChatId || existing.telegram_chat_id, timestamp, timestamp, existing.id],
  );

  return mapConnectionRecord({
    ...existing,
    telegram_username: telegramUsername || existing.telegram_username || "",
    telegram_chat_id: telegramChatId || existing.telegram_chat_id,
    last_interaction_at: timestamp,
    updated_at: timestamp,
  });
}

async function findPendingLinkRecord(credential) {
  if (!credential) {
    return null;
  }

  const credentialHash = hashSecret(credential);

  return get(
    `
      SELECT tc.*, u.full_name AS user_full_name, u.role AS user_role
      FROM telegram_connections tc
      INNER JOIN users u ON u.id = tc.user_id
      WHERE tc.link_expires_at > ?
        AND (tc.link_code_hash = ? OR tc.link_token_hash = ?)
      LIMIT 1
    `,
    [nowIso(), credentialHash, credentialHash],
  );
}

async function cleanupExpiredTelegramAuthRequests() {
  await run(
    `
      DELETE FROM telegram_auth_requests
      WHERE expires_at <= ?
         OR status = 'completed'
    `,
    [nowIso()],
  );
}

async function getTelegramAuthRequestByCredential(credential) {
  if (!credential) {
    return null;
  }

  await cleanupExpiredTelegramAuthRequests();

  return get(
    `
      SELECT *
      FROM telegram_auth_requests
      WHERE token_hash = ?
      LIMIT 1
    `,
    [hashSecret(credential)],
  );
}

function mapTelegramAuthRequest(record) {
  if (!record) {
    return null;
  }

  const isExpired = new Date(record.expires_at).getTime() <= Date.now();
  const status = isExpired && record.status === "pending" ? "expired" : record.status;

  return {
    id: record.id,
    mode: record.mode,
    role: record.role,
    userId: record.user_id || null,
    status,
    errorCode: record.error_code || "",
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    approvedAt: record.approved_at || null,
    completedAt: record.completed_at || null,
    telegramUsername: record.telegram_username || "",
  };
}

function getNotificationCategory(type) {
  if (type === "incoming_message") {
    return "messages";
  }

  if (type === "lesson_scheduled" || type === "lesson_updated" || type === "upcoming_lesson") {
    return "lessons";
  }

  return "system";
}

function isDeliveryAllowed(connection, category) {
  if (!connection?.isLinked || !connection.telegramChatId) {
    return false;
  }

  if (!connection.preferences.notificationsEnabled) {
    return false;
  }

  if (category === "messages") {
    return connection.preferences.messages;
  }

  if (category === "lessons") {
    return connection.preferences.lessons;
  }

  if (category === "reminders") {
    return connection.preferences.lessons && connection.preferences.reminders;
  }

  return connection.preferences.system;
}

function buildNotificationText(notification) {
  const lines = ["Repetly notification"];

  if (notification.title) {
    lines.push(notification.title);
  }

  if (notification.body) {
    lines.push(notification.body);
  }

  if (notification.link) {
    lines.push(`Open: ${buildAppUrl(notification.link)}`);
  }

  return lines.join("\n\n");
}

async function createDeliveryLog(connection, { category, dedupeKey, payload }) {
  if (!dedupeKey) {
    return null;
  }

  const timestamp = nowIso();
  const id = createId();

  try {
    await run(
      `
        INSERT INTO telegram_delivery_logs (
          id,
          connection_id,
          user_id,
          category,
          dedupe_key,
          payload_json,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [id, connection.id, connection.userId, category, dedupeKey, payload ? JSON.stringify(payload) : null, timestamp],
    );

    return id;
  } catch (error) {
    if (isSqliteUniqueError(error)) {
      return "duplicate";
    }

    throw error;
  }
}

async function markDeliverySuccess(logId, telegramResult) {
  if (!logId || logId === "duplicate") {
    return;
  }

  await run(
    `
      UPDATE telegram_delivery_logs
      SET status = 'delivered',
          telegram_message_id = ?,
          delivered_at = ?,
          error_message = NULL
      WHERE id = ?
    `,
    [String(telegramResult?.message_id || ""), nowIso(), logId],
  );
}

async function markDeliveryFailure(logId, error) {
  if (!logId || logId === "duplicate") {
    return;
  }

  await run(
    `
      UPDATE telegram_delivery_logs
      SET status = 'failed',
          error_message = ?
      WHERE id = ?
    `,
    [String(error?.message || error || "Telegram delivery failed").slice(0, 500), logId],
  );
}

async function sendTelegramApiRequest(method, payload) {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram integration is not configured.");
  }

  return sendTelegramPostRequest(method, payload);
}

async function sendTelegramText(chatId, text) {
  return sendTelegramApiRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

async function deliverToConnection(connection, { category, text, dedupeKey, payload }) {
  if (!isDeliveryAllowed(connection, category)) {
    return { delivered: false, reason: "disabled" };
  }

  const logId = await createDeliveryLog(connection, { category, dedupeKey, payload });

  if (logId === "duplicate") {
    return { delivered: false, reason: "duplicate" };
  }

  try {
    const result = await sendTelegramText(connection.telegramChatId, text);
    await markDeliverySuccess(logId, result);
    return { delivered: true, result };
  } catch (error) {
    await markDeliveryFailure(logId, error);
    console.error("[telegram] delivery failed", error);
    return { delivered: false, reason: "failed", error };
  }
}

async function listUpcomingLessons(userId, limit = 5) {
  const entries = await all(
    `
      SELECT
        e.id,
        e.user_id,
        e.partner_id,
        e.shared_event_id,
        e.title,
        e.details,
        e.lesson_link,
        e.date,
        e.start_hour,
        e.end_hour,
        e.status,
        owner.role AS user_role,
        owner.full_name AS user_name,
        partner.full_name AS partner_name,
        partner.role AS partner_role
      FROM schedule_entries e
      INNER JOIN users owner ON owner.id = e.user_id
      LEFT JOIN users partner ON partner.id = e.partner_id
      WHERE e.user_id = ?
      ORDER BY e.date ASC, e.start_hour ASC
    `,
    [userId],
  );

  const now = new Date();

  return entries
    .filter((entry) => getEntryEndDate(entry).getTime() > now.getTime())
    .slice(0, limit);
}

function buildScheduleSummaryText(entries) {
  if (!entries.length) {
    return "No upcoming lessons are scheduled yet.";
  }

  const lines = ["Upcoming lessons"];

  for (const entry of entries) {
    const { dateLabel, timeLabel } = formatDateTimeRange(entry);
    const partnerLabel = entry.partner_name ? `, ${resolveCounterpartyLabel(entry.user_role)}: ${entry.partner_name}` : "";
    lines.push(`- ${entry.title} on ${dateLabel}, ${timeLabel}${partnerLabel}`);
  }

  return lines.join("\n");
}

function buildLinkPromptText() {
  return [
    "Telegram is not linked yet.",
    "To link an existing website account: open Repetly settings, start Telegram confirmation, then paste the one-time code here.",
    "To register through this bot: use /register_teacher or /register_student.",
  ].join("\n\n");
}

function buildBotHelpText(isLinked) {
  const commands = [
    "/register_teacher - create a teacher account and link this Telegram",
    "/register_student - create a student account and link this Telegram",
    "/link - help with linking an existing account",
    "/nextlesson - show the nearest lesson",
    "/schedule - show upcoming lessons",
    "/notifications - show Telegram notification settings",
  ];

  return [
    isLinked
      ? "Telegram is connected to your Repetly account."
      : "This bot can register a new Repetly account or link an existing one.",
    "Commands:",
    ...commands,
  ].join("\n");
}

export function isTelegramConfigured() {
  return Boolean(config.telegramBotToken && normalizeBotUsername(config.telegramBotUsername));
}

async function sendTelegramControlRequest(method, payload = {}) {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram integration is not configured.");
  }

  return sendTelegramPostRequest(method, payload);
}

function sendTelegramPostRequest(method, payload = {}) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request(
      `https://api.telegram.org/bot${config.telegramBotToken}/${method}`,
      {
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseText = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseText += chunk;
        });
        response.on("end", () => {
          const data = responseText ? parseJson(responseText, null) : null;

          if (response.statusCode < 200 || response.statusCode >= 300 || !data?.ok) {
            reject(
              new Error(
                data?.description ||
                  `Telegram request failed with status ${response.statusCode || "unknown"}.`,
              ),
            );
            return;
          }

          resolve(data.result);
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(20000, () => {
      request.destroy(new Error("Telegram request timed out."));
    });
    request.write(body);
    request.end();
  }).catch(async (error) => {
    if (process.platform !== "win32") {
      throw error;
    }

    return sendTelegramPostRequestViaPowerShell(method, body);
  });
}

async function sendTelegramPostRequestViaPowerShell(method, body) {
  const telegramUrl = `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "$ProgressPreference='SilentlyContinue'; " +
        "$response = Invoke-RestMethod -Method Post -Uri $env:TG_URL -ContentType 'application/json' -Body $env:TG_BODY; " +
        "$response | ConvertTo-Json -Depth 20",
    ],
    {
      env: {
        ...process.env,
        TG_URL: telegramUrl,
        TG_BODY: body,
      },
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    },
  );

  const parsed = parseJson(stdout, null);

  if (!parsed?.ok) {
    throw new Error(parsed?.description || "Telegram PowerShell fallback failed.");
  }

  return parsed.result;
}

export async function ensureTelegramWebhook() {
  if (!isTelegramConfigured()) {
    return { configured: false, reason: "telegram_not_configured" };
  }

  if (!config.telegramWebhookUrl || !config.telegramWebhookSecret) {
    return { configured: false, reason: "webhook_env_missing" };
  }

  const targetUrl = config.telegramWebhookUrl;
  const webhookInfo = await sendTelegramControlRequest("getWebhookInfo");
  const hasExpectedWebhook =
    webhookInfo?.url === targetUrl &&
    !webhookInfo?.pending_update_count &&
    !webhookInfo?.last_error_message;

  if (hasExpectedWebhook) {
    return {
      configured: true,
      updated: false,
      url: webhookInfo.url,
    };
  }

  await sendTelegramControlRequest("setWebhook", {
    url: targetUrl,
    secret_token: config.telegramWebhookSecret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });

  const confirmedInfo = await sendTelegramControlRequest("getWebhookInfo");

  return {
    configured: true,
    updated: true,
    url: confirmedInfo?.url || targetUrl,
    pendingUpdates: confirmedInfo?.pending_update_count || 0,
    lastErrorMessage: confirmedInfo?.last_error_message || "",
  };
}

export async function configureTelegramPolling() {
  if (!isTelegramConfigured()) {
    return { configured: false, reason: "telegram_not_configured" };
  }

  await sendTelegramControlRequest("deleteWebhook", {
    drop_pending_updates: false,
  });

  return { configured: true };
}

export function startTelegramPolling({ onError } = {}) {
  let isStopped = false;
  let nextOffset = 0;

  async function poll() {
    if (isStopped) {
      return;
    }

    try {
      const updates = await sendTelegramControlRequest("getUpdates", {
        offset: nextOffset,
        timeout: 50,
        allowed_updates: ["message"],
      });

      for (const update of updates || []) {
        nextOffset = Math.max(nextOffset, Number(update.update_id || 0) + 1);
        await handleTelegramWebhookUpdate(update);
      }
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      } else {
        console.error("[telegram] polling failed", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    setImmediate(poll);
  }

  poll();

  return () => {
    isStopped = true;
  };
}

export function getTelegramPublicConfig() {
  return {
    configured: isTelegramConfigured(),
    botUsername: normalizeBotUsername(config.telegramBotUsername),
    authMode: config.telegramAuthMode,
  };
}

export async function createTelegramAuthRequest({
  mode = "signin",
  role = "teacher",
  userAgent = "",
  ipAddress = "",
} = {}) {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram integration is not configured.");
  }

  await cleanupExpiredTelegramAuthRequests();

  const timestamp = nowIso();
  const rawToken = createTelegramAuthToken();
  const id = createId();
  const normalizedMode = mode === "signup" ? "signup" : "signin";
  const normalizedRole = role === "student" ? "student" : "teacher";
  const expiresAt = new Date(Date.now() + TELEGRAM_AUTH_REQUEST_TTL_MS).toISOString();
  const command = `/start auth_${rawToken}`;
  const botUsername = normalizeBotUsername(config.telegramBotUsername);

  await run(
    `
      INSERT INTO telegram_auth_requests (
        id,
        token_hash,
        mode,
        role,
        status,
        created_at,
        expires_at,
        requested_user_agent,
        requested_ip_address
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `,
    [id, hashSecret(rawToken), normalizedMode, normalizedRole, timestamp, expiresAt, userAgent || null, ipAddress || null],
  );

  return {
    id,
    token: rawToken,
    mode: normalizedMode,
    role: normalizedRole,
    expiresAt,
    botUsername,
    command,
    botUrl: `https://t.me/${botUsername}?start=auth_${rawToken}`,
  };
}

export async function getTelegramAuthRequestStatus(rawToken) {
  const record = await getTelegramAuthRequestByCredential(rawToken);

  if (!record) {
    return {
      found: false,
      status: "expired",
      errorCode: "request_not_found",
    };
  }

  return {
    found: true,
    ...mapTelegramAuthRequest(record),
  };
}

export async function finalizeTelegramAuthRequest(rawToken) {
  const record = await getTelegramAuthRequestByCredential(rawToken);

  if (!record) {
    return {
      success: false,
      errorCode: "request_not_found",
    };
  }

  const mapped = mapTelegramAuthRequest(record);

  if (mapped.status === "expired") {
    return {
      success: false,
      errorCode: "request_expired",
    };
  }

  if (mapped.status !== "approved" || !mapped.userId) {
    return {
      success: false,
      errorCode: mapped.errorCode || "request_not_ready",
    };
  }

  await run(
    `
      UPDATE telegram_auth_requests
      SET status = 'completed',
          completed_at = ?
      WHERE id = ?
    `,
    [nowIso(), record.id],
  );

  return {
    success: true,
    userId: mapped.userId,
    mode: mapped.mode,
    role: mapped.role,
  };
}

export function isValidTelegramWebhook(req) {
  if (!config.telegramWebhookSecret) {
    return false;
  }

  return safeTimingCompare(req.get("x-telegram-bot-api-secret-token"), config.telegramWebhookSecret);
}

export async function getTelegramIntegrationStatus(userId) {
  const record = mapConnectionRecord(await getConnectionByUserId(userId));

  return {
    ...getTelegramPublicConfig(),
    connection: record
      ? {
          isLinked: record.isLinked,
          telegramUsername: record.telegramUsername,
          linkedAt: record.linkedAt,
          unlinkedAt: record.unlinkedAt,
          lastInteractionAt: record.lastInteractionAt,
          hasPendingLink: record.hasPendingLink,
          linkExpiresAt: record.linkExpiresAt,
          preferences: record.preferences,
        }
      : {
          isLinked: false,
          telegramUsername: "",
          linkedAt: null,
          unlinkedAt: null,
          lastInteractionAt: null,
          hasPendingLink: false,
          linkExpiresAt: null,
          preferences: {
            notificationsEnabled: true,
            messages: true,
            system: true,
            lessons: true,
            reminders: true,
            reminderOffsetsMinutes: [...DEFAULT_REMINDER_OFFSETS],
          },
        },
  };
}

export async function createTelegramLinkSession(userId) {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram integration is not configured.");
  }

  const record = await getConnectionByUserId(userId);
  const now = new Date();
  const expiresAt = addMinutes(now, config.telegramLinkTtlMinutes).toISOString();
  const linkCode = createLinkCode();
  const linkToken = crypto.randomBytes(24).toString("base64url");

  await run(
    `
      UPDATE telegram_connections
      SET link_code_hash = ?,
          link_token_hash = ?,
          link_requested_at = ?,
          link_expires_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [hashSecret(linkCode), hashSecret(linkToken), now.toISOString(), expiresAt, now.toISOString(), record.id],
  );

  return {
    code: linkCode,
    expiresAt,
    deepLinkUrl: `https://t.me/${normalizeBotUsername(config.telegramBotUsername)}?start=link_${linkToken}`,
  };
}

export async function unlinkTelegramConnection(userId) {
  const record = await getConnectionByUserId(userId);
  const timestamp = nowIso();

  await run(
    `
      UPDATE telegram_connections
      SET telegram_user_id = NULL,
          telegram_username = NULL,
          telegram_chat_id = NULL,
          linked_status = 'unlinked',
          linked_at = NULL,
          unlinked_at = ?,
          last_interaction_at = NULL,
          link_code_hash = NULL,
          link_token_hash = NULL,
          link_requested_at = NULL,
          link_expires_at = NULL,
          updated_at = ?
      WHERE id = ?
    `,
    [timestamp, timestamp, record.id],
  );
}

export async function updateTelegramPreferences(userId, preferences) {
  const record = await getConnectionByUserId(userId);
  const current = mapConnectionRecord(record);
  const nextOffsets = parseReminderOffsets(
    preferences.reminderOffsetsMinutes ?? current.preferences.reminderOffsetsMinutes,
  );
  const nextPreferences = {
    notificationsEnabled:
      preferences.notificationsEnabled ?? current.preferences.notificationsEnabled,
    messages: preferences.messages ?? current.preferences.messages,
    system: preferences.system ?? current.preferences.system,
    lessons: preferences.lessons ?? current.preferences.lessons,
    reminders: preferences.reminders ?? current.preferences.reminders,
  };
  const timestamp = nowIso();

  await run(
    `
      UPDATE telegram_connections
      SET notifications_enabled = ?,
          notify_messages = ?,
          notify_system = ?,
          notify_lessons = ?,
          notify_reminders = ?,
          reminder_offsets_json = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      toIntegerBoolean(nextPreferences.notificationsEnabled, 1),
      toIntegerBoolean(nextPreferences.messages, 1),
      toIntegerBoolean(nextPreferences.system, 1),
      toIntegerBoolean(nextPreferences.lessons, 1),
      toIntegerBoolean(nextPreferences.reminders, 1),
      JSON.stringify(nextOffsets),
      timestamp,
      record.id,
    ],
  );

  return getTelegramIntegrationStatus(userId);
}

export async function deliverAppNotificationToTelegram(userId, notification) {
  const record = mapConnectionRecord(await getConnectionByUserId(userId));
  const category = getNotificationCategory(notification.type);

  return deliverToConnection(record, {
    category,
    text: buildNotificationText(notification),
    dedupeKey: `app-notification:${notification.id}`,
    payload: notification,
  });
}

export async function sendTelegramLessonNotification(userId, entry, options = {}) {
  const record = mapConnectionRecord(await getConnectionByUserId(userId));
  const prefix = options.prefix ? `${options.prefix}\n\n` : "";

  return deliverToConnection(record, {
    category: options.category || "lessons",
    text: `${prefix}${formatLessonDetails(entry)}`,
    dedupeKey: options.dedupeKey || null,
    payload: {
      type: options.type || "lesson",
      entryId: entry.id,
      sharedEventId: entry.shared_event_id || null,
    },
  });
}

export async function dispatchDueTelegramLessonReminders() {
  if (!isTelegramConfigured()) {
    return { scanned: 0, delivered: 0 };
  }

  const rows = await all(
    `
      SELECT
        tc.id AS connection_id,
        tc.user_id AS connection_user_id,
        tc.telegram_chat_id,
        tc.telegram_username,
        tc.telegram_user_id,
        tc.linked_status,
        tc.notifications_enabled,
        tc.notify_messages,
        tc.notify_system,
        tc.notify_lessons,
        tc.notify_reminders,
        tc.reminder_offsets_json,
        tc.linked_at,
        tc.unlinked_at,
        tc.last_interaction_at,
        u.full_name AS user_full_name,
        u.role AS user_role,
        e.id,
        e.user_id,
        e.partner_id,
        e.shared_event_id,
        e.title,
        e.details,
        e.lesson_link,
        e.date,
        e.start_hour,
        e.end_hour,
        e.status,
        partner.full_name AS partner_name,
        partner.role AS partner_role
      FROM telegram_connections tc
      INNER JOIN users u ON u.id = tc.user_id
      INNER JOIN schedule_entries e ON e.user_id = tc.user_id
      LEFT JOIN users partner ON partner.id = e.partner_id
      WHERE tc.linked_status = 'linked'
        AND tc.notifications_enabled = 1
        AND tc.notify_lessons = 1
        AND tc.notify_reminders = 1
        AND e.date >= ?
      ORDER BY e.date ASC, e.start_hour ASC
    `,
    [new Date().toISOString().slice(0, 10)],
  );

  const now = Date.now();
  let delivered = 0;

  for (const row of rows) {
    const connection = mapConnectionRecord({
      id: row.connection_id,
      user_id: row.connection_user_id,
      telegram_user_id: row.telegram_user_id,
      telegram_username: row.telegram_username,
      telegram_chat_id: row.telegram_chat_id,
      linked_status: row.linked_status,
      notifications_enabled: row.notifications_enabled,
      notify_messages: row.notify_messages,
      notify_system: row.notify_system,
      notify_lessons: row.notify_lessons,
      notify_reminders: row.notify_reminders,
      reminder_offsets_json: row.reminder_offsets_json,
      linked_at: row.linked_at,
      unlinked_at: row.unlinked_at,
      last_interaction_at: row.last_interaction_at,
      user_full_name: row.user_full_name,
      user_role: row.user_role,
    });
    const entryStart = getEntryStartDate(row).getTime();

    if (entryStart <= now) {
      continue;
    }

    for (const offsetMinutes of connection.preferences.reminderOffsetsMinutes) {
      const reminderAt = entryStart - offsetMinutes * 60 * 1000;

      if (now < reminderAt || now > reminderAt + REMINDER_GRACE_MS) {
        continue;
      }

      const result = await deliverToConnection(connection, {
        category: "reminders",
        text: `Lesson reminder: ${formatReminderLeadTime(offsetMinutes)}\n\n${formatLessonDetails(row)}`,
        dedupeKey: `lesson-reminder:${row.user_id}:${row.id}:${offsetMinutes}`,
        payload: {
          entryId: row.id,
          offsetMinutes,
        },
      });

      if (result.delivered) {
        delivered += 1;
      }
    }
  }

  return { scanned: rows.length, delivered };
}

async function registerTelegramUserAccount({
  telegramUserId,
  telegramChatId,
  telegramUsername,
  firstName,
  lastName,
  role,
}) {
  const existingLinkedRecord = await get(
    `
      SELECT tc.user_id, u.full_name
      FROM telegram_connections tc
      INNER JOIN users u ON u.id = tc.user_id
      WHERE tc.linked_status = 'linked'
        AND (tc.telegram_user_id = ? OR tc.telegram_chat_id = ?)
      LIMIT 1
    `,
    [telegramUserId, telegramChatId],
  );

  if (existingLinkedRecord) {
    return {
      success: true,
      alreadyRegistered: true,
      userId: existingLinkedRecord.user_id,
      fullName: existingLinkedRecord.full_name,
    };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const usernameLabel = telegramUsername ? `@${telegramUsername}` : "";
  const user = await upsertSocialUser({
    provider: "telegram",
    providerUserId: telegramUserId,
    email: `${telegramUserId}@telegram.local`,
    fullName: fullName || usernameLabel || `Telegram ${telegramUserId}`,
    role,
  });
  const timestamp = nowIso();
  const record = await getConnectionByUserId(user.id);

  await run(
    `
      UPDATE telegram_connections
      SET telegram_user_id = ?,
          telegram_username = ?,
          telegram_chat_id = ?,
          linked_status = 'linked',
          linked_at = COALESCE(linked_at, ?),
          unlinked_at = NULL,
          last_interaction_at = ?,
          link_code_hash = NULL,
          link_token_hash = NULL,
          link_requested_at = NULL,
          link_expires_at = NULL,
          updated_at = ?
      WHERE id = ?
    `,
    [
      telegramUserId,
      telegramUsername || null,
      telegramChatId,
      timestamp,
      timestamp,
      timestamp,
      record.id,
    ],
  );

  return {
    success: true,
    alreadyRegistered: false,
    userId: user.id,
    fullName: user.full_name,
    role: user.role,
  };
}

async function approveTelegramAuthRequest({
  credential,
  telegramUserId,
  telegramChatId,
  telegramUsername,
  firstName,
  lastName,
}) {
  const record = await getTelegramAuthRequestByCredential(credential);

  if (!record) {
    return {
      success: false,
      message: "Запрос на вход истек или не найден. Вернитесь на сайт и начните вход заново.",
    };
  }

  const mapped = mapTelegramAuthRequest(record);

  if (mapped.status === "expired") {
    return {
      success: false,
      message: "Запрос на вход истек. Вернитесь на сайт и начните вход заново.",
    };
  }

  if (mapped.status === "completed") {
    return {
      success: true,
      userId: mapped.userId,
      alreadyCompleted: true,
      message: "Вход уже подтвержден. Вернитесь в браузер с сайтом.",
    };
  }

  let resolvedUserId = record.user_id || "";
  let responseMessage = "Вход подтвержден. Вернитесь в браузер с сайтом.";

  if (record.mode === "signup") {
    const registration = await registerTelegramUserAccount({
      telegramUserId,
      telegramChatId,
      telegramUsername,
      firstName,
      lastName,
      role: record.role,
    });
    resolvedUserId = registration.userId;
    responseMessage = registration.alreadyRegistered
      ? "Телеграм уже привязан. Вход подтвержден, вернитесь в браузер с сайтом."
      : "Аккаунт создан и вход подтвержден. Вернитесь в браузер с сайтом.";
  } else {
    const connection = await getConnectionByTelegramIdentity({ telegramUserId, telegramChatId });

    if (!connection?.user_id) {
      return {
        success: false,
        message:
          "Этот Telegram еще не привязан к аккаунту Repetly. Сначала привяжите его в настройках или используйте регистрацию через Telegram.",
      };
    }

    resolvedUserId = connection.user_id;
  }

  await run(
    `
      UPDATE telegram_auth_requests
      SET user_id = ?,
          status = 'approved',
          approved_at = ?,
          telegram_user_id = ?,
          telegram_chat_id = ?,
          telegram_username = ?,
          error_code = NULL
      WHERE id = ?
    `,
    [resolvedUserId, nowIso(), telegramUserId || null, telegramChatId || null, telegramUsername || null, record.id],
  );

  return {
    success: true,
    userId: resolvedUserId,
    message: responseMessage,
  };
}

export async function handleTelegramWebhookUpdate(update) {
  const message = update?.message;

  if (!message || message.chat?.type !== "private" || typeof message.text !== "string") {
    return { processed: false };
  }

  const text = message.text.trim();
  const telegramUserId = String(message.from?.id || "");
  const telegramChatId = String(message.chat?.id || "");
  const telegramUsername = message.from?.username || "";
  const firstName = message.from?.first_name || "";
  const lastName = message.from?.last_name || "";
  const linkedConnection = await touchTelegramIdentity({
    telegramUserId,
    telegramChatId,
    telegramUsername,
  });

  const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);

  if (startMatch) {
    const payload = String(startMatch[1] || "").trim();

    if (payload.startsWith("auth_")) {
      const authResult = await approveTelegramAuthRequest({
        credential: payload.slice(5),
        telegramUserId,
        telegramChatId,
        telegramUsername,
        firstName,
        lastName,
      });

      await sendTelegramText(telegramChatId, authResult.message);
      return { processed: true };
    }

    if (payload.startsWith("link_")) {
      const linkResult = await completeTelegramLink({
        credential: payload.slice(5),
        telegramUserId,
        telegramChatId,
        telegramUsername,
      });

      if (!linkResult.success) {
        await sendTelegramText(telegramChatId, linkResult.message);
        return { processed: true };
      }

      const upcomingLessons = await listUpcomingLessons(linkResult.userId, 1);
      const welcomeText = upcomingLessons.length
        ? `Account linked successfully.\n\n${formatLessonDetails(upcomingLessons[0])}`
        : "Account linked successfully. You will now receive messages, notifications, and lesson reminders here.";
      await sendTelegramText(telegramChatId, welcomeText);
      return { processed: true };
    }

    if (payload === "register_teacher" || payload === "register_student") {
      const role = payload === "register_student" ? "student" : "teacher";
      const registration = await registerTelegramUserAccount({
        telegramUserId,
        telegramChatId,
        telegramUsername,
        firstName,
        lastName,
        role,
      });

      await sendTelegramText(
        telegramChatId,
        registration.alreadyRegistered
          ? `This Telegram is already linked to ${registration.fullName}.`
          : `Account created and linked successfully.\n\nRole: ${role}\nName: ${registration.fullName}\n\nYou can now use this Telegram for notifications and sign in to the website via Telegram.`,
      );
      return { processed: true };
    }

    if (linkedConnection?.isLinked) {
      await sendTelegramText(telegramChatId, buildBotHelpText(true));
      return { processed: true };
    }

    await sendTelegramText(telegramChatId, buildLinkPromptText());
    return { processed: true };
  }

  if (/^\/link(?:@\w+)?$/i.test(text)) {
    await sendTelegramText(telegramChatId, buildLinkPromptText());
    return { processed: true };
  }

  if (/^\/register_teacher(?:@\w+)?$/i.test(text) || /^\/register_student(?:@\w+)?$/i.test(text)) {
    const role = /student/i.test(text) ? "student" : "teacher";
    const registration = await registerTelegramUserAccount({
      telegramUserId,
      telegramChatId,
      telegramUsername,
      firstName,
      lastName,
      role,
    });

    await sendTelegramText(
      telegramChatId,
      registration.alreadyRegistered
        ? `This Telegram is already linked to ${registration.fullName}.`
        : `Account created and linked successfully.\n\nRole: ${role}\nName: ${registration.fullName}\n\nUse "Sign in with Telegram" on the website if you need browser access.`,
    );
    return { processed: true };
  }

  if (/^\/nextlesson(?:@\w+)?$/i.test(text)) {
    if (!linkedConnection?.isLinked) {
      await sendTelegramText(telegramChatId, buildLinkPromptText());
      return { processed: true };
    }

    const entries = await listUpcomingLessons(linkedConnection.userId, 1);
    await sendTelegramText(
      telegramChatId,
      entries.length ? formatLessonDetails(entries[0]) : "No upcoming lessons are scheduled yet.",
    );
    return { processed: true };
  }

  if (/^\/schedule(?:@\w+)?$/i.test(text)) {
    if (!linkedConnection?.isLinked) {
      await sendTelegramText(telegramChatId, buildLinkPromptText());
      return { processed: true };
    }

    const entries = await listUpcomingLessons(linkedConnection.userId, 5);
    await sendTelegramText(telegramChatId, buildScheduleSummaryText(entries));
    return { processed: true };
  }

  if (/^\/notifications(?:@\w+)?$/i.test(text)) {
    if (!linkedConnection?.isLinked) {
      await sendTelegramText(telegramChatId, buildLinkPromptText());
      return { processed: true };
    }

    const settings = linkedConnection.preferences;
    await sendTelegramText(
      telegramChatId,
      [
        "Telegram notification settings",
        `All notifications: ${settings.notificationsEnabled ? "on" : "off"}`,
        `Incoming messages: ${settings.messages ? "on" : "off"}`,
        `System notifications: ${settings.system ? "on" : "off"}`,
        `Lesson updates: ${settings.lessons ? "on" : "off"}`,
        `Lesson reminders: ${settings.reminders ? "on" : "off"}`,
        `Reminder offsets: ${settings.reminderOffsetsMinutes.join(", ")} minutes`,
      ].join("\n"),
    );
    return { processed: true };
  }

  const normalizedCode = text.toUpperCase();

  if (/^[A-Z2-9]{8}$/.test(normalizedCode)) {
    const linkResult = await completeTelegramLink({
      credential: normalizedCode,
      telegramUserId,
      telegramChatId,
      telegramUsername,
    });

    await sendTelegramText(
      telegramChatId,
      linkResult.success ? "Account linked successfully." : linkResult.message,
    );
    return { processed: true };
  }

  if (!linkedConnection?.isLinked) {
    await sendTelegramText(telegramChatId, buildLinkPromptText());
    return { processed: true };
  }

  await sendTelegramText(telegramChatId, buildBotHelpText(true));

  return { processed: true };
}

export async function completeTelegramLink({
  credential,
  telegramUserId,
  telegramChatId,
  telegramUsername,
}) {
  const record = await findPendingLinkRecord(credential);

  if (!record) {
    return {
      success: false,
      message: "The linking code is invalid or expired. Generate a new link from your website settings and try again.",
    };
  }

  const alreadyLinked = await get(
    `
      SELECT user_id
      FROM telegram_connections
      WHERE linked_status = 'linked'
        AND user_id != ?
        AND (telegram_user_id = ? OR telegram_chat_id = ?)
      LIMIT 1
    `,
    [record.user_id, telegramUserId, telegramChatId],
  );

  if (alreadyLinked) {
    return {
      success: false,
      message: "This Telegram account is already linked to another Repetly profile.",
    };
  }

  const timestamp = nowIso();

  await run(
    `
      UPDATE telegram_connections
      SET telegram_user_id = ?,
          telegram_username = ?,
          telegram_chat_id = ?,
          linked_status = 'linked',
          linked_at = ?,
          unlinked_at = NULL,
          last_interaction_at = ?,
          link_code_hash = NULL,
          link_token_hash = NULL,
          link_requested_at = NULL,
          link_expires_at = NULL,
          updated_at = ?
      WHERE id = ?
    `,
    [telegramUserId, telegramUsername || null, telegramChatId, timestamp, timestamp, timestamp, record.id],
  );

  return {
    success: true,
    userId: record.user_id,
    userFullName: record.user_full_name,
  };
}

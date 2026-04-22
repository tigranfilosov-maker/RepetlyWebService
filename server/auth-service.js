import crypto from "node:crypto";
import { all, get, run } from "./db.js";

const SESSION_COOKIE_NAME = "repetly_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;

function nowIso() {
  return new Date().toISOString();
}

function futureIso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizeNullableText(value) {
  const normalized = (value || "").trim();
  return normalized ? normalized : null;
}

function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function validatePasswordStrength(password) {
  if (password.length < 8) {
    return "Пароль должен содержать минимум 8 символов.";
  }

  if (!/[A-ZА-Я]/.test(password) || !/[a-zа-я]/.test(password) || !/\d/.test(password)) {
    return "Пароль должен содержать заглавную букву, строчную букву и цифру.";
  }

  return "";
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, originalKey] = storedHash.split(":");

  if (!salt || !originalKey) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(originalKey, "hex"));
}

export function roleToLabel(role) {
  const labels = {
    teacher: "Преподаватель",
    student: "Ученик",
    admin: "Администратор",
    manager: "Менеджер",
  };

  return labels[role] || role;
}

export function mapUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    avatar: row.avatar_url,
    subject: row.subject,
    role: row.role,
    roleLabel: roleToLabel(row.role),
    status: row.status,
    subscriptionPlan: row.subscription_plan || "free",
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function listTeacherSubjects(userId) {
  const rows = await all(
    `
      SELECT id, name, sort_order
      FROM teacher_subjects
      WHERE teacher_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  }));
}

export async function buildUserPayload(row) {
  const baseUser = mapUser(row);

  if (baseUser.role !== "teacher") {
    return {
      ...baseUser,
      subjects: [],
    };
  }

  const subjects = await listTeacherSubjects(baseUser.id);

  return {
    ...baseUser,
    subject: subjects[0]?.name || baseUser.subject || "",
    subjects,
  };
}

export async function getUserByEmail(email) {
  return get(`SELECT * FROM users WHERE email = ?`, [normalizeEmail(email)]);
}

export async function getUserById(userId) {
  return get(`SELECT * FROM users WHERE id = ?`, [userId]);
}

export async function createUser({
  fullName,
  email,
  phoneNumber = "",
  avatarUrl = "",
  role = "teacher",
  status = "active",
}) {
  const id = createId();
  const timestamp = nowIso();

  await run(
    `
      INSERT INTO users (
        id, full_name, email, phone_number, avatar_url, role, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      fullName.trim(),
      normalizeEmail(email),
      phoneNumber.trim() || null,
      avatarUrl || null,
      role,
      status,
      timestamp,
      timestamp,
    ],
  );

  return getUserById(id);
}

export async function createIdentity({
  userId,
  provider,
  providerUserId,
  providerEmail = "",
  passwordHash = null,
}) {
  const timestamp = nowIso();

  await run(
    `
      INSERT INTO auth_identities (
        id, user_id, provider, provider_user_id, provider_email, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      createId(),
      userId,
      provider,
      providerUserId,
      providerEmail || null,
      passwordHash,
      timestamp,
      timestamp,
    ],
  );
}

export async function updatePasswordIdentity(userId, email, passwordHash) {
  const timestamp = nowIso();
  const existing = await get(
    `
      SELECT * FROM auth_identities
      WHERE user_id = ? AND provider = 'password'
    `,
    [userId],
  );

  if (existing) {
    await run(
      `
        UPDATE auth_identities
        SET provider_email = ?, password_hash = ?, updated_at = ?
        WHERE id = ?
      `,
      [normalizeEmail(email), passwordHash, timestamp, existing.id],
    );
    return;
  }

  await createIdentity({
    userId,
    provider: "password",
    providerUserId: normalizeEmail(email),
    providerEmail: email,
    passwordHash,
  });
}

export async function findPasswordIdentityByEmail(email) {
  return get(
    `
      SELECT ai.*, u.*
      FROM auth_identities ai
      INNER JOIN users u ON u.id = ai.user_id
      WHERE ai.provider = 'password' AND ai.provider_user_id = ?
    `,
    [normalizeEmail(email)],
  );
}

export async function findIdentity(provider, providerUserId) {
  return get(
    `
      SELECT ai.*, u.*
      FROM auth_identities ai
      INNER JOIN users u ON u.id = ai.user_id
      WHERE ai.provider = ? AND ai.provider_user_id = ?
    `,
    [provider, providerUserId],
  );
}

export async function createSessionForUser(userId, metadata = {}) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const timestamp = nowIso();

  await run(
    `
      INSERT INTO sessions (
        id, user_id, token_hash, created_at, expires_at, last_accessed_at, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      createId(),
      userId,
      hashSecret(rawToken),
      timestamp,
      futureIso(SESSION_TTL_MS),
      timestamp,
      metadata.userAgent || null,
      metadata.ipAddress || null,
    ],
  );

  await run(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [
    timestamp,
    timestamp,
    userId,
  ]);

  return rawToken;
}

export async function getSessionUser(rawToken) {
  if (!rawToken) {
    return null;
  }

  const record = await get(
    `
      SELECT s.id as session_id, s.expires_at, u.*
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `,
    [hashSecret(rawToken)],
  );

  if (!record) {
    return null;
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await run(`DELETE FROM sessions WHERE id = ?`, [record.session_id]);
    return null;
  }

  await run(`UPDATE sessions SET last_accessed_at = ? WHERE id = ?`, [
    nowIso(),
    record.session_id,
  ]);

  return buildUserPayload(record);
}

export async function revokeSession(rawToken) {
  if (!rawToken) {
    return;
  }

  await run(`DELETE FROM sessions WHERE token_hash = ?`, [hashSecret(rawToken)]);
}

export async function revokeAllSessionsForUser(userId) {
  await run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}

export function applySessionCookie(res, rawToken, isProduction) {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export function getSessionTokenFromRequest(req) {
  return req.cookies?.[SESSION_COOKIE_NAME] || "";
}

export async function createPasswordResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("base64url");

  await run(
    `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [createId(), userId, hashSecret(rawToken), nowIso(), futureIso(RESET_TOKEN_TTL_MS)],
  );

  return rawToken;
}

export async function consumePasswordResetToken(rawToken) {
  const tokenHash = hashSecret(rawToken);
  const record = await get(
    `
      SELECT * FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL
    `,
    [tokenHash],
  );

  if (!record) {
    return null;
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return null;
  }

  await run(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`, [
    nowIso(),
    record.id,
  ]);

  return record;
}

export async function cleanupExpiredArtifacts() {
  const timestamp = nowIso();
  await run(`DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL`, [timestamp]);
  await run(`DELETE FROM sessions WHERE expires_at <= ?`, [timestamp]);
  await run(`DELETE FROM oauth_states WHERE expires_at <= ?`, [timestamp]);
}

export async function createOauthState(provider) {
  const rawState = crypto.randomBytes(24).toString("base64url");
  await run(
    `
      INSERT INTO oauth_states (id, provider, state_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [createId(), provider, hashSecret(rawState), nowIso(), futureIso(OAUTH_STATE_TTL_MS)],
  );
  return rawState;
}

export async function consumeOauthState(provider, rawState) {
  const record = await get(
    `
      SELECT * FROM oauth_states
      WHERE provider = ? AND state_hash = ?
    `,
    [provider, hashSecret(rawState)],
  );

  if (!record) {
    return false;
  }

  await run(`DELETE FROM oauth_states WHERE id = ?`, [record.id]);

  return new Date(record.expires_at).getTime() > Date.now();
}

export async function upsertSocialUser({
  provider,
  providerUserId,
  email,
  fullName,
  avatarUrl = "",
  role = "teacher",
}) {
  const normalizedEmail = normalizeEmail(email);
  const existingIdentity = await findIdentity(provider, providerUserId);

  if (existingIdentity) {
    const timestamp = nowIso();
    await run(
      `
        UPDATE users
        SET full_name = ?, email = ?, avatar_url = ?, updated_at = ?
        WHERE id = ?
      `,
      [fullName, normalizedEmail, avatarUrl || null, timestamp, existingIdentity.user_id],
    );
    return getUserById(existingIdentity.user_id);
  }

  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    user = await createUser({
      fullName,
      email: normalizedEmail,
      avatarUrl,
      role,
    });
  }

  await createIdentity({
    userId: user.id,
    provider,
    providerUserId,
    providerEmail: normalizedEmail,
  });

  return getUserById(user.id);
}

export async function listConfiguredProviders(config) {
  return {
    google: Boolean(config.googleClientId && config.googleClientSecret),
    vk: Boolean(config.vkClientId && config.vkClientSecret),
    telegram: Boolean(config.telegramBotToken && config.telegramBotUsername),
    telegramBotUsername: config.telegramBotUsername,
  };
}

export async function listUsers() {
  return all(`SELECT * FROM users ORDER BY created_at DESC`);
}

export async function updateUserProfile(userId, updates) {
  const existingUser = await getUserById(userId);

  if (!existingUser) {
    return null;
  }

  const timestamp = nowIso();
  const nextEmail = normalizeEmail(updates.email ?? existingUser.email);

  await run(
    `
      UPDATE users
      SET full_name = ?, email = ?, phone_number = ?, avatar_url = ?, subject = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.fullName?.trim() || existingUser.full_name,
      nextEmail,
      normalizeNullableText(updates.phoneNumber),
      normalizeNullableText(updates.avatar),
      normalizeNullableText(updates.subject || updates.subjects?.[0]?.name || ""),
      timestamp,
      userId,
    ],
  );

  if (Array.isArray(updates.subjects)) {
    const subjectNames = updates.subjects
      .map((item) => (typeof item === "string" ? item : item?.name || ""))
      .map((item) => item.trim())
      .filter(Boolean);

    await run(`DELETE FROM teacher_subjects WHERE teacher_id = ?`, [userId]);

    for (const [index, subjectName] of subjectNames.entries()) {
      await run(
        `
          INSERT INTO teacher_subjects (id, teacher_id, name, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        [createId(), userId, subjectName, index, timestamp],
      );
    }
  }

  await run(
    `
      UPDATE auth_identities
      SET provider_email = ?, updated_at = ?
      WHERE user_id = ?
    `,
    [nextEmail, timestamp, userId],
  );

  await run(
    `
      UPDATE auth_identities
      SET provider_user_id = ?, updated_at = ?
      WHERE user_id = ? AND provider = 'password'
    `,
    [nextEmail, timestamp, userId],
  );

  return getUserById(userId);
}

export async function ensureDefaultAdminAccount({ adminEmail, adminPassword, adminFullName }) {
  const timestamp = nowIso();
  let adminUser = await getUserByEmail(adminEmail);

  if (!adminUser) {
    adminUser = await createUser({
      fullName: adminFullName,
      email: adminEmail,
      role: "admin",
      status: "active",
    });
  }

  await run(
    `
      UPDATE users
      SET full_name = ?, role = 'admin', status = 'active', subscription_plan = 'enterprise', plan_started_at = COALESCE(plan_started_at, ?), updated_at = ?
      WHERE id = ?
    `,
    [adminFullName, timestamp, timestamp, adminUser.id],
  );

  await updatePasswordIdentity(adminUser.id, adminEmail, hashPassword(adminPassword));

  return getUserById(adminUser.id);
}

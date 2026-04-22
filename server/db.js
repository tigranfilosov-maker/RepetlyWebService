import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";

const workspaceDataPath = path.join(process.cwd(), "data");

if (!fs.existsSync(workspaceDataPath)) {
  fs.mkdirSync(workspaceDataPath, { recursive: true });
}

const databasePath = path.join(workspaceDataPath, "repetly.sqlite");
sqlite3.verbose();

const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function ensureColumn(tableName, columnName, sqlDefinition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${sqlDefinition}`);
  }
}

export async function initializeDatabase() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone_number TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'teacher',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      email_verified_at TEXT
    )
  `);

  await ensureColumn("users", "subject", "subject TEXT");
  await ensureColumn("users", "subscription_plan", "subscription_plan TEXT NOT NULL DEFAULT 'free'");
  await ensureColumn("users", "plan_started_at", "plan_started_at TEXT");
  await run(`UPDATE users SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR TRIM(subscription_plan) = ''`);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_email TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_user_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      state_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS teacher_student_requests (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      responded_at TEXT,
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS teacher_student_relationships (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(teacher_id, student_id),
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS teacher_subjects (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(teacher_id, name),
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS relationship_subjects (
      relationship_id TEXT NOT NULL,
      teacher_subject_id TEXT NOT NULL,
      PRIMARY KEY (relationship_id, teacher_subject_id),
      FOREIGN KEY(relationship_id) REFERENCES teacher_student_relationships(id) ON DELETE CASCADE,
      FOREIGN KEY(teacher_subject_id) REFERENCES teacher_subjects(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS app_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      meta_json TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      theme_preference TEXT NOT NULL DEFAULT 'system',
      notification_preference TEXT NOT NULL DEFAULT 'all',
      privacy_mode TEXT NOT NULL DEFAULT 'standard',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL DEFAULT 'Repetly',
      brand_avatar_url TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  await run(
    `
      INSERT OR IGNORE INTO site_settings (id, brand_name, brand_avatar_url, updated_at)
      VALUES ('global', 'Repetly', NULL, datetime('now'))
    `,
  );

  await run(`
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_id TEXT,
      shared_event_id TEXT,
      title TEXT NOT NULL,
      details TEXT,
      lesson_link TEXT,
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(partner_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await ensureColumn("schedule_entries", "shared_event_id", "shared_event_id TEXT");
  await ensureColumn("schedule_entries", "lesson_link", "lesson_link TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS telegram_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      telegram_user_id TEXT,
      telegram_username TEXT,
      telegram_chat_id TEXT,
      link_code_hash TEXT,
      link_token_hash TEXT,
      link_requested_at TEXT,
      link_expires_at TEXT,
      linked_status TEXT NOT NULL DEFAULT 'unlinked',
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      notify_messages INTEGER NOT NULL DEFAULT 1,
      notify_system INTEGER NOT NULL DEFAULT 1,
      notify_lessons INTEGER NOT NULL DEFAULT 1,
      notify_reminders INTEGER NOT NULL DEFAULT 1,
      reminder_offsets_json TEXT NOT NULL DEFAULT '[1440,60,15]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      linked_at TEXT,
      unlinked_at TEXT,
      last_interaction_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS telegram_delivery_logs (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      telegram_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      FOREIGN KEY(connection_id) REFERENCES telegram_connections(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS telegram_auth_requests (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      role TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_code TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      completed_at TEXT,
      telegram_user_id TEXT,
      telegram_chat_id TEXT,
      telegram_username TEXT,
      requested_user_agent TEXT,
      requested_ip_address TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      student_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      content_json TEXT NOT NULL DEFAULT '{"elements":[],"viewport":{"x":0,"y":0,"zoom":1}}',
      preview_text TEXT,
      lesson_session_id TEXT,
      telemost_room_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT,
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_conversation_members_user
    ON conversation_members (user_id)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_date
    ON schedule_entries (user_id, date)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_schedule_entries_shared_event
    ON schedule_entries (shared_event_id)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
    ON app_notifications (user_id, created_at DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher
    ON teacher_subjects (teacher_id, sort_order, name)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_relationship_subjects_relationship
    ON relationship_subjects (relationship_id)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_boards_teacher_updated
    ON boards (teacher_id, updated_at DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_boards_student
    ON boards (student_id)
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_connections_active_telegram_user
    ON telegram_connections (telegram_user_id)
    WHERE linked_status = 'linked' AND telegram_user_id IS NOT NULL
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_connections_active_chat
    ON telegram_connections (telegram_chat_id)
    WHERE linked_status = 'linked' AND telegram_chat_id IS NOT NULL
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_telegram_delivery_logs_connection
    ON telegram_delivery_logs (connection_id, created_at DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_telegram_auth_requests_status_expires
    ON telegram_auth_requests (status, expires_at)
  `);
}

export { all, db, get, run };

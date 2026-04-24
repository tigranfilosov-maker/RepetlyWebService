import crypto from "node:crypto";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { config } from "./config.js";
import { all, get, initializeDatabase, run } from "./db.js";
import {
  applySessionCookie,
  buildUserPayload,
  cleanupExpiredArtifacts,
  clearSessionCookie,
  consumeOauthState,
  consumePasswordResetToken,
  createOauthState,
  createPasswordResetToken,
  createSessionForUser,
  createUser,
  ensureUniqueUsername,
  ensureDefaultAdminAccount,
  findPasswordIdentityByEmail,
  getSessionTokenFromRequest,
  getSessionUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  hashPassword,
  listConfiguredProviders,
  listTeacherSubjects,
  mapUser,
  normalizeUsername,
  revokeAllSessionsForUser,
  revokeSession,
  updateUserProfile,
  updatePasswordIdentity,
  upsertSocialUser,
  validatePasswordStrength,
  verifyPassword,
} from "./auth-service.js";
import {
  configureTelegramPolling,
  createTelegramAuthRequest,
  createTelegramLinkSession,
  deliverAppNotificationToTelegram,
  dispatchDueTelegramLessonReminders,
  ensureTelegramWebhook,
  finalizeTelegramAuthRequest,
  getTelegramAuthRequestStatus,
  getTelegramIntegrationStatus,
  handleTelegramWebhookUpdate,
  isTelegramConfigured,
  isValidTelegramWebhook,
  startTelegramPolling,
  unlinkTelegramConnection,
  updateTelegramPreferences,
} from "./telegram-service.js";

const app = express();
const TELEGRAM_AUTH_CONTEXT_COOKIE = "telegram_auth_context";

dns.setDefaultResultOrder("ipv4first");

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser(config.sessionSecret));

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Введите полное имя."),
  username: z.string().trim().min(3, "Укажите никнейм минимум из 3 символов."),
  email: z.string().trim().email("Введите корректный email."),
  phoneNumber: z.string().trim().optional().default(""),
  role: z.enum(["teacher", "student"]),
  password: z.string().min(1, "Введите пароль."),
  confirmPassword: z.string().min(1, "Подтвердите пароль."),
});

const loginSchema = z.object({
  email: z.string().trim().email("Введите корректный email."),
  password: z.string().min(1, "Введите пароль."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Введите корректный email."),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, "Некорректный токен."),
  password: z.string().min(1, "Введите пароль."),
  confirmPassword: z.string().min(1, "Подтвердите пароль."),
});

const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите полное имя."),
  email: z.string().trim().email("Укажите корректный email."),
  username: z.string().trim().min(3, "Укажите никнейм минимум из 3 символов.").optional().default(""),
  phoneNumber: z.string().trim().max(40, "Укажите телефон короче.").optional().default(""),
  avatar: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\//.test(value) ||
        /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value),
      "Укажите корректный URL аватара или data:image.",
    ),
  subject: z.string().trim().max(120, "Укажите предмет короче.").optional().default(""),
  subjects: z.array(z.string().trim().min(1).max(120)).optional().default([]),
});

const studentInviteSchema = z.object({
  studentUsername: z.string().trim().min(3, "Укажите username ученика."),
});

const relationshipSubjectsSchema = z.object({
  subjectIds: z.array(z.string().trim().min(1)).default([]),
});

const homeworkAssignmentSchema = z.object({
  studentId: z.string().trim().optional().default(""),
  title: z.string().trim().min(2, "Homework title is required.").max(160),
  description: z.string().trim().min(2, "Homework description is required.").max(2000),
  dueDate: z.string().trim().optional().default(""),
});

const groupSchema = z.object({
  name: z.string().trim().min(2, "Group name is required.").max(120),
  description: z.string().trim().max(300).optional().default(""),
  studentIds: z.array(z.string().trim().min(1)).min(1, "Select at least one student.").default([]),
});

const groupHomeworkSchema = z.object({
  title: z.string().trim().min(2, "Homework title is required.").max(160),
  description: z.string().trim().min(2, "Homework description is required.").max(2000),
  dueDate: z.string().trim().optional().default(""),
});

const boardCreateSchema = z.object({
  title: z.string().trim().min(2).max(140).optional().default("New board"),
  description: z.string().trim().max(280).optional().default(""),
  studentId: z.union([z.string().trim().min(1), z.null()]).optional().default(null),
});

const boardUpdateSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(280).optional(),
  studentId: z.union([z.string().trim().min(1), z.null()]).optional(),
  lessonSessionId: z.union([z.string().trim().min(1), z.null()]).optional(),
  telemostRoomId: z.union([z.string().trim().min(1), z.null()]).optional(),
});

const boardContentSchema = z.object({
  content: z.unknown(),
});

const DEFAULT_BOARD_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 });

const conversationCreateSchema = z.object({
  participantId: z.string().trim().min(1, "Participant is required."),
});

const messageCreateSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

const scheduleEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD."),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    title: z.string().trim().min(2, "Title is required.").max(120),
    details: z.string().trim().max(500).optional().default(""),
    lessonLink: z
      .string()
      .trim()
      .refine((value) => value === "" || /^https?:\/\//i.test(value), "Lesson link must be a valid URL.")
      .optional()
      .default(""),
    participantId: z.string().trim().optional().default(""),
    status: z.enum(["planned", "confirmed", "completed"]).optional().default("planned"),
  })
  .refine((payload) => payload.endHour > payload.startHour, {
    message: "End time must be after start time.",
    path: ["endHour"],
  });

const settingsPreferencesSchema = z.object({
  themePreference: z.enum(["system", "light", "dark"]).default("system"),
  notificationPreference: z.enum(["all", "important", "muted"]).default("all"),
  privacyMode: z.enum(["standard", "private"]).default("standard"),
});

const settingsEmailSchema = z.object({
  email: z.string().trim().email("??????? ?????????? email."),
});

const settingsPasswordSchema = z.object({
  currentPassword: z.string().min(1, "??????? ??????? ??????."),
  newPassword: z.string().min(1, "??????? ????? ??????."),
  confirmPassword: z.string().min(1, "??????????? ????? ??????."),
});

const telegramPreferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  messages: z.boolean().optional(),
  system: z.boolean().optional(),
  lessons: z.boolean().optional(),
  reminders: z.boolean().optional(),
  reminderOffsetsMinutes: z.array(z.number().int().min(1).max(60 * 24 * 14)).max(8).optional(),
});

const telegramWebhookSchema = z.object({
  update_id: z.number().int().optional(),
  message: z
    .object({
      message_id: z.number().int().optional(),
      text: z.string().optional(),
      contact: z
        .object({
          phone_number: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          user_id: z.union([z.number().int(), z.string()]).optional(),
        })
        .optional(),
      chat: z.object({
        id: z.union([z.number().int(), z.string()]).optional(),
        type: z.string().optional(),
      }),
      from: z
        .object({
          id: z.union([z.number().int(), z.string()]).optional(),
          username: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const siteSettingsSchema = z.object({
  brandAvatar: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\//.test(value) ||
        /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value),
      "Укажите корректный URL или изображение в формате data:image.",
    ),
});

const adminNotificationSchema = z
  .object({
    audience: z.enum(["all", "students", "teachers", "selected"]),
    title: z.string().trim().min(2, "Укажите заголовок уведомления.").max(120),
    body: z.string().trim().min(2, "Укажите текст уведомления.").max(1000),
    userIds: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .refine((payload) => payload.audience !== "selected" || payload.userIds.length > 0, {
    message: "Выберите хотя бы одного пользователя.",
    path: ["userIds"],
  });

const DASHBOARD_SLOT_DEFINITIONS = Object.freeze([
  { key: "stats-1", size: "stat" },
  { key: "stats-2", size: "stat" },
  { key: "stats-3", size: "stat" },
  { key: "feature-main", size: "main" },
  { key: "side-top", size: "side" },
  { key: "side-bottom", size: "side" },
]);

const DASHBOARD_WIDGET_DEFINITIONS = Object.freeze([
  { type: "upcoming_lesson", label: "Ближайшее занятие", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "weekly_load", label: "Нагрузка недели", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "messages", label: "Сообщения", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "notifications", label: "Уведомления", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "connections", label: "Связи", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "pending_requests", label: "Заявки", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "free_hours", label: "Свободные часы", slots: ["stats-1", "stats-2", "stats-3", "side-top", "side-bottom"] },
  { type: "today_overview", label: "Сегодня", slots: ["feature-main"] },
  { type: "day_metrics", label: "Статистика дня", slots: ["feature-main", "side-top", "side-bottom"] },
  { type: "schedule_status", label: "Статус расписания", slots: ["feature-main", "side-top", "side-bottom"] },
]);

const dashboardWidgetUpdateSchema = z.object({
  widgetType: z.string().trim().min(1),
});

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    ""
  );
}

function buildErrorMessage(error) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Некорректные данные.";
  }

  return error?.message || "Внутренняя ошибка сервера.";
}

function sendAuthError(res, status, message, code = "auth_error") {
  res.status(status).json({ code, message });
}

async function requireSession(req, res, next) {
  try {
    const user = await getSessionUser(getSessionTokenFromRequest(req));

    if (!user) {
      sendAuthError(res, 401, "Требуется авторизация.", "unauthorized");
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      sendAuthError(res, 403, "Недостаточно прав для этого действия.", "forbidden");
      return;
    }

    next();
  };
}

function redirectWithError(res, errorCode) {
  const url = new URL("/sign-in", config.clientUrl);
  url.searchParams.set("error", errorCode);
  res.redirect(url.toString());
}

async function areUsersConnected(firstUserId, secondUserId) {
  const relationship = await get(
    `
      SELECT id
      FROM teacher_student_relationships
      WHERE (teacher_id = ? AND student_id = ?)
         OR (teacher_id = ? AND student_id = ?)
      LIMIT 1
    `,
    [firstUserId, secondUserId, secondUserId, firstUserId],
  );

  return Boolean(relationship);
}

async function getConnectedUsersForUser(user) {
  if (user.role === "teacher") {
    const students = await all(
      `
        SELECT u.id, u.full_name, u.username, u.email, u.subject, u.phone_number, rel.created_at
        FROM teacher_student_relationships rel
        INNER JOIN users u ON u.id = rel.student_id
        WHERE rel.teacher_id = ?
        ORDER BY u.full_name COLLATE NOCASE ASC
      `,
      [user.id],
    );

    const withSubjects = await Promise.all(
      students.map(async (item) => ({
        id: item.id,
        fullName: item.full_name,
        username: item.username || "",
        email: item.email,
        subject: item.subject || "",
        phoneNumber: item.phone_number || "",
        relationshipStartedAt: item.created_at,
        role: "student",
        status: "active",
        subjects: await listRelationshipSubjects(item.id, user.id),
      })),
    );

    return withSubjects;
  }

  const teachers = await all(
    `
      SELECT u.id, u.full_name, u.username, u.email, u.subject, u.phone_number, rel.created_at
      FROM teacher_student_relationships rel
      INNER JOIN users u ON u.id = rel.teacher_id
      WHERE rel.student_id = ?
      ORDER BY u.full_name COLLATE NOCASE ASC
    `,
    [user.id],
  );

  const withSubjects = await Promise.all(
    teachers.map(async (item) => {
      const subjects = await listTeacherSubjects(item.id);

      return {
      id: item.id,
      fullName: item.full_name,
      username: item.username || "",
      email: item.email,
        subject: subjects[0]?.name || item.subject || "",
        subjects,
        phoneNumber: item.phone_number || "",
        relationshipStartedAt: item.created_at,
        role: "teacher",
        status: "connected",
      };
    }),
  );

  return withSubjects;
}

function normalizeDateValue(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

async function listTeacherStudentRows(teacherId) {
  return all(
    `
      SELECT rel.id, rel.created_at, u.id AS student_id, u.full_name, u.username, u.email, u.phone_number, u.avatar_url
      FROM teacher_student_relationships rel
      INNER JOIN users u ON u.id = rel.student_id
      WHERE rel.teacher_id = ?
      ORDER BY u.full_name COLLATE NOCASE ASC
    `,
    [teacherId],
  );
}

async function listTeacherStudentsDetailed(teacherId) {
  const relationships = await listTeacherStudentRows(teacherId);

  return Promise.all(
    relationships.map(async (item) => {
      const subjects = await listRelationshipSubjects(item.student_id, teacherId);

      return {
        id: item.student_id,
        relationshipId: item.id,
        fullName: item.full_name,
        username: item.username || "",
        email: item.email,
        phoneNumber: item.phone_number || "",
        avatar: item.avatar_url || "",
        connectedAt: item.created_at,
        subject: subjects[0]?.name || "",
        subjects,
        status: "Active",
      };
    }),
  );
}

async function ensureTeacherStudentConnection(teacherId, studentId) {
  return get(
    `
      SELECT id, created_at
      FROM teacher_student_relationships
      WHERE teacher_id = ? AND student_id = ?
      LIMIT 1
    `,
    [teacherId, studentId],
  );
}

async function getTeacherGroupsDetailed(teacherId) {
  const groups = await all(
    `
      SELECT id, name, description, created_at, updated_at
      FROM groups
      WHERE teacher_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `,
    [teacherId],
  );

  return Promise.all(
    groups.map(async (group) => {
      const members = await all(
        `
          SELECT u.id, u.full_name, u.username, u.email, u.avatar_url, gm.created_at
          FROM group_memberships gm
          INNER JOIN users u ON u.id = gm.student_id
          WHERE gm.group_id = ?
          ORDER BY u.full_name COLLATE NOCASE ASC
        `,
        [group.id],
      );
      const homework = await all(
        `
          SELECT id, title, description, due_date, status, created_at, updated_at
          FROM homework_assignments
          WHERE group_id = ?
          ORDER BY COALESCE(due_date, '9999-12-31') ASC, updated_at DESC
        `,
        [group.id],
      );
      const conversation = await get(
        `
          SELECT id
          FROM conversations
          WHERE type = 'group' AND group_id = ?
          LIMIT 1
        `,
        [group.id],
      );

      return {
        id: group.id,
        name: group.name,
        description: group.description || "",
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        conversationId: conversation?.id || null,
        members: members.map((member) => ({
          id: member.id,
          fullName: member.full_name,
          username: member.username || "",
          email: member.email,
          avatar: member.avatar_url || "",
          joinedAt: member.created_at,
        })),
        homework: homework.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          dueDate: item.due_date || "",
          status: item.status,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      };
    }),
  );
}

async function syncGroupConversation(groupId, teacherId) {
  const group = await get(
    `
      SELECT id, name
      FROM groups
      WHERE id = ? AND teacher_id = ?
      LIMIT 1
    `,
    [groupId, teacherId],
  );

  if (!group) {
    return null;
  }

  const members = await all(
    `
      SELECT student_id
      FROM group_memberships
      WHERE group_id = ?
    `,
    [groupId],
  );
  const memberIds = [teacherId, ...members.map((item) => item.student_id)];
  const timestamp = new Date().toISOString();
  let conversation = await get(
    `
      SELECT id
      FROM conversations
      WHERE type = 'group' AND group_id = ?
      LIMIT 1
    `,
    [groupId],
  );

  if (!conversation) {
    const conversationId = crypto.randomUUID();
    await run(
      `
        INSERT INTO conversations (id, type, title, group_id, created_at, updated_at)
        VALUES (?, 'group', ?, ?, ?, ?)
      `,
      [conversationId, group.name, groupId, timestamp, timestamp],
    );
    conversation = { id: conversationId };
  } else {
    await run(
      `
        UPDATE conversations
        SET title = ?, updated_at = ?
        WHERE id = ?
      `,
      [group.name, timestamp, conversation.id],
    );
  }

  await run(
    `
      DELETE FROM conversation_members
      WHERE conversation_id = ?
        AND user_id NOT IN (${memberIds.map(() => "?").join(", ")})
    `,
    [conversation.id, ...memberIds],
  );

  for (const memberId of memberIds) {
    await run(
      `
        INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
        VALUES (?, ?, ?)
      `,
      [conversation.id, memberId, timestamp],
    );
  }

  return conversation.id;
}

async function listConversationsForUser(userId) {
  const conversations = await all(
    `
      SELECT c.id, c.type, c.title, c.group_id, c.created_at, c.updated_at
      FROM conversations c
      INNER JOIN conversation_members cm ON cm.conversation_id = c.id
      WHERE cm.user_id = ?
      ORDER BY c.updated_at DESC, c.created_at DESC
    `,
    [userId],
  );

  return Promise.all(
    conversations.map(async (conversation) => {
      const latestMessage = await get(
        `
          SELECT id, content, created_at, sender_id
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [conversation.id],
      );
      const selfMember = await get(
        `
          SELECT last_read_at
          FROM conversation_members
          WHERE conversation_id = ? AND user_id = ?
        `,
        [conversation.id, userId],
      );
      const unread =
        latestMessage
        && latestMessage.sender_id !== userId
        && (!selfMember?.last_read_at || latestMessage.created_at > selfMember.last_read_at);

      if (conversation.type === "group") {
        const members = await all(
          `
            SELECT u.id, u.full_name, u.username, u.email
            FROM conversation_members cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id = ? AND u.id != ?
            ORDER BY u.full_name COLLATE NOCASE ASC
          `,
          [conversation.id, userId],
        );

        return {
          id: conversation.id,
          type: "group",
          title: conversation.title || "Group",
          groupId: conversation.group_id || null,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          lastMessage: latestMessage?.content || "",
          lastMessageAt: latestMessage?.created_at || conversation.updated_at,
          isUnread: Boolean(unread),
          memberCount: members.length,
          members: members.map((member) => ({
            id: member.id,
            fullName: member.full_name,
            username: member.username || "",
            email: member.email,
          })),
        };
      }

      const participant = await get(
        `
          SELECT u.id, u.full_name, u.username, u.email, u.role, u.subject
          FROM conversation_members cm
          INNER JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = ? AND u.id != ?
          LIMIT 1
        `,
        [conversation.id, userId],
      );

      return {
        id: conversation.id,
        type: "direct",
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        lastMessage: latestMessage?.content || "",
        lastMessageAt: latestMessage?.created_at || conversation.updated_at,
        isUnread: Boolean(unread),
        participant: participant
          ? {
              id: participant.id,
              fullName: participant.full_name,
              username: participant.username || "",
              email: participant.email,
              role: participant.role,
              subject: participant.subject || "",
            }
          : null,
      };
    }),
  );
}

async function getConversationResponse(conversationId, userId) {
  const conversation = await requireConversationMember(conversationId, userId);

  if (!conversation) {
    return null;
  }

  await updateConversationReadState(conversationId, userId);

  const baseConversation = await get(
    `
      SELECT id, type, title, group_id, created_at, updated_at
      FROM conversations
      WHERE id = ?
      LIMIT 1
    `,
    [conversationId],
  );

  const messages = await all(
    `
      SELECT m.id, m.content, m.created_at, m.sender_id, sender.full_name AS sender_name
      FROM messages m
      INNER JOIN users sender ON sender.id = m.sender_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `,
    [conversationId],
  );

  if (baseConversation?.type === "group") {
    const members = await all(
      `
        SELECT u.id, u.full_name, u.username, u.email, u.role
        FROM conversation_members cm
        INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.conversation_id = ?
        ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.full_name COLLATE NOCASE ASC
      `,
      [conversationId, userId],
    );

    return {
      conversation: {
        id: baseConversation.id,
        type: "group",
        title: baseConversation.title || "Group",
        groupId: baseConversation.group_id || null,
        createdAt: baseConversation.created_at,
        updatedAt: baseConversation.updated_at,
        members: members.map((member) => ({
          id: member.id,
          fullName: member.full_name,
          username: member.username || "",
          email: member.email,
          role: member.role,
        })),
      },
      messages: messages.map((item) => ({
        id: item.id,
        content: item.content,
        createdAt: item.created_at,
        senderId: item.sender_id,
        senderName: item.sender_name,
        isOwn: item.sender_id === userId,
      })),
    };
  }

  const participant = await get(
    `
      SELECT u.id, u.full_name, u.username, u.email, u.role, u.subject
      FROM conversation_members cm
      INNER JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ? AND u.id != ?
      LIMIT 1
    `,
    [conversationId, userId],
  );

  return {
    conversation: {
      id: baseConversation.id,
      type: "direct",
      createdAt: baseConversation.created_at,
      updatedAt: baseConversation.updated_at,
      participant: participant
        ? {
            id: participant.id,
            fullName: participant.full_name,
            username: participant.username || "",
            email: participant.email,
            role: participant.role,
            subject: participant.subject || "",
          }
        : null,
    },
    messages: messages.map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.created_at,
      senderId: item.sender_id,
      senderName: item.sender_name,
      isOwn: item.sender_id === userId,
    })),
  };
}

async function getConversationForUsers(userId, participantId) {
  return get(
    `
      SELECT c.id, c.created_at, c.updated_at
      FROM conversations c
      INNER JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
      INNER JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
      WHERE c.type = 'direct'
      LIMIT 1
    `,
    [userId, participantId],
  );
}

async function requireConversationMember(conversationId, userId) {
  return get(
    `
      SELECT c.id, c.created_at, c.updated_at
      FROM conversations c
      INNER JOIN conversation_members cm ON cm.conversation_id = c.id
      WHERE c.id = ? AND cm.user_id = ?
    `,
    [conversationId, userId],
  );
}

function toHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function buildDaySummary(entries) {
  const busyHours = new Set();

  for (const entry of entries) {
    for (let hour = entry.startHour; hour < entry.endHour; hour += 1) {
      busyHours.add(hour);
    }
  }

  const busyRanges = [];
  const freeRanges = [];
  let rangeStart = 0;
  let previousState = busyHours.has(0);

  for (let hour = 1; hour <= 24; hour += 1) {
    const nextState = hour < 24 ? busyHours.has(hour) : null;

    if (nextState !== previousState) {
      const collection = previousState ? busyRanges : freeRanges;
      collection.push({
        startHour: rangeStart,
        endHour: hour,
        label: `${toHourLabel(rangeStart)} - ${toHourLabel(hour)}`,
      });
      rangeStart = hour;
      previousState = nextState;
    }
  }

  return {
    bookedHours: busyHours.size,
    busyRanges,
    freeRanges,
  };
}

async function findScheduleOverlap(userId, date, startHour, endHour) {
  return get(
    `
      SELECT id
      FROM schedule_entries
      WHERE user_id = ?
        AND date = ?
        AND start_hour < ?
        AND end_hour > ?
      LIMIT 1
    `,
    [userId, date, endHour, startHour],
  );
}

async function getScheduleEntryDetails(entryId, userId) {
  return get(
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
      WHERE e.id = ? AND e.user_id = ?
      LIMIT 1
    `,
    [entryId, userId],
  );
}

async function listRelationshipSubjects(studentId, teacherId) {
  const rows = await all(
    `
      SELECT ts.id, ts.name
      FROM teacher_student_relationships rel
      INNER JOIN relationship_subjects rs ON rs.relationship_id = rel.id
      INNER JOIN teacher_subjects ts ON ts.id = rs.teacher_subject_id
      WHERE rel.student_id = ? AND rel.teacher_id = ?
      ORDER BY ts.sort_order ASC, ts.name COLLATE NOCASE ASC
    `,
    [studentId, teacherId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

async function updateConversationReadState(conversationId, userId) {
  const timestamp = new Date().toISOString();
  await run(
    `
      UPDATE conversation_members
      SET last_read_at = ?
      WHERE conversation_id = ? AND user_id = ?
    `,
    [timestamp, conversationId, userId],
  );
}

async function getUnreadChatCount(userId) {
  const row = await get(
    `
      SELECT COUNT(*) AS unread_chats
      FROM (
        SELECT c.id
        FROM conversations c
        INNER JOIN conversation_members self_member
          ON self_member.conversation_id = c.id AND self_member.user_id = ?
        INNER JOIN messages latest_message
          ON latest_message.id = (
            SELECT m.id
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          )
        WHERE latest_message.sender_id != ?
          AND (
            self_member.last_read_at IS NULL OR latest_message.created_at > self_member.last_read_at
          )
      ) unread
    `,
    [userId, userId],
  );

  return row?.unread_chats || 0;
}

async function createNotification(userId, { type, title, body, link = "", meta = null }) {
  const notificationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await run(
    `
      INSERT INTO app_notifications (
        id, user_id, type, title, body, link, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      notificationId,
      userId,
      type,
      title,
      body,
      link || null,
      meta ? JSON.stringify(meta) : null,
      createdAt,
    ],
  );

  await deliverAppNotificationToTelegram(userId, {
    id: notificationId,
    userId,
    type,
    title,
    body,
    link: link || "",
    meta,
    createdAt,
  }).catch((error) => {
    console.error("[telegram] app notification delivery failed", error);
  });
}

async function getUnreadNotificationCount(userId) {
  const row = await get(
    `
      SELECT COUNT(*) AS unread_count
      FROM app_notifications
      WHERE user_id = ? AND read_at IS NULL
    `,
    [userId],
  );

  return row?.unread_count || 0;
}

async function ensureUserSettings(userId) {
  await run(
    `
      INSERT OR IGNORE INTO user_settings (user_id, theme_preference, notification_preference, privacy_mode, updated_at)
      VALUES (?, 'system', 'all', 'standard', ?)
    `,
    [userId, new Date().toISOString()],
  );
}

async function getUserSettings(userId) {
  await ensureUserSettings(userId);

  return get(
    `
      SELECT *
      FROM user_settings
      WHERE user_id = ?
    `,
    [userId],
  );
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function normalizeOptionalId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function sanitizeColor(value, fallback = "#245dff") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.slice(0, 32) || fallback;
}

function getDefaultBoardContent() {
  return {
    elements: [],
    viewport: { ...DEFAULT_BOARD_VIEWPORT },
  };
}

function sanitizeBoardElement(element) {
  if (!element || typeof element !== "object") {
    return null;
  }

  const rawType = typeof element.type === "string" ? element.type.trim() : "";
  const base = {
    id:
      typeof element.id === "string" && element.id.trim()
        ? element.id.trim()
        : crypto.randomUUID(),
    type: rawType === "text" ? "text" : rawType === "stroke" ? "stroke" : "",
    x: clampNumber(element.x, -20000, 20000, 0),
    y: clampNumber(element.y, -20000, 20000, 0),
    color: sanitizeColor(element.color),
    createdAt:
      typeof element.createdAt === "string" && element.createdAt.trim()
        ? element.createdAt.trim().slice(0, 64)
        : new Date().toISOString(),
  };

  if (base.type === "stroke") {
    const points = Array.isArray(element.points)
      ? element.points
          .map((point) => {
            if (!point || typeof point !== "object") {
              return null;
            }

            const x = Number(point.x);
            const y = Number(point.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
              return null;
            }

            return {
              x: clampNumber(x, -20000, 20000, 0),
              y: clampNumber(y, -20000, 20000, 0),
            };
          })
          .filter(Boolean)
          .slice(0, 4000)
      : [];

    if (points.length < 2) {
      return null;
    }

    return {
      ...base,
      type: "stroke",
      size: clampNumber(element.size, 1, 32, 3),
      points,
    };
  }

  if (base.type === "text") {
    return {
      ...base,
      type: "text",
      text: typeof element.text === "string" ? element.text.slice(0, 5000) : "",
      size: clampNumber(element.size, 12, 72, 26),
      width: clampNumber(element.width, 80, 900, 240),
      height: clampNumber(element.height, 32, 500, 88),
    };
  }

  return null;
}

function sanitizeBoardContent(content) {
  if (!content || typeof content !== "object") {
    return getDefaultBoardContent();
  }

  const viewportSource =
    content.viewport && typeof content.viewport === "object" ? content.viewport : DEFAULT_BOARD_VIEWPORT;
  const elements = Array.isArray(content.elements)
    ? content.elements.map(sanitizeBoardElement).filter(Boolean).slice(0, 2000)
    : [];

  return {
    elements,
    viewport: {
      x: clampNumber(viewportSource.x, -20000, 20000, 0),
      y: clampNumber(viewportSource.y, -20000, 20000, 0),
      zoom: clampNumber(viewportSource.zoom, 0.25, 4, 1),
    },
  };
}

function parseBoardContent(rawValue) {
  if (!rawValue) {
    return getDefaultBoardContent();
  }

  try {
    return sanitizeBoardContent(JSON.parse(rawValue));
  } catch {
    return getDefaultBoardContent();
  }
}

function buildBoardPreviewText(content) {
  const textBlock = content.elements.find((item) => item.type === "text" && item.text.trim());

  if (textBlock) {
    return textBlock.text.trim().replace(/\s+/g, " ").slice(0, 160);
  }

  const strokeCount = content.elements.filter((item) => item.type === "stroke").length;

  if (strokeCount > 0) {
    return `${strokeCount} drawing stroke${strokeCount === 1 ? "" : "s"}`;
  }

  return "Empty board";
}

async function getTeacherBoardRecord(boardId, teacherId) {
  return get(
    `
      SELECT
        b.*,
        student.full_name AS student_name,
        student.email AS student_email
      FROM boards b
      LEFT JOIN users student ON student.id = b.student_id
      WHERE b.id = ? AND b.teacher_id = ?
    `,
    [boardId, teacherId],
  );
}

function mapBoardRow(row, { includeContent = false } = {}) {
  const content = parseBoardContent(row.content_json);
  const lessonSessionId = row.lesson_session_id || null;
  const telemostRoomId = row.telemost_room_id || null;

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    previewText: row.preview_text || buildBoardPreviewText(content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at || null,
    ownerId: row.teacher_id,
    student: row.student_id
      ? {
          id: row.student_id,
          fullName: row.student_name,
          email: row.student_email,
        }
      : null,
    lessonIntegration: {
      lessonSessionId,
      telemostRoomId,
      yandexTelemostReady: true,
    },
    elementCount: content.elements.length,
    content: includeContent ? content : undefined,
  };
}

function formatHourRange(startHour, endHour) {
  return `${toHourLabel(startHour)} - ${toHourLabel(endHour)}`;
}

function getDefaultDashboardWidgetsForRole(_role) {
  return [];
}

function findDashboardSlot(slotKey) {
  return DASHBOARD_SLOT_DEFINITIONS.find((slot) => slot.key === slotKey) || null;
}

function findDashboardWidgetDefinition(widgetType) {
  return DASHBOARD_WIDGET_DEFINITIONS.find((widget) => widget.type === widgetType) || null;
}

function listAvailableWidgetsForSlot(slotKey) {
  return DASHBOARD_WIDGET_DEFINITIONS.filter((widget) => widget.slots.includes(slotKey));
}

async function ensureDashboardWidgets(user) {
  const existing = await all(
    `
      SELECT slot_key
      FROM dashboard_widgets
      WHERE user_id = ?
    `,
    [user.id],
  );

  if (existing.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const defaults = getDefaultDashboardWidgetsForRole(user.role);

  for (const item of defaults) {
    await run(
      `
        INSERT INTO dashboard_widgets (id, user_id, slot_key, widget_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), user.id, item.slotKey, item.widgetType, now, now],
    );
  }
}

async function getDashboardLayoutForUser(user) {
  await ensureDashboardWidgets(user);

  const rows = await all(
    `
      SELECT slot_key, widget_type
      FROM dashboard_widgets
      WHERE user_id = ?
    `,
    [user.id],
  );

  const widgetMap = new Map(rows.map((row) => [row.slot_key, row.widget_type]));

  return DASHBOARD_SLOT_DEFINITIONS.map((slot) => ({
    key: slot.key,
    size: slot.size,
    widgetType: widgetMap.get(slot.key) || null,
    availableWidgets: listAvailableWidgetsForSlot(slot.key).map((widget) => ({
      type: widget.type,
      label: widget.label,
    })),
  }));
}

function googleRedirectUri() {
  return `${config.apiBaseUrl}/api/auth/google/callback`;
}

function vkRedirectUri() {
  return `${config.apiBaseUrl}/api/auth/vk/callback`;
}

app.get("/api/health", async (req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/providers", async (req, res) => {
  res.json({
    providers: {
      ...(await listConfiguredProviders(config)),
      telegramAuthMode: config.telegramAuthMode,
    },
  });
});

app.post("/api/auth/telegram/local/start", async (req, res, next) => {
  try {
    if (!isTelegramConfigured()) {
      sendAuthError(res, 503, "Telegram integration is not configured.", "provider_not_configured");
      return;
    }

    const mode = req.body?.mode === "signup" ? "signup" : "signin";
    const role = req.body?.role === "student" ? "student" : "teacher";
    const request = await createTelegramAuthRequest({
      mode,
      role,
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    res.json({
      request,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/telegram/local/status", async (req, res, next) => {
  try {
    const token = String(req.query.token || "");

    if (!token) {
      sendAuthError(res, 400, "Telegram auth token is required.", "token_required");
      return;
    }

    res.json(await getTelegramAuthRequestStatus(token));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/telegram/local/finalize", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");

    if (!token) {
      sendAuthError(res, 400, "Telegram auth token is required.", "token_required");
      return;
    }

    const result = await finalizeTelegramAuthRequest(token);

    if (!result.success) {
      sendAuthError(res, 400, "Telegram login is not ready yet.", result.errorCode || "telegram_finalize_failed");
      return;
    }

    const user = await getUserById(result.userId);
    const sessionToken = await createSessionForUser(result.userId, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.json({
      user: await buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/site-settings", async (req, res, next) => {
  try {
    const settings = await get(
      `
        SELECT brand_name, brand_avatar_url, updated_at
        FROM site_settings
        WHERE id = 'global'
      `,
    );

    res.json({
      brandName: settings?.brand_name || "Repetly",
      brandAvatar: settings?.brand_avatar_url || "",
      updatedAt: settings?.updated_at || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/session", async (req, res) => {
  const user = await getSessionUser(getSessionTokenFromRequest(req));

  if (!user) {
    sendAuthError(res, 401, "Сессия не найдена.", "session_not_found");
    return;
  }

  res.json({ user });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const payload = registrationSchema.parse(req.body);
    const normalizedUsername = normalizeUsername(payload.username);

    if (payload.password !== payload.confirmPassword) {
      sendAuthError(res, 400, "Пароли не совпадают.", "password_mismatch");
      return;
    }

    if (!normalizedUsername || normalizedUsername.length < 3) {
      sendAuthError(res, 400, "Укажите корректный никнейм минимум из 3 символов.", "invalid_username");
      return;
    }

    const passwordValidationMessage = validatePasswordStrength(payload.password);

    if (passwordValidationMessage) {
      sendAuthError(res, 400, passwordValidationMessage, "weak_password");
      return;
    }

    const existingUser = await getUserByEmail(payload.email);

    if (existingUser) {
      sendAuthError(res, 409, "Пользователь с таким email уже существует.", "duplicate_email");
      return;
    }

    const existingUsernameUser = await getUserByUsername(normalizedUsername);

    if (existingUsernameUser) {
      sendAuthError(res, 409, "Пользователь с таким никнеймом уже существует.", "duplicate_username");
      return;
    }

    const user = await createUser({
      ...payload,
      username: normalizedUsername,
    });
    await updatePasswordIdentity(user.id, payload.email, hashPassword(payload.password));

    const sessionToken = await createSessionForUser(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.status(201).json({ user: await buildUserPayload(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const identity = await findPasswordIdentityByEmail(payload.email);

    if (!identity || !identity.password_hash || !verifyPassword(payload.password, identity.password_hash)) {
      sendAuthError(res, 401, "Неверный email или пароль.", "invalid_credentials");
      return;
    }

    if (identity.status !== "active") {
      sendAuthError(res, 403, "Аккаунт недоступен.", "account_inactive");
      return;
    }

    const sessionToken = await createSessionForUser(identity.user_id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.json({ user: await buildUserPayload(identity) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    await revokeSession(getSessionTokenFromRequest(req));
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const payload = forgotPasswordSchema.parse(req.body);
    const user = await getUserByEmail(payload.email);

    if (!user) {
      res.json({
        success: true,
        message: "???????? ?????????????? ????????????????????, ???????????? ?????? ???????????? ?????? ????????????????????????.",
      });
      return;
    }

    const resetToken = await createPasswordResetToken(user.id);
    const resetUrl = config.clientUrl + "/reset-password?token=" + encodeURIComponent(resetToken);

    console.log("[repetly] password reset link for " + user.email + ": " + resetUrl);

    res.json({
      success: true,
      message: "???????????? ?????? ???????????? ????????????????????????.",
      resetUrl: config.isProduction ? undefined : resetUrl,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const payload = resetPasswordSchema.parse(req.body);

    if (payload.password !== payload.confirmPassword) {
      sendAuthError(res, 400, "Пароли не совпадают.", "password_mismatch");
      return;
    }

    const passwordValidationMessage = validatePasswordStrength(payload.password);

    if (passwordValidationMessage) {
      sendAuthError(res, 400, passwordValidationMessage, "weak_password");
      return;
    }

    const tokenRecord = await consumePasswordResetToken(payload.token);

    if (!tokenRecord) {
      sendAuthError(res, 400, "Токен сброса недействителен или истек.", "invalid_reset_token");
      return;
    }

    const user = await getUserById(tokenRecord.user_id);

    if (!user) {
      sendAuthError(res, 404, "Пользователь не найден.", "user_not_found");
      return;
    }

    await updatePasswordIdentity(user.id, user.email, hashPassword(payload.password));
    await revokeAllSessionsForUser(user.id);

    const sessionToken = await createSessionForUser(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.json({ user: await buildUserPayload(await getUserById(user.id)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google/start", async (req, res, next) => {
  try {
    if (!config.googleClientId || !config.googleClientSecret) {
      redirectWithError(res, "provider_not_configured");
      return;
    }

    const state = await createOauthState("google");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    url.searchParams.set("client_id", config.googleClientId);
    url.searchParams.set("redirect_uri", googleRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("access_type", "offline");

    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google/callback", async (req, res, next) => {
  try {
    const code = req.query.code?.toString() || "";
    const state = req.query.state?.toString() || "";

    if (!code || !(await consumeOauthState("google", state))) {
      redirectWithError(res, "oauth_state_invalid");
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      redirectWithError(res, "oauth_failed");
      return;
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userInfoResponse.json();

    if (!userInfoResponse.ok || !profile.sub || !profile.email) {
      redirectWithError(res, "oauth_failed");
      return;
    }

    const user = await upsertSocialUser({
      provider: "google",
      providerUserId: profile.sub,
      email: profile.email,
      fullName: profile.name || profile.email,
      avatarUrl: profile.picture || "",
    });

    const sessionToken = await createSessionForUser(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.redirect(config.clientUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/vk/start", async (req, res, next) => {
  try {
    if (!config.vkClientId || !config.vkClientSecret) {
      redirectWithError(res, "provider_not_configured");
      return;
    }

    const state = await createOauthState("vk");
    const url = new URL("https://oauth.vk.com/authorize");

    url.searchParams.set("client_id", config.vkClientId);
    url.searchParams.set("redirect_uri", vkRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "email");
    url.searchParams.set("state", state);
    url.searchParams.set("v", "5.131");

    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/vk/callback", async (req, res, next) => {
  try {
    const code = req.query.code?.toString() || "";
    const state = req.query.state?.toString() || "";

    if (!code || !(await consumeOauthState("vk", state))) {
      redirectWithError(res, "oauth_state_invalid");
      return;
    }

    const tokenUrl = new URL("https://oauth.vk.com/access_token");
    tokenUrl.searchParams.set("client_id", config.vkClientId);
    tokenUrl.searchParams.set("client_secret", config.vkClientSecret);
    tokenUrl.searchParams.set("redirect_uri", vkRedirectUri());
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.user_id) {
      redirectWithError(res, "oauth_failed");
      return;
    }

    const userInfoUrl = new URL("https://api.vk.com/method/users.get");
    userInfoUrl.searchParams.set("user_ids", tokenData.user_id.toString());
    userInfoUrl.searchParams.set("fields", "photo_200");
    userInfoUrl.searchParams.set("access_token", tokenData.access_token);
    userInfoUrl.searchParams.set("v", "5.131");

    const userInfoResponse = await fetch(userInfoUrl);
    const profilePayload = await userInfoResponse.json();
    const profile = profilePayload?.response?.[0];

    if (!profile || !tokenData.email) {
      redirectWithError(res, "oauth_failed");
      return;
    }

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    const user = await upsertSocialUser({
      provider: "vk",
      providerUserId: String(tokenData.user_id),
      email: tokenData.email,
      fullName: fullName || tokenData.email,
      avatarUrl: profile.photo_200 || "",
    });

    const sessionToken = await createSessionForUser(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.redirect(config.clientUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/telegram/start", async (req, res, next) => {
  try {
    if (!config.telegramBotToken || !config.telegramBotUsername) {
      redirectWithError(res, "provider_not_configured");
      return;
    }

    const mode = req.query.mode === "signup" ? "signup" : "signin";
    const role = req.query.role === "student" ? "student" : "teacher";

    if (config.telegramAuthMode === "local") {
      const redirectUrl = new URL("/telegram-auth", config.clientUrl);
      redirectUrl.searchParams.set("mode", mode);
      redirectUrl.searchParams.set("role", role);
      res.redirect(redirectUrl.toString());
      return;
    }

    const state = await createOauthState("telegram");
    const authUrl = new URL("/api/auth/telegram/callback", config.apiBaseUrl);
    authUrl.searchParams.set("state", state);
    res.cookie(
      TELEGRAM_AUTH_CONTEXT_COOKIE,
      JSON.stringify({ state, mode, role }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: config.sessionCookieSecure,
        signed: true,
        maxAge: 1000 * 60 * 15,
        path: "/",
      },
    );
    res.type("html").send(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Telegram Login</title>
        <style>
          body { margin:0; font-family: system-ui, sans-serif; display:grid; place-items:center; min-height:100vh; background:#f4f7fc; color:#132238; }
          .card { background:white; padding:32px; border-radius:24px; box-shadow:0 24px 60px rgba(31,68,122,.08); border:1px solid rgba(146,162,190,.18); text-align:center; max-width:420px; }
          h1 { margin-top:0; }
          p { color:#6e7d96; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Вход через Telegram</h1>
          <p>Подтвердите вход через Telegram-аккаунт.</p>
          <script async src="https://telegram.org/js/telegram-widget.js?22"
            data-telegram-login="${config.telegramBotUsername}"
            data-size="large"
            data-userpic="true"
            data-auth-url="${authUrl.toString()}"
            data-request-access="write"></script>
        </div>
      </body>
    </html>
  `);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/telegram/callback", async (req, res, next) => {
  try {
    const rawQuery = { ...req.query };
    const hash = rawQuery.hash?.toString() || "";
    const state = rawQuery.state?.toString() || "";
    const contextPayload = req.signedCookies?.[TELEGRAM_AUTH_CONTEXT_COOKIE] || "";
    const context = contextPayload ? JSON.parse(contextPayload) : null;

    res.clearCookie(TELEGRAM_AUTH_CONTEXT_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.sessionCookieSecure,
      path: "/",
    });

    if (
      !state ||
      !context?.state ||
      context.state !== state ||
      !(await consumeOauthState("telegram", state))
    ) {
      redirectWithError(res, "oauth_state_invalid");
      return;
    }

    const telegramAuthQuery = Object.fromEntries(
      Object.entries(rawQuery).filter(([key]) =>
        ["id", "first_name", "last_name", "username", "photo_url", "auth_date"].includes(key),
      ),
    );

    const dataCheckString = Object.keys(telegramAuthQuery)
      .sort()
      .map((key) => `${key}=${telegramAuthQuery[key]}`)
      .join("\n");

    const secretKey = crypto
      .createHash("sha256")
      .update(config.telegramBotToken)
      .digest();
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const authDate = Number(telegramAuthQuery.auth_date || 0);

    if (
      !hash ||
      !crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(hash, "hex")) ||
      !authDate ||
      Date.now() - authDate * 1000 > 10 * 60 * 1000
    ) {
      redirectWithError(res, "telegram_auth_failed");
      return;
    }

    const telegramId = telegramAuthQuery.id?.toString() || "";
    const fullName = [telegramAuthQuery.first_name, telegramAuthQuery.last_name].filter(Boolean).join(" ").trim();
    const username = telegramAuthQuery.username ? `@${telegramAuthQuery.username}` : "";

    const user = await upsertSocialUser({
      provider: "telegram",
      providerUserId: telegramId,
      email: `${telegramId}@telegram.local`,
      fullName: fullName || username || `Telegram ${telegramId}`,
      avatarUrl: telegramAuthQuery.photo_url?.toString() || "",
      role: context?.mode === "signup" ? context.role : "teacher",
    });

    const sessionToken = await createSessionForUser(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });

    applySessionCookie(res, sessionToken, config.sessionCookieSecure);
    res.redirect(config.clientUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", requireSession, async (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/settings", requireSession, async (req, res, next) => {
  try {
    const [settings, sessionsCount, telegram] = await Promise.all([
      getUserSettings(req.user.id),
      get(`SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?`, [req.user.id]),
      getTelegramIntegrationStatus(req.user.id),
    ]);

    res.json({
      settings: {
        themePreference: settings.theme_preference,
        notificationPreference: settings.notification_preference,
        privacyMode: settings.privacy_mode,
      },
      sessionsCount: sessionsCount?.count || 0,
      telegram,
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings/preferences", requireSession, async (req, res, next) => {
  try {
    const payload = settingsPreferencesSchema.parse(req.body);
    const timestamp = new Date().toISOString();

    await ensureUserSettings(req.user.id);
    await run(
      `
        UPDATE user_settings
        SET theme_preference = ?, notification_preference = ?, privacy_mode = ?, updated_at = ?
        WHERE user_id = ?
      `,
      [
        payload.themePreference,
        payload.notificationPreference,
        payload.privacyMode,
        timestamp,
        req.user.id,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/email", requireSession, async (req, res, next) => {
  try {
    const payload = settingsEmailSchema.parse(req.body);
    const existingUser = await getUserByEmail(payload.email);

    if (existingUser && existingUser.id !== req.user.id) {
      sendAuthError(res, 409, "Пользователь с таким email уже существует.", "duplicate_email");
      return;
    }

    const updatedUser = await updateUserProfile(req.user.id, {
      fullName: req.user.fullName,
      email: payload.email,
      phoneNumber: req.user.phoneNumber || "",
      avatar: req.user.avatar || "",
      subject: req.user.subject || "",
      subjects: req.user.subjects?.map((item) => item.name) || [],
    });

    res.json({ user: await buildUserPayload(updatedUser) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/password", requireSession, async (req, res, next) => {
  try {
    const payload = settingsPasswordSchema.parse(req.body);

    if (payload.newPassword !== payload.confirmPassword) {
      sendAuthError(res, 400, "Новые пароли не совпадают.", "password_mismatch");
      return;
    }

    const passwordValidationMessage = validatePasswordStrength(payload.newPassword);

    if (passwordValidationMessage) {
      sendAuthError(res, 400, passwordValidationMessage, "weak_password");
      return;
    }

    const identity = await findPasswordIdentityByEmail(req.user.email);

    if (!identity?.password_hash || !verifyPassword(payload.currentPassword, identity.password_hash)) {
      sendAuthError(res, 401, "Текущий пароль введён неверно.", "invalid_credentials");
      return;
    }

    await updatePasswordIdentity(req.user.id, req.user.email, hashPassword(payload.newPassword));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/sessions/revoke-others", requireSession, async (req, res, next) => {
  try {
    const currentToken = getSessionTokenFromRequest(req);
    const currentSessionHash = crypto.createHash("sha256").update(currentToken).digest("hex");

    await run(
      `
        DELETE FROM sessions
        WHERE user_id = ? AND token_hash != ?
      `,
      [req.user.id, currentSessionHash],
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/integrations/telegram", requireSession, async (req, res, next) => {
  try {
    res.json(await getTelegramIntegrationStatus(req.user.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/telegram/link", requireSession, async (req, res, next) => {
  try {
    if (!isTelegramConfigured()) {
      sendAuthError(res, 503, "Telegram integration is not configured.", "telegram_not_configured");
      return;
    }

    const session = await createTelegramLinkSession(req.user.id);
    res.status(201).json({
      ...session,
      telegram: await getTelegramIntegrationStatus(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/integrations/telegram/link", requireSession, async (req, res, next) => {
  try {
    await unlinkTelegramConnection(req.user.id);
    res.json(await getTelegramIntegrationStatus(req.user.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/integrations/telegram/preferences", requireSession, async (req, res, next) => {
  try {
    const payload = telegramPreferencesSchema.parse(req.body);
    res.json(await updateTelegramPreferences(req.user.id, payload));
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/telegram/webhook", async (req, res, next) => {
  try {
    if (!isTelegramConfigured() || !config.telegramWebhookSecret) {
      sendAuthError(res, 503, "Telegram webhook is not configured.", "telegram_webhook_not_configured");
      return;
    }

    if (!isValidTelegramWebhook(req)) {
      sendAuthError(res, 401, "Invalid Telegram webhook signature.", "telegram_webhook_unauthorized");
      return;
    }

    const payload = telegramWebhookSchema.parse(req.body);
    await handleTelegramWebhookUpdate(payload);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard-layout", requireSession, async (req, res, next) => {
  try {
    res.json({
      slots: await getDashboardLayoutForUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/dashboard-layout", requireSession, async (req, res, next) => {
  try {
    await run(
      `
        DELETE FROM dashboard_widgets
        WHERE user_id = ?
      `,
      [req.user.id],
    );

    res.json({
      slots: await getDashboardLayoutForUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/dashboard-layout/:slotKey", requireSession, async (req, res, next) => {
  try {
    const slot = findDashboardSlot(req.params.slotKey);

    if (!slot) {
      sendAuthError(res, 404, "Слот не найден.", "dashboard_slot_not_found");
      return;
    }

    const payload = dashboardWidgetUpdateSchema.parse(req.body);
    const widget = findDashboardWidgetDefinition(payload.widgetType);

    if (!widget || !widget.slots.includes(slot.key)) {
      sendAuthError(res, 400, "Этот виджет нельзя поставить в выбранный слот.", "dashboard_widget_invalid");
      return;
    }

    const now = new Date().toISOString();

    await run(
      `
        INSERT INTO dashboard_widgets (id, user_id, slot_key, widget_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, slot_key) DO UPDATE SET
          widget_type = excluded.widget_type,
          updated_at = excluded.updated_at
      `,
      [crypto.randomUUID(), req.user.id, slot.key, widget.type, now, now],
    );

    res.json({
      slot: {
        key: slot.key,
        size: slot.size,
        widgetType: widget.type,
      },
      slots: await getDashboardLayoutForUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/dashboard-layout/:slotKey", requireSession, async (req, res, next) => {
  try {
    const slot = findDashboardSlot(req.params.slotKey);

    if (!slot) {
      sendAuthError(res, 404, "Слот не найден.", "dashboard_slot_not_found");
      return;
    }

    await run(
      `
        DELETE FROM dashboard_widgets
        WHERE user_id = ? AND slot_key = ?
      `,
      [req.user.id, slot.key],
    );

    res.json({
      slots: await getDashboardLayoutForUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard-summary", requireSession, async (req, res, next) => {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    const [
      upcomingLesson,
      lessonsThisWeek,
      todaysLessons,
      todaysBooked,
      unreadMessages,
      unreadNotifications,
      pendingRequests,
      connectedCount,
      recentSchedule,
    ] = await Promise.all([
      get(
        `
          SELECT e.date, e.start_hour, e.end_hour, e.title, partner.full_name AS partner_name
          FROM schedule_entries e
          LEFT JOIN users partner ON partner.id = e.partner_id
          WHERE e.user_id = ?
            AND (e.date > ? OR (e.date = ? AND e.end_hour > ?))
          ORDER BY e.date ASC, e.start_hour ASC
          LIMIT 1
        `,
        [req.user.id, today, today, now.getHours()],
      ),
      get(
        `
          SELECT COUNT(*) AS count
          FROM schedule_entries
          WHERE user_id = ? AND date >= ? AND date <= ?
        `,
        [req.user.id, weekStartIso, weekEndIso],
      ),
      get(
        `
          SELECT COUNT(*) AS count
          FROM schedule_entries
          WHERE user_id = ? AND date = ?
        `,
        [req.user.id, today],
      ),
      get(
        `
          SELECT COALESCE(SUM(end_hour - start_hour), 0) AS booked
          FROM schedule_entries
          WHERE user_id = ? AND date = ?
        `,
        [req.user.id, today],
      ),
      getUnreadChatCount(req.user.id),
      getUnreadNotificationCount(req.user.id),
      req.user.role === "teacher"
        ? get(
            `SELECT COUNT(*) AS count FROM teacher_student_requests WHERE teacher_id = ? AND status = 'pending'`,
            [req.user.id],
          )
        : get(
            `SELECT COUNT(*) AS count FROM teacher_student_requests WHERE student_id = ? AND status = 'pending'`,
            [req.user.id],
          ),
      req.user.role === "teacher"
        ? get(
            `SELECT COUNT(*) AS count FROM teacher_student_relationships WHERE teacher_id = ?`,
            [req.user.id],
          )
        : get(
            `SELECT COUNT(*) AS count FROM teacher_student_relationships WHERE student_id = ?`,
            [req.user.id],
          ),
      get(
        `
          SELECT MAX(updated_at) AS updated_at
          FROM schedule_entries
          WHERE user_id = ?
        `,
        [req.user.id],
      ),
    ]);

    res.json({
      upcomingLesson: upcomingLesson
        ? {
            title: upcomingLesson.title,
            partnerName: upcomingLesson.partner_name,
            date: upcomingLesson.date,
            timeRange: formatHourRange(upcomingLesson.start_hour, upcomingLesson.end_hour),
          }
        : null,
      lessonsThisWeek: lessonsThisWeek?.count || 0,
      todaysLessons: todaysLessons?.count || 0,
      freeHoursToday: 24 - (todaysBooked?.booked || 0),
      unreadMessages,
      unreadNotifications,
      pendingRequests: pendingRequests?.count || 0,
      connectedCount: connectedCount?.count || 0,
      weeklySummary:
        req.user.role === "teacher"
          ? `На этой неделе запланировано ${lessonsThisWeek?.count || 0} занятий и ${todaysLessons?.count || 0} на сегодня.`
          : `На этой неделе у вас ${lessonsThisWeek?.count || 0} занятий, из них ${todaysLessons?.count || 0} сегодня.`,
      recentScheduleUpdatedAt: recentSchedule?.updated_at || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/overview", requireSession, requireRole("admin"), async (req, res, next) => {
  try {
    const [
      totalUsers,
      usersByRole,
      usersByPlan,
      activeSessions,
      registeredDevices,
      devicesLast30Days,
      activePaidUsers,
      pendingRequests,
      activeRelationships,
      conversationCount,
      messageCount,
      unreadNotifications,
      lessonsByStatus,
      recentUsers,
    ] = await Promise.all([
      get(`SELECT COUNT(*) AS count FROM users`),
      all(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`),
      all(`SELECT subscription_plan AS plan, COUNT(*) AS count FROM users GROUP BY subscription_plan ORDER BY count DESC, plan ASC`),
      get(`SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?`, [new Date().toISOString()]),
      get(
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT DISTINCT user_id || '|' || COALESCE(NULLIF(TRIM(user_agent), ''), 'unknown')
            FROM sessions
          ) devices
        `,
      ),
      get(
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT DISTINCT user_id || '|' || COALESCE(NULLIF(TRIM(user_agent), ''), 'unknown')
            FROM sessions
            WHERE last_accessed_at >= datetime('now', '-30 day')
          ) devices
        `,
      ),
      get(`SELECT COUNT(*) AS count FROM users WHERE role != 'admin' AND status = 'active' AND subscription_plan != 'free'`),
      get(`SELECT COUNT(*) AS count FROM teacher_student_requests WHERE status = 'pending'`),
      get(`SELECT COUNT(*) AS count FROM teacher_student_relationships`),
      get(`SELECT COUNT(*) AS count FROM conversations`),
      get(`SELECT COUNT(*) AS count FROM messages`),
      get(`SELECT COUNT(*) AS count FROM app_notifications WHERE read_at IS NULL`),
      all(`SELECT status, COUNT(*) AS count FROM schedule_entries GROUP BY status`),
      get(`SELECT COUNT(*) AS count FROM users WHERE created_at >= datetime('now', '-7 day')`),
    ]);

    const roleCounts = Object.fromEntries(usersByRole.map((item) => [item.role, item.count]));
    const lessonCounts = Object.fromEntries(lessonsByStatus.map((item) => [item.status, item.count]));

    res.json({
      totalUsers: totalUsers?.count || 0,
      totalTeachers: roleCounts.teacher || 0,
      totalStudents: roleCounts.student || 0,
      totalAdmins: roleCounts.admin || 0,
      activePaidUsers: activePaidUsers?.count || 0,
      freeUsers: (usersByPlan.find((item) => item.plan === "free")?.count) || 0,
      registeredDevices: registeredDevices?.count || 0,
      devicesLast30Days: devicesLast30Days?.count || 0,
      activeSessions: activeSessions?.count || 0,
      pendingRequests: pendingRequests?.count || 0,
      activeRelationships: activeRelationships?.count || 0,
      totalConversations: conversationCount?.count || 0,
      totalMessages: messageCount?.count || 0,
      unreadNotifications: unreadNotifications?.count || 0,
      recentUsers: recentUsers?.count || 0,
      lessons: {
        total: (lessonCounts.planned || 0) + (lessonCounts.confirmed || 0) + (lessonCounts.completed || 0),
        planned: lessonCounts.planned || 0,
        confirmed: lessonCounts.confirmed || 0,
        completed: lessonCounts.completed || 0,
      },
      planBreakdown: usersByPlan.map((item) => ({
        plan: item.plan || "free",
        count: item.count,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/site-settings", requireSession, requireRole("admin"), async (req, res, next) => {
  try {
    const payload = siteSettingsSchema.parse(req.body);
    const timestamp = new Date().toISOString();

    await run(
      `
        UPDATE site_settings
        SET brand_avatar_url = ?, updated_at = ?
        WHERE id = 'global'
      `,
      [payload.brandAvatar || null, timestamp],
    );

    const settings = await get(
      `
        SELECT brand_name, brand_avatar_url, updated_at
        FROM site_settings
        WHERE id = 'global'
      `,
    );

    res.json({
      settings: {
        brandName: settings?.brand_name || "Repetly",
        brandAvatar: settings?.brand_avatar_url || "",
        updatedAt: settings?.updated_at || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireSession, requireRole("admin"), async (req, res, next) => {
  try {
    const users = await all(
      `
        SELECT id, full_name, email, role, status
        FROM users
        WHERE role != 'admin'
        ORDER BY full_name COLLATE NOCASE ASC, email COLLATE NOCASE ASC
      `,
    );

    res.json({
      users: users.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/notifications", requireSession, requireRole("admin"), async (req, res, next) => {
  try {
    const payload = adminNotificationSchema.parse(req.body);

    const recipients = await all(
      `
        SELECT id
        FROM users
        WHERE role != 'admin'
          AND (
            ? = 'all'
            OR (? = 'students' AND role = 'student')
            OR (? = 'teachers' AND role = 'teacher')
            OR (? = 'selected' AND id IN (${payload.userIds.map(() => "?").join(",") || "NULL"}))
          )
      `,
      [payload.audience, payload.audience, payload.audience, payload.audience, ...payload.userIds],
    );

    if (!recipients.length) {
      sendAuthError(res, 400, "Получатели не найдены.", "recipients_not_found");
      return;
    }

    await Promise.all(
      recipients.map((recipient) =>
        createNotification(recipient.id, {
          type: "admin_broadcast",
          title: payload.title,
          body: payload.body,
          link: "/notifications",
          meta: {
            audience: payload.audience,
            senderRole: req.user.role,
          },
        }),
      ),
    );

    res.status(201).json({
      sentCount: recipients.length,
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/profile", requireSession, async (req, res, next) => {
  try {
    const payload = profileUpdateSchema.parse(req.body);
    const existingUser = await getUserByEmail(payload.email);
    const normalizedUsername = normalizeUsername(payload.username);

    if (existingUser && existingUser.id !== req.user.id) {
      sendAuthError(res, 409, "Пользователь с таким email уже существует.", "duplicate_email");
      return;
    }

    if (!normalizedUsername || normalizedUsername.length < 3) {
      sendAuthError(res, 400, "Укажите корректный никнейм минимум из 3 символов.", "invalid_username");
      return;
    }

    const existingUsernameUser = await getUserByUsername(normalizedUsername);

    if (existingUsernameUser && existingUsernameUser.id !== req.user.id) {
      sendAuthError(res, 409, "Пользователь с таким никнеймом уже существует.", "duplicate_username");
      return;
    }

    const updatedUser = await updateUserProfile(req.user.id, {
      ...payload,
      username: normalizedUsername,
    });

    if (!updatedUser) {
      sendAuthError(res, 404, "Пользователь не найден.", "user_not_found");
      return;
    }

    res.json({ user: await buildUserPayload(updatedUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/students/search", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const username = normalizeUsername(req.query.username?.toString() || "");

    if (!username) {
      res.json({ results: [] });
      return;
    }

    const student = await get(
      `
        SELECT *
        FROM users
        WHERE username = ? AND role = 'student' AND status = 'active'
      `,
      [username],
    );

    if (!student) {
      res.json({ results: [] });
      return;
    }

    res.json({
      results: [
        {
          id: student.id,
          fullName: student.full_name,
          username: student.username || "",
          email: student.email,
          phoneNumber: student.phone_number,
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/teacher-students", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const [students, pendingRequests, homeworkAssignments] = await Promise.all([
      listTeacherStudentsDetailed(req.user.id),
      all(
        `
          SELECT req.id, req.status, req.created_at, req.updated_at, u.id as student_id, u.full_name, u.username, u.email
          FROM teacher_student_requests req
          INNER JOIN users u ON u.id = req.student_id
          WHERE req.teacher_id = ? AND req.status = 'pending'
          ORDER BY req.created_at DESC
        `,
        [req.user.id],
      ),
      all(
        `
          SELECT
            hw.id,
            hw.student_id,
            hw.title,
            hw.description,
            hw.due_date,
            hw.status,
            hw.created_at,
            hw.updated_at
          FROM homework_assignments hw
          WHERE hw.teacher_id = ? AND hw.student_id IS NOT NULL
          ORDER BY COALESCE(hw.due_date, '9999-12-31') ASC, hw.updated_at DESC
        `,
        [req.user.id],
      ),
    ]);

    res.json({
      students,
      availableSubjects: await listTeacherSubjects(req.user.id),
      homeworkAssignments: homeworkAssignments.map((item) => ({
        id: item.id,
        studentId: item.student_id,
        title: item.title,
        description: item.description,
        dueDate: item.due_date || "",
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      pendingRequests: pendingRequests.map((item) => ({
        id: item.id,
        studentId: item.student_id,
        fullName: item.full_name,
        username: item.username || "",
        email: item.email,
        status: item.status,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/my-teachers", requireSession, requireRole("student"), async (req, res, next) => {
  try {
    const relationships = await all(
      `
        SELECT rel.id, rel.created_at, teacher.id as teacher_id, teacher.full_name, teacher.email, teacher.subject
        FROM teacher_student_relationships rel
        INNER JOIN users teacher ON teacher.id = rel.teacher_id
        WHERE rel.student_id = ?
        ORDER BY rel.created_at DESC
      `,
      [req.user.id],
    );

    const teachers = await Promise.all(
      relationships.map(async (item) => {
        const subjects = await listTeacherSubjects(item.teacher_id);

        return {
          id: item.teacher_id,
          fullName: item.full_name,
          email: item.email,
          subject: subjects[0]?.name || item.subject || "Subject not set",
          subjects,
          connectedAt: item.created_at,
          status: "Connected",
        };
      }),
    );

    res.json({ teachers });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/teacher-students/:studentId/subjects", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = relationshipSubjectsSchema.parse(req.body);
    const relationship = await get(
      `
        SELECT id
        FROM teacher_student_relationships
        WHERE teacher_id = ? AND student_id = ?
      `,
      [req.user.id, req.params.studentId],
    );

    if (!relationship) {
      sendAuthError(res, 404, "Relationship not found.", "relationship_not_found");
      return;
    }

    const allowedSubjects = await all(
      `
        SELECT id, name
        FROM teacher_subjects
        WHERE teacher_id = ?
      `,
      [req.user.id],
    );
    const allowedIds = new Set(allowedSubjects.map((item) => item.id));

    if (payload.subjectIds.some((subjectId) => !allowedIds.has(subjectId))) {
      sendAuthError(res, 400, "One or more subjects are invalid.", "invalid_subject");
      return;
    }

    await run(`DELETE FROM relationship_subjects WHERE relationship_id = ?`, [relationship.id]);

    for (const subjectId of payload.subjectIds) {
      await run(
        `
          INSERT INTO relationship_subjects (relationship_id, teacher_subject_id)
          VALUES (?, ?)
        `,
        [relationship.id, subjectId],
      );
    }

    res.json({
      subjects: allowedSubjects
        .filter((item) => payload.subjectIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/teacher-students/:studentId/homework", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = homeworkAssignmentSchema.parse({
      ...req.body,
      studentId: req.params.studentId,
    });
    const relationship = await ensureTeacherStudentConnection(req.user.id, payload.studentId);

    if (!relationship) {
      sendAuthError(res, 404, "Student connection not found.", "relationship_not_found");
      return;
    }

    const assignmentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dueDate = normalizeDateValue(payload.dueDate);

    await run(
      `
        INSERT INTO homework_assignments (
          id, teacher_id, student_id, group_id, title, description, due_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'assigned', ?, ?)
      `,
      [assignmentId, req.user.id, payload.studentId, payload.title, payload.description, dueDate, timestamp, timestamp],
    );

    await createNotification(payload.studentId, {
      type: "homework_assigned",
      title: "New homework assigned",
      body: payload.title,
      link: "/students",
      meta: {
        assignmentId,
        teacherId: req.user.id,
      },
    });

    res.status(201).json({
      assignment: {
        id: assignmentId,
        studentId: payload.studentId,
        title: payload.title,
        description: payload.description,
        dueDate: dueDate || "",
        status: "assigned",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/groups", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const [groups, students] = await Promise.all([
      getTeacherGroupsDetailed(req.user.id),
      listTeacherStudentsDetailed(req.user.id),
    ]);

    res.json({ groups, students });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = groupSchema.parse(req.body);
    const connectedStudents = await listTeacherStudentsDetailed(req.user.id);
    const connectedIds = new Set(connectedStudents.map((student) => student.id));

    if (payload.studentIds.some((studentId) => !connectedIds.has(studentId))) {
      sendAuthError(res, 400, "Groups can include only connected students.", "invalid_group_members");
      return;
    }

    const groupId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await run(
      `
        INSERT INTO groups (id, teacher_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [groupId, req.user.id, payload.name, payload.description || "", timestamp, timestamp],
    );

    for (const studentId of [...new Set(payload.studentIds)]) {
      await run(
        `
          INSERT INTO group_memberships (group_id, student_id, created_at)
          VALUES (?, ?, ?)
        `,
        [groupId, studentId, timestamp],
      );
    }

    await syncGroupConversation(groupId, req.user.id);
    res.status(201).json({ groups: await getTeacherGroupsDetailed(req.user.id) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/groups/:groupId", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = groupSchema.parse(req.body);
    const group = await get(
      `
        SELECT id
        FROM groups
        WHERE id = ? AND teacher_id = ?
        LIMIT 1
      `,
      [req.params.groupId, req.user.id],
    );

    if (!group) {
      sendAuthError(res, 404, "Group not found.", "group_not_found");
      return;
    }

    const connectedStudents = await listTeacherStudentsDetailed(req.user.id);
    const connectedIds = new Set(connectedStudents.map((student) => student.id));

    if (payload.studentIds.some((studentId) => !connectedIds.has(studentId))) {
      sendAuthError(res, 400, "Groups can include only connected students.", "invalid_group_members");
      return;
    }

    const timestamp = new Date().toISOString();

    await run(
      `
        UPDATE groups
        SET name = ?, description = ?, updated_at = ?
        WHERE id = ?
      `,
      [payload.name, payload.description || "", timestamp, req.params.groupId],
    );

    await run(`DELETE FROM group_memberships WHERE group_id = ?`, [req.params.groupId]);

    for (const studentId of [...new Set(payload.studentIds)]) {
      await run(
        `
          INSERT INTO group_memberships (group_id, student_id, created_at)
          VALUES (?, ?, ?)
        `,
        [req.params.groupId, studentId, timestamp],
      );
    }

    await syncGroupConversation(req.params.groupId, req.user.id);
    res.json({ groups: await getTeacherGroupsDetailed(req.user.id) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/groups/:groupId", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    await run(`DELETE FROM groups WHERE id = ? AND teacher_id = ?`, [req.params.groupId, req.user.id]);
    res.json({ groups: await getTeacherGroupsDetailed(req.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups/:groupId/homework", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = groupHomeworkSchema.parse(req.body);
    const group = await get(
      `
        SELECT id, name
        FROM groups
        WHERE id = ? AND teacher_id = ?
        LIMIT 1
      `,
      [req.params.groupId, req.user.id],
    );

    if (!group) {
      sendAuthError(res, 404, "Group not found.", "group_not_found");
      return;
    }

    const assignmentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dueDate = normalizeDateValue(payload.dueDate);
    const members = await all(`SELECT student_id FROM group_memberships WHERE group_id = ?`, [req.params.groupId]);

    await run(
      `
        INSERT INTO homework_assignments (
          id, teacher_id, student_id, group_id, title, description, due_date, status, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, 'assigned', ?, ?)
      `,
      [assignmentId, req.user.id, req.params.groupId, payload.title, payload.description, dueDate, timestamp, timestamp],
    );

    await Promise.all(
      members.map((member) =>
        createNotification(member.student_id, {
          type: "group_homework_assigned",
          title: `New group homework: ${group.name}`,
          body: payload.title,
          link: "/groups",
          meta: {
            assignmentId,
            groupId: req.params.groupId,
          },
        }),
      ),
    );

    res.status(201).json({ groups: await getTeacherGroupsDetailed(req.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups/:groupId/conversation", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const group = await get(
      `
        SELECT id
        FROM groups
        WHERE id = ? AND teacher_id = ?
        LIMIT 1
      `,
      [req.params.groupId, req.user.id],
    );

    if (!group) {
      sendAuthError(res, 404, "Group not found.", "group_not_found");
      return;
    }

    const conversationId = await syncGroupConversation(req.params.groupId, req.user.id);
    res.status(201).json(await getConversationResponse(conversationId, req.user.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/boards", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const [boards, students] = await Promise.all([
      all(
        `
          SELECT
            b.*,
            student.full_name AS student_name,
            student.email AS student_email
          FROM boards b
          LEFT JOIN users student ON student.id = b.student_id
          WHERE b.teacher_id = ?
          ORDER BY COALESCE(b.last_opened_at, b.updated_at) DESC, b.created_at DESC
        `,
        [req.user.id],
      ),
      getConnectedUsersForUser(req.user),
    ]);

    res.json({
      boards: boards.map((board) => mapBoardRow(board)),
      students: students.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        subject: student.subject || "",
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/boards", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = boardCreateSchema.parse(req.body);
    const studentId = normalizeOptionalId(payload.studentId);

    if (studentId && !(await areUsersConnected(req.user.id, studentId))) {
      sendAuthError(res, 403, "Board can be attached only to a connected student.", "forbidden");
      return;
    }

    const content = getDefaultBoardContent();
    const timestamp = new Date().toISOString();
    const boardId = crypto.randomUUID();

    await run(
      `
        INSERT INTO boards (
          id,
          teacher_id,
          student_id,
          title,
          description,
          content_json,
          preview_text,
          created_at,
          updated_at,
          last_opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        boardId,
        req.user.id,
        studentId,
        payload.title,
        payload.description || null,
        JSON.stringify(content),
        buildBoardPreviewText(content),
        timestamp,
        timestamp,
        timestamp,
      ],
    );

    const board = await getTeacherBoardRecord(boardId, req.user.id);
    res.status(201).json({ board: mapBoardRow(board, { includeContent: true }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/boards/:id", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const board = await getTeacherBoardRecord(req.params.id, req.user.id);

    if (!board) {
      sendAuthError(res, 404, "Board not found.", "board_not_found");
      return;
    }

    const openedAt = new Date().toISOString();
    await run(
      `
        UPDATE boards
        SET last_opened_at = ?
        WHERE id = ? AND teacher_id = ?
      `,
      [openedAt, board.id, req.user.id],
    );

    const refreshedBoard = await getTeacherBoardRecord(req.params.id, req.user.id);
    res.json({ board: mapBoardRow(refreshedBoard, { includeContent: true }) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/boards/:id", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = boardUpdateSchema.parse(req.body);
    const board = await getTeacherBoardRecord(req.params.id, req.user.id);

    if (!board) {
      sendAuthError(res, 404, "Board not found.", "board_not_found");
      return;
    }

    const studentId =
      payload.studentId === undefined ? board.student_id : normalizeOptionalId(payload.studentId);

    if (studentId && !(await areUsersConnected(req.user.id, studentId))) {
      sendAuthError(res, 403, "Board can be attached only to a connected student.", "forbidden");
      return;
    }

    const nextTitle = payload.title === undefined ? board.title : payload.title;
    const nextDescription =
      payload.description === undefined ? board.description : payload.description || null;
    const nextLessonSessionId =
      payload.lessonSessionId === undefined ? board.lesson_session_id : normalizeOptionalId(payload.lessonSessionId);
    const nextTelemostRoomId =
      payload.telemostRoomId === undefined ? board.telemost_room_id : normalizeOptionalId(payload.telemostRoomId);
    const updatedAt = new Date().toISOString();

    await run(
      `
        UPDATE boards
        SET
          title = ?,
          description = ?,
          student_id = ?,
          lesson_session_id = ?,
          telemost_room_id = ?,
          updated_at = ?
        WHERE id = ? AND teacher_id = ?
      `,
      [
        nextTitle,
        nextDescription,
        studentId,
        nextLessonSessionId,
        nextTelemostRoomId,
        updatedAt,
        board.id,
        req.user.id,
      ],
    );

    const refreshedBoard = await getTeacherBoardRecord(req.params.id, req.user.id);
    res.json({ board: mapBoardRow(refreshedBoard, { includeContent: true }) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/boards/:id/content", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = boardContentSchema.parse(req.body);
    const board = await getTeacherBoardRecord(req.params.id, req.user.id);

    if (!board) {
      sendAuthError(res, 404, "Board not found.", "board_not_found");
      return;
    }

    const content = sanitizeBoardContent(payload.content);
    const serializedContent = JSON.stringify(content);

    if (serializedContent.length > 2_000_000) {
      sendAuthError(res, 413, "Board content is too large.", "board_too_large");
      return;
    }

    const updatedAt = new Date().toISOString();
    await run(
      `
        UPDATE boards
        SET content_json = ?, preview_text = ?, updated_at = ?, last_opened_at = ?
        WHERE id = ? AND teacher_id = ?
      `,
      [serializedContent, buildBoardPreviewText(content), updatedAt, updatedAt, board.id, req.user.id],
    );

    res.json({
      board: {
        id: board.id,
        updatedAt,
        previewText: buildBoardPreviewText(content),
        elementCount: content.elements.length,
        content,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/notifications", requireSession, async (req, res, next) => {
  try {
    const [notifications, requests] = await Promise.all([
      all(
                  `
          SELECT id, type, title, body, link, read_at, created_at
          FROM app_notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 20
        `,
        [req.user.id],
      ),
      req.user.role === "student"
        ? all(
                          `
              SELECT req.id, req.created_at, teacher.id as teacher_id, teacher.full_name, teacher.email, teacher.subject
              FROM teacher_student_requests req
              INNER JOIN users teacher ON teacher.id = req.teacher_id
              WHERE req.student_id = ? AND req.status = 'pending'
              ORDER BY req.created_at DESC
            `,
            [req.user.id],
          )
        : all(
                          `
              SELECT req.id, req.created_at, student.id as student_id, student.full_name, student.username, student.email
              FROM teacher_student_requests req
              INNER JOIN users student ON student.id = req.student_id
              WHERE req.teacher_id = ? AND req.status = 'pending'
              ORDER BY req.created_at DESC
            `,
            [req.user.id],
          ),
    ]);

    res.json({
      items: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        link: item.link || "",
        readAt: item.read_at,
        createdAt: item.created_at,
      })),
      unreadCount: await getUnreadNotificationCount(req.user.id),
      incomingRequests:
        req.user.role === "student"
          ? requests.map((item) => ({
              id: item.id,
              teacherId: item.teacher_id,
              teacherName: item.full_name,
              teacherEmail: item.email,
              subject: item.subject || "??????? ?? ??????",
              createdAt: item.created_at,
            }))
          : [],
      outgoingRequests:
        req.user.role === "teacher"
          ? requests.map((item) => ({
              id: item.id,
              studentId: item.student_id,
              studentName: item.full_name,
              studentUsername: item.username || "",
              studentEmail: item.email,
              createdAt: item.created_at,
            }))
          : [],
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/read-all", requireSession, async (req, res, next) => {
  try {
    await run(
              `
        UPDATE app_notifications
        SET read_at = COALESCE(read_at, ?)
        WHERE user_id = ?
      `,
      [new Date().toISOString(), req.user.id],
    );

    res.json({ unreadCount: 0 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/student-requests", requireSession, requireRole("teacher"), async (req, res, next) => {
  try {
    const payload = studentInviteSchema.parse(req.body);
    const studentUsername = normalizeUsername(payload.studentUsername);
    const student = await get(
      `
        SELECT *
        FROM users
        WHERE username = ? AND role = 'student' AND status = 'active'
      `,
      [studentUsername],
    );

    if (!student) {
      sendAuthError(res, 404, "Студент с таким username не найден.", "student_not_found");
      return;
    }

    const existingRelationship = await get(
      `
        SELECT id
        FROM teacher_student_relationships
        WHERE teacher_id = ? AND student_id = ?
      `,
      [req.user.id, student.id],
    );

    if (existingRelationship) {
      sendAuthError(res, 409, "Этот студент уже связан с преподавателем.", "relationship_exists");
      return;
    }

    const pendingRequest = await get(
      `
        SELECT id
        FROM teacher_student_requests
        WHERE teacher_id = ? AND student_id = ? AND status = 'pending'
      `,
      [req.user.id, student.id],
    );

    if (pendingRequest) {
      sendAuthError(res, 409, "Активный запрос этому студенту уже отправлен.", "request_exists");
      return;
    }

    const timestamp = new Date().toISOString();
    const requestId = crypto.randomUUID();

    await run(
      `
        INSERT INTO teacher_student_requests (
          id, teacher_id, student_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'pending', ?, ?)
      `,
      [requestId, req.user.id, student.id, timestamp, timestamp],
    );

    await Promise.all([
      createNotification(student.id, {
        type: "request_received",
        title: "Новое приглашение",
        body: `${req.user.fullName} отправил(а) вам приглашение на обучение.`,
        link: "/notifications",
      }),
      createNotification(req.user.id, {
        type: "request_sent",
        title: "Приглашение отправлено",
        body: `Запрос для ${student.full_name} отправлен и ожидает ответа.`,
        link: "/notifications",
      }),
    ]);

    res.status(201).json({
      request: {
        id: requestId,
        studentId: student.id,
        fullName: student.full_name,
        email: student.email,
        status: "pending",
        createdAt: timestamp,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/student-requests/:id/accept", requireSession, requireRole("student"), async (req, res, next) => {
  try {
    const requestRecord = await get(
      `
        SELECT *
        FROM teacher_student_requests
        WHERE id = ? AND student_id = ? AND status = 'pending'
      `,
      [req.params.id, req.user.id],
    );

    if (!requestRecord) {
      sendAuthError(res, 404, "Запрос не найден.", "request_not_found");
      return;
    }

    const timestamp = new Date().toISOString();

    await run(
      `
        UPDATE teacher_student_requests
        SET status = 'accepted', updated_at = ?, responded_at = ?
        WHERE id = ?
      `,
      [timestamp, timestamp, requestRecord.id],
    );

    await run(
      `
        INSERT OR IGNORE INTO teacher_student_relationships (
          id, teacher_id, student_id, created_at
        ) VALUES (?, ?, ?, ?)
      `,
      [crypto.randomUUID(), requestRecord.teacher_id, requestRecord.student_id, timestamp],
    );

    await createNotification(requestRecord.teacher_id, {
      type: "request_accepted",
      title: "Приглашение принято",
      body: "Студент принял приглашение и связь активирована.",
      link: "/students",
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/student-requests/:id/decline", requireSession, requireRole("student"), async (req, res, next) => {
  try {
    const requestRecord = await get(
      `
        SELECT *
        FROM teacher_student_requests
        WHERE id = ? AND student_id = ? AND status = 'pending'
      `,
      [req.params.id, req.user.id],
    );

    if (!requestRecord) {
      sendAuthError(res, 404, "Запрос не найден.", "request_not_found");
      return;
    }

    const timestamp = new Date().toISOString();

    await run(
      `
        UPDATE teacher_student_requests
        SET status = 'declined', updated_at = ?, responded_at = ?
        WHERE id = ?
      `,
      [timestamp, timestamp, requestRecord.id],
    );

    await createNotification(requestRecord.teacher_id, {
      type: "request_declined",
      title: "Приглашение отклонено",
      body: "Студент отклонил приглашение.",
      link: "/notifications",
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/connected-users", requireSession, async (req, res, next) => {
  try {
    res.json({
      users: await getConnectedUsersForUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/conversations/unread-summary", requireSession, async (req, res, next) => {
  try {
    res.json({ unreadChats: await getUnreadChatCount(req.user.id) });
  } catch (error) {
    next(error);
  }
});
app.get("/api/conversations", requireSession, async (req, res, next) => {
  try {
    res.json({ conversations: await listConversationsForUser(req.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/conversations", requireSession, async (req, res, next) => {
  try {
    const payload = conversationCreateSchema.parse(req.body);

    if (!(await areUsersConnected(req.user.id, payload.participantId))) {
      sendAuthError(res, 403, "Conversation is available only for connected users.", "forbidden");
      return;
    }

    const participant = await get(
      `
        SELECT id, full_name, username, email, role, subject
        FROM users
        WHERE id = ?
      `,
      [payload.participantId],
    );

    if (!participant) {
      sendAuthError(res, 404, "User not found.", "user_not_found");
      return;
    }

    let conversation = await getConversationForUsers(req.user.id, payload.participantId);

    if (!conversation) {
      const timestamp = new Date().toISOString();
      const conversationId = crypto.randomUUID();

      await run(
        `
          INSERT INTO conversations (id, created_at, updated_at)
          VALUES (?, ?, ?)
        `,
        [conversationId, timestamp, timestamp],
      );

      await run(
        `
          INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
          VALUES (?, ?, ?), (?, ?, ?)
        `,
        [conversationId, req.user.id, timestamp, conversationId, payload.participantId, timestamp],
      );

      conversation = await getConversationForUsers(req.user.id, payload.participantId);
    }

    res.status(201).json({
      conversation: {
        id: conversation.id,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        participant: {
          id: participant.id,
          fullName: participant.full_name,
          username: participant.username || "",
          email: participant.email,
          role: participant.role,
          subject: participant.subject || "",
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/conversations/:id", requireSession, async (req, res, next) => {
  try {
    const data = await getConversationResponse(req.params.id, req.user.id);

    if (!data) {
      sendAuthError(res, 404, "Conversation not found.", "conversation_not_found");
      return;
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/conversations/:id/messages", requireSession, async (req, res, next) => {
  try {
    const payload = messageCreateSchema.parse(req.body);
    const conversation = await requireConversationMember(req.params.id, req.user.id);

    if (!conversation) {
      sendAuthError(res, 404, "Conversation not found.", "conversation_not_found");
      return;
    }

    const timestamp = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const recipients = await all(
      `
        SELECT u.id, u.full_name
        FROM conversation_members cm
        INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.conversation_id = ? AND cm.user_id != ?
      `,
      [req.params.id, req.user.id],
    );

    await run(
      `
        INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [messageId, req.params.id, req.user.id, payload.content, timestamp],
    );

    await run(
      `
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
      `,
      [timestamp, req.params.id],
    );

    await Promise.all(
      recipients.map((recipient) =>
        createNotification(recipient.id, {
          type: "incoming_message",
          title: `New message from ${req.user.fullName}`,
          body: payload.content.slice(0, 240),
          link: `/messages?conversationId=${encodeURIComponent(req.params.id)}`,
          meta: {
            conversationId: req.params.id,
            messageId,
            senderId: req.user.id,
            senderName: req.user.fullName,
          },
        }),
      ),
    );

    res.status(201).json({
      message: {
        id: messageId,
        content: payload.content,
        createdAt: timestamp,
        senderId: req.user.id,
        senderName: req.user.fullName,
        isOwn: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/schedule", requireSession, async (req, res, next) => {
  try {
    const requestedDate = req.query.date?.toString() || new Date().toISOString().slice(0, 10);
    const month = req.query.month?.toString() || requestedDate.slice(0, 7);

    const [entries, connectedUsers] = await Promise.all([
      all(
        `
          SELECT
            e.id,
            e.date,
            e.start_hour,
            e.end_hour,
            e.shared_event_id,
            e.title,
            e.details,
            e.lesson_link,
            e.status,
            e.partner_id,
            partner.full_name AS partner_name,
            partner.subject AS partner_subject,
            partner.role AS partner_role
          FROM schedule_entries e
          LEFT JOIN users partner ON partner.id = e.partner_id
          WHERE e.user_id = ? AND substr(e.date, 1, 7) = ?
          ORDER BY e.date ASC, e.start_hour ASC
        `,
        [req.user.id, month],
      ),
      getConnectedUsersForUser(req.user),
    ]);

    const normalizedEntries = entries.map((item) => ({
      id: item.id,
      date: item.date,
      startHour: item.start_hour,
      endHour: item.end_hour,
      sharedEventId: item.shared_event_id || null,
      title: item.title,
      details: item.details || "",
      lessonLink: item.lesson_link || "",
      status: item.status,
      participant: item.partner_id
        ? {
            id: item.partner_id,
            fullName: item.partner_name,
            subject: item.partner_subject || "",
            role: item.partner_role,
          }
        : null,
    }));

    const overviewMap = normalizedEntries.reduce((accumulator, entry) => {
      if (!accumulator[entry.date]) {
        accumulator[entry.date] = { date: entry.date, bookedHours: 0, sessions: 0 };
      }

      accumulator[entry.date].bookedHours += entry.endHour - entry.startHour;
      accumulator[entry.date].sessions += 1;
      return accumulator;
    }, {});

    const selectedDayEntries = normalizedEntries.filter((entry) => entry.date === requestedDate);
    const summary = buildDaySummary(selectedDayEntries);

    res.json({
      month,
      selectedDate: requestedDate,
      overview: Object.values(overviewMap),
      entries: selectedDayEntries,
      summary: {
        bookedHours: summary.bookedHours,
        freeHours: 24 - summary.bookedHours,
        busyRanges: summary.busyRanges,
        freeRanges: summary.freeRanges,
      },
      connectedUsers,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/schedule/entries", requireSession, async (req, res, next) => {
  try {
    const payload = scheduleEntrySchema.parse(req.body);

    if (payload.participantId && !(await areUsersConnected(req.user.id, payload.participantId))) {
      sendAuthError(res, 403, "You can schedule only with connected users.", "forbidden");
      return;
    }

    const overlappingEntry = await findScheduleOverlap(
      req.user.id,
      payload.date,
      payload.startHour,
      payload.endHour,
    );

    if (overlappingEntry) {
      sendAuthError(res, 409, "This time range overlaps an existing entry.", "schedule_overlap");
      return;
    }

    if (payload.participantId) {
      const participantOverlap = await findScheduleOverlap(
        payload.participantId,
        payload.date,
        payload.startHour,
        payload.endHour,
      );

      if (participantOverlap) {
        sendAuthError(
          res,
          409,
          "This time range overlaps an existing entry for the selected participant.",
          "participant_schedule_overlap",
        );
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const entryId = crypto.randomUUID();
    const sharedEventId = payload.participantId ? crypto.randomUUID() : null;

    await run(
      `
        INSERT INTO schedule_entries (
          id, user_id, partner_id, shared_event_id, title, details, lesson_link, date, start_hour, end_hour, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        entryId,
        req.user.id,
        payload.participantId || null,
        sharedEventId,
        payload.title,
        payload.details,
        payload.lessonLink || null,
        payload.date,
        payload.startHour,
        payload.endHour,
        payload.status,
        timestamp,
        timestamp,
      ],
    );

    let mirroredEntryId = null;

    if (payload.participantId) {
      mirroredEntryId = crypto.randomUUID();

      await run(
        `
          INSERT INTO schedule_entries (
            id, user_id, partner_id, shared_event_id, title, details, lesson_link, date, start_hour, end_hour, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          mirroredEntryId,
          payload.participantId,
          req.user.id,
          sharedEventId,
          payload.title,
          payload.details,
          payload.lessonLink || null,
          payload.date,
          payload.startHour,
          payload.endHour,
          payload.status,
          timestamp,
          timestamp,
        ],
      );
    }

    const participantEntry =
      mirroredEntryId && payload.participantId
        ? await getScheduleEntryDetails(mirroredEntryId, payload.participantId)
        : null;

    if (payload.participantId) {
      await Promise.all([
        createNotification(req.user.id, {
          type: "lesson_scheduled",
          title: "Lesson scheduled",
          body: `${payload.title} was added to your schedule for ${payload.date} at ${String(payload.startHour).padStart(2, "0")}:00.`,
          link: "/schedule",
          meta: {
            entryId,
            participantId: payload.participantId,
            sharedEventId,
          },
        }),
        createNotification(payload.participantId, {
          type: "lesson_scheduled",
          title: "New lesson scheduled",
          body: `${req.user.fullName} scheduled ${payload.title} for ${payload.date} at ${String(payload.startHour).padStart(2, "0")}:00.`,
          link: "/schedule",
          meta: {
            entryId: mirroredEntryId,
            participantId: req.user.id,
            sharedEventId,
          },
        }),
      ]);

    } else {
      await createNotification(req.user.id, {
        type: "lesson_scheduled",
        title: "Schedule updated",
        body: `${payload.title} was added to your schedule for ${payload.date} at ${String(payload.startHour).padStart(2, "0")}:00.`,
        link: "/schedule",
        meta: {
          entryId,
          sharedEventId,
        },
      });
    }

    res.status(201).json({
      entry: {
        id: entryId,
        date: payload.date,
        startHour: payload.startHour,
        endHour: payload.endHour,
        sharedEventId,
        title: payload.title,
        details: payload.details,
        lessonLink: payload.lessonLink || "",
        status: payload.status,
        participantId: payload.participantId || null,
      },
      sharedEntry: participantEntry
        ? {
            id: participantEntry.id,
            participantId: payload.participantId,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/conversations/:id/read", requireSession, async (req, res, next) => {
  try {
    const conversation = await requireConversationMember(req.params.id, req.user.id);

    if (!conversation) {
      sendAuthError(res, 404, "Conversation not found.", "conversation_not_found");
      return;
    }

    await updateConversationReadState(req.params.id, req.user.id);
    res.json({ unreadChats: await getUnreadChatCount(req.user.id) });
  } catch (error) {
    next(error);
  }
});
app.use((error, req, res, next) => {
  const message = buildErrorMessage(error);
  console.error(error);
  sendAuthError(res, 400, message, "request_failed");
});

const distPath = path.join(process.cwd(), "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).end();
      return;
    }

    res.sendFile(path.join(distPath, "index.html"));
  });
}

await initializeDatabase();
await ensureDefaultAdminAccount(config);
await cleanupExpiredArtifacts();
setInterval(cleanupExpiredArtifacts, 1000 * 60 * 15).unref();

if (isTelegramConfigured()) {
  if (config.telegramPollingEnabled) {
    configureTelegramPolling()
      .then((result) => {
        if (result.configured) {
          console.log("[telegram] polling mode enabled for local development");
          startTelegramPolling({
            onError(error) {
              console.error("[telegram] polling loop failed", error);
            },
          });
          return;
        }

        console.warn(`[telegram] polling not configured: ${result.reason}`);
      })
      .catch((error) => {
        console.error("[telegram] polling setup failed", error);
      });
  } else {
    ensureTelegramWebhook()
      .then((result) => {
        if (result.configured) {
          console.log(`[telegram] webhook ready: ${result.url}`);
          return;
        }

        console.warn(
          `[telegram] webhook not configured: ${result.reason}. Set TELEGRAM_WEBHOOK_URL to a public HTTPS endpoint like https://your-domain.com/api/integrations/telegram/webhook`,
        );
      })
      .catch((error) => {
        console.error("[telegram] webhook setup failed", error);
      });
  }

  dispatchDueTelegramLessonReminders().catch((error) => {
    console.error("[telegram] initial reminder dispatch failed", error);
  });

  setInterval(() => {
    dispatchDueTelegramLessonReminders().catch((error) => {
      console.error("[telegram] scheduled reminder dispatch failed", error);
    });
  }, 1000 * 60).unref();
}

app.listen(config.port, () => {
  console.log(`[repetly] api listening on ${config.apiBaseUrl}`);
});

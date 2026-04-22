import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { DropdownSelect } from "../components/DropdownSelect";
import { authRequest, useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

function createDefaultTelegramState() {
  return {
    configured: false,
    botUsername: "",
    connection: {
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
        reminderOffsetsMinutes: [1440, 60, 15],
      },
    },
  };
}

function formatDateTime(value) {
  if (!value) {
    return "Не указано";
  }

  return new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReminderOffsets(offsets) {
  if (!offsets?.length) {
    return "";
  }

  return offsets.join(", ");
}

export function SettingsPage() {
  const { refreshSession, user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState({
    themePreference: "system",
    notificationPreference: "all",
    privacyMode: "standard",
  });
  const [telegram, setTelegram] = useState(createDefaultTelegramState);
  const [linkSession, setLinkSession] = useState(null);
  const [email, setEmail] = useState("");
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sessionsCount, setSessionsCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);

  async function loadSettings() {
    const data = await authRequest("/api/settings");
    setSettings(data.settings);
    setSessionsCount(data.sessionsCount || 0);
    setEmail(user?.email || "");
    setTelegram(data.telegram || createDefaultTelegramState());
  }

  useEffect(() => {
    loadSettings().catch(() => {});
  }, [user?.email]);

  async function savePreferences() {
    setError("");
    setMessage("");
    await authRequest("/api/settings/preferences", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });

    if (settings.themePreference !== "system") {
      setTheme(settings.themePreference);
    }

    setMessage("Настройки аккаунта сохранены.");
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await authRequest("/api/settings/email", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      await refreshSession();
      setMessage("Email обновлён.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обновить email.");
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await authRequest("/api/settings/password", {
        method: "POST",
        body: JSON.stringify(passwords),
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Пароль обновлён.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обновить пароль.");
    }
  }

  async function revokeOtherSessions() {
    await authRequest("/api/settings/sessions/revoke-others", { method: "POST" });
    setSessionsCount(1);
    setMessage("Все другие активные сессии завершены.");
  }

  function updateTelegramPreference(key, value) {
    setTelegram((current) => ({
      ...current,
      connection: {
        ...current.connection,
        preferences: {
          ...current.connection.preferences,
          [key]: value,
        },
      },
    }));
  }

  async function saveTelegramSettings() {
    setError("");
    setMessage("");
    setIsSavingTelegram(true);

    try {
      const nextTelegram = await authRequest("/api/integrations/telegram/preferences", {
        method: "PATCH",
        body: JSON.stringify(telegram.connection.preferences),
      });
      setTelegram(nextTelegram);
      setMessage("Настройки уведомлений Telegram сохранены.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось сохранить настройки Telegram.");
    } finally {
      setIsSavingTelegram(false);
    }
  }

  async function startTelegramLinking() {
    setError("");
    setMessage("");
    setIsLinkingTelegram(true);

    try {
      const data = await authRequest("/api/integrations/telegram/link", { method: "POST" });
      setTelegram(data.telegram || telegram);
      setLinkSession({
        code: data.code,
        deepLinkUrl: data.deepLinkUrl,
        expiresAt: data.expiresAt,
      });
      setMessage("Код подтверждения создан. Откройте Telegram-бота или отправьте код вручную.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось начать привязку Telegram.");
    } finally {
      setIsLinkingTelegram(false);
    }
  }

  async function handleTelegramUnlink() {
    setError("");
    setMessage("");
    setIsUnlinkingTelegram(true);

    try {
      const data = await authRequest("/api/integrations/telegram/link", { method: "DELETE" });
      setTelegram(data);
      setLinkSession(null);
      setMessage("Telegram отвязан от профиля.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отключить Telegram.");
    } finally {
      setIsUnlinkingTelegram(false);
    }
  }

  return (
    <AppLayout title="Настройки" eyebrow="Аккаунт" contentMode="custom">
      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head">
            <div>
              <h2>Параметры аккаунта</h2>
              <p>Тема, уведомления, приватность и доставка сообщений в Telegram.</p>
            </div>
          </div>

          {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
          {message ? <div className="auth-alert auth-alert--success">{message}</div> : null}

          <div className="profile-form">
            <label className="auth-field">
              <span>Тема интерфейса</span>
              <DropdownSelect
                value={settings.themePreference}
                onChange={(themePreference) => setSettings((current) => ({ ...current, themePreference }))}
                options={[
                  { value: "system", label: "Как в системе" },
                  { value: "light", label: "Светлая" },
                  { value: "dark", label: "Тёмная" },
                ]}
              />
            </label>

            <label className="auth-field">
              <span>Уведомления на сайте</span>
              <DropdownSelect
                value={settings.notificationPreference}
                onChange={(notificationPreference) =>
                  setSettings((current) => ({ ...current, notificationPreference }))
                }
                options={[
                  { value: "all", label: "Все уведомления" },
                  { value: "important", label: "Только важные" },
                  { value: "muted", label: "Минимум" },
                ]}
              />
            </label>

            <label className="auth-field">
              <span>Режим приватности</span>
              <DropdownSelect
                value={settings.privacyMode}
                onChange={(privacyMode) => setSettings((current) => ({ ...current, privacyMode }))}
                options={[
                  { value: "standard", label: "Стандартный" },
                  { value: "private", label: "Приватный" },
                ]}
              />
            </label>

            <button className="auth-submit" type="button" onClick={savePreferences}>
              Сохранить настройки аккаунта
            </button>
          </div>
        </article>

        <div className="side-column">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Интеграция Telegram</h2>
                <p>Подтверждение через бота, статус привязки и настройки доставки уведомлений.</p>
              </div>
            </div>

            {!telegram.configured ? (
              <div className="management-list">
                <div className="management-list__item">
                  <strong>Telegram не настроен</strong>
                  <span>Добавьте имя бота, токен и секрет вебхука в переменные окружения сервера.</span>
                </div>
              </div>
            ) : (
              <div className="telegram-settings">
                <div className="telegram-status-card">
                  <strong>{telegram.connection.isLinked ? "Подключён" : "Не подключён"}</strong>
                  <span>
                    Бот: @{telegram.botUsername}
                    {telegram.connection.telegramUsername ? ` • ${telegram.connection.telegramUsername}` : ""}
                  </span>
                  <small>Подключён: {formatDateTime(telegram.connection.linkedAt)}</small>
                  <small>Последняя активность: {formatDateTime(telegram.connection.lastInteractionAt)}</small>
                </div>

                <div className="telegram-actions">
                  <button className="auth-submit" type="button" onClick={startTelegramLinking} disabled={isLinkingTelegram}>
                    {isLinkingTelegram
                      ? "Создаём код..."
                      : telegram.connection.isLinked
                        ? "Перепривязать Telegram"
                        : "Подключить Telegram"}
                  </button>
                  {telegram.connection.isLinked ? (
                    <button
                      className="notification-button notification-button--decline"
                      type="button"
                      onClick={handleTelegramUnlink}
                      disabled={isUnlinkingTelegram}
                    >
                      {isUnlinkingTelegram ? "Отключаем..." : "Отвязать Telegram"}
                    </button>
                  ) : null}
                </div>

                {linkSession ? (
                  <div className="telegram-link-card">
                    <strong>Код подтверждения Telegram</strong>
                    <span>Действует до: {formatDateTime(linkSession.expiresAt)}</span>
                    <div className="telegram-link-card__code">{linkSession.code}</div>
                    <a className="auth-submit" href={linkSession.deepLinkUrl} target="_blank" rel="noreferrer">
                      Открыть бота для подтверждения
                    </a>
                    <small>Если бот открылся без подтверждения, отправьте этот код вручную.</small>
                  </div>
                ) : null}

                <div className="telegram-preferences">
                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={telegram.connection.preferences.notificationsEnabled}
                      onChange={(event) => updateTelegramPreference("notificationsEnabled", event.target.checked)}
                    />
                    <span>Включить доставку в Telegram</span>
                  </label>

                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={telegram.connection.preferences.messages}
                      onChange={(event) => updateTelegramPreference("messages", event.target.checked)}
                    />
                    <span>Входящие сообщения с сайта</span>
                  </label>

                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={telegram.connection.preferences.system}
                      onChange={(event) => updateTelegramPreference("system", event.target.checked)}
                    />
                    <span>Системные уведомления</span>
                  </label>

                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={telegram.connection.preferences.lessons}
                      onChange={(event) => updateTelegramPreference("lessons", event.target.checked)}
                    />
                    <span>Занятия и обновления расписания</span>
                  </label>

                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={telegram.connection.preferences.reminders}
                      onChange={(event) => updateTelegramPreference("reminders", event.target.checked)}
                    />
                    <span>Напоминания о занятиях</span>
                  </label>

                  <label className="auth-field" htmlFor="telegram-reminders">
                    <span>Интервалы напоминаний в минутах</span>
                    <input
                      id="telegram-reminders"
                      className="auth-input"
                      value={formatReminderOffsets(telegram.connection.preferences.reminderOffsetsMinutes)}
                      onChange={(event) =>
                        updateTelegramPreference(
                          "reminderOffsetsMinutes",
                          event.target.value
                            .split(",")
                            .map((item) => Number(item.trim()))
                            .filter((item) => Number.isInteger(item) && item > 0),
                        )
                      }
                      placeholder="1440, 60, 15"
                    />
                  </label>

                  <button className="auth-submit" type="button" onClick={saveTelegramSettings} disabled={isSavingTelegram}>
                    {isSavingTelegram ? "Сохраняем..." : "Сохранить настройки Telegram"}
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Изменить email</h2>
                <p>Обновите адрес для входа и связи.</p>
              </div>
            </div>
            <form className="profile-form" onSubmit={handleEmailSubmit}>
              <input className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <button className="auth-submit" type="submit">Обновить email</button>
            </form>
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Изменить пароль</h2>
                <p>Смените пароль и защитите аккаунт.</p>
              </div>
            </div>
            <form className="profile-form" onSubmit={handlePasswordSubmit}>
              <input
                className="auth-input"
                type="password"
                placeholder="Текущий пароль"
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Новый пароль"
                value={passwords.newPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                }
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Подтвердите новый пароль"
                value={passwords.confirmPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))
                }
              />
              <button className="auth-submit" type="submit">Обновить пароль</button>
            </form>
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Сессии и безопасность</h2>
                <p>Посмотрите активные сессии и завершите все, кроме текущей.</p>
              </div>
            </div>
            <div className="management-list">
              <div className="management-list__item">
                <strong>{sessionsCount}</strong>
                <span>Активных сессий</span>
              </div>
            </div>
            <button className="notification-button notification-button--decline" type="button" onClick={revokeOtherSessions}>
              Завершить другие сессии
            </button>
          </article>
        </div>
      </section>
    </AppLayout>
  );
}

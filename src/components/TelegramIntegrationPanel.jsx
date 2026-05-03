import { useEffect, useState } from "react";
import { authRequest, useAuth } from "../auth/AuthContext";

function createDefaultTelegramState() {
  return {
    configured: false,
    botUsername: "",
    connection: {
      isLinked: false,
      telegramUsername: "",
      linkedAt: null,
      lastInteractionAt: null,
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
  return offsets?.length ? offsets.join(", ") : "";
}

export function TelegramIntegrationPanel() {
  const { user } = useAuth();
  const [telegram, setTelegram] = useState(createDefaultTelegramState);
  const [linkSession, setLinkSession] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);

  useEffect(() => {
    async function loadTelegramSettings() {
      const data = await authRequest("/api/settings");
      setTelegram(data.telegram || createDefaultTelegramState());
    }

    loadTelegramSettings().catch(() => {});
  }, [user?.id]);

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
    <section className="dashboard-grid dashboard-grid--feature">
      <article className="panel panel--focus">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>Интеграция Telegram</h2>
            <p>Привязка через бота, статус подключения и настройки доставки уведомлений.</p>
          </div>
        </div>

        {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
        {message ? <div className="auth-alert auth-alert--success">{message}</div> : null}

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
              <strong>{telegram.connection.isLinked ? "Подключен" : "Не подключен"}</strong>
              <span>
                Бот: @{telegram.botUsername}
                {telegram.connection.telegramUsername ? ` · ${telegram.connection.telegramUsername}` : ""}
              </span>
              <small>Подключен: {formatDateTime(telegram.connection.linkedAt)}</small>
              <small>Последняя активность: {formatDateTime(telegram.connection.lastInteractionAt)}</small>
            </div>

            <div className="telegram-actions">
              <button className="auth-submit" type="button" onClick={startTelegramLinking} disabled={isLinkingTelegram}>
                {isLinkingTelegram
                  ? "Создаем код..."
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
    </section>
  );
}

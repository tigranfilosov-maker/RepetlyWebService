import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";
import { DropdownSelect } from "../components/DropdownSelect";
import { SiteMark } from "../components/SiteMark";
import { useSiteSettings } from "../site/SiteSettingsContext";

function AdminStat({ label, value, accent = "" }) {
  return (
    <article className={`panel dashboard-stat${accent ? ` dashboard-stat--${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function planLabel(plan) {
  const labels = {
    free: "Старт",
    pro: "Про",
    business: "Бизнес",
    enterprise: "Корпоративный",
  };

  return labels[plan] || plan;
}

const audienceOptions = [
  { value: "all", label: "Всем пользователям" },
  { value: "students", label: "Только ученикам" },
  { value: "teachers", label: "Только преподавателям" },
  { value: "selected", label: "Выборочно" },
];

export function AdminPage() {
  const { siteSettings } = useSiteSettings();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeSection, setActiveSection] = useState("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    audience: "all",
    title: "",
    body: "",
    userIds: [],
  });

  useEffect(() => {
    authRequest("/api/admin/overview")
      .then((data) => setOverview(data))
      .catch(() => {});

    authRequest("/api/admin/users")
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: `${user.fullName} (${user.role === "teacher" ? "преподаватель" : "ученик"})`,
      })),
    [users],
  );

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSiteAvatarUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Поддерживаются только JPG, PNG, WEBP и GIF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Размер файла не должен превышать 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSource(String(reader.result || ""));
      setSelectedFileName(file.name);
      resetMessages();
    };
    reader.onerror = () => setError("Не удалось загрузить изображение.");
    reader.readAsDataURL(file);
  }

  async function handleApplySiteAvatar(croppedImage) {
    setIsSavingSite(true);

    try {
      await updateSiteSettings({ brandAvatar: croppedImage });
      setSuccess("Аватар сайта обновлён.");
      setCropSource("");
      resetFileInput();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обновить аватар сайта.");
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleRemoveSiteAvatar() {
    setIsSavingSite(true);
    resetMessages();

    try {
      await updateSiteSettings({ brandAvatar: "" });
      setSelectedFileName("");
      setSuccess("Аватар сайта удалён.");
      resetFileInput();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось удалить аватар сайта.");
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleSendNotifications(event) {
    event.preventDefault();
    resetMessages();
    setIsSendingNotifications(true);

    try {
      const data = await authRequest("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify(notificationForm),
      });

      setSuccess(`Уведомления отправлены: ${data.sentCount}.`);
      setNotificationForm({
        audience: "all",
        title: "",
        body: "",
        userIds: [],
      });
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отправить уведомления.");
    } finally {
      setIsSendingNotifications(false);
    }
  }

  return (
    <AppLayout title="Админ панель" eyebrow="Обзор сервиса" contentMode="custom">
      <div className="admin-page">
        <div className="admin-sections">
          <button
            type="button"
            className={`landing-button${activeSection === "overview" ? "" : " landing-button--ghost"}`}
            onClick={() => {
              resetMessages();
              setActiveSection("overview");
            }}
          >
            Обзор
          </button>
          <button
            type="button"
            className={`landing-button${activeSection === "site" ? "" : " landing-button--ghost"}`}
            onClick={() => {
              resetMessages();
              setActiveSection("site");
            }}
          >
            Сайт
          </button>
          <button
            type="button"
            className={`landing-button${activeSection === "notifications" ? "" : " landing-button--ghost"}`}
            onClick={() => {
              resetMessages();
              setActiveSection("notifications");
            }}
          >
            Уведомления
          </button>
        </div>

        {activeSection === "overview" ? (
          <div className="admin-page__stack">
            <section className="stats-grid">
              <AdminStat label="Всего пользователей" value={overview?.totalUsers ?? "—"} accent="wide" />
              <AdminStat label="Зарегистрированных устройств" value={overview?.registeredDevices ?? "—"} />
              <AdminStat label="Активных сессий" value={overview?.activeSessions ?? "—"} accent="blue" />
              <AdminStat label="Людей на тарифе" value={overview?.activePaidUsers ?? "—"} />
            </section>

            <section className="dashboard-grid dashboard-grid--feature">
              <article className="panel panel--focus">
                <div className="panel__head">
                  <div>
                    <h2>Пользователи и тарифы</h2>
                    <p>Сводка по аккаунтам, ролям, устройствам и распределению по планам.</p>
                  </div>
                </div>

                <div className="management-grid">
                  <div className="management-card">
                    <strong>{overview?.totalTeachers ?? "—"}</strong>
                    <span>Преподавателей</span>
                  </div>
                  <div className="management-card">
                    <strong>{overview?.totalStudents ?? "—"}</strong>
                    <span>Учеников</span>
                  </div>
                  <div className="management-card">
                    <strong>{overview?.recentUsers ?? "—"}</strong>
                    <span>Новых аккаунтов за 7 дней</span>
                  </div>
                  <div className="management-card">
                    <strong>{overview?.freeUsers ?? "—"}</strong>
                    <span>Пользователей на тарифе «Старт»</span>
                  </div>
                  <div className="management-card">
                    <strong>{overview?.devicesLast30Days ?? "—"}</strong>
                    <span>Активных устройств за 30 дней</span>
                  </div>
                  <div className="management-card">
                    <strong>{overview?.totalAdmins ?? "—"}</strong>
                    <span>Администраторов</span>
                  </div>
                </div>

                <div className="management-list">
                  {(overview?.planBreakdown || []).map((item) => (
                    <div key={item.plan} className="management-list__item">
                      <strong>{planLabel(item.plan)}</strong>
                      <span>{item.count} пользователей</span>
                    </div>
                  ))}
                  {!overview?.planBreakdown?.length ? (
                    <div className="empty-state">Распределение по тарифам пока недоступно.</div>
                  ) : null}
                </div>
              </article>

              <div className="side-column">
                <article className="panel">
                  <div className="panel__head panel__head--tight">
                    <div>
                      <h2>Активность сервиса</h2>
                      <p>Заявки, связи, переписки и уведомления.</p>
                    </div>
                  </div>
                  <div className="summary-metrics">
                    <div className="summary-metric">
                      <strong>{overview?.pendingRequests ?? "—"}</strong>
                      <span>Заявок ожидают ответа</span>
                    </div>
                    <div className="summary-metric">
                      <strong>{overview?.activeRelationships ?? "—"}</strong>
                      <span>Активных связей</span>
                    </div>
                    <div className="summary-metric">
                      <strong>{overview?.totalConversations ?? "—"}</strong>
                      <span>Всего диалогов</span>
                    </div>
                    <div className="summary-metric">
                      <strong>{overview?.totalMessages ?? "—"}</strong>
                      <span>Всего сообщений</span>
                    </div>
                  </div>
                  <div className="summary-range summary-range--busy">
                    Непрочитанных уведомлений: {overview?.unreadNotifications ?? "—"}
                  </div>
                </article>

                <article className="panel">
                  <div className="panel__head panel__head--tight">
                    <div>
                      <h2>Уроки в системе</h2>
                      <p>Распределение всех записей расписания по статусам.</p>
                    </div>
                  </div>
                  <div className="summary-block">
                    <div className="summary-range">Всего уроков: {overview?.lessons?.total ?? "—"}</div>
                    <div className="summary-range">Запланировано: {overview?.lessons?.planned ?? "—"}</div>
                    <div className="summary-range">Подтверждено: {overview?.lessons?.confirmed ?? "—"}</div>
                    <div className="summary-range summary-range--busy">Завершено: {overview?.lessons?.completed ?? "—"}</div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        ) : null}

        {activeSection === "site" ? (
          <div className="admin-page__stack">
            {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
            {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

            <section className="dashboard-grid dashboard-grid--feature">
              <article className="panel panel--focus">
                <div className="panel__head">
                  <div>
                    <h2>Сайт</h2>
                    <p>Настройка квадратной аватарки сайта. Доступно только администратору.</p>
                  </div>
                </div>

                <div className="site-brand-editor">
                  <div className="site-brand-editor__preview">
                    <SiteMark className="site-brand-editor__mark" />
                    <div>
                      <strong>{siteSettings.brandName || "Repetly"}</strong>
                      <span>Квадрат 1:1, как аватарка сайта в шапке и на публичных экранах.</span>
                    </div>
                  </div>

                  <div className="file-input">
                    <input
                      ref={fileInputRef}
                      className="file-input__control"
                      id="site-avatar-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleSiteAvatarUpload}
                    />
                    <label className="file-input__button landing-button landing-button--ghost" htmlFor="site-avatar-file">
                      Выберите файл
                    </label>
                    <span className={`file-input__name${selectedFileName ? "" : " file-input__name--placeholder"}`}>
                      {selectedFileName || "Файл не выбран"}
                    </span>
                  </div>

                  <div className="site-brand-editor__actions">
                    <button
                      className="landing-button landing-button--ghost"
                      type="button"
                      onClick={handleRemoveSiteAvatar}
                      disabled={isSavingSite}
                    >
                      Убрать аватар
                    </button>
                  </div>
                </div>
              </article>
            </section>
          </div>
        ) : null}

        {activeSection === "notifications" ? (
          <div className="admin-page__stack">
            {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
            {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

            <section className="dashboard-grid dashboard-grid--feature">
              <article className="panel panel--focus">
                <div className="panel__head">
                  <div>
                    <h2>Рассылка уведомлений</h2>
                    <p>Можно отправить уведомления всем, только ученикам, только преподавателям или выборочно.</p>
                  </div>
                </div>

                <form className="profile-form" onSubmit={handleSendNotifications}>
                  <label className="auth-field" htmlFor="admin-notify-audience">
                    <span>Кому отправить</span>
                    <DropdownSelect
                      value={notificationForm.audience}
                      onChange={(audience) =>
                        setNotificationForm((current) => ({
                          ...current,
                          audience,
                          userIds: audience === "selected" ? current.userIds : [],
                        }))
                      }
                      options={audienceOptions}
                      placeholder="Выберите аудиторию"
                    />
                  </label>

                  {notificationForm.audience === "selected" ? (
                    <label className="auth-field" htmlFor="admin-notify-users">
                      <span>Пользователи</span>
                      <DropdownSelect
                        value={notificationForm.userIds}
                        onChange={(userIds) =>
                          setNotificationForm((current) => ({ ...current, userIds }))
                        }
                        options={userOptions}
                        multiple
                        placeholder="Выберите пользователей"
                      />
                    </label>
                  ) : null}

                  <label className="auth-field" htmlFor="admin-notify-title">
                    <span>Заголовок</span>
                    <input
                      id="admin-notify-title"
                      className="auth-input"
                      value={notificationForm.title}
                      onChange={(event) =>
                        setNotificationForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Например: Обновление расписания"
                    />
                  </label>

                  <label className="auth-field" htmlFor="admin-notify-body">
                    <span>Текст уведомления</span>
                    <textarea
                      id="admin-notify-body"
                      className="auth-input schedule-textarea"
                      value={notificationForm.body}
                      onChange={(event) =>
                        setNotificationForm((current) => ({ ...current, body: event.target.value }))
                      }
                      placeholder="Введите текст уведомления"
                    />
                  </label>

                  <div className="site-brand-editor__actions">
                    <button className="auth-submit" type="submit" disabled={isSendingNotifications}>
                      {isSendingNotifications ? "Отправка..." : "Отправить уведомления"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="panel">
                <div className="panel__head panel__head--tight">
                  <div>
                    <h2>Аудитории</h2>
                    <p>Быстрые варианты рассылки и точечная отправка по конкретным пользователям.</p>
                  </div>
                </div>

                <div className="management-list">
                  <div className="management-list__item">
                    <strong>Всем пользователям</strong>
                    <span>Рассылка всем активным ученикам и преподавателям.</span>
                  </div>
                  <div className="management-list__item">
                    <strong>Только ученикам</strong>
                    <span>Уведомление только аккаунтам с ролью student.</span>
                  </div>
                  <div className="management-list__item">
                    <strong>Только преподавателям</strong>
                    <span>Уведомление только аккаунтам с ролью teacher.</span>
                  </div>
                  <div className="management-list__item">
                    <strong>Выборочно</strong>
                    <span>Можно выбрать любого пользователя из списка ниже без массовой отправки.</span>
                  </div>
                </div>
              </article>
            </section>
          </div>
        ) : null}

        {cropSource ? (
          <ImageCropDialog
            source={cropSource}
            title="Обрезка аватарки сайта"
            description="Подвигайте изображение внутри квадрата и примените результат."
            onCancel={() => {
              setCropSource("");
              resetFileInput();
            }}
            onApply={handleApplySiteAvatar}
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

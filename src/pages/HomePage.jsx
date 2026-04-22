import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest, useAuth } from "../auth/AuthContext";

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function DashboardStat({ label, value, accent }) {
  return (
    <article className={`panel dashboard-stat${accent ? ` dashboard-stat--${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    authRequest("/api/dashboard-summary")
      .then((data) => setSummary(data))
      .catch(() => {});
  }, []);

  return (
    <AppLayout title="Главная" eyebrow="Панель управления" contentMode="custom">
      <section className="stats-grid">
        <DashboardStat
          label="Ближайшее занятие"
          value={
            summary?.upcomingLesson
              ? `${formatDate(summary.upcomingLesson.date)} • ${summary.upcomingLesson.timeRange}`
              : "Запланированных занятий пока нет"
          }
          accent="wide"
        />
        <DashboardStat label="Занятий на неделе" value={summary?.lessonsThisWeek ?? "—"} />
        <DashboardStat label="Непрочитанные сообщения" value={summary?.unreadMessages ?? "—"} accent="blue" />
        <DashboardStat label="Непрочитанные уведомления" value={summary?.unreadNotifications ?? "—"} />
      </section>

      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head">
            <div>
              <h2>Итоги недели</h2>
              <p>{summary?.weeklySummary || "Собираем сводку по аккаунту..."}</p>
            </div>
          </div>

          <div className="management-grid">
            <div className="management-card">
              <strong>{summary?.todaysLessons ?? "—"}</strong>
              <span>Занятий сегодня</span>
            </div>
            <div className="management-card">
              <strong>{summary?.freeHoursToday ?? "—"}</strong>
              <span>Свободных часов сегодня</span>
            </div>
            <div className="management-card">
              <strong>{summary?.pendingRequests ?? "—"}</strong>
              <span>{user?.role === "teacher" ? "Ожидающих заявок" : "Входящих приглашений"}</span>
            </div>
          </div>
        </article>

        <div className="side-column">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>{user?.role === "teacher" ? "Активные ученики" : "Подключённые преподаватели"}</h2>
                <p>Текущее количество активных связей в вашем аккаунте.</p>
              </div>
            </div>
            <div className="summary-metric">
              <strong>{summary?.connectedCount ?? "—"}</strong>
              <span>{user?.role === "teacher" ? "учеников в работе" : "преподавателей подключено"}</span>
            </div>
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Обновление расписания</h2>
                <p>Последнее изменение календаря.</p>
              </div>
            </div>
            <div className="summary-range">
              {summary?.recentScheduleUpdatedAt
                ? new Date(summary.recentScheduleUpdatedAt).toLocaleString("ru-RU")
                : "Изменений пока не было"}
            </div>
            <div className="summary-range summary-range--busy">
              {summary?.upcomingLesson?.partnerName
                ? `Следующее занятие: ${summary.upcomingLesson.partnerName}`
                : "Следующее занятие пока не назначено"}
            </div>
          </article>
        </div>
      </section>
    </AppLayout>
  );
}

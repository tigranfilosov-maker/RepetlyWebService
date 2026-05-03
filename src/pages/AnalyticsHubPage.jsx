import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";

const numberFormatter = new Intl.NumberFormat("ru-RU");

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatHours(value) {
  const number = Number(value || 0);
  return `${numberFormatter.format(Number.isInteger(number) ? number : Number(number.toFixed(1)))} ч`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

function StatCard({ label, value, detail, accent = "" }) {
  return (
    <article className={`panel dashboard-stat analytics-stat${accent ? ` analytics-stat--${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function EmptyAnalytics({ text = "Данных пока нет." }) {
  return <div className="empty-state analytics-empty">{text}</div>;
}

function LessonsLineChart({ data }) {
  const width = 680;
  const height = 260;
  const padding = 32;
  const maxHours = Math.max(1, ...data.map((item) => Number(item.hours || 0)));
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = padding + index * step;
    const y = height - padding - (Number(item.hours || 0) / maxHours) * (height - padding * 2);
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="analytics-chart analytics-chart--line">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="График часов занятий за 14 дней">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <polyline points={polyline} />
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="5" />
            <text x={point.x} y={height - 8} textAnchor="middle">
              {formatDate(point.date)}
            </text>
            {point.hours > 0 ? (
              <text x={point.x} y={Math.max(18, point.y - 12)} textAnchor="middle" className="analytics-chart__value">
                {point.hours}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function FinanceBars({ data }) {
  const maxValue = Math.max(1, ...data.map((item) => item.billableHours + item.plannedHours + item.cancelledHours));

  return (
    <div className="finance-bars">
      {data.map((item) => {
        const billable = Math.round((item.billableHours / maxValue) * 100);
        const planned = Math.round((item.plannedHours / maxValue) * 100);
        const cancelled = Math.round((item.cancelledHours / maxValue) * 100);

        return (
          <div key={item.month} className="finance-bars__item">
            <div className="finance-bars__track" aria-label={`${item.label}: ${formatHours(item.billableHours + item.plannedHours)}`}>
              <span className="finance-bars__segment finance-bars__segment--billable" style={{ height: `${billable}%` }} />
              <span className="finance-bars__segment finance-bars__segment--planned" style={{ height: `${planned}%` }} />
              <span className="finance-bars__segment finance-bars__segment--cancelled" style={{ height: `${cancelled}%` }} />
            </div>
            <strong>{item.label}</strong>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsSection({ data }) {
  const hasDailyData = data.charts.daily.some((item) => item.hours > 0);

  return (
    <div className="combined-page__content">
      <section className="stats-grid">
        <StatCard label="Занятий в этом месяце" value={formatNumber(data.stats.totalLessons)} detail={`${formatHours(data.stats.totalHours)} в расписании`} accent="wide" />
        <StatCard label="Активных учеников" value={formatNumber(data.stats.activeStudents)} detail={`${formatNumber(data.stats.groups)} групп`} />
        <StatCard label="Проведено" value={formatNumber(data.stats.completedLessons)} detail={`${data.stats.completionRate}% от всех записей`} accent="green" />
        <StatCard label="Ожидается" value={formatNumber(data.stats.upcomingLessons)} detail={formatHours(data.stats.upcomingHours)} />
      </section>

      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus analytics-panel">
          <div className="panel__head">
            <div>
              <h2>Загрузка за 14 дней</h2>
              <p>График строится по реальным занятиям из календаря, отменённые записи не учитываются.</p>
            </div>
          </div>
          {hasDailyData ? <LessonsLineChart data={data.charts.daily} /> : <EmptyAnalytics text="За последние 14 дней занятий нет." />}
        </article>

        <div className="side-column">
          <article className="panel analytics-panel">
            <div className="panel__head">
              <div>
                <h2>Ученики по нагрузке</h2>
                <p>Топ по часам в текущем месяце.</p>
              </div>
            </div>
            <div className="analytics-list">
              {data.topStudents.map((student) => (
                <div key={student.name} className="analytics-row">
                  <div>
                    <strong>{student.name}</strong>
                    <span>{formatNumber(student.lessons)} занятий</span>
                  </div>
                  <b>{formatHours(student.hours)}</b>
                </div>
              ))}
              {!data.topStudents.length ? <EmptyAnalytics /> : null}
            </div>
          </article>

          <article className="panel analytics-panel">
            <div className="panel__head">
              <div>
                <h2>Предметы</h2>
                <p>Сколько учеников привязано к предметам профиля.</p>
              </div>
            </div>
            <div className="analytics-tags">
              {data.subjects.map((subject) => (
                <span key={subject.name}>
                  {subject.name}
                  <b>{formatNumber(subject.students)}</b>
                </span>
              ))}
              {!data.subjects.length ? <EmptyAnalytics text="Предметы ещё не добавлены." /> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="analytics-grid">
        <article className="panel analytics-panel">
          <div className="panel__head">
            <div>
              <h2>Дни недели</h2>
              <p>Распределение занятий за текущий месяц.</p>
            </div>
          </div>
          <div className="weekday-load">
            {data.charts.weekdays.map((day) => (
              <div key={day.label} className="weekday-load__item">
                <span>{day.label}</span>
                <strong>{formatHours(day.hours)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel analytics-panel">
          <div className="panel__head">
            <div>
              <h2>Ближайшие занятия</h2>
              <p>Следующие записи из календаря.</p>
            </div>
          </div>
          <div className="analytics-list">
            {data.upcoming.map((lesson) => (
              <div key={lesson.id} className="analytics-row">
                <div>
                  <strong>{lesson.title}</strong>
                  <span>{lesson.partnerName}</span>
                </div>
                <b>{formatDate(lesson.date)}, {lesson.timeRange}</b>
              </div>
            ))}
            {!data.upcoming.length ? <EmptyAnalytics text="Ближайших занятий нет." /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function FinanceSection({ data }) {
  const totalFinanceHours = data.charts.monthlyFinance.reduce(
    (sum, item) => sum + item.billableHours + item.plannedHours,
    0,
  );

  return (
    <div className="combined-page__content">
      <section className="stats-grid">
        <StatCard label="Оплачиваемые часы" value={formatHours(data.stats.completedHours)} detail="Проведённые занятия месяца" accent="wide" />
        <StatCard label="Плановые часы" value={formatHours(data.stats.upcomingHours)} detail="Ещё впереди" />
        <StatCard label="Потеряно из-за отмен" value={formatHours(data.stats.cancelledHours)} detail={`${data.stats.cancellationRate}% отмен`} />
        <StatCard label="Запросов на отмену" value={formatNumber(data.stats.pendingCancelRequests)} detail="Ожидают решения" />
      </section>

      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus analytics-panel">
          <div className="panel__head">
            <div>
              <h2>Финансовая нагрузка по месяцам</h2>
              <p>Реальные часы из расписания: проведённые, будущие и отменённые занятия.</p>
            </div>
          </div>
          {totalFinanceHours > 0 ? <FinanceBars data={data.charts.monthlyFinance} /> : <EmptyAnalytics text="В расписании пока нет часов для финансовой сводки." />}
          <div className="finance-legend">
            <span><i className="finance-legend__billable" /> проведено</span>
            <span><i className="finance-legend__planned" /> запланировано</span>
            <span><i className="finance-legend__cancelled" /> отменено</span>
          </div>
        </article>

        <div className="side-column">
          <article className="panel analytics-panel">
            <div className="panel__head">
              <div>
                <h2>Домашние задания</h2>
                <p>Косвенный показатель оплачиваемой работы.</p>
              </div>
            </div>
            <div className="analytics-list">
              <div className="analytics-row">
                <div>
                  <strong>Выдано</strong>
                  <span>Активные задания</span>
                </div>
                <b>{formatNumber(data.stats.homeworkAssigned)}</b>
              </div>
              <div className="analytics-row">
                <div>
                  <strong>Выполнено</strong>
                  <span>Закрытые задания</span>
                </div>
                <b>{formatNumber(data.stats.homeworkDone)}</b>
              </div>
            </div>
          </article>

          <article className="panel analytics-panel">
            <div className="panel__head">
              <div>
                <h2>Что считается финансами</h2>
                <p>Пока в системе нет платежей и ставки урока, раздел не показывает выдуманные рубли.</p>
              </div>
            </div>
            <div className="finance-note">
              <strong>{formatHours(data.stats.completedHours + data.stats.upcomingHours)}</strong>
              <span>часов можно использовать для расчёта дохода, когда будет задана ставка занятия.</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export function AnalyticsHubPage() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    authRequest("/api/analytics/overview")
      .then((result) => {
        if (isMounted) {
          setData(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.payload?.message || "Не удалось загрузить аналитику.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const periodLabel = useMemo(() => {
    if (!data?.period) {
      return "Отчёты и финансы";
    }

    return `${new Date(data.period.monthStart).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    })}`;
  }, [data]);

  return (
    <AppLayout title="Аналитика" eyebrow={periodLabel} contentMode="custom">
      <section className="combined-page">
        <div className="combined-page__tabs">
          <button
            type="button"
            className={`combined-page__tab${activeTab === "analytics" ? " combined-page__tab--active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Аналитика
          </button>
          <button
            type="button"
            className={`combined-page__tab${activeTab === "finance" ? " combined-page__tab--active" : ""}`}
            onClick={() => setActiveTab("finance")}
          >
            Финансы
          </button>
        </div>

        {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
        {!data && !error ? <EmptyAnalytics text="Загружаем реальные данные..." /> : null}
        {data && activeTab === "analytics" ? <AnalyticsSection data={data} /> : null}
        {data && activeTab === "finance" ? <FinanceSection data={data} /> : null}
      </section>
    </AppLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { CloseIcon, ReplaceIcon } from "../components/icons";
import { authRequest, useAuth } from "../auth/AuthContext";

const STAT_SLOT_KEYS = ["stats-1", "stats-2", "stats-3"];
const CONTENT_SLOT_KEYS = ["feature-main", "side-top", "side-bottom"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function buildTrendPoints(summary) {
  const base = [
    Math.max(1, summary?.todaysLessons ?? 1),
    Math.max(2, (summary?.todaysLessons ?? 0) + 2),
    Math.max(3, Math.ceil((summary?.lessonsThisWeek ?? 0) / 2)),
    Math.max(2, summary?.pendingRequests ?? 2),
    Math.max(3, Math.ceil((summary?.freeHoursToday ?? 0) / 4)),
    Math.max(2, Math.ceil((summary?.unreadMessages ?? 0) / 2)),
    Math.max(1, Math.ceil((summary?.connectedCount ?? 0) / 2)),
  ];
  const max = Math.max(...base, 1);

  return base.map((value, index) => ({
    day: WEEK_DAYS[index],
    value,
    label: `${value}h`,
    normalized: value / max,
  }));
}

function buildCurvePath(points, width, height) {
  if (!points.length) {
    return "";
  }

  const xStep = width / Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = index * xStep;
      const y = height - point.normalized * (height - 36) - 18;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function DashboardSlotFrame({ slot, title, children, onChange, onRemove, isBusy }) {
  return (
    <article className={`panel dashboard-widget dashboard-widget--${slot.size} dashboard-widget--type-${slot.widgetType || "empty"}`}>
      {slot.widgetType ? (
        <div className="dashboard-widget__controls">
          <span className="dashboard-widget__eyebrow">{title}</span>
          <div className="dashboard-widget__actions">
            <button
              type="button"
              className="dashboard-widget__icon-action"
              onClick={() => onChange(slot)}
              disabled={isBusy}
              aria-label={`Заменить виджет ${title}`}
              title="Заменить виджет"
            >
              <ReplaceIcon />
            </button>
            <button
              type="button"
              className="dashboard-widget__icon-action dashboard-widget__icon-action--danger"
              onClick={() => onRemove(slot.key)}
              disabled={isBusy}
              aria-label={`Удалить виджет ${title}`}
              title="Удалить виджет"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </article>
  );
}

function EmptyDashboardSlot({ slot, onAdd, isBusy }) {
  return (
    <div className={`dashboard-slot dashboard-slot--empty dashboard-slot--${slot.size}`}>
      <button
        type="button"
        className="dashboard-slot__add-button"
        onClick={() => onAdd(slot)}
        disabled={isBusy}
        aria-label={`Добавить виджет в слот ${slot.key}`}
        title="Добавить виджет"
      >
        <span className="dashboard-slot__plus" aria-hidden="true">
          +
        </span>
        <span className="dashboard-slot__sr-only">Добавить виджет</span>
      </button>
    </div>
  );
}

function WidgetPicker({ slot, onClose, onSelect, isBusy }) {
  if (!slot) {
    return null;
  }

  return (
    <div className="dashboard-picker">
      <button type="button" className="dashboard-picker__backdrop" aria-label="Закрыть выбор виджета" onClick={onClose} />
      <div className="panel dashboard-picker__dialog">
        <div className="dashboard-picker__head">
          <div>
            <span className="dashboard-widget__eyebrow">Слот {slot.key}</span>
            <h2>Выбери виджет</h2>
            <p>Каждый блок сохраняется как отдельный виджет и может быть заменён в любой момент.</p>
          </div>
          <button type="button" className="dashboard-widget__action" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="dashboard-picker__grid">
          {slot.availableWidgets.map((widget) => (
            <button
              key={widget.type}
              type="button"
              className="dashboard-picker__option"
              onClick={() => onSelect(slot.key, widget.type)}
              disabled={isBusy}
            >
              <strong>{widget.label}</strong>
              <span>{widget.type.replaceAll("_", " ")}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderStatWidget({ slot, summary, user, onChange, onRemove, isBusy }) {
  const widgets = {
    upcoming_lesson: {
      title: "Ближайшее занятие",
      accent: "lime",
      value: summary?.upcomingLesson ? `${formatDate(summary.upcomingLesson.date)} • ${summary.upcomingLesson.timeRange}` : "Пока нет запланированных занятий",
      note: summary?.upcomingLesson?.partnerName || "Спокойный ритм недели",
      kicker: summary?.upcomingLesson ? summary.upcomingLesson.title : "Open slot",
    },
    weekly_load: {
      title: "Нагрузка недели",
      accent: "orange",
      value: `${summary?.lessonsThisWeek ?? 0} занятий`,
      note: summary?.weeklySummary || "Сводка по занятости за неделю",
      kicker: "Weekly flow",
    },
    messages: {
      title: "Сообщения",
      accent: "orange",
      value: `${summary?.unreadMessages ?? 0} новых`,
      note: "Следи за диалогами и быстрыми ответами",
      kicker: "Inbox",
    },
    notifications: {
      title: "Уведомления",
      accent: "dark",
      value: `${summary?.unreadNotifications ?? 0} событий`,
      note: "Важные сигналы по расписанию и системе",
      kicker: "Alerts",
    },
    connections: {
      title: user?.role === "teacher" ? "Ученики" : "Преподаватели",
      accent: "lime",
      value: `${summary?.connectedCount ?? 0} активных`,
      note: "Все текущие связи в одном месте",
      kicker: "Network",
    },
    pending_requests: {
      title: user?.role === "teacher" ? "Заявки" : "Приглашения",
      accent: "dark",
      value: `${summary?.pendingRequests ?? 0} ждут ответа`,
      note: "Не теряй новые входящие запросы",
      kicker: "Requests",
    },
    free_hours: {
      title: "Свободные часы",
      accent: "peach",
      value: `${summary?.freeHoursToday ?? 0} ч`,
      note: "Окна для новых встреч сегодня",
      kicker: "Available",
    },
  };

  const widget = widgets[slot.widgetType];

  if (!widget) {
    return null;
  }

  return (
    <DashboardSlotFrame slot={slot} title={widget.title} onChange={onChange} onRemove={onRemove} isBusy={isBusy}>
      <div className={`dashboard-stat dashboard-stat--builder dashboard-stat--accent-${widget.accent}`}>
        <div className="dashboard-stat__kicker">{widget.kicker}</div>
        <strong>{widget.value}</strong>
        <span>{widget.note}</span>
        <div className="dashboard-stat__decor" aria-hidden="true" />
      </div>
    </DashboardSlotFrame>
  );
}

function MainOverviewWidget({ summary }) {
  const points = buildTrendPoints(summary);
  const width = 540;
  const height = 180;
  const path = buildCurvePath(points, width, height);

  return (
    <div className="dashboard-graph">
      <div className="dashboard-graph__days">
        {points.map((point) => (
          <span key={point.day}>{point.day}</span>
        ))}
      </div>

      <div className="dashboard-graph__canvas">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="dashboard-graph__track dashboard-graph__track--orange" d={path} />
          <path
            className="dashboard-graph__track dashboard-graph__track--lime"
            d={path
              .replace(/M ([\d.]+) ([\d.]+)/, (_, x, y) => `M ${x} ${(Number(y) + 14).toFixed(1)}`)
              .replace(/L ([\d.]+) ([\d.]+)/g, (_, x, y) => `L ${x} ${(Number(y) - 10).toFixed(1)}`)}
          />
        </svg>

        <div className="dashboard-graph__bars">
          {points.map((point) => (
            <div key={point.day} className="dashboard-graph__bar">
              <div className="dashboard-graph__badge">{point.label}</div>
              <span style={{ height: `${Math.max(point.normalized * 100, 18)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderContentWidget({ slot, summary, user, onChange, onRemove, isBusy }) {
  if (slot.widgetType === "today_overview") {
    return (
      <DashboardSlotFrame slot={slot} title="Сегодня" onChange={onChange} onRemove={onRemove} isBusy={isBusy}>
        <div className="dashboard-main-card">
          <div className="dashboard-main-card__summary">
            <div className="dashboard-main-card__metric">
              <strong>{summary?.todaysLessons ?? "—"}</strong>
              <span>today lessons</span>
            </div>
            <div className="dashboard-main-card__metric">
              <strong>{summary?.freeHoursToday ?? "—"}</strong>
              <span>free hours</span>
            </div>
            <div className="dashboard-main-card__metric">
              <strong>{summary?.pendingRequests ?? "—"}</strong>
              <span>{user?.role === "teacher" ? "pending requests" : "invites"}</span>
            </div>
          </div>

          <MainOverviewWidget summary={summary} />
        </div>
      </DashboardSlotFrame>
    );
  }

  if (slot.widgetType === "day_metrics") {
    return (
      <DashboardSlotFrame slot={slot} title="Статистика дня" onChange={onChange} onRemove={onRemove} isBusy={isBusy}>
        <div className="dashboard-side-progress">
          <h3>Completed task statistics</h3>
          <div className="dashboard-side-progress__item">
            <span>Today</span>
            <div><b style={{ width: `${Math.min((summary?.todaysLessons ?? 0) * 12 + 16, 100)}%` }} /></div>
          </div>
          <div className="dashboard-side-progress__item">
            <span>Week</span>
            <div><b style={{ width: `${Math.min((summary?.lessonsThisWeek ?? 0) * 10 + 18, 100)}%` }} /></div>
          </div>
          <div className="dashboard-side-progress__item">
            <span>Focus</span>
            <div><b style={{ width: `${Math.min((summary?.freeHoursToday ?? 0) * 8 + 12, 100)}%` }} /></div>
          </div>
        </div>
      </DashboardSlotFrame>
    );
  }

  if (slot.widgetType === "schedule_status") {
    return (
      <DashboardSlotFrame slot={slot} title="Статус расписания" onChange={onChange} onRemove={onRemove} isBusy={isBusy}>
        <div className="dashboard-side-note">
          <h3>Last notes</h3>
          <div className="dashboard-side-note__row">
            <span>Next</span>
            <strong>
              {summary?.upcomingLesson
                ? `${formatDate(summary.upcomingLesson.date)} • ${summary.upcomingLesson.timeRange}`
                : "Пока без следующего занятия"}
            </strong>
          </div>
          <div className="dashboard-side-note__row">
            <span>Partner</span>
            <strong>{summary?.upcomingLesson?.partnerName || "Не назначен"}</strong>
          </div>
          <div className="dashboard-side-note__row">
            <span>Updated</span>
            <strong>
              {summary?.recentScheduleUpdatedAt
                ? new Date(summary.recentScheduleUpdatedAt).toLocaleString("ru-RU")
                : "Сегодня изменений не было"}
            </strong>
          </div>
        </div>
      </DashboardSlotFrame>
    );
  }

  return renderStatWidget({ slot, summary, user, onChange, onRemove, isBusy });
}

export function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [slots, setSlots] = useState([]);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([authRequest("/api/dashboard-summary"), authRequest("/api/dashboard-layout")])
      .then(([summaryData, layoutData]) => {
        if (!isMounted) {
          return;
        }

        setSummary(summaryData);
        setSlots(layoutData.slots || []);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.key, slot])), [slots]);
  const hasWidgets = slots.some((slot) => slot.widgetType);

  async function refreshLayout(nextPromise) {
    setIsSaving(true);
    try {
      const data = await nextPromise;
      setSlots(data.slots || []);
      setPickerSlot(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectWidget(slotKey, widgetType) {
    refreshLayout(
      authRequest(`/api/dashboard-layout/${slotKey}`, {
        method: "PUT",
        body: JSON.stringify({ widgetType }),
      }),
    );
  }

  function handleRemoveWidget(slotKey) {
    refreshLayout(
      authRequest(`/api/dashboard-layout/${slotKey}`, {
        method: "DELETE",
      }),
    );
  }

  function handleResetLayout() {
    refreshLayout(
      authRequest("/api/dashboard-layout", {
        method: "DELETE",
      }),
    );
  }

  function renderSlot(slotKey) {
    const slot = slotMap.get(slotKey);

    if (!slot) {
      return null;
    }

    if (!slot.widgetType) {
      return <EmptyDashboardSlot slot={slot} onAdd={setPickerSlot} isBusy={isSaving} />;
    }

    if (slot.size === "stat") {
      return renderStatWidget({
        slot,
        summary,
        user,
        onChange: setPickerSlot,
        onRemove: handleRemoveWidget,
        isBusy: isSaving,
      });
    }

    return renderContentWidget({
      slot,
      summary,
      user,
      onChange: setPickerSlot,
      onRemove: handleRemoveWidget,
      isBusy: isSaving,
    });
  }

  return (
    <AppLayout title="Главная" eyebrow="Гибкая панель" contentMode="custom">
      <div className="dashboard-home">
        <div className="dashboard-home__toolbar">
          <button
            type="button"
            className="dashboard-widget__action dashboard-widget__action--ghost"
            onClick={handleResetLayout}
            disabled={isSaving || isLoading || !hasWidgets}
          >
            Clear widgets
          </button>
        </div>

        <section className="stats-grid dashboard-builder-grid">
          {STAT_SLOT_KEYS.map((slotKey) => (
            <div key={slotKey} className="dashboard-builder-grid__item">
              {isLoading ? <article className="panel dashboard-slot dashboard-slot--loading" /> : renderSlot(slotKey)}
            </div>
          ))}
        </section>

        <section className="dashboard-grid dashboard-grid--feature dashboard-builder-layout">
          <div className="dashboard-builder-layout__main">
            {isLoading ? <article className="panel dashboard-slot dashboard-slot--loading dashboard-slot--main" /> : renderSlot(CONTENT_SLOT_KEYS[0])}
          </div>

          <div className="side-column dashboard-builder-layout__side">
            {CONTENT_SLOT_KEYS.slice(1).map((slotKey) => (
              <div key={slotKey}>
                {isLoading ? <article className="panel dashboard-slot dashboard-slot--loading" /> : renderSlot(slotKey)}
              </div>
            ))}
          </div>
        </section>
      </div>

      <WidgetPicker slot={pickerSlot} onClose={() => setPickerSlot(null)} onSelect={handleSelectWidget} isBusy={isSaving} />
    </AppLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import {
  AnalyticsIcon,
  BoardIcon,
  FinanceIcon,
  MessageIcon,
  ScheduleIcon,
  StudentsIcon,
} from "../components/icons";
import { authRequest, useAuth } from "../auth/AuthContext";
import logoImage from "../assets/logo.png";

const DEFAULT_BLOCK_ORDER = [
  "day",
  "quick",
  "lessons",
  "messages",
  "finance",
  "homework",
  "analytics",
  "progress",
];

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function formatMonthDay(date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function formatTimeAgo(value) {
  if (!value) {
    return "";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} мин`;
  }

  const hours = Math.round(diffMinutes / 60);
  return `${hours} ч`;
}

function formatHours(value) {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)} ч`;
}

function getHomeworkStatusLabel(status) {
  const labels = {
    assigned: "Выдано",
    submitted: "На проверке",
    done: "Выполнено",
    cancelled: "Отменено",
  };

  return labels[status] || "Выдано";
}

function getInitials(name) {
  return String(name || "RP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getStoredOrder(userId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`repetly-home-order-${userId}`) || "[]");
    const valid = parsed.filter((key) => DEFAULT_BLOCK_ORDER.includes(key));
    return [...valid, ...DEFAULT_BLOCK_ORDER.filter((key) => !valid.includes(key))];
  } catch {
    return DEFAULT_BLOCK_ORDER;
  }
}

function DashboardCard({ id, className = "", children, dragState, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <article
      className={`home-board-card home-board-card--${id}${className ? ` ${className}` : ""}${dragState === id ? " home-board-card--dragging" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(event, id)}
      onDragEnter={(event) => onDragEnter(event, id)}
      onDragOver={(event) => event.preventDefault()}
      onDragEnd={onDragEnd}
    >
      <span className="home-board-card__grab" aria-hidden="true">⋮⋮</span>
      {children}
    </article>
  );
}

function CardHead({ icon: Icon, title, text, action }) {
  return (
    <div className="home-card-head">
      <span className="home-card-head__icon">{Icon ? <Icon /> : null}</span>
      <div>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {action ? <div className="home-card-head__action">{action}</div> : null}
    </div>
  );
}

function DayBlock({ summary, todayEntries }) {
  const today = new Date();
  const checkingCount = Number(summary?.homeworkReviewCount || 0);
  const pendingMessages = Number(summary?.unreadMessages || 0);

  return (
    <>
      <CardHead icon={ScheduleIcon} title="Главное за день" text={formatMonthDay(today)} />
      <div className="home-day-layout">
        <div className="home-day-list">
          <div className="home-day-row">
            <ScheduleIcon />
            <strong>{todayEntries.length} занятия сегодня</strong>
            <span>{todayEntries[0] ? `${todayEntries[0].startHour}:00 - ${todayEntries[todayEntries.length - 1].endHour}:00` : "Свободный день"}</span>
          </div>
          <div className="home-day-row">
            <BoardIcon />
            <strong>Проверить {checkingCount} задания</strong>
            <span>{checkingCount ? "Есть работы на проверке" : "Очередь проверки пуста"}</span>
          </div>
          <div className="home-day-row">
            <MessageIcon />
            <strong>Ответить на {pendingMessages} сообщения</strong>
            <span>{pendingMessages ? "Есть новые сообщения" : "Новых сообщений нет"}</span>
          </div>
          <div className="home-day-row">
            <FinanceIcon />
            <strong>Финансы</strong>
            <span>{formatHours(summary?.completedHours || 0)} проведено в этом месяце</span>
          </div>
        </div>

        <div className="home-day-visual" aria-hidden="true">
          <div className="home-day-visual__glow" />
          <img src={logoImage} alt="" />
          <div className="home-day-visual__plant" />
        </div>
      </div>
    </>
  );
}

function QuickStartBlock({ navigate }) {
  const actions = [
    { label: "Новое занятие", icon: ScheduleIcon, path: "/schedule" },
    { label: "Добавить ученика", icon: StudentsIcon, path: "/students?tab=students" },
    { label: "Выдать ДЗ", icon: BoardIcon, path: "/students?tab=homework&create=1" },
    { label: "Открыть сообщения", icon: MessageIcon, path: "/messages" },
  ];

  return (
    <>
      <CardHead icon={BoardIcon} title="Быстрый старт" text="Что хотите сделать?" />
      <div className="home-quick-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} type="button" onClick={() => navigate(action.path)}>
              <Icon />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function LessonsBlock({ entries, navigate }) {
  return (
    <>
      <CardHead icon={ScheduleIcon} title="Актуальные занятия" text="Расписание на сегодня" />
      <div className="home-list">
        {entries.slice(0, 4).map((entry) => (
          <div key={entry.id} className="home-list-row">
            <time>{entry.startHour}:00</time>
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.participant?.fullName || "Без ученика"}</small>
            </span>
            <b>{entry.startHour <= new Date().getHours() && entry.endHour > new Date().getHours() ? "Идёт" : "Скоро"}</b>
          </div>
        ))}
        {!entries.length ? <div className="home-empty">На сегодня занятий нет</div> : null}
      </div>
      <button className="home-card-link" type="button" onClick={() => navigate("/schedule")}>
        Все занятия
        <span>→</span>
      </button>
    </>
  );
}

function MessagesBlock({ conversations, navigate }) {
  return (
    <>
      <CardHead icon={MessageIcon} title="Новые сообщения" text="Последние диалоги" />
      <div className="home-list">
        {conversations.slice(0, 4).map((conversation) => {
          const title = conversation.type === "group" ? conversation.title : conversation.participant?.fullName;
          const avatar = conversation.type === "group" ? title : conversation.participant?.fullName;
          return (
            <button
              key={conversation.id}
              className="home-message-row"
              type="button"
              onClick={() => navigate(`/messages?conversationId=${encodeURIComponent(conversation.id)}`)}
            >
              <span className="home-avatar">{getInitials(avatar)}</span>
              <span>
                <strong>{title || "Диалог"}</strong>
                <small>{conversation.lastMessage || "Сообщений пока нет"}</small>
              </span>
              <time>{formatTimeAgo(conversation.lastMessageAt)}</time>
            </button>
          );
        })}
        {!conversations.length ? <div className="home-empty">Сообщений пока нет</div> : null}
      </div>
      <button className="home-card-link" type="button" onClick={() => navigate("/messages")}>
        Все сообщения
        <span>→</span>
      </button>
    </>
  );
}

function FinanceBlock({ analytics, navigate }) {
  const completedHours = analytics?.stats?.completedHours || 0;
  const plannedHours = analytics?.stats?.upcomingHours || 0;
  const total = Math.max(1, completedHours + plannedHours + (analytics?.stats?.cancelledHours || 0));
  const completedDeg = Math.round((completedHours / total) * 360);
  const plannedDeg = Math.round(((completedHours + plannedHours) / total) * 360);

  return (
    <>
      <CardHead icon={FinanceIcon} title="Финансы" text="По реальным часам" />
      <div className="home-finance">
        <div>
          <span>Проведено за месяц</span>
          <strong>{formatHours(completedHours)}</strong>
          <b>План: {formatHours(plannedHours)}</b>
        </div>
        <div
          className="home-finance__donut"
          style={{
            background: `conic-gradient(#111111 0deg ${completedDeg}deg, #e1ff5c ${completedDeg}deg ${plannedDeg}deg, rgba(17,17,17,0.08) ${plannedDeg}deg 360deg)`,
          }}
          aria-hidden="true"
        />
      </div>
      <button className="home-card-link" type="button" onClick={() => navigate("/analytics")}>
        Посмотреть финансы
        <span>→</span>
      </button>
    </>
  );
}

function HomeworkReviewBlock({ assignments, navigate }) {
  const reviewItems = assignments.filter((assignment) => assignment.status === "submitted");

  return (
    <>
      <CardHead icon={BoardIcon} title="Домашние задания на проверку" text="Работы учеников" />
      <div className="home-list">
        {reviewItems.slice(0, 4).map((assignment) => (
          <div key={assignment.id} className="home-homework-row">
            <span className="home-avatar">{getInitials(assignment.recipientName)}</span>
            <span>
              <strong>{assignment.recipientName}</strong>
              <small>{assignment.title}</small>
            </span>
            <b>{assignment.dueDate ? formatDate(assignment.dueDate) : "Без срока"}</b>
          </div>
        ))}
        {!reviewItems.length ? <div className="home-empty">Заданий на проверке нет</div> : null}
      </div>
      <button className="home-card-link" type="button" onClick={() => navigate("/students?tab=homework")}>
        Все задания
        <span>{reviewItems.length}</span>
      </button>
    </>
  );
}

function AnalyticsBlock({ analytics }) {
  const stats = analytics?.stats || {};

  return (
    <>
      <CardHead icon={AnalyticsIcon} title="Мини-аналитика" text="Этот месяц" />
      <div className="home-mini-stats">
        <div>
          <span>Проведено занятий</span>
          <strong>{stats.completedLessons || 0}</strong>
        </div>
        <div>
          <span>Часов проведено</span>
          <strong>{formatHours(stats.completedHours || 0)}</strong>
        </div>
        <div>
          <span>Новые ученики</span>
          <strong>{stats.activeStudents || 0}</strong>
        </div>
      </div>
      <div className="home-best-day">
        <strong>Лучший день: {analytics?.charts?.weekdays?.slice().sort((a, b) => b.hours - a.hours)[0]?.label || "пока нет"}</strong>
        <span>Больше всего занятий и активности</span>
      </div>
    </>
  );
}

function ProgressBlock({ summary }) {
  return (
    <>
      <div className="home-progress">
        <div className="home-progress__badge">★</div>
        <div>
          <strong>Маленький прогресс каждый день - это большой результат.</strong>
          <span>{summary?.weeklySummary || "Собирайте занятия, задания и ответы в одном рабочем ритме."}</span>
        </div>
        <div className="home-progress__mascot" aria-hidden="true">R</div>
      </div>
    </>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [schedule, setSchedule] = useState({ entries: [] });
  const [conversations, setConversations] = useState([]);
  const [homework, setHomework] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [blockOrder, setBlockOrder] = useState(() => getStoredOrder(user?.id || "guest"));
  const [draggedBlock, setDraggedBlock] = useState("");

  useEffect(() => {
    setBlockOrder(getStoredOrder(user?.id || "guest"));
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    const today = toLocalIsoDate(new Date());
    const month = today.slice(0, 7);
    const requests = [
      authRequest("/api/dashboard-summary"),
      authRequest(`/api/schedule?month=${encodeURIComponent(month)}&date=${encodeURIComponent(today)}`),
      authRequest("/api/conversations"),
      authRequest("/api/homework"),
      user?.role === "teacher" ? authRequest("/api/analytics/overview").catch(() => null) : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(([summaryData, scheduleData, conversationData, homeworkData, analyticsData]) => {
        if (!isMounted) {
          return;
        }

        const homeworkAssignments = homeworkData?.assignments || [];
        setSummary({
          ...summaryData,
          homeworkReviewCount: homeworkAssignments.filter((assignment) => assignment.status === "submitted").length,
          completedHours: analyticsData?.stats?.completedHours || 0,
        });
        setSchedule(scheduleData || { entries: [] });
        setConversations(conversationData?.conversations || []);
        setHomework(homeworkAssignments);
        setAnalytics(analyticsData);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  const blocks = useMemo(
    () => ({
      day: <DayBlock summary={summary} todayEntries={schedule.entries || []} />,
      quick: <QuickStartBlock navigate={navigate} />,
      lessons: <LessonsBlock entries={schedule.entries || []} navigate={navigate} />,
      messages: <MessagesBlock conversations={conversations} navigate={navigate} />,
      finance: <FinanceBlock analytics={analytics} navigate={navigate} />,
      homework: <HomeworkReviewBlock assignments={homework} navigate={navigate} />,
      analytics: <AnalyticsBlock analytics={analytics} />,
      progress: <ProgressBlock summary={summary} />,
    }),
    [analytics, conversations, homework, navigate, schedule.entries, summary],
  );

  function persistOrder(nextOrder) {
    setBlockOrder(nextOrder);
    window.localStorage.setItem(`repetly-home-order-${user?.id || "guest"}`, JSON.stringify(nextOrder));
  }

  function handleDragStart(event, id) {
    setDraggedBlock(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleDragEnter(event, targetId) {
    event.preventDefault();

    if (!draggedBlock || draggedBlock === targetId) {
      return;
    }

    const nextOrder = [...blockOrder];
    const fromIndex = nextOrder.indexOf(draggedBlock);
    const toIndex = nextOrder.indexOf(targetId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggedBlock);
    persistOrder(nextOrder);
  }

  function handleDragEnd() {
    setDraggedBlock("");
  }

  return (
    <AppLayout title="Главная" eyebrow="Рабочий день" contentMode="custom" contentClassName="content__body--home">
      <section className="home-board">
        {blockOrder.map((id) => (
          <DashboardCard
            key={id}
            id={id}
            dragState={draggedBlock}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
          >
            {blocks[id]}
          </DashboardCard>
        ))}
      </section>
    </AppLayout>
  );
}

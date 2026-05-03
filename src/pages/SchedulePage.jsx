import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest, useAuth } from "../auth/AuthContext";
import { DropdownSelect } from "../components/DropdownSelect";

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date, count) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + count);
  return nextDate;
}

function startOfWeek(date) {
  const startDate = new Date(date);
  const offset = (startDate.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - offset);
  return startDate;
}

function formatCompactDate(value) {
  return parseIsoDate(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatWeekLabel(days) {
  return `${formatCompactDate(days[0].iso)} - ${formatCompactDate(days[6].iso)}`;
}

function buildWeekDays(selectedDate, overview) {
  const firstDay = startOfWeek(parseIsoDate(selectedDate));
  const map = new Map(overview.map((item) => [item.date, item]));

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(firstDay, index);
    const iso = toLocalIsoDate(date);
    return {
      iso,
      dateNumber: date.getDate(),
      weekday: date.toLocaleDateString("ru-RU", { weekday: "short" }),
      overview: map.get(iso) || null,
    };
  });
}

function buildWeekDaysFromEntries(selectedDate, entries) {
  return buildWeekDays(selectedDate, buildOverview(entries));
}

function buildCalendarDays(monthDate, overview) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);
  const map = new Map(overview.map((item) => [item.date, item]));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const iso = toLocalIsoDate(date);
    return {
      iso,
      dateNumber: date.getDate(),
      inMonth: date.getMonth() === monthDate.getMonth(),
      overview: map.get(iso) || null,
    };
  });
}

function buildOverview(entries) {
  const overviewMap = entries.reduce((accumulator, entry) => {
    if (!accumulator[entry.date]) {
      accumulator[entry.date] = { date: entry.date, bookedHours: 0, sessions: 0 };
    }

    accumulator[entry.date].bookedHours += entry.endHour - entry.startHour;
    accumulator[entry.date].sessions += 1;
    return accumulator;
  }, {});

  return Object.values(overviewMap);
}

const defaultForm = {
  title: "",
  details: "",
  lessonLink: "",
  startHour: "09",
  endHour: "10",
  participantId: "",
  repeatWeekly: false,
};

const startHourOptions = Array.from({ length: 18 }, (_, index) => {
  const value = String(index + 6).padStart(2, "0");
  return { value, label: `${value}:00` };
});

const endHourOptions = Array.from({ length: 18 }, (_, index) => {
  const value = String(index + 7).padStart(2, "0");
  return { value, label: `${value}:00` };
});

const timelineHours = Array.from({ length: 18 }, (_, index) => index + 6);

const viewModes = [
  { value: "month", label: "Месяц" },
  { value: "week", label: "Неделя" },
  { value: "day", label: "День" },
];

export function SchedulePage() {
  const { user } = useAuth();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalIsoDate(new Date()));
  const [schedule, setSchedule] = useState({
    overview: [],
    monthEntries: [],
    entries: [],
    summary: { bookedHours: 0, freeHours: 24, busyRanges: [], freeRanges: [] },
    connectedUsers: [],
  });
  const [formState, setFormState] = useState(defaultForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [timeMenu, setTimeMenu] = useState(null);
  const [cancelEntry, setCancelEntry] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelSending, setIsCancelSending] = useState(false);
  const isStudent = user?.role === "student";

  const monthKey = formatMonth(monthDate);

  function mergeScheduleData(data) {
    setSchedule((current) => {
      const incomingEntries = [...(data.monthEntries || []), ...(data.entries || [])];
      const entryMap = new Map();

      for (const entry of [...(current.monthEntries || []), ...(current.entries || []), ...incomingEntries]) {
        entryMap.set(entry.id, entry);
      }

      const mergedEntries = Array.from(entryMap.values()).sort(
        (first, second) => first.date.localeCompare(second.date) || first.startHour - second.startHour,
      );

      return {
        ...data,
        overview: buildOverview(mergedEntries),
        monthEntries: mergedEntries,
        entries: mergedEntries.filter((entry) => entry.date === selectedDate),
        connectedUsers: data.connectedUsers || current.connectedUsers,
      };
    });
  }

  async function loadSchedule() {
    const data = await authRequest(
      `/api/schedule?month=${encodeURIComponent(monthKey)}&date=${encodeURIComponent(selectedDate)}`,
    );
    mergeScheduleData(data);
  }

  useEffect(() => {
    loadSchedule().catch(() => {});
  }, [monthKey, selectedDate]);

  useEffect(() => {
    if (viewMode !== "week") {
      return;
    }

    const weekStart = startOfWeek(parseIsoDate(selectedDate));
    const dates = Array.from({ length: 7 }, (_, index) => toLocalIsoDate(addDays(weekStart, index)));

    Promise.all(
      dates.map((date) =>
        authRequest(`/api/schedule?month=${encodeURIComponent(monthKey)}&date=${encodeURIComponent(date)}`).catch(
          () => null,
        ),
      ),
    ).then((responses) => {
      const validResponses = responses.filter(Boolean);

      if (!validResponses.length) {
        return;
      }

      setSchedule((current) => {
        const entryMap = new Map();

        for (const entry of [...(current.monthEntries || []), ...(current.entries || [])]) {
          entryMap.set(entry.id, entry);
        }

        for (const response of validResponses) {
          for (const entry of [...(response.monthEntries || []), ...(response.entries || [])]) {
            entryMap.set(entry.id, entry);
          }
        }

        const mergedEntries = Array.from(entryMap.values()).sort(
          (first, second) => first.date.localeCompare(second.date) || first.startHour - second.startHour,
        );

        return {
          ...current,
          overview: buildOverview(mergedEntries),
          monthEntries: mergedEntries,
          entries: mergedEntries.filter((entry) => entry.date === selectedDate),
          connectedUsers: validResponses[0].connectedUsers || current.connectedUsers,
        };
      });
    });
  }, [viewMode, selectedDate, monthKey]);

  useEffect(() => {
    if (!timeMenu) {
      return undefined;
    }

    const closeMenu = () => setTimeMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("wheel", closeMenu, { passive: true });
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("wheel", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [timeMenu]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const result = await authRequest("/api/schedule/entries", {
        method: "POST",
        body: JSON.stringify({
          ...formState,
          date: selectedDate,
          startHour: Number(formState.startHour),
          endHour: Number(formState.endHour),
        }),
      });
      const createdEntries = result.entries || (result.entry ? [result.entry] : []);
      setSchedule((current) => {
        const existingIds = new Set((current.monthEntries || []).map((entry) => entry.id));
        const nextMonthEntries = [
          ...(current.monthEntries || []),
          ...createdEntries.filter((entry) => !existingIds.has(entry.id)),
        ].sort((first, second) => first.date.localeCompare(second.date) || first.startHour - second.startHour);
        const nextEntries = nextMonthEntries.filter((entry) => entry.date === selectedDate);

        return {
          ...current,
          overview: buildOverview(nextMonthEntries),
          monthEntries: nextMonthEntries,
          entries: nextEntries,
        };
      });
      setFormState(defaultForm);
      setIsFormOpen(false);
      await loadSchedule();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось сохранить занятие.");
    } finally {
      setIsSaving(false);
    }
  }

  const calendarDays = useMemo(
    () => buildCalendarDays(monthDate, schedule.overview),
    [monthDate, schedule.overview],
  );

  const visibleEntries = useMemo(() => {
    const seenIds = new Set();
    return [...(schedule.monthEntries || []), ...(schedule.entries || [])].filter((entry) => {
      if (seenIds.has(entry.id)) {
        return false;
      }

      seenIds.add(entry.id);
      return true;
    });
  }, [schedule.monthEntries, schedule.entries]);

  const entriesByDate = useMemo(() => {
    return visibleEntries.reduce((accumulator, entry) => {
      if (!accumulator[entry.date]) {
        accumulator[entry.date] = [];
      }
      accumulator[entry.date].push(entry);
      return accumulator;
    }, {});
  }, [visibleEntries]);

  const weekDays = useMemo(
    () => buildWeekDaysFromEntries(selectedDate, visibleEntries),
    [selectedDate, visibleEntries],
  );

  const selectedDateObject = parseIsoDate(selectedDate);
  const selectedDayEntries = entriesByDate[selectedDate] || schedule.entries;

  function selectDate(iso, options = {}) {
    const nextDate = parseIsoDate(iso);
    setSelectedDate(iso);
    if (options.syncMonth !== false) {
      setMonthDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }

  function openFormForTime(date, hour) {
    if (isStudent) {
      return;
    }

    selectDate(date);
    setFormState((current) => ({
      ...current,
      startHour: String(hour).padStart(2, "0"),
      endHour: String(Math.min(hour + 1, 24)).padStart(2, "0"),
    }));
    setError("");
    setTimeMenu(null);
    setIsFormOpen(true);
  }

  function handleTimeContextMenu(event, date, hour) {
    if (isStudent) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setTimeMenu({
      date,
      hour,
      x: event.clientX,
      y: event.clientY,
    });
  }

  async function handleCancelRequestSubmit(event) {
    event.preventDefault();

    if (!cancelEntry) {
      return;
    }

    setError("");
    setIsCancelSending(true);

    try {
      await authRequest(`/api/schedule/entries/${cancelEntry.id}/cancel-request`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setCancelEntry(null);
      setCancelReason("");
      await loadSchedule();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отправить запрос на отмену.");
    } finally {
      setIsCancelSending(false);
    }
  }

  function movePeriod(direction) {
    if (viewMode === "month") {
      setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
      return;
    }

    const offset = viewMode === "week" ? direction * 7 : direction;
    const nextDate = addDays(selectedDateObject, offset);
    selectDate(toLocalIsoDate(nextDate));
  }

  const periodLabel =
    viewMode === "month"
      ? monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      : viewMode === "week"
        ? formatWeekLabel(weekDays)
        : parseIsoDate(selectedDate).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            weekday: "short",
          });

  return (
    <AppLayout title="Расписание" eyebrow="Планирование" contentMode="custom">
      <section className="schedule-mobile-phone">
        <div className="schedule-mobile-phone__head">
          <div>
            <h2>Расписание</h2>
            <p>{formatDateLabel(selectedDate)}</p>
          </div>
          {!isStudent ? (
            <button
              className="schedule-mobile-phone__add"
              type="button"
              onClick={() => {
                setError("");
                setTimeMenu(null);
                setIsFormOpen(true);
              }}
            >
              +
            </button>
          ) : null}
        </div>

        <div className="schedule-mobile-week" aria-label="Неделя">
          {weekDays.map((day) => (
            <button
              key={day.iso}
              type="button"
              className={`schedule-mobile-week__day${day.iso === selectedDate ? " schedule-mobile-week__day--active" : ""}`}
              onClick={() => selectDate(day.iso, { syncMonth: false })}
            >
              <span>{day.weekday}</span>
              <strong>{day.dateNumber}</strong>
              {day.overview ? <i aria-label={`${day.overview.sessions} занятий`} /> : null}
            </button>
          ))}
        </div>

        <div className="schedule-mobile-list">
          {selectedDayEntries.length ? (
            selectedDayEntries.map((entry) => (
              <article
                className="schedule-mobile-card"
                key={entry.id}
                role={isStudent ? "button" : undefined}
                tabIndex={isStudent ? 0 : undefined}
                onClick={isStudent ? () => setCancelEntry(entry) : undefined}
              >
                <div>
                  <time>
                    {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                  </time>
                  <strong>{entry.title}</strong>
                  {entry.participant ? <span>{entry.participant.fullName}</span> : null}
                </div>
                <b aria-hidden="true" />
              </article>
            ))
          ) : (
            <div className="schedule-mobile-empty">На этот день занятий нет.</div>
          )}
        </div>

        {!isStudent ? (
          <button
            className="schedule-mobile-create"
            type="button"
            onClick={() => {
              setError("");
              setTimeMenu(null);
              setIsFormOpen(true);
            }}
          >
            + Новое занятие
          </button>
        ) : null}

        <div className="schedule-mobile-reminders">
          <h3>Напоминания</h3>
          <div>
            <span>Занятий сегодня</span>
            <strong>{selectedDayEntries.length}</strong>
          </div>
          <div>
            <span>Занято часов</span>
            <strong>{schedule.summary.bookedHours}</strong>
          </div>
        </div>
      </section>

      <section className="schedule-layout">
        <article className="panel panel--calendar">
          <div className="panel__head">
            <div>
              <h2>Календарь</h2>
              <p>Переключайтесь между месяцем, неделей и подробным днем.</p>
            </div>
            <div className="schedule-toolbar">
              <div className={`schedule-view-switch schedule-view-switch--${viewMode}`} aria-label="Режим календаря">
                {viewModes.map((mode) => (
                  <button
                    key={mode.value}
                    className={viewMode === mode.value ? "schedule-view-switch__item--active" : ""}
                    type="button"
                    onClick={() => setViewMode(mode.value)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="calendar-nav">
                <button className="icon-button icon-button--calendar" type="button" onClick={() => movePeriod(-1)}>
                  ←
                </button>
                <strong>{periodLabel}</strong>
                <button className="icon-button icon-button--calendar" type="button" onClick={() => movePeriod(1)}>
                  →
                </button>
              </div>
            </div>
          </div>

          {viewMode === "month" ? (
            <div className="schedule-view-panel" key="month">
              <div className="calendar-weekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map((day) => (
                  <button
                    key={day.iso}
                    type="button"
                    className={`calendar-cell${day.iso === selectedDate ? " calendar-cell--active" : ""}${
                      day.inMonth ? "" : " calendar-cell--muted"
                    }`}
                    onClick={() => selectDate(day.iso)}
                  >
                    <span className="calendar-cell__day">{day.dateNumber}</span>
                    {day.overview ? (
                      <span className="calendar-cell__mark" aria-label={`${day.overview.sessions} занятий`}>
                        {day.overview.sessions}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {viewMode === "week" ? (
            <div className="schedule-detail schedule-detail--week schedule-view-panel" key="week">
              <div className="schedule-week-head">
                <span />
                {weekDays.map((day) => (
                  <button
                    key={day.iso}
                    type="button"
                    className={`schedule-week-day${day.iso === selectedDate ? " schedule-week-day--active" : ""}`}
                    onClick={() => selectDate(day.iso, { syncMonth: false })}
                  >
                    <strong>{day.dateNumber}</strong>
                    <span>{day.weekday}</span>
                    {day.overview ? <em>{day.overview.sessions}</em> : null}
                  </button>
                ))}
              </div>
              <div className="schedule-week-grid">
                <div className="schedule-time-column">
                  {timelineHours.map((hour) => (
                    <div className="schedule-time-label" key={hour}>
                      {hourLabel(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map((day) => (
                  <div className="schedule-week-column" key={day.iso}>
                    {timelineHours.map((hour) => (
                      <div
                        className="schedule-time-slot"
                        key={`${day.iso}-${hour}`}
                        onContextMenu={(event) => handleTimeContextMenu(event, day.iso, hour)}
                      />
                    ))}
                    {(entriesByDate[day.iso] || []).map((entry) => (
                      <article
                        className="schedule-timeline-card schedule-timeline-card--week"
                        key={entry.id}
                        role={isStudent ? "button" : undefined}
                        tabIndex={isStudent ? 0 : undefined}
                        onClick={isStudent ? () => setCancelEntry(entry) : undefined}
                        style={{
                          top: `${Math.max(entry.startHour - 6, 0) * 74}px`,
                          height: `${Math.max(entry.endHour - entry.startHour, 1) * 74}px`,
                        }}
                      >
                        <strong>{entry.title}</strong>
                        <span>
                          {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                        </span>
                        {entry.participant ? <small>{entry.participant.fullName}</small> : null}
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {viewMode === "day" ? (
            <div className="schedule-detail schedule-detail--day schedule-view-panel" key="day">
              <div className="schedule-day-timeline">
                {timelineHours.map((hour) => (
                  <div className="schedule-day-row" key={hour}>
                    <time>{hourLabel(hour)}</time>
                    <div onContextMenu={(event) => handleTimeContextMenu(event, selectedDate, hour)}>
                      {selectedDayEntries
                        .filter((entry) => entry.startHour === hour)
                        .map((entry) => (
                          <article className="schedule-timeline-card schedule-timeline-card--wide" key={entry.id}>
                            <button
                              className="schedule-entry-open-button"
                              type="button"
                              onClick={isStudent ? () => setCancelEntry(entry) : undefined}
                              disabled={!isStudent}
                            >
                              Открыть занятие
                            </button>
                            <strong>{entry.title}</strong>
                            <span>
                              {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                            </span>
                            {entry.participant ? <small>{entry.participant.fullName}</small> : null}
                            {entry.details ? <p>{entry.details}</p> : null}
                          </article>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="schedule-sidebar">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Сводка по дню</h2>
                <p>{formatDateLabel(selectedDate)}</p>
              </div>
            </div>

            <div className="schedule-day-list">
              {selectedDayEntries.length ? (
                selectedDayEntries.map((entry) => (
                  <article
                    className="schedule-day-card"
                    key={entry.id}
                    role={isStudent ? "button" : undefined}
                    tabIndex={isStudent ? 0 : undefined}
                    onClick={isStudent ? () => setCancelEntry(entry) : undefined}
                  >
                    <time>
                      {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                    </time>
                    <strong>{entry.title}</strong>
                    {entry.participant ? <span>{entry.participant.fullName}</span> : null}
                    {entry.details ? <p>{entry.details}</p> : null}
                    {entry.lessonLink ? (
                      <a href={entry.lessonLink} target="_blank" rel="noreferrer">
                        Открыть ссылку занятия
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="schedule-day-empty">На этот день занятия не запланированы.</div>
              )}
            </div>
          </article>

          <button
            className="schedule-add-button"
            hidden={isStudent}
            type="button"
            onClick={() => {
              setError("");
              setTimeMenu(null);
              setIsFormOpen(true);
            }}
          >
            Добавить занятие
          </button>
        </aside>
      </section>

      {timeMenu && !isStudent ? (
        <div className="schedule-time-menu" style={{ left: timeMenu.x, top: timeMenu.y }}>
          <button
            className="schedule-time-menu__close"
            type="button"
            aria-label="Закрыть"
            onClick={() => setTimeMenu(null)}
          >
            ×
          </button>
          <button type="button" onClick={() => openFormForTime(timeMenu.date, timeMenu.hour)}>
            Добавить занятие
          </button>
          <span>
            {hourLabel(timeMenu.hour)} - {hourLabel(Math.min(timeMenu.hour + 1, 24))}
          </span>
        </div>
      ) : null}

      {isFormOpen && !isStudent ? (
        <div className="dashboard-modal">
          <button
            className="dashboard-modal__backdrop"
            type="button"
            aria-label="Закрыть форму"
            onClick={() => {
              setTimeMenu(null);
              setIsFormOpen(false);
            }}
          />
          <article className="panel dashboard-modal__dialog schedule-modal">
            <div className="panel__head panel__head--tight schedule-modal__head">
              <div>
                <h2>Добавить занятие</h2>
                <p>{formatDateLabel(selectedDate)}</p>
              </div>
              <button
                className="icon-button icon-button--calendar"
                type="button"
                onClick={() => {
                  setTimeMenu(null);
                  setIsFormOpen(false);
                }}
              >
                ×
              </button>
            </div>
            <form className="schedule-form" onSubmit={handleSubmit}>
              {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

              <label className="auth-field">
                <span>Название занятия</span>
                <input
                  className="auth-input"
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Алгебра, разбор домашней работы"
                />
              </label>

              <div className="schedule-form__row">
                <label className="auth-field">
                  <span>Начало</span>
                  <DropdownSelect
                    value={formState.startHour}
                    onChange={(startHour) => setFormState((current) => ({ ...current, startHour }))}
                    options={startHourOptions}
                    placeholder="Выберите время"
                  />
                </label>

                <label className="auth-field">
                  <span>Окончание</span>
                  <DropdownSelect
                    value={formState.endHour}
                    onChange={(endHour) => setFormState((current) => ({ ...current, endHour }))}
                    options={endHourOptions}
                    placeholder="Выберите время"
                  />
                </label>
              </div>

              <label className="auth-field">
                <span>Участник</span>
                <DropdownSelect
                  value={formState.participantId}
                  onChange={(participantId) => setFormState((current) => ({ ...current, participantId }))}
                  options={[
                    { value: "", label: "Без участника" },
                    ...schedule.connectedUsers.map((person) => ({
                      value: person.id,
                      label: person.fullName,
                    })),
                  ]}
                  placeholder="Выберите участника"
                />
              </label>

              <label className="auth-field">
                <span>Заметки к занятию</span>
                <textarea
                  className="auth-input schedule-textarea"
                  value={formState.details}
                  onChange={(event) => setFormState((current) => ({ ...current, details: event.target.value }))}
                  placeholder="Цели, материалы или контекст занятия"
                />
              </label>

              <label className="auth-field">
                <span>Ссылка на занятие</span>
                <input
                  className="auth-input"
                  type="url"
                  value={formState.lessonLink}
                  onChange={(event) => setFormState((current) => ({ ...current, lessonLink: event.target.value }))}
                  placeholder="https://zoom.us/j/..."
                />
              </label>

              <label className="schedule-repeat-toggle">
                <input
                  type="checkbox"
                  checked={formState.repeatWeekly}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, repeatWeekly: event.target.checked }))
                  }
                />
                <span>Повторять еженедельно</span>
              </label>

              <button className="auth-submit" type="submit" disabled={isSaving}>
                {isSaving ? "Сохраняем..." : "Сохранить занятие"}
              </button>
            </form>
          </article>
        </div>
      ) : null}

      {cancelEntry ? (
        <div className="dashboard-modal">
          <button
            className="dashboard-modal__backdrop"
            type="button"
            aria-label="Закрыть запрос отмены"
            onClick={() => {
              setCancelEntry(null);
              setCancelReason("");
            }}
          />
          <article className="panel dashboard-modal__dialog schedule-modal">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Попросить отменить занятие</h2>
                <p>
                  {cancelEntry.title}, {hourLabel(cancelEntry.startHour)} - {hourLabel(cancelEntry.endHour)}
                </p>
              </div>
            </div>
            <form className="schedule-form" onSubmit={handleCancelRequestSubmit}>
              <label className="auth-field">
                <span>Причина отмены</span>
                <textarea
                  className="auth-input schedule-textarea"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Напишите, почему нужно отменить занятие"
                />
              </label>
              <div className="schedule-cancel-actions">
                <button
                  className="dashboard-widget__action"
                  type="button"
                  onClick={() => {
                    setCancelEntry(null);
                    setCancelReason("");
                  }}
                >
                  Закрыть
                </button>
                <button className="auth-submit" type="submit" disabled={isCancelSending}>
                  {isCancelSending ? "Отправляем..." : "Попросить отменить"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </AppLayout>
  );
}

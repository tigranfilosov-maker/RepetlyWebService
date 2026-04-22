import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";
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

const defaultForm = {
  title: "",
  details: "",
  lessonLink: "",
  startHour: "09",
  endHour: "10",
  participantId: "",
};

const startHourOptions = Array.from({ length: 18 }, (_, index) => {
  const value = String(index + 6).padStart(2, "0");
  return { value, label: `${value}:00` };
});

const endHourOptions = Array.from({ length: 18 }, (_, index) => {
  const value = String(index + 7).padStart(2, "0");
  return { value, label: `${value}:00` };
});

export function SchedulePage() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalIsoDate(new Date()));
  const [schedule, setSchedule] = useState({
    overview: [],
    entries: [],
    summary: { bookedHours: 0, freeHours: 24, busyRanges: [], freeRanges: [] },
    connectedUsers: [],
  });
  const [formState, setFormState] = useState(defaultForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const monthKey = formatMonth(monthDate);

  async function loadSchedule() {
    const data = await authRequest(
      `/api/schedule?month=${encodeURIComponent(monthKey)}&date=${encodeURIComponent(selectedDate)}`,
    );
    setSchedule(data);
  }

  useEffect(() => {
    loadSchedule().catch(() => {});
  }, [monthKey, selectedDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await authRequest("/api/schedule/entries", {
        method: "POST",
        body: JSON.stringify({
          ...formState,
          date: selectedDate,
          startHour: Number(formState.startHour),
          endHour: Number(formState.endHour),
        }),
      });
      setFormState(defaultForm);
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

  const dayHours = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => {
        const hour = index + 6;
        const entry = schedule.entries.find((item) => hour >= item.startHour && hour < item.endHour);
        return { hour, entry };
      }),
    [schedule.entries],
  );

  return (
    <AppLayout title="Расписание" eyebrow="Планирование" contentMode="custom">
      <section className="schedule-layout">
        <article className="panel panel--calendar">
          <div className="panel__head">
            <div>
              <h2>Календарь</h2>
              <p>Выберите день, чтобы посмотреть нагрузку, свободные часы и запланированные занятия.</p>
            </div>
            <div className="calendar-nav">
              <button
                className="icon-button icon-button--calendar"
                type="button"
                onClick={() =>
                  setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }
              >
                ←
              </button>
              <strong>{monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
              <button
                className="icon-button icon-button--calendar"
                type="button"
                onClick={() =>
                  setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }
              >
                →
              </button>
            </div>
          </div>

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
                onClick={() => setSelectedDate(day.iso)}
              >
                <span className="calendar-cell__day">{day.dateNumber}</span>
                <span className="calendar-cell__meta">
                  {day.overview ? `${day.overview.bookedHours} ч занято` : "Свободно"}
                </span>
                <span className="calendar-cell__meta">
                  {day.overview ? `${day.overview.sessions} занятий` : "Занятий нет"}
                </span>
              </button>
            ))}
          </div>

          <div className="day-planner">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>{formatDateLabel(selectedDate)}</h2>
                <p>Помесячный обзор дня с участниками и ссылками на уроки.</p>
              </div>
            </div>

            <div className="planner-hours">
              {dayHours.map(({ hour, entry }) => (
                <div
                  key={hour}
                  className={`planner-hour${entry ? " planner-hour--busy" : " planner-hour--free"}`}
                >
                  <strong>{hourLabel(hour)}</strong>
                  <div>
                    {entry ? (
                      <>
                        <span>{entry.title}</span>
                        <small>
                          {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                          {entry.participant ? ` • ${entry.participant.fullName}` : ""}
                        </small>
                        {entry.lessonLink ? <small>{entry.lessonLink}</small> : null}
                      </>
                    ) : (
                      <span>Свободно</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="schedule-sidebar">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Сводка по дню</h2>
                <p>{formatDateLabel(selectedDate)}</p>
              </div>
            </div>

            <div className="summary-metrics">
              <div className="summary-metric">
                <strong>{schedule.summary.bookedHours}</strong>
                <span>Часов занято</span>
              </div>
              <div className="summary-metric">
                <strong>{schedule.summary.freeHours}</strong>
                <span>Часов свободно</span>
              </div>
            </div>

            <div className="summary-block">
              <h3>Занято</h3>
              {schedule.summary.busyRanges.length ? (
                schedule.summary.busyRanges.map((range) => (
                  <div key={range.label} className="summary-range summary-range--busy">
                    {range.label}
                  </div>
                ))
              ) : (
                <div className="summary-range">На этот день занятия не запланированы.</div>
              )}
            </div>

            <div className="summary-block">
              <h3>Свободно</h3>
              {schedule.summary.freeRanges.length ? (
                schedule.summary.freeRanges.map((range) => (
                  <div key={range.label} className="summary-range summary-range--free">
                    {range.label}
                  </div>
                ))
              ) : (
                <div className="summary-range">Свободного времени не осталось.</div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Добавить занятие</h2>
                <p>Создайте слот урока и при необходимости привяжите участника и ссылку на встречу.</p>
              </div>
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

              <button className="auth-submit" type="submit" disabled={isSaving}>
                {isSaving ? "Сохраняем..." : "Сохранить занятие"}
              </button>
            </form>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}

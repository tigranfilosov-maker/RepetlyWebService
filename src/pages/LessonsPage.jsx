import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";
import { BoardWorkspace } from "./BoardPage";

const sections = {
  completed: {
    title: "Проведённые занятия",
    description: "Занятия, которые были отмечены как проведённые в календаре.",
  },
  board: {
    title: "Доска",
    description: "Материалы, заметки и визуальная подготовка к занятиям.",
  },
};

function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PlaceholderSection({ title, description }) {
  return (
    <div className="combined-page__content">
      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head">
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </div>
          <div className="panel-stack">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="panel-row">
                <div className="panel-row__badge" />
                <div className="panel-row__content">
                  <div className="placeholder-card__line placeholder-card__line--medium" />
                  <div className="placeholder-card__line placeholder-card__line--long" />
                </div>
                <div className="panel-row__chip" />
                <div className="panel-row__button" />
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <h2>Быстрый обзор</h2>
              <p>{description}</p>
            </div>
          </div>
          <div className="placeholder-card">
            <div className="placeholder-card__line placeholder-card__line--short" />
            <div className="placeholder-card__line placeholder-card__line--medium" />
            <div className="placeholder-card__line placeholder-card__line--long" />
          </div>
        </article>
      </section>
    </div>
  );
}

export function LessonsPage() {
  const [activeTab, setActiveTab] = useState("completed");
  const [completedEntries, setCompletedEntries] = useState([]);
  const [error, setError] = useState("");
  const current = sections[activeTab];

  useEffect(() => {
    let isMounted = true;

    authRequest("/api/lessons/completed")
      .then((result) => {
        if (isMounted) {
          setCompletedEntries(result.entries || []);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.payload?.message || "Не удалось загрузить проведённые занятия.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppLayout title="Занятия" eyebrow="Инструменты урока" contentMode="custom">
      <section className="combined-page">
        <div className={`lessons-tabs-switch lessons-tabs-switch--${activeTab}`}>
          <button
            type="button"
            className={activeTab === "completed" ? "lessons-tabs-switch__item lessons-tabs-switch__item--active" : "lessons-tabs-switch__item"}
            onClick={() => setActiveTab("completed")}
          >
            Проведённые
          </button>
          <button
            type="button"
            className={activeTab === "board" ? "lessons-tabs-switch__item lessons-tabs-switch__item--active" : "lessons-tabs-switch__item"}
            onClick={() => setActiveTab("board")}
          >
            Доска
          </button>
        </div>

        {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

        {activeTab === "board" ? (
          <BoardWorkspace />
        ) : (
          <div className="combined-page__content">
            <article className="panel panel--focus completed-lessons-panel">
              <div className="panel__head">
                <div>
                  <h2>{current.title}</h2>
                  <p>{current.description}</p>
                </div>
              </div>
              <div className="completed-lessons-list">
                {completedEntries.map((entry) => (
                  <article className="completed-lesson-card" key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{entry.participantName || "Без ученика"}</span>
                    </div>
                    <time>
                      {formatDate(entry.date)}, {hourLabel(entry.startHour)} - {hourLabel(entry.endHour)}
                    </time>
                    <b className={`lesson-payment-status lesson-payment-status--${entry.paymentStatus || "unpaid"}`}>
                      {(entry.paymentStatus || "unpaid") === "paid" ? "Оплачено" : "Не оплачено"}
                    </b>
                  </article>
                ))}
                {!completedEntries.length ? (
                  <div className="empty-state">Проведённые занятия появятся здесь после отметки в календаре.</div>
                ) : null}
              </div>
            </article>
          </div>
        )}
      </section>
    </AppLayout>
  );
}

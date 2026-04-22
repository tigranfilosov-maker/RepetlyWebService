import { useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { BoardWorkspace } from "./BoardPage";

const sections = {
  zoom: {
    title: "Zoom-занятия",
    description: "Управление онлайн-встречами и сценариями проведения уроков.",
  },
  board: {
    title: "Доска",
    description: "Материалы, заметки и визуальная подготовка к занятиям.",
  },
};

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
  const [activeTab, setActiveTab] = useState("zoom");
  const current = sections[activeTab];

  return (
    <AppLayout title="Занятия" eyebrow="Инструменты урока" contentMode="custom">
      <section className="combined-page">
        <div className="combined-page__tabs">
          <button
            type="button"
            className={`combined-page__tab${activeTab === "zoom" ? " combined-page__tab--active" : ""}`}
            onClick={() => setActiveTab("zoom")}
          >
            Zoom-занятия
          </button>
          <button
            type="button"
            className={`combined-page__tab${activeTab === "board" ? " combined-page__tab--active" : ""}`}
            onClick={() => setActiveTab("board")}
          >
            Доска
          </button>
        </div>

        {activeTab === "board" ? (
          <BoardWorkspace />
        ) : (
          <PlaceholderSection title={current.title} description={current.description} />
        )}
      </section>
    </AppLayout>
  );
}

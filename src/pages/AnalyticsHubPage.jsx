import { useState } from "react";
import { AppLayout } from "../components/AppLayout";

const sections = {
  analytics: {
    title: "Аналитика",
    description: "Сводки по занятиям, загрузке и ключевым показателям.",
  },
  finance: {
    title: "Финансы",
    description: "Доходы, платежи и финансовая статистика в одном разделе.",
  },
};

function PlaceholderSection({ title, description }) {
  return (
    <div className="combined-page__content">
      <section className="stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="panel dashboard-stat">
            <span>{title}</span>
            <strong>—</strong>
          </article>
        ))}
      </section>

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

        <div className="side-column">
          {Array.from({ length: 2 }).map((_, index) => (
            <article key={index} className="panel">
              <div className="panel__head">
                <div>
                  <h2>{index === 0 ? "Сводка" : "Дополнительно"}</h2>
                  <p>{description}</p>
                </div>
              </div>
              <div className="placeholder-card">
                <div className="placeholder-card__line placeholder-card__line--short" />
                <div className="placeholder-card__line placeholder-card__line--medium" />
                <div className="placeholder-card__line placeholder-card__line--long" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AnalyticsHubPage() {
  const [activeTab, setActiveTab] = useState("analytics");
  const current = sections[activeTab];

  return (
    <AppLayout title="Аналитика" eyebrow="Отчёты и финансы" contentMode="custom">
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

        <PlaceholderSection title={current.title} description={current.description} />
      </section>
    </AppLayout>
  );
}

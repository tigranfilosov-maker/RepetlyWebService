import { Link } from "react-router-dom";
import { SiteMark } from "../components/SiteMark";

const pageContent = {
  offer: {
    title: "Публичная оферта",
    description: "Здесь будет размещен текст публичной оферты Repetly.",
  },
  privacy: {
    title: "Политика конфиденциальности",
    description: "Здесь будет размещен текст политики конфиденциальности Repetly.",
  },
};

export function LegalPage({ type }) {
  const content = pageContent[type] || pageContent.offer;

  return (
    <main className="legal-page">
      <section className="legal-page__card">
        <Link className="landing-brand legal-page__brand" to="/">
          <SiteMark className="landing-brand__mark" />
          <div>
            <strong>Repetly</strong>
            <span>Документы сервиса</span>
          </div>
        </Link>

        <div className="legal-page__content">
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <p>Этот раздел подготовлен как отдельная страница, чтобы позже сюда можно было вставить полный юридический текст.</p>
        </div>

        <Link className="landing-button" to="/">
          На главную
        </Link>
      </section>
    </main>
  );
}

import { Link } from "react-router-dom";
import { SiteMark } from "../components/SiteMark";

const benefitItems = [
  {
    title: "Меньше рутины",
    text: "Один интерфейс для учеников, занятий, авторизации и ежедневной организационной работы преподавателя.",
  },
  {
    title: "Понятный цифровой кабинет",
    text: "Сервис собирает ключевые процессы в аккуратной SaaS-панели без перегруза, хаоса и лишних переключений.",
  },
  {
    title: "Основа для роста",
    text: "Repetly подходит как точка перехода от ручного ведения процессов к системному продукту по подписке.",
  },
];

const supportCards = [
  {
    title: "Доверительный интерфейс",
    text: "Современная визуальная система помогает воспринимать платформу как надежный рабочий инструмент, а не черновик.",
  },
  {
    title: "Быстрый вход в работу",
    text: "Пользователь сразу понимает, куда идти: создать аккаунт, войти в систему и перейти к рабочему кабинету.",
  },
  {
    title: "Готовность к расширению",
    text: "Структура проекта уже подготовлена под дальнейшее развитие продукта, ролей, функций и внутренних разделов.",
  },
];

const faqItems = [
  {
    question: "Что такое Repetly?",
    answer: "Это SaaS-платформа для репетиторов и преподавателей, которая помогает организовать рабочие процессы в одном месте.",
  },
  {
    question: "Кому подойдет сервис?",
    answer: "Частным репетиторам, преподавателям и будущим образовательным командам, которым нужен понятный цифровой кабинет.",
  },
  {
    question: "Что делать дальше после landing page?",
    answer: "Перейти к регистрации или авторизации, чтобы попасть в защищенную часть приложения и продолжить работу внутри системы.",
  },
];

export function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-brand">
          <SiteMark className="landing-brand__mark" />
          <div>
            <strong>Repetly</strong>
            <span>Секретарь для репетиторов</span>
          </div>
        </div>

        <nav className="landing-nav" aria-label="Навигация landing page">
          <a href="#benefits">Преимущества</a>
          <a href="#why-repetly">Почему Repetly</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="landing-actions">
          <Link className="landing-button landing-button--ghost" to="/sign-in">
            Sign in
          </Link>
          <Link className="landing-button" to="/sign-up">
            Sign up
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">Tutor SaaS</p>
            <h1>Платформа для преподавателей, которые хотят работать как современный сервис</h1>
            <p>
              Repetly помогает выстроить доверительный и понятный цифровой опыт для репетитора: войти в
              систему, организовать процессы и держать рабочее пространство в одном месте.
            </p>

            <div className="landing-hero__actions">
              <Link className="landing-button" to="/sign-up">
                Создать аккаунт
              </Link>
              <Link className="landing-button landing-button--ghost" to="/sign-in">
                Авторизация
              </Link>
            </div>
          </div>

          <div className="landing-showcase">
            <div className="landing-showcase__panel landing-showcase__panel--large" />
            <div className="landing-showcase__grid">
              <span />
              <span />
              <span />
            </div>
            <div className="landing-showcase__rows">
              <div />
              <div />
              <div />
            </div>
          </div>
        </section>

        <section className="landing-benefits" id="benefits">
          <div className="landing-section-heading">
            <p className="eyebrow">Benefits</p>
            <h2>Ключевые преимущества платформы</h2>
            <p>Коротко и понятно о том, почему Repetly воспринимается как аккуратный и профессиональный продукт.</p>
          </div>

          <div className="landing-card-grid">
            {benefitItems.map((item) => (
              <article key={item.title} className="landing-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-support" id="why-repetly">
          <div className="landing-section-heading">
            <p className="eyebrow">Why Repetly</p>
            <h2>Почему пользователи выбирают такой формат</h2>
            <p>Платформа объясняет ценность быстро: чистый вход, понятная структура, единая точка начала работы.</p>
          </div>

          <div className="landing-support__grid">
            {supportCards.map((item) => (
              <article key={item.title} className="landing-support__card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <p className="eyebrow">Start</p>
            <h2>Откройте вход в систему и начните строить свой преподавательский кабинет внутри Repetly</h2>
          </div>
          <div className="landing-cta__actions">
            <Link className="landing-button" to="/sign-up">
              Регистрация
            </Link>
            <Link className="landing-button landing-button--ghost" to="/sign-in">
              Войти
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__grid">
          <section id="faq">
            <h3>FAQ</h3>
            <div className="landing-faq">
              {faqItems.map((item) => (
                <article key={item.question}>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Useful links</h3>
            <div className="landing-footer__links">
              <Link to="/sign-in">Sign in</Link>
              <Link to="/sign-up">Sign up</Link>
              <a href="#benefits">Преимущества</a>
              <a href="#why-repetly">Почему Repetly</a>
            </div>
          </section>

          <section>
            <h3>О проекте</h3>
            <p>
              Repetly создается как SaaS-продукт для репетиторов с современным, понятным и профессиональным
              пользовательским опытом.
            </p>
            <p className="landing-footer__meta">Repetly, all rights reserved</p>
          </section>
        </div>
      </footer>
    </div>
  );
}

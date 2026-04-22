import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";

const plans = [
  {
    id: "free",
    name: "Старт",
    price: "0 ₽",
    cadence: "навсегда",
    description: "Для частных преподавателей, которые только начинают работать в панели.",
    highlights: ["До 5 учеников", "Базовый доступ к панели", "Сообщения и расписание"],
    cta: "Текущий тариф",
    featured: false,
  },
  {
    id: "advanced",
    name: "Продвинутый",
    price: "1490 ₽",
    cadence: "в месяц",
    description: "Для активных преподавателей, которым нужен масштабируемый кабинет без лимита по ученикам.",
    highlights: ["Безлимитные ученики", "Безлимитные доски", "Сценарии для занятий и материалов"],
    cta: "Перейти на тариф",
    featured: true,
  },
  {
    id: "online_school",
    name: "Онлайн-школа",
    price: "По договорённости",
    cadence: "индивидуально",
    description: "Для команд и школ, которым нужны расширение преподавателей, сопровождение и индивидуальные условия запуска.",
    highlights: ["Безлимитные ученики", "Безлимитные преподаватели", "Онбординг и индивидуальные условия"],
    cta: "Связаться с нами",
    href: "https://t.me/chepotemam_adm",
    featured: false,
  },
];

function normalizePlanId(value) {
  if (value === "enterprise") {
    return "online_school";
  }

  if (value === "advanced" || value === "online_school") {
    return value;
  }

  return "free";
}

export function PricingPage() {
  const { user } = useAuth();
  const currentPlan = normalizePlanId(user?.subscriptionPlan);

  return (
    <AppLayout title="Тарифы" eyebrow="Тарифы для преподавателей" contentMode="custom">
      <section className="pricing-page">
        <article className="panel panel--focus pricing-hero">
          <div>
            <p className="eyebrow">Тарифы для преподавателей</p>
            <h2>Выберите тариф под ваш формат работы</h2>
            <p>
              Сохраняйте привычный интерфейс Repetly и масштабируйте работу от личной практики до полноценной онлайн-школы.
            </p>
          </div>

          <div className="pricing-hero__summary">
            <span className="panel-chip">
              Текущий тариф: {plans.find((plan) => plan.id === currentPlan)?.name || "Старт"}
            </span>
            <div className="pricing-hero__note">
              <strong>Единый интерфейс на всех тарифах</strong>
              <span>Светлая и тёмная темы доступны на каждом тарифе.</span>
            </div>
          </div>
        </article>

        <section className="pricing-grid">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isTelegram = Boolean(plan.href);

            return (
              <article
                key={plan.id}
                className={`pricing-card${plan.featured ? " pricing-card--featured" : ""}${isCurrent ? " pricing-card--current" : ""}`}
              >
                <div className="pricing-card__top">
                  <div>
                    <span className="pricing-card__eyebrow">{plan.name}</span>
                    <h3>{plan.price}</h3>
                    <p>{plan.cadence}</p>
                  </div>
                  {isCurrent ? <span className="panel-chip">Активен</span> : null}
                </div>

                <p className="pricing-card__description">{plan.description}</p>

                <ul className="pricing-card__list">
                  {plan.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                {isTelegram ? (
                  <a className="pricing-card__cta pricing-card__cta--telegram" href={plan.href} target="_blank" rel="noreferrer">
                    {plan.cta}
                  </a>
                ) : (
                  <button className="pricing-card__cta" type="button" disabled={!isCurrent}>
                    {plan.cta}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      </section>
    </AppLayout>
  );
}

import { AppLayout } from "../components/AppLayout";

const managerLink = "https://t.me/repetly_manager";

const acquisitionPlans = [
  {
    id: "starter",
    name: "Старт",
    price: "7 900 ₽",
    cadence: "в месяц",
    description:
      "Для преподавателей, которым нужно аккуратно запустить продвижение и получить первые стабильные обращения без большого рекламного бюджета.",
    bestFor: "Подходит для частной практики и старта нового предмета.",
    highlights: [
      "Запуск рекламной кампании под 1 предмет или направление",
      "До 5 целевых заявок в месяц",
      "Проверка оффера и корректировка анкеты преподавателя",
      "Базовая приоритизация в каталоге и рекомендациях",
    ],
  },
  {
    id: "growth",
    name: "Рост",
    price: "14 900 ₽",
    cadence: "в месяц",
    description:
      "Основной тариф для преподавателей, которые хотят регулярно получать новых учеников и быстрее заполнять расписание.",
    bestFor: "Подходит для тех, кто масштабирует загрузку и хочет поток заявок.",
    highlights: [
      "Продвижение по 2 предметам или сегментам аудитории",
      "До 12 целевых заявок в месяц",
      "Приоритетное размещение в выдаче Repetly",
      "Ежемесячная оптимизация рекламных связок и текстов",
    ],
    featured: true,
  },
  {
    id: "intensive",
    name: "Интенсив",
    price: "24 900 ₽",
    cadence: "в месяц",
    description:
      "Для преподавателей с высокой нагрузкой, команд и мини-школ, которым нужен агрессивный рост и постоянная работа с входящим спросом.",
    bestFor: "Подходит для масштабирования, набора групп и быстрого закрытия слотов.",
    highlights: [
      "Мультиканальное продвижение и приоритетная рекомендация",
      "До 25 целевых заявок в месяц",
      "Отдельная стратегия под группы, индивидуальные занятия и интенсивы",
      "Быстрые корректировки кампаний по результатам недели",
    ],
  },
];

const workflowSteps = [
  {
    title: "Упаковываем предложение",
    text: "Помогаем оформить сильный оффер: предмет, формат занятий, уровень учеников, цену и главные преимущества преподавателя.",
  },
  {
    title: "Запускаем продвижение",
    text: "Подключаем рекламное размещение внутри Repetly и усиливаем видимость анкеты там, где ищут преподавателя.",
  },
  {
    title: "Передаём заявки",
    text: "Вы получаете целевые обращения от заинтересованных учеников и можете быстро доводить их до пробного занятия.",
  },
];

const trustPoints = [
  {
    value: "Только целевые обращения",
    label: "Мы делаем акцент на заинтересованных учениках, а не на случайном трафике.",
  },
  {
    value: "Гибкая настройка под предмет",
    label: "Можно продвигать школьные предметы, экзамены, языки, группы и интенсивы.",
  },
  {
    value: "Связь с менеджером",
    label: "Тариф подключается через менеджера, чтобы сразу подобрать рабочий формат продвижения.",
  },
];

export function GetStudentsPage() {
  return (
    <AppLayout title="Поиск учеников" eyebrow="Продвижение преподавателей" contentMode="custom">
      <section className="get-students-page">
        <article className="panel panel--focus pricing-hero get-students-hero">
          <div>
            <p className="eyebrow">Продвижение преподавателей</p>
            <h2>Запускайте продвижение в Repetly и получайте новых учеников под ваш формат занятий</h2>
            <p>
              Здесь преподаватель покупает не просто размещение, а управляемое продвижение. Мы усиливаем анкету,
              показываем её нужной аудитории и приводим заинтересованных учеников в диалог.
            </p>
          </div>

          <div className="pricing-hero__summary">
            <span className="panel-chip">Подключение через менеджера Repetly</span>
            <div className="pricing-hero__note">
              <strong>Продвижение под спрос, а не просто баннер</strong>
              <span>Подбираем тариф по предмету, стоимости урока, формату занятий и текущей загрузке преподавателя.</span>
            </div>
          </div>
        </article>

        <section className="get-students-flow">
          {workflowSteps.map((step, index) => (
            <article key={step.title} className="management-card get-students-flow__card">
              <span className="get-students-flow__index">Шаг {index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </section>

        <section className="pricing-grid">
          {acquisitionPlans.map((plan) => (
            <article
              key={plan.id}
              className={`pricing-card get-students-plan${plan.featured ? " pricing-card--featured" : ""}`}
            >
              <div className="pricing-card__top">
                <div>
                  <span className="pricing-card__eyebrow">{plan.name}</span>
                  <h3>{plan.price}</h3>
                  <p>{plan.cadence}</p>
                </div>
                {plan.featured ? <span className="panel-chip">Рекомендуем</span> : null}
              </div>

              <p className="pricing-card__description">{plan.description}</p>
              <p className="get-students-plan__best-for">{plan.bestFor}</p>

              <ul className="pricing-card__list">
                {plan.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <a className="pricing-card__cta pricing-card__cta--telegram" href={managerLink} target="_blank" rel="noreferrer">
                Связаться
              </a>
            </article>
          ))}
        </section>

        <section className="get-students-trust">
          {trustPoints.map((point) => (
            <article key={point.value} className="management-card get-students-trust__card">
              <strong>{point.value}</strong>
              <p>{point.label}</p>
            </article>
          ))}
        </section>
      </section>
    </AppLayout>
  );
}

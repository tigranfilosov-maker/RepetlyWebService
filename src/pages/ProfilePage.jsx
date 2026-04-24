import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";

const CROP_SIZE = 320;
const pricingPlans = [
  {
    id: "free",
    name: "Старт",
    price: "0 ₽",
    cadence: "навсегда",
    description: "Для частных преподавателей, которые только начинают работать в панели.",
    highlights: ["До 5 учеников", "Базовый доступ к панели", "Сообщения и расписание"],
  },
  {
    id: "advanced",
    name: "Продвинутый",
    price: "1490 ₽",
    cadence: "в месяц",
    description: "Для активных преподавателей, которым нужен масштабируемый кабинет без лимита по ученикам.",
    highlights: ["Безлимитные ученики", "Безлимитные доски", "Сценарии для занятий и материалов"],
  },
  {
    id: "online_school",
    name: "Онлайн-школа",
    price: "По договорённости",
    cadence: "индивидуально",
    description: "Для команд и школ, которым нужны расширение преподавателей, сопровождение и индивидуальные условия запуска.",
    highlights: ["Безлимитные ученики", "Безлимитные преподаватели", "Онбординг и индивидуальные условия"],
    href: "https://t.me/chepotemam_adm",
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getImageBounds(imageSize, zoom) {
  const scale = Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height) * zoom;
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;

  return {
    width,
    height,
    minX: Math.min(0, CROP_SIZE - width),
    minY: Math.min(0, CROP_SIZE - height),
  };
}

function getCenteredCropPosition(imageSize, zoom) {
  const bounds = getImageBounds(imageSize, zoom);

  return {
    x: (CROP_SIZE - bounds.width) / 2,
    y: (CROP_SIZE - bounds.height) / 2,
  };
}

function normalizeCropPosition(imageSize, zoom, position) {
  const bounds = getImageBounds(imageSize, zoom);

  return {
    x: clamp(position.x, bounds.minX, 0),
    y: clamp(position.y, bounds.minY, 0),
  };
}

function formatDate(value) {
  if (!value) {
    return "Не указано";
  }

  return new Date(value).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "pricing" ? "pricing" : "profile";
  const currentPlan = normalizePlanId(user?.subscriptionPlan);
  const [formState, setFormState] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    avatar: user?.avatar || "",
    subject: user?.subject || "",
    subjects: user?.subjects?.map((subject) => subject.name) || [],
  });
  const [subjectDraft, setSubjectDraft] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropImageSize, setCropImageSize] = useState({ width: 1, height: 1 });
  const fileInputRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    setFormState({
      fullName: user?.fullName || "",
      username: user?.username || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      avatar: user?.avatar || "",
      subject: user?.subject || "",
      subjects: user?.subjects?.map((subject) => subject.name) || [],
    });
    setSelectedFileName("");
  }, [user]);

  const initials = useMemo(
    () =>
      formState.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((item) => item[0]?.toUpperCase())
        .join("") || "RP",
    [formState.fullName],
  );

  const cropBounds = useMemo(
    () => getImageBounds(cropImageSize, cropZoom),
    [cropImageSize, cropZoom],
  );

  function switchTab(tab) {
    setSearchParams(tab === "pricing" ? { tab: "pricing" } : {});
  }

  function handleAddSubject() {
    const nextSubject = subjectDraft.trim();

    if (!nextSubject || formState.subjects.includes(nextSubject)) {
      return;
    }

    setFormState((current) => ({
      ...current,
      subject: current.subject || nextSubject,
      subjects: [...current.subjects, nextSubject],
    }));
    setSubjectDraft("");
  }

  function resetCropState() {
    setCropSource("");
    setCropZoom(1);
    setCropPosition({ x: 0, y: 0 });
    setCropImageSize({ width: 1, height: 1 });
    dragStateRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Поддерживаются только JPG, PNG, WEBP и GIF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Размер файла не должен превышать 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSource(String(reader.result || ""));
      setSelectedFileName(file.name);
      setError("");
      setSuccess("");
    };
    reader.onerror = () => setError("Не удалось загрузить изображение.");
    reader.readAsDataURL(file);
  }

  function handleCropImageLoad(event) {
    const imageSize = {
      width: event.currentTarget.naturalWidth || 1,
      height: event.currentTarget.naturalHeight || 1,
    };

    setCropImageSize(imageSize);
    setCropZoom(1);
    setCropPosition(getCenteredCropPosition(imageSize, 1));
  }

  function handleCropPointerDown(event) {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropPosition.x,
      originY: cropPosition.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(event) {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    setCropPosition(
      normalizeCropPosition(cropImageSize, cropZoom, {
        x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
        y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
      }),
    );
  }

  function handleCropPointerUp(event) {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCropZoomChange(event) {
    const nextZoom = Number(event.target.value);
    setCropZoom(nextZoom);
    setCropPosition((current) => normalizeCropPosition(cropImageSize, nextZoom, current));
  }

  function applyAvatarCrop() {
    if (!cropSource) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;

      const context = canvas.getContext("2d");

      if (!context) {
        setError("Не удалось обрезать изображение.");
        return;
      }

      context.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
      context.drawImage(image, cropPosition.x, cropPosition.y, cropBounds.width, cropBounds.height);

      setFormState((current) => ({
        ...current,
        avatar: canvas.toDataURL("image/jpeg", 0.92),
      }));
      setError("");
      resetCropState();
    };
    image.onerror = () => setError("Не удалось обрезать изображение.");
    image.src = cropSource;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const updatedUser = await updateProfile(formState);
      setFormState({
        fullName: updatedUser.fullName || "",
        username: updatedUser.username || "",
        email: updatedUser.email || "",
        phoneNumber: updatedUser.phoneNumber || "",
        avatar: updatedUser.avatar || "",
        subject: updatedUser.subject || "",
        subjects: updatedUser.subjects?.map((subject) => subject.name) || [],
      });
      setSuccess("Профиль сохранён.");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось сохранить профиль.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Профиль" eyebrow="Личные данные и тариф" contentMode="custom">
      <section className="combined-page">
        <div className="combined-page__tabs">
          <button
            type="button"
            className={`combined-page__tab${activeTab === "profile" ? " combined-page__tab--active" : ""}`}
            onClick={() => switchTab("profile")}
          >
            Профиль
          </button>
          <button
            type="button"
            className={`combined-page__tab${activeTab === "pricing" ? " combined-page__tab--active" : ""}`}
            onClick={() => switchTab("pricing")}
          >
            Тарифы
          </button>
        </div>

        {activeTab === "profile" ? (
          <section className="profile-grid">
            <article className="panel profile-summary">
              <div className="profile-summary__avatar">
                {formState.avatar ? <img src={formState.avatar} alt={formState.fullName} /> : <span>{initials}</span>}
              </div>

              <div className="profile-summary__meta">
                <h2>{user?.fullName}</h2>
                <p>{user?.username ? `@${user.username}` : user?.email}</p>
              </div>

              <div className="profile-badges">
                <span className="profile-badge">{user?.roleLabel}</span>
                <span className="profile-badge profile-badge--muted">
                  {user?.status === "active" ? "Активный аккаунт" : user?.status}
                </span>
              </div>

              <div className="profile-facts">
                <div>
                  <span>Создан</span>
                  <strong>{formatDate(user?.createdAt)}</strong>
                </div>
                <div>
                  <span>Последний вход</span>
                  <strong>{formatDate(user?.lastLoginAt)}</strong>
                </div>
              </div>
            </article>

            <article className="panel profile-editor">
              <div className="panel__head">
                <div>
                  <h2>Данные профиля</h2>
                  <p>Обновите личные данные, аватар и список предметов.</p>
                </div>
              </div>

              <form className="profile-form" onSubmit={handleSubmit}>
                {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
                {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

                <label className="auth-field" htmlFor="profile-name">
                  <span>Полное имя</span>
                  <input
                    className="auth-input"
                    id="profile-name"
                    value={formState.fullName}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                </label>

                <label className="auth-field" htmlFor="profile-email">
                  <span>Email</span>
                  <input
                    className="auth-input"
                    id="profile-email"
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>

                <label className="auth-field" htmlFor="profile-username">
                  <span>Никнейм</span>
                  <input
                    className="auth-input"
                    id="profile-username"
                    value={formState.username}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </label>

                <label className="auth-field" htmlFor="profile-phone">
                  <span>Телефон</span>
                  <input
                    className="auth-input"
                    id="profile-phone"
                    type="tel"
                    value={formState.phoneNumber}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, phoneNumber: event.target.value }))
                    }
                  />
                </label>

                <div className="auth-field">
                  <span>Загрузить аватар</span>
                  <div className="file-input">
                    <input
                      ref={fileInputRef}
                      className="file-input__control"
                      id="profile-avatar-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleAvatarUpload}
                    />
                    <label className="file-input__button landing-button landing-button--ghost" htmlFor="profile-avatar-file">
                      Выбрать файл
                    </label>
                    <span className={`file-input__name${selectedFileName ? "" : " file-input__name--placeholder"}`}>
                      {selectedFileName || "Файл не выбран"}
                    </span>
                  </div>
                </div>

                {user?.role === "teacher" ? (
                  <div className="auth-field">
                    <span>Предметы</span>
                    <div className="subject-editor">
                      <div className="subject-editor__row">
                        <input
                          className="auth-input"
                          value={subjectDraft}
                          onChange={(event) => setSubjectDraft(event.target.value)}
                          placeholder="Добавить предмет"
                        />
                        <button className="landing-button landing-button--flat" type="button" onClick={handleAddSubject}>
                          Добавить
                        </button>
                      </div>

                      <div className="subject-editor__chips">
                        {formState.subjects.map((subject) => (
                          <button
                            key={subject}
                            className="subject-chip"
                            type="button"
                            onClick={() =>
                              setFormState((current) => {
                                const subjects = current.subjects.filter((item) => item !== subject);
                                return {
                                  ...current,
                                  subjects,
                                  subject: subjects[0] || "",
                                };
                              })
                            }
                          >
                            {subject} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <button className="auth-submit profile-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Сохраняем..." : "Сохранить изменения"}
                </button>
              </form>
            </article>
          </section>
        ) : (
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
                  Текущий тариф: {pricingPlans.find((plan) => plan.id === currentPlan)?.name || "Старт"}
                </span>
                <div className="pricing-hero__note">
                  <strong>Единый интерфейс на всех тарифах</strong>
                  <span>Светлая и тёмная темы доступны на каждом тарифе.</span>
                </div>
              </div>
            </article>

            <section className="pricing-grid">
              {pricingPlans.map((plan) => {
                const isCurrent = currentPlan === plan.id;
                const isTelegram = Boolean(plan.href);

                return (
                  <article
                    key={plan.id}
                    className={`pricing-card${plan.id === "advanced" ? " pricing-card--featured" : ""}${isCurrent ? " pricing-card--current" : ""}`}
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
                        Связаться с нами
                      </a>
                    ) : (
                      <button className="pricing-card__cta" type="button" disabled={!isCurrent}>
                        {isCurrent ? "Текущий тариф" : "Перейти на тариф"}
                      </button>
                    )}
                  </article>
                );
              })}
            </section>
          </section>
        )}
      </section>

      {cropSource ? (
        <div className="avatar-cropper" role="dialog" aria-modal="true" aria-label="Обрезка аватара">
          <div className="avatar-cropper__backdrop" onClick={resetCropState} />

          <div className="panel avatar-cropper__dialog">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Обрезка аватара</h2>
                <p>Перетащите фото внутри кадра и настройте масштаб.</p>
              </div>
            </div>

            <div className="avatar-cropper__viewport-wrap">
              <div
                className="avatar-cropper__viewport"
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <img
                  src={cropSource}
                  alt="Предпросмотр обрезки"
                  onLoad={handleCropImageLoad}
                  style={{
                    width: `${cropBounds.width}px`,
                    height: `${cropBounds.height}px`,
                    transform: `translate(${cropPosition.x}px, ${cropPosition.y}px)`,
                  }}
                />
                <div className="avatar-cropper__frame" aria-hidden="true" />
              </div>
            </div>

            <label className="auth-field" htmlFor="avatar-crop-zoom">
              <span>Масштаб</span>
              <input
                id="avatar-crop-zoom"
                className="avatar-cropper__range"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={handleCropZoomChange}
              />
            </label>

            <div className="avatar-cropper__actions">
              <button className="landing-button landing-button--ghost" type="button" onClick={resetCropState}>
                Отмена
              </button>
              <button className="auth-submit" type="button" onClick={applyAvatarCrop}>
                Применить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}

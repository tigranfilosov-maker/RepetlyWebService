import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { DropdownSelect } from "../components/DropdownSelect";
import { AuthError, Field, SocialButtons } from "../components/AuthFormParts";
import { getDefaultPathForRole } from "../routeMeta";

const steps = [
  { number: 1, label: "Контакты" },
  { number: 2, label: "Профиль" },
  { number: 3, label: "Пароль" },
];

export function SignUpPage() {
  const { signUp, providers } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formState, setFormState] = useState({
    fullName: "",
    username: "",
    email: "",
    phoneNumber: "",
    role: "teacher",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function validateStep(step) {
    if (step === 1) {
      if (!formState.fullName.trim() || !formState.email.trim() || !formState.phoneNumber.trim()) {
        return "Заполните имя, почту и телефон.";
      }
    }

    if (step === 2) {
      if (!formState.username.trim() || !formState.role) {
        return "Укажите никнейм и выберите роль.";
      }
    }

    if (step === 3) {
      if (!formState.password || !formState.confirmPassword) {
        return "Введите пароль и подтверждение пароля.";
      }

      if (formState.password !== formState.confirmPassword) {
        return "Пароли не совпадают.";
      }
    }

    return "";
  }

  function handleNext() {
    const validationError = validateStep(currentStep);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  }

  function handleBack() {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateStep(3);
    setError(validationError);

    if (validationError) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await signUp(formState);
      navigate(getDefaultPathForRole(response.user.role));
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось создать аккаунт.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Регистрация проходит в три коротких шага: контакты, профиль и пароль."
      footer={
        <>
          Уже есть аккаунт? <Link to="/sign-in">Войти</Link>
        </>
      }
    >
      <form className="auth-form auth-form--stepped" onSubmit={handleSubmit}>
        <div className="signup-progress" aria-label={`Шаг ${currentStep} из ${steps.length}`}>
          <div className="signup-progress__track">
            <span style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }} />
          </div>
          <div className="signup-progress__steps">
            {steps.map((step) => (
              <button
                key={step.number}
                className={`signup-progress__step${currentStep >= step.number ? " signup-progress__step--active" : ""}`}
                type="button"
                onClick={() => {
                  if (step.number < currentStep) {
                    setCurrentStep(step.number);
                    setError("");
                  }
                }}
                aria-current={currentStep === step.number ? "step" : undefined}
              >
                <span>{step.number}</span>
                <small>{step.label}</small>
              </button>
            ))}
          </div>
        </div>

        <AuthError message={error} />

        {currentStep === 1 ? (
          <>
            <Field
              id="sign-up-name"
              label="Полное имя"
              autoComplete="name"
              placeholder="Екатерина Морозова"
              value={formState.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
            <Field
              id="sign-up-email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="mail@example.com"
              value={formState.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
            <Field
              id="sign-up-phone"
              label="Телефон"
              type="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
              value={formState.phoneNumber}
              onChange={(event) => updateField("phoneNumber", event.target.value)}
            />
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <Field
              id="sign-up-username"
              label="Никнейм"
              autoComplete="username"
              placeholder="your_username"
              value={formState.username}
              onChange={(event) => updateField("username", event.target.value)}
            />
            <label className="auth-field" htmlFor="sign-up-role">
              <span>Роль</span>
              <DropdownSelect
                value={formState.role}
                onChange={(role) => updateField("role", role)}
                options={[
                  { value: "teacher", label: "Преподаватель" },
                  { value: "student", label: "Ученик" },
                ]}
                placeholder="Выберите роль"
              />
            </label>
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <Field
              id="sign-up-password"
              label="Пароль"
              type="password"
              autoComplete="new-password"
              placeholder="Минимум 8 символов"
              value={formState.password}
              onChange={(event) => updateField("password", event.target.value)}
            />
            <Field
              id="sign-up-password-confirm"
              label="Подтверждение пароля"
              type="password"
              autoComplete="new-password"
              placeholder="Повторите пароль"
              value={formState.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />
          </>
        ) : null}

        <div className="signup-actions">
          {currentStep > 1 ? (
            <button className="landing-button landing-button--ghost" type="button" onClick={handleBack}>
              Назад
            </button>
          ) : null}

          {currentStep < steps.length ? (
            <button className="auth-submit" type="button" onClick={handleNext}>
              Далее
            </button>
          ) : (
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Создаём..." : "Создать аккаунт"}
            </button>
          )}
        </div>
      </form>

      <div className="auth-divider">
        <span>или зарегистрироваться через</span>
      </div>
      <SocialButtons
        providers={providers}
        telegramHref={`/api/auth/telegram/start?mode=signup&role=${encodeURIComponent(formState.role)}`}
        telegramLabel="Telegram"
      />
    </AuthShell>
  );
}

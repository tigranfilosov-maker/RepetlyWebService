import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { DropdownSelect } from "../components/DropdownSelect";
import { AuthError, Field, SocialButtons } from "../components/AuthFormParts";
import { getDefaultPathForRole } from "../routeMeta";

export function SignUpPage() {
  const { signUp, providers } = useAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    role: "teacher",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (formState.password !== formState.confirmPassword) {
      setError("Пароли не совпадают.");
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
      subtitle="Регистрация доступна только для преподавателей и учеников. Администратор создаётся системой."
      footer={
        <>
          Уже есть аккаунт? <Link to="/sign-in">Войти</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError message={error} />
        <Field
          id="sign-up-name"
          label="Полное имя"
          autoComplete="name"
          placeholder="Екатерина Морозова"
          value={formState.fullName}
          onChange={(event) =>
            setFormState((current) => ({ ...current, fullName: event.target.value }))
          }
        />
        <Field
          id="sign-up-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="mail@example.com"
          value={formState.email}
          onChange={(event) =>
            setFormState((current) => ({ ...current, email: event.target.value }))
          }
        />
        <Field
          id="sign-up-phone"
          label="Телефон"
          type="tel"
          autoComplete="tel"
          placeholder="+7 999 123-45-67"
          value={formState.phoneNumber}
          onChange={(event) =>
            setFormState((current) => ({ ...current, phoneNumber: event.target.value }))
          }
        />
        <label className="auth-field" htmlFor="sign-up-role">
          <span>Роль</span>
          <DropdownSelect
            value={formState.role}
            onChange={(role) => setFormState((current) => ({ ...current, role }))}
            options={[
              { value: "teacher", label: "Преподаватель" },
              { value: "student", label: "Ученик" },
            ]}
            placeholder="Выберите роль"
          />
        </label>
        <Field
          id="sign-up-password"
          label="Пароль"
          type="password"
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          value={formState.password}
          onChange={(event) =>
            setFormState((current) => ({ ...current, password: event.target.value }))
          }
        />
        <Field
          id="sign-up-password-confirm"
          label="Подтверждение пароля"
          type="password"
          autoComplete="new-password"
          placeholder="Повторите пароль"
          value={formState.confirmPassword}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              confirmPassword: event.target.value,
            }))
          }
        />
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создаём..." : "Создать аккаунт"}
        </button>
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

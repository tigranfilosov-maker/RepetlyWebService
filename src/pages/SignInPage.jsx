import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { AuthError, Field, SocialButtons } from "../components/AuthFormParts";
import { getDefaultPathForRole } from "../routeMeta";

function mapQueryError(errorCode) {
  const errors = {
    provider_not_configured: "Провайдер входа пока не настроен в .env.",
    oauth_failed: "Не удалось завершить вход через внешний провайдер.",
    oauth_state_invalid: "Сессия входа истекла. Попробуйте снова.",
    telegram_auth_failed: "Вход через Telegram не прошёл проверку.",
  };

  return errors[errorCode] || "";
}

export function SignInPage() {
  const { signIn, providers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [error, setError] = useState(mapQueryError(new URLSearchParams(location.search).get("error")));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await signIn(formState);
      navigate(getDefaultPathForRole(response.user.role));
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось выполнить вход.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Вход в аккаунт"
      subtitle="Безопасный доступ к панели преподавателя, ученика или администратора."
      footer={
        <>
          Нет аккаунта? <Link to="/sign-up">Создать аккаунт</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError message={error} />
        <Field
          id="sign-in-email"
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
          id="sign-in-password"
          label="Пароль"
          type="password"
          autoComplete="current-password"
          placeholder="Введите пароль"
          value={formState.password}
          onChange={(event) =>
            setFormState((current) => ({ ...current, password: event.target.value }))
          }
        />
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Входим..." : "Войти"}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/forgot-password">Забыли пароль?</Link>
      </div>

      <div className="auth-divider">
        <span>или продолжить через</span>
      </div>
      <SocialButtons
        providers={providers}
        telegramHref="/api/auth/telegram/start?mode=signin"
        telegramLabel="Telegram"
      />
    </AuthShell>
  );
}

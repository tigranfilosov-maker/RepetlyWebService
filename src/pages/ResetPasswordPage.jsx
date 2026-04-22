import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import {
  AuthError,
  AuthSuccess,
  Field,
} from "../components/AuthFormParts";

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search],
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Токен сброса отсутствует.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({ token, password, confirmPassword });
      setSuccess("Пароль обновлен. Перенаправление в приложение...");
      setTimeout(() => navigate("/app"), 1200);
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обновить пароль.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Новый пароль"
      subtitle="Задайте новый пароль для аккаунта. После обновления сессия будет создана автоматически."
      footer={
        <>
          Нужен новый токен? <Link to="/forgot-password">Повторить сброс</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError message={error} />
        <AuthSuccess message={success} />
        <Field
          id="reset-password"
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          id="reset-password-confirm"
          label="Подтверждение пароля"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Сохранение..." : "Сохранить пароль"}
        </button>
      </form>
    </AuthShell>
  );
}

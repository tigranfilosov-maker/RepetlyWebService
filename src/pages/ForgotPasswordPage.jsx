import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import {
  AuthError,
  AuthSuccess,
  Field,
} from "../components/AuthFormParts";

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [debugLink, setDebugLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDebugLink("");
    setIsSubmitting(true);

    try {
      const result = await forgotPassword({ email });
      setSuccess(result.message);
      setDebugLink(result.resetUrl || "");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось создать ссылку сброса.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Восстановление пароля"
      subtitle="Мы создадим безопасный токен сброса и подготовим ссылку для смены пароля."
      footer={
        <>
          Вспомнили пароль? <Link to="/sign-in">Вернуться ко входу</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError message={error} />
        <AuthSuccess
          message={success}
          extra={
            debugLink ? (
              <a href={debugLink} target="_blank" rel="noreferrer">
                Открыть ссылку сброса
              </a>
            ) : null
          }
        />
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Отправка..." : "Отправить ссылку"}
        </button>
      </form>
    </AuthShell>
  );
}

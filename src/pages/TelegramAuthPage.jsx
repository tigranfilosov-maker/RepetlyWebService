import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authRequest } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { AuthError, AuthSuccess } from "../components/AuthFormParts";
import { getDefaultPathForRole } from "../routeMeta";

function getMode(search) {
  return new URLSearchParams(search).get("mode") === "signup" ? "signup" : "signin";
}

function getRole(search) {
  return new URLSearchParams(search).get("role") === "student" ? "student" : "teacher";
}

function mapStatusError(errorCode) {
  const errors = {
    request_not_found: "Запрос на вход не найден. Начните авторизацию заново.",
    request_expired: "Время подтверждения истекло. Начните авторизацию заново.",
    request_not_ready: "Вход еще не подтвержден в Telegram.",
    telegram_not_linked:
      "Этот Telegram не привязан к аккаунту. Сначала привяжите его в настройках или используйте регистрацию через Telegram.",
  };

  return errors[errorCode] || "";
}

export function TelegramAuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pollingRef = useRef(0);
  const isFinalizingRef = useRef(false);
  const mode = useMemo(() => getMode(location.search), [location.search]);
  const role = useMemo(() => getRole(location.search), [location.search]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [request, setRequest] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      setError("");
      setMessage("");

      try {
        const data = await authRequest("/api/auth/telegram/local/start", {
          method: "POST",
          body: JSON.stringify({ mode, role }),
        });

        if (!isMounted) {
          return;
        }

        setRequest(data.request);
        setMessage(
          mode === "signup"
            ? "Откройте бота, поделитесь контактом и дождитесь автоматического входа."
            : "Откройте бота, подтвердите вход и дождитесь автоматической авторизации.",
        );
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(requestError.payload?.message || "Не удалось начать Telegram авторизацию.");
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
      window.clearInterval(pollingRef.current);
    };
  }, [mode, role]);

  useEffect(() => {
    if (!request?.token) {
      return undefined;
    }

    async function pollStatus() {
      if (isFinalizingRef.current) {
        return;
      }

      try {
        const status = await authRequest(
          `/api/auth/telegram/local/status?token=${encodeURIComponent(request.token)}`,
        );

        if (status.status === "approved") {
          isFinalizingRef.current = true;
          const result = await authRequest("/api/auth/telegram/local/finalize", {
            method: "POST",
            body: JSON.stringify({ token: request.token }),
          });
          navigate(getDefaultPathForRole(result.user.role), { replace: true });
          return;
        }

        if (status.status === "expired") {
          window.clearInterval(pollingRef.current);
          setError(mapStatusError(status.errorCode || "request_expired"));
          return;
        }

        if (status.status === "completed") {
          window.clearInterval(pollingRef.current);
          setMessage("Вход уже подтвержден. Обновите страницу входа, если переход не произошел автоматически.");
        }
      } catch (requestError) {
        window.clearInterval(pollingRef.current);
        setError(
          requestError.payload?.message ||
            mapStatusError(requestError.payload?.code) ||
            "Ошибка при проверке статуса Telegram входа.",
        );
      }
    }

    pollStatus();
    pollingRef.current = window.setInterval(pollStatus, 2500);

    return () => {
      window.clearInterval(pollingRef.current);
    };
  }, [navigate, request]);

  return (
    <AuthShell
      title={mode === "signup" ? "Регистрация через Telegram" : "Вход через Telegram"}
      subtitle="Подтверждение выполняется через Telegram-бота. Для регистрации бот запросит контакт и автоматически заполнит профиль."
      footer={
        <>
          <Link to={mode === "signup" ? "/sign-up" : "/sign-in"}>Вернуться назад</Link>
        </>
      }
    >
      <AuthError message={error} />
      <AuthSuccess message={message} />

      {isBootstrapping ? (
        <div className="auth-alert auth-alert--success">Подготавливаем запрос для Telegram...</div>
      ) : null}

      {request ? (
        <div className="telegram-auth-card">
          <p>
            1. Откройте бота <strong>@{request.botUsername}</strong>.
          </p>
          <p>
            2.{" "}
            {mode === "signup"
              ? "Нажмите кнопку ниже, откройте чат и отправьте свой контакт по запросу бота."
              : "Нажмите кнопку ниже и подтвердите вход в боте."}
          </p>
          <div className="telegram-auth-card__actions">
            <a className="auth-submit telegram-auth-card__link" href={request.botUrl}>
              Открыть бота
            </a>
          </div>
          <small>
            После подтверждения мы автоматически завершим {mode === "signup" ? "регистрацию" : "вход"} в
            этом окне.
          </small>
        </div>
      ) : null}
    </AuthShell>
  );
}

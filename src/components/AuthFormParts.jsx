export function AuthError({ message }) {
  if (!message) {
    return null;
  }

  return <div className="auth-alert auth-alert--error">{message}</div>;
}

export function AuthSuccess({ message, extra }) {
  if (!message) {
    return null;
  }

  return (
    <div className="auth-alert auth-alert--success">
      <div>{message}</div>
      {extra ? <div className="auth-alert__extra">{extra}</div> : null}
    </div>
  );
}

export function Field({ label, id, type = "text", ...props }) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <input className="auth-input" id={id} type={type} {...props} />
    </label>
  );
}

export function SocialButtons({
  providers,
  telegramHref = "/api/auth/telegram/start",
  telegramLabel = "Telegram",
}) {
  return (
    <div className="social-grid">
      <a
        className={`social-button${providers.google ? "" : " social-button--disabled"}`}
        href={providers.google ? "/api/auth/google/start" : "#"}
        onClick={(event) => {
          if (!providers.google) {
            event.preventDefault();
          }
        }}
      >
        Google
      </a>
      <a
        className={`social-button${providers.telegram ? "" : " social-button--disabled"}`}
        href={providers.telegram ? telegramHref : "#"}
        onClick={(event) => {
          if (!providers.telegram) {
            event.preventDefault();
          }
        }}
      >
        {telegramLabel}
      </a>
      <a
        className={`social-button${providers.vk ? "" : " social-button--disabled"}`}
        href={providers.vk ? "/api/auth/vk/start" : "#"}
        onClick={(event) => {
          if (!providers.vk) {
            event.preventDefault();
          }
        }}
      >
        VK
      </a>
    </div>
  );
}

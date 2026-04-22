import { Link } from "react-router-dom";
import { SiteMark } from "./SiteMark";

export function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-shell__backdrop" />

      <section className="auth-card">
        <div className="auth-card__hero">
          <div className="auth-brand">
            <SiteMark className="auth-brand__mark" />
            <div>
              <strong>Repetly</strong>
              <span>Tutor SaaS platform</span>
            </div>
          </div>

          <div className="auth-copy">
            <p className="eyebrow">Авторизация</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="auth-preview">
            <div className="auth-preview__panel" />
            <div className="auth-preview__row" />
            <div className="auth-preview__row auth-preview__row--short" />
            <div className="auth-preview__grid">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="auth-card__form">
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
          <p className="auth-note">
            <Link to="/">Вернуться на landing page</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

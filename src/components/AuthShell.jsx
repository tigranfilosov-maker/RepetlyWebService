import { useI18n } from "../i18n/I18nContext";
import authShowcaseImage from "../assets/auth-showcase.png";
import { SiteMark } from "./SiteMark";

export function AuthShell({ title, subtitle, footer, children }) {
  const { t } = useI18n();

  return (
    <div className="auth-shell">
      <div className="auth-shell__backdrop" />

      <section className="auth-card">
        <div className="auth-card__hero">
          <div className="auth-brand">
            <SiteMark className="auth-brand__mark" />
            <div className="auth-brand__title">
              <strong>Repetly</strong>
            </div>
          </div>

          <div className="auth-copy">
            <p className="eyebrow">{t("auth.eyebrow")}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="auth-preview">
            <img src={authShowcaseImage} alt="Repetly на ноутбуке и телефоне" />
          </div>
        </div>

        <div className="auth-card__form">
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}

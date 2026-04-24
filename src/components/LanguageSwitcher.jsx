import { useEffect, useRef, useState } from "react";
import { LanguageIcon } from "./icons";
import { useI18n } from "../i18n/I18nContext";

export function LanguageSwitcher({ className = "", buttonClassName = "icon-button icon-button--ghost" }) {
  const { language, setLanguage, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className={`language-switcher ${className}`.trim()}>
      <button
        className={buttonClassName}
        type="button"
        aria-label={t("layout.openLanguageMenu")}
        title={t("layout.selectLanguage")}
        onClick={() => setIsOpen((current) => !current)}
      >
        <LanguageIcon />
      </button>

      {isOpen ? (
        <div className="language-switcher__menu">
          <button
            type="button"
            className={`language-switcher__option${language === "en" ? " language-switcher__option--active" : ""}`}
            onClick={() => {
              setLanguage("en");
              setIsOpen(false);
            }}
          >
            <strong>EN</strong>
            <span>{t("common.english")}</span>
          </button>
          <button
            type="button"
            className={`language-switcher__option${language === "ru" ? " language-switcher__option--active" : ""}`}
            onClick={() => {
              setLanguage("ru");
              setIsOpen(false);
            }}
          >
            <strong>RU</strong>
            <span>{t("common.russian")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

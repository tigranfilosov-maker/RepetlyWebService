import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authRequest, useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { useTheme } from "../theme/ThemeContext";
import { getNavigationItemsForRole } from "../routeMeta";
import { SiteMark } from "./SiteMark";
import { BellIcon, LogoutIcon, MoonIcon, SearchIcon, SunIcon } from "./icons";

function PlaceholderCard({ className = "" }) {
  return (
    <div className={`placeholder-card ${className}`}>
      <div className="placeholder-card__line placeholder-card__line--short" />
      <div className="placeholder-card__line placeholder-card__line--medium" />
      <div className="placeholder-card__line placeholder-card__line--long" />
    </div>
  );
}

function getFirstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "Thomas";
}

function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const { signOut, unreadChats, user } = useAuth();
  const { t } = useI18n();
  const navigationItems = getNavigationItemsForRole(user?.role || "teacher", t);

  async function handleLogout() {
    await signOut();
    onClose?.();
    navigate("/");
  }

  return (
    <aside
      className={`sidebar sidebar--collapsed${user?.role === "teacher" ? " sidebar--teacher" : ""}`}
    >
      <div className="sidebar__top">
        <div className="brand">
          <SiteMark className="brand__mark" />
          <div className="brand__copy">
            <strong>Repetly</strong>
          </div>
        </div>

        <div className="sidebar__menu">
          <nav className="sidebar__nav" aria-label={t("layout.mainNavigation")}>
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/app" || item.path === "/admin"}
                  className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span className="nav-link__icon">
                    <Icon />
                  </span>
                  <span className="nav-link__label">{item.label}</span>
                  {item.path === "/messages" && unreadChats > 0 ? <span className="nav-link__count">{unreadChats}</span> : null}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar__logout">
          <div className="sidebar__logout-shell">
            <button className="logout-button" type="button" onClick={handleLogout} aria-label={t("layout.logout")} title={t("layout.logout")}>
              <span className="nav-link__icon">
                <LogoutIcon />
              </span>
              <span className="nav-link__label">{t("layout.logout")}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header({ title }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUnreadSummary, signOut, unreadNotifications, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const popoverRef = useRef(null);
  const profileMenuRef = useRef(null);
  const searchRef = useRef(null);
  const initials =
    user?.fullName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RP";
  const isHome = location.pathname === "/app";
  const primaryLabel = isHome ? t("layout.hi", { name: getFirstName(user?.fullName) }) : title;
  const secondaryLabel = isHome ? t("layout.gladToSeeYou") : user?.roleLabel || user?.email || t("common.workspace");
  const locale = "ru-RU";
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    weekday: "long",
  }).format(now);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!popoverRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }

      if (!searchRef.current?.contains(event.target)) {
        setSearchOpen(false);
      }

      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchOpen || studentsLoaded || user?.role !== "teacher") {
      return;
    }

    authRequest("/api/teacher-students")
      .then((data) => {
        setStudents(data.students || []);
        setStudentsLoaded(true);
      })
      .catch(() => {
        setStudentsLoaded(true);
      });
  }, [searchOpen, studentsLoaded, user?.role]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleBellClick() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      const data = await authRequest("/api/notifications");
      setNotificationItems(data.items || []);
    }
  }

  async function handleReadAll() {
    await authRequest("/api/notifications/read-all", { method: "POST" });
    await refreshUnreadSummary();
    const data = await authRequest("/api/notifications");
    setNotificationItems(data.items || []);
  }

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    const items = [
      ...getNavigationItemsForRole(user?.role || "teacher", t).map((item) => ({
        label: item.label,
        path: item.path,
        section: "Раздел",
        keywords: [item.label],
      })),
      { label: "Ученики", path: "/students?tab=students", section: "Вкладка", keywords: ["ученики", "студенты", "мои ученики"] },
      { label: "Домашние задания", path: "/students?tab=homework", section: "Вкладка", keywords: ["домашние задания", "дз", "д/з", "задания"] },
      { label: "Мои домашние задания", path: "/homework", section: "Раздел", keywords: ["домашние задания", "дз", "мои задания"] },
      { label: "Группы", path: "/students?tab=groups", section: "Вкладка", keywords: ["группы", "группа"] },
      { label: "Никнейм", path: "/profile", section: "Профиль", keywords: ["никнейм", "username", user?.username || ""] },
      { label: "Имя", path: "/profile", section: "Профиль", keywords: ["имя", "профиль", user?.fullName || ""] },
      { label: "Почта", path: "/profile", section: "Профиль", keywords: ["почта", "email", user?.email || ""] },
      { label: "Настройки Telegram", path: "/profile?tab=telegram", section: "Профиль", keywords: ["telegram", "телеграм", "бот"] },
      ...students.map((student) => ({
        label: student.fullName,
        path: `/students?tab=students&studentId=${encodeURIComponent(student.id)}`,
        section: "Ученики",
        keywords: [student.fullName, student.username || "", student.email || "", student.subject || ""],
      })),
    ];

    return items
      .filter((item) => item.keywords.some((keyword) => String(keyword).toLowerCase().includes(normalized)))
      .slice(0, 8);
  }, [searchQuery, students, t, user]);

  function openSearchResult(result) {
    navigate(result.path);
    setSearchQuery("");
    setSearchOpen(false);
  }

  async function handleProfileSignOut() {
    await signOut();
    setProfileMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__welcome">
          <strong>{primaryLabel}</strong>
          <span>{secondaryLabel}</span>
        </div>

        <div ref={searchRef} className="topbar__search" aria-label={t("common.search")}>
          <SearchIcon />
          <input
            type="search"
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchOpen && searchQuery.trim() ? (
            <div className="topbar-search-menu">
              {searchResults.map((result) => (
                <button key={`${result.section}-${result.label}-${result.path}`} type="button" className="topbar-search-menu__item" onClick={() => openSearchResult(result)}>
                  <span>{result.section}</span>
                  <strong>{result.label}</strong>
                </button>
              ))}
              {!searchResults.length ? <div className="topbar-search-menu__empty">Ничего не найдено</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="topbar__right">
        <button
          className="icon-button icon-button--ghost"
          type="button"
          aria-label={theme === "dark" ? t("layout.switchToLight") : t("layout.switchToDark")}
          onClick={toggleTheme}
          title={theme === "dark" ? t("layout.switchToLight") : t("layout.switchToDark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <div ref={popoverRef} className="notification-popover">
          <button className="icon-button" type="button" aria-label={t("layout.notifications")} onClick={handleBellClick}>
            <BellIcon />
            {unreadNotifications > 0 ? <span className="icon-dot" /> : null}
          </button>

          {notificationsOpen ? (
            <div className="notification-menu">
              <div className="notification-menu__head">
                <strong>{t("layout.notifications")}</strong>
                <button type="button" className="notification-menu__read" onClick={handleReadAll}>
                  {t("layout.readAll")}
                </button>
              </div>

              <div className="notification-menu__list">
                {notificationItems.slice(0, 5).map((item) => (
                  <div key={item.id} className={`notification-menu__item${item.readAt ? "" : " notification-menu__item--unread"}`}>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                ))}
                {!notificationItems.length ? <div className="empty-state">{t("layout.noNotifications")}</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="topbar__clock-card" aria-label={t("layout.localTime")}>
          <strong>{timeLabel}</strong>
        </div>

        <div className="topbar__date-card" aria-label={t("layout.currentDate")}>
          <span>{dateLabel}</span>
        </div>

        <div ref={profileMenuRef} className="profile-menu">
          <button
            className="profile-block profile-block--button"
            type="button"
            aria-label={t("layout.openProfile")}
            title={t("layout.openProfile")}
            onClick={() => setProfileMenuOpen((current) => !current)}
          >
            <div className="profile-block__avatar" aria-hidden="true">
              {user?.avatar ? <img src={user.avatar} alt={user.fullName} /> : initials}
            </div>
          </button>

          {profileMenuOpen ? (
            <div className="profile-menu__panel">
              <button type="button" onClick={() => {
                setProfileMenuOpen(false);
                navigate("/profile");
              }}>
                Профиль
              </button>
              <button type="button" onClick={() => {
                setProfileMenuOpen(false);
                navigate("/profile?tab=telegram");
              }}>
                Настройки
              </button>
              <button className="profile-menu__logout" type="button" onClick={handleProfileSignOut}>
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ContentSkeleton({ title, sectionLayout }) {
  return (
    <>
      <section className="stats-grid" aria-label={`${title} overview`}>
        {Array.from({ length: sectionLayout.stats }).map((_, index) => (
          <PlaceholderCard key={`stat-${index}`} className="placeholder-card--stat" />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--primary">
          <div className="panel__head">
            <div>
              <h2>{title}</h2>
              <p>Main section</p>
            </div>
          </div>

          <div className="panel-stack">
            {Array.from({ length: sectionLayout.primaryRows }).map((_, index) => (
              <div key={`row-${index}`} className="panel-row">
                <div className="panel-row__badge" />
                <div className="panel-row__content">
                  <div className="placeholder-card__line placeholder-card__line--medium" />
                  <div className="placeholder-card__line placeholder-card__line--long" />
                </div>
                <div className="panel-row__chip" />
                <div className="panel-row__button" />
              </div>
            ))}
          </div>
        </article>

        <div className="side-column">
          {Array.from({ length: sectionLayout.secondaryCards }).map((_, index) => (
            <article key={`secondary-${index}`} className="panel">
              <div className="panel__head">
                <div>
                  <h2>Section {index + 1}</h2>
                  <p>Prepared for future content</p>
                </div>
              </div>
              <PlaceholderCard />
              <PlaceholderCard />
              <PlaceholderCard />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function AppLayout({ title, sectionLayout, contentMode = "default", contentClassName = "", children = null }) {
  const shouldRenderCustomContent = contentMode !== "default";

  return (
    <div className="app-shell app-shell--sidebar-collapsed">
      <Sidebar onClose={() => undefined} />

      <main className="content">
        <Header title={title} />
        <div className={`content__body${contentClassName ? ` ${contentClassName}` : ""}`}>
          {shouldRenderCustomContent ? children : <ContentSkeleton title={title} sectionLayout={sectionLayout} />}
        </div>
      </main>
    </div>
  );
}

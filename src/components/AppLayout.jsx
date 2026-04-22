import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { authRequest, useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { getNavigationItemsForRole } from "../routeMeta";
import { SiteMark } from "./SiteMark";
import { BellIcon, LogoutIcon, MoonIcon, SidebarToggleIcon } from "./icons";

function PlaceholderCard({ className = "" }) {
  return (
    <div className={`placeholder-card ${className}`}>
      <div className="placeholder-card__line placeholder-card__line--short" />
      <div className="placeholder-card__line placeholder-card__line--medium" />
      <div className="placeholder-card__line placeholder-card__line--long" />
    </div>
  );
}

function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const { signOut, unreadChats, user } = useAuth();
  const navigationItems = getNavigationItemsForRole(user?.role || "teacher");
  const roleDescription =
    user?.role === "teacher" ? "Панель преподавателя" : user?.role === "student" ? "Панель ученика" : "Панель администратора";

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <aside
      className={`sidebar${user?.role === "teacher" ? " sidebar--teacher" : ""}${collapsed ? " sidebar--collapsed" : ""}`}
    >
      <div className="sidebar__top">
        <div className="brand">
          <SiteMark className="brand__mark" />
          <div className="brand__copy">
            <strong>Repetly</strong>
            <span>{roleDescription}</span>
          </div>
        </div>

        <div className="sidebar__menu">
          <button
            className={`sidebar__toggle${collapsed ? " sidebar__toggle--collapsed" : ""}`}
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
            title={collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
          >
            <SidebarToggleIcon />
          </button>

          <nav className="sidebar__nav" aria-label="Основная навигация">
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
                  {item.path === "/messages" && unreadChats > 0 ? (
                    <span className="nav-link__count">{unreadChats}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <button className="logout-button" type="button" onClick={handleLogout} aria-label="Выйти" title="Выйти">
            <span className="nav-link__icon">
              <LogoutIcon />
            </span>
            <span className="nav-link__label">Выйти</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function Header({ eyebrow, title }) {
  const { refreshUnreadSummary, unreadNotifications, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const popoverRef = useRef(null);
  const initials =
    user?.fullName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RP";

  useEffect(() => {
    function handleClickOutside(event) {
      if (!popoverRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <header className="topbar">
      <div className="topbar__heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="topbar__subtitle">Рабочее пространство с актуальными данными аккаунта, расписания и сообщений.</p>
      </div>

      <div className="topbar__actions">
        <button
          className="icon-button icon-button--ghost"
          type="button"
          aria-label="Переключить тему"
          onClick={toggleTheme}
          title={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
        >
          <MoonIcon />
        </button>

        <div ref={popoverRef} className="notification-popover">
          <button className="icon-button" type="button" aria-label="Уведомления" onClick={handleBellClick}>
            <BellIcon />
            {unreadNotifications > 0 ? <span className="icon-dot" /> : null}
          </button>

          {notificationsOpen ? (
            <div className="notification-menu">
              <div className="notification-menu__head">
                <strong>Уведомления</strong>
                <button type="button" className="notification-menu__read" onClick={handleReadAll}>
                  Прочитать все
                </button>
              </div>

              <div className="notification-menu__list">
                {notificationItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className={`notification-menu__item${item.readAt ? "" : " notification-menu__item--unread"}`}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                ))}
                {!notificationItems.length ? <div className="empty-state">Новых уведомлений нет.</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="profile-block">
          <div className="profile-block__avatar" aria-hidden="true">
            {user?.avatar ? <img src={user.avatar} alt={user.fullName} /> : initials}
          </div>
          <div>
            <strong>{user?.fullName || "Repetly"}</strong>
            <span>{user?.roleLabel || user?.email || "Рабочее пространство"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function ContentSkeleton({ title, sectionLayout }) {
  return (
    <>
      <section className="stats-grid" aria-label={`${title} обзор`}>
        {Array.from({ length: sectionLayout.stats }).map((_, index) => (
          <PlaceholderCard key={`stat-${index}`} className="placeholder-card--stat" />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--primary">
          <div className="panel__head">
            <div>
              <h2>{title}</h2>
              <p>Основной раздел</p>
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
                  <h2>Секция {index + 1}</h2>
                  <p>Заготовка под будущий контент</p>
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

export function AppLayout({ title, eyebrow, sectionLayout, contentMode = "default", children = null }) {
  const shouldRenderCustomContent = contentMode !== "default";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    window.localStorage.setItem("sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className={`app-shell${isSidebarCollapsed ? " app-shell--sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed((current) => !current)} />

      <main className="content">
        <Header eyebrow={eyebrow} title={title} />
        <div className="content__body">
          {shouldRenderCustomContent ? children : <ContentSkeleton title={title} sectionLayout={sectionLayout} />}
        </div>
      </main>
    </div>
  );
}

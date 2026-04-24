import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { authRequest, useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { useTheme } from "../theme/ThemeContext";
import { getNavigationItemsForRole } from "../routeMeta";
import { SiteMark } from "./SiteMark";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BellIcon, LogoutIcon, MoonIcon, SearchIcon, SidebarToggleIcon, SunIcon } from "./icons";

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

function Sidebar({ collapsed, isMobile, isOpen, onClose, onToggle }) {
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
      className={`sidebar${user?.role === "teacher" ? " sidebar--teacher" : ""}${collapsed ? " sidebar--collapsed" : ""}${isMobile ? " sidebar--mobile" : ""}${isOpen ? " sidebar--open" : ""}`}
      aria-hidden={isMobile && !isOpen}
    >
      <div className="sidebar__top">
        <div className="brand">
          <SiteMark className="brand__mark" />
          <div className="brand__copy">
            <strong>Repetly</strong>
          </div>
        </div>

        <div className="sidebar__menu">
          {!isMobile ? (
            <button
              className={`sidebar__toggle${collapsed ? " sidebar__toggle--collapsed" : ""}`}
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
              title={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
            >
              <SidebarToggleIcon />
            </button>
          ) : null}

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
                  onClick={() => {
                    if (isMobile) {
                      onClose?.();
                    }
                  }}
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

function Header({ title, isMobile, isSidebarOpen, onSidebarToggle }) {
  const location = useLocation();
  const { refreshUnreadSummary, unreadNotifications, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language } = useI18n();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const popoverRef = useRef(null);
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
  const locale = language === "ru" ? "ru-RU" : "en-US";
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
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <header className="topbar">
      <div className="topbar__left">
        {isMobile ? (
          <button
            className="topbar__menu-toggle"
            type="button"
            onClick={onSidebarToggle}
            aria-label={isSidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
            title={isSidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
          >
            <SidebarToggleIcon />
          </button>
        ) : null}

        <div className="topbar__welcome">
          <strong>{primaryLabel}</strong>
          <span>{secondaryLabel}</span>
        </div>

        <label className="topbar__search" aria-label={t("common.search")}>
          <SearchIcon />
          <input type="search" placeholder={t("common.search")} />
        </label>
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

        <LanguageSwitcher />

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

        <Link className="profile-block profile-block--button" to="/profile" aria-label={t("layout.openProfile")} title={t("layout.openProfile")}>
          <div className="profile-block__avatar" aria-hidden="true">
            {user?.avatar ? <img src={user.avatar} alt={user.fullName} /> : initials}
          </div>
        </Link>
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

export function AppLayout({ title, sectionLayout, contentMode = "default", children = null }) {
  const location = useLocation();
  const shouldRenderCustomContent = contentMode !== "default";
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 900 : false));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app-shell${!isMobile && isSidebarCollapsed ? " app-shell--sidebar-collapsed" : ""}${isMobile ? " app-shell--mobile" : ""}`}>
      {isMobile && isMobileSidebarOpen ? (
        <button className="sidebar-backdrop" type="button" aria-label={t("layout.closeMenu")} onClick={() => setIsMobileSidebarOpen(false)} />
      ) : null}

      <Sidebar
        collapsed={!isMobile && isSidebarCollapsed}
        isMobile={isMobile}
        isOpen={!isMobile || isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="content">
        <Header
          title={title}
          isMobile={isMobile}
          isSidebarOpen={isMobileSidebarOpen}
          onSidebarToggle={() => setIsMobileSidebarOpen((current) => !current)}
        />
        <div className="content__body">
          {shouldRenderCustomContent ? children : <ContentSkeleton title={title} sectionLayout={sectionLayout} />}
        </div>
      </main>
    </div>
  );
}

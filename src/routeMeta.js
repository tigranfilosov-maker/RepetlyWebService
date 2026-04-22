import {
  AnalyticsIcon,
  BellIcon,
  DashboardIcon,
  LeadIcon,
  MessageIcon,
  ProfileIcon,
  ScheduleIcon,
  SettingsIcon,
  StudentsIcon,
} from "./components/icons";

export const routeMetaRegistry = [
  { path: "/admin", icon: AnalyticsIcon, navByRole: { admin: "Админ-панель" }, allowedRoles: ["admin"] },
  { path: "/app", icon: DashboardIcon, navByRole: { teacher: "Главная", student: "Главная" }, allowedRoles: ["teacher", "student"] },
  { path: "/students", icon: StudentsIcon, navByRole: { teacher: "Ученики" }, allowedRoles: ["teacher"] },
  { path: "/teachers", icon: StudentsIcon, navByRole: { student: "Преподаватели" }, allowedRoles: ["student"] },
  { path: "/schedule", icon: ScheduleIcon, navByRole: { teacher: "Расписание", student: "Расписание" }, allowedRoles: ["teacher", "student"] },
  { path: "/messages", icon: MessageIcon, navByRole: { teacher: "Сообщения", student: "Сообщения" }, allowedRoles: ["teacher", "student"] },
  { path: "/lessons", icon: ScheduleIcon, navByRole: { teacher: "Занятия", student: "Занятия" }, allowedRoles: ["teacher", "student"] },
  { path: "/analytics", icon: AnalyticsIcon, navByRole: { teacher: "Аналитика" }, allowedRoles: ["teacher"] },
  { path: "/get-students", icon: LeadIcon, navByRole: { teacher: "Поиск учеников" }, allowedRoles: ["teacher"] },
  { path: "/notifications", icon: BellIcon, navByRole: { teacher: "Уведомления", student: "Уведомления" }, allowedRoles: ["teacher", "student"] },
  { path: "/profile", icon: ProfileIcon, navByRole: { teacher: "Профиль", student: "Профиль" }, allowedRoles: ["teacher", "student"] },
  { path: "/settings", icon: SettingsIcon, navByRole: { teacher: "Настройки", student: "Настройки" }, allowedRoles: ["teacher", "student"] },
];

export function getNavigationItemsForRole(role) {
  return routeMetaRegistry
    .filter((page) => page.allowedRoles.includes(role) && page.navByRole?.[role])
    .map(({ path, icon, navByRole }) => ({ path, icon, label: navByRole[role] }));
}

export function getDefaultPathForRole(role) {
  return role === "admin" ? "/admin" : "/app";
}

export function getPageMetaByPath(pathname) {
  return routeMetaRegistry.find((page) => page.path === pathname) || null;
}

import {
  AnalyticsIcon,
  BellIcon,
  DashboardIcon,
  HomeworkIcon,
  LeadIcon,
  MessageIcon,
  ProfileIcon,
  ScheduleIcon,
  StudentsIcon,
} from "./components/icons";

export const routeMetaRegistry = [
  { path: "/admin", icon: AnalyticsIcon, navKeys: { admin: "nav.admin" }, allowedRoles: ["admin"] },
  { path: "/app", icon: DashboardIcon, navKeys: { teacher: "nav.home", student: "nav.home" }, allowedRoles: ["teacher", "student"] },
  { path: "/students", icon: StudentsIcon, navKeys: { teacher: "nav.students" }, allowedRoles: ["teacher"] },
  { path: "/teachers", icon: StudentsIcon, navKeys: { student: "nav.teachers" }, allowedRoles: ["student"] },
  { path: "/homework", icon: HomeworkIcon, navKeys: { student: "nav.homework" }, allowedRoles: ["student"] },
  { path: "/schedule", icon: ScheduleIcon, navKeys: { teacher: "nav.schedule", student: "nav.schedule" }, allowedRoles: ["teacher", "student"] },
  { path: "/messages", icon: MessageIcon, navKeys: { teacher: "nav.messages", student: "nav.messages" }, allowedRoles: ["teacher", "student"] },
  { path: "/analytics", icon: AnalyticsIcon, navKeys: { teacher: "nav.analytics" }, allowedRoles: ["teacher"] },
  { path: "/get-students", icon: LeadIcon, navKeys: { teacher: "nav.getStudents" }, allowedRoles: ["teacher"] },
  { path: "/notifications", icon: BellIcon, navKeys: { teacher: "nav.notifications", student: "nav.notifications" }, allowedRoles: ["teacher", "student"] },
  { path: "/profile", icon: ProfileIcon, navKeys: { teacher: "nav.profile", student: "nav.profile" }, allowedRoles: ["teacher", "student"] },
];

export function getNavigationItemsForRole(role, t) {
  return routeMetaRegistry
    .filter((page) => page.allowedRoles.includes(role) && page.navKeys?.[role])
    .map(({ path, icon, navKeys }) => ({ path, icon, label: t(navKeys[role]) }));
}

export function getDefaultPathForRole(role) {
  return role === "admin" ? "/admin" : "/app";
}

export function getPageMetaByPath(pathname) {
  return routeMetaRegistry.find((page) => page.path === pathname) || null;
}

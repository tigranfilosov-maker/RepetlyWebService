import { AdminPage } from "./pages/AdminPage";
import { AnalyticsHubPage } from "./pages/AnalyticsHubPage";
import { GetStudentsPage } from "./pages/GetStudentsPage";
import { HomePage } from "./pages/HomePage";
import { LessonsPage } from "./pages/LessonsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentsPage } from "./pages/StudentsPage";
import { TeachersPage } from "./pages/TeachersPage";
import { routeMetaRegistry } from "./routeMeta";

const routeElements = {
  "/admin": <AdminPage />,
  "/app": <HomePage />,
  "/students": <StudentsPage />,
  "/teachers": <TeachersPage />,
  "/schedule": <SchedulePage />,
  "/messages": <MessagesPage />,
  "/lessons": <LessonsPage />,
  "/get-students": <GetStudentsPage />,
  "/analytics": <AnalyticsHubPage />,
  "/notifications": <NotificationsPage />,
  "/profile": <ProfilePage />,
  "/settings": <SettingsPage />,
};

export const pageRegistry = routeMetaRegistry.map((page) => ({
  ...page,
  element: routeElements[page.path],
}));

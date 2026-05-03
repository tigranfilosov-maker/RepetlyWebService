import { AdminPage } from "./pages/AdminPage";
import { AnalyticsHubPage } from "./pages/AnalyticsHubPage";
import { GetStudentsPage } from "./pages/GetStudentsPage";
import { HomePage } from "./pages/HomePage";
import { HomeworkPage } from "./pages/HomeworkPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SchedulePage } from "./pages/SchedulePage";
import { StudentsPage } from "./pages/StudentsPage";
import { TeachersPage } from "./pages/TeachersPage";
import { routeMetaRegistry } from "./routeMeta";

const routeElements = {
  "/admin": <AdminPage />,
  "/app": <HomePage />,
  "/students": <StudentsPage />,
  "/teachers": <TeachersPage />,
  "/homework": <HomeworkPage />,
  "/schedule": <SchedulePage />,
  "/messages": <MessagesPage />,
  "/get-students": <GetStudentsPage />,
  "/analytics": <AnalyticsHubPage />,
  "/notifications": <NotificationsPage />,
  "/profile": <ProfilePage />,
};

export const pageRegistry = routeMetaRegistry.map((page) => ({
  ...page,
  element: routeElements[page.path],
}));

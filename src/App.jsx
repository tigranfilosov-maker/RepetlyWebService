import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { pageRegistry } from "./routes";
import { getDefaultPathForRole, getPageMetaByPath } from "./routeMeta";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TelegramAuthPage } from "./pages/TelegramAuthPage";

function ProtectedRoute() {
  const location = useLocation();
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="app-loading">Загрузка сессии...</div>;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  const page = getPageMetaByPath(location.pathname);

  if (page && !page.allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultPathForRole(user.role)} replace />;
  }

  return <Outlet />;
}

function PublicOnlyRoute({ children }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="app-loading">Загрузка сессии...</div>;
  }

  if (user) {
    return <Navigate to={getDefaultPathForRole(user.role)} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/sign-in"
        element={
          <PublicOnlyRoute>
            <SignInPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicOnlyRoute>
            <SignUpPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/telegram-auth"
        element={
          <PublicOnlyRoute>
            <TelegramAuthPage />
          </PublicOnlyRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        {pageRegistry.map((page) => (
          <Route key={page.path} path={page.path} element={page.element} />
        ))}

        <Route path="/pricing" element={<Navigate to="/profile?tab=pricing" replace />} />
        <Route path="/finance" element={<Navigate to="/analytics" replace />} />
        <Route path="/board" element={<Navigate to="/lessons" replace />} />
        <Route path="/zoom-lessons" element={<Navigate to="/lessons" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

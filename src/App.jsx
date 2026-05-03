import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useI18n } from "./i18n/I18nContext";
import { pageRegistry } from "./routes";
import { getDefaultPathForRole, getPageMetaByPath } from "./routeMeta";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LegalPage } from "./pages/LegalPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TelegramAuthPage } from "./pages/TelegramAuthPage";

function ProtectedRoute() {
  const location = useLocation();
  const { isLoading, user } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return <div className="app-loading">{t("common.loadingSession")}</div>;
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
  const { t } = useI18n();

  if (isLoading) {
    return <div className="app-loading">{t("common.loadingSession")}</div>;
  }

  if (user) {
    return <Navigate to={getDefaultPathForRole(user.role)} replace />;
  }

  return children;
}

export default function App() {
  const location = useLocation();

  return (
    <div className="page-route-transition" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/public-offer" element={<LegalPage type="offer" />} />
        <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
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
          <Route path="/settings" element={<Navigate to="/profile?tab=telegram" replace />} />
          <Route path="/groups" element={<Navigate to="/students?tab=groups" replace />} />
          <Route path="/finance" element={<Navigate to="/analytics" replace />} />
          <Route path="/lessons" element={<Navigate to="/app" replace />} />
          <Route path="/board" element={<Navigate to="/app" replace />} />
          <Route path="/zoom-lessons" element={<Navigate to="/app" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

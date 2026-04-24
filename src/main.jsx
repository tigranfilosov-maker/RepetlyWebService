import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { I18nProvider } from "./i18n/I18nContext";
import { SiteSettingsProvider } from "./site/SiteSettingsContext";
import { ThemeProvider } from "./theme/ThemeContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <SiteSettingsProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SiteSettingsProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

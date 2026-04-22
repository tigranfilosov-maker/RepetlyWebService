import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authRequest } from "../auth/AuthContext";

const SiteSettingsContext = createContext(null);

async function fetchSiteSettings() {
  const response = await fetch("/api/site-settings", {
    credentials: "include",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load site settings");
  }

  return data;
}

export function SiteSettingsProvider({ children }) {
  const [siteSettings, setSiteSettings] = useState({
    brandName: "Repetly",
    brandAvatar: "",
    updatedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchSiteSettings()
      .then((data) => {
        if (isMounted) {
          setSiteSettings({
            brandName: data.brandName || "Repetly",
            brandAvatar: data.brandAvatar || "",
            updatedAt: data.updatedAt || null,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      siteSettings,
      isLoading,
      async refreshSiteSettings() {
        const data = await fetchSiteSettings();
        setSiteSettings({
          brandName: data.brandName || "Repetly",
          brandAvatar: data.brandAvatar || "",
          updatedAt: data.updatedAt || null,
        });
        return data;
      },
      async updateSiteSettings(payload) {
        const data = await authRequest("/api/admin/site-settings", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setSiteSettings({
          brandName: data.settings.brandName || "Repetly",
          brandAvatar: data.settings.brandAvatar || "",
          updatedAt: data.settings.updatedAt || null,
        });

        return data.settings;
      },
    }),
    [isLoading, siteSettings],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);

  if (!context) {
    throw new Error("useSiteSettings must be used inside SiteSettingsProvider");
  }

  return context;
}

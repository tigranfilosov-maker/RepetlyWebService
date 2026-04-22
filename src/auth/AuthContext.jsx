import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || "Запрос завершился ошибкой.");
    error.payload = data;
    throw error;
  }

  return data;
}

export { request as authRequest };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState({
    google: false,
    vk: false,
    telegram: false,
    telegramBotUsername: "",
    telegramAuthMode: "widget",
  });
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [sessionResult, providerResult] = await Promise.allSettled([
          request("/api/auth/session"),
          request("/api/auth/providers"),
        ]);

        if (!isMounted) {
          return;
        }

        if (sessionResult.status === "fulfilled") {
          setUser(sessionResult.value.user);
        } else {
          setUser(null);
        }

        if (providerResult.status === "fulfilled") {
          setProviders(providerResult.value.providers);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadChats(0);
      setUnreadNotifications(0);
      return;
    }

    let isMounted = true;

    async function loadUnread() {
      try {
        const [chatData, notificationsData] = await Promise.all([
          request("/api/conversations/unread-summary"),
          request("/api/notifications"),
        ]);
        if (isMounted) {
          setUnreadChats(chatData.unreadChats || 0);
          setUnreadNotifications(notificationsData.unreadCount || 0);
        }
      } catch {}
    }

    loadUnread();
    const intervalId = window.setInterval(loadUnread, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      providers,
      unreadChats,
      unreadNotifications,
      async refreshUnreadSummary() {
        if (!user) {
          setUnreadChats(0);
          setUnreadNotifications(0);
          return 0;
        }

        const [chatData, notificationsData] = await Promise.all([
          request("/api/conversations/unread-summary"),
          request("/api/notifications"),
        ]);
        setUnreadChats(chatData.unreadChats || 0);
        setUnreadNotifications(notificationsData.unreadCount || 0);
        return chatData.unreadChats || 0;
      },
      async refreshSession() {
        const data = await request("/api/auth/session");
        setUser(data.user);
        return data.user;
      },
      async signIn(payload) {
        const data = await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setUser(data.user);
        return data;
      },
      async signUp(payload) {
        const data = await request("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setUser(data.user);
        return data;
      },
      async signOut() {
        await request("/api/auth/logout", { method: "POST" });
        setUser(null);
      },
      async updateProfile(payload) {
        const data = await request("/api/profile", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setUser(data.user);
        return data.user;
      },
      async forgotPassword(payload) {
        return request("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      async resetPassword(payload) {
        const data = await request("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setUser(data.user);
        return data;
      },
    }),
    [isLoading, providers, unreadChats, unreadNotifications, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }

  return context;
}

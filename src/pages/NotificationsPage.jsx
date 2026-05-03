import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest, useAuth } from "../auth/AuthContext";

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsPage() {
  const { refreshUnreadSummary, user } = useAuth();
  const [items, setItems] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function loadData() {
    setError("");

    try {
      const data = await authRequest("/api/notifications");
      setItems(data.items || []);
      setIncomingRequests(data.incomingRequests || []);
      setOutgoingRequests(data.outgoingRequests || []);
      await refreshUnreadSummary();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось загрузить уведомления.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDecision(requestId, action) {
    setError("");

    try {
      await authRequest(`/api/student-requests/${requestId}/${action}`, { method: "POST" });
      await loadData();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обработать запрос.");
    }
  }

  async function handleCancelDecision(requestId, action) {
    setError("");
    setBusyAction(`${requestId}-${action}`);

    try {
      await authRequest(`/api/schedule/cancel-requests/${requestId}/${action}`, { method: "POST" });
      await loadData();
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось обработать отмену занятия.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AppLayout title="Уведомления" eyebrow="Система" contentMode="custom">
      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head">
            <div>
              <h2>Лента уведомлений</h2>
              <p>Короткая история системных событий и действий по аккаунту.</p>
            </div>
          </div>

          {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

          <div className="management-list">
            {items.map((item) => (
              <div key={item.id} className="management-list__item">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small>{formatDate(item.createdAt)}</small>
                </div>
                {user?.role === "teacher" && item.type === "lesson_cancel_requested" && item.meta?.status === "pending" ? (
                  <div className="notification-card__actions">
                    <button
                      className="auth-submit notification-button"
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleCancelDecision(item.meta.requestId, "approve")}
                    >
                      Подтвердить
                    </button>
                    <button
                      className="notification-button notification-button--decline"
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleCancelDecision(item.meta.requestId, "decline")}
                    >
                      Отклонить
                    </button>
                  </div>
                ) : null}
                {item.type === "lesson_cancel_requested" && item.meta?.status && item.meta.status !== "pending" ? (
                  <span className="profile-badge">{item.meta.status === "approved" ? "Подтверждено" : "Отклонено"}</span>
                ) : null}
              </div>
            ))}
            {!items.length ? <div className="empty-state">Новых уведомлений нет.</div> : null}
          </div>
        </article>

        <div className="side-column">
          {user?.role === "student" ? (
            <article className="panel">
              <div className="panel__head panel__head--tight">
                <div>
                  <h2>Входящие приглашения</h2>
                  <p>Приглашения от преподавателей, ожидающие решения.</p>
                </div>
              </div>

              <div className="notification-list">
                {incomingRequests.map((request) => (
                  <article key={request.id} className="notification-card">
                    <div>
                      <strong>{request.teacherName}</strong>
                      <span>{request.subject}</span>
                      <small>{formatDate(request.createdAt)}</small>
                    </div>
                    <div className="notification-card__actions">
                      <button className="auth-submit notification-button" type="button" onClick={() => handleDecision(request.id, "accept")}>
                        Принять
                      </button>
                      <button className="notification-button notification-button--decline" type="button" onClick={() => handleDecision(request.id, "decline")}>
                        Отклонить
                      </button>
                    </div>
                  </article>
                ))}
                {!incomingRequests.length ? <div className="empty-state">Активных приглашений нет.</div> : null}
              </div>
            </article>
          ) : (
            <article className="panel">
              <div className="panel__head panel__head--tight">
                <div>
                  <h2>Исходящие приглашения</h2>
                  <p>Запросы ученикам, которые ещё не были обработаны.</p>
                </div>
              </div>

              <div className="notification-list">
                {outgoingRequests.map((request) => (
                  <article key={request.id} className="notification-card">
                    <div>
                      <strong>{request.studentName}</strong>
                      <span>{request.studentUsername ? `@${request.studentUsername}` : request.studentEmail}</span>
                      <small>{formatDate(request.createdAt)}</small>
                    </div>
                    <span className="profile-badge">Ожидание</span>
                  </article>
                ))}
                {!outgoingRequests.length ? <div className="empty-state">Исходящих приглашений нет.</div> : null}
              </div>
            </article>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

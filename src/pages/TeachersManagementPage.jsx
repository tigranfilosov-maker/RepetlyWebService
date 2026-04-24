import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";

export function TeachersManagementPage() {
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    authRequest("/api/connected-users")
      .then((data) => setConnectedUsers(data.users))
      .catch(() => {});
  }, []);

  return (
    <AppLayout title="Управление преподавателем" eyebrow="Операции" contentMode="custom">
      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head">
            <div>
                <h2>Обзор управления</h2>
                <p>Базовая страница для структур, связей и будущих процессов преподавателя.</p>
            </div>
          </div>

          <div className="management-grid">
            <div className="management-card">
              <strong>{connectedUsers.length}</strong>
              <span>Подключённых учеников</span>
            </div>
            <div className="management-card">
              <strong>Сообщения готовы</strong>
              <span>Внутренний чат доступен для каждой активной связи.</span>
            </div>
            <div className="management-card">
              <strong>Расписание готово</strong>
              <span>Планирование по слотам уже можно расширять до бронирования и координации.</span>
            </div>
          </div>
        </article>

        <div className="side-column">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Структура связей</h2>
                <p>Масштабируемая зона для групп, уровней и организации преподавателя.</p>
              </div>
            </div>
            <div className="management-list">
              {connectedUsers.map((user) => (
                <div key={user.id} className="management-list__item">
                  <strong>{user.fullName}</strong>
                  <span>{user.username ? `@${user.username}` : user.email}</span>
                </div>
              ))}
              {!connectedUsers.length ? (
                <div className="empty-state">Подключённых учеников пока нет.</div>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Точки дальнейшего роста</h2>
                <p>Зона под группы, процессы, правила доступа и контроль нагрузки.</p>
              </div>
            </div>
            <div className="management-list">
              <div className="management-list__item">
                <strong>Иерархии преподавателя</strong>
                <span>Структуры, когорты и внутренние категории.</span>
              </div>
              <div className="management-list__item">
                <strong>Операционные настройки</strong>
                <span>Согласования, заметки и метаданные связей.</span>
              </div>
              <div className="management-list__item">
                <strong>Интеграции планирования</strong>
                <span>Связка расписания с активностью учеников и спросом на занятия.</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </AppLayout>
  );
}

import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { EntityCard } from "../components/EntityCard";
import { authRequest } from "../auth/AuthContext";

function formatDate(value) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function TeachersPage() {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    authRequest("/api/my-teachers")
      .then((data) => setTeachers(data.teachers))
      .catch(() => {});
  }, []);

  return (
    <AppLayout title="Преподаватели" eyebrow="Рабочее пространство ученика" contentMode="custom">
      <section className="panel">
        <div className="panel__head">
          <div>
            <h2>Мои преподаватели</h2>
            <p>Подключённые преподаватели с быстрым доступом к предметам и сообщениям.</p>
          </div>
          <span className="panel-chip">{teachers.length} подключено</span>
        </div>

        <div className="entity-card-grid">
          {teachers.map((teacher) => (
            <EntityCard
              key={teacher.id}
              entity={teacher}
              badges={teacher.subjects?.length ? teacher.subjects.map((subject) => subject.name) : [teacher.subject]}
              details={[
                { label: "Статус", value: teacher.status || "Подключён" },
                { label: "Связь с", value: formatDate(teacher.connectedAt) },
              ]}
            />
          ))}
          {!teachers.length ? <div className="empty-state">Принятые приглашения преподавателей появятся здесь.</div> : null}
        </div>
      </section>
    </AppLayout>
  );
}

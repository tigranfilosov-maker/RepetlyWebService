import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { DropdownSelect } from "../components/DropdownSelect";
import { EntityCard } from "../components/EntityCard";
import { authRequest } from "../auth/AuthContext";

function formatDate(value) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StudentCard({ student, availableSubjects, onSubjectChange }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`student-tile${expanded ? " student-tile--expanded" : ""}`}>
      <div className="student-tile__card">
        <button
          className="student-tile__toggle-area"
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="student-tile__status">{student.status}</span>
          <div className="student-tile__avatar" aria-hidden="true">
            {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName || "RP")}
          </div>
          <div className="student-tile__main">
            <strong>{student.fullName}</strong>
            <span>{student.email}</span>
            <small>{student.subject || "Предмет не назначен"}</small>
          </div>
          <span className="student-tile__expand">{expanded ? "Свернуть" : "Развернуть"}</span>
        </button>

        <button
          className="entity-square-card__action student-tile__message"
          type="button"
          onClick={() => navigate(`/messages?userId=${encodeURIComponent(student.id)}`)}
        >
          Написать
        </button>
      </div>

      {expanded ? (
        <div className="student-tile__dropdown">
          <div className="student-tile__facts">
            <div className="student-tile__fact">
              <dt>Телефон</dt>
              <dd>{student.phoneNumber || "Не указан"}</dd>
            </div>
            <div className="student-tile__fact">
              <dt>Сотрудничество с</dt>
              <dd>{formatDate(student.connectedAt)}</dd>
            </div>
          </div>

          <div className="entity-card-subjects">
            <span>Предметы</span>
            <DropdownSelect
              value={student.subjects?.map((subject) => subject.id) || []}
              onChange={(subjectIds) => onSubjectChange(student.id, subjectIds)}
              options={availableSubjects.map((subject) => ({ value: subject.id, label: subject.name }))}
              placeholder="Назначить предметы"
              multiple
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [email, setEmail] = useState("");
  const [candidate, setCandidate] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    const data = await authRequest("/api/teacher-students");
    setStudents(data.students);
    setAvailableSubjects(data.availableSubjects || []);
    setPendingRequests(data.pendingRequests);
  }

  async function handleSubjectChange(studentId, subjectIds) {
    const data = await authRequest(`/api/teacher-students/${studentId}/subjects`, {
      method: "PATCH",
      body: JSON.stringify({ subjectIds }),
    });

    setStudents((current) =>
      current.map((student) =>
        student.id === studentId
          ? { ...student, subjects: data.subjects, subject: data.subjects[0]?.name || "" }
          : student,
      ),
    );
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCandidate(null);

    if (!email.trim()) {
      setError("Введите email ученика.");
      return;
    }

    setIsSearching(true);

    try {
      const result = await authRequest(`/api/students/search?email=${encodeURIComponent(email.trim())}`);

      if (!result.results.length) {
        setError("Активный аккаунт ученика с таким email не найден.");
        return;
      }

      setCandidate(result.results[0]);
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось выполнить поиск.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleInvite() {
    if (!candidate) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const result = await authRequest("/api/student-requests", {
        method: "POST",
        body: JSON.stringify({ studentEmail: candidate.email }),
      });
      setPendingRequests((current) => [result.request, ...current]);
      setSuccess("Приглашение отправлено.");
      setCandidate(null);
      setEmail("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отправить приглашение.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Ученики" eyebrow="Рабочее пространство преподавателя" contentMode="custom">
      <section className="dashboard-grid dashboard-grid--feature">
        <article className="panel panel--focus">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Активные ученики</h2>
              <p>Текущие связи для сообщений, планирования занятий и назначения предметов.</p>
            </div>
            <span className="panel-chip">{students.length} активных</span>
          </div>

          <div className="student-tiles-grid">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                availableSubjects={availableSubjects}
                onSubjectChange={handleSubjectChange}
              />
            ))}
            {!students.length ? <div className="empty-state">Активные ученики появятся после принятия приглашений.</div> : null}
          </div>
        </article>

        <div className="side-column">
          <article className="panel">
            <div className="panel__head">
              <div>
                <h2>Добавить ученика</h2>
                <p>Пригласите существующий аккаунт ученика по email.</p>
              </div>
            </div>

            <form className="invite-form" onSubmit={handleSearch}>
              {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
              {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

              <label className="auth-field" htmlFor="student-email">
                <span>Email ученика</span>
                <div className="invite-form__row">
                  <input
                    className="auth-input"
                    id="student-email"
                    type="email"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <button className="landing-button" type="submit" disabled={isSearching}>
                    {isSearching ? "Поиск..." : "Найти"}
                  </button>
                </div>
              </label>
            </form>

            {candidate ? (
              <div className="invite-result">
                <div>
                  <strong>{candidate.fullName}</strong>
                  <span>{candidate.email}</span>
                </div>
                <button className="auth-submit" type="button" onClick={handleInvite} disabled={isSubmitting}>
                  {isSubmitting ? "Отправка..." : "Добавить"}
                </button>
              </div>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel__head">
              <div>
                <h2>Ожидают ответа</h2>
                <p>Запросы, которые ученик ещё не подтвердил.</p>
              </div>
            </div>

            <div className="entity-card-grid entity-card-grid--compact">
              {pendingRequests.map((request) => (
                <EntityCard
                  key={request.id}
                  entity={{ ...request, status: "Ожидает" }}
                  badges={["Приглашение"]}
                  details={[
                    { label: "Отправлено", value: formatDate(request.createdAt) },
                    { label: "Email", value: request.email },
                  ]}
                />
              ))}
              {!pendingRequests.length ? <div className="empty-state">Нет ожидающих приглашений.</div> : null}
            </div>
          </article>
        </div>
      </section>
    </AppLayout>
  );
}

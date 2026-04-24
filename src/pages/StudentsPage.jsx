import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { EntityCard } from "../components/EntityCard";
import { authRequest } from "../auth/AuthContext";

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name) {
  return String(name || "RP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StudentProfileModal({ student, onClose, onMessage }) {
  if (!student) {
    return null;
  }

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Close profile" onClick={onClose} />
      <div className="panel dashboard-modal__dialog student-profile-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{student.fullName}</h2>
            <p>@{student.username || "username-not-set"}</p>
          </div>
          <span className="student-tile__status">{student.status}</span>
        </div>

        <div className="student-profile-modal__hero">
          <div className="student-profile-modal__avatar" aria-hidden="true">
            {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
          </div>
          <div className="student-profile-modal__meta">
            <strong>{student.subject || "No primary subject"}</strong>
            <span>Connected since {formatDate(student.connectedAt)}</span>
          </div>
        </div>

        <dl className="student-profile-modal__grid">
          <div className="student-profile-modal__item">
            <dt>Username</dt>
            <dd>{student.username ? `@${student.username}` : "Not set"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>Phone</dt>
            <dd>{student.phoneNumber || "Not specified"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>Email</dt>
            <dd>{student.email || "Not specified"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>Subjects</dt>
            <dd>{student.subjects?.length ? student.subjects.map((subject) => subject.name).join(", ") : "No subjects yet"}</dd>
          </div>
        </dl>

        <div className="student-profile-modal__actions">
          <button className="dashboard-widget__action" type="button" onClick={onClose}>
            Close
          </button>
          <button className="auth-submit" type="button" onClick={onMessage}>
            Message
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentCard({ student, onOpenProfile, onAssignHomework, onMessage }) {
  return (
    <article className="student-card43">
      <button className="student-card43__surface" type="button" onClick={() => onOpenProfile(student)}>
        <span className="student-tile__status">{student.status}</span>
        <div className="student-card43__avatar" aria-hidden="true">
          {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
        </div>
        <div className="student-card43__content">
          <strong>{student.fullName}</strong>
          <span>{student.username ? `@${student.username}` : "Username not set"}</span>
          <small>{student.subject || "No subject assigned"}</small>
        </div>
      </button>

      <div className="student-card43__actions">
        <button className="landing-button student-card43__button student-card43__button--homework" type="button" onClick={() => onAssignHomework(student)}>
          Homework
        </button>
        <button className="dashboard-widget__action student-card43__button" type="button" onClick={() => onMessage(student)}>
          Message
        </button>
      </div>
    </article>
  );
}

function HomeworkTab({ students, assignments, selectedStudentId, onSelectStudent, onSubmit, isSubmitting }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedStudentId || !title.trim() || !description.trim()) {
      return;
    }

    const success = await onSubmit({
      studentId: selectedStudentId,
      title: title.trim(),
      description: description.trim(),
      dueDate,
    });

    if (success) {
      setTitle("");
      setDescription("");
      setDueDate("");
    }
  }

  return (
    <section className="dashboard-grid dashboard-grid--feature students-homework-layout">
      <article className="panel panel--focus">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>Assign homework</h2>
            <p>Pick a connected student and send an individual assignment from one place.</p>
          </div>
        </div>

        <form className="students-homework-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Student</span>
            <select className="auth-input auth-select" value={selectedStudentId} onChange={(event) => onSelectStudent(event.target.value)}>
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span>Homework title</span>
            <input className="auth-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reading, exercises, essay..." />
          </label>

          <label className="auth-field">
            <span>Description</span>
            <textarea
              className="auth-input students-homework-form__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the task, deliverables, and expectations."
            />
          </label>

          <label className="auth-field">
            <span>Due date</span>
            <input className="auth-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>

          <button className="auth-submit" type="submit" disabled={isSubmitting || !selectedStudentId}>
            {isSubmitting ? "Assigning..." : "Assign homework"}
          </button>
        </form>
      </article>

      <aside className="side-column">
        <article className="panel">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>{selectedStudent ? selectedStudent.fullName : "Homework queue"}</h2>
              <p>{selectedStudent ? "Assignments already created for this student." : "Choose a student to focus the list."}</p>
            </div>
          </div>

          <div className="students-homework-list">
            {(selectedStudent
              ? assignments.filter((assignment) => assignment.studentId === selectedStudent.id)
              : assignments
            ).map((assignment) => (
              <article key={assignment.id} className="students-homework-item">
                <strong>{assignment.title}</strong>
                <span>{assignment.description}</span>
                <small>{assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "No due date"}</small>
              </article>
            ))}
            {!assignments.length ? <div className="empty-state">No homework assignments yet.</div> : null}
          </div>
        </article>
      </aside>
    </section>
  );
}

export function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [username, setUsername] = useState("");
  const [candidate, setCandidate] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHomeworkSubmitting, setIsHomeworkSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeStudent, setActiveStudent] = useState(null);
  const activeTab = searchParams.get("tab") === "homework" ? "homework" : "students";
  const selectedStudentId = searchParams.get("studentId") || "";

  async function loadData() {
    const data = await authRequest("/api/teacher-students");
    setStudents(data.students || []);
    setPendingRequests(data.pendingRequests || []);
    setAssignments(data.homeworkAssignments || []);
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  const pendingRequestCards = useMemo(
    () =>
      pendingRequests.map((request) => (
        <EntityCard
          key={request.id}
          entity={{ ...request, status: "Pending" }}
          badges={["Invite"]}
          details={[
            { label: "Sent", value: formatDate(request.createdAt) },
            { label: "Username", value: request.username ? `@${request.username}` : request.email },
          ]}
        />
      )),
    [pendingRequests],
  );

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCandidate(null);

    if (!username.trim()) {
      setError("Enter a student username.");
      return;
    }

    setIsSearching(true);

    try {
      const result = await authRequest(`/api/students/search?username=${encodeURIComponent(username.trim())}`);
      if (!result.results.length) {
        setError("Active student account with this username was not found.");
        return;
      }
      setCandidate(result.results[0]);
    } catch (requestError) {
      setError(requestError.payload?.message || "Search failed.");
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
        body: JSON.stringify({ studentUsername: candidate.username }),
      });
      setPendingRequests((current) => [result.request, ...current]);
      setSuccess("Invite sent.");
      setCandidate(null);
      setUsername("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to send invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleHomeworkSubmit(payload) {
    try {
      setIsHomeworkSubmitting(true);
      const response = await authRequest(`/api/teacher-students/${payload.studentId}/homework`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAssignments((current) => [response.assignment, ...current]);
      return true;
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to assign homework.");
      return false;
    } finally {
      setIsHomeworkSubmitting(false);
    }
  }

  function openHomeworkForStudent(student) {
    setSearchParams({ tab: "homework", studentId: student.id });
  }

  function openMessage(student) {
    navigate(`/messages?userId=${encodeURIComponent(student.id)}`);
  }

  return (
    <AppLayout title="Ученики" contentMode="custom">
      <div className="combined-page__tabs students-tabs">
        <button
          type="button"
          className={`combined-page__tab${activeTab === "students" ? " combined-page__tab--active" : ""}`}
          onClick={() => setSearchParams({ tab: "students" })}
        >
          My Students
        </button>
        <button
          type="button"
          className={`combined-page__tab${activeTab === "homework" ? " combined-page__tab--active" : ""}`}
          onClick={() => setSearchParams({ tab: "homework", ...(selectedStudentId ? { studentId: selectedStudentId } : {}) })}
        >
          Homework
        </button>
      </div>

      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
      {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

      {activeTab === "students" ? (
        <section className="dashboard-grid dashboard-grid--feature">
          <article className="panel panel--focus">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>My Students</h2>
                <p>Open each card for the profile view, jump into homework, or start a direct message instantly.</p>
              </div>
              <span className="panel-chip">{students.length} active</span>
            </div>

            <div className="student-card43-grid">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onOpenProfile={setActiveStudent}
                  onAssignHomework={openHomeworkForStudent}
                  onMessage={openMessage}
                />
              ))}
              {!students.length ? <div className="empty-state">Connected students will appear here once invitations are accepted.</div> : null}
            </div>
          </article>

          <div className="side-column">
            <article className="panel">
              <div className="panel__head">
                <div>
                  <h2>Add student</h2>
                  <p>Invite an existing student account by username.</p>
                </div>
              </div>

              <form className="invite-form" onSubmit={handleSearch}>
                <label className="auth-field" htmlFor="student-username">
                  <span>Student username</span>
                  <div className="invite-form__row">
                    <input
                      className="auth-input"
                      id="student-username"
                      type="text"
                      placeholder="@student_username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    <button className="landing-button" type="submit" disabled={isSearching}>
                      {isSearching ? "Searching..." : "Find"}
                    </button>
                  </div>
                </label>
              </form>

              {candidate ? (
                <div className="invite-result">
                  <div>
                    <strong>{candidate.fullName}</strong>
                    <span>@{candidate.username}</span>
                  </div>
                  <button className="auth-submit" type="button" onClick={handleInvite} disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Add"}
                  </button>
                </div>
              ) : null}
            </article>

            <article className="panel">
              <div className="panel__head">
                <div>
                  <h2>Pending invites</h2>
                  <p>Requests that students have not accepted yet.</p>
                </div>
              </div>

              <div className="entity-card-grid entity-card-grid--compact">
                {pendingRequestCards}
                {!pendingRequests.length ? <div className="empty-state">No pending invites.</div> : null}
              </div>
            </article>
          </div>
        </section>
      ) : (
        <HomeworkTab
          students={students}
          assignments={assignments}
          selectedStudentId={selectedStudentId}
          onSelectStudent={(studentId) => setSearchParams({ tab: "homework", ...(studentId ? { studentId } : {}) })}
          onSubmit={handleHomeworkSubmit}
          isSubmitting={isHomeworkSubmitting}
        />
      )}

      <StudentProfileModal
        student={activeStudent}
        onClose={() => setActiveStudent(null)}
        onMessage={() => {
          if (activeStudent) {
            openMessage(activeStudent);
          }
        }}
      />
    </AppLayout>
  );
}

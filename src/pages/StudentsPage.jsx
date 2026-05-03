import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";
import { GroupsContent } from "./GroupsPage";

function formatDate(value) {
  if (!value) {
    return "Нет даты";
  }

  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseIsoDate(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date();
}

function buildMiniCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      iso: toLocalIsoDate(date),
      dateNumber: date.getDate(),
      inMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function formatStatus(value) {
  const normalized = String(value || "").toLowerCase();
  const labels = {
    active: "Активен",
    connected: "Подключен",
    pending: "Ожидает",
    accepted: "Принято",
    declined: "Отклонено",
  };

  return labels[normalized] || value || "Ожидает";
}

function getInitials(name) {
  return String(name || "RP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function readHomeworkAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function StudentProfileModal({ student, availableSubjects, onChangeSubjects, onClose, onMessage }) {
  if (!student) {
    return null;
  }

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть профиль" onClick={onClose} />
      <div className="panel dashboard-modal__dialog student-profile-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{student.fullName}</h2>
            <p>@{student.username || "никнейм-не-указан"}</p>
          </div>
          <span className="student-tile__status">{formatStatus(student.status)}</span>
        </div>

        <div className="student-profile-modal__hero">
          <div className="student-profile-modal__avatar" aria-hidden="true">
            {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
          </div>
          <div className="student-profile-modal__meta">
            <strong>{student.subject || "Основной предмет не указан"}</strong>
            <span>Подключен с {formatDate(student.connectedAt)}</span>
          </div>
        </div>

        <dl className="student-profile-modal__grid">
          <div className="student-profile-modal__item">
            <dt>Никнейм</dt>
            <dd>{student.username ? `@${student.username}` : "Не указан"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>Телефон</dt>
            <dd>{student.phoneNumber || "Не указан"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>Эл. почта</dt>
            <dd>{student.email || "Не указана"}</dd>
          </div>
          <div className="student-profile-modal__item">
            <dt>{"\u041f\u0440\u0435\u0434\u043c\u0435\u0442"}</dt>
            <dd>
              <StudentSubjectPicker student={student} availableSubjects={availableSubjects} onChangeSubjects={onChangeSubjects} />
            </dd>
          </div>
        </dl>

        <div className="student-profile-modal__actions">
          <button className="dashboard-widget__action" type="button" onClick={onClose}>
            Закрыть
          </button>
          <button className="auth-submit" type="button" onClick={onMessage}>
            Написать
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentSubjectPicker({ student, availableSubjects, onChangeSubjects }) {
  const [isOpen, setIsOpen] = useState(false);
  const assignedSubject = student.subjects?.[0] || null;

  if (!availableSubjects.length) {
    return <span className="student-card43__subject-empty">{"\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u044b \u0432 \u043f\u0440\u043e\u0444\u0438\u043b\u0435"}</span>;
  }

  async function chooseSubject(subjectId) {
    setIsOpen(false);
    await onChangeSubjects(student, [subjectId]);
  }

  if (availableSubjects.length < 2) {
    return (
      <button className="student-card43__subject-add" type="button" onClick={() => chooseSubject(availableSubjects[0].id)}>
        {assignedSubject?.name || availableSubjects[0].name}
      </button>
    );
  }

  return (
    <div className="student-card43__subject-picker">
      <button className="student-card43__subject-add" type="button" onClick={() => setIsOpen((current) => !current)}>
        {assignedSubject?.name || "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442"}
      </button>
      {isOpen ? (
        <div className="student-card43__subject-menu">
          {availableSubjects.map((subject) => (
            <button key={subject.id} type="button" onClick={() => chooseSubject(subject.id)}>
              {subject.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StudentCard({ student, onOpenProfile, onAssignHomework, onMessage }) {
  return (
    <article className="student-card43">
      <div className="student-card43__surface">
        <span className="student-tile__status">{formatStatus(student.status)}</span>
        <button className="student-card43__summary" type="button" onClick={() => onOpenProfile(student)}>
          <div className="student-card43__avatar" aria-hidden="true">
            {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
          </div>
          <div className="student-card43__content">
            <strong>{student.fullName}</strong>
            <small>{student.subject || "Предмет не назначен"}</small>
          </div>
        </button>

        <div className="student-card43__actions">
          <button
            className="landing-button student-card43__button student-card43__button--homework"
            type="button"
            onClick={() => onAssignHomework(student)}
          >
            <span aria-hidden="true">+</span>
            Д/З
          </button>
          <button
            className="dashboard-widget__action student-card43__button"
            type="button"
            onClick={() => onMessage(student)}
          >
            Написать
          </button>
        </div>
      </div>
    </article>
  );
}

function PendingInviteRow({ request }) {
  return (
    <article className="pending-invite-row">
      <span className="pending-invite-row__avatar" aria-hidden="true">
        {request.avatar ? <img src={request.avatar} alt="" /> : getInitials(request.fullName)}
      </span>
      <span className="pending-invite-row__identity">
        <strong>{request.fullName}</strong>
        <small>{request.username ? `@${request.username}` : "Никнейм не указан"}</small>
      </span>
      <span className="student-tile__status pending-invite-row__status">{formatStatus(request.status || "pending")}</span>
    </article>
  );
}

function getHomeworkStatusLabel(status) {
  const labels = {
    assigned: "Выдано",
    submitted: "На проверке",
    done: "Выполнено",
    cancelled: "Отменено",
  };

  return labels[status] || "Выдано";
}

function HomeworkCreateModal({ students, initialStudentId, onClose, onSelectStudent, onSubmit, isSubmitting }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [isStudentPickerFocused, setIsStudentPickerFocused] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());
  const fileInputRef = useRef(null);
  const datePickerRef = useRef(null);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || "");
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const normalizedStudentQuery = studentQuery.trim().toLowerCase();
  const matchingStudents = useMemo(() => {
    if (!normalizedStudentQuery) {
      return [];
    }

    return students
      .filter((student) => String(student.fullName || "").toLowerCase().includes(normalizedStudentQuery))
      .slice(0, 6);
  }, [normalizedStudentQuery, students]);

  useEffect(() => {
    setStudentQuery(selectedStudent?.fullName || "");
  }, [selectedStudent]);

  useEffect(() => {
    if (!isDatePickerOpen) {
      return undefined;
    }

    function handleClickOutside(event) {
      if (!datePickerRef.current?.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePickerOpen]);

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
      attachments: attachment ? [attachment] : [],
    });

    if (success) {
      onClose();
    }
  }

  async function handleAttachmentChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setAttachment(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      setAttachment(null);
      return;
    }

    setAttachment(await readHomeworkAttachment(file));
  }

  function selectStudent(student) {
    setSelectedStudentId(student.id);
    onSelectStudent?.(student.id);
    setStudentQuery(student.fullName);
    setIsStudentPickerFocused(false);
  }

  function selectDueDate(value) {
    setDueDate(value);
    setIsDatePickerOpen(false);
  }

  const miniCalendarDays = useMemo(() => buildMiniCalendarDays(datePickerMonth), [datePickerMonth]);
  const dueDateLabel = dueDate ? formatDate(dueDate) : "Выберите дату";

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть выдачу ДЗ" onClick={onClose} />
      <article className="panel dashboard-modal__dialog homework-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>Выдать домашнее задание</h2>
            <p>Выберите подключенного ученика и отправьте индивидуальное задание.</p>
          </div>
        </div>

        <form className="students-homework-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Ученик</span>
            <div className="homework-student-search">
              <input
                className="auth-input"
                type="search"
                placeholder="Поиск ученика"
                value={studentQuery}
                autoComplete="off"
                onChange={(event) => {
                  setStudentQuery(event.target.value);
                  if (selectedStudentId) {
                    onSelectStudent("");
                  }
                }}
                onFocus={() => setIsStudentPickerFocused(true)}
                onBlur={() => window.setTimeout(() => setIsStudentPickerFocused(false), 120)}
              />
              {isStudentPickerFocused && normalizedStudentQuery ? (
                <div className="homework-student-search__menu">
                  {matchingStudents.map((student) => (
                    <button key={student.id} className="homework-student-search__item" type="button" onClick={() => selectStudent(student)}>
                      <span className="students-live-search__avatar" aria-hidden="true">
                        {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
                      </span>
                      <span>
                        <strong>{student.fullName}</strong>
                        <small>{student.username ? `@${student.username}` : "Никнейм не указан"}</small>
                      </span>
                    </button>
                  ))}
                  {!matchingStudents.length ? <div className="students-live-search__empty">Совпадений не найдено</div> : null}
                </div>
              ) : null}
            </div>
          </label>

          <label className="auth-field">
            <span>Название задания</span>
            <input className="auth-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Чтение, упражнения, эссе..." />
          </label>

          <label className="auth-field">
            <span>Описание</span>
            <textarea
              className="auth-input students-homework-form__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Опишите задание, результат и требования."
            />
          </label>

          <label className="auth-field">
            <span>Срок сдачи</span>
            <div className="homework-date-picker" ref={datePickerRef}>
              <button
                className="auth-input homework-date-picker__trigger"
                type="button"
                onClick={() => {
                  setDatePickerMonth(parseIsoDate(dueDate));
                  setIsDatePickerOpen((current) => !current);
                }}
              >
                {dueDateLabel}
              </button>
              {isDatePickerOpen ? (
                <div className="homework-date-picker__menu">
                  <div className="homework-date-picker__head">
                    <button type="button" onClick={() => setDatePickerMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                      ←
                    </button>
                    <strong>{datePickerMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
                    <button type="button" onClick={() => setDatePickerMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                      →
                    </button>
                  </div>
                  <div className="homework-mini-calendar__weekdays">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="homework-mini-calendar__grid">
                    {miniCalendarDays.map((day) => (
                      <button
                        key={day.iso}
                        type="button"
                        className={`homework-mini-calendar__day${day.iso === dueDate ? " homework-mini-calendar__day--active" : ""}${day.inMonth ? "" : " homework-mini-calendar__day--muted"}`}
                        onClick={() => selectDueDate(day.iso)}
                      >
                        {day.dateNumber}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </label>

          <label className="auth-field">
            <span>Файл</span>
            <input ref={fileInputRef} className="homework-file-input" type="file" onChange={handleAttachmentChange} />
            <button className="homework-attach-button" type="button" onClick={() => fileInputRef.current?.click()}>
              <span aria-hidden="true">📎</span>
              {attachment ? "Заменить файл" : "Прикрепить файл"}
            </button>
            {attachment ? (
              <button
                className="dashboard-widget__action homework-file-chip"
                type="button"
                onClick={() => {
                  setAttachment(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                {attachment.name} · убрать
              </button>
            ) : null}
          </label>

          <button className="auth-submit" type="submit" disabled={isSubmitting || !selectedStudentId}>
            {isSubmitting ? "Назначаем..." : "Выдать задание"}
          </button>
        </form>
      </article>
    </div>
  );
}

function HomeworkDetailModal({ assignment, onClose, onReview, onCancel, isBusy }) {
  const [grade, setGrade] = useState("");

  if (!assignment) {
    return null;
  }

  const submittedRecipients = (assignment.recipients || []).filter((recipient) => recipient.status === "submitted");

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть ДЗ" onClick={onClose} />
      <article className="panel dashboard-modal__dialog homework-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{assignment.title}</h2>
            <p>{assignment.recipientName || assignment.studentName || assignment.groupName || "Домашнее задание"}</p>
          </div>
          <span className={`homework-status homework-status--${assignment.status || "assigned"}`}>
            {assignment.statusLabel || getHomeworkStatusLabel(assignment.status)}
          </span>
        </div>

        <div className="homework-detail">
          <div>
            <strong>Что задано</strong>
            <p>{assignment.description}</p>
          </div>
          <div>
            <strong>Кому выдано</strong>
            <p>{assignment.recipientName || assignment.studentName || assignment.groupName || "Не указано"}</p>
          </div>
          <div>
            <strong>Срок сдачи</strong>
            <p>{assignment.dueDate ? formatDate(assignment.dueDate) : "Без срока"}</p>
          </div>
          <div>
            <strong>Файлы</strong>
            <div className="homework-attachments-list">
              {assignment.attachments?.map((file) => (
                <a key={`${assignment.id}-${file.name}`} className="homework-attachment-link" href={file.dataUrl} download={file.name}>
                  {file.name}
                </a>
              ))}
              {!assignment.attachments?.length ? <span>Файлы не прикреплены</span> : null}
            </div>
          </div>
        </div>

        {assignment.recipients?.length ? (
          <div className="homework-recipients">
            {assignment.recipients.map((recipient) => (
              <div key={recipient.id} className="homework-recipient-row">
                <span>{recipient.fullName}</span>
                <b>{recipient.statusLabel || getHomeworkStatusLabel(recipient.status)}</b>
                {recipient.grade ? <small>Оценка: {recipient.grade}</small> : null}
                {recipient.submissionAttachments?.length ? (
                  <span className="homework-recipient-files">
                    {recipient.submissionAttachments.map((file) => (
                      <a key={`${recipient.id}-${file.name}`} className="homework-attachment-link" href={file.dataUrl} download={file.name}>
                        {file.name}
                      </a>
                    ))}
                  </span>
                ) : null}
                {recipient.status === "submitted" ? (
                  <button className="dashboard-widget__action" type="button" onClick={() => onReview(recipient.id, grade)} disabled={isBusy}>
                    Подтвердить
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {submittedRecipients.length ? (
          <form
            className="homework-review-form"
            onSubmit={(event) => {
              event.preventDefault();
              onReview(submittedRecipients[0].id, grade);
            }}
          >
            <label className="auth-field">
              <span>Оценка</span>
              <input className="auth-input" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Например: 5 или зачёт" />
            </label>
            <button className="auth-submit" type="submit" disabled={isBusy}>
              Подтвердить выполнение
            </button>
          </form>
        ) : null}

        <div className="group-form-modal__actions">
          <button className="dashboard-widget__action" type="button" onClick={onClose}>
            Закрыть
          </button>
          <button className="dashboard-widget__action homework-cancel-button" type="button" onClick={onCancel} disabled={isBusy || assignment.status === "cancelled"}>
            Отменить ДЗ
          </button>
        </div>
      </article>
    </div>
  );
}

function HomeworkTab({ students, assignments, selectedStudentId, openCreateInitially, onSelectStudent, onSubmit, onReview, onCancel, isSubmitting }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [hasOpenedInitial, setHasOpenedInitial] = useState(false);

  useEffect(() => {
    if (openCreateInitially && !hasOpenedInitial) {
      setIsCreateOpen(true);
      setHasOpenedInitial(true);
    }
  }, [hasOpenedInitial, openCreateInitially]);

  return (
    <section className="panel panel--focus homework-board">
      <div className="panel__head panel__head--tight">
        <div>
          <h2>Домашние задания</h2>
          <p>Выданные задания, статусы проверки и сроки сдачи.</p>
        </div>
        <button className="groups-add-button" type="button" aria-label="Выдать домашнее задание" onClick={() => setIsCreateOpen(true)}>
          +
        </button>
      </div>

      <div className="homework-table">
        {assignments.map((assignment) => (
          <button key={assignment.id} className="homework-table__row" type="button" onClick={() => setActiveAssignment(assignment)}>
            <span>
              <strong>{assignment.title}</strong>
              <small>{assignment.recipientName || assignment.studentName || "Ученик"}</small>
            </span>
            <span>{assignment.dueDate ? formatDate(assignment.dueDate) : "Без срока"}</span>
            <b className={`homework-status homework-status--${assignment.status || "assigned"}`}>
              {assignment.statusLabel || getHomeworkStatusLabel(assignment.status)}
            </b>
          </button>
        ))}
        {!assignments.length ? <div className="empty-state">Домашних заданий пока нет.</div> : null}
      </div>

      {isCreateOpen ? (
        <HomeworkCreateModal
          students={students}
          initialStudentId={selectedStudentId}
          onClose={() => setIsCreateOpen(false)}
          onSelectStudent={onSelectStudent}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      ) : null}
      <HomeworkDetailModal
        assignment={activeAssignment}
        onClose={() => setActiveAssignment(null)}
        onReview={(studentId, grade) => onReview(activeAssignment.id, studentId, grade)}
        onCancel={() => onCancel(activeAssignment.id)}
        isBusy={isSubmitting}
      />
    </section>
  );
}

export function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
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
  const [studentSearch, setStudentSearch] = useState("");
  const [isStudentSearchFocused, setIsStudentSearchFocused] = useState(false);
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "homework" || requestedTab === "groups" ? requestedTab : "students";
  const selectedStudentId = searchParams.get("studentId") || "";
  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const matchingStudents = useMemo(() => {
    if (!normalizedStudentSearch) {
      return [];
    }

    return students
      .filter((student) => String(student.fullName || "").toLowerCase().includes(normalizedStudentSearch))
      .slice(0, 6);
  }, [normalizedStudentSearch, students]);

  async function loadData() {
    const [data, homeworkData] = await Promise.all([
      authRequest("/api/teacher-students"),
      authRequest("/api/homework"),
    ]);
    setStudents(data.students || []);
    setAvailableSubjects(data.availableSubjects || []);
    setPendingRequests(data.pendingRequests || []);
    setAssignments(homeworkData.assignments || data.homeworkAssignments || []);
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== "students" || !selectedStudentId) {
      return;
    }

    const student = students.find((item) => item.id === selectedStudentId);
    if (student) {
      setActiveStudent(student);
    }
  }, [activeTab, selectedStudentId, students]);

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCandidate(null);

    if (!username.trim()) {
      setError("Введите никнейм ученика.");
      return;
    }

    setIsSearching(true);

    try {
      const result = await authRequest(`/api/students/search?username=${encodeURIComponent(username.trim())}`);
      if (!result.results.length) {
        setError("Активный аккаунт ученика с таким никнеймом не найден.");
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
        body: JSON.stringify({ studentUsername: candidate.username }),
      });
      setPendingRequests((current) => [result.request, ...current]);
      setSuccess("Приглашение отправлено.");
      setCandidate(null);
      setUsername("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отправить приглашение.");
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
      const homeworkData = await authRequest("/api/homework");
      setAssignments(homeworkData.assignments || [response.assignment, ...assignments]);
      return true;
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось выдать домашнее задание.");
      return false;
    } finally {
      setIsHomeworkSubmitting(false);
    }
  }

  function openHomeworkForStudent(student) {
    setSearchParams({ tab: "homework", studentId: student.id, create: "1" });
  }

  async function handleHomeworkReview(assignmentId, studentId, grade) {
    await authRequest(`/api/homework/${assignmentId}/review/${studentId}`, {
      method: "POST",
      body: JSON.stringify({ grade }),
    });
    const homeworkData = await authRequest("/api/homework");
    setAssignments(homeworkData.assignments || []);
  }

  async function handleHomeworkCancel(assignmentId) {
    await authRequest(`/api/homework/${assignmentId}/cancel`, { method: "POST" });
    const homeworkData = await authRequest("/api/homework");
    setAssignments(homeworkData.assignments || []);
  }

  function openMessage(student) {
    navigate(`/messages?userId=${encodeURIComponent(student.id)}`);
  }

  async function handleStudentSubjectsChange(student, subjectIds) {
    const response = await authRequest(`/api/teacher-students/${student.id}/subjects`, {
      method: "PATCH",
      body: JSON.stringify({ subjectIds }),
    });

    const updateStudent = (item) =>
      item.id === student.id
        ? {
            ...item,
            subjects: response.subjects || [],
            subject: response.subjects?.[0]?.name || "",
          }
        : item;

    setStudents((current) => current.map(updateStudent));
    setActiveStudent((current) => (current?.id === student.id ? updateStudent(current) : current));
  }

  function openStudentFromSearch(student) {
    setActiveStudent(student);
    setStudentSearch("");
    setIsStudentSearchFocused(false);
  }

  return (
    <AppLayout title="Ученики" contentMode="custom">
      <div className={`students-tabs-switch students-tabs-switch--${activeTab}`}>
        <button
          type="button"
          className={activeTab === "students" ? "students-tabs-switch__item students-tabs-switch__item--active" : "students-tabs-switch__item"}
          onClick={() => setSearchParams({ tab: "students" })}
        >
          Ученики
        </button>
        <button
          type="button"
          className={activeTab === "homework" ? "students-tabs-switch__item students-tabs-switch__item--active" : "students-tabs-switch__item"}
          onClick={() => setSearchParams({ tab: "homework", ...(selectedStudentId ? { studentId: selectedStudentId } : {}) })}
        >
          Домашние задания
        </button>
        <button
          type="button"
          className={activeTab === "groups" ? "students-tabs-switch__item students-tabs-switch__item--active" : "students-tabs-switch__item"}
          onClick={() => setSearchParams({ tab: "groups" })}
        >
          Группы
        </button>
      </div>

      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
      {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}

      {activeTab === "students" ? (
        <section className="dashboard-grid dashboard-grid--feature">
          <article className="panel panel--focus">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Мои ученики</h2>
                <p>Откройте карточку ученика, выдайте домашнее задание или начните переписку.</p>
              </div>
              <div className="students-head-actions">
                <div className="students-live-search">
                  <label className="sr-only" htmlFor="students-live-search">
                    Поиск учеников
                  </label>
                  <input
                    className="auth-input students-live-search__input"
                    id="students-live-search"
                    type="search"
                    placeholder="Поиск учеников"
                    value={studentSearch}
                    autoComplete="off"
                    onChange={(event) => setStudentSearch(event.target.value)}
                    onFocus={() => setIsStudentSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setIsStudentSearchFocused(false), 120)}
                  />
                  {isStudentSearchFocused && normalizedStudentSearch ? (
                    <div className="students-live-search__menu">
                      {matchingStudents.map((student) => (
                        <button key={student.id} type="button" className="students-live-search__item" onClick={() => openStudentFromSearch(student)}>
                          <span className="students-live-search__avatar" aria-hidden="true">
                            {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
                          </span>
                          <span>
                            <strong>{student.fullName}</strong>
                            <small>{student.username ? `@${student.username}` : "Никнейм не указан"}</small>
                          </span>
                        </button>
                      ))}
                      {!matchingStudents.length ? <div className="students-live-search__empty">Совпадений не найдено</div> : null}
                    </div>
                  ) : null}
                </div>
              </div>
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
              {!students.length ? <div className="empty-state">Подключенные ученики появятся здесь после принятия приглашений.</div> : null}
            </div>
          </article>

          <div className="side-column">
            <article className="panel">
              <div className="panel__head">
                <div>
                  <h2>Добавить ученика</h2>
                  <p>Пригласите существующий аккаунт ученика по никнейму.</p>
                </div>
              </div>

              <form className="invite-form" onSubmit={handleSearch}>
                <label className="auth-field" htmlFor="student-username">
                  <span>Никнейм ученика</span>
                  <div className="invite-form__row">
                    <input
                      className="auth-input"
                      id="student-username"
                      type="text"
                      placeholder="@никнейм_ученика"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    <button className="landing-button" type="submit" disabled={isSearching}>
                      {isSearching ? "Ищем..." : "Найти"}
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
                    {isSubmitting ? "Отправляем..." : "Добавить"}
                  </button>
                </div>
              ) : null}
            </article>

            <article className="panel">
              <div className="panel__head">
                <div>
                  <h2>Приглашения</h2>
                  <p>Заявки, которые ученики еще не приняли.</p>
                </div>
              </div>

              <div className="pending-invite-list">
                {pendingRequests.map((request) => (
                  <PendingInviteRow key={request.id} request={{ ...request, status: "pending" }} />
                ))}
                {!pendingRequests.length ? <div className="empty-state">Ожидающих приглашений нет.</div> : null}
              </div>
            </article>
          </div>
        </section>
      ) : activeTab === "homework" ? (
        <HomeworkTab
          students={students}
          assignments={assignments}
          selectedStudentId={selectedStudentId}
          openCreateInitially={searchParams.get("create") === "1"}
          onSelectStudent={(studentId) => setSearchParams({ tab: "homework", ...(studentId ? { studentId } : {}) })}
          onSubmit={handleHomeworkSubmit}
          onReview={handleHomeworkReview}
          onCancel={handleHomeworkCancel}
          isSubmitting={isHomeworkSubmitting}
        />
      ) : (
        <GroupsContent />
      )}

      <StudentProfileModal
        student={activeStudent}
        availableSubjects={availableSubjects}
        onChangeSubjects={handleStudentSubjectsChange}
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

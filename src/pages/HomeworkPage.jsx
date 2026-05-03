import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";

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

function formatDate(value) {
  if (!value) {
    return "Без срока";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status) {
  const labels = {
    assigned: "Выдано",
    submitted: "На проверке",
    done: "Выполнено",
    cancelled: "Отменено",
  };

  return labels[status] || "Выдано";
}

function HomeworkDetailsModal({ assignment, onClose, onSubmitDone, isSubmitting }) {
  const [attachment, setAttachment] = useState(null);

  if (!assignment) {
    return null;
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

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть домашнее задание" onClick={onClose} />
      <article className="panel dashboard-modal__dialog homework-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{assignment.title}</h2>
            <p>{assignment.teacherName}</p>
          </div>
          <span className={`homework-status homework-status--${assignment.status || "assigned"}`}>
            {assignment.statusLabel || statusLabel(assignment.status)}
          </span>
        </div>

        <div className="homework-detail">
          <div>
            <strong>Что задано</strong>
            <p>{assignment.description}</p>
          </div>
          <div>
            <strong>Кто выдал</strong>
            <p>{assignment.groupName ? `${assignment.teacherName}, группа «${assignment.groupName}»` : assignment.teacherName}</p>
          </div>
          <div>
            <strong>Срок сдачи</strong>
            <p>{formatDate(assignment.dueDate)}</p>
          </div>
          {assignment.grade ? (
            <div>
              <strong>Оценка</strong>
              <p>{assignment.grade}</p>
            </div>
          ) : null}
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
          <div>
            <strong>{"\u0412\u0430\u0448 \u0444\u0430\u0439\u043b"}</strong>
            <label className="homework-submit-file">
              <input
                type="file"
                onChange={handleAttachmentChange}
                disabled={isSubmitting || assignment.status === "submitted" || assignment.status === "done" || assignment.status === "cancelled"}
              />
              <span>{attachment?.name || "\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0435 \u0414\u0417"}</span>
            </label>
            {assignment.submissionAttachments?.length ? (
              <div className="homework-attachments-list">
                {assignment.submissionAttachments.map((file) => (
                  <a key={`${assignment.id}-submission-${file.name}`} className="homework-attachment-link" href={file.dataUrl} download={file.name}>
                    {file.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="group-form-modal__actions">
          <button className="dashboard-widget__action" type="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="auth-submit"
            type="button"
            disabled={isSubmitting || assignment.status === "submitted" || assignment.status === "done" || assignment.status === "cancelled"}
            onClick={() => onSubmitDone(assignment.id, attachment)}
          >
            {assignment.status === "submitted" ? "На проверке" : "Выполнено"}
          </button>
        </div>
      </article>
    </div>
  );
}

export function HomeworkPage() {
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadHomework() {
    const data = await authRequest("/api/homework");
    setAssignments(data.assignments || []);
  }

  useEffect(() => {
    loadHomework().catch((requestError) => {
      setError(requestError.payload?.message || "Не удалось загрузить домашние задания.");
    });
  }, []);

  async function submitDone(assignmentId, attachment) {
    setIsSubmitting(true);
    setError("");

    try {
      await authRequest(`/api/homework/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ attachments: attachment ? [attachment] : [] }),
      });
      await loadHomework();
      setActiveAssignment(null);
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось отправить задание на проверку.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Домашние задания" contentMode="custom">
      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

      <section className="panel panel--focus homework-board">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>Домашние задания</h2>
            <p>Откройте задание, посмотрите файлы и отправьте его преподавателю на проверку.</p>
          </div>
        </div>

        <div className="homework-table">
          {assignments.map((assignment) => (
            <button key={assignment.id} className="homework-table__row" type="button" onClick={() => setActiveAssignment(assignment)}>
              <span>
                <strong>{assignment.title}</strong>
                <small>{assignment.groupName ? `${assignment.teacherName} · ${assignment.groupName}` : assignment.teacherName}</small>
              </span>
              <span>{formatDate(assignment.dueDate)}</span>
              <b className={`homework-status homework-status--${assignment.status || "assigned"}`}>
                {assignment.statusLabel || statusLabel(assignment.status)}
              </b>
            </button>
          ))}
          {!assignments.length ? <div className="empty-state">Домашних заданий пока нет.</div> : null}
        </div>
      </section>

      <HomeworkDetailsModal assignment={activeAssignment} onClose={() => setActiveAssignment(null)} onSubmitDone={submitDone} isSubmitting={isSubmitting} />
    </AppLayout>
  );
}

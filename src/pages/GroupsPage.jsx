import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";

function getInitials(name) {
  return String(name || "RP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value) {
  if (!value) {
    return "Нет даты";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
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

function GroupCard({ group, onOpenInfo, onAssignHomework, onOpenChat }) {
  const visibleMembers = group.members.slice(0, 5);
  const hiddenCount = Math.max(0, group.members.length - visibleMembers.length);

  return (
    <article className="group-card43">
      <div className="group-card43__surface">
        <button className="group-card43__summary" type="button" onClick={() => onOpenInfo(group, "details")}>
          <span className="student-tile__status">{group.members.length} участников</span>
          <div className="group-card43__content">
            <strong>{group.name}</strong>
            <div className="group-card43__avatars" aria-label="Участники группы">
              {visibleMembers.map((member) => (
                <span key={member.id} className="group-card43__avatar" title={member.fullName}>
                  {member.avatar ? <img src={member.avatar} alt="" /> : getInitials(member.fullName)}
                </span>
              ))}
              {hiddenCount > 0 ? <span className="group-card43__avatar group-card43__avatar--more">+{hiddenCount}</span> : null}
              {!group.members.length ? <span className="group-card43__empty">Участники не выбраны</span> : null}
            </div>
          </div>
        </button>
        <div className="group-card43__actions">
          <button className="landing-button student-card43__button" type="button" onClick={() => onAssignHomework(group)}>
            <span aria-hidden="true">+</span>
            Д/З
          </button>
          <button className="dashboard-widget__action student-card43__button" type="button" onClick={() => onOpenChat(group.id)}>
            Написать
          </button>
        </div>
      </div>
    </article>
  );
}

function GroupInfoModal({ group, initialMode, isSaving, onClose, onOpenChat, onAssignHomework }) {
  const [mode, setMode] = useState(initialMode || "details");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());
  const datePickerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMode(initialMode || "details");
  }, [initialMode, group?.id]);

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

    const success = await onAssignHomework(group.id, {
      title: title.trim(),
      description: description.trim(),
      dueDate,
      attachments: attachment ? [attachment] : [],
    });

    if (success) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMode("details");
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

  function selectDueDate(value) {
    setDueDate(value);
    setIsDatePickerOpen(false);
  }

  const miniCalendarDays = useMemo(() => buildMiniCalendarDays(datePickerMonth), [datePickerMonth]);
  const dueDateLabel = dueDate ? formatDate(dueDate) : "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0430\u0442\u0443";

  if (!group) {
    return null;
  }

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть группу" onClick={onClose} />
      <div className="panel dashboard-modal__dialog group-info-modal">
        <button className="modal-close-button" type="button" aria-label="Закрыть" onClick={onClose}>
          {"\u00d7"}
        </button>
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{group.name}</h2>
            <p>{group.description || "Описание пока не указано"}</p>
          </div>
          <span className="student-tile__status">{group.members.length} участников</span>
        </div>

        <div className="group-info-modal__tabs">
          <button type="button" className={mode === "details" ? "group-info-modal__tab group-info-modal__tab--active" : "group-info-modal__tab"} onClick={() => setMode("details")}>
            Информация
          </button>
          <button type="button" className={mode === "homework" ? "group-info-modal__tab group-info-modal__tab--active" : "group-info-modal__tab"} onClick={() => setMode("homework")}>
            Д/З
          </button>
        </div>

        {mode === "details" ? (
          <>
            <div className="groups-members-list">
              {group.members.map((member) => (
                <article key={member.id} className="groups-members-list__item">
                  <strong>{member.fullName}</strong>
                  <span>{member.username ? `@${member.username}` : member.email}</span>
                </article>
              ))}
              {!group.members.length ? <div className="empty-state">Участники не выбраны.</div> : null}
            </div>
            <div className="students-homework-list">
              {group.homework?.map((assignment) => (
                <article key={assignment.id} className="students-homework-item">
                  <strong>{assignment.title}</strong>
                  <span>{assignment.description}</span>
                  <small>{assignment.dueDate ? `Срок: ${formatDate(assignment.dueDate)}` : "Без срока сдачи"}</small>
                </article>
              ))}
              {!group.homework?.length ? <div className="empty-state">Общих заданий пока нет.</div> : null}
            </div>
          </>
        ) : (
          <form className="students-homework-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Название задания</span>
              <input className="auth-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Описание</span>
              <textarea className="auth-input students-homework-form__textarea" value={description} onChange={(event) => setDescription(event.target.value)} />
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
                        {"\u2190"}
                      </button>
                      <strong>{datePickerMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
                      <button type="button" onClick={() => setDatePickerMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                        {"\u2192"}
                      </button>
                    </div>
                    <div className="homework-mini-calendar__weekdays">
                      {["\u041f\u043d", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041f\u0442", "\u0421\u0431", "\u0412\u0441"].map((day) => (
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
              <span>{"\u0424\u0430\u0439\u043b"}</span>
              <input ref={fileInputRef} className="homework-file-input" type="file" onChange={handleAttachmentChange} />
              <button className="homework-attach-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <span aria-hidden="true">{"\ud83d\udcce"}</span>
                {attachment ? "\u0417\u0430\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0430\u0439\u043b" : "\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u044c \u0444\u0430\u0439\u043b"}
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
            <button className="auth-submit" type="submit" disabled={isSaving || !title.trim() || !description.trim()}>
              {isSaving ? "Назначаем..." : "Выдать группе"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function GroupFormModal({ students, editingGroup, isSaving, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const normalizedSearch = memberSearch.trim().toLowerCase();

  useEffect(() => {
    setName(editingGroup?.name || "");
    setDescription(editingGroup?.description || "");
    setSelectedIds(editingGroup?.members?.map((member) => member.id) || []);
    setMemberSearch("");
  }, [editingGroup]);

  const selectedStudents = useMemo(
    () => selectedIds.map((id) => students.find((student) => student.id === id)).filter(Boolean),
    [selectedIds, students],
  );

  const matchingStudents = useMemo(() => {
    if (!normalizedSearch) {
      return [];
    }

    return students
      .filter((student) => !selectedIds.includes(student.id))
      .filter((student) => String(student.fullName || "").toLowerCase().includes(normalizedSearch))
      .slice(0, 6);
  }, [normalizedSearch, selectedIds, students]);

  function addStudent(studentId) {
    setSelectedIds((current) => (current.includes(studentId) ? current : [...current, studentId]));
    setMemberSearch("");
  }

  function removeStudent(studentId) {
    setSelectedIds((current) => current.filter((id) => id !== studentId));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    await onSubmit({
      id: editingGroup?.id || "",
      name: name.trim(),
      description: description.trim(),
      studentIds: selectedIds,
    });
  }

  return (
    <div className="dashboard-modal">
      <button className="dashboard-modal__backdrop" type="button" aria-label="Закрыть окно" onClick={onClose} />
      <div className="panel dashboard-modal__dialog group-form-modal">
        <div className="panel__head panel__head--tight">
          <div>
            <h2>{editingGroup ? "Редактировать группу" : "Новая группа"}</h2>
            <p>Заполните данные и добавьте участников из подключенных учеников.</p>
          </div>
        </div>

        <form className="groups-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Название группы</span>
            <input className="auth-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Группа подготовки к экзамену" />
          </label>

          <label className="auth-field">
            <span>Описание</span>
            <textarea className="auth-input students-homework-form__textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Для чего эта группа?" />
          </label>

          <div className="groups-form__members">
            <span>Участники</span>
            <div className="group-member-search">
              <input
                className="auth-input"
                type="search"
                placeholder="Поиск учеников"
                value={memberSearch}
                autoComplete="off"
                onChange={(event) => setMemberSearch(event.target.value)}
              />
              {normalizedSearch ? (
                <div className="group-member-search__menu">
                  {matchingStudents.map((student) => (
                    <div key={student.id} className="group-member-search__item">
                      <span className="group-member-search__avatar" aria-hidden="true">
                        {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
                      </span>
                      <span>
                        <strong>{student.fullName}</strong>
                        <small>{student.username ? `@${student.username}` : "Никнейм не указан"}</small>
                      </span>
                      <button className="group-member-search__add" type="button" aria-label={`Добавить ${student.fullName}`} onClick={() => addStudent(student.id)}>
                        +
                      </button>
                    </div>
                  ))}
                  {!matchingStudents.length ? <div className="group-member-search__empty">Совпадений не найдено</div> : null}
                </div>
              ) : null}
            </div>

            <div className="group-selected-members">
              {selectedStudents.map((student) => (
                <button key={student.id} className="group-selected-members__item" type="button" onClick={() => removeStudent(student.id)}>
                  <span className="group-member-search__avatar" aria-hidden="true">
                    {student.avatar ? <img src={student.avatar} alt="" /> : getInitials(student.fullName)}
                  </span>
                  <span>
                    <strong>{student.fullName}</strong>
                    <small>Убрать</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="group-form-modal__actions">
            <button className="dashboard-widget__action" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="auth-submit group-form-modal__create-button" type="submit" disabled={isSaving || !name.trim() || !selectedIds.length}>
              {editingGroup ? "Обновить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GroupsContent() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupInfoMode, setGroupInfoMode] = useState("details");
  const [isSaving, setIsSaving] = useState(false);
  const [isHomeworkSaving, setIsHomeworkSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const data = await authRequest("/api/groups");
    setGroups(data.groups || []);
    setStudents(data.students || []);
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  async function handleGroupSubmit(payload) {
    setError("");
    setIsSaving(true);

    try {
      const response = await authRequest(payload.id ? `/api/groups/${payload.id}` : "/api/groups", {
        method: payload.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setGroups(response.groups || []);
      setIsGroupModalOpen(false);
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось сохранить группу.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openGroupChat(groupId) {
    try {
      const response = await authRequest(`/api/groups/${groupId}/conversation`, { method: "POST" });
      navigate(`/messages?conversationId=${encodeURIComponent(response.conversation.id)}`);
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось открыть чат группы.");
    }
  }

  function openGroupInfo(group, mode = "details") {
    setActiveGroup(group);
    setGroupInfoMode(mode);
  }

  async function handleGroupHomeworkSubmit(groupId, payload) {
    setError("");
    setIsHomeworkSaving(true);

    try {
      const response = await authRequest(`/api/groups/${groupId}/homework`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setGroups(response.groups || []);
      setActiveGroup(response.groups?.find((group) => group.id === groupId) || null);
      return true;
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось выдать задание группе.");
      return false;
    } finally {
      setIsHomeworkSaving(false);
    }
  }

  return (
    <>
      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

      <section className="groups-page-panel">
        <article className="panel panel--focus">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Группы</h2>
              <p>Откройте карточку группы, чтобы перейти в групповой чат.</p>
            </div>
            <div className="groups-header-actions">
              <span className="panel-chip">{groups.length} групп</span>
              <button className="groups-add-button" type="button" aria-label="Создать группу" onClick={() => setIsGroupModalOpen(true)}>
                +
              </button>
            </div>
          </div>

          <div className="group-card43-grid">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onOpenInfo={openGroupInfo}
                onAssignHomework={(item) => openGroupInfo(item, "homework")}
                onOpenChat={openGroupChat}
              />
            ))}
            {!groups.length ? <div className="empty-state">Группы пока не созданы.</div> : null}
          </div>
        </article>
      </section>

      {isGroupModalOpen ? (
        <GroupFormModal
          students={students}
          editingGroup={null}
          isSaving={isSaving}
          onClose={() => setIsGroupModalOpen(false)}
          onSubmit={handleGroupSubmit}
        />
      ) : null}
      <GroupInfoModal
        group={activeGroup}
        initialMode={groupInfoMode}
        isSaving={isHomeworkSaving}
        onClose={() => setActiveGroup(null)}
        onOpenChat={openGroupChat}
        onAssignHomework={handleGroupHomeworkSubmit}
      />
    </>
  );
}

export function GroupsPage() {
  return (
    <AppLayout title="Группы" contentMode="custom">
      <GroupsContent />
    </AppLayout>
  );
}

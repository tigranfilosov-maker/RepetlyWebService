import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
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

function GroupForm({ students, editingGroup, onSubmit, isSaving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!editingGroup) {
      setName("");
      setDescription("");
      setSelectedIds([]);
      return;
    }

    setName(editingGroup.name);
    setDescription(editingGroup.description || "");
    setSelectedIds(editingGroup.members.map((member) => member.id));
  }, [editingGroup]);

  function toggleStudent(studentId) {
    setSelectedIds((current) =>
      current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId],
    );
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
    <form className="groups-form" onSubmit={handleSubmit}>
      <label className="auth-field">
        <span>Group name</span>
        <input className="auth-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Exam prep group" />
      </label>

      <label className="auth-field">
        <span>Description</span>
        <textarea className="auth-input students-homework-form__textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this group for?" />
      </label>

      <div className="groups-form__members">
        <span>Members</span>
        <div className="groups-member-picker">
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              className={`groups-member-chip${selectedIds.includes(student.id) ? " groups-member-chip--active" : ""}`}
              onClick={() => toggleStudent(student.id)}
            >
              <strong>{student.fullName}</strong>
              <span>{student.username ? `@${student.username}` : "No username"}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="auth-submit" type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : editingGroup ? "Update group" : "Create group"}
      </button>
    </form>
  );
}

export function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupHomeworkTitle, setGroupHomeworkTitle] = useState("");
  const [groupHomeworkDescription, setGroupHomeworkDescription] = useState("");
  const [groupHomeworkDueDate, setGroupHomeworkDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isHomeworkSaving, setIsHomeworkSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const data = await authRequest("/api/groups");
    setGroups(data.groups || []);
    setStudents(data.students || []);
    setSelectedGroupId((current) => current || data.groups?.[0]?.id || "");
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0] || null,
    [groups, selectedGroupId],
  );
  const editingGroup = isCreatingGroup ? null : selectedGroup;

  async function handleGroupSubmit(payload) {
    setError("");
    setIsSaving(true);

    try {
      const response = await authRequest(payload.id ? `/api/groups/${payload.id}` : "/api/groups", {
        method: payload.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setGroups(response.groups || []);
      const resolvedGroup =
        response.groups?.find((group) => group.id === payload.id)
        || response.groups?.find((group) => group.name === payload.name)
        || response.groups?.[0];
      setSelectedGroupId(resolvedGroup?.id || "");
      setIsCreatingGroup(false);
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to save group.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGroup(groupId) {
    setError("");
    setIsSaving(true);

    try {
      const response = await authRequest(`/api/groups/${groupId}`, { method: "DELETE" });
      setGroups(response.groups || []);
      setSelectedGroupId(response.groups?.[0]?.id || "");
      setIsCreatingGroup(false);
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to delete group.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignGroupHomework(event) {
    event.preventDefault();

    if (!selectedGroup) {
      return;
    }

    setError("");
    setIsHomeworkSaving(true);

    try {
      const response = await authRequest(`/api/groups/${selectedGroup.id}/homework`, {
        method: "POST",
        body: JSON.stringify({
          title: groupHomeworkTitle.trim(),
          description: groupHomeworkDescription.trim(),
          dueDate: groupHomeworkDueDate,
        }),
      });
      setGroups(response.groups || []);
      setGroupHomeworkTitle("");
      setGroupHomeworkDescription("");
      setGroupHomeworkDueDate("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to assign group homework.");
    } finally {
      setIsHomeworkSaving(false);
    }
  }

  async function openGroupChat(groupId) {
    try {
      const response = await authRequest(`/api/groups/${groupId}/conversation`, { method: "POST" });
      navigate(`/messages?conversationId=${encodeURIComponent(response.conversation.id)}`);
    } catch (requestError) {
      setError(requestError.payload?.message || "Failed to open group chat.");
    }
  }

  return (
    <AppLayout title="Группы" contentMode="custom">
      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

      <section className="dashboard-grid dashboard-grid--feature groups-layout">
        <article className="panel panel--focus">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Groups</h2>
              <p>Create reusable student groups for shared homework and one-to-many communication.</p>
            </div>
            <div className="groups-header-actions">
              <span className="panel-chip">{groups.length} groups</span>
              <button className="dashboard-widget__action" type="button" onClick={() => setIsCreatingGroup(true)}>
                New group
              </button>
            </div>
          </div>

          <div className="groups-grid">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`groups-card${selectedGroup?.id === group.id ? " groups-card--active" : ""}`}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setIsCreatingGroup(false);
                }}
              >
                <strong>{group.name}</strong>
                <span>{group.description || "No description yet"}</span>
                <small>{group.members.length} members</small>
              </button>
            ))}
            {!groups.length ? <div className="empty-state">No groups created yet.</div> : null}
          </div>

          <div className="groups-editor">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>{editingGroup ? "Edit group" : "Create group"}</h2>
                <p>Groups are built only from already connected students.</p>
              </div>
            </div>

            <GroupForm students={students} editingGroup={editingGroup} onSubmit={handleGroupSubmit} isSaving={isSaving} />
          </div>
        </article>

        <div className="side-column">
          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>{selectedGroup ? selectedGroup.name : "Group details"}</h2>
                <p>{selectedGroup ? "Shared homework and messaging live here." : "Select a group to manage it."}</p>
              </div>
            </div>

            {selectedGroup ? (
              <>
                <div className="groups-members-list">
                  {selectedGroup.members.map((member) => (
                    <article key={member.id} className="groups-members-list__item">
                      <strong>{member.fullName}</strong>
                      <span>{member.username ? `@${member.username}` : member.email}</span>
                    </article>
                  ))}
                </div>

                <div className="groups-actions">
                  <button className="landing-button" type="button" onClick={() => openGroupChat(selectedGroup.id)}>
                    Open group chat
                  </button>
                  <button className="dashboard-widget__action" type="button" onClick={() => handleDeleteGroup(selectedGroup.id)} disabled={isSaving}>
                    Delete group
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">Create a group to start shared homework and chat.</div>
            )}
          </article>

          <article className="panel">
            <div className="panel__head panel__head--tight">
              <div>
                <h2>Shared homework</h2>
                <p>Assign one task to the entire selected group.</p>
              </div>
            </div>

            {selectedGroup ? (
              <>
                <form className="students-homework-form" onSubmit={handleAssignGroupHomework}>
                  <label className="auth-field">
                    <span>Homework title</span>
                    <input className="auth-input" value={groupHomeworkTitle} onChange={(event) => setGroupHomeworkTitle(event.target.value)} />
                  </label>
                  <label className="auth-field">
                    <span>Description</span>
                    <textarea className="auth-input students-homework-form__textarea" value={groupHomeworkDescription} onChange={(event) => setGroupHomeworkDescription(event.target.value)} />
                  </label>
                  <label className="auth-field">
                    <span>Due date</span>
                    <input className="auth-input" type="date" value={groupHomeworkDueDate} onChange={(event) => setGroupHomeworkDueDate(event.target.value)} />
                  </label>
                  <button className="auth-submit" type="submit" disabled={isHomeworkSaving}>
                    {isHomeworkSaving ? "Assigning..." : "Assign to group"}
                  </button>
                </form>

                <div className="students-homework-list">
                  {selectedGroup.homework.map((assignment) => (
                    <article key={assignment.id} className="students-homework-item">
                      <strong>{assignment.title}</strong>
                      <span>{assignment.description}</span>
                      <small>{assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "No due date"}</small>
                    </article>
                  ))}
                  {!selectedGroup.homework.length ? <div className="empty-state">No group homework yet.</div> : null}
                </div>
              </>
            ) : (
              <div className="empty-state">Select a group first.</div>
            )}
          </article>
        </div>
      </section>
    </AppLayout>
  );
}

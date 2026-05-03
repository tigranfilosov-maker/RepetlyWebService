import { useEffect, useRef, useState } from "react";

export function EditableChip({ id, label, value, type = "text", placeholder = "Untitled", onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isEditing]);

  function saveValue(event) {
    event?.stopPropagation();
    const nextValue = draft.trim() || placeholder;
    setDraft(nextValue);
    setIsEditing(false);
    onChange(nextValue);
  }

  return (
    <div className={`editable-chip${isEditing ? " editable-chip--editing" : ""}`}>
      <span className="editable-chip__label">{label}</span>
      <div className="editable-chip__control" onClick={() => setIsEditing(true)}>
        <input
          ref={inputRef}
          id={id}
          type={type}
          value={draft}
          readOnly={!isEditing}
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              saveValue(event);
            }

            if (event.key === "Escape") {
              setDraft(value || "");
              setIsEditing(false);
            }
          }}
        />
        {isEditing ? (
          <button className="editable-chip__button editable-chip__button--save" type="button" onClick={saveValue}>
            ✓
          </button>
        ) : (
          <button
            className="editable-chip__button editable-chip__button--edit"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditing(true);
            }}
            aria-label={`Редактировать ${label}`}
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
}

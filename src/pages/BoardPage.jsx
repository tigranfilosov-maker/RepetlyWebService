import { useEffect, useRef, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { authRequest } from "../auth/AuthContext";

const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 1000;
const DEFAULT_COLOR = "#245dff";
const DEFAULT_TEXT = "Новая заметка";

function formatBoardDate(value) {
  if (!value) {
    return "Ещё не открывалась";
  }

  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildStrokePath(points) {
  if (!points.length) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createBoardElement(type, overrides = {}) {
  return {
    type,
    createdAt: new Date().toISOString(),
    ...overrides,
    id: crypto.randomUUID(),
  };
}

function normalizeContent(elements) {
  return {
    elements,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function replaceBoard(list, board) {
  const next = list.filter((item) => item.id !== board.id);
  return [board, ...next];
}

export function BoardWorkspace() {
  const surfaceRef = useRef(null);
  const latestContentSignatureRef = useRef("");
  const dragStateRef = useRef(null);
  const drawStateRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [boards, setBoards] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [activeBoard, setActiveBoard] = useState(null);
  const [elements, setElements] = useState([]);
  const [activeTool, setActiveTool] = useState("select");
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeSize, setStrokeSize] = useState(4);
  const [selectedElementId, setSelectedElementId] = useState("");
  const [editingTextId, setEditingTextId] = useState("");
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [attachStudentId, setAttachStudentId] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [pageState, setPageState] = useState("loading");
  const [error, setError] = useState("");
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const selectedElement = elements.find((item) => item.id === selectedElementId) || null;

  useEffect(() => {
    let isMounted = true;

    async function loadBoards() {
      try {
        const data = await authRequest("/api/boards");
        if (!isMounted) {
          return;
        }

        setBoards(data.boards || []);
        setStudents(data.students || []);
        setPageState("ready");

        if (data.boards?.length) {
          await openBoard(data.boards[0].id);
        }
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(requestError.payload?.message || "Не удалось загрузить доски.");
        setPageState("error");
      }
    }

    loadBoards();

    return () => {
      isMounted = false;
      window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event) {
      if (drawStateRef.current) {
        const point = getBoardPoint(event);
        if (!point) {
          return;
        }

        const strokeId = drawStateRef.current.elementId;
        setElements((current) =>
          current.map((item) =>
            item.id === strokeId
              ? {
                  ...item,
                  points: [...item.points, point],
                }
              : item,
          ),
        );
        return;
      }

      if (!dragStateRef.current) {
        return;
      }

      const point = getBoardPoint(event);
      if (!point) {
        return;
      }

      const { elementId, offsetX, offsetY } = dragStateRef.current;
      setElements((current) =>
        current.map((item) =>
          item.id === elementId
            ? {
                ...item,
                x: clamp(point.x - offsetX, 0, BOARD_WIDTH),
                y: clamp(point.y - offsetY, 0, BOARD_HEIGHT),
              }
            : item,
        ),
      );
    }

    function handlePointerUp() {
      if (drawStateRef.current) {
        const { elementId } = drawStateRef.current;
        drawStateRef.current = null;
        setElements((current) =>
          current.filter((item) => {
            if (item.id !== elementId) {
              return true;
            }

            return item.points.length > 1;
          }),
        );
      }

      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!activeBoard) {
      return;
    }

    const signature = JSON.stringify(normalizeContent(elements));
    if (signature === latestContentSignatureRef.current) {
      return;
    }

    window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const data = await authRequest(`/api/boards/${activeBoard.id}/content`, {
          method: "PATCH",
          body: JSON.stringify({ content: normalizeContent(elements) }),
        });

        latestContentSignatureRef.current = signature;
        setSaveState("saved");
        setBoards((current) =>
          current.map((board) =>
            board.id === activeBoard.id
              ? {
                  ...board,
                  updatedAt: data.board.updatedAt,
                  previewText: data.board.previewText,
                  elementCount: data.board.elementCount,
                }
              : board,
          ),
        );
        setActiveBoard((current) =>
          current
            ? {
                ...current,
                updatedAt: data.board.updatedAt,
                previewText: data.board.previewText,
                elementCount: data.board.elementCount,
              }
            : current,
        );
      } catch (requestError) {
        setSaveState("error");
        setError(requestError.payload?.message || "Не удалось сохранить доску.");
      }
    }, 700);

    return () => window.clearTimeout(saveTimerRef.current);
  }, [activeBoard, elements]);

  function getBoardPoint(event) {
    const surface = surfaceRef.current;
    if (!surface) {
      return null;
    }

    const rect = surface.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, BOARD_WIDTH),
      y: clamp(event.clientY - rect.top, 0, BOARD_HEIGHT),
    };
  }

  async function openBoard(boardId) {
    try {
      const data = await authRequest(`/api/boards/${boardId}`);
      const board = data.board;

      setSelectedBoardId(board.id);
      setActiveBoard(board);
      setBoardTitleDraft(board.title);
      setAttachStudentId(board.student?.id || "");
      setElements(board.content?.elements || []);
      setSelectedElementId("");
      setEditingTextId("");
      latestContentSignatureRef.current = JSON.stringify(board.content || normalizeContent([]));
      setSaveState("idle");
      setBoards((current) => replaceBoard(current, board));
      setError("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось открыть доску.");
    }
  }

  async function handleCreateBoard() {
    setIsCreatingBoard(true);
    setError("");

    try {
      const boardName = `Доска ${boards.length + 1}`;
      const data = await authRequest("/api/boards", {
        method: "POST",
        body: JSON.stringify({ title: boardName }),
      });
      const board = data.board;

      setBoards((current) => replaceBoard(current, board));
      setSelectedBoardId(board.id);
      setActiveBoard(board);
      setBoardTitleDraft(board.title);
      setAttachStudentId(board.student?.id || "");
      setElements(board.content?.elements || []);
      setSelectedElementId("");
      setEditingTextId("");
      latestContentSignatureRef.current = JSON.stringify(board.content || normalizeContent([]));
      setSaveState("idle");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось создать доску.");
    } finally {
      setIsCreatingBoard(false);
    }
  }

  async function handleTitleCommit() {
    if (!activeBoard || !boardTitleDraft.trim() || boardTitleDraft.trim() === activeBoard.title) {
      setBoardTitleDraft(activeBoard?.title || "");
      return;
    }

    setIsSavingMeta(true);

    try {
      const data = await authRequest(`/api/boards/${activeBoard.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: boardTitleDraft.trim() }),
      });
      const board = data.board;

      setActiveBoard(board);
      setBoards((current) => current.map((item) => (item.id === board.id ? { ...item, ...board } : item)));
      setBoardTitleDraft(board.title);
      setError("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось переименовать доску.");
      setBoardTitleDraft(activeBoard.title);
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function handleAttachStudent() {
    if (!activeBoard) {
      return;
    }

    setIsSavingMeta(true);

    try {
      const data = await authRequest(`/api/boards/${activeBoard.id}`, {
        method: "PATCH",
        body: JSON.stringify({ studentId: attachStudentId || null }),
      });
      const board = data.board;

      setActiveBoard(board);
      setBoards((current) => current.map((item) => (item.id === board.id ? { ...item, ...board } : item)));
      setAttachStudentId(board.student?.id || "");
      setError("");
    } catch (requestError) {
      setError(requestError.payload?.message || "Не удалось привязать доску к ученику.");
    } finally {
      setIsSavingMeta(false);
    }
  }

  function handleSurfacePointerDown(event) {
    if (!activeBoard) {
      return;
    }

    const hasElementTarget = event.target.closest?.("[data-board-element='true']");
    const point = getBoardPoint(event);

    if (!point) {
      return;
    }

    if (activeTool === "pen") {
      if (hasElementTarget) {
        return;
      }

      const stroke = createBoardElement("stroke", {
        x: 0,
        y: 0,
        color: strokeColor,
        size: strokeSize,
        points: [point],
      });

      drawStateRef.current = { elementId: stroke.id };
      setSelectedElementId(stroke.id);
      setEditingTextId("");
      setElements((current) => [...current, stroke]);
      return;
    }

    if (activeTool === "text") {
      if (hasElementTarget) {
        return;
      }

      const textBlock = createBoardElement("text", {
        x: point.x,
        y: point.y,
        text: DEFAULT_TEXT,
        color: strokeColor,
        size: 30,
        width: 260,
        height: 96,
      });

      setElements((current) => [...current, textBlock]);
      setSelectedElementId(textBlock.id);
      setEditingTextId(textBlock.id);
      return;
    }

    if (!hasElementTarget) {
      setSelectedElementId("");
      setEditingTextId("");
    }
  }

  function handleElementPointerDown(event, element) {
    event.stopPropagation();

    if (activeTool === "pen") {
      return;
    }

    setSelectedElementId(element.id);

    if (element.type === "text" && activeTool === "text") {
      setEditingTextId(element.id);
      return;
    }

    if (activeTool !== "select") {
      return;
    }

    const point = getBoardPoint(event);
    if (!point) {
      return;
    }

    dragStateRef.current = {
      elementId: element.id,
      offsetX: point.x - element.x,
      offsetY: point.y - element.y,
    };
  }

  function updateTextElement(id, patch) {
    setElements((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleDeleteSelected() {
    if (!selectedElementId) {
      return;
    }

    setElements((current) => current.filter((item) => item.id !== selectedElementId));
    setSelectedElementId("");
    setEditingTextId("");
  }

  function handleDuplicateSelected() {
    if (!selectedElement) {
      return;
    }

    const duplicate = createBoardElement(selectedElement.type, {
      ...selectedElement,
      x: selectedElement.x + 36,
      y: selectedElement.y + 36,
    });

    setElements((current) => [...current, duplicate]);
    setSelectedElementId(duplicate.id);
    if (duplicate.type === "text") {
      setEditingTextId(duplicate.id);
    }
  }

  function renderWorkspace() {
    if (!activeBoard) {
      return (
        <div className="board-empty">
          <strong>Пока нет ни одной доски</strong>
          <p>Создайте первую доску, чтобы рисовать, добавлять заметки и привязывать материалы к ученикам.</p>
          <button className="auth-submit" type="button" onClick={handleCreateBoard} disabled={isCreatingBoard}>
            {isCreatingBoard ? "Создаём..." : "Создать доску"}
          </button>
        </div>
      );
    }

    return (
      <div className="board-canvas-viewport">
        <div
          ref={surfaceRef}
          className="board-surface"
          role="presentation"
          onPointerDown={handleSurfacePointerDown}
        >
          <svg className="board-surface__svg" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
            {elements
              .filter((item) => item.type === "stroke")
              .map((item) => (
                <g key={item.id} transform={`translate(${item.x} ${item.y})`}>
                  <path
                    d={buildStrokePath(item.points)}
                    fill="none"
                    stroke={item.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={item.size}
                    opacity="0.95"
                  />
                  <path
                    d={buildStrokePath(item.points)}
                    fill="none"
                    stroke="transparent"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={Math.max(item.size + 14, 18)}
                    data-board-element="true"
                    className={selectedElementId === item.id ? "board-stroke-hit board-stroke-hit--selected" : "board-stroke-hit"}
                    onPointerDown={(event) => handleElementPointerDown(event, item)}
                  />
                </g>
              ))}
          </svg>

          <div className="board-text-layer">
            {elements
              .filter((item) => item.type === "text")
              .map((item) => {
                const isEditing = editingTextId === item.id;

                return (
                  <div
                    key={item.id}
                    data-board-element="true"
                    className={`board-text-block${selectedElementId === item.id ? " board-text-block--selected" : ""}${isEditing ? " board-text-block--editing" : ""}`}
                    style={{
                      left: item.x,
                      top: item.y,
                      width: item.width,
                      minHeight: item.height,
                      color: item.color,
                      fontSize: item.size,
                    }}
                    onPointerDown={(event) => handleElementPointerDown(event, item)}
                    onDoubleClick={() => {
                      setSelectedElementId(item.id);
                      setEditingTextId(item.id);
                    }}
                  >
                    {isEditing ? (
                      <textarea
                        autoFocus
                        className="board-text-editor"
                        value={item.text}
                        onChange={(event) => updateTextElement(item.id, { text: event.target.value })}
                        onBlur={() => setEditingTextId("")}
                      />
                    ) : (
                      <div className="board-text-block__content">{item.text || "Пустой текстовый блок"}</div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="board-page">
      <article className="panel panel--focus board-studio">
          <div className="board-studio__header">
            <div>
              <p className="eyebrow">Материалы к занятиям</p>
              <h2>Постоянные доски для уроков</h2>
              <p>
                Создавайте неограниченное количество досок, привязывайте их к ученикам, продолжайте работу после
                перезагрузки и храните структуру для будущих занятий и интеграций.
              </p>
            </div>

            <div className="board-studio__actions">
              <span className={`panel-chip${saveState === "error" ? " panel-chip--muted" : ""}`}>
                {saveState === "saving"
                  ? "Сохраняем..."
                  : saveState === "saved"
                    ? "Сохранено"
                    : saveState === "error"
                      ? "Ошибка сохранения"
                      : "Рабочая доска"}
              </span>
              <button className="landing-button" type="button" onClick={handleCreateBoard} disabled={isCreatingBoard}>
                {isCreatingBoard ? "Создаём..." : "Новая доска"}
              </button>
            </div>
          </div>

          {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}

          <div className="board-switcher">
            {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                className={`board-switcher__item${selectedBoardId === board.id ? " board-switcher__item--active" : ""}`}
                onClick={() => openBoard(board.id)}
              >
                <strong>{board.title}</strong>
                <span>{board.student?.fullName || "Не привязана"}</span>
                <small>{board.previewText || "Пустая доска"}</small>
              </button>
            ))}
          </div>

          <div className="board-studio__body">
            <div className="board-stage">
              <div className="board-stage__meta">
                <label className="board-stage__title">
                  <span>Название доски</span>
                  <input
                    className="auth-input"
                    value={boardTitleDraft}
                    onChange={(event) => setBoardTitleDraft(event.target.value)}
                    onBlur={handleTitleCommit}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={!activeBoard || isSavingMeta}
                  />
                </label>

                <div className="board-stage__facts">
                  <div className="board-stage__fact">
                    <span>Привязанный ученик</span>
                    <strong>{activeBoard?.student?.fullName || "Не привязан"}</strong>
                  </div>
                  <div className="board-stage__fact">
                    <span>Последнее открытие</span>
                    <strong>{formatBoardDate(activeBoard?.lastOpenedAt)}</strong>
                  </div>
                  <div className="board-stage__fact">
                    <span>Элементы</span>
                    <strong>{elements.length}</strong>
                  </div>
                </div>
              </div>

              {pageState === "loading" ? <div className="board-empty">Загружаем доски...</div> : renderWorkspace()}
            </div>

            <aside className="board-toolbar">
              <section className="board-toolbar__section">
                <span className="board-toolbar__label">Инструменты</span>
                <div className="board-tool-list">
                  {[
                    { id: "select", label: "Выбор" },
                    { id: "pen", label: "Перо" },
                    { id: "text", label: "Текст" },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className={`board-tool${activeTool === tool.id ? " board-tool--active" : ""}`}
                      onClick={() => setActiveTool(tool.id)}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="board-toolbar__section">
                <span className="board-toolbar__label">Кисть</span>
                <label className="board-toolbar__field">
                  <span>Цвет</span>
                  <input
                    className="board-color-input"
                    type="color"
                    value={strokeColor}
                    onChange={(event) => setStrokeColor(event.target.value)}
                  />
                </label>
                <label className="board-toolbar__field">
                  <span>Размер</span>
                  <input
                    type="range"
                    min="2"
                    max="18"
                    value={strokeSize}
                    onChange={(event) => setStrokeSize(Number(event.target.value))}
                  />
                  <small>{strokeSize}px</small>
                </label>
              </section>

              <section className="board-toolbar__section">
                <span className="board-toolbar__label">Привязать к ученику</span>
                <select
                  className="auth-input auth-select"
                  value={attachStudentId}
                  onChange={(event) => setAttachStudentId(event.target.value)}
                  disabled={!activeBoard || isSavingMeta}
                >
                  <option value="">Не привязана</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
                <button className="landing-button" type="button" onClick={handleAttachStudent} disabled={!activeBoard || isSavingMeta}>
                  {isSavingMeta ? "Сохраняем..." : "Сохранить привязку"}
                </button>
              </section>

              <section className="board-toolbar__section">
                <span className="board-toolbar__label">Редактирование</span>
                <div className="board-toolbar__selection">
                  <strong>{selectedElement ? `${selectedElement.type === "text" ? "Выбран текст" : "Выбран штрих"}` : "Ничего не выбрано"}</strong>
                  <span>
                    {selectedElement
                      ? selectedElement.type === "text"
                        ? "Дважды нажмите на текст, чтобы редактировать, и перетаскивайте для перемещения."
                        : "Перетащите штрих, чтобы переместить его по доске."
                      : "Используйте «Выбор» для перемещения, «Перо» для рисования и «Текст» для заметок."}
                  </span>
                </div>
                <button className="landing-button landing-button--ghost" type="button" onClick={handleDuplicateSelected} disabled={!selectedElement}>
                  Дублировать
                </button>
                <button className="landing-button landing-button--ghost" type="button" onClick={handleDeleteSelected} disabled={!selectedElement}>
                  Удалить
                </button>
              </section>

              <section className="board-toolbar__section">
                <span className="board-toolbar__label">Что уже готово</span>
                <div className="board-toolbar__future">
                  <div>
                    <strong>Готово для сессий уроков</strong>
                    <span>В бэкенде уже есть поля для привязки доски к занятию и видеосессии.</span>
                  </div>
                  <div>
                    <strong>Постоянное состояние</strong>
                    <span>Каждое изменение автосохраняется, поэтому к доске можно вернуться позже без потери данных.</span>
                  </div>
                  <div>
                    <strong>Готово для работы с учениками</strong>
                    <span>Привязанные доски уже структурированы для повторного использования в занятиях конкретных учеников.</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
      </article>
    </section>
  );
}

export function BoardPage() {
  return (
    <AppLayout title="Доска" eyebrow="Пространство преподавателя" contentMode="custom">
      <BoardWorkspace />
    </AppLayout>
  );
}

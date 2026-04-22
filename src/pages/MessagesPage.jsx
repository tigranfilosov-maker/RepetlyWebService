import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { authRequest, useAuth } from "../auth/AuthContext";

const chatTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatChatTime(value) {
  return chatTimeFormatter.format(new Date(value));
}

function smoothScrollToBottom(element, duration = 200) {
  if (!element) {
    return;
  }

  const start = element.scrollTop;
  const target = element.scrollHeight - element.clientHeight;

  if (target <= start) {
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    element.scrollTop = start + (target - start) * eased;

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  }

  window.requestAnimationFrame(tick);
}

export function MessagesPage() {
  const { refreshUnreadSummary, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [scrollOnNextFrame, setScrollOnNextFrame] = useState(0);
  const threadRef = useRef(null);

  async function loadConversationList() {
    const data = await authRequest("/api/conversations");
    setConversations(data.conversations);
    return data.conversations;
  }

  async function loadConversation(conversationId) {
    const data = await authRequest(`/api/conversations/${conversationId}`);
    setActiveConversation(data.conversation);
    setMessages(data.messages);
    await refreshUnreadSummary();
  }

  async function openConversationByUserId(participantId) {
    const response = await authRequest("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ participantId }),
    });

    await loadConversationList();
    setActiveConversationId(response.conversation.id);
    setSearchParams({ userId: participantId });
  }

  useEffect(() => {
    loadConversationList()
      .then((items) => {
        const participantId = searchParams.get("userId");

        if (participantId) {
          const existing = items.find((item) => item.participant.id === participantId);
          if (existing) {
            setActiveConversationId(existing.id);
          } else {
            openConversationByUserId(participantId).catch(() => {});
          }
          return;
        }

        if (items[0]) {
          setActiveConversationId(items[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    loadConversation(activeConversationId)
      .then(() => {
        if (threadRef.current) {
          threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }
      })
      .catch(() => {});

    const intervalId = window.setInterval(() => {
      loadConversation(activeConversationId).catch(() => {});
      loadConversationList().catch(() => {});
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [activeConversationId]);

  useEffect(() => {
    if (!scrollOnNextFrame) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      smoothScrollToBottom(threadRef.current, 200);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messages, scrollOnNextFrame]);

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!draft.trim() || !activeConversationId) {
      return;
    }

    setIsSending(true);

    try {
      const data = await authRequest(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: draft.trim() }),
      });
      setMessages((current) => [...current, data.message]);
      setDraft("");
      setScrollOnNextFrame((current) => current + 1);
      await loadConversationList();
      await refreshUnreadSummary();
    } finally {
      setIsSending(false);
    }
  }

  const participantSubtitle = activeConversation?.participant?.subject
    || (activeConversation?.participant?.role === "teacher" ? "Преподаватель" : "Ученик");

  return (
    <AppLayout title="Сообщения" eyebrow="Мессенджер" contentMode="custom">
      <section className="messages-layout messages-layout--swapped messages-layout--locked">
        <article className="panel chat-panel">
          {activeConversation ? (
            <>
              <div className="chat-panel__header">
                <div>
                  <h2>{activeConversation.participant?.fullName}</h2>
                  {participantSubtitle ? <p>{participantSubtitle}</p> : null}
                </div>
              </div>

              <div ref={threadRef} className="chat-thread">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble${message.isOwn ? " chat-bubble--own" : ""}`}
                  >
                    <p>{message.content}</p>
                    <div className="chat-bubble__meta">
                      <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                    </div>
                  </div>
                ))}
              </div>

              <form className="chat-input" onSubmit={handleSendMessage}>
                <input
                  className="auth-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Введите сообщение..."
                />
                <button className="auth-submit" type="submit" disabled={isSending}>
                  {isSending ? "Отправка..." : "Отправить"}
                </button>
              </form>
            </>
          ) : (
            <div className="messages-empty">
              <h2>Диалог не выбран</h2>
              <p>Выберите чат слева или откройте его из карточки пользователя.</p>
            </div>
          )}
        </article>

        <article className="panel messages-panel">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Диалоги</h2>
              <p>Общайтесь с подключёнными {user?.role === "teacher" ? "учениками" : "преподавателями"}.</p>
            </div>
          </div>

          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`conversation-list__item${
                  conversation.id === activeConversationId ? " conversation-list__item--active" : ""
                }`}
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setSearchParams({ userId: conversation.participant.id });
                }}
              >
                <div className="conversation-list__avatar">
                  {conversation.participant.fullName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </div>
                <div>
                  <strong>{conversation.participant.fullName}</strong>
                  <span>{conversation.participant.subject || conversation.participant.email}</span>
                  <small>{conversation.lastMessage || "Начните диалог"}</small>
                </div>
                {conversation.isUnread ? <span className="conversation-list__unread" /> : null}
              </button>
            ))}
            {!conversations.length ? (
              <div className="empty-state">
                Используйте кнопку «Сообщение» в карточке пользователя, чтобы начать чат.
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </AppLayout>
  );
}

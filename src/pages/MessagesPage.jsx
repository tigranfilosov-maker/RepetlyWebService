import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { authRequest, useAuth } from "../auth/AuthContext";

const chatTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatChatTime(value) {
  return chatTimeFormatter.format(new Date(value));
}

function getInitials(name) {
  return String(name || "RP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
  const { refreshUnreadSummary } = useAuth();
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
    setConversations(data.conversations || []);
    return data.conversations || [];
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
    setSearchParams({ userId: participantId, conversationId: response.conversation.id });
  }

  useEffect(() => {
    loadConversationList()
      .then((items) => {
        const requestedConversationId = searchParams.get("conversationId");
        const participantId = searchParams.get("userId");

        if (requestedConversationId && items.some((item) => item.id === requestedConversationId)) {
          setActiveConversationId(requestedConversationId);
          return;
        }

        if (participantId) {
          const existing = items.find((item) => item.type === "direct" && item.participant?.id === participantId);
          if (existing) {
            setActiveConversationId(existing.id);
            setSearchParams({ userId: participantId, conversationId: existing.id });
          } else {
            openConversationByUserId(participantId).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    loadConversation(activeConversationId).catch(() => {});

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

  const conversationTitle =
    activeConversation?.type === "group"
      ? activeConversation.title
      : activeConversation?.participant?.fullName;
  const conversationSubtitle =
    activeConversation?.type === "group"
      ? `${activeConversation.members?.length || 0} участников`
      : activeConversation?.participant?.subject
        || (activeConversation?.participant?.role === "teacher" ? "Преподаватель" : "Ученик");
  const membersById = useMemo(
    () => new Map((activeConversation?.members || []).map((member) => [member.id, member])),
    [activeConversation?.members],
  );

  function handleCloseMobileChat() {
    setActiveConversationId("");
    setActiveConversation(null);
    setMessages([]);
    setSearchParams({});
  }

  return (
    <AppLayout title="Сообщения" contentMode="custom">
      <section className={`messages-layout messages-layout--swapped messages-layout--locked${activeConversation ? " messages-layout--has-active" : ""}`}>
        <article className="panel chat-panel">
          {activeConversation ? (
            <>
              <div className={`chat-panel__header${activeConversation.type === "group" ? " chat-panel__header--group" : ""}`}>
                <button className="chat-panel__back" type="button" aria-label="Back to dialogs" onClick={handleCloseMobileChat}>
                  {"\u2190"}
                </button>
                <div className="chat-panel__title">
                  <h2>{conversationTitle}</h2>
                  {activeConversation.type === "group" ? (
                    <div className="chat-members-inline" aria-label="Group members">
                      {activeConversation.members?.map((member) => (
                        <span key={member.id} className="chat-members-inline__avatar" title={member.fullName}>
                          {member.avatar ? <img src={member.avatar} alt="" /> : getInitials(member.fullName)}
                        </span>
                      ))}
                      <span className="chat-members-inline__count">{conversationSubtitle}</span>
                    </div>
                  ) : conversationSubtitle ? (
                    <p>{conversationSubtitle}</p>
                  ) : null}
                </div>
                <span className="chat-panel__type">
                  {activeConversation.type === "group" ? "\u0413\u0440\u0443\u043f\u043f\u0430" : "\u0427\u0430\u0442"}
                </span>
              </div>

              <div ref={threadRef} className="chat-thread">
                {messages.map((message) => {
                  const sender = membersById.get(message.senderId);
                  const senderName = message.senderName || sender?.fullName || "Участник";
                  const senderUsername = message.senderUsername || sender?.username || "";
                  const senderAvatar = message.senderAvatar || sender?.avatar || "";

                  return (
                    <div
                      key={message.id}
                      className={`chat-message${message.isOwn ? " chat-message--own" : ""}${
                        activeConversation.type === "group" ? " chat-message--group" : ""
                      }`}
                    >
                      {activeConversation.type === "group" && !message.isOwn ? (
                        <span className="chat-message__avatar" title={senderName}>
                          {senderAvatar ? <img src={senderAvatar} alt="" /> : getInitials(senderName)}
                        </span>
                      ) : null}
                      <div className={`chat-bubble${message.isOwn ? " chat-bubble--own" : ""}`}>
                        <p>{message.content}</p>
                        {activeConversation.type === "group" && !message.isOwn ? (
                          <strong className="chat-bubble__sender">
                            {senderUsername ? `@${senderUsername}` : senderName}
                          </strong>
                        ) : null}
                        <div className="chat-bubble__meta">
                          <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messages.length ? <div className="messages-empty messages-empty--thread">{"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}</div> : null}
              </div>

              <form className="chat-input" onSubmit={handleSendMessage}>
                <input
                  className="auth-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={activeConversation.type === "group" ? "Сообщение всей группе..." : "Введите сообщение..."}
                />
                <button className="chat-input__send" type="submit" disabled={isSending} aria-label="Отправить сообщение" title="Отправить сообщение">
                  {isSending ? "..." : "↑"}
                </button>
              </form>
            </>
          ) : (
            <div className="messages-empty">
              <h2>Диалог не выбран</h2>
              <p>Выберите диалог из списка, чтобы открыть чат.</p>
            </div>
          )}
        </article>

        <article className="panel messages-panel">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Диалоги</h2>
              <p>Личные и групповые чаты собраны в одном списке.</p>
            </div>
          </div>

          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`conversation-list__item${conversation.id === activeConversationId ? " conversation-list__item--active" : ""}`}
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setSearchParams(
                    conversation.type === "group"
                      ? { conversationId: conversation.id }
                      : { conversationId: conversation.id, userId: conversation.participant.id },
                  );
                }}
              >
                <div className="conversation-list__avatar">
                  {conversation.type === "group" ? "GR" : getInitials(conversation.participant?.fullName)}
                </div>
                <div className="conversation-list__body">
                  <strong>{conversation.type === "group" ? conversation.title : conversation.participant?.fullName}</strong>
                  <span>
                    {conversation.type === "group"
                      ? `${conversation.memberCount} участников`
                      : conversation.participant?.subject
                        || (conversation.participant?.role === "teacher" ? "\u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044c" : "\u0423\u0447\u0435\u043d\u0438\u043a")}
                  </span>
                  <em className="conversation-list__type">{conversation.type === "group" ? "Группа" : "Чат ученика"}</em>
                  <small>{conversation.lastMessage || "Начните диалог"}</small>
                </div>
                {conversation.isUnread ? <span className="conversation-list__unread" /> : null}
              </button>
            ))}
            {!conversations.length ? <div className="empty-state">Используйте кнопку сообщения в карточке ученика или откройте групповой чат.</div> : null}
          </div>
        </article>
      </section>
    </AppLayout>
  );
}

import { useEffect, useRef, useState } from "react";
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
          return;
        }

        if (items[0]) {
          setActiveConversationId(items[0].id);
          setSearchParams({ conversationId: items[0].id });
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

  const conversationTitle =
    activeConversation?.type === "group"
      ? activeConversation.title
      : activeConversation?.participant?.fullName;
  const conversationSubtitle =
    activeConversation?.type === "group"
      ? `${activeConversation.members?.length || 0} participants`
      : activeConversation?.participant?.subject
        || (activeConversation?.participant?.role === "teacher" ? "Teacher" : "Student");

  return (
    <AppLayout title="Сообщения" contentMode="custom">
      <section className="messages-layout messages-layout--swapped messages-layout--locked">
        <article className="panel chat-panel">
          {activeConversation ? (
            <>
              <div className="chat-panel__header">
                <div>
                  <h2>{conversationTitle}</h2>
                  {conversationSubtitle ? <p>{conversationSubtitle}</p> : null}
                </div>
              </div>

              {activeConversation.type === "group" ? (
                <div className="chat-members-inline">
                  {activeConversation.members?.map((member) => (
                    <span key={member.id} className="chat-members-inline__item">
                      {member.fullName}
                    </span>
                  ))}
                </div>
              ) : null}

              <div ref={threadRef} className="chat-thread">
                {messages.map((message) => (
                  <div key={message.id} className={`chat-bubble${message.isOwn ? " chat-bubble--own" : ""}`}>
                    {activeConversation.type === "group" && !message.isOwn ? <strong className="chat-bubble__sender">{message.senderName}</strong> : null}
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
                  placeholder={activeConversation.type === "group" ? "Message the whole group..." : "Type a message..."}
                />
                <button className="auth-submit" type="submit" disabled={isSending}>
                  {isSending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="messages-empty">
              <h2>No conversation selected</h2>
              <p>Open a student card or a group card to jump into the right chat.</p>
            </div>
          )}
        </article>

        <article className="panel messages-panel">
          <div className="panel__head panel__head--tight">
            <div>
              <h2>Dialogs</h2>
              <p>Direct and group conversations appear together in one list.</p>
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
                  {conversation.type === "group"
                    ? "GR"
                    : conversation.participant?.fullName
                      ?.split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                </div>
                <div>
                  <strong>{conversation.type === "group" ? conversation.title : conversation.participant?.fullName}</strong>
                  <span>
                    {conversation.type === "group"
                      ? `${conversation.memberCount} members`
                      : conversation.participant?.subject
                        || (conversation.participant?.username
                          ? `@${conversation.participant.username}`
                          : conversation.participant?.email)}
                  </span>
                  <small>{conversation.lastMessage || "Start the conversation"}</small>
                </div>
                {conversation.isUnread ? <span className="conversation-list__unread" /> : null}
              </button>
            ))}
            {!conversations.length ? <div className="empty-state">Use Message on a student card or open a group chat to start.</div> : null}
          </div>
        </article>
      </section>
    </AppLayout>
  );
}

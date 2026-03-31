"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STATUSES = ["open", "resolved", "pending", "snoozed"] as const;
type Status = (typeof STATUSES)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Conversation = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = any;

const statusColor: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: "#EAF3DE", text: "#3B6D11", dot: "#5A9E2F", label: "Open" },
  resolved: { bg: "#E1F5EE", text: "#0F6E56", dot: "#1BA07A", label: "Resolved" },
  pending: { bg: "#FAEEDA", text: "#854F0B", dot: "#C97A1A", label: "Pending" },
  snoozed: { bg: "#EEEDFE", text: "#3C3489", dot: "#6C63E0", label: "Snoozed" },
};

function formatTime(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) return formatTime(ts);
  if (diff < 604_800_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const AVATAR_COLORS = ["#185FA5", "#0F6E56", "#854F0B", "#3C3489", "#A32D2D", "#1E6B7C"];
const VIEW_TABS = ["Mine", "All", "unassigned"] as const;
type ViewTab = (typeof VIEW_TABS)[number];

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: "0.03em",
      }}
    >
      {initials}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ChatSupport() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [requestedDocument, setRequestedDocument] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingDocument, setRequestingDocument] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status>("open");
  const [activeTab, setActiveTab] = useState<ViewTab>("Mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((conv) => {
        const q = searchQuery.toLowerCase();
        const name = (conv.meta?.sender?.name || "").toLowerCase();
        const subject = (
          conv.meta?.subject ||
          conv.additional_attributes?.subject ||
          ""
        ).toLowerCase();
        const lastMsg = (conv.last_non_activity_message?.content || "").toLowerCase();
        const id = String(conv.id);
        return name.includes(q) || subject.includes(q) || lastMsg.includes(q) || id.includes(q);
      })
    : conversations;

  const assigneeTypeParam: Record<ViewTab, string | null> = {
    Mine: "assigned",
    All: null,
    unassigned: "unassigned",
  };

  const fetchConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError("");
      try {
        const params = new URLSearchParams({ status: filterStatus });
        const assigneeType = assigneeTypeParam[activeTab];
        if (assigneeType) params.set("assignee_type", assigneeType);
        const res = await fetch(`/api/chatwoot/conversations?${params}`);
        if (!res.ok) throw new Error(`Error ${res.status} — unable to fetch conversations`);
        const data = await res.json();
        setConversations(data.data?.payload || []);
      } catch (e: unknown) {
        if (!silent) setError(e instanceof Error ? e.message : "Something went wrong");
      }
      if (!silent) setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterStatus, activeTab]
  );

  const fetchMessages = useCallback(async (convId: number | string) => {
    try {
      const res = await fetch(`/api/chatwoot/conversations/${convId}/messages`);
      const data = await res.json();
      const msgs: Message[] = data.payload || [];
      setMessages((prev) => {
        const prevIds = prev.map((m: Message) => m.id).join(",");
        const nextIds = msgs.map((m: Message) => m.id).join(",");
        return prevIds === nextIds ? prev : msgs;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Poll conversations every 10s
  useEffect(() => {
    fetchConversations();
    const id = setInterval(() => fetchConversations(true), 10_000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  // Poll messages every 3s when a conversation is open
  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id);
    const id = setInterval(() => fetchMessages(selected.id), 3_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, fetchMessages]);

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await fetch(`/api/chatwoot/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply, message_type: "outgoing", private: false }),
      });
      setReply("");
      setAutoScroll(true);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await fetchMessages(selected.id);
    } catch {}
    setSending(false);
  }

  async function sendDocumentRequest() {
    if (!selected || !requestedDocument.trim()) return;
    setRequestingDocument(true);
    try {
      const content = `Hi,\nPlease upload this document: ${requestedDocument.trim()}`;
      await fetch(`/api/chatwoot/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, message_type: "outgoing", private: false }),
      });
      setRequestedDocument("");
      await fetchMessages(selected.id);
    } catch {}
    setRequestingDocument(false);
  }

  async function toggleStatus(conv: Conversation) {
    const newStatus = conv.status === "open" ? "resolved" : "open";
    try {
      await fetch(`/api/chatwoot/conversations/${conv.id}/toggle_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchConversations(true);
      if (selected?.id === conv.id) setSelected({ ...conv, status: newStatus });
    } catch {}
  }

  function handleSelect(conv: Conversation) {
    setSelected(conv);
    setMessages([]);
    setAutoScroll(true);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReply(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  const selectedContact = selected?.meta?.sender;

  return (
    <div
      suppressHydrationWarning
      style={{
        display: "flex",
        height: "calc(100vh - 100px)",
        minHeight: 520,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--color-border-tertiary)",
        fontFamily: "var(--font-sans)",
        background: "var(--color-background-primary)",
        boxShadow: "0 2px 16px 0 rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Sidebar ── */}
      <div
        style={{
          width: 320,
          borderRight: "1px solid var(--color-border-tertiary)",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-background-primary)",
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--color-border-tertiary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Conversations
            </div>
            <button
              type="button"
              style={{
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                background: "#1D6AE5",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + New
            </button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: 10,
              padding: "9px 10px",
              marginBottom: 12,
            }}
          >
            <span style={{ color: "var(--color-text-secondary)", fontSize: 16, lineHeight: 1 }}>
              ⌕
            </span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "100%",
                color: "var(--color-text-primary)",
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {VIEW_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 16,
                  fontWeight: tab === activeTab ? 600 : 500,
                  color:
                    tab === activeTab
                      ? "#1D6AE5"
                      : "var(--color-text-primary)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1.2,
                  borderBottom:
                    tab === activeTab ? "2px solid #1D6AE5" : "2px solid transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          )}
          {error && (
            <div
              style={{
                margin: 12,
                padding: "10px 12px",
                fontSize: 12,
                color: "#A32D2D",
                background: "#FCEBEB",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && filteredConversations.length === 0 && (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              {searchQuery.trim() ? "No matching conversations" : `No ${filterStatus} conversations`}
            </div>
          )}
          {filteredConversations.map((conv) => {
            const contact = conv.meta?.sender;
            const isSelected = selected?.id === conv.id;
            const cs = statusColor[conv.status as Status] ?? statusColor.open;
            const subject =
              conv.meta?.subject ||
              conv.additional_attributes?.subject ||
              conv.meta?.browser?.name ||
              contact?.name ||
              `Conversation #${conv.id}`;
            const businessName = contact?.name || conv.contact_inbox?.source_id || "Unknown";
            const lastMsg = conv.last_non_activity_message?.content || "No recent messages";
            return (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv)}
                style={{
                  padding: "14px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border-tertiary)",
                  background: isSelected
                    ? "var(--color-background-secondary)"
                    : "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  transition: "background 0.1s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 24,
                      color: "var(--color-text-primary)",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {subject}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {formatDate(conv.last_activity_at)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#577194",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {businessName}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.4,
                  }}
                >
                  {lastMsg}
                </div>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: cs.dot,
                    marginTop: 2,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "var(--color-background-primary)",
        }}
      >
        {!selected ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--color-background-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                marginBottom: 4,
              }}
            >
              💬
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              No conversation selected
            </div>
            <div style={{ fontSize: 13 }}>Pick one from the list to start replying</div>
          </div>
        ) : (
          <>
            {/* Conv header */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--color-border-tertiary)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--color-background-primary)",
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar name={selectedContact?.name || "?"} size={38} />
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: statusColor[selected.status as Status]?.dot ?? "#ccc",
                    border: "2px solid var(--color-background-primary)",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {selected?.meta?.subject || selectedContact?.name || "Conversation"}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: "var(--color-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 1,
                  }}
                >
                  Subject:{" "}
                  {selected?.additional_attributes?.subject ||
                    selectedContact?.email ||
                    "Conversation update"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: statusColor[selected.status as Status]?.bg ?? "#eee",
                    color: statusColor[selected.status as Status]?.text ?? "#666",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: statusColor[selected.status as Status]?.dot ?? "#ccc",
                      display: "inline-block",
                    }}
                  />
                  {statusColor[selected.status as Status]?.label ?? selected.status}
                </span>
                <button
                  onClick={() => toggleStatus(selected)}
                  style={{
                    fontSize: 12,
                    padding: "6px 16px",
                    borderRadius: 20,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    background: selected.status === "open" ? "#EAF3DE" : "#E8F0FD",
                    color: selected.status === "open" ? "#3B6D11" : "#185FA5",
                    transition: "opacity 0.15s",
                  }}
                >
                  {selected.status === "open" ? "Resolve" : "Reopen"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                setAutoScroll(nearBottom);
              }}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 18px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "#F7F9FC",
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    marginTop: 60,
                  }}
                >
                  No messages yet
                </div>
              )}
              {messages.map((msg: Message, i: number) => {
                const isOutgoing = msg.message_type === 1;
                const isActivity = msg.message_type === 2;
                const senderName = msg.sender?.name;
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const sameSenderAsPrev =
                  prevMsg &&
                  prevMsg.message_type === msg.message_type &&
                  prevMsg.message_type !== 2;
                const sameSenderAsNext =
                  nextMsg &&
                  nextMsg.message_type === msg.message_type &&
                  nextMsg.message_type !== 2;
                const showAvatar = !isOutgoing && !sameSenderAsNext;
                const showTime = !sameSenderAsNext;

                if (isActivity) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--color-text-secondary)",
                        padding: "6px 0",
                      }}
                    >
                      <span
                        style={{
                          background: "var(--color-background-secondary)",
                          padding: "3px 10px",
                          borderRadius: 20,
                        }}
                      >
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: isOutgoing ? "flex-end" : "flex-start",
                      alignItems: "flex-end",
                      gap: 7,
                      marginTop: sameSenderAsPrev ? 1 : 10,
                    }}
                  >
                    {/* Avatar placeholder for alignment */}
                    {!isOutgoing && (
                      <div style={{ width: 30, flexShrink: 0 }}>
                        {showAvatar && (
                          <Avatar
                            name={senderName || selectedContact?.name || "?"}
                            size={30}
                          />
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: "65%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        alignItems: isOutgoing ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isOutgoing && !sameSenderAsPrev && senderName && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--color-text-secondary)",
                            marginLeft: 4,
                            marginBottom: 1,
                          }}
                        >
                          {senderName}
                        </div>
                      )}
                      <div
                        style={{
                          padding: "9px 14px",
                          borderRadius: isOutgoing
                            ? sameSenderAsPrev
                              ? "18px 4px 4px 18px"
                              : "18px 4px 18px 18px"
                            : sameSenderAsPrev
                            ? "4px 18px 18px 4px"
                            : "4px 18px 18px 18px",
                          background: isOutgoing ? "#1D6AE5" : "var(--color-background-secondary)",
                          color: isOutgoing ? "#fff" : "var(--color-text-primary)",
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                          boxShadow: isOutgoing
                            ? "0 1px 4px rgba(29,106,229,0.18)"
                            : "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                      >
                        {msg.content}
                      </div>
                      {attachments.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 4,
                            width: "100%",
                          }}
                        >
                          {attachments.map((att: Message) => (
                            <a
                              key={att.id || att.data_url || att.file_type}
                              href={att.data_url || att.thumb_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                textDecoration: "none",
                                border: "1px solid var(--color-border-tertiary)",
                                background: "#fff",
                                color: "var(--color-text-primary)",
                                borderRadius: 10,
                                padding: "8px 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {att.file_type || "Attachment"}
                              </span>
                              <span style={{ fontSize: 11, color: "#185FA5", flexShrink: 0 }}>
                                Open
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {showTime && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-secondary)",
                            marginLeft: 4,
                            marginRight: 4,
                            marginTop: 1,
                          }}
                        >
                          {formatTime(msg.created_at)}
                        </div>
                      )}
                    </div>

                    {isOutgoing && (
                      <div style={{ width: 30, flexShrink: 0 }}>
                        {showAvatar && (
                          <Avatar name={msg.sender?.name || "Agent"} size={30} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div
              style={{
                padding: "10px 14px 14px",
                borderTop: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <input
                  value={requestedDocument}
                  onChange={(e) => setRequestedDocument(e.target.value)}
                  placeholder="Request a specific document (e.g. Bank statement - last 3 months)"
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid var(--color-border-primary)",
                    background: "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    padding: "0 10px",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                <button
                  onClick={sendDocumentRequest}
                  disabled={!requestedDocument.trim() || requestingDocument}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border: "none",
                    padding: "0 12px",
                    background:
                      requestedDocument.trim() && !requestingDocument
                        ? "#185FA5"
                        : "var(--color-border-secondary)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor:
                      requestedDocument.trim() && !requestingDocument
                        ? "pointer"
                        : "default",
                  }}
                >
                  {requestingDocument ? "Requesting..." : "Request Document"}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-end",
                  background: "var(--color-background-secondary)",
                  borderRadius: 16,
                  padding: "6px 6px 6px 14px",
                  border: "1px solid var(--color-border-tertiary)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    border: "none",
                    fontSize: 13.5,
                    background: "transparent",
                    color: "var(--color-text-primary)",
                    resize: "none",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    outline: "none",
                    maxHeight: 120,
                    overflowY: "auto",
                  }}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  title="Send (Enter)"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    border: "none",
                    background: reply.trim() && !sending ? "#1D6AE5" : "var(--color-border-secondary)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: reply.trim() && !sending ? "pointer" : "default",
                    flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <SendIcon />
                </button>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--color-text-secondary)",
                  marginTop: 5,
                  paddingLeft: 4,
                }}
              >
                Enter to send · Shift+Enter for new line
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

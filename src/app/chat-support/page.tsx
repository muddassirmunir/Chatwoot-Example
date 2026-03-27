"use client";

import { useState, useEffect } from "react";

const STATUSES = ["open", "resolved", "pending", "snoozed"] as const;
type Status = (typeof STATUSES)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Conversation = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = any;

const statusColor: Record<Status, { bg: string; text: string; label: string }> =
  {
    open: { bg: "#EAF3DE", text: "#3B6D11", label: "Open" },
    resolved: { bg: "#E1F5EE", text: "#0F6E56", label: "Resolved" },
    pending: { bg: "#FAEEDA", text: "#854F0B", label: "Pending" },
    snoozed: { bg: "#EEEDFE", text: "#3C3489", label: "Snoozed" },
  };

export default function ChatSupport() {
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status>("open");
  const [configured, setConfigured] = useState(true);

  async function fetchConversations() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chatwoot/conversations?status=${filterStatus}`,
      );
      if (!res.ok)
        throw new Error(`Error ${res.status} — unable to fetch conversations`);
      const data = await res.json();
      setConversations(data.data?.payload || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setLoading(false);
  }

  async function fetchMessages(convId: number | string) {
    try {
      const res = await fetch(
        `/api/chatwoot/conversations/${convId}/messages`,
      );
      const data = await res.json();
      setMessages(data.payload || []);
    } catch {}
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/chatwoot/conversations/${selected.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: reply,
            message_type: "outgoing",
            private: false,
          }),
        },
      );
      const data = await res.json();
      setMessages((prev) => [...prev, data]);
      setReply("");
    } catch {}
    setSending(false);
  }

  async function toggleStatus(conv: Conversation) {
    const newStatus = conv.status === "open" ? "resolved" : "open";
    try {
      await fetch(
        `/api/chatwoot/conversations/${conv.id}/toggle_status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      fetchConversations();
      if (selected?.id === conv.id) setSelected({ ...conv, status: newStatus });
    } catch {}
  }

  function handleSelect(conv: Conversation) {
    setSelected(conv);
    fetchMessages(conv.id);
  }

  useEffect(() => {
    if (configured) fetchConversations();
  }, [filterStatus, configured]);

  if (!configured) {
    return (
      <div
        style={{
          minHeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                margin: "0 0 4px",
              }}
            >
              Chatwoot Admin Panel
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text-secondary)",
                margin: 0,
              }}
            >
              Enter your Chatwoot credentials to connect
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                API Access Token
              </label>
              <input
                type="password"
                placeholder="Paste your access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border-primary)",
                  fontSize: 14,
                  background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Account ID
              </label>
              <input
                type="text"
                placeholder="e.g. 1234"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border-primary)",
                  fontSize: 14,
                  background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={() => {
                if (token && accountId) setConfigured(true);
              }}
              disabled={!token || !accountId}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background:
                  token && accountId
                    ? "#185FA5"
                    : "var(--color-border-secondary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: token && accountId ? "pointer" : "default",
                marginTop: 4,
              }}
            >
              Connect to Chatwoot
            </button>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              marginTop: 16,
              lineHeight: 1.5,
            }}
          >
            Find your token at: Profile Settings → Access Token
            <br />
            Find your Account ID in the URL: /app/accounts/<strong>1234</strong>
            /
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: 560,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--color-border-tertiary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 300,
          borderRight: "1px solid var(--color-border-tertiary)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-border-tertiary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--color-text-primary)",
              }}
            >
              Conversations
            </span>
            <button
              onClick={fetchConversations}
              style={{
                fontSize: 12,
                color: "#185FA5",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Refresh
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  background:
                    filterStatus === s
                      ? statusColor[s].bg
                      : "var(--color-background-secondary)",
                  color:
                    filterStatus === s
                      ? statusColor[s].text
                      : "var(--color-text-secondary)",
                }}
              >
                {statusColor[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          )}
          {error && (
            <div
              style={{
                padding: 16,
                fontSize: 12,
                color: "#A32D2D",
                background: "#FCEBEB",
                margin: 12,
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && conversations.length === 0 && (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              No {filterStatus} conversations
            </div>
          )}
          {conversations.map((conv) => {
            const contact = conv.meta?.sender;
            const lastMsg = conv.meta?.channel;
            const isSelected = selected?.id === conv.id;
            const currentStatusColor =
              statusColor[conv.status as Status] ?? statusColor.open;
            return (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border-tertiary)",
                  background: isSelected
                    ? "var(--color-background-secondary)"
                    : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {contact?.name || "Unknown"}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 20,
                      background: currentStatusColor.bg,
                      color: currentStatusColor.text,
                      fontWeight: 500,
                    }}
                  >
                    {currentStatusColor.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{conv.id} · {conv.inbox_id ? `Inbox ${conv.inbox_id}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            Select a conversation to view messages
          </div>
        ) : (
          <>
            {/* Conv header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--color-border-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {selected.meta?.sender?.name || "Unknown"}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
                >
                  Conversation #{selected.id}
                </div>
              </div>
              <button
                onClick={() => toggleStatus(selected)}
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  background:
                    selected.status === "open" ? "#EAF3DE" : "#E6F1FB",
                  color: selected.status === "open" ? "#3B6D11" : "#185FA5",
                }}
              >
                {selected.status === "open" ? "Mark Resolved" : "Reopen"}
              </button>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    marginTop: 20,
                  }}
                >
                  No messages yet
                </div>
              )}
              {messages.map((msg) => {
                const isOutgoing = msg.message_type === 1;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: isOutgoing ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "8px 12px",
                        borderRadius: isOutgoing
                          ? "12px 12px 2px 12px"
                          : "12px 12px 12px 2px",
                        background: isOutgoing
                          ? "#185FA5"
                          : "var(--color-background-secondary)",
                        color: isOutgoing
                          ? "#fff"
                          : "var(--color-text-primary)",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply box */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--color-border-tertiary)",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder="Type a reply..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border-primary)",
                  fontSize: 13,
                  background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: reply.trim()
                    ? "#185FA5"
                    : "var(--color-border-secondary)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: reply.trim() ? "pointer" : "default",
                }}
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

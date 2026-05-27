"use client"

// components/LeadOutreachSection.tsx
//
// Shown on /leads/[id] for YouTube leads only.
// Displays all outreach_log rows for this lead and a Send button if no email sent yet.

import { useState } from "react"

type OutreachLog = {
  id:            string
  email_address: string
  subject:       string | null
  status:        string
  sent_at:       string | null
  replied_at:    string | null
  video_title:   string | null
}

type Props = {
  leadId:     string
  channelUrl: string | null
  uploads30d: number
  logs:       OutreachLog[]
}

const statusPill = (status: string) => {
  if (status === "replied")  return "pill pill-green"
  if (status === "sent")     return "pill pill-blue"
  if (status === "bounced")  return "pill pill-red"
  return "pill pill-gray"
}

export default function LeadOutreachSection({ leadId, channelUrl, uploads30d, logs }: Props) {
  const [localLogs, setLocalLogs] = useState<OutreachLog[]>(logs)
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState("")

  // A lead should only be emailed once — check for any sent/replied row
  const alreadySent = localLogs.some(
    (l) => l.status === "sent" || l.status === "replied"
  )

  const handleSend = async () => {
    setSending(true)
    setError("")

    try {
      const res = await fetch("/api/outreach/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId, channelUrl, uploads30d }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Send failed — check server logs.")
        return
      }

      // Optimistically append the new log row so the UI updates immediately
      setLocalLogs((prev) => [
        {
          id:            crypto.randomUUID(),
          email_address: data.emailAddress ?? "",
          subject:       data.subject,
          status:        "sent",
          sent_at:       new Date().toISOString(),
          replied_at:    null,
          video_title:   data.videoTitle,
        },
        ...prev,
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="text-xs text-zinc-500 uppercase">Outreach</div>
        {!alreadySent && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn btn-primary"
            style={{ padding: "4px 12px", fontSize: "0.78rem" }}
          >
            {sending ? "Sending…" : "Send email"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 10 }}>
          {error}
        </div>
      )}

      {localLogs.length === 0 ? (
        <div style={{ color: "var(--text-3)", fontSize: "0.83rem" }}>
          No emails sent yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {localLogs.map((log) => (
            <div
              key={log.id}
              style={{
                padding: "10px 12px",
                background: "var(--bg-2)",
                borderRadius: "var(--radius)",
                fontSize: "0.83rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>
                  {log.email_address || "—"}
                </span>
                <span className={statusPill(log.status)}>{log.status}</span>
              </div>

              {log.subject && (
                <div style={{ color: "var(--text-2)" }}>
                  Subject: {log.subject}
                </div>
              )}
              {log.video_title && (
                <div style={{ color: "var(--text-3)", marginTop: 2 }}>
                  Video referenced: &ldquo;{log.video_title}&rdquo;
                </div>
              )}

              <div style={{ display: "flex", gap: 16, marginTop: 6, color: "var(--text-3)", fontSize: "0.75rem" }} className="mono">
                {log.sent_at && (
                  <span>
                    Sent:{" "}
                    {new Date(log.sent_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                )}
                {log.replied_at && (
                  <span>
                    Replied:{" "}
                    {new Date(log.replied_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

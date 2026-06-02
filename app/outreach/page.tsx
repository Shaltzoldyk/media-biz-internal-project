"use client"

// app/outreach/page.tsx
//
// Discovery UI + email sending + Excel export.
//
// Flow:
//   1. Discover channels → results table
//   2. Fill in email per channel (auto-populated when found in description)
//   3. Send email → creates lead at "Outreach" status, logs to outreach_log
//   4. Export to Excel:
//      - "Email list" sheet — matches Python outreach.py format exactly
//      - "Full data" sheet  — all discovery fields for your records

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

type Candidate = {
  channelName: string
  channelUrl:  string
  subscribers: number
  uploads30d:  number
  avgViews:    number
  lastUpload:  string
  email:       string | null
  website:     string | null
  instagram:   string | null
  twitter:     string | null
  linktree:    string | null
  ytScore:     number
}

type SendStatus = "idle" | "sending" | "sent" | "error" | "duplicate"

export default function OutreachPage() {
  // Discovery form
  const [keyword,     setKeyword]     = useState("")
  const [minSubs,     setMinSubs]     = useState("10000")
  const [maxSubs,     setMaxSubs]     = useState("500000")
  const [minUploads,  setMinUploads]  = useState("4")
  const [minAvgViews, setMinAvgViews] = useState("")

  // UI
  const [discovering, setDiscovering] = useState(false)
  const [error,       setError]       = useState("")
  const [successMsg,  setSuccessMsg]  = useState("")

  // Results
  const [candidates,  setCandidates]  = useState<Candidate[]>([])
  const [selected,    setSelected]    = useState<Set<string>>(new Set())

  // Email inputs — one per channel URL, pre-populated from description scan
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({})

  // Per-channel send status
  const [sendStatus, setSendStatus]   = useState<Record<string, SendStatus>>({})

  // Batch sending
  const [batchSending, setBatchSending] = useState(false)

  // Pre-populate email inputs when results arrive
  useEffect(() => {
    const inputs: Record<string, string> = {}
    for (const c of candidates) {
      // Keep any email the user has already typed
      inputs[c.channelUrl] = emailInputs[c.channelUrl] ?? c.email ?? ""
    }
    setEmailInputs(inputs)
  }, [candidates])

  // ── Discovery ──────────────────────────────────────────────────────────────

  const handleDiscover = async () => {
    if (!keyword.trim()) { setError("Keyword is required."); return }
    setDiscovering(true)
    setError("")
    setSuccessMsg("")
    setCandidates([])
    setSelected(new Set())
    setSendStatus({})

    try {
      const res  = await fetch("/api/outreach/discover", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          keyword:       keyword.trim(),
          minSubs:       Number(minSubs)    || 10_000,
          maxSubs:       Number(maxSubs)    || 500_000,
          minUploads30d: Number(minUploads) || 4,
          minAvgViews:   minAvgViews ? Number(minAvgViews) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? "Discovery failed."); return }
      setCandidates(data.leads ?? [])
      if ((data.leads ?? []).length === 0) setSuccessMsg("No channels matched your filters.")
    } catch {
      setError("Network error — check console.")
    } finally {
      setDiscovering(false)
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (url: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n })

  const selectAll = () => setSelected(new Set(candidates.map(c => c.channelUrl)))
  const clearAll  = () => setSelected(new Set())

  const selectedCandidates = candidates.filter(c => selected.has(c.channelUrl))

  // ── Send one email ─────────────────────────────────────────────────────────

  const sendOne = async (c: Candidate) => {
    const email = (emailInputs[c.channelUrl] ?? "").trim()
    if (!email) { alert("Enter an email address first."); return }

    setSendStatus(p => ({ ...p, [c.channelUrl]: "sending" }))

    try {
      const res  = await fetch("/api/outreach/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          emailAddress: email,
          channelName:  c.channelName,
          channelUrl:   c.channelUrl,
          subscribers:  c.subscribers,
          uploads30d:   c.uploads30d,
          avgViews:     c.avgViews,
          lastUpload:   c.lastUpload,
          ytScore:      c.ytScore,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setSendStatus(p => ({ ...p, [c.channelUrl]: "duplicate" }))
      } else if (!res.ok || !data.ok) {
        setSendStatus(p => ({ ...p, [c.channelUrl]: "error" }))
        console.error("Send failed:", data.error)
      } else {
        setSendStatus(p => ({ ...p, [c.channelUrl]: "sent" }))
      }
    } catch {
      setSendStatus(p => ({ ...p, [c.channelUrl]: "error" }))
    }
  }

  // ── Batch send ─────────────────────────────────────────────────────────────

  const handleBatchSend = async () => {
    const toSend = selectedCandidates.filter(c => {
      const s = sendStatus[c.channelUrl]
      return s !== "sent" && s !== "sending" && (emailInputs[c.channelUrl] ?? "").trim()
    })

    if (toSend.length === 0) {
      setError("No selected channels have email addresses filled in.")
      return
    }

    setBatchSending(true)
    setError("")

    // Send sequentially — mirrors Python's per-email loop
    for (const c of toSend) {
      await sendOne(c)
      // Small delay between sends — avoids Gmail spam triggers
      // matches Python — random 40-120 second delay
const delay = 40_000 + Math.random() * 80_000   // 40–120 seconds in ms
await new Promise(r => setTimeout(r, delay))
    }

    setBatchSending(false)
    setSuccessMsg(`Batch send complete. ${toSend.length} email${toSend.length !== 1 ? "s" : ""} attempted.`)
  }

  // ── Excel exports ──────────────────────────────────────────────────────────
  // Sheet 1 "Email List" — matches Python outreach.py column format exactly.
  // You can use this file directly with your outreach.py script.
  //
  // Sheet 2 "Full Data" — all discovery fields for records/analysis.

  const exportExcel = (sheetsToInclude: "email" | "full" | "both") => {
    const scope = selectedCandidates.length > 0 ? selectedCandidates : candidates
    if (scope.length === 0) return

    const wb = XLSX.utils.book_new()

    if (sheetsToInclude === "email" || sheetsToInclude === "both") {
      const emailRows = scope.map(c => ({
        "Name":                  c.channelName,
        "Email":                 emailInputs[c.channelUrl] ?? c.email ?? "",
        "Channel link":          c.channelUrl,
        "Last 30 days upload":   c.uploads30d,
        "Avg Views":             c.avgViews,
        "Score":                 c.ytScore,
        "Status":                sendStatus[c.channelUrl] === "sent" ? "Sent" : "",
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emailRows), "Email List")
    }

    if (sheetsToInclude === "full" || sheetsToInclude === "both") {
      const fullRows = scope.map(c => ({
        "Channel Name":       c.channelName,
        "Channel URL":        c.channelUrl,
        "Subscribers":        c.subscribers,
        "Uploads Last 30d":   c.uploads30d,
        "Avg Views (Last 10)": c.avgViews,
        "Last Upload":        c.lastUpload,
        "YT Score":           c.ytScore,
        "Email":              emailInputs[c.channelUrl] ?? c.email ?? "",
        "Website":            c.website ?? "",
        "Instagram":          c.instagram ?? "",
        "Twitter":            c.twitter ?? "",
        "Linktree":           c.linktree ?? "",
        "Email Status":       sendStatus[c.channelUrl] === "sent" ? "Sent" : sendStatus[c.channelUrl] === "duplicate" ? "Already sent" : "",
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fullRows), "Full Data")
    }

    const filename = `yt_outreach_${keyword.replace(/\s+/g, "_") || "export"}_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // ── Status badge ───────────────────────────────────────────────────────────

  const StatusBadge = ({ url }: { url: string }) => {
    const s = sendStatus[url] ?? "idle"
    if (s === "idle")      return null
    if (s === "sending")   return <span className="pill" style={{ fontSize: "0.7rem", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>Sending…</span>
    if (s === "sent")      return <span className="pill pill-green" style={{ fontSize: "0.7rem" }}>✓ Sent</span>
    if (s === "duplicate") return <span className="pill pill-amber" style={{ fontSize: "0.7rem" }}>Already sent</span>
    if (s === "error")     return <span className="pill pill-red"   style={{ fontSize: "0.7rem" }}>Failed</span>
    return null
  }

  const sentCount = Object.values(sendStatus).filter(s => s === "sent").length

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Pipeline</div>
        <h1>Outreach</h1>
        <p style={{ color: "var(--text-2)", marginTop: 6, fontSize: "0.875rem" }}>
          Discover YouTube creators, send personalised emails, and track replies in your pipeline.
        </p>
      </div>

      {/* Discovery form */}
      <div className="fade-up delay-1 card" style={{ padding: "20px 24px", maxWidth: 600, marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 14 }}>Discovery filters</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Keyword / niche *">
            <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. personal finance" onKeyDown={e => e.key === "Enter" && handleDiscover()} autoFocus />
          </Field>
          <Field label="Min uploads (last 30d) *">
            <input type="number" value={minUploads} onChange={e => setMinUploads(e.target.value)} placeholder="4" min="1" />
          </Field>
          <Field label="Min subscribers *">
            <input type="number" value={minSubs} onChange={e => setMinSubs(e.target.value)} placeholder="10000" min="0" />
          </Field>
          <Field label="Max subscribers *">
            <input type="number" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} placeholder="500000" min="0" />
          </Field>
          <Field label="Min avg views (optional)">
            <input type="number" value={minAvgViews} onChange={e => setMinAvgViews(e.target.value)} placeholder="skip" min="0" />
          </Field>
        </div>

        {error     && <div style={{ color: "var(--red)",   fontSize: "0.82rem", marginBottom: 10 }}>{error}</div>}
        {successMsg && <div style={{ color: "var(--green)", fontSize: "0.82rem", marginBottom: 10 }}>{successMsg}</div>}

        <button onClick={handleDiscover} disabled={discovering} className="btn btn-primary">
          {discovering ? "Searching YouTube…" : "Discover channels"}
        </button>
      </div>

      {/* Results */}
      {candidates.length > 0 && (
        <div className="fade-up delay-2">

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="label">{candidates.length} channels</div>
              {sentCount > 0 && (
                <span className="pill pill-green" style={{ fontSize: "0.72rem" }}>{sentCount} sent this session</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={selectAll} className="btn" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>Select all</button>
              <button onClick={clearAll}  className="btn" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>Clear</button>

              {/* Export buttons */}
              <button
                onClick={() => exportExcel("email")}
                disabled={candidates.length === 0}
                className="btn"
                style={{ fontSize: "0.78rem", padding: "3px 12px" }}
                title="Python outreach.py format — Name, Email, Channel link, Last 30 days upload, Status"
              >
                ↓ Email list {selectedCandidates.length > 0 ? `(${selectedCandidates.length})` : ""}
              </button>
              <button
                onClick={() => exportExcel("full")}
                disabled={candidates.length === 0}
                className="btn"
                style={{ fontSize: "0.78rem", padding: "3px 12px" }}
                title="All discovery data"
              >
                ↓ Full data {selectedCandidates.length > 0 ? `(${selectedCandidates.length})` : ""}
              </button>

              {/* Batch send */}
              <button
                onClick={handleBatchSend}
                disabled={batchSending || selectedCandidates.length === 0}
                className="btn btn-primary"
                style={{ fontSize: "0.78rem", padding: "3px 12px" }}
              >
                {batchSending ? "Sending…" : `Send to selected (${selectedCandidates.length})`}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Channel</th>
                  <th>Subs</th>
                  <th>Uploads/30d</th>
                  <th>Avg views</th>
                  <th style={{ minWidth: 200 }}>Email</th>
                  <th>Score</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => {
                  const checked = selected.has(c.channelUrl)
                  const status  = sendStatus[c.channelUrl] ?? "idle"
                  const isSent  = status === "sent" || status === "duplicate"

                  return (
                    <tr key={c.channelUrl} style={{ cursor: "pointer", opacity: isSent ? 0.6 : 1 }} onClick={() => toggleSelect(c.channelUrl)}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(c.channelUrl)}
                          style={{ width: "auto" }} onClick={e => e.stopPropagation()} />
                      </td>
                      <td>
                        <a href={c.channelUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--accent)", fontWeight: 500 }} onClick={e => e.stopPropagation()}>
                          {c.channelName}
                        </a>
                        {c.lastUpload && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 }}>
                            Last: {c.lastUpload}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ color: "var(--text-2)" }}>{c.subscribers.toLocaleString("en-IN")}</td>
                      <td className="mono">{c.uploads30d}</td>
                      <td className="mono" style={{ color: "var(--text-2)" }}>
                        {c.avgViews > 0 ? c.avgViews.toLocaleString("en-IN") : "—"}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {isSent ? (
                          <StatusBadge url={c.channelUrl} />
                        ) : (
                          <input
                            type="email"
                            value={emailInputs[c.channelUrl] ?? ""}
                            onChange={e => setEmailInputs(p => ({ ...p, [c.channelUrl]: e.target.value }))}
                            placeholder="email@domain.com"
                            style={{ fontSize: "0.8rem", padding: "3px 8px", width: "100%", minWidth: 180 }}
                          />
                        )}
                      </td>
                      <td className="mono" style={{ fontWeight: 500 }}>{c.ytScore}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {isSent ? (
                          <StatusBadge url={c.channelUrl} />
                        ) : (
                          <button
                            onClick={() => sendOne(c)}
                            disabled={status === "sending" || !(emailInputs[c.channelUrl] ?? "").trim()}
                            className="btn"
                            style={{ fontSize: "0.72rem", padding: "2px 10px", whiteSpace: "nowrap" }}
                          >
                            {status === "sending" ? "…" : "Send"}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 8, fontSize: "0.75rem", color: "var(--text-3)" }}>
            Exports include {selectedCandidates.length > 0 ? "selected channels only" : "all channels"}. Select channels to narrow the export.
            Email list format is compatible with outreach.py.
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
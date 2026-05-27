"use client"

// app/outreach/page.tsx
//
// Discovery UI. Replaces the CLI flow of yt_leads_finder.py.
// Two phases:
//   1. Discovery form → POST /api/outreach/discover → candidate table
//   2. Select leads → POST /api/outreach/import → inserted as Outreach leads

import { useState } from "react"

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

export default function OutreachPage() {
  // Form state
  const [keyword,       setKeyword]       = useState("")
  const [minSubs,       setMinSubs]       = useState("10000")
  const [maxSubs,       setMaxSubs]       = useState("500000")
  const [minUploads,    setMinUploads]    = useState("4")
  const [minAvgViews,   setMinAvgViews]   = useState("")

  // UI state
  const [discovering,   setDiscovering]   = useState(false)
  const [importing,     setImporting]     = useState(false)
  const [error,         setError]         = useState("")
  const [successMsg,    setSuccessMsg]    = useState("")

  // Results
  const [candidates,    setCandidates]    = useState<Candidate[]>([])
  const [selected,      setSelected]      = useState<Set<string>>(new Set())

  const handleDiscover = async () => {
    if (!keyword.trim()) { setError("Keyword is required."); return }
    setDiscovering(true)
    setError("")
    setSuccessMsg("")
    setCandidates([])
    setSelected(new Set())

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

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Discovery failed.")
        return
      }
      setCandidates(data.leads ?? [])
      if ((data.leads ?? []).length === 0) setSuccessMsg("No channels matched your filters.")
    } catch (e) {
      setError("Network error — check console.")
    } finally {
      setDiscovering(false)
    }
  }

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(candidates.map((c) => c.channelUrl)))
  }

  const clearAll = () => setSelected(new Set())

  const handleImport = async () => {
    if (selected.size === 0) return
    setImporting(true)
    setError("")
    setSuccessMsg("")

    const toImport = candidates.filter((c) => selected.has(c.channelUrl))

    try {
      const res  = await fetch("/api/outreach/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leads: toImport }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Import failed.")
        return
      }

      setSuccessMsg(
        `Imported ${data.imported} lead${data.imported !== 1 ? "s" : ""}.` +
        (data.skipped > 0 ? ` ${data.skipped} already in CRM — skipped.` : "")
      )
      // Remove imported channels from the candidate list
      setCandidates((prev) => prev.filter((c) => !selected.has(c.channelUrl)))
      setSelected(new Set())
    } catch {
      setError("Network error — check console.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Pipeline</div>
        <h1>Outreach</h1>
        <p style={{ color: "var(--text-2)", marginTop: 6, fontSize: "0.875rem" }}>
          Discover YouTube creators, score them, and import directly into your pipeline.
        </p>
      </div>

      {/* Discovery form */}
      <div className="fade-up delay-1 card" style={{ padding: "20px 24px", maxWidth: 600, marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 14 }}>Discovery filters</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Keyword / niche *">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. personal finance"
              onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
              autoFocus
            />
          </Field>

          <Field label="Min uploads (last 30d) *">
            <input
              type="number"
              value={minUploads}
              onChange={(e) => setMinUploads(e.target.value)}
              placeholder="4"
              min="1"
            />
          </Field>

          <Field label="Min subscribers *">
            <input
              type="number"
              value={minSubs}
              onChange={(e) => setMinSubs(e.target.value)}
              placeholder="10000"
              min="0"
            />
          </Field>

          <Field label="Max subscribers *">
            <input
              type="number"
              value={maxSubs}
              onChange={(e) => setMaxSubs(e.target.value)}
              placeholder="500000"
              min="0"
            />
          </Field>

          <Field label="Min avg views (optional)">
            <input
              type="number"
              value={minAvgViews}
              onChange={(e) => setMinAvgViews(e.target.value)}
              placeholder="skip"
              min="0"
            />
          </Field>
        </div>

        {error && (
          <div style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 10 }}>{error}</div>
        )}
        {successMsg && (
          <div style={{ color: "var(--green)", fontSize: "0.82rem", marginBottom: 10 }}>{successMsg}</div>
        )}

        <button
          onClick={handleDiscover}
          disabled={discovering}
          className="btn btn-primary"
        >
          {discovering ? "Searching YouTube…" : "Discover channels"}
        </button>
      </div>

      {/* Results table */}
      {candidates.length > 0 && (
        <div className="fade-up delay-2">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="label">{candidates.length} channels found</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAll}  className="btn" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>Select all</button>
              <button onClick={clearAll}   className="btn" style={{ fontSize: "0.78rem", padding: "3px 10px" }}>Clear</button>
              <button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="btn btn-primary"
                style={{ fontSize: "0.78rem", padding: "3px 12px" }}
              >
                {importing ? "Importing…" : `Import selected (${selected.size})`}
              </button>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Channel</th>
                  <th>Subscribers</th>
                  <th>Uploads/30d</th>
                  <th>Avg views</th>
                  <th>Email</th>
                  <th>YT score</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const checked = selected.has(c.channelUrl)
                  return (
                    <tr key={c.channelUrl} style={{ cursor: "pointer" }} onClick={() => toggleSelect(c.channelUrl)}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(c.channelUrl)}
                          style={{ width: "auto" }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <a
                          href={c.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent)", fontWeight: 500 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.channelName}
                        </a>
                        {c.lastUpload && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 }}>
                            Last upload: {c.lastUpload}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ color: "var(--text-2)" }}>
                        {c.subscribers.toLocaleString("en-IN")}
                      </td>
                      <td className="mono">{c.uploads30d}</td>
                      <td className="mono" style={{ color: "var(--text-2)" }}>
                        {c.avgViews > 0 ? c.avgViews.toLocaleString("en-IN") : "—"}
                      </td>
                      <td>
                        {c.email ? (
                          <span className="pill pill-green" style={{ fontSize: "0.7rem" }}>✓ found</span>
                        ) : (
                          <span style={{ color: "var(--text-3)", fontSize: "0.78rem" }}>—</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontWeight: 500 }}>{c.ytScore}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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

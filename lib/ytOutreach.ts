// lib/ytOutreach.ts
//
// Server-only. Never import from client components.
// Port of outreach.py (sending) and reply_tracker.py (IMAP check) into TypeScript.
// Uses nodemailer + imap — same underlying protocols as the Python originals.

import nodemailer from "nodemailer"
import Imap from "imap"

// ─── Email sending ────────────────────────────────────────────────────────────

// Same template as outreach.py — variables injected at send time
const EMAIL_TEMPLATE = `Hey,

Saw your video "{recentVideo}" doing well lately — nice pacing there.

Also noticed you pushed around {uploads} videos in the last 30 days; that's serious publishing volume.

Quick question: are you still personally managing video edits, revisions, file transfers, and thumbnail iterations… or is that fully systemised?

Most creators at your volume hit workflow bottlenecks before they realise it.

We build backend post-production systems that remove that friction completely.

Worth a quick breakdown on how we'd structure yours?

— Shaltz`

const SUBJECTS = [
  "Scaling output",
  "Quick question",
  "About your editing workflow",
]

export type SendOutreachParams = {
  to:         string   // recipient email
  channelUrl: string   // used to look up best recent video
  uploads30d: number   // injected into template
}

export type SendOutreachResult = {
  ok:         boolean
  videoTitle: string
  subject:    string
  error?:     string
}

export async function sendOutreachEmail(
  params: SendOutreachParams
): Promise<SendOutreachResult> {
  const senderEmail    = process.env.OUTREACH_EMAIL
  const senderPassword = process.env.OUTREACH_EMAIL_PASSWORD

  if (!senderEmail || !senderPassword) {
    return {
      ok:         false,
      videoTitle: "",
      subject:    "",
      error:      "OUTREACH_EMAIL or OUTREACH_EMAIL_PASSWORD env var not set",
    }
  }

  const videoTitle = await getBestVideo(params.channelUrl)
  const subject    = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]
  const body       = EMAIL_TEMPLATE
    .replace("{recentVideo}", videoTitle)
    .replace("{uploads}", String(params.uploads30d))

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: senderPassword },
  })

  try {
    await transporter.sendMail({
      from:    senderEmail,
      to:      params.to,
      subject,
      text:    body,
    })
    return { ok: true, videoTitle, subject }
  } catch (err) {
    return { ok: false, videoTitle, subject, error: String(err) }
  }
}

// ─── Reply checking ───────────────────────────────────────────────────────────
//
// Checks a batch of email addresses against the Gmail INBOX via IMAP.
// Returns the set of addresses that have sent at least one reply.
// Same logic as reply_tracker.py — searches FROM: each address in INBOX.

export async function checkReplies(emailAddresses: string[]): Promise<Set<string>> {
  const senderEmail    = process.env.OUTREACH_EMAIL
  const senderPassword = process.env.OUTREACH_EMAIL_PASSWORD

  const replied = new Set<string>()

  if (!senderEmail || !senderPassword || emailAddresses.length === 0) {
    return replied
  }

  return new Promise((resolve) => {
    const imap = new Imap({
      user:     senderEmail,
      password: senderPassword,
      host:     "imap.gmail.com",
      port:     993,
      tls:      true,
    })

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err) => {
        if (err) {
          imap.end()
          resolve(replied)
          return
        }

        let pending = emailAddresses.length

        const done = () => {
          pending--
          if (pending === 0) {
            imap.end()
            resolve(replied)
          }
        }

        for (const addr of emailAddresses) {
          imap.search([["FROM", addr]], (searchErr, uids) => {
            if (!searchErr && uids && uids.length > 0) replied.add(addr)
            done()
          })
        }
      })
    })

    imap.once("error", () => resolve(replied))
    imap.once("end",   () => resolve(replied))
    imap.connect()
  })
}

// ─── YouTube personalisation helper ──────────────────────────────────────────
//
// Port of get_best_video() from outreach.py.
// Fetches the most-viewed video from the last 30 days; falls back to all-time.

async function getBestVideo(channelUrl: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return "one of your recent videos"

  try {
    const channelId = channelUrl.split("/channel/")[1]?.split("/")[0]
    if (!channelId) return "one of your recent videos"

    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const BASE = "https://www.googleapis.com/youtube/v3"

    // Try last 30 days first
    const p1 = new URLSearchParams({
      key: apiKey, channelId,
      part: "snippet", type: "video",
      order: "viewCount", maxResults: "1",
      publishedAfter: lastMonth,
    })
    const r1 = await fetch(`${BASE}/search?${p1}`).then((r) => r.json())
    const t1 = r1.items?.[0]?.snippet?.title
    if (t1) return cleanTitle(t1)

    // Fallback: all-time most viewed
    const p2 = new URLSearchParams({
      key: apiKey, channelId,
      part: "snippet", type: "video",
      order: "viewCount", maxResults: "1",
    })
    const r2 = await fetch(`${BASE}/search?${p2}`).then((r) => r.json())
    const t2 = r2.items?.[0]?.snippet?.title
    return t2 ? cleanTitle(t2) : "one of your recent videos"
  } catch {
    return "one of your recent videos"
  }
}

function cleanTitle(title: string): string {
  return title
    .replace(/&[a-z]+;/gi, " ")  // strip basic HTML entities
    .replace(/#\w+/g, "")         // strip hashtags
    .replace(/\s+/g, " ")
    .trim()
}

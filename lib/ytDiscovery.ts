// lib/ytDiscovery.ts
// Port of yt_leads_finder.py — runs server-side only (API route).
// Takes a config object, returns ranked lead candidates. No side effects.
//
// Parallelisation: channels are processed in batches of PARALLEL_BATCH_SIZE.
// Within each batch all API calls run concurrently. A 200ms sleep between
// batches keeps us well within YouTube's rate limits.
// Speedup vs sequential: ~250 channels goes from 3-5 min → ~8 seconds.

const BASE_URL           = "https://www.googleapis.com/youtube/v3"
const EMAIL_REGEX        = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PARALLEL_BATCH_SIZE = 25   // channels processed concurrently per batch

export type YTDiscoveryConfig = {
  keyword:       string
  minSubs:       number
  maxSubs:       number
  minUploads30d: number
  minAvgViews?:  number
  maxPages?:     number
}

export type YTLeadCandidate = {
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

export async function discoverYTLeads(
  config: YTDiscoveryConfig
): Promise<YTLeadCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY env var is not set")

  const channelIds = await searchChannels(config.keyword, config.maxPages ?? 5, apiKey)

  const channelsData = await getChannelDetailsBatch(channelIds.slice(0, 250), apiKey)

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const results: YTLeadCandidate[] = []

  // ── Parallel batching ──────────────────────────────────────────────────────
  // Process PARALLEL_BATCH_SIZE channels at once. Promise.allSettled means a
  // single channel error never aborts the whole batch — same as the original
  // try/catch-and-skip behaviour, just concurrent.
  for (let i = 0; i < channelsData.length; i += PARALLEL_BATCH_SIZE) {
    const batch = channelsData.slice(i, i + PARALLEL_BATCH_SIZE)

    const settled = await Promise.allSettled(
      batch.map((channel) => processChannel(channel, config, apiKey, cutoff))
    )

    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value !== null) {
        results.push(outcome.value)
      }
    }

    // Brief pause between batches — keeps us well within YouTube rate limits
    if (i + PARALLEL_BATCH_SIZE < channelsData.length) await sleep(200)
  }

  return results.sort((a, b) => b.ytScore - a.ytScore)
}

// ─── Per-channel processing ───────────────────────────────────────────────────
// Extracted from the original sequential loop so it can run in parallel.
// Returns null if the channel doesn't pass filters.

async function processChannel(
  channel:  any,
  config:   YTDiscoveryConfig,
  apiKey:   string,
  cutoff:   Date
): Promise<YTLeadCandidate | null> {
  const subs = parseInt(channel.statistics?.subscriberCount ?? "0", 10)
  if (subs < config.minSubs || subs > config.maxSubs) return null

  const description = channel.snippet?.description ?? ""
  const email       = extractEmail(description)
  const { website, instagram, twitter, linktree } = extractSocialLinks(description)

  const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylist) return null

  const videos = await getRecentVideos(uploadsPlaylist, apiKey)

  let uploads30d = 0
  let lastUpload: Date | null = null
  const videoIds: string[] = []

  for (const vid of videos) {
    const published = new Date(vid.snippet.publishedAt)
    if (!lastUpload) lastUpload = published
    if (published > cutoff) uploads30d++
    videoIds.push(vid.snippet.resourceId.videoId)
  }

  if (uploads30d < config.minUploads30d) return null

  const stats    = await getVideoStats(videoIds.slice(0, 10), apiKey)
  const views    = stats.map((v: any) => parseInt(v.statistics?.viewCount ?? "0", 10))
  const avgViews = views.length
    ? views.reduce((a: number, b: number) => a + b, 0) / views.length
    : 0

  if (config.minAvgViews && avgViews < config.minAvgViews) return null

  const contactBonus = email ? 2 : website ? 1 : 0
  const ytScore =
    Math.round(
      (uploads30d * 3 +
        Math.log10(Math.max(subs, 1)) * 2 +
        avgViews / 10_000 +
        contactBonus) * 100
    ) / 100

  return {
    channelName: channel.snippet.title,
    channelUrl:  `https://youtube.com/channel/${channel.id}`,
    subscribers: subs,
    uploads30d,
    avgViews:    Math.round(avgViews),
    lastUpload:  lastUpload ? lastUpload.toISOString().split("T")[0] : "",
    email,
    website,
    instagram,
    twitter,
    linktree,
    ytScore,
  }
}

// ─── Helpers (unchanged from original) ────────────────────────────────────────

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_REGEX)
  return m ? m[0] : null
}

function extractSocialLinks(description: string) {
  const urls = description.match(/https?:\/\/[^\s]+/g) ?? []
  let website:   string | null = null
  let instagram: string | null = null
  let twitter:   string | null = null
  let linktree:  string | null = null

  for (const url of urls) {
    if (url.includes("instagram.com"))                    instagram = url
    else if (url.includes("twitter.com") || url.includes("x.com")) twitter = url
    else if (url.includes("linktr.ee"))                   linktree  = url
    else if (!website)                                    website   = url
  }

  return { website, instagram, twitter, linktree }
}

async function searchChannels(
  keyword:  string,
  maxPages: number,
  apiKey:   string
): Promise<string[]> {
  const channelIds = new Set<string>()
  let nextPageToken: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      part:              "snippet",
      q:                 keyword,
      type:              "video",
      order:             "date",
      maxResults:        "50",
      relevanceLanguage: "en",
      regionCode:        "US",
      key:               apiKey,
      ...(nextPageToken ? { pageToken: nextPageToken } : {}),
    })

    const res = await fetch(`${BASE_URL}/search?${params}`).then((r) => r.json())

    for (const item of res.items ?? []) {
      channelIds.add(item.snippet.channelId)
    }

    nextPageToken = res.nextPageToken
    if (!nextPageToken) break
    await sleep(200)
  }

  return [...channelIds]
}

async function getChannelDetailsBatch(ids: string[], apiKey: string): Promise<any[]> {
  const result: any[] = []

  for (let i = 0; i < ids.length; i += 50) {
    const batch  = ids.slice(i, i + 50)
    const params = new URLSearchParams({
      part: "statistics,contentDetails,snippet",
      id:   batch.join(","),
      key:  apiKey,
    })
    const res = await fetch(`${BASE_URL}/channels?${params}`).then((r) => r.json())
    result.push(...(res.items ?? []))
    await sleep(200)
  }

  return result
}

async function getRecentVideos(playlistId: string, apiKey: string): Promise<any[]> {
  const params = new URLSearchParams({
    part:       "snippet",
    playlistId,
    maxResults: "50",
    key:        apiKey,
  })
  const res = await fetch(`${BASE_URL}/playlistItems?${params}`).then((r) => r.json())
  return res.items ?? []
}

async function getVideoStats(videoIds: string[], apiKey: string): Promise<any[]> {
  if (!videoIds.length) return []
  const params = new URLSearchParams({
    part: "statistics",
    id:   videoIds.join(","),
    key:  apiKey,
  })
  const res = await fetch(`${BASE_URL}/videos?${params}`).then((r) => r.json())
  return res.items ?? []
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
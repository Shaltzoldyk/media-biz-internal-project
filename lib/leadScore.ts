export type LeadScoreInput = {
  subscribers:    number
  outsourcing:    boolean
  uploadsWeekly:  boolean
  monetized:      boolean
  warmIntro:      boolean
  // Optional — only present for YT-sourced leads
  ytUploads30d?:  number
  ytAvgViews?:    number
}

export function calculateLeadScore(data: LeadScoreInput): number {
  let score = 0

  // Core signals — unchanged weights
  if (data.subscribers >= 100_000) score += 2
  if (data.outsourcing)            score += 3
  if (data.uploadsWeekly)          score += 2
  if (data.monetized)              score += 2
  if (data.warmIntro)              score += 3

  // YT bonus: up to +2 points when YT data is present.
  // Capped so YT leads stay comparable to manually-entered leads.
  if (data.ytUploads30d != null && data.ytAvgViews != null) {
    const uploadBonus = Math.min(data.ytUploads30d / 16, 1)     // 1pt at 16+ uploads/30d
    const viewBonus   = Math.min(data.ytAvgViews  / 50_000, 1)  // 1pt at 50k+ avg views
    score += uploadBonus + viewBonus
  }

  return Math.min(Math.round(score), 10)
}

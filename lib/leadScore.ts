export type LeadScoreInput = {
  subscribers: number
  outsourcing: boolean
  uploadsWeekly: boolean
  monetized: boolean
  warmIntro: boolean
}

export function calculateLeadScore(data: LeadScoreInput): number {
  let score = 0

  if (data.subscribers >= 100000) score += 2
  if (data.outsourcing) score += 3
  if (data.uploadsWeekly) score += 2
  if (data.monetized) score += 2
  if (data.warmIntro) score += 3

  return Math.min(score, 10)
}

export function getStageStatus(stageChangedAt: string) {
  const changed = new Date(stageChangedAt).getTime()
  const now = Date.now()

  const days = Math.floor((now - changed) / (1000 * 60 * 60 * 24))

  if (days <= 2) return "green"
  if (days <= 5) return "yellow"
  return "red"
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { calculateLeadScore } from "@/lib/leadScore"

type LeadSignals = {
  id: string
  subscriber_count: number | null
  signal_warm_intro: boolean | null
  signal_outsourcing: boolean | null
  signal_uploads_weekly: boolean | null
  signal_monetized: boolean | null
  score: number | null
}

export default function RecalculateScoreButton({
  leadId,
  lead,
}: {
  leadId: string
  lead: LeadSignals
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRecalculate = async () => {
    setLoading(true)

    const newScore = calculateLeadScore({
      subscribers:  lead.subscriber_count ?? 0,
      outsourcing:  lead.signal_outsourcing ?? false,
      uploadsWeekly: lead.signal_uploads_weekly ?? false,
      monetized:    lead.signal_monetized ?? false,
      warmIntro:    lead.signal_warm_intro ?? false,
    })

    if (newScore === lead.score) {
      setLoading(false)
      return
    }

    await supabase
      .from("leads")
      .update({ score: newScore })
      .eq("id", leadId)

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleRecalculate}
      disabled={loading}
      className="btn btn-ghost"
      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
      title="Recalculate score from current signals"
    >
      {loading ? "…" : "Recalculate"}
    </button>
  )
}

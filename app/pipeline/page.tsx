import { supabase } from "@/lib/supabase"
import PipelineBoardWrapper from "@/components/PipelineBoardWrapper"

export const dynamic = "force-dynamic"

export default async function PipelinePage() {
  const { data: leads, error } = await supabase.from("leads").select("*")

  if (error) return <div style={{ color:"var(--red)" }}>Error loading pipeline.</div>

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Acquisition</div>
        <h1>Pipeline</h1>
      </div>
      <div className="fade-up delay-1">
        <PipelineBoardWrapper leads={leads || []} />
      </div>
    </div>
  )
}
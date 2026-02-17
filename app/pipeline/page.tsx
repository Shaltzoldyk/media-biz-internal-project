import { supabase } from "@/lib/supabase"
import PipelineBoard from "@/components/PipelineBoard"

export default async function PipelinePage() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")

  if (error) {
    return <div className="text-red-500">Error loading pipeline.</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">Pipeline</h1>
      <PipelineBoard leads={leads || []} />
    </div>
  )
}

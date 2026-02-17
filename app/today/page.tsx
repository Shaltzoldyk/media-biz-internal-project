import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function TodayPage() {
  const today = new Date().toISOString().split("T")[0]

  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString()

  const { data: stuck } = await supabase
    .from("leads")
    .select("*")
    .lt("stage_changed_at", fiveDaysAgo)

  const { data: followUps } = await supabase
    .from("leads")
    .select("*")
    .eq("follow_up_date", today)

  const { data: highPriority } = await supabase
    .from("leads")
    .select("*")
    .gte("score", 7)
    .eq("status", "New")

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-8">Today</h1>

      <section className="mb-10">
        <h2 className="font-semibold mb-4">🔥 Stuck Leads</h2>
        {stuck?.map((lead) => (
          <div key={lead.id}>{lead.name}</div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-semibold mb-4">📅 Follow Ups</h2>
        {followUps?.map((lead) => (
          <div key={lead.id}>{lead.name}</div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold mb-4">🚀 High Priority (Score 7+)</h2>
        {highPriority?.map((lead) => (
          <div key={lead.id}>{lead.name}</div>
        ))}
      </section>
    </div>
  )
}

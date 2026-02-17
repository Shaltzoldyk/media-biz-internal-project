import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"

export default async function TodayPage() {
  const today = new Date().toISOString().split("T")[0]
  const fiveDaysAgo = new Date(
    Date.now() - 5 * 86400000
  ).toISOString()

  const { data } = await supabase.from("leads").select("*")

  const leads = (data || []) as Lead[]

  const stuckLeads = leads.filter(
    (lead) =>
      lead.stage_changed_at < fiveDaysAgo &&
      lead.status !== "Client" &&
      lead.status !== "Lost"
  )

  const followUps = leads.filter(
    (lead) => lead.follow_up_date === today
  )

  const highPriority = leads.filter(
    (lead) =>
      (lead.score || 0) >= 7 &&
      lead.status === "New"
  )

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-semibold">
        Today
      </h1>

      {/* Follow Ups */}
      <Section title="📅 Follow Ups Today">
        {followUps}
      </Section>

      {/* Stuck Leads */}
      <Section title="🔥 Stuck Leads (5+ days)">
        {stuckLeads}
      </Section>

      {/* High Priority */}
      <Section title="🚀 High Priority (Score 7+)">
        {highPriority}
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: Lead[]
}) {
  if (!children.length) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {title}
        </h2>
        <div className="text-zinc-500">
          Nothing here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>

      <div className="grid gap-3">
        {children.map((lead) => (
          <div
            key={lead.id}
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg"
          >
            <div className="flex justify-between">
              <div className="font-medium">
                {lead.name}
              </div>
              <div className="text-sm">
                ₹{" "}
                {lead.value
                  ? Number(lead.value).toLocaleString()
                  : "-"}
              </div>
            </div>

            <div className="text-sm text-zinc-400">
              {lead.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

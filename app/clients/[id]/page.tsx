import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import ActivityTimeline from "@/components/ActivityTimeline"
import RevenueSection from "@/components/RevenueSection"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !client) {
    return notFound()
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">
          {client.name}
        </h1>
        <div className="text-zinc-400 mt-2">
          {client.company || "No company"}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div>
          <div className="text-xs text-zinc-500 uppercase">
            Contract Value
          </div>
          <div>
            ₹ {Number(client.contract_value || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-xs text-zinc-500 uppercase">
            Billing Type
          </div>
          <div>{client.billing_type}</div>
        </div>

        <div>
          <div className="text-xs text-zinc-500 uppercase">
            Status
          </div>
          <div>{client.status}</div>
        </div>
      </div>

      <RevenueSection client={client} />

      <ActivityTimeline
        entityType="client"
        entityId={client.id}
      />
    </div>
  )
}

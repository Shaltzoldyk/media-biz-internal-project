import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import ActivityTimeline from "@/components/ActivityTimeline"
import RevenueSection from "@/components/RevenueSection"
import CurrencyValue from "@/components/CurrencyValue"

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
    <div style={{ maxWidth: 720 }}>
      <div className="page-header fade-up">
        <div className="label">Client</div>
        <h1>{client.name}</h1>
        {client.company && (
          <div style={{ color: "var(--text-3)", marginTop: 4, fontSize: "0.875rem" }}>
            {client.company}
          </div>
        )}
      </div>

      <div className="fade-up delay-1 card" style={{ padding: "20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Contract value</div>
            <div className="mono" style={{ fontWeight: 600 }}>
              <CurrencyValue amount={client.contract_value} />
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Billing type</div>
            <div>{client.billing_type}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Status</div>
            <div>
              <span className={`pill ${client.status === "active" ? "pill-green" : "pill-gray"}`}>
                {client.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fade-up delay-2 card" style={{ padding: "20px", marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 12 }}>Revenue</div>
        <RevenueSection client={client} />
      </div>

      <div className="fade-up delay-3">
        <ActivityTimeline entityType="client" entityId={client.id} />
      </div>
    </div>
  )
}

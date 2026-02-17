import { supabase } from "@/lib/supabase"
import ClientCard from "@/components/ClientCard"

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return <div className="text-red-500">Error loading clients.</div>
  }

  const { data: revenueRecords } = await supabase
    .from("revenue_records")
    .select("*")

  const activeClients =
    clients?.filter((client) => client.status === "active") || []

  const totalMRR = activeClients.reduce((sum, client) => {
    const value = Number(client.contract_value || 0)

    if (client.billing_type === "weekly") return sum + value * 4
    if (client.billing_type === "bi_weekly") return sum + value * 2
    if (client.billing_type === "monthly") return sum + value

    return sum
  }, 0)

  const totalLifetimeRevenue =
    revenueRecords?.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    ) || 0

  const totalOutstanding = activeClients.reduce((sum, client) => {
    const clientRevenue =
      revenueRecords
        ?.filter((r) => r.client_id === client.id)
        .reduce((s, r) => s + Number(r.amount || 0), 0) || 0

    const expected =
      client.billing_type === "one_time"
        ? Number(client.contract_value || 0)
        : Number(client.contract_value || 0)

    return sum + (expected - clientRevenue)
  }, 0)

  const averageRevenuePerClient =
    activeClients.length > 0
      ? totalLifetimeRevenue / activeClients.length
      : 0

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">Clients</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-sm text-zinc-400">Active Clients</div>
          <div className="text-2xl font-semibold">
            {activeClients.length}
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-sm text-zinc-400">Total MRR</div>
          <div className="text-2xl font-semibold">
            ₹ {totalMRR.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-sm text-zinc-400">Lifetime Revenue</div>
          <div className="text-2xl font-semibold">
            ₹ {totalLifetimeRevenue.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-sm text-zinc-400">Total Outstanding</div>
          <div className="text-2xl font-semibold text-red-400">
            ₹ {totalOutstanding.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-sm text-zinc-400">Avg Revenue / Client</div>
          <div className="text-2xl font-semibold">
            ₹ {Math.floor(averageRevenuePerClient).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeClients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  )
}

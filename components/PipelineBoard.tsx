"use client"

const statuses = [
  "New",
  "Qualified",
  "Contacted",
  "Responded",
  "Call Booked",
  "Client",
  "Lost",
]

export default function PipelineBoard({ leads }: any) {
  const grouped = statuses.map((status) => ({
    status,
    leads: leads.filter((lead: any) => lead.status === status),
  }))

 return (
  <div className="w-full">
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
      {grouped.map((column) => (

         <div
  key={column.status}
  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-[400px]"
>

            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
              {column.status}
            </h2>

            <div className="space-y-3">
              {column.leads.map((lead: any) => (
                <div
                  key={lead.id}
                  className="bg-zinc-800 p-3 rounded-lg border border-zinc-700 hover:border-zinc-500 transition"
                >
                  <div className="font-medium">
                    {lead.name}
                  </div>

                  <div className="text-sm text-zinc-400">
                    {lead.platform}
                  </div>

                  <div className="text-sm text-zinc-500">
                    {lead.subscriber_count
                      ? lead.subscriber_count.toLocaleString()
                      : "-"}
                  </div>
                </div>
              ))}

              {column.leads.length === 0 && (
                <div className="text-zinc-600 text-sm">
                  No leads
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

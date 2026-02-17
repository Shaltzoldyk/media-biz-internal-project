import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default async function LeadsPage() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="text-red-500">
        Error loading leads.
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold">Leads</h1>

        <Link
          href="/leads/new"
          className="bg-white text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition"
        >
          Add Lead
        </Link>
      </div>

      {/* Table Container */}
      <div className="bg-zinc-900 text-white rounded-lg overflow-hidden border border-zinc-800">

        {leads && leads.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-zinc-800 text-sm uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Brand</th>
                <th className="p-4">Platform</th>
                <th className="p-4">Subscribers</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
                >
                  <td className="p-4 font-medium">{lead.name}</td>
                  <td className="p-4 text-zinc-400">
                    {lead.brand_name || "-"}
                  </td>
                  <td className="p-4">{lead.platform}</td>
                  <td className="p-4">
                    {lead.subscriber_count
                      ? lead.subscriber_count.toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700">
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-zinc-500">
            No leads yet.
          </div>
        )}
      </div>
    </div>
  )
}

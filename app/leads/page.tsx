import { supabase } from "@/lib/supabase"
import Link from "next/link"
import LeadsTable from "@/components/LeadsTable"
import { Lead } from "@/types/lead"

export default async function LeadsPage() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return <div className="text-red-500">Error loading leads.</div>
  }

  const leads = (data || []) as Lead[]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold">Leads</h1>

        <Link
          href="/leads/new"
          className="bg-zinc-100 text-black px-5 py-2.5 rounded-lg font-medium hover:bg-white transition"
        >
          + Add Lead
        </Link>
      </div>

      <LeadsTable initialLeads={leads} />
    </div>
  )
}

"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [loading, setLoading] = useState(false)

  const addTestLead = async () => {
    setLoading(true)

    const { data, error } = await supabase.from("leads").insert([
      {
        name: "Test Creator",
        brand_name: "Test Brand",
        platform: "YouTube",
        subscriber_count: 50000,
      },
    ])

    console.log(data, error)
    setLoading(false)
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <button
        onClick={addTestLead}
        className="bg-black text-white px-6 py-3 rounded"
      >
        {loading ? "Adding..." : "Add Test Lead"}
      </button>
    </div>
  )
}

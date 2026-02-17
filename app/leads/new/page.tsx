"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function NewLeadPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [platform, setPlatform] = useState("YouTube")
  const [subscribers, setSubscribers] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from("leads").insert([
      {
        name,
        brand_name: brand,
        platform,
        subscriber_count: Number(subscribers),
      },
    ])

    if (!error) {
      router.push("/leads")
      router.refresh()
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-10">Add New Lead</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 text-white p-8 rounded-xl border border-zinc-800 space-y-6"
      >
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Brand Name</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          >
            <option value="YouTube">YouTube</option>
            <option value="Twitter">Twitter</option>
            <option value="LinkedIn">LinkedIn</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Subscriber Count</label>
          <input
            type="number"
            value={subscribers}
            onChange={(e) => setSubscribers(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="bg-zinc-100 text-black px-6 py-3 rounded-lg font-medium hover:bg-white transition"
          >
            Create Lead
          </button>
        </div>
      </form>
    </div>
  )
}

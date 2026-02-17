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
    <div>
      <h1 className="text-3xl font-semibold mb-6">Add New Lead</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 text-white p-6 rounded-lg space-y-4 max-w-xl border border-zinc-800"
      >
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded"
          required
        />

        <input
          placeholder="Brand Name"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded"
        />

        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded"
        >
          <option value="YouTube">YouTube</option>
          <option value="Twitter">Twitter</option>
          <option value="LinkedIn">LinkedIn</option>
        </select>

        <input
          placeholder="Subscriber Count"
          type="number"
          value={subscribers}
          onChange={(e) => setSubscribers(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded"
        />

        <button
          type="submit"
          className="bg-white text-black px-4 py-2 rounded-md"
        >
          Create Lead
        </button>
      </form>
    </div>
  )
}

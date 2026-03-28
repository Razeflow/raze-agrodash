"use client";
import { useState } from "react";
import { Database, CheckCircle2, Loader2 } from "lucide-react";
import { seedData } from "@/lib/seed-data";

export default function SeedButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<{ farmersAdded: number; recordsAdded: number } | null>(null);

  function handleSeed() {
    if (status === "loading") return;
    setStatus("loading");

    // Small timeout so the UI updates before the sync work
    setTimeout(() => {
      const res = seedData();
      setResult(res);
      setStatus("done");

      if (res.farmersAdded > 0 || res.recordsAdded > 0) {
        // Reload the page so the context picks up new localStorage data
        setTimeout(() => window.location.reload(), 800);
      }
    }, 100);
  }

  if (status === "done" && result) {
    if (result.farmersAdded === 0 && result.recordsAdded === 0) {
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
          <CheckCircle2 size={13} /> Data already loaded
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
        <CheckCircle2 size={13} /> +{result.farmersAdded} farmers, +{result.recordsAdded} records — reloading…
      </span>
    );
  }

  return (
    <button
      onClick={handleSeed}
      disabled={status === "loading"}
      className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition disabled:opacity-50"
      title="Populate all barangays with 10 sample farmers and 10 commodity records each"
    >
      {status === "loading" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Database size={13} />
      )}
      {status === "loading" ? "Seeding…" : "Load Sample Data"}
    </button>
  );
}

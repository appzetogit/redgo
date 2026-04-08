import { Loader2 } from "lucide-react"

export default function Loader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
      <Loader2 className="w-10 h-10 text-[#EF4F5F] animate-spin mb-4" />
      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest animate-pulse">Loading RedGo...</p>
    </div>
  )
}

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function StatusBadge({ status }: { status: "running" | "finished" | "failed" }) {
  const styles =
    status === "running"
      ? "bg-blue-600 text-white hover:bg-blue-600"
      : status === "finished"
        ? "bg-green-600 text-white hover:bg-green-600"
        : "bg-red-600 text-white hover:bg-red-600"
  return <Badge className={cn("capitalize", styles)}>{status}</Badge>
}

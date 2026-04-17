import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribeEod, getEodState, dismissEod, type EodState } from "@/lib/eod-reset-store";

interface Props {
  variant?: "dashboard" | "tv";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EodResetBanner({ variant = "dashboard" }: Props) {
  const [state, setState] = useState<EodState>(getEodState());
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeEod(setState), []);

  useEffect(() => {
    if (state.phase === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // Auto-dismiss the "completed" notice after 30 seconds
  useEffect(() => {
    if (state.phase !== "completed") return;
    const t = setTimeout(() => dismissEod(), 30_000);
    return () => clearTimeout(t);
  }, [state.phase, state.lastCompletedAt]);

  if (state.phase === "idle") return null;

  const isTv = variant === "tv";
  const baseClass = isTv
    ? "w-full px-6 py-4 text-2xl md:text-3xl font-semibold flex items-center justify-center gap-4 shadow-md"
    : "w-full px-4 py-3 text-sm md:text-base font-medium flex items-center justify-between gap-3 border-b";

  if (state.phase === "warning" && state.scheduledAt) {
    const remaining = state.scheduledAt - now;
    return (
      <div
        className={`${baseClass} bg-amber-100 text-amber-900 border-amber-300`}
        data-testid="banner-eod-warning"
      >
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <AlertTriangle className={isTv ? "h-8 w-8" : "h-5 w-5"} />
          <span>
            End-of-day reset in <span data-testid="text-eod-countdown">{formatCountdown(remaining)}</span>
            {" "}(at {formatClock(state.scheduledAt)}). Please finish calling patients.
          </span>
        </div>
        {!isTv && (
          <Button size="sm" variant="ghost" onClick={() => dismissEod()} data-testid="button-eod-dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (state.phase === "postponed" && state.scheduledAt) {
    return (
      <div
        className={`${baseClass} bg-blue-100 text-blue-900 border-blue-300`}
        data-testid="banner-eod-postponed"
      >
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Clock className={isTv ? "h-8 w-8" : "h-5 w-5"} />
          <span>
            End-of-day reset postponed to {formatClock(state.scheduledAt)} due to recent activity.
          </span>
        </div>
        {!isTv && (
          <Button size="sm" variant="ghost" onClick={() => dismissEod()} data-testid="button-eod-dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (state.phase === "completed") {
    return (
      <div
        className={`${baseClass} bg-emerald-100 text-emerald-900 border-emerald-300`}
        data-testid="banner-eod-completed"
      >
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <CheckCircle2 className={isTv ? "h-8 w-8" : "h-5 w-5"} />
          <span>{state.message}</span>
        </div>
        {!isTv && (
          <Button size="sm" variant="ghost" onClick={() => dismissEod()} data-testid="button-eod-dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return null;
}

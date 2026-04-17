// Tiny pub-sub store shared by every WebSocket consumer (dashboard, TV, standalone TV)
// Tracks the next end-of-day reset, current warning, postpone notice, and last completion.

export type EodPhase = 'idle' | 'warning' | 'postponed' | 'completed';

export interface EodState {
  phase: EodPhase;
  scheduledAt: number | null; // ms epoch
  message: string | null;
  postponeCount: number;
  lastCompletedCount: number | null;
  lastCompletedAt: number | null;
  forced: boolean;
}

const initialState: EodState = {
  phase: 'idle',
  scheduledAt: null,
  message: null,
  postponeCount: 0,
  lastCompletedCount: null,
  lastCompletedAt: null,
  forced: false,
};

let current: EodState = { ...initialState };
const listeners = new Set<(s: EodState) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export function getEodState(): EodState {
  return current;
}

export function subscribeEod(fn: (s: EodState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function applyEodWarning(payload: { scheduledAt: number; message: string }) {
  current = {
    ...current,
    phase: 'warning',
    scheduledAt: payload.scheduledAt,
    message: payload.message,
    forced: false,
  };
  emit();
}

export function applyEodPostponed(payload: { scheduledAt: number; postponeCount: number; message: string }) {
  current = {
    ...current,
    phase: 'postponed',
    scheduledAt: payload.scheduledAt,
    postponeCount: payload.postponeCount,
    message: payload.message,
  };
  emit();
}

export function applyEodCompleted(payload: { count: number; forced: boolean; reason?: string }) {
  current = {
    ...current,
    phase: 'completed',
    scheduledAt: null,
    message: payload.forced
      ? `Manual end-of-day reset complete. ${payload.count} pending patient(s) closed.`
      : `End-of-day reset complete. ${payload.count} pending patient(s) closed.`,
    lastCompletedCount: payload.count,
    lastCompletedAt: Date.now(),
    forced: payload.forced,
  };
  emit();
}

export function dismissEod() {
  current = { ...initialState, lastCompletedCount: current.lastCompletedCount, lastCompletedAt: current.lastCompletedAt };
  emit();
}

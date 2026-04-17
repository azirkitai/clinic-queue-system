import type { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";

const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8
const TICK_INTERVAL_MS = 60 * 1000; // 60s
const WARNING_LEAD_MS = 10 * 60 * 1000; // show warning starting 10 min before reset
const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000; // "last 10 min"
const POSTPONE_DURATION_MS = 30 * 60 * 1000; // postpone 30 min when activity detected
const MAX_AUTO_POSTPONES = 6; // safety cap (3h max delay) so the reset always eventually runs

interface TenantState {
  scheduledAt: number; // ms epoch — next planned reset time
  warningSent: boolean;
  postponeCount: number;
}

const state = new Map<string, TenantState>();
let io: SocketIOServer | null = null;
let isRunning = false;

function malaysiaNow(): Date {
  return new Date(Date.now() + MALAYSIA_OFFSET_MS);
}

// Compute the next 00:00 Malaysia time as a UTC ms timestamp
function nextMidnightMalaysiaMs(fromMs: number = Date.now()): number {
  const myNow = new Date(fromMs + MALAYSIA_OFFSET_MS);
  const myMidnight = new Date(Date.UTC(
    myNow.getUTCFullYear(),
    myNow.getUTCMonth(),
    myNow.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  // Convert that "Malaysia midnight" wall-clock back to UTC ms
  return myMidnight.getTime() - MALAYSIA_OFFSET_MS;
}

function getOrInitTenant(userId: string): TenantState {
  let s = state.get(userId);
  if (!s) {
    s = { scheduledAt: nextMidnightMalaysiaMs(), warningSent: false, postponeCount: 0 };
    state.set(userId, s);
  }
  return s;
}

function broadcast(userId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`clinic:${userId}`).emit(event, payload);
}

async function performReset(userId: string, opts: { forced?: boolean; reason?: string } = {}) {
  const reason = opts.reason || (opts.forced ? 'Manual end-of-day reset' : 'Auto-closed end of day');
  try {
    const result = await storage.autoCloseAllPendingPatients(userId, reason);

    broadcast(userId, 'system:eod-completed', {
      count: result.count,
      forced: !!opts.forced,
      reason,
      timestamp: Date.now(),
    });

    // Trigger a normal queue refresh on every connected client
    broadcast(userId, 'queue:reset', { timestamp: Date.now(), reason });
    broadcast(userId, 'cache:invalidate', {
      queries: ['stats', 'history', 'patients', 'windows'],
      reason: 'eod-reset',
      timestamp: Date.now(),
    });

    console.log(`[EOD] Reset complete for user ${userId} — closed ${result.count} patient(s) (forced=${!!opts.forced})`);
    return result;
  } catch (err) {
    console.error(`[EOD] Reset FAILED for user ${userId}:`, err);
    throw err;
  }
}

async function tick() {
  if (!io) return;
  if (isRunning) return;
  isRunning = true;

  try {
    const users = await storage.getUsers();
    const now = Date.now();

    for (const user of users) {
      if (!user.isActive) continue;

      const tenant = getOrInitTenant(user.id);

      // If we've drifted past the scheduled time without firing, recompute baseline
      if (tenant.scheduledAt < now - 5 * 60 * 1000 && tenant.postponeCount === 0) {
        tenant.scheduledAt = nextMidnightMalaysiaMs(now);
        tenant.warningSent = false;
      }

      const msUntil = tenant.scheduledAt - now;

      // === WARNING WINDOW ===
      if (!tenant.warningSent && msUntil <= WARNING_LEAD_MS && msUntil > 0) {
        tenant.warningSent = true;
        broadcast(user.id, 'system:eod-warning', {
          scheduledAt: tenant.scheduledAt,
          message: 'End-of-day reset coming up. The queue will be cleared automatically.',
          timestamp: now,
        });
        console.log(`[EOD] Warning sent to user ${user.id} (reset in ${Math.round(msUntil / 1000)}s)`);
      }

      // === RESET WINDOW ===
      if (msUntil <= 0) {
        // Smart postpone: defer if there was activity in the last 10 minutes
        if (tenant.postponeCount < MAX_AUTO_POSTPONES) {
          const recentlyActive = await storage.hasRecentActivity(user.id, now - RECENT_ACTIVITY_WINDOW_MS);
          if (recentlyActive) {
            tenant.scheduledAt = now + POSTPONE_DURATION_MS;
            tenant.postponeCount += 1;
            tenant.warningSent = false;
            broadcast(user.id, 'system:eod-postponed', {
              scheduledAt: tenant.scheduledAt,
              postponeCount: tenant.postponeCount,
              message: 'Recent activity detected. End-of-day reset postponed by 30 minutes.',
              timestamp: now,
            });
            console.log(`[EOD] Postponed reset for user ${user.id} (#${tenant.postponeCount}) — next at ${new Date(tenant.scheduledAt).toISOString()}`);
            continue;
          }
        }

        // Fire reset and schedule next day
        try {
          await performReset(user.id);
        } finally {
          tenant.scheduledAt = nextMidnightMalaysiaMs(Date.now());
          tenant.warningSent = false;
          tenant.postponeCount = 0;
        }
      }
    }
  } catch (err) {
    console.error('[EOD] Tick error:', err);
  } finally {
    isRunning = false;
  }
}

export function startEodScheduler(socketIo: SocketIOServer) {
  io = socketIo;
  console.log(`[EOD] Scheduler started. Malaysia time now: ${malaysiaNow().toISOString().replace('Z', '+08:00')}`);
  // Initial tick after 5s so io has settled
  setTimeout(() => tick(), 5000);
  setInterval(tick, TICK_INTERVAL_MS);
}

// Manual trigger used by the admin "Reset Now" endpoint
export async function forceEodReset(userId: string): Promise<{ count: number; patientIds: string[] }> {
  const result = await performReset(userId, { forced: true, reason: 'Manual end-of-day reset' });
  // Reset tenant schedule state so we don't double-fire near midnight
  const tenant = getOrInitTenant(userId);
  tenant.warningSent = false;
  tenant.postponeCount = 0;
  tenant.scheduledAt = nextMidnightMalaysiaMs(Date.now());
  return result;
}

// Inspector for the admin UI / debugging
export function getEodStatus(userId: string) {
  const tenant = getOrInitTenant(userId);
  return {
    scheduledAt: tenant.scheduledAt,
    warningSent: tenant.warningSent,
    postponeCount: tenant.postponeCount,
    nowMs: Date.now(),
  };
}

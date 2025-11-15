import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type TvQueueItem } from "@shared/schema";

interface QueueItem {
  id: string;
  name: string;
  number: string;
  room: string;
  status: "waiting" | "calling" | "completed";
  timestamp: Date;
  calledAt?: Date | null;
  requeueReason?: string | null;
}

interface UseTvPatientsResult {
  currentPatient: QueueItem | null;
  queueWaiting: QueueItem[]; // Waiting patients for TV display
  queueHistory: QueueItem[]; // Completed patients
  isLoading: boolean;
  error: Error | null;
}

export function useTvPatients(): UseTvPatientsResult {
  const { data: tvPatients = [], isLoading, error } = useQuery<TvQueueItem[]>({
    queryKey: ['/api/patients/tv'],
    staleTime: 5000,
    refetchInterval: 30000, // Poll every 30s (WebSocket is primary)
    refetchOnReconnect: true,
  });

  // Memoize transformed patients to avoid re-creating Date objects on every render
  const { currentPatient, queueWaiting, queueHistory } = useMemo(() => {
    // Transform TvQueueItem to QueueItem format for TV display
    const transformToQueueItem = (patient: TvQueueItem): QueueItem => {
      // Map status from TvQueueItem to QueueItem format
      let displayStatus: "waiting" | "calling" | "completed";
      if (patient.status === "called") {
        displayStatus = "calling";
      } else if (patient.status === "completed") {
        displayStatus = "completed";
      } else {
        // Covers: waiting, in-progress, requeue, dispensary
        displayStatus = "waiting";
      }

      return {
        id: patient.id,
        name: patient.name || `No. ${patient.number}`,
        number: patient.number.toString(),
        room: patient.windowName || "Not available",
        status: displayStatus,
        // Use server timestamp if available, otherwise current time
        timestamp: patient.calledAt ? new Date(patient.calledAt) : new Date(),
        calledAt: patient.calledAt ? new Date(patient.calledAt) : null,
        requeueReason: patient.requeueReason,
      };
    };

    // Find current patient (status = 'called' with most recent calledAt)
    const current = (() => {
      const calledPatients = tvPatients
        .filter(p => p.status === "called")
        .map(transformToQueueItem)
        .sort((a, b) => {
          // Sort by calledAt DESC (most recent first)
          if (!a.calledAt) return 1;
          if (!b.calledAt) return -1;
          return b.calledAt.getTime() - a.calledAt.getTime();
        });
      
      return calledPatients[0] || null;
    })();

    // Get waiting patients (all non-completed, non-called statuses)
    const waiting = tvPatients
      .filter(p => p.status !== "completed" && p.status !== "called")
      .map(transformToQueueItem);

    // Get recent history (completed patients, sorted by calledAt DESC)
    const history = tvPatients
      .filter(p => p.status === "completed")
      .map(transformToQueueItem)
      .sort((a, b) => {
        // Sort by calledAt DESC (most recent first)
        if (!a.calledAt) return 1;
        if (!b.calledAt) return -1;
        return b.calledAt.getTime() - a.calledAt.getTime();
      })
      .slice(0, 10); // Limit to 10 recent history items

    return {
      currentPatient: current,
      queueWaiting: waiting,
      queueHistory: history,
    };
  }, [tvPatients]); // Only recompute when tvPatients changes

  return {
    currentPatient,
    queueWaiting,
    queueHistory,
    isLoading,
    error: error as Error | null,
  };
}

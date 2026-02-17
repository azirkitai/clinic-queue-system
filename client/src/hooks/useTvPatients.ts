import { useMemo, useRef, useState, useEffect } from "react";
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

interface CallLogEntry {
  logId: string;
  patientId: string;
  name: string;
  room: string;
  calledAt: Date;
}

interface UseTvPatientsResult {
  currentPatient: QueueItem | null;
  queueWaiting: QueueItem[];
  queueHistory: QueueItem[];
  isLoading: boolean;
  error: Error | null;
}

export function useTvPatients(): UseTvPatientsResult {
  const { data: tvPatients = [], isLoading, error } = useQuery<TvQueueItem[]>({
    queryKey: ['/api/patients/tv'],
    staleTime: 120000,
    refetchInterval: 120000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const callLogRef = useRef<CallLogEntry[]>([]);
  const prevSnapshotRef = useRef<Map<string, { calledAt: string | null; windowName: string | null; status: string }>>(new Map());
  const [callLogVersion, setCallLogVersion] = useState(0);

  useEffect(() => {
    if (tvPatients.length === 0 && prevSnapshotRef.current.size === 0) return;

    const prevSnapshot = prevSnapshotRef.current;
    const newSnapshot = new Map<string, { calledAt: string | null; windowName: string | null; status: string }>();
    let changed = false;

    for (const p of tvPatients) {
      const calledAtStr = p.calledAt ? new Date(p.calledAt).toISOString() : null;
      newSnapshot.set(p.id, { calledAt: calledAtStr, windowName: p.windowName || null, status: p.status });

      if (p.status === "called" && p.calledAt) {
        const prev = prevSnapshot.get(p.id);
        const prevCalledAt = prev?.calledAt || null;
        const prevStatus = prev?.status || null;

        const isNewCall = !prev || prevStatus !== "called";
        const isRecall = prev && prevStatus === "called" && prevCalledAt !== calledAtStr;

        if (isNewCall || isRecall) {
          callLogRef.current.unshift({
            logId: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            patientId: p.id,
            name: p.name || `No. ${p.number}`,
            room: p.windowName || "N/A",
            calledAt: new Date(p.calledAt),
          });
          changed = true;
        }
      }
    }

    if (callLogRef.current.length > 20) {
      callLogRef.current = callLogRef.current.slice(0, 20);
    }

    prevSnapshotRef.current = newSnapshot;
    if (changed) {
      setCallLogVersion(v => v + 1);
    }
  }, [tvPatients]);

  const { currentPatient, queueWaiting, queueHistory } = useMemo(() => {
    const transformToQueueItem = (patient: TvQueueItem): QueueItem => {
      let displayStatus: "waiting" | "calling" | "completed";
      if (patient.status === "called") {
        displayStatus = "calling";
      } else if (patient.status === "completed") {
        displayStatus = "completed";
      } else {
        displayStatus = "waiting";
      }

      return {
        id: patient.id,
        name: patient.name || `No. ${patient.number}`,
        number: patient.number.toString(),
        room: patient.windowName || "Not available",
        status: displayStatus,
        timestamp: patient.calledAt ? new Date(patient.calledAt) : new Date(),
        calledAt: patient.calledAt ? new Date(patient.calledAt) : null,
        requeueReason: patient.requeueReason,
      };
    };

    const current = (() => {
      const calledPatients = tvPatients
        .filter(p => p.status === "called")
        .map(transformToQueueItem)
        .sort((a, b) => {
          if (!a.calledAt) return 1;
          if (!b.calledAt) return -1;
          return b.calledAt.getTime() - a.calledAt.getTime();
        });
      return calledPatients[0] || null;
    })();

    const waiting = tvPatients
      .filter(p => p.status !== "completed" && p.status !== "called")
      .map(transformToQueueItem);

    const history: QueueItem[] = callLogRef.current
      .filter(entry => !current || entry.patientId !== current.id || entry.calledAt.getTime() !== current.calledAt?.getTime())
      .slice(0, 4)
      .map(entry => ({
        id: entry.logId,
        name: entry.name,
        number: "",
        room: entry.room,
        status: "completed" as const,
        timestamp: entry.calledAt,
        calledAt: entry.calledAt,
      }));

    return {
      currentPatient: current,
      queueWaiting: waiting,
      queueHistory: history,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvPatients, callLogVersion]);

  return {
    currentPatient,
    queueWaiting,
    queueHistory,
    isLoading,
    error: error as Error | null,
  };
}

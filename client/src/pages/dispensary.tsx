import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Pill, Star, RefreshCw } from "lucide-react";
import { PatientCard } from "@/components/patient-card";

interface Patient {
  id: string;
  name: string | null;
  number: number;
  status: string;
  isPriority: boolean;
  priorityReason?: string | null;
  readyForDispensary?: boolean;
  windowId?: string | null;
  lastWindowId?: string | null;
  registeredAt: string;
  calledAt?: string | null;
  completedAt?: string | null;
  requeueReason?: string | null;
  trackingHistory?: any[];
}

interface Window {
  id: string;
  name: string;
  isActive: boolean;
  isPermanent?: boolean;
  currentPatientId?: string | null;
}

interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
}

interface QueuePatient extends Patient {
  status: "waiting" | "called" | "in-progress" | "completed" | "requeue" | "dispensary";
  windowName?: string;
  lastWindowName?: string;
}

export default function Dispensary() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch active patients (excludes completed for lighter payloads)
  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients/active'],
  });

  // Fetch windows
  const { data: windows = [] } = useQuery<Window[]>({
    queryKey: ['/api/windows'],
  });

  // Fetch audio settings
  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ['/api/settings'],
  });

  // Get DISPENSARY window
  const dispensaryWindow = useMemo(() => {
    return windows.find(w => w.name === 'DISPENSARY' && w.isActive);
  }, [windows]);

  // Update patient status mutation
  const updatePatientStatusMutation = useMutation({
    mutationFn: async ({ patientId, status, windowId }: { patientId: string; status: string; windowId?: string }) => {
      const response = await apiRequest("PATCH", `/api/patients/${patientId}/status`, { status, windowId });
      return response.json();
    },
    onMutate: async ({ patientId, status, windowId }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/patients/active'] });
      await queryClient.cancelQueries({ queryKey: ['/api/windows'] });

      const previousPatients = queryClient.getQueryData(['/api/patients/active']);
      const previousWindows = queryClient.getQueryData(['/api/windows']);

      queryClient.setQueryData(['/api/patients/active'], (old: any) => {
        if (!old) return old;
        return old.map((patient: any) => 
          patient.id === patientId 
            ? { ...patient, status, windowId: windowId || patient.windowId, calledAt: status === 'called' ? new Date().toISOString() : patient.calledAt }
            : patient
        );
      });

      if (status === 'completed') {
        queryClient.setQueryData(['/api/windows'], (old: any) => {
          if (!old) return old;
          return old.map((window: any) => 
            window.currentPatientId === patientId 
              ? { ...window, currentPatientId: null }
              : window
          );
        });
      } else if (status === 'called' && windowId) {
        queryClient.setQueryData(['/api/windows'], (old: any) => {
          if (!old) return old;
          return old.map((window: any) => 
            window.id === windowId 
              ? { ...window, currentPatientId: patientId }
              : window.currentPatientId === patientId
              ? { ...window, currentPatientId: null }
              : window
          );
        });
      }

      return { previousPatients, previousWindows };
    },
    onError: (err, variables, context) => {
      if (context?.previousPatients) {
        queryClient.setQueryData(['/api/patients/active'], context.previousPatients);
      }
      if (context?.previousWindows) {
        queryClient.setQueryData(['/api/windows'], context.previousWindows);
      }
      toast({
        title: "Error",
        description: "Failed to update patient status. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/windows'] });
    },
  });

  // Delete patient mutation
  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/windows'] });
      toast({
        title: "Success",
        description: "Patient removed from queue",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/patients/active'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/windows'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/settings'] }),
      ]);
      toast({
        title: "Refreshed",
        description: "Data updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Enhanced patients with window names
  const enhancedPatients = useMemo((): QueuePatient[] => {
    return patients.map(patient => ({
      ...patient,
      status: patient.status as "waiting" | "called" | "in-progress" | "completed" | "requeue" | "dispensary",
      windowId: patient.windowId || undefined,
      windowName: patient.windowId ? windows.find(w => w.id === patient.windowId)?.name : undefined,
      lastWindowId: patient.lastWindowId || undefined,
      lastWindowName: patient.lastWindowId ? windows.find(w => w.id === patient.lastWindowId)?.name : undefined,
      trackingHistory: Array.isArray(patient.trackingHistory) ? patient.trackingHistory : undefined
    }));
  }, [patients, windows]);

  // Filter dispensary patients
  // Include: 1) readyForDispensary flag (waiting), 2) called/in-progress to DISPENSARY window
  // EXCLUDE: completed patients (even if readyForDispensary is true)
  const dispensaryPatients = enhancedPatients.filter(p => 
    p.status !== 'completed' && (
      p.readyForDispensary || 
      ((p.status === 'called' || p.status === 'in-progress') && p.windowName === 'DISPENSARY')
    )
  );
  const priorityDispensary = dispensaryPatients.filter(p => p.isPriority);
  const normalDispensary = dispensaryPatients.filter(p => !p.isPriority);

  // Handle call patient to dispensary
  const handleCallPatient = async (patientId: string) => {
    if (!dispensaryWindow) {
      toast({
        title: "Error",
        description: "DISPENSARY window is not active",
        variant: "destructive",
      });
      return;
    }

    await updatePatientStatusMutation.mutateAsync({
      patientId,
      status: "called",
      windowId: dispensaryWindow.id,
    });

    const patient = enhancedPatients.find(p => p.id === patientId);
    const callText = patient?.name || `Number ${patient?.number}`;
    
    const isAudioEnabled = settings.find(s => s.key === 'enable_audio')?.value === 'true';
    
    if (isAudioEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`${callText} to DISPENSARY`);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }

    toast({
      title: "Patient Called",
      description: `${callText} called to DISPENSARY`,
    });
  };

  // Handle complete patient
  const handleCompletePatient = async (patientId: string) => {
    await updatePatientStatusMutation.mutateAsync({
      patientId,
      status: "completed",
    });

    const patient = enhancedPatients.find(p => p.id === patientId);
    const patientName = patient?.name || `Number ${patient?.number}`;

    toast({
      title: "Patient Completed",
      description: `${patientName} has been completed`,
    });
  };

  // Handle delete patient
  const handleDeletePatient = async (patientId: string) => {
    await deletePatientMutation.mutateAsync(patientId);
  };

  // Handle call again
  const handleCallAgain = async (patientId: string) => {
    const patient = enhancedPatients.find(p => p.id === patientId);
    if (!patient || !patient.windowId) return;

    await updatePatientStatusMutation.mutateAsync({
      patientId,
      status: "called",
      windowId: patient.windowId
    });

    const callText = patient.name || `Number ${patient.number}`;
    
    const isAudioEnabled = settings.find(s => s.key === 'enable_audio')?.value === 'true';
    
    if (isAudioEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`${callText} to DISPENSARY`);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }

    toast({
      title: "Call Again",
      description: `${callText} recalled to DISPENSARY`,
    });
  };

  // Handle requeue patient
  const handleRequeue = async (patientId: string, reason?: string) => {
    await updatePatientStatusMutation.mutateAsync({
      patientId,
      status: "requeue",
    });

    const patient = enhancedPatients.find(p => p.id === patientId);
    const patientName = patient?.name || `Number ${patient?.number}`;

    toast({
      title: "Patient Requeued",
      description: `${patientName} returned to main queue${reason ? `: ${reason}` : ''}`,
    });
  };

  // Not used in dispensary
  const handleRecall = async () => {};

  if (patientsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!dispensaryWindow) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-destructive font-semibold">
              DISPENSARY window is not active. Please activate it in the Management page.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Dispensary Management
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Total: {dispensaryPatients.length} patients
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Priority Patients */}
      {priorityDispensary.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center text-yellow-600 dark:text-yellow-500">
            <Star className="h-5 w-5 mr-2 fill-current" />
            Priority Patients ({priorityDispensary.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityDispensary.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient as any}
                onCall={handleCallPatient}
                onCallAgain={handleCallAgain}
                onRecall={handleRecall}
                onDelete={handleDeletePatient}
                onComplete={handleCompletePatient}
                onRequeue={handleRequeue}
                disabled={updatePatientStatusMutation.isPending}
                selectedWindow={dispensaryWindow.id}
                showDeleteButton={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Normal Dispensary Patients */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Pill className="h-5 w-5 mr-2" />
          Waiting for Dispensary ({normalDispensary.length})
        </h2>
        {normalDispensary.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                No patients waiting for dispensary
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {normalDispensary.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient as any}
                onCall={handleCallPatient}
                onCallAgain={handleCallAgain}
                onRecall={handleRecall}
                onDelete={handleDeletePatient}
                onComplete={handleCompletePatient}
                onRequeue={handleRequeue}
                disabled={updatePatientStatusMutation.isPending}
                selectedWindow={dispensaryWindow.id}
                showDeleteButton={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

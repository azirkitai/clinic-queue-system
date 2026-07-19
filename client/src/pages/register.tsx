import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PatientRegistration } from "@/components/patient-registration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Users, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Patient } from "@shared/schema";

// Helper: Get today's date range for filtering
function getTodayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

// Helper: Filter patients registered today
function filterTodayPatients(patients: Patient[]) {
  const { today, tomorrow } = getTodayRange();
  return patients.filter(p => {
    const regDate = new Date(p.registeredAt);
    return regDate >= today && regDate < tomorrow;
  });
}

export default function Register() {
  const { toast } = useToast();

  // Fetch all patients (24-hour clinic operation)
  const { data: todayPatients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });

  // Fetch next patient number
  const { data: nextNumberData, isLoading: nextNumberLoading } = useQuery<{ nextNumber: number }>({
    queryKey: ['/api/patients/next-number'],
  });

  // Create patient mutation
  const createPatientMutation = useMutation({
    mutationFn: async (patientData: { name: string | null; number: number; isPriority?: boolean; priorityReason?: string; chiefComplaint?: string; groupId?: string | null; groupName?: string | null; isGroupLeader?: boolean }) => {
      const response = await apiRequest("POST", "/api/patients", patientData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients/next-number'] });
      
      toast({
        title: "Registration Success",
        description: "Patient has been registered to the system",
      });
    },
    onError: (error) => {
      console.error("Error registering patient:", error);
      toast({
        title: "Registration Error",
        description: "Failed to register patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate stats from today's patients (client-side filtering for 24-hour clinics)
  const todayStats = useMemo(() => {
    if (!todayPatients) {
      return {
        totalRegistered: 0
      };
    }

    const actualTodayPatients = filterTodayPatients(todayPatients);

    return {
      totalRegistered: actualTodayPatients.length
    };
  }, [todayPatients]);

  // Transform patients for recent list display (filter by today only)
  const recentPatients = useMemo(() => {
    if (!todayPatients) return [];
    
    const actualTodayPatients = filterTodayPatients(todayPatients);
    
    return actualTodayPatients
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 10)
      .map(patient => ({
        id: patient.id,
        name: patient.name,
        number: patient.number,
        chiefComplaint: patient.chiefComplaint,
        registeredAt: new Date(patient.registeredAt).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      }));
  }, [todayPatients]);

  // Derive available family groups from today's waiting patients
  const availableGroups = useMemo(() => {
    if (!todayPatients) return [];
    const actualTodayPatients = filterTodayPatients(todayPatients);
    // Find patients who are group leaders with groupId
    return actualTodayPatients
      .filter(p => p.isGroupLeader && p.groupId && p.status === "waiting")
      .map(p => ({
        id: p.groupId!,
        name: p.groupName || "Family Group",
        leaderName: p.name,
        leaderNumber: p.number
      }));
  }, [todayPatients]);

  const handleRegister = (patient: { name: string | null; number: number; type: "name" | "number"; isPriority?: boolean; priorityReason?: string; chiefComplaint?: string; groupId?: string | null; groupName?: string | null; isGroupLeader?: boolean }) => {
    console.log("Registering patient:", patient);
    createPatientMutation.mutate(patient);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Register</h1>
        <p className="text-muted-foreground">Register new patient to the system</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="lg:col-span-1">
          <PatientRegistration
            onRegister={handleRegister}
            nextNumber={nextNumberData?.nextNumber || 1}
            isRegistering={createPatientMutation.isPending}
            availableGroups={availableGroups}
          />
        </div>

        {/* Stats and Recent Patients */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Today's Statistics
            </h2>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Total Registered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="text-total-registered">
                  {todayStats.totalRegistered}
                </div>
                <p className="text-xs text-muted-foreground">patient(s)</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Registrations */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Registrations
            </h2>
            <Card>
              <CardContent className="p-0">
                {recentPatients.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No registrations today yet
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentPatients.map((patient) => (
                      <div 
                        key={patient.id} 
                        className="p-4 flex items-center hover:bg-muted/50"
                        data-testid={`recent-patient-${patient.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="text-lg font-bold text-primary">
                            #{patient.number.toString().padStart(3, '0')}
                          </div>
                          <div>
                            <div className="font-medium">
                              {patient.name || "Without Name"}
                            </div>
                            {patient.chiefComplaint && (
                              <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                                Reason: {patient.chiefComplaint}
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span>Cons. No: #{patient.number.toString().padStart(3, '0')}</span>
                              <span>·</span>
                              <span>{patient.registeredAt}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
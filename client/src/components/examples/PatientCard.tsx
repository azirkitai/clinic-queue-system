import { PatientCard } from '../patient-card';

export default function PatientCardExample() {
  // TODO: Remove mock functionality - replace with real patient data
  const mockPatient = {
    id: "patient-1",
    name: "Ahmad bin Rahman",
    number: 15,
    status: "waiting" as const,
    windowName: "Bilik 1 - Dr. Sarah",
    registeredAt: new Date("2025-01-01T09:15:00"),
    trackingHistory: [
      { timestamp: "2025-01-01T09:15:00", action: "registered" as const },
      { timestamp: "2025-01-01T09:16:00", action: "registered" as const }
    ]
  };

  const mockInProgressPatient = {
    id: "patient-2",
    name: null,
    number: 12,
    status: "in-progress" as const,
    windowName: "Bilik 2 - Dr. Ahmad",
    registeredAt: new Date("2025-01-01T08:45:00"),
    trackingHistory: [
      { timestamp: "2025-01-01T08:45:00", action: "registered" as const },
      { timestamp: "2025-01-01T09:30:00", action: "called" as const },
      { timestamp: "2025-01-01T09:35:00", action: "in-progress" as const }
    ]
  };

  const handleCall = (patientId: string) => {
    console.log(`Called patient: ${patientId}`);
  };

  const handleDelete = (patientId: string) => {
    console.log(`Deleted patient: ${patientId}`);
  };

  const handleComplete = (patientId: string) => {
    console.log(`Completed patient: ${patientId}`);
  };

  const handleRequeue = (patientId: string) => {
    console.log(`Requeued patient: ${patientId}`);
  };

  return (
    <div className="space-y-4 p-4">
      <PatientCard
        patient={mockPatient}
        onCall={handleCall}
        onCallAgain={handleCall}
        onRecall={handleCall}
        onDelete={handleDelete}
        onComplete={handleComplete}
        onRequeue={handleRequeue}
      />
      <PatientCard
        patient={mockInProgressPatient}
        onCall={handleCall}
        onCallAgain={handleCall}
        onRecall={handleCall}
        onDelete={handleDelete}
        onComplete={handleComplete}
        onRequeue={handleRequeue}
      />
    </div>
  );
}
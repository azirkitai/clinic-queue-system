import { TVDisplay } from '../tv-display';

export default function TVDisplayExample() {
  // TODO: Remove mock functionality - replace with real data
  const mockCurrentCall = {
    id: "1",
    name: "Ahmad bin Ali",
    number: "15",
    room: "Bilik 1 - Dr. Sarah",
    status: "calling" as const,
    timestamp: new Date(),
  };

  const mockHistory = [
    { id: "2", name: "", number: "14", room: "Bilik 2 - Dr. Ahmad", status: "completed" as const, timestamp: new Date() },
    { id: "3", name: "Siti Nurhaliza", number: "13", room: "Bilik 1 - Dr. Sarah", status: "completed" as const, timestamp: new Date() },
    { id: "4", name: "", number: "12", room: "Bilik 3 - Nurse Linda", status: "completed" as const, timestamp: new Date() },
  ];

  return (
    <TVDisplay
      currentPatient={mockCurrentCall}
      queueHistory={mockHistory}
      showPrayerTimes={true}
      showWeather={false}
    />
  );
}
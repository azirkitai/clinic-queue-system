import { useState, useEffect } from "react";
import { UserPlus, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface PatientRegistrationProps {
  onRegister: (patient: { name: string | null; number: number; type: "name" | "number"; isPriority?: boolean; priorityReason?: string; chiefComplaint?: string }) => void;
  nextNumber: number;
  isRegistering?: boolean;
}

export function PatientRegistration({ onRegister, nextNumber, isRegistering = false }: PatientRegistrationProps) {
  const [patientName, setPatientName] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [priorityReason, setPriorityReason] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [consultationNo, setConsultationNo] = useState(nextNumber.toString());

  // Sync when nextNumber prop changes (e.g. after registration)
  useEffect(() => {
    setConsultationNo(nextNumber.toString());
  }, [nextNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;

    try {
      const parsedNumber = parseInt(consultationNo.trim(), 10);
      const patientData = {
        name: patientName.trim() || null,
        number: isNaN(parsedNumber) || parsedNumber <= 0 ? nextNumber : parsedNumber,
        type: "name" as const,
        isPriority: isPriority,
        priorityReason: isPriority ? priorityReason.trim() : undefined,
        chiefComplaint: chiefComplaint.trim() || undefined
      };

      console.log("Registering patient:", patientData);
      await onRegister(patientData);

      // Reset form
      setPatientName("");
      setIsPriority(false);
      setPriorityReason("");
      setChiefComplaint("");
      
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Register Patient
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Cons. No Input */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-2">
            <Label htmlFor="consultationNo" className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Cons. No
            </Label>
            <Input
              id="consultationNo"
              type="number"
              value={consultationNo}
              onChange={(e) => setConsultationNo(e.target.value)}
              placeholder="Enter cons. no"
              min={1}
              data-testid="input-consultation-no"
              className="text-lg font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Name Input */}
          <div className="space-y-2">
            <Label htmlFor="patientName">Patient Name</Label>
            <Input
              id="patientName"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value.toUpperCase())}
              placeholder="Enter patient name"
              maxLength={100}
              data-testid="input-patient-name"
            />
          </div>

          {/* Priority Checkbox - Only show when name is entered */}
          {patientName.trim() && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <Checkbox
                id="priority"
                checked={isPriority}
                onCheckedChange={(checked) => setIsPriority(checked === true)}
                data-testid="checkbox-priority"
              />
              <Label
                htmlFor="priority"
                className="text-sm font-medium text-yellow-700 dark:text-yellow-300 cursor-pointer flex items-center"
              >
                <Star className="h-4 w-4 mr-1 fill-current" />
                Priority Patient
              </Label>
            </div>
          )}

          {/* Chief Complaint Input */}
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint">Chief Complaint</Label>
            <Textarea
              id="chiefComplaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value.toUpperCase())}
              placeholder="Enter chief complaint (e.g., DEMAM, BATUK, SAKIT PERUT, UBATAN)"
              maxLength={100}
              rows={2}
              data-testid="input-chief-complaint"
            />
          </div>

          {/* Priority Reason Input - Only show when priority is checked */}
          {isPriority && (
            <div className="space-y-2">
              <Label htmlFor="priorityReason">Priority Reason</Label>
              <Textarea
                id="priorityReason"
                value={priorityReason}
                onChange={(e) => setPriorityReason(e.target.value.toUpperCase())}
                placeholder="Enter reason for priority (e.g., EMERGENCY, ELDERLY, PREGNANT)"
                maxLength={100}
                rows={3}
                data-testid="input-priority-reason"
              />
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isRegistering || !patientName.trim() || (isPriority && !priorityReason.trim())}
            className="w-full"
            data-testid="button-register-patient"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {isRegistering ? "Registering..." : "Register Patient"}
          </Button>
        </form>

        {/* Information Box */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p>
            <strong>Guide:</strong>
          </p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Enter patient full name to register</li>
            <li>TV display & voice will use short name (before BIN/BINTI/A/P/A/L)</li>
            <li>Names starting with B/O will be announced as "Baby of..."</li>
            <li>Each patient will automatically get a queue number</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
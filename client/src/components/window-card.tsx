import { useState, useEffect } from "react";
import { Edit, Trash2, User, UserCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Window {
  id: string;
  name: string;
  isActive: boolean;
  isPermanent?: boolean;
  currentPatientId?: string;
  currentPatientName?: string;
  currentPatientNumber?: number;
}

interface WindowCardProps {
  window: Window;
  onEdit: (windowId: string, newName: string) => void;
  onDelete: (windowId: string) => void;
  onToggleStatus: (windowId: string) => void;
  onForceClear?: (windowId: string) => void;
}

export function WindowCard({ 
  window, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  onForceClear
}: WindowCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(window.name);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-reset delete confirmation after 5 seconds using useEffect
  useEffect(() => {
    if (isDeleting) {
      const timer = setTimeout(() => {
        setIsDeleting(false);
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isDeleting, window.id]);

  // Update editName when window name changes from database
  useEffect(() => {
    if (!isEditing) {
      setEditName(window.name);
    }
  }, [window.name, isEditing]);

  const handleEdit = () => {
    if (isEditing) {
      if (editName.trim() && editName.trim() !== window.name) {
        onEdit(window.id, editName.trim());
      }
      setIsEditing(false);
    } else {
      setIsEditing(true);
      setEditName(window.name);
    }
  };

  const handleSave = () => {
    if (editName.trim() && editName.trim() !== window.name) {
      onEdit(window.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (isDeleting) {
      onDelete(window.id);
      setIsDeleting(false);
    } else {
      setIsDeleting(true);
    }
  };

  const handleToggleStatus = () => {
    onToggleStatus(window.id);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(window.name);
    }
  };

  return (
    <Card className="w-full hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={handleSave}
                autoFocus
                className="font-medium"
                data-testid={`input-edit-window-${window.id}`}
              />
            ) : (
              <div 
                className="text-lg font-medium flex-1"
                data-testid={`text-window-name-${window.id}`}
              >
                {window.name}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={window.isActive ? "default" : "secondary"}
              data-testid={`badge-status-${window.id}`}
            >
              {window.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Current Patient Info */}
        {window.currentPatientId && window.isActive ? (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center text-green-700 dark:text-green-300">
              <UserCheck className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Currently Serving:</span>
            </div>
            <div 
              className="mt-1 font-semibold text-green-800 dark:text-green-200"
              data-testid={`text-current-patient-${window.id}`}
            >
              {window.currentPatientName || `No. ${window.currentPatientNumber}`}
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-gray-500">
              <User className="h-4 w-4 mr-2" />
              <span className="text-sm">No patient</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleEdit}
            size="sm"
            variant="outline"
            className="flex-1"
            data-testid={`button-edit-${window.id}`}
          >
            <Edit className="h-4 w-4 mr-1" />
            {isEditing ? "Save" : "Edit"}
          </Button>

          <Button
            onClick={handleToggleStatus}
            size="sm"
            variant={window.isActive ? "secondary" : "default"}
            className="flex-1"
            data-testid={`button-toggle-${window.id}`}
          >
            {window.isActive ? "Deactivate" : "Activate"}
          </Button>

          <Button
            onClick={handleDelete}
            size="sm"
            variant={isDeleting ? "destructive" : "outline"}
            disabled={!!window.currentPatientId || !!window.isPermanent}
            data-testid={`button-delete-${window.id}`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isDeleting ? "Confirm" : "Delete"}
          </Button>
        </div>

        {window.currentPatientId && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Cannot delete while serving a patient
            </div>
            {onForceClear && (
              <Button
                onClick={() => onForceClear(window.id)}
                size="sm"
                variant="outline"
                className="text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-700"
                data-testid={`button-force-clear-${window.id}`}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Force Clear
              </Button>
            )}
          </div>
        )}
        
        {window.isPermanent && (
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            Permanent room cannot be deleted
          </div>
        )}
      </CardContent>
    </Card>
  );
}
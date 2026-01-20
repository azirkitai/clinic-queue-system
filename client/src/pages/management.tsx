import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { WindowCard } from "@/components/window-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Window {
  id: string;
  name: string;
  isActive: boolean;
  isPermanent?: boolean;
  currentPatientId?: string;
  currentPatientName?: string;
  currentPatientNumber?: number;
}

export default function Management() {
  const [newWindowName, setNewWindowName] = useState("");
  const { toast } = useToast();

  // Fetch windows data
  const { data: windows = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/windows"],
    queryFn: async () => {
      const res = await fetch("/api/windows");
      const data = await res.json();
      // Handle auth errors - return empty array if not authenticated
      if (!res.ok || data?.error) return [];
      return data as Window[];
    }
  });

  // Create window mutation
  const createWindowMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/windows", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/windows"] });
      setNewWindowName("");
      toast({
        title: "Room successfully added",
        description: "New room has been registered in the system."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add room.",
        variant: "destructive"
      });
    }
  });

  const handleAddWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWindowName.trim()) return;
    
    createWindowMutation.mutate(newWindowName.trim());
  };

  // Update window mutation
  const updateWindowMutation = useMutation({
    mutationFn: async ({ windowId, name }: { windowId: string; name: string }) => {
      return await apiRequest("PUT", `/api/windows/${windowId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/windows"] });
      toast({
        title: "Room successfully updated",
        description: "Room information has been saved."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update room.",
        variant: "destructive"
      });
    }
  });

  const handleEditWindow = async (windowId: string, newName: string) => {
    updateWindowMutation.mutate({ windowId, name: newName });
  };

  // Delete window mutation
  const deleteWindowMutation = useMutation({
    mutationFn: async (windowId: string) => {
      return await apiRequest("DELETE", `/api/windows/${windowId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/windows"] });
      toast({
        title: "Room successfully deleted",
        description: "Room has been removed from system."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete room.",
        variant: "destructive"
      });
    }
  });

  const handleDeleteWindow = async (windowId: string) => {
    deleteWindowMutation.mutate(windowId);
  };

  // Toggle window status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (windowId: string) => {
      return await apiRequest("PATCH", `/api/windows/${windowId}/status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/windows"] });
      toast({
        title: "Room status updated",
        description: "Room active status has been changed."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change room status.",
        variant: "destructive"
      });
    }
  });

  const handleToggleStatus = async (windowId: string) => {
    toggleStatusMutation.mutate(windowId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Management</h1>
        <p className="text-muted-foreground">Manage treatment rooms and window settings</p>
      </div>

      {/* Add New Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add New Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddWindow} className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="windowName" className="sr-only">
                Room Name
              </Label>
              <Input
                id="windowName"
                type="text"
                value={newWindowName}
                onChange={(e) => setNewWindowName(e.target.value)}
                placeholder="Enter room name (e.g.: Room 6 - Dr. Ahmad)"
                data-testid="input-new-window-name"
              />
            </div>
            <Button
              type="submit"
              disabled={createWindowMutation.isPending || !newWindowName.trim()}
              data-testid="button-add-window"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createWindowMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Windows List */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Room List ({windows.length})
        </h2>
        
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                Loading room data...
              </div>
            </CardContent>
          </Card>
        ) : windows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                No rooms registered yet
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {windows.map((window) => (
              <WindowCard
                key={window.id}
                window={window}
                onEdit={handleEditWindow}
                onDelete={handleDeleteWindow}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-windows">
              {windows.length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-windows">
              {windows.filter(w => w.isActive).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Use</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-occupied-windows">
              {windows.filter(w => w.currentPatientId).length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, UserPlus, Trash2, Edit, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, InsertUser } from "@shared/schema";

export default function Administration() {
  const { toast } = useToast();
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "user" as "admin" | "user"
  });
  const [editingUser, setEditingUser] = useState<string | null>(null);

  // Real admin check would require authentication system
  const isCurrentUserAdmin = true; // Implement proper auth check

  // Fetch users from database
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setNewUser({ username: "", password: "", role: "user" });
      toast({
        title: "Pengguna Berjaya Ditambah",
        description: "Pengguna baru telah didaftarkan ke dalam sistem",
      });
    },
    onError: (error) => {
      console.error("Error creating user:", error);
      toast({
        title: "Ralat Pendaftaran",
        description: "Gagal menambah pengguna. Sila cuba semula.",
        variant: "destructive",
      });
    },
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast({
        title: "Ralat Validasi",
        description: "Sila lengkapkan semua maklumat",
        variant: "destructive",
      });
      return;
    }

    if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      toast({
        title: "Ralat Validasi",
        description: "Username sudah wujud",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      username: newUser.username.trim(),
      password: newUser.password.trim(),
      role: newUser.role
    });
  };

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/status`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Status Dikemaskini",
        description: "Status pengguna telah berjaya dikemaskini",
      });
    },
    onError: (error) => {
      console.error("Error toggling user status:", error);
      toast({
        title: "Ralat",
        description: "Gagal mengemaskini status pengguna",
        variant: "destructive",
      });
    },
  });

  const handleToggleUserStatus = (userId: string) => {
    toggleUserStatusMutation.mutate(userId);
  };

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Pengguna Dipadam",
        description: "Pengguna telah berjaya dipadam dari sistem",
      });
    },
    onError: (error) => {
      console.error("Error deleting user:", error);
      toast({
        title: "Ralat",
        description: "Gagal memadam pengguna",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId: string) => {
    if (!confirm("Adakah anda pasti ingin memadam pengguna ini?")) {
      return;
    }
    deleteUserMutation.mutate(userId);
  };

  if (!isCurrentUserAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Anda tidak mempunyai kebenaran untuk mengakses halaman ini.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        <p className="text-muted-foreground">Urus pengguna dan kebenaran sistem</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add New User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="h-5 w-5 mr-2" />
              Tambah Pengguna
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Masukkan username"
                  required
                  data-testid="input-new-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Masukkan password"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(value: "admin" | "user") => setNewUser(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="w-full"
                data-testid="button-add-user"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {createUserMutation.isPending ? "Menambah..." : "Tambah Pengguna"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Senarai Pengguna ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Tiada pengguna didaftarkan
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`user-card-${user.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium" data-testid={`text-username-${user.id}`}>
                            {user.username}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.lastLogin ? `Last login: ${user.lastLogin}` : "Never logged in"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={user.role === "admin" ? "default" : "secondary"}
                          data-testid={`badge-role-${user.id}`}
                        >
                          {user.role}
                        </Badge>
                        <Badge 
                          variant={user.isActive ? "default" : "outline"}
                          data-testid={`badge-status-${user.id}`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleUserStatus(user.id)}
                          data-testid={`button-toggle-${user.id}`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.role === "admin" && user.username === "admin"}
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {users.length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-users">
              {users.filter(u => u.isActive).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-admin-users">
              {users.filter(u => u.role === "admin").length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="text-regular-users">
              {users.filter(u => u.role === "user").length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import {
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
  ClipboardList,
  UserCog,
  Shield,
  LogOut,
  Pill,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import logoImage from "@assets/EZTURN (1)_1759062234605.png";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainNavigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Patient Register",
    url: "/register",
    icon: UserPlus,
  },
  {
    title: "Queue Management",
    url: "/queue",
    icon: ClipboardList,
  },
  {
    title: "Dispensary Management",
    url: "/dispensary",
    icon: Pill,
  },
];

const administrationItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Account Settings",
    url: "/account",
    icon: UserCog,
  },
  {
    title: "System Management",
    url: "/management",
    icon: Users,
  },
  {
    title: "User Management",
    url: "/administration",
    icon: Shield,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout Successful",
        description: "You have successfully logged out from the system.",
      });
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "There was a problem during logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar 
      className="border-r-0 sidebar-gradient-bg" 
      style={{ 
        background: 'var(--sidebar-gradient) !important',
        backgroundImage: 'var(--sidebar-gradient) !important'
      }}
    >
      {/* Branding Header */}
      <div 
        className="p-8 border-b border-sidebar-border/20"
        style={{
          background: 'transparent',
          backgroundColor: 'transparent'
        }}
      >
        <div className="flex justify-center items-center">
          <img 
            src={logoImage} 
            alt="QueTAMA System" 
            className="h-32 w-auto object-contain max-w-full"
            style={{ filter: 'brightness(1.1)' }}
          />
        </div>
      </div>

      <SidebarContent 
        className="px-4 py-6"
        style={{ 
          background: 'transparent' 
        }}
      >
        {/* Main Navigation Section */}
        <div>
          <div className="sidebar-section-header">MAIN NAVIGATION</div>
          <SidebarMenu className="space-y-1">
            {mainNavigationItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={location === item.url}
                  data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="sidebar-nav-item"
                  data-active={location === item.url}
                >
                  <Link href={item.url}>
                    <item.icon className="w-5 h-5" />
                    <span className="sidebar-nav-text">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* Administration Section */}
        <div className="mt-8">
          <div className="sidebar-section-header">ADMINISTRATION</div>
          <SidebarMenu className="space-y-1">
            {administrationItems.map((item) => {
              // Only show User Management for admin users
              if (item.title === "User Management" && user?.role !== "admin") {
                return null;
              }
              
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    className="sidebar-nav-item"
                    data-active={location === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-5 h-5" />
                      <span className="sidebar-nav-text">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter 
        className="px-4 py-4 border-t border-sidebar-border/20"
        style={{
          background: 'transparent',
          backgroundColor: 'transparent'
        }}
      >
        {/* User Information */}
        {user && (
          <div className="mb-4 p-3 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/30">
            <div className="text-sidebar-foreground/90 text-sm font-medium">
              {user.username}
            </div>
            <div className="text-sidebar-foreground/60 text-xs">
              {user.role === 'admin' ? 'Administrator' : 'User'}
            </div>
            {user.clinicName && (
              <div className="text-sidebar-foreground/60 text-xs mt-1">
                {user.clinicName}
              </div>
            )}
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              data-testid="button-logout"
              className="sidebar-nav-item text-red-400 hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* Footer Branding */}
        <div className="mt-4 text-center">
          <p className="text-sidebar-foreground/40 text-xs">
            KlinikHR Designed by Sir.S
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
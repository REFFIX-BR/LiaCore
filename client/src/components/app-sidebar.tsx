import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Database, 
  Settings,
  Brain,
  Activity,
  Monitor as MonitorIcon,
  TestTube2
} from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Monitor Supervisor",
    url: "/monitor",
    icon: MonitorIcon,
  },
  {
    title: "Test Chat",
    url: "/test-chat",
    icon: TestTube2,
  },
  {
    title: "Conversas",
    url: "/conversations",
    icon: MessageSquare,
  },
  {
    title: "Base de Conhecimento",
    url: "/knowledge",
    icon: Database,
  },
  {
    title: "Assistentes",
    url: "/assistants",
    icon: Brain,
  },
  {
    title: "Métricas",
    url: "/metrics",
    icon: Activity,
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-base">LIA CORTEX</h2>
            <p className="text-xs text-muted-foreground">AI Orchestrator</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-chart-2" />
          Sistema Online
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

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
  TestTube2,
  TrendingUp,
  Wifi,
  Star,
  Users as UsersIcon,
  UserCog
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SUPERVISOR", "AGENT"], // Todos veem dashboard
  },
  {
    title: "Monitor Supervisor",
    url: "/monitor",
    icon: MonitorIcon,
    roles: ["ADMIN", "SUPERVISOR"], // Gerenciamento
  },
  {
    title: "Dashboard de Atendentes",
    url: "/agent-monitor",
    icon: UserCog,
    roles: ["ADMIN", "SUPERVISOR"], // Supervisão de atendentes
  },
  {
    title: "Monitor Webhook",
    url: "/webhook-monitor",
    icon: Wifi,
    roles: ["ADMIN"], // Apenas Admin
  },
  {
    title: "Test Chat",
    url: "/test-chat",
    icon: TestTube2,
    roles: ["ADMIN", "SUPERVISOR"], // Testes gerenciais
  },
  {
    title: "Conversas",
    url: "/conversations",
    icon: MessageSquare,
    roles: ["ADMIN", "SUPERVISOR", "AGENT"], // Todos veem conversas
  },
  {
    title: "Base de Conhecimento",
    url: "/knowledge",
    icon: Database,
    roles: ["ADMIN", "SUPERVISOR"], // Admin e Supervisor gerenciam
  },
  {
    title: "Evolução dos Agentes",
    url: "/evolution",
    icon: TrendingUp,
    roles: ["ADMIN", "SUPERVISOR"], // Curadoria de IA
  },
  {
    title: "Assistentes",
    url: "/assistants",
    icon: Brain,
    roles: ["ADMIN", "SUPERVISOR"], // Configuração de IA
  },
  {
    title: "Métricas",
    url: "/metrics",
    icon: Activity,
    roles: ["ADMIN", "SUPERVISOR"], // Visão gerencial
  },
  {
    title: "Feedbacks NPS",
    url: "/feedbacks",
    icon: Star,
    roles: ["ADMIN", "SUPERVISOR"], // Análise de satisfação
  },
  {
    title: "Usuários",
    url: "/users",
    icon: UsersIcon,
    roles: ["ADMIN"], // Apenas Admin gerencia usuários
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
    roles: ["ADMIN"], // Apenas Admin gerencia configurações
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter((item) => 
    user && item.roles.includes(user.role)
  );

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
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
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

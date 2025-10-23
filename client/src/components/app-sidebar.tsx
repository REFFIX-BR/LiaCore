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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
  UserCog,
  FileText,
  ChevronRight,
  Eye,
  MessagesSquare,
  Lightbulb,
  BarChart3,
  Cog,
  UserPlus,
  History,
  AlertTriangle,
  Contact,
  ShoppingBag,
  ShoppingCart
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  roles: string[];
}

interface MenuCategory {
  title: string;
  icon: any;
  roles: string[];
  items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
  {
    title: "Visão Geral",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SUPERVISOR", "AGENT"],
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        roles: ["ADMIN", "SUPERVISOR", "AGENT"],
      },
    ],
  },
  {
    title: "Monitoramento",
    icon: Eye,
    roles: ["ADMIN", "SUPERVISOR"],
    items: [
      {
        title: "Monitor Supervisor",
        url: "/monitor",
        icon: MonitorIcon,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Dashboard de Atendentes",
        url: "/agent-monitor",
        icon: UserCog,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Relatórios de Atendentes",
        url: "/agent-reports",
        icon: FileText,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Logs de Atividade",
        url: "/activity-logs",
        icon: History,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Monitor Webhook",
        url: "/webhook-monitor",
        icon: Wifi,
        roles: ["ADMIN"],
      },
      {
        title: "Logs em Tempo Real",
        url: "/live-logs",
        icon: Activity,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Logs dos Agentes IA",
        url: "/agent-logs",
        icon: Brain,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
  {
    title: "Conversas",
    icon: MessagesSquare,
    roles: ["ADMIN", "SUPERVISOR", "AGENT"],
    items: [
      {
        title: "Test Chat",
        url: "/test-chat",
        icon: TestTube2,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Conversas",
        url: "/conversations",
        icon: MessageSquare,
        roles: ["ADMIN", "SUPERVISOR", "AGENT"],
      },
      {
        title: "Contatos",
        url: "/contacts",
        icon: Contact,
        roles: ["ADMIN", "SUPERVISOR", "AGENT"],
      },
      {
        title: "Grupos WhatsApp",
        url: "/groups",
        icon: UsersIcon,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
  {
    title: "Conhecimento & IA",
    icon: Lightbulb,
    roles: ["ADMIN", "SUPERVISOR"],
    items: [
      {
        title: "Base de Conhecimento",
        url: "/knowledge",
        icon: Database,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Evolução dos Agentes",
        url: "/evolution",
        icon: TrendingUp,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Assistentes",
        url: "/assistants",
        icon: Brain,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
  {
    title: "Análises",
    icon: BarChart3,
    roles: ["ADMIN", "SUPERVISOR"],
    items: [
      {
        title: "Métricas",
        url: "/metrics",
        icon: Activity,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Feedbacks NPS",
        url: "/feedbacks",
        icon: Star,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Ouvidoria",
        url: "/ouvidoria",
        icon: AlertTriangle,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
  {
    title: "Vendas",
    icon: ShoppingBag,
    roles: ["ADMIN", "SUPERVISOR"],
    items: [
      {
        title: "Gestão de Vendas",
        url: "/vendas",
        icon: ShoppingCart,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
  {
    title: "Administração",
    icon: Cog,
    roles: ["ADMIN", "SUPERVISOR"],
    items: [
      {
        title: "Usuários",
        url: "/users",
        icon: UsersIcon,
        roles: ["ADMIN"],
      },
      {
        title: "Solicitações de Registro",
        url: "/registration-requests",
        icon: UserPlus,
        roles: ["ADMIN", "SUPERVISOR"],
      },
      {
        title: "Configurações",
        url: "/settings",
        icon: Settings,
        roles: ["ADMIN", "SUPERVISOR"],
      },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Load initial state from localStorage or use defaults
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem("sidebar-categories-state");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { "Visão Geral": true };
      }
    }
    return { "Visão Geral": true }; // Dashboard sempre aberto por padrão
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("sidebar-categories-state", JSON.stringify(openCategories));
  }, [openCategories]);

  // Helper function to check if user has access to sales
  const hasAccessToSales = (user: any) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPERVISOR") return true;
    if (user.role === "AGENT" && user.departments?.includes("commercial")) return true;
    return false;
  };

  // Filter categories and items based on user role
  const visibleCategories = menuCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (!user) return false;
        
        // Special handling for sales items
        if (item.url === "/vendas") {
          return hasAccessToSales(user);
        }
        
        return item.roles.includes(user.role);
      }),
    }))
    .filter((category) => {
      if (!user) return false;
      
      // Special handling for sales category
      if (category.title === "Vendas") {
        return hasAccessToSales(user) && category.items.length > 0;
      }
      
      return category.roles.includes(user.role) && category.items.length > 0;
    });

  const toggleCategory = (categoryTitle: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryTitle]: !prev[categoryTitle],
    }));
  };

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
              {visibleCategories.map((category) => (
                <Collapsible
                  key={category.title}
                  open={openCategories[category.title]}
                  onOpenChange={() => toggleCategory(category.title)}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="w-full"
                        data-testid={`category-${category.title.toLowerCase()}`}
                      >
                        <category.icon className="h-4 w-4" />
                        <span>{category.title}</span>
                        <ChevronRight
                          className={`ml-auto h-4 w-4 transition-transform duration-200 ${
                            openCategories[category.title] ? "rotate-90" : ""
                          }`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {category.items.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === item.url}
                              data-testid={`nav-${item.title.toLowerCase()}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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

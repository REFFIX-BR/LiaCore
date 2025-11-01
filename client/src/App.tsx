import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { UserMenu } from "@/components/UserMenu";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import Knowledge from "@/pages/Knowledge";
import Monitor from "@/pages/Monitor";
import AgentMonitor from "@/pages/AgentMonitor";
import WebhookMonitor from "@/pages/WebhookMonitor";
import TestChat from "@/pages/TestChat";
import AgentEvolution from "@/pages/AgentEvolution";
import Settings from "@/pages/Settings";
import Assistants from "@/pages/Assistants";
import Metrics from "@/pages/Metrics";
import Feedbacks from "@/pages/Feedbacks";
import Users from "@/pages/Users";
import AgentReports from "@/pages/AgentReports";
import RegistrationRequests from "@/pages/RegistrationRequests";
import ActivityLogs from "@/pages/ActivityLogs";
import Ouvidoria from "@/pages/Ouvidoria";
import Contacts from "@/pages/Contacts";
import Groups from "@/pages/Groups";
import LiveLogs from "@/pages/LiveLogs";
import AgentLogs from "@/pages/AgentLogs";
import Vendas from "@/pages/vendas";
import FalhasMassivas from "@/pages/FalhasMassivas";
import Regioes from "@/pages/Regioes";
import Anuncios from "@/pages/Anuncios";
import PromptManagement from "@/pages/PromptManagement";
import ContextQuality from "@/pages/ContextQuality";
import Gamification from "@/pages/Gamification";
import GamificationSettings from "@/pages/GamificationSettings";
import { useEffect } from "react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function AdminSupervisorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">Acesso Negado</p>
          <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function SalesRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user) {
      // Verificar se o usuário tem permissão
      const hasAccess = 
        user.role === "ADMIN" || 
        user.role === "SUPERVISOR" || 
        (user.role === "AGENT" && user.departments?.includes("commercial"));
      
      if (!hasAccess) {
        setLocation("/");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  // Verificar permissão de acesso
  const hasAccess = 
    user.role === "ADMIN" || 
    user.role === "SUPERVISOR" || 
    (user.role === "AGENT" && user.departments?.includes("commercial"));

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">Acesso Negado</p>
          <p className="text-sm text-muted-foreground">
            Você precisa ter o departamento "Comercial" para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/monitor">
        {() => <ProtectedRoute component={Monitor} />}
      </Route>
      <Route path="/agent-monitor">
        {() => <ProtectedRoute component={AgentMonitor} />}
      </Route>
      <Route path="/agent-reports">
        {() => <ProtectedRoute component={AgentReports} />}
      </Route>
      <Route path="/webhook-monitor">
        {() => <ProtectedRoute component={WebhookMonitor} />}
      </Route>
      <Route path="/live-logs">
        {() => <ProtectedRoute component={LiveLogs} />}
      </Route>
      <Route path="/agent-logs">
        {() => <ProtectedRoute component={AgentLogs} />}
      </Route>
      <Route path="/test-chat">
        {() => <ProtectedRoute component={TestChat} />}
      </Route>
      <Route path="/conversations">
        {() => <ProtectedRoute component={Conversations} />}
      </Route>
      <Route path="/knowledge">
        {() => <ProtectedRoute component={Knowledge} />}
      </Route>
      <Route path="/prompts">
        {() => <AdminSupervisorRoute component={PromptManagement} />}
      </Route>
      <Route path="/evolution">
        {() => <ProtectedRoute component={AgentEvolution} />}
      </Route>
      <Route path="/gamification">
        {() => <ProtectedRoute component={Gamification} />}
      </Route>
      <Route path="/gamification/settings">
        {() => <AdminSupervisorRoute component={GamificationSettings} />}
      </Route>
      <Route path="/assistants">
        {() => <ProtectedRoute component={Assistants} />}
      </Route>
      <Route path="/metrics">
        {() => <ProtectedRoute component={Metrics} />}
      </Route>
      <Route path="/feedbacks">
        {() => <ProtectedRoute component={Feedbacks} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={Users} />}
      </Route>
      <Route path="/registration-requests">
        {() => <ProtectedRoute component={RegistrationRequests} />}
      </Route>
      <Route path="/activity-logs">
        {() => <ProtectedRoute component={ActivityLogs} />}
      </Route>
      <Route path="/ouvidoria">
        {() => <AdminSupervisorRoute component={Ouvidoria} />}
      </Route>
      <Route path="/context-quality">
        {() => <AdminSupervisorRoute component={ContextQuality} />}
      </Route>
      <Route path="/vendas">
        {() => <SalesRoute component={Vendas} />}
      </Route>
      <Route path="/contacts">
        {() => <ProtectedRoute component={Contacts} />}
      </Route>
      <Route path="/groups">
        {() => <ProtectedRoute component={Groups} />}
      </Route>
      <Route path="/grupos">
        {() => <ProtectedRoute component={Groups} />}
      </Route>
      <Route path="/falhas-massivas">
        {() => <AdminSupervisorRoute component={FalhasMassivas} />}
      </Route>
      <Route path="/regioes">
        {() => <AdminSupervisorRoute component={Regioes} />}
      </Route>
      <Route path="/anuncios">
        {() => <AdminSupervisorRoute component={Anuncios} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // If on login page, don't show sidebar
  if (location === "/login") {
    return <Router />;
  }

  // If not logged in, show only router (will redirect to login)
  if (!user) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative">
          {/* Banner de anúncios no topo */}
          <AnnouncementBanner />
          
          {/* Header sobreposto ao banner */}
          <header className="absolute top-1 left-1 right-1 z-50 flex items-center justify-between">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="mr-2" />
            <UserMenu />
          </header>
          
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

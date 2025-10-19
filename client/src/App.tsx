import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
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
      <Route path="/evolution">
        {() => <ProtectedRoute component={AgentEvolution} />}
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
      <Route path="/vendas">
        {() => <AdminSupervisorRoute component={Vendas} />}
      </Route>
      <Route path="/contacts">
        {() => <ProtectedRoute component={Contacts} />}
      </Route>
      <Route path="/groups">
        {() => <ProtectedRoute component={Groups} />}
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
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.fullName} (
                {user.role === "ADMIN" ? "Administrador" : user.role === "SUPERVISOR" ? "Supervisor" : "Atendente"}
                )
              </span>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
                    data-testid="button-logout"
                    aria-label="Sair"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sair</p>
                </TooltipContent>
              </Tooltip>
            </div>
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

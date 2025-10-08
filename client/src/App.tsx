import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import Knowledge from "@/pages/Knowledge";
import Monitor from "@/pages/Monitor";
import WebhookMonitor from "@/pages/WebhookMonitor";
import TestChat from "@/pages/TestChat";
import AgentEvolution from "@/pages/AgentEvolution";
import Settings from "@/pages/Settings";
import Assistants from "@/pages/Assistants";
import Metrics from "@/pages/Metrics";
import Feedbacks from "@/pages/Feedbacks";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/monitor" component={Monitor} />
      <Route path="/webhook-monitor" component={WebhookMonitor} />
      <Route path="/test-chat" component={TestChat} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/knowledge" component={Knowledge} />
      <Route path="/evolution" component={AgentEvolution} />
      <Route path="/assistants" component={Assistants} />
      <Route path="/metrics" component={Metrics} />
      <Route path="/feedbacks" component={Feedbacks} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

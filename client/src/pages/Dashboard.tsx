import { useAuth } from "@/lib/auth-context";
import { AgentDashboard } from "@/components/dashboards/AgentDashboard";
import { SupervisorDashboard } from "@/components/dashboards/SupervisorDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  // Render appropriate dashboard based on user role
  if (user?.role === "AGENT") {
    return <AgentDashboard />;
  }

  if (user?.role === "SUPERVISOR") {
    return <SupervisorDashboard />;
  }

  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  // Fallback (should not happen if user is authenticated)
  return (
    <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">Carregando dashboard...</p>
    </div>
  );
}

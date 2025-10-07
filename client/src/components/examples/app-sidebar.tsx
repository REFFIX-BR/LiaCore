import { AppSidebar } from '../app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AppSidebarExample() {
  return (
    <SidebarProvider>
      <div className="flex h-96">
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, History } from "lucide-react";
import ActiveFailuresTab from "@/components/failures/ActiveFailuresTab";
import ScheduledFailuresTab from "@/components/failures/ScheduledFailuresTab";
import HistoryFailuresTab from "@/components/failures/HistoryFailuresTab";

export default function FalhasMassivas() {
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b px-6 pt-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold" data-testid="text-falhas-title">Falhas Massivas</h1>
            <p className="text-muted-foreground" data-testid="text-falhas-subtitle">
              Gerencie interrupções de serviço e notifique clientes afetados automaticamente
            </p>
          </div>
          
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-4">
            <TabsTrigger 
              value="active" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-active"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Ativas
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-scheduled"
            >
              <Clock className="h-4 w-4 mr-2" />
              Agendadas
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-history"
            >
              <History className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="active" className="h-full m-0">
            <ActiveFailuresTab />
          </TabsContent>

          <TabsContent value="scheduled" className="h-full m-0">
            <ScheduledFailuresTab />
          </TabsContent>

          <TabsContent value="history" className="h-full m-0">
            <HistoryFailuresTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

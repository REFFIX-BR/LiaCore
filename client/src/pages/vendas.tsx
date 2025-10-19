import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Package } from "lucide-react";
import SalesTab from "@/components/sales/SalesTab";
import PlansTab from "@/components/sales/PlansTab";

export default function Vendas() {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        {/* Header with Tabs */}
        <div className="border-b px-6 pt-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold" data-testid="text-vendas-title">Gestão Comercial</h1>
            <p className="text-muted-foreground" data-testid="text-vendas-subtitle">
              Gerencie vendas e configure os planos disponíveis
            </p>
          </div>
          
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-4">
            <TabsTrigger 
              value="sales" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-vendas"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Vendas
            </TabsTrigger>
            <TabsTrigger 
              value="plans" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-planos"
            >
              <Package className="h-4 w-4 mr-2" />
              Planos e Serviços
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="sales" className="h-full m-0">
            <SalesTab />
          </TabsContent>

          <TabsContent value="plans" className="h-full m-0">
            <PlansTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

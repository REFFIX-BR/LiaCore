import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, UserPlus, BarChart3, Calendar, X } from "lucide-react";
import SalesTab from "@/components/sales/SalesTab";
import PlansTab from "@/components/sales/PlansTab";
import LeadsTab from "@/components/sales/LeadsTab";
import SalesDashboard from "@/components/sales/SalesDashboard";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function Vendas() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const today = new Date();
  const defaultStartDate = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultEndDate = format(endOfMonth(today), "yyyy-MM-dd");
  
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleThisMonth = () => {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        {/* Header with Tabs */}
        <div className="border-b px-6 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-vendas-title">Gestão Comercial</h1>
              <p className="text-muted-foreground" data-testid="text-vendas-subtitle">
                Gerencie vendas e configure os planos disponíveis
              </p>
            </div>
            
            {/* Date Filter */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Período:</span>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">De</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36 h-9"
                    data-testid="input-vendas-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36 h-9"
                    data-testid="input-vendas-end-date"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleThisMonth}
                  data-testid="button-this-month"
                >
                  Este mês
                </Button>
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDates}
                    data-testid="button-clear-dates"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-4">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-dashboard"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="sales" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-vendas"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Vendas
            </TabsTrigger>
            <TabsTrigger 
              value="leads" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              data-testid="tab-leads"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Leads
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
          <TabsContent value="dashboard" className="h-full m-0">
            <SalesDashboard startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="sales" className="h-full m-0">
            <SalesTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="leads" className="h-full m-0">
            <LeadsTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="plans" className="h-full m-0">
            <PlansTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

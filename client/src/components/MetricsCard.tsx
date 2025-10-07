import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowDown, ArrowUp, LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down";
  };
  icon?: LucideIcon;
}

export function MetricsCard({ title, value, change, icon: Icon }: MetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {change && (
          <div className="flex items-center gap-1 mt-2">
            {change.trend === "up" ? (
              <ArrowUp className="h-3 w-3 text-chart-2" />
            ) : (
              <ArrowDown className="h-3 w-3 text-destructive" />
            )}
            <span className={`text-xs font-medium ${
              change.trend === "up" ? "text-chart-2" : "text-destructive"
            }`}>
              {change.value}%
            </span>
            <span className="text-xs text-muted-foreground">vs. último mês</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

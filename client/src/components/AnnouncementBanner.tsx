import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AnnouncementType = 'info' | 'warning' | 'alert' | 'success';
type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  priority: number;
  active: boolean;
  startDate: string;
  endDate?: string | null;
}

interface MassiveFailure {
  id: string;
  name: string;
  description: string;
  severity: FailureSeverity;
  status: string;
  affectedRegions: any;
}

type BannerItem = 
  | { type: 'announcement'; data: Announcement }
  | { type: 'failure'; data: MassiveFailure };

const ROTATION_INTERVAL = 5000; // 5 segundos

export function AnnouncementBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState<BannerItem[]>([]);

  // Buscar anúncios ativos
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements/active'],
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Buscar falhas massivas ativas
  const { data: failures = [] } = useQuery<MassiveFailure[]>({
    queryKey: ['/api/failures'],
    refetchInterval: 30000,
  });

  // Combinar e ordenar itens
  useEffect(() => {
    const combinedItems: BannerItem[] = [
      ...announcements.map(a => ({ type: 'announcement' as const, data: a })),
      ...failures
        .filter(f => f.status === 'active')
        .map(f => ({ type: 'failure' as const, data: f })),
    ];

    // Ordenar por prioridade (anúncios) e severity (falhas)
    combinedItems.sort((a, b) => {
      if (a.type === 'announcement' && b.type === 'announcement') {
        return b.data.priority - a.data.priority;
      }
      if (a.type === 'failure' && b.type === 'failure') {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.data.severity] - severityOrder[a.data.severity];
      }
      // Falhas têm prioridade sobre anúncios
      return a.type === 'failure' ? -1 : 1;
    });

    setItems(combinedItems);
    setCurrentIndex(0);
  }, [announcements, failures]);

  // Rotação automática
  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [items.length]);

  // Não mostrar nada se não houver itens
  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div className="w-full border-b" data-testid="announcement-banner">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
        >
          {currentItem.type === 'announcement' ? (
            <AnnouncementContent announcement={currentItem.data} />
          ) : (
            <FailureContent failure={currentItem.data} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Indicadores de navegação */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-1.5" data-testid="banner-indicators">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
              data-testid={`indicator-${index}`}
              aria-label={`Ir para item ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementContent({ announcement }: { announcement: Announcement }) {
  const config = {
    info: {
      icon: Info,
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    alert: {
      icon: AlertCircle,
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-100',
      iconColor: 'text-red-600 dark:text-red-400',
    },
    success: {
      icon: CheckCircle,
      bg: 'bg-green-50 dark:bg-green-950/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-100',
      iconColor: 'text-green-600 dark:text-green-400',
    },
  };

  const style = config[announcement.type];
  const Icon = style.icon;

  return (
    <div 
      className={`${style.bg} ${style.border} border-b px-4 py-3`}
      data-testid="announcement-content"
    >
      <div className="container mx-auto flex items-center gap-3">
        <Icon className={`${style.iconColor} h-5 w-5 flex-shrink-0`} />
        <div className="flex-1">
          <p className={`${style.text} font-semibold text-sm`}>
            {announcement.title}
          </p>
          <p className={`${style.text} text-sm opacity-90`}>
            {announcement.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function FailureContent({ failure }: { failure: MassiveFailure }) {
  const config = {
    low: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    medium: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    high: {
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-900 dark:text-orange-100',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-100',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  };

  const style = config[failure.severity];

  // Calcular número de regiões afetadas
  const getAffectedRegionsCount = () => {
    try {
      const regions = failure.affectedRegions;
      if (regions?.type === 'predefined' && Array.isArray(regions.regionIds)) {
        return regions.regionIds.length;
      }
      if (regions?.type === 'custom' && Array.isArray(regions.custom)) {
        return regions.custom.reduce((sum: number, region: any) => {
          return sum + (Array.isArray(region.neighborhoods) ? region.neighborhoods.length : 0);
        }, 0);
      }
      return 0;
    } catch {
      return 0;
    }
  };

  const affectedCount = getAffectedRegionsCount();

  return (
    <div 
      className={`${style.bg} ${style.border} border-b px-4 py-3`}
      data-testid="failure-content"
    >
      <div className="container mx-auto flex items-center gap-3">
        <WifiOff className={`${style.iconColor} h-5 w-5 flex-shrink-0`} />
        <div className="flex-1">
          <p className={`${style.text} font-semibold text-sm`}>
            ⚠️ Falha Massiva em Andamento
          </p>
          <p className={`${style.text} text-sm opacity-90`}>
            {failure.name} • {failure.description} • {affectedCount} {affectedCount === 1 ? 'região afetada' : 'regiões afetadas'}
          </p>
        </div>
      </div>
    </div>
  );
}

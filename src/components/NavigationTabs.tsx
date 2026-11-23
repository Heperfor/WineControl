import React from 'react';
import {
  Activity,
  Archive,
  BookMarked,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Compass,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  Grape,
  LayoutGrid,
  MapPin,
  Send,
  ShieldCheck,
  Wine,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'parcelas'
  | 'entradas'
  | 'elaboracion'
  | 'embotellados'
  | 'almacen'
  | 'plano'
  | 'analiticas'
  | 'salidas'
  | 'insumos'
  | 'trazabilidad'
  | 'appcc'
  | 'libros_aeat'
  | 'libros_medio_rural'
  | 'fogga_mr441b'
  | 'infovi';

interface NavigationTabsProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  badgeCounts?: {
    entradas?: number;
    elaboraciones?: number;
    embotellados?: number;
    salidas?: number;
  };
}

export const APP_MODULES: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}> = [
  {
    id: 'dashboard',
    label: 'Panel',
    shortLabel: 'Inicio',
    icon: LayoutGrid,
    iconBg: 'bg-stone-900',
    iconColor: 'text-amber-300',
  },
  {
    id: 'parcelas',
    label: 'Parcelas',
    shortLabel: 'Parcelas',
    icon: MapPin,
    iconBg: 'bg-rose-200/85',
    iconColor: 'text-rose-900',
  },
  {
    id: 'plano',
    label: 'Plano Bodega',
    shortLabel: 'Plano',
    icon: Compass,
    iconBg: 'bg-teal-200/85',
    iconColor: 'text-teal-950',
  },
  {
    id: 'entradas',
    label: 'Entradas Uva',
    shortLabel: 'Uva',
    icon: Grape,
    iconBg: 'bg-rose-900',
    iconColor: 'text-amber-200',
  },
  {
    id: 'elaboracion',
    label: 'Elaboración',
    shortLabel: 'Bodega',
    icon: Activity,
    iconBg: 'bg-indigo-200/85',
    iconColor: 'text-indigo-900',
  },
  {
    id: 'embotellados',
    label: 'Embotellados',
    shortLabel: 'Botellas',
    icon: Wine,
    iconBg: 'bg-amber-200/85',
    iconColor: 'text-amber-950',
  },
  {
    id: 'salidas',
    label: 'Salidas',
    shortLabel: 'Salidas',
    icon: Send,
    iconBg: 'bg-emerald-200/85',
    iconColor: 'text-emerald-900',
  },
  {
    id: 'almacen',
    label: 'Graneles y embotellado',
    shortLabel: 'Stock',
    icon: Archive,
    iconBg: 'bg-stone-300/85',
    iconColor: 'text-stone-900',
  },
  {
    id: 'analiticas',
    label: 'Analíticas',
    shortLabel: 'Lab',
    icon: FlaskConical,
    iconBg: 'bg-cyan-200/85',
    iconColor: 'text-cyan-950',
  },
  {
    id: 'insumos',
    label: 'Insumos',
    shortLabel: 'Insumos',
    icon: Boxes,
    iconBg: 'bg-orange-200/85',
    iconColor: 'text-orange-950',
  },
  {
    id: 'trazabilidad',
    label: 'Trazabilidad',
    shortLabel: 'Trazar',
    icon: GitBranch,
    iconBg: 'bg-rose-800',
    iconColor: 'text-rose-50',
  },
  {
    id: 'appcc',
    label: 'APPCC Sanidad',
    shortLabel: 'APPCC',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-800',
    iconColor: 'text-emerald-50',
  },
  {
    id: 'libros_aeat',
    label: 'Libros Agencia Tributaria',
    shortLabel: 'Libros AEAT',
    icon: BookOpen,
    iconBg: 'bg-stone-900',
    iconColor: 'text-amber-300',
  },
  {
    id: 'libros_medio_rural',
    label: 'Libros Medio Rural',
    shortLabel: 'Medio Rural',
    icon: BookMarked,
    iconBg: 'bg-emerald-900',
    iconColor: 'text-amber-200',
  },
  {
    id: 'fogga_mr441b',
    label: 'FOGGA MR441B',
    shortLabel: 'FOGGA',
    icon: ClipboardCheck,
    iconBg: 'bg-sky-900',
    iconColor: 'text-amber-200',
  },
  {
    id: 'infovi',
    label: 'INFOVI AICA',
    shortLabel: 'INFOVI',
    icon: FileSpreadsheet,
    iconBg: 'bg-violet-900',
    iconColor: 'text-amber-200',
  },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab,
  badgeCounts = {},
}) => {
  const getCount = (id: TabId) => {
    if (id === 'entradas') return badgeCounts.entradas;
    if (id === 'elaboracion') return badgeCounts.elaboraciones;
    if (id === 'embotellados') return badgeCounts.embotellados;
    if (id === 'salidas') return badgeCounts.salidas;
    return undefined;
  };

  return (
    <nav className="hidden lg:block bg-white border-b border-stone-200 sticky top-16 z-30 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {APP_MODULES.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = getCount(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-rose-900 text-white shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`ml-0.5 text-[11px] tabular-nums font-bold ${
                      isActive ? 'text-amber-200' : 'text-stone-400'
                    }`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

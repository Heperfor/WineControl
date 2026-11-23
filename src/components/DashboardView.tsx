import React from 'react';
import {
  Activity,
  AlertCircle,
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
  MapPin,
  Send,
  ShieldCheck,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { TabId } from './NavigationTabs';

interface DashboardViewProps {
  onNavigateTab: (tab: TabId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
}) => {
  const {
    bodegaConfig,
    parcelas,
    depositos,
    analiticas,
    appccIncidencias,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
    insumoStockSummary,
    foggaDeclaraciones,
    infoviDeclaraciones,
  } = useWinery();

  // Metrics calculations
  const totalKgVendimiados = entradasUva.reduce((sum, e) => sum + e.kgTotales, 0);
  const totalLitrosGranel = depositos.reduce((sum, d) => sum + (d.litrosActuales || 0), 0);
  const capacidadTotalBodega = depositos.reduce((sum, d) => sum + d.capacidadLitros, 0);
  const porcentajeOcupacion = capacidadTotalBodega > 0 ? Math.round((totalLitrosGranel / capacidadTotalBodega) * 100) : 0;
  const depositosConVino = depositos.filter((d) => d.litrosActuales > 0).length;

  const totalBotellasDisponibles = embotellados.reduce((sum, emb) => sum + emb.botellasDisponibles, 0);
  const totalBotellasEmbotelladas = embotellados.reduce((sum, emb) => sum + emb.cantidadBotellas075, 0);

  // Grape varieties breakdown
  const variedadesKg: Record<string, number> = {};
  entradasUva.forEach((e) => {
    e.desgloseVariedades.forEach((v) => {
      variedadesKg[v.variedad] = (variedadesKg[v.variedad] || 0) + v.kg;
    });
  });

  // Low supply alerts
  const insumosAlerts: string[] = [];
  if (insumoStockSummary.corchos.natural < 1500) {
    insumosAlerts.push(`Corchos naturales (${insumoStockSummary.corchos.natural} uds)`);
  }
  if (insumoStockSummary.corchos['1+1'] < 2000) {
    insumosAlerts.push(`Corchos 1+1 (${insumoStockSummary.corchos['1+1']} uds)`);
  }
  if (insumoStockSummary.botellas.verde < 1500) {
    insumosAlerts.push(`Botellas verdes (${insumoStockSummary.botellas.verde} uds)`);
  }
  if (insumoStockSummary.etiquetas.xouba < 800) {
    insumosAlerts.push(`Etiquetas Xouba (${insumoStockSummary.etiquetas.xouba} uds)`);
  }

  const appMenuIcons: Array<{
    id: TabId;
    label: string;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
  }> = [
    {
      id: 'parcelas',
      label: 'Parcelas',
      subtitle: `${parcelas.length} fincas`,
      icon: MapPin,
      iconBg: 'bg-rose-200/85 border border-rose-300/80',
      iconColor: 'text-rose-900',
    },
    {
      id: 'plano',
      label: 'Plano Bodega',
      subtitle: `${depositosConVino}/${depositos.length} con vino`,
      icon: Compass,
      iconBg: 'bg-teal-200/85 border border-teal-300/80',
      iconColor: 'text-teal-950',
    },
    {
      id: 'entradas',
      label: 'Entradas Uva',
      subtitle: `${entradasUva.length} reg.`,
      icon: Grape,
      iconBg: 'bg-rose-900 border border-rose-950/40',
      iconColor: 'text-amber-200',
    },
    {
      id: 'elaboracion',
      label: 'Elaboración',
      subtitle: `${elaboraciones.length} op.`,
      icon: Activity,
      iconBg: 'bg-indigo-200/85 border border-indigo-300/80',
      iconColor: 'text-indigo-900',
    },
    {
      id: 'embotellados',
      label: 'Embotellados',
      subtitle: `${embotellados.length} lotes`,
      icon: Wine,
      iconBg: 'bg-amber-200/85 border border-amber-300/80',
      iconColor: 'text-amber-950',
    },
    {
      id: 'salidas',
      label: 'Salidas',
      subtitle: `${salidas.length} env.`,
      icon: Send,
      iconBg: 'bg-emerald-200/85 border border-emerald-300/80',
      iconColor: 'text-emerald-900',
    },
    {
      id: 'almacen',
      label: 'Graneles y emb.',
      subtitle: `${depositos.length} dep.`,
      icon: Archive,
      iconBg: 'bg-stone-300/85 border border-stone-400/60',
      iconColor: 'text-stone-900',
    },
    {
      id: 'analiticas',
      label: 'Analíticas',
      subtitle: `${analiticas.length} reg.`,
      icon: FlaskConical,
      iconBg: 'bg-cyan-200/85 border border-cyan-300/80',
      iconColor: 'text-cyan-950',
    },
    {
      id: 'insumos',
      label: 'Insumos',
      subtitle: 'Materiales',
      icon: Boxes,
      iconBg: 'bg-orange-200/85 border border-orange-300/80',
      iconColor: 'text-orange-950',
    },
    {
      id: 'trazabilidad',
      label: 'Trazabilidad',
      subtitle: '360º',
      icon: GitBranch,
      iconBg: 'bg-rose-800 border border-rose-900/40',
      iconColor: 'text-rose-50',
    },
    {
      id: 'appcc',
      label: 'APPCC Sanidad',
      subtitle: `${appccIncidencias.filter((i) => i.estado === 'En seguimiento').length} alertas`,
      icon: ShieldCheck,
      iconBg: 'bg-emerald-800 border border-emerald-900/40',
      iconColor: 'text-emerald-50',
    },
    {
      id: 'libros_aeat',
      label: 'Libros Agencia Tributaria',
      subtitle: '2 libros II.EE.',
      icon: BookOpen,
      iconBg: 'bg-stone-900 border border-stone-800',
      iconColor: 'text-amber-300',
    },
    {
      id: 'libros_medio_rural',
      label: 'Libros Medio Rural',
      subtitle: '5 libros Xunta',
      icon: BookMarked,
      iconBg: 'bg-emerald-900 border border-emerald-950/40',
      iconColor: 'text-amber-200',
    },
    {
      id: 'fogga_mr441b',
      label: 'FOGGA MR441B',
      subtitle: `${foggaDeclaraciones.filter((d) => d.confirmadaPresentada).length} pres.`,
      icon: ClipboardCheck,
      iconBg: 'bg-sky-900 border border-sky-950/40',
      iconColor: 'text-amber-200',
    },
    {
      id: 'infovi',
      label: 'INFOVI AICA',
      subtitle: `${infoviDeclaraciones.filter((d) => d.confirmadaPresentada).length} hist. · Act. pend.`,
      icon: FileSpreadsheet,
      iconBg: 'bg-violet-900 border border-violet-950/40',
      iconColor: 'text-amber-200',
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Header banner: strictly "Control de bodega" without duplicate quick-action buttons */}
      <div className="bg-gradient-to-br from-stone-900 via-rose-950 to-stone-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl border border-stone-800">
        <h1 className="text-xl sm:text-3xl font-bold font-serif-wine text-white">
          Control de bodega
        </h1>
      </div>

      {/* App Icon Menu Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {appMenuIcons.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigateTab(item.id)}
              className="min-h-[84px] sm:min-h-[90px] p-2.5 sm:p-3 bg-white hover:bg-stone-50 active:scale-95 rounded-2xl border border-stone-200 hover:border-rose-300 shadow-xs hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer group"
            >
              <div
                className={`w-11 h-11 rounded-2xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-stone-800 leading-tight line-clamp-2">
                {item.label}
              </span>
              {item.subtitle && (
                <span className="text-[10px] text-stone-400 tabular-nums leading-none">
                  {item.subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPI Cards Grid (Salidas removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1: Grape harvest */}
        <div
          onClick={() => onNavigateTab('entradas')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Uva Cosechada ({bodegaConfig.anoCampana})
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-800 group-hover:scale-110 transition-transform">
              <Grape className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900 tabular-nums">
            {totalKgVendimiados.toLocaleString('es-ES')} <span className="text-sm font-medium text-stone-500">kg</span>
          </div>
          <div className="text-xs text-stone-500 mt-2 flex items-center justify-between">
            <span>{entradasUva.length} partidas recibidas</span>
            <span className="text-rose-700 font-medium group-hover:underline">Ver entradas →</span>
          </div>
        </div>

        {/* KPI 2: Bulk Wine in Tanks */}
        <div
          onClick={() => onNavigateTab('almacen')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Vino a Granel en Bodega
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 group-hover:scale-110 transition-transform">
              <Archive className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900 tabular-nums">
            {totalLitrosGranel.toLocaleString('es-ES')} <span className="text-sm font-medium text-stone-500">L</span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1 tabular-nums">
              <span>Ocupación: {porcentajeOcupacion}%</span>
              <span>Total cap: {capacidadTotalBodega.toLocaleString('es-ES')} L</span>
            </div>
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, porcentajeOcupacion)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Bottled Wine Stock */}
        <div
          onClick={() => onNavigateTab('embotellados')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Stock Botellas Disponibles
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800 group-hover:scale-110 transition-transform">
              <Wine className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900 tabular-nums">
            {totalBotellasDisponibles.toLocaleString('es-ES')}{' '}
            <span className="text-sm font-medium text-stone-500">bot. 0,75L</span>
          </div>
          <div className="text-xs text-stone-500 mt-2 flex items-center justify-between">
            <span>{totalBotellasEmbotelladas.toLocaleString('es-ES')} botellas totales</span>
            <span className="text-amber-700 font-medium group-hover:underline">Ver lotes →</span>
          </div>
        </div>
      </div>

      {/* Supplies Alerts if any */}
      {insumosAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900">
              <span className="font-semibold">Stock bajo en insumos: </span>
              <span className="text-amber-800">{insumosAlerts.join(' · ')}</span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('insumos')}
            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-xl hover:bg-amber-100/60 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Gestionar Insumos
          </button>
        </div>
      )}

      {/* Bottom Layout: Varietal Breakdown & Quick Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left Column (2 cols): Varietal Breakdown */}
        <div className="lg:col-span-2">
          {/* Varietal Harvest Progress */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-stone-900 text-base">Desglose Varietal de Vendimia</h3>
                <p className="text-xs text-stone-500">Distribución de uva recogida por variedad</p>
              </div>
              <button
                onClick={() => onNavigateTab('parcelas')}
                className="min-h-[40px] px-2.5 text-xs text-rose-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Ver Viñedos</span>
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(variedadesKg)
                .sort((a, b) => b[1] - a[1])
                .map(([variedad, kg]) => {
                  const pct = totalKgVendimiados > 0 ? Math.round((kg / totalKgVendimiados) * 100) : 0;
                  return (
                    <div key={variedad}>
                      <div className="flex items-center justify-between text-xs font-medium text-stone-700 mb-1 tabular-nums">
                        <span className="font-semibold">{variedad}</span>
                        <span>
                          {kg.toLocaleString('es-ES')} kg ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-800 to-amber-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Trazabilidad y Libros AEAT */}
        <div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 sm:p-6 rounded-2xl border border-amber-200/80 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-900 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-stone-900 text-base">Trazabilidad y Libros Oficiales</h4>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  Seguimiento 360º por lote, libros de Impuestos Especiales (AEAT) y libros de bodega de Medio Rural (Xunta de Galicia).
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => onNavigateTab('trazabilidad')}
                    className="w-full min-h-[44px] py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs text-center"
                  >
                    Ver Árbol de Trazabilidad 360º
                  </button>
                  <button
                    onClick={() => onNavigateTab('libros_aeat')}
                    className="w-full min-h-[44px] py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs font-semibold cursor-pointer text-center"
                  >
                    Abrir Libros Agencia Tributaria
                  </button>
                  <button
                    onClick={() => onNavigateTab('libros_medio_rural')}
                    className="w-full min-h-[44px] py-2 bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs text-center"
                  >
                    Abrir Libros Medio Rural
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onNavigateTab('fogga_mr441b')}
                      className="min-h-[42px] py-2 px-2 bg-sky-900 hover:bg-sky-950 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs text-center"
                    >
                      FOGGA MR441B
                    </button>
                    <button
                      onClick={() => onNavigateTab('infovi')}
                      className="min-h-[42px] py-2 px-2 bg-violet-900 hover:bg-violet-950 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs text-center"
                    >
                      INFOVI AICA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

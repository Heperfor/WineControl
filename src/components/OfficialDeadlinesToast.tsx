import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  getPendingOfficialDeadlines,
  OfficialDeadlineAlert,
} from '../utils/foggaInfoviAutomation';
import { InfoviMesPeriodo } from '../types/winery';
import { getLocalIsoDate } from '../utils/dateUtils';

interface OfficialDeadlinesToastProps {
  isCollapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  onOpenFogga: (campanaInicio: number) => void;
  onOpenInfovi: (campanaInicio: number, mes: InfoviMesPeriodo) => void;
}

const formatFechaEs = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export const OfficialDeadlinesToast: React.FC<OfficialDeadlinesToastProps> = ({
  isCollapsed,
  onSetCollapsed,
  onOpenFogga,
  onOpenInfovi,
}) => {
  const {
    foggaDeclaraciones,
    infoviDeclaraciones,
    confirmarFoggaPresentada,
    confirmarInfoviPresentada,
  } = useWinery();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const alerts = useMemo(
    () => getPendingOfficialDeadlines(foggaDeclaraciones, infoviDeclaraciones),
    [foggaDeclaraciones, infoviDeclaraciones]
  );

  if (alerts.length === 0 || isCollapsed) return null;

  const handleConfirm = (alert: OfficialDeadlineAlert) => {
    if (alert.modulo === 'fogga_mr441b') {
      confirmarFoggaPresentada(alert.campanaInicio);
    } else if (alert.mesInfovi) {
      confirmarInfoviPresentada(alert.campanaInicio, alert.mesInfovi);
    }
    setConfirmingId(null);
  };

  return (
    <div
      className="fixed bottom-4 right-3 sm:right-4 z-40 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[75vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-amber-300 overflow-hidden no-print"
      role="region"
      aria-label="Avisos de plazos oficiales FOGGA e INFOVI"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between gap-2 border-b border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-amber-100 truncate">
              Plazos de Declaraciones Oficiales
            </h3>
            <p className="text-[11px] text-stone-400 truncate">
              Aviso activo desde 3 semanas antes hasta confirmar presentación
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSetCollapsed(true)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 cursor-pointer shrink-0"
          title="Minimizar avisos"
          aria-label="Minimizar avisos"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Alert items */}
      <div className="p-3 space-y-2.5 overflow-y-auto bg-stone-50">
        {alerts.map((alert) => {
          const isVencido = alert.urgencia === 'vencido';
          const isEnPlazo = alert.urgencia === 'en_plazo';
          const isConfirming = confirmingId === alert.id;

          const statusText =
            alert.diasRestantes < 0
              ? `Vencida hace ${Math.abs(alert.diasRestantes)} días (${formatFechaEs(alert.fechaVencimiento)})`
              : alert.diasRestantes === 0
              ? `Vence HOY (${formatFechaEs(alert.fechaVencimiento)})`
              : `Vence en ${alert.diasRestantes} días · ${formatFechaEs(alert.fechaVencimiento)}`;

          return (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border bg-white space-y-2 ${
                isVencido
                  ? 'border-red-300'
                  : isEnPlazo
                  ? 'border-amber-400'
                  : 'border-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isVencido ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 leading-snug">
                    {alert.titulo}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{alert.subtitulo}</div>
                  <div
                    className={`text-[11px] font-semibold mt-1 tabular-nums ${
                      isVencido
                        ? 'text-red-700'
                        : isEnPlazo
                        ? 'text-amber-800'
                        : 'text-amber-700'
                    }`}
                  >
                    {statusText}
                  </div>
                </div>
              </div>

              {isConfirming ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
                  <p className="text-[11px] text-emerald-950 font-medium">
                    ¿Confirmas que esta declaración ya ha sido presentada ante el organismo oficial?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirm(alert)}
                      className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Sí, confirmar presentada
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-[11px] font-medium hover:bg-stone-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (alert.modulo === 'fogga_mr441b') {
                        onOpenFogga(alert.campanaInicio);
                      } else if (alert.mesInfovi) {
                        onOpenInfovi(alert.campanaInicio, alert.mesInfovi);
                      }
                      onSetCollapsed(true);
                    }}
                    className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Cubrir / Ver</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {alert.fechaAperturaPlazo &&
                  getLocalIsoDate() < alert.fechaAperturaPlazo ? (
                    <span className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-stone-100 text-stone-600 border border-stone-200 text-[11px] font-medium flex items-center justify-center whitespace-nowrap">
                      Abre {formatFechaEs(alert.fechaAperturaPlazo)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(alert.id)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Ya presentada</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CloudOff,
  Download,
  Grape,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { BodegaConfig } from '../types/winery';
import { TabId } from './NavigationTabs';

interface NavbarProps {
  activeTab: TabId;
  onBackHome: () => void;
}

const TAB_TITLES: Record<TabId, string> = {
  dashboard: 'Control de bodega',
  parcelas: 'Parcelas',
  entradas: 'Entradas Uva',
  elaboracion: 'Elaboración',
  embotellados: 'Embotellados',
  almacen: 'Graneles y embotellado',
  plano: 'Plano Bodega',
  analiticas: 'Analíticas',
  salidas: 'Salidas',
  insumos: 'Insumos',
  trazabilidad: 'Trazabilidad',
  appcc: 'APPCC Sanidad',
  libros_aeat: 'Libros Agencia Tributaria',
  libros_medio_rural: 'Libros Medio Rural',
  fogga_mr441b: 'Declaración FOGGA (MR441B)',
  infovi: 'Declaración INFOVI (AICA)',
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onBackHome,
}) => {
  const {
    bodegaConfig,
    updateBodegaConfig,
    exportDatabaseJSON,
    syncStatus,
    hasPendingSync,
    lastSyncAt,
    syncError,
    isSupabaseReady,
    syncWithCloud,
  } = useWinery();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<BodegaConfig>(bodegaConfig);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleOpenConfig = () => {
    setTempConfig(bodegaConfig);
    setStatusMessage(null);
    setIsConfigOpen(true);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateBodegaConfig(tempConfig);
    setIsConfigOpen(false);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CopiaSeguridad_Bodega_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'ok', text: 'Copia de seguridad JSON descargada.' });
  };

  const handleManualSync = async () => {
    const ok = await syncWithCloud(false);
    if (ok) {
      setStatusMessage({
        type: 'ok',
        text: 'Datos sincronizados correctamente entre todos los dispositivos.',
      });
    } else {
      setStatusMessage({
        type: 'err',
        text:
          syncError ||
          'No se pudo sincronizar con Supabase. Revisa tu conexión o la configuración.',
      });
    }
  };

  const isSubView = activeTab !== 'dashboard';

  // Distinct visual styling for Sync button depending on sync state
  const isSyncing = syncStatus === 'syncing';
  const isPending = !isSyncing && (hasPendingSync || syncStatus === 'pending');
  const isErrorOrOffline = !isSyncing && !isPending && (syncStatus === 'error' || !isSupabaseReady);

  const syncButtonClasses = isSyncing
    ? 'bg-sky-600 text-white border-sky-400 cursor-wait'
    : isPending
    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300 font-bold shadow-xs'
    : isErrorOrOffline
    ? 'bg-orange-700 hover:bg-orange-600 text-white border-orange-400/70'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/60';

  const syncLabel = isSyncing
    ? 'Sincronizando'
    : isPending
    ? 'Sincronizar'
    : !isSupabaseReady
    ? 'Sin nube'
    : syncStatus === 'error'
    ? 'Reintentar'
    : 'Sincronizado';

  const syncTooltip = isSyncing
    ? 'Sincronizando datos con Supabase...'
    : isPending
    ? 'Hay cambios locales pendientes de sincronizar. Pulsa para enviar a todos los dispositivos.'
    : !isSupabaseReady
    ? 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
    : syncStatus === 'error'
    ? syncError || 'Error de sincronización. Pulsa para reintentar.'
    : lastSyncAt
    ? `Todo sincronizado (${new Date(lastSyncAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}). Pulsa para comprobar cambios.`
    : 'Todo sincronizado. Pulsa para actualizar.';

  return (
    <>
      <header className="bg-stone-900 border-b border-stone-800 text-stone-100 sticky top-0 z-40 shadow-md no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-16 gap-2">
            {/* Left Zone: Back button on subviews (mobile & desktop) OR Brand lockup */}
            <div className="flex items-center gap-2 min-w-0">
              {isSubView ? (
                <button
                  onClick={onBackHome}
                  className="min-w-[40px] min-h-[40px] lg:min-h-[38px] -ml-1 lg:ml-0 lg:px-3 flex items-center justify-center gap-1.5 rounded-xl text-amber-200 hover:bg-stone-800 lg:bg-stone-800/80 lg:border lg:border-stone-700 active:scale-95 transition-all cursor-pointer shrink-0"
                  aria-label="Volver al inicio"
                >
                  <ArrowLeft className="w-5 h-5 lg:w-4 lg:h-4" />
                  <span className="hidden lg:inline text-xs font-semibold">Inicio</span>
                </button>
              ) : null}

              <div
                onClick={onBackHome}
                className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-rose-900 to-rose-700 flex items-center justify-center text-amber-300 shadow-inner border border-rose-600/30 shrink-0 cursor-pointer ${
                  isSubView ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <Grape className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>

              <div className="min-w-0">
                {/* Mobile title when inside subview */}
                {isSubView ? (
                  <div className="lg:hidden flex flex-col">
                    <span className="font-serif-wine text-sm sm:text-base font-bold tracking-wide text-amber-200 truncate">
                      {TAB_TITLES[activeTab]}
                    </span>
                    <span className="text-[11px] text-stone-400 truncate">
                      {bodegaConfig.nombreBodega}
                    </span>
                  </div>
                ) : null}

                {/* Desktop & Home Brand */}
                <div className={isSubView ? 'hidden lg:block' : 'block'}>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={onBackHome}
                      className="font-serif-wine text-sm sm:text-lg font-bold tracking-wider text-amber-200 whitespace-nowrap cursor-pointer"
                    >
                      WINECONTROL
                    </span>
                    {isSubView && (
                      <span className="text-xs text-amber-100/90 font-semibold whitespace-nowrap">
                        · {TAB_TITLES[activeTab]}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                    {bodegaConfig.nombreBodega}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Sincronizar button: distinctly colored when pending/unsynced vs synced */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                title={syncTooltip}
                className={`min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${syncButtonClasses}`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                ) : !isSupabaseReady ? (
                  <CloudOff className="w-3.5 h-3.5 shrink-0" />
                ) : syncStatus === 'error' ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{syncLabel}</span>
              </button>

              {/* Descargar CS en rojo suave */}
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl bg-red-500/80 hover:bg-red-500 active:scale-95 text-white border border-red-300/60 text-xs font-semibold shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
                title="Descargar copia de seguridad JSON (CS)"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Descargar CS</span>
              </button>

              <button
                type="button"
                onClick={handleOpenConfig}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-stone-300 hover:text-amber-200 hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                title="Datos de la bodega, sincronización y copia de seguridad"
                aria-label="Configuración de la bodega"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bodega Configuration & Cloud Sync Bottom Sheet / Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 to-rose-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  Bodega, Sincronización y Copia
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 sm:p-6 space-y-4 text-sm text-stone-800 overflow-y-auto">
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border ${
                    statusMessage.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <div>
                <label className="block font-medium text-stone-700 mb-1">Nombre Comercial de la Bodega</label>
                <input
                  type="text"
                  required
                  value={tempConfig.nombreBodega}
                  onChange={(e) => setTempConfig({ ...tempConfig, nombreBodega: e.target.value })}
                  className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20 focus:border-rose-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">D.O. / I.G.</label>
                  <input
                    type="text"
                    value={tempConfig.denominacionOrigen || ''}
                    onChange={(e) => setTempConfig({ ...tempConfig, denominacionOrigen: e.target.value })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Campaña Actual</label>
                  <input
                    type="number"
                    value={tempConfig.anoCampana}
                    onChange={(e) => setTempConfig({ ...tempConfig, anoCampana: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Registro (RE)</label>
                  <input
                    type="text"
                    value={tempConfig.numeroRegistroVitivinicola}
                    onChange={(e) => setTempConfig({ ...tempConfig, numeroRegistroVitivinicola: e.target.value })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">CIF / NIF</label>
                  <input
                    type="text"
                    value={tempConfig.cifNif}
                    onChange={(e) => setTempConfig({ ...tempConfig, cifNif: e.target.value })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Localidad / Concello</label>
                  <input
                    type="text"
                    value={tempConfig.localidad}
                    onChange={(e) => setTempConfig({ ...tempConfig, localidad: e.target.value })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    value={tempConfig.provincia}
                    onChange={(e) => setTempConfig({ ...tempConfig, provincia: e.target.value })}
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Responsable Técnico</label>
                <input
                  type="text"
                  value={tempConfig.responsableTecnico}
                  onChange={(e) => setTempConfig({ ...tempConfig, responsableTecnico: e.target.value })}
                  className="w-full px-3 py-2.5 text-base sm:text-sm border border-stone-300 rounded-xl"
                />
              </div>

              {/* Cloud Sync & Red Backup actions */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-700">
                    Sincronización entre Dispositivos (Supabase)
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isPending
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : isErrorOrOffline
                        ? 'bg-orange-100 text-orange-900 border border-orange-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {syncLabel}
                  </span>
                </div>

                {lastSyncAt && (
                  <p className="text-[11px] text-stone-500 tabular-nums">
                    Última sincronización: {new Date(lastSyncAt).toLocaleString('es-ES')}
                  </p>
                )}

                {syncError && (
                  <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                    {syncError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${syncButtonClasses}`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isPending ? 'Sincronizar cambios' : 'Sincronizar ahora'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/85 hover:bg-red-500 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar CS</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-medium shadow-sm cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

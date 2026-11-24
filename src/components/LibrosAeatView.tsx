import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  FileDown,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  AeatMateriaPrimaRegistro,
  AeatMateriaPrimaSumaAnterior,
  AeatProductoElaboradoRegistro,
} from '../types/winery';
import {
  exportAeatMateriasPrimasExcel,
  exportAeatMateriasPrimasPDF,
  exportAeatProductoElaboradoExcel,
  exportAeatProductoElaboradoPDF,
} from '../utils/aeatExportUtils';
import { getLocalIsoDate } from '../utils/dateUtils';

type LibroTab = 'materias_primas' | 'producto_elaborado';
type SpreadView = 'completo' | 'pag1' | 'pag2';
type MovimientoFilter = 'todos' | 'entrada' | 'elaboracion' | 'embotellado' | 'salida' | 'manual';

const formatFechaEs = (isoDate: string) => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

const formatNum = (val?: number, decimals = 0) => {
  if (val === undefined || val === null || Number.isNaN(val)) return '';
  if (val === 0) return '';
  return val.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 0 ? decimals : 2,
  });
};

const formatSum = (val: number) => {
  return val.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const LibrosAeatView: React.FC = () => {
  const {
    bodegaConfig,
    aeatSumaAnterior,
    updateAeatSumaAnterior,
    aeatMateriasPrimas,
    addAeatMateriaPrima,
    updateAeatMateriaPrima,
    deleteAeatMateriaPrima,
    syncAeatMateriasPrimasFromVendimia,
    aeatProductoElaborado,
    addAeatProductoElaborado,
    updateAeatProductoElaborado,
    deleteAeatProductoElaborado,
    syncAeatProductoElaboradoFromBodega,
  } = useWinery();

  const [activeBook, setActiveBook] = useState<LibroTab>('materias_primas');
  const [spreadView, setSpreadView] = useState<SpreadView>('completo');
  const [peFilter, setPeFilter] = useState<MovimientoFilter>('todos');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Modal states: Materias Primas
  const [isMpModalOpen, setIsMpModalOpen] = useState(false);
  const [editingMpId, setEditingMpId] = useState<string | null>(null);
  const [mpForm, setMpForm] = useState({
    numeroOrden: 1,
    observaciones: 'Colleita propia',
    fecha: getLocalIsoDate(),
    docNumero: '',
    nifOCae: bodegaConfig.cifNif || '76721750Y',
    grado: '',
    entradasUvasKg: '',
    entradasBagazosKg: '',
    entradasMostoLitros: '',
    salidasUvasKg: '',
    salidasBagazosKg: '',
    salidasMostoLitros: '',
    existenciasUvasKg: '',
    existenciasBagazosKg: '',
    existenciasMostoLitros: '',
  });

  // Modal state: Suma Anterior
  const [isSumaAntOpen, setIsSumaAntOpen] = useState(false);
  const [sumaAntForm, setSumaAntForm] = useState<AeatMateriaPrimaSumaAnterior>(aeatSumaAnterior);

  // Modal states: Producto Elaborado
  const [isPeModalOpen, setIsPeModalOpen] = useState(false);
  const [editingPeId, setEditingPeId] = useState<string | null>(null);
  const [peForm, setPeForm] = useState({
    numeroAsiento: 1,
    fechaMovimiento: getLocalIsoDate(),
    tipoMovimiento: 'Obtención / Elaboración',
    regimenFiscal: 'Suspensivo',
    epigrafe: 'V0',
    codigoNc: '220421',
    denominacionProducto: '',
    referenciaInterna: '',
    variedad: '',
    cantidadProducto: '',
    gradoAlcoholico: '12.5',
    alcoholPuro: '',
    tipoJustificante: 'Parte Bodega',
    numeroJustificante: '',
    tipoEnvase: 'Botella 0,75 L',
    capacidadEnvase: '0,75 L',
    numeroEnvases: '',
    origenDestinoNif: '',
    origenDestinoRazonSocial: '',
    origenDestinoCae: '',
    saldoGranelBlanco: '',
    saldoGranelTinto: '',
    saldoEmbotelladoBlanco: '',
    saldoEmbotelladoTinto: '',
  });

  const showNotice = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => {
      setBannerMsg((cur) => (cur === msg ? null : cur));
    }, 5000);
  };

  // Totals for Libro de Materias Primas (SUMA Y SIGUE)
  const mpTotals = useMemo(() => {
    const sum = (fn: (r: AeatMateriaPrimaRegistro) => number | undefined) =>
      aeatMateriasPrimas.reduce((acc, r) => acc + (fn(r) || 0), 0);

    return {
      entradasUvasKg: (aeatSumaAnterior.entradasUvasKg || 0) + sum((r) => r.entradasUvasKg),
      entradasBagazosKg: (aeatSumaAnterior.entradasBagazosKg || 0) + sum((r) => r.entradasBagazosKg),
      entradasMostoLitros: (aeatSumaAnterior.entradasMostoLitros || 0) + sum((r) => r.entradasMostoLitros),
      salidasUvasKg: (aeatSumaAnterior.salidasUvasKg || 0) + sum((r) => r.salidasUvasKg),
      salidasBagazosKg: (aeatSumaAnterior.salidasBagazosKg || 0) + sum((r) => r.salidasBagazosKg),
      salidasMostoLitros: (aeatSumaAnterior.salidasMostoLitros || 0) + sum((r) => r.salidasMostoLitros),
      existenciasUvasKg: (aeatSumaAnterior.existenciasUvasKg || 0) + sum((r) => r.existenciasUvasKg),
      existenciasBagazosKg: (aeatSumaAnterior.existenciasBagazosKg || 0) + sum((r) => r.existenciasBagazosKg),
      existenciasMostoLitros: (aeatSumaAnterior.existenciasMostoLitros || 0) + sum((r) => r.existenciasMostoLitros),
    };
  }, [aeatMateriasPrimas, aeatSumaAnterior]);

  // Latest stock balances in Producto Elaborado
  const peLatestBalances = useMemo(() => {
    const last = aeatProductoElaborado[aeatProductoElaborado.length - 1];
    return {
      granelBlanco: last?.saldoGranelBlanco ?? 0,
      granelTinto: last?.saldoGranelTinto ?? 0,
      embBlanco: last?.saldoEmbotelladoBlanco ?? 0,
      embTinto: last?.saldoEmbotelladoTinto ?? 0,
    };
  }, [aeatProductoElaborado]);

  const peCounts = useMemo(() => {
    const counts = {
      todos: aeatProductoElaborado.length,
      entrada: 0,
      elaboracion: 0,
      embotellado: 0,
      salida: 0,
      manual: 0,
    };
    aeatProductoElaborado.forEach((r) => {
      const t = r.origenTipo || 'manual';
      if (t === 'entrada') counts.entrada += 1;
      else if (t === 'elaboracion') counts.elaboracion += 1;
      else if (t === 'embotellado') counts.embotellado += 1;
      else if (t === 'salida') counts.salida += 1;
      else counts.manual += 1;
    });
    return counts;
  }, [aeatProductoElaborado]);

  const filteredPe = useMemo(() => {
    if (peFilter === 'todos') return aeatProductoElaborado;
    return aeatProductoElaborado.filter((r) => (r.origenTipo || 'manual') === peFilter);
  }, [aeatProductoElaborado, peFilter]);

  // Open Materias Primas modal
  const openCreateMp = () => {
    const nextOrder =
      aeatMateriasPrimas.reduce((max, r) => Math.max(max, r.numeroOrden), 0) + 1;
    setEditingMpId(null);
    setMpForm({
      numeroOrden: nextOrder,
      observaciones: 'Colleita propia',
      fecha: getLocalIsoDate(),
      docNumero: '',
      nifOCae: bodegaConfig.cifNif || '76721750Y',
      grado: '',
      entradasUvasKg: '',
      entradasBagazosKg: '',
      entradasMostoLitros: '',
      salidasUvasKg: '',
      salidasBagazosKg: '',
      salidasMostoLitros: '',
      existenciasUvasKg: '',
      existenciasBagazosKg: '',
      existenciasMostoLitros: '',
    });
    setIsMpModalOpen(true);
  };

  const openEditMp = (row: AeatMateriaPrimaRegistro) => {
    setEditingMpId(row.id);
    setMpForm({
      numeroOrden: row.numeroOrden,
      observaciones: row.observaciones || '',
      fecha: row.fecha,
      docNumero: row.docNumero || '',
      nifOCae: row.nifOCae || '',
      grado: row.grado !== undefined ? String(row.grado) : '',
      entradasUvasKg: row.entradasUvasKg !== undefined ? String(row.entradasUvasKg) : '',
      entradasBagazosKg: row.entradasBagazosKg !== undefined ? String(row.entradasBagazosKg) : '',
      entradasMostoLitros: row.entradasMostoLitros !== undefined ? String(row.entradasMostoLitros) : '',
      salidasUvasKg: row.salidasUvasKg !== undefined ? String(row.salidasUvasKg) : '',
      salidasBagazosKg: row.salidasBagazosKg !== undefined ? String(row.salidasBagazosKg) : '',
      salidasMostoLitros: row.salidasMostoLitros !== undefined ? String(row.salidasMostoLitros) : '',
      existenciasUvasKg: row.existenciasUvasKg !== undefined ? String(row.existenciasUvasKg) : '',
      existenciasBagazosKg: row.existenciasBagazosKg !== undefined ? String(row.existenciasBagazosKg) : '',
      existenciasMostoLitros: row.existenciasMostoLitros !== undefined ? String(row.existenciasMostoLitros) : '',
    });
    setIsMpModalOpen(true);
  };

  const parseOptNum = (v: string): number | undefined => {
    const trimmed = v.trim().replace(',', '.');
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSaveMp = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      numeroOrden: Number(mpForm.numeroOrden) || 1,
      observaciones: mpForm.observaciones.trim(),
      fecha: mpForm.fecha,
      docNumero: mpForm.docNumero.trim(),
      nifOCae: mpForm.nifOCae.trim(),
      grado: parseOptNum(mpForm.grado),
      entradasUvasKg: parseOptNum(mpForm.entradasUvasKg),
      entradasBagazosKg: parseOptNum(mpForm.entradasBagazosKg),
      entradasMostoLitros: parseOptNum(mpForm.entradasMostoLitros),
      salidasUvasKg: parseOptNum(mpForm.salidasUvasKg),
      salidasBagazosKg: parseOptNum(mpForm.salidasBagazosKg),
      salidasMostoLitros: parseOptNum(mpForm.salidasMostoLitros),
      existenciasUvasKg: parseOptNum(mpForm.existenciasUvasKg),
      existenciasBagazosKg: parseOptNum(mpForm.existenciasBagazosKg),
      existenciasMostoLitros: parseOptNum(mpForm.existenciasMostoLitros),
    };

    if (editingMpId) {
      updateAeatMateriaPrima(editingMpId, payload);
      showNotice(`Asiento Nº ${payload.numeroOrden} actualizado en Libro de Materias Primas.`);
    } else {
      addAeatMateriaPrima(payload);
      showNotice(`Asiento Nº ${payload.numeroOrden} añadido al Libro de Materias Primas.`);
    }
    setIsMpModalOpen(false);
  };

  // Open Producto Elaborado modal
  const openCreatePe = () => {
    const nextAsiento =
      aeatProductoElaborado.reduce((max, r) => Math.max(max, r.numeroAsiento), 0) + 1;
    setEditingPeId(null);
    setPeForm({
      numeroAsiento: nextAsiento,
      fechaMovimiento: getLocalIsoDate(),
      tipoMovimiento: 'Obtención / Elaboración',
      regimenFiscal: 'Suspensivo',
      epigrafe: 'V0',
      codigoNc: '220421',
      denominacionProducto: '',
      referenciaInterna: '',
      variedad: '',
      cantidadProducto: '',
      gradoAlcoholico: '12.5',
      alcoholPuro: '',
      tipoJustificante: 'Parte Bodega',
      numeroJustificante: '',
      tipoEnvase: 'Botella 0,75 L',
      capacidadEnvase: '0,75 L',
      numeroEnvases: '',
      origenDestinoNif: '',
      origenDestinoRazonSocial: '',
      origenDestinoCae: '',
      saldoGranelBlanco: String(peLatestBalances.granelBlanco),
      saldoGranelTinto: String(peLatestBalances.granelTinto),
      saldoEmbotelladoBlanco: String(peLatestBalances.embBlanco),
      saldoEmbotelladoTinto: String(peLatestBalances.embTinto),
    });
    setIsPeModalOpen(true);
  };

  const openEditPe = (row: AeatProductoElaboradoRegistro) => {
    setEditingPeId(row.id);
    setPeForm({
      numeroAsiento: row.numeroAsiento,
      fechaMovimiento: row.fechaMovimiento,
      tipoMovimiento: row.tipoMovimiento,
      regimenFiscal: row.regimenFiscal,
      epigrafe: row.epigrafe,
      codigoNc: row.codigoNc,
      denominacionProducto: row.denominacionProducto,
      referenciaInterna: row.referenciaInterna,
      variedad: row.variedad,
      cantidadProducto: String(row.cantidadProducto ?? ''),
      gradoAlcoholico: row.gradoAlcoholico !== undefined ? String(row.gradoAlcoholico) : '',
      alcoholPuro: row.alcoholPuro !== undefined ? String(row.alcoholPuro) : '',
      tipoJustificante: row.tipoJustificante,
      numeroJustificante: row.numeroJustificante,
      tipoEnvase: row.tipoEnvase,
      capacidadEnvase: row.capacidadEnvase,
      numeroEnvases: row.numeroEnvases !== undefined ? String(row.numeroEnvases) : '',
      origenDestinoNif: row.origenDestinoNif,
      origenDestinoRazonSocial: row.origenDestinoRazonSocial,
      origenDestinoCae: row.origenDestinoCae,
      saldoGranelBlanco: row.saldoGranelBlanco !== undefined ? String(row.saldoGranelBlanco) : '',
      saldoGranelTinto: row.saldoGranelTinto !== undefined ? String(row.saldoGranelTinto) : '',
      saldoEmbotelladoBlanco: row.saldoEmbotelladoBlanco !== undefined ? String(row.saldoEmbotelladoBlanco) : '',
      saldoEmbotelladoTinto: row.saldoEmbotelladoTinto !== undefined ? String(row.saldoEmbotelladoTinto) : '',
    });
    setIsPeModalOpen(true);
  };

  const handleSavePe = (e: React.FormEvent) => {
    e.preventDefault();
    const cant = parseOptNum(peForm.cantidadProducto) || 0;
    const grad = parseOptNum(peForm.gradoAlcoholico);
    const alcPuroParsed = parseOptNum(peForm.alcoholPuro);
    const alcPuro =
      alcPuroParsed !== undefined
        ? alcPuroParsed
        : grad !== undefined && cant > 0
        ? Number(((cant * grad) / 100).toFixed(2))
        : undefined;

    const payload = {
      numeroAsiento: Number(peForm.numeroAsiento) || 1,
      fechaMovimiento: peForm.fechaMovimiento,
      tipoMovimiento: peForm.tipoMovimiento.trim(),
      regimenFiscal: peForm.regimenFiscal.trim(),
      epigrafe: peForm.epigrafe.trim(),
      codigoNc: peForm.codigoNc.trim(),
      denominacionProducto: peForm.denominacionProducto.trim(),
      referenciaInterna: peForm.referenciaInterna.trim(),
      variedad: peForm.variedad.trim(),
      cantidadProducto: cant,
      gradoAlcoholico: grad,
      alcoholPuro: alcPuro,
      tipoJustificante: peForm.tipoJustificante.trim(),
      numeroJustificante: peForm.numeroJustificante.trim(),
      tipoEnvase: peForm.tipoEnvase.trim(),
      capacidadEnvase: peForm.capacidadEnvase.trim(),
      numeroEnvases: parseOptNum(peForm.numeroEnvases),
      origenDestinoNif: peForm.origenDestinoNif.trim(),
      origenDestinoRazonSocial: peForm.origenDestinoRazonSocial.trim(),
      origenDestinoCae: peForm.origenDestinoCae.trim(),
      saldoGranelBlanco: parseOptNum(peForm.saldoGranelBlanco),
      saldoGranelTinto: parseOptNum(peForm.saldoGranelTinto),
      saldoEmbotelladoBlanco: parseOptNum(peForm.saldoEmbotelladoBlanco),
      saldoEmbotelladoTinto: parseOptNum(peForm.saldoEmbotelladoTinto),
    };

    if (editingPeId) {
      updateAeatProductoElaborado(editingPeId, payload);
      showNotice(`Asiento Nº ${payload.numeroAsiento} actualizado en Libro de Producto Elaborado.`);
    } else {
      addAeatProductoElaborado(payload);
      showNotice(`Asiento Nº ${payload.numeroAsiento} añadido al Libro de Producto Elaborado.`);
    }
    setIsPeModalOpen(false);
  };

  const showPage1 = spreadView === 'completo' || spreadView === 'pag1';
  const showPage2 = spreadView === 'completo' || spreadView === 'pag2';

  return (
    <div className="space-y-4">
      {/* Header & Book Selector */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-stone-700" />
              <h2 className="text-xl font-bold font-serif-wine text-stone-900">
                Libros Agencia Tributaria (II.EE.)
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Registro automático en tiempo real (Recepción Uva ➔ Trasiegos/Mermas ➔ Embotellado ➔ Salidas) · {bodegaConfig.nombreBodega} · NIF {bodegaConfig.cifNif}
            </p>
          </div>

          {/* Book Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl self-start lg:self-auto">
            <button
              onClick={() => setActiveBook('materias_primas')}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeBook === 'materias_primas'
                  ? 'bg-stone-900 text-amber-200 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              1. Libro de Materias Primas ({aeatMateriasPrimas.length})
            </button>
            <button
              onClick={() => setActiveBook('producto_elaborado')}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeBook === 'producto_elaborado'
                  ? 'bg-stone-900 text-amber-200 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              2. Producto Elaborado ({aeatProductoElaborado.length})
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          {/* Page Spread Filter */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setSpreadView('completo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                spreadView === 'completo'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Libro Completo (2 Págs.)
            </button>
            <button
              onClick={() => setSpreadView('pag1')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                spreadView === 'pag1'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Página 1 (Izq.)
            </button>
            <button
              onClick={() => setSpreadView('pag2')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                spreadView === 'pag2'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Página 2 (Der.)
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {activeBook === 'materias_primas' ? (
              <>
                <button
                  onClick={() => {
                    const added = syncAeatMateriasPrimasFromVendimia();
                    showNotice(
                      added > 0
                        ? `Sincronizadas ${added} entradas nuevas desde Vendimia.`
                        : 'Libro de Materias Primas al día con todas las entradas de Vendimia.'
                    );
                  }}
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-sincronizar Vendimia</span>
                </button>
                <button
                  onClick={() =>
                    exportAeatMateriasPrimasExcel(
                      aeatMateriasPrimas,
                      aeatSumaAnterior,
                      bodegaConfig
                    )
                  }
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() =>
                    exportAeatMateriasPrimasPDF(
                      aeatMateriasPrimas,
                      aeatSumaAnterior,
                      bodegaConfig
                    )
                  }
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-300" />
                  <span>PDF AEAT</span>
                </button>
                <button
                  onClick={openCreateMp}
                  className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Asiento</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    const added = syncAeatProductoElaboradoFromBodega();
                    showNotice(
                      added > 0
                        ? `Sincronizados ${added} asientos nuevos desde la actividad de bodega y recalculados los saldos.`
                        : 'Todos los movimientos de bodega ya constan sincronizados con saldos actualizados.'
                    );
                  }}
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-sincronizar Bodega</span>
                </button>
                <button
                  onClick={() =>
                    exportAeatProductoElaboradoExcel(aeatProductoElaborado, bodegaConfig)
                  }
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() =>
                    exportAeatProductoElaboradoPDF(aeatProductoElaborado, bodegaConfig)
                  }
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-300" />
                  <span>PDF AEAT</span>
                </button>
                <button
                  onClick={openCreatePe}
                  className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Asiento</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LIBRO 1: LIBRO DE MATERIAS PRIMAS (FOTOS 8:47 PM)                     */}
      {/* ===================================================================== */}
      {activeBook === 'materias_primas' && (
        <div className="bg-white rounded-2xl border border-stone-300 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-stone-100 border-b border-stone-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-wide text-stone-900">
                LIBRO DE MATERIAS PRIMAS
              </h3>
              <p className="text-[11px] text-stone-500">
                Pág. 1: Nº de Orden, Observaciones, Fecha, Doc. Nº, NIF o CAE, Grado · Pág. 2: Entradas, Salidas y Existencias (Uvas, Bagazos, Mosto)
              </p>
            </div>
            <button
              onClick={() => {
                setSumaAntForm(aeatSumaAnterior);
                setIsSumaAntOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              Editar Suma Anterior
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-stone-900">
              <thead>
                <tr className="bg-stone-700 text-white text-[11px] font-bold tracking-wide">
                  {showPage1 && (
                    <>
                      <th rowSpan={2} className="border border-stone-500 px-2.5 py-2 text-center whitespace-nowrap">
                        Nº DE ORDEN
                      </th>
                      <th rowSpan={2} className="border border-stone-500 px-3 py-2 text-left min-w-[150px]">
                        OBSERVACIONES
                      </th>
                      <th rowSpan={2} className="border border-stone-500 px-2.5 py-2 text-center whitespace-nowrap">
                        FECHA
                      </th>
                      <th rowSpan={2} className="border border-stone-500 px-2.5 py-2 text-center whitespace-nowrap">
                        DOC. Nº
                      </th>
                      <th rowSpan={2} className="border border-stone-500 px-3 py-2 text-center whitespace-nowrap">
                        NIF O CAE
                      </th>
                      <th
                        rowSpan={2}
                        className={`border border-stone-500 px-2.5 py-2 text-center whitespace-nowrap ${
                          showPage2 ? 'border-r-2 border-r-stone-900' : ''
                        }`}
                      >
                        GRADO
                      </th>
                    </>
                  )}
                  {showPage2 && (
                    <>
                      <th colSpan={3} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        ENTRADAS
                      </th>
                      <th colSpan={3} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        SALIDAS
                      </th>
                      <th colSpan={3} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        EXISTENCIAS
                      </th>
                    </>
                  )}
                  <th rowSpan={2} className="border border-stone-500 px-2 py-2 text-center bg-stone-700 whitespace-nowrap">
                    ACCIONES
                  </th>
                </tr>

                {showPage2 && (
                  <tr className="bg-stone-600 text-white text-[10px] font-semibold">
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">UVAS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">BAGAZOS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">MOSTO (LITROS)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">UVAS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">BAGAZOS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">MOSTO (LITROS)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">UVAS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">BAGAZOS (KG)</th>
                    <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">MOSTO (LITROS)</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {/* SUMA ANTERIOR */}
                <tr className="bg-stone-100/90 font-bold text-stone-800">
                  {showPage1 && (
                    <td
                      colSpan={6}
                      className={`border border-stone-300 px-3 py-2 text-center tracking-wider ${
                        showPage2 ? 'border-r-2 border-r-stone-700' : ''
                      }`}
                    >
                      SUMA ANTERIOR
                    </td>
                  )}
                  {showPage2 && (
                    <>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.entradasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.entradasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.entradasMostoLitros)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.salidasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.salidasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.salidasMostoLitros)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.existenciasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.existenciasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                        {formatNum(aeatSumaAnterior.existenciasMostoLitros)}
                      </td>
                    </>
                  )}
                  <td className="border border-stone-300 px-2 py-2 text-center">
                    <button
                      onClick={() => {
                        setSumaAntForm(aeatSumaAnterior);
                        setIsSumaAntOpen(true);
                      }}
                      className="text-[11px] font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer"
                    >
                      Editar
                    </button>
                  </td>
                </tr>

                {/* DATA ROWS */}
                {aeatMateriasPrimas.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50 transition-colors">
                    {showPage1 && (
                      <>
                        <td className="border border-stone-300 px-2.5 py-2 text-center font-semibold tabular-nums">
                          {row.numeroOrden}
                        </td>
                        <td className="border border-stone-300 px-3 py-2 text-left text-stone-800">
                          <div>{row.observaciones}</div>
                          {(row.origenEntradaId || row.editadoManualmente) && (
                            <div className="text-[10px] text-stone-400 font-medium mt-0.5">
                              {row.editadoManualmente
                                ? 'Editado manualmente'
                                : 'Auto · Entrada Vendimia'}
                            </div>
                          )}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-center tabular-nums whitespace-nowrap">
                          {formatFechaEs(row.fecha)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-center tabular-nums">
                          {row.docNumero}
                        </td>
                        <td className="border border-stone-300 px-3 py-2 text-center font-mono text-[11px]">
                          {row.nifOCae}
                        </td>
                        <td
                          className={`border border-stone-300 px-2.5 py-2 text-center tabular-nums ${
                            showPage2 ? 'border-r-2 border-r-stone-700' : ''
                          }`}
                        >
                          {row.grado !== undefined ? String(row.grado).replace('.', ',') : ''}
                        </td>
                      </>
                    )}
                    {showPage2 && (
                      <>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums font-medium">
                          {formatNum(row.entradasUvasKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.entradasBagazosKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.entradasMostoLitros)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.salidasUvasKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums font-medium">
                          {formatNum(row.salidasBagazosKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.salidasMostoLitros)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.existenciasUvasKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums">
                          {formatNum(row.existenciasBagazosKg)}
                        </td>
                        <td className="border border-stone-300 px-2.5 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {formatNum(row.existenciasMostoLitros)}
                        </td>
                      </>
                    )}
                    <td className="border border-stone-300 px-2 py-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditMp(row)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded cursor-pointer"
                          title="Editar asiento"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteAeatMateriaPrima(row.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          title="Eliminar asiento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* SUMA Y SIGUE */}
                <tr className="bg-stone-200/80 font-bold text-stone-900">
                  {showPage1 && (
                    <td
                      colSpan={6}
                      className={`border border-stone-300 px-3 py-2.5 text-center tracking-wider ${
                        showPage2 ? 'border-r-2 border-r-stone-700' : ''
                      }`}
                    >
                      SUMA Y SIGUE
                    </td>
                  )}
                  {showPage2 && (
                    <>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.entradasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.entradasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.entradasMostoLitros)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.salidasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.salidasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.salidasMostoLitros)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.existenciasUvasKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.existenciasBagazosKg)}
                      </td>
                      <td className="border border-stone-300 px-2.5 py-2.5 text-right tabular-nums">
                        {formatSum(mpTotals.existenciasMostoLitros)}
                      </td>
                    </>
                  )}
                  <td className="border border-stone-300 px-2 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LIBRO 2: LIBRO DE PRODUCTO ELABORADO (FOTOS 8:50 Y 8:52 PM)           */}
      {/* ===================================================================== */}
      {activeBook === 'producto_elaborado' && (
        <div className="bg-white rounded-2xl border border-stone-300 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-stone-100 border-b border-stone-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-wide text-stone-900">
                LIBRO DE PRODUCTO ELABORADO (VINO Y BEBIDAS FERMENTADAS)
              </h3>
              <p className="text-[11px] text-stone-500">
                Pág. 1: Datos Movimiento y Producto · Pág. 2: Justificante, Envases, Origen/Destino y Saldos Existencias (Granel / Embotellado)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-700 tabular-nums">
              <span>
                Granel Blanco: <strong>{formatSum(peLatestBalances.granelBlanco)} L</strong>
              </span>
              <span className="text-stone-300">·</span>
              <span>
                Granel Tinto: <strong>{formatSum(peLatestBalances.granelTinto)} L</strong>
              </span>
              <span className="text-stone-300">·</span>
              <span>
                Emb. Blanco: <strong>{formatSum(peLatestBalances.embBlanco)} L</strong>
              </span>
              <span className="text-stone-300">·</span>
              <span>
                Emb. Tinto: <strong>{formatSum(peLatestBalances.embTinto)} L</strong>
              </span>
            </div>
          </div>

          {/* Movement Phase Filter */}
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['todos', `Todos (${peCounts.todos})`],
                ['entrada', `Entradas Mosto (${peCounts.entrada})`],
                ['elaboracion', `Trasiegos / Mermas (${peCounts.elaboracion})`],
                ['embotellado', `Embotellados (${peCounts.embotellado})`],
                ['salida', `Salidas (${peCounts.salida})`],
                ...(peCounts.manual > 0
                  ? [['manual', `Manuales (${peCounts.manual})`] as const]
                  : []),
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  peFilter === key
                    ? 'bg-stone-900 text-amber-200 font-semibold shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse text-stone-900">
              <thead>
                <tr className="bg-stone-700 text-white font-bold tracking-wide">
                  {showPage1 && (
                    <>
                      <th colSpan={4} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        DATOS MOVIMIENTO
                      </th>
                      <th
                        colSpan={8}
                        className={`border border-stone-500 px-2 py-1.5 text-center bg-stone-800 ${
                          showPage2 ? 'border-r-2 border-r-stone-950' : ''
                        }`}
                      >
                        PRODUCTO
                      </th>
                    </>
                  )}
                  {showPage2 && (
                    <>
                      {!showPage1 && (
                        <th rowSpan={2} className="border border-stone-500 px-2 py-2 text-center bg-stone-800 whitespace-nowrap">
                          Nº ASIENTO
                        </th>
                      )}
                      <th colSpan={2} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        JUSTIFICANTE
                      </th>
                      <th colSpan={3} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        ENVASES
                      </th>
                      <th colSpan={3} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        ORIGEN/DESTINO (MOVIMIENTOS EXTERNOS)
                      </th>
                      <th colSpan={2} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        SALDOS EXISTENCIAS GRANEL
                      </th>
                      <th colSpan={2} className="border border-stone-500 px-2 py-1.5 text-center bg-stone-800">
                        SALDOS EXISTENCIAS EMBOTELLADO
                      </th>
                    </>
                  )}
                  <th rowSpan={2} className="border border-stone-500 px-2 py-2 text-center bg-stone-700 whitespace-nowrap">
                    ACCIONES
                  </th>
                </tr>

                <tr className="bg-stone-600 text-white text-[10px] font-semibold">
                  {showPage1 && (
                    <>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">Nº ASIENTO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">FECHA MOVIMIENTO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">TIPO MOVIMIENTO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">RÉGIMEN FISCAL</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">EPÍGRAFE (3)</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">CÓDIGO NC</th>
                      <th className="border border-stone-500 px-2.5 py-1.5 text-left min-w-[170px]">
                        DENOMINACIÓN / DESCRIPCIÓN PRODUCTO
                      </th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">
                        REFERENCIA INTERNA PRODUCTO
                      </th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">VARIEDAD (4)</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">CANTIDAD DE PRODUCTO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">GRADO ALCOHÓLICO</th>
                      <th
                        className={`border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap ${
                          showPage2 ? 'border-r-2 border-r-stone-950' : ''
                        }`}
                      >
                        ALCOHOL PURO
                      </th>
                    </>
                  )}
                  {showPage2 && (
                    <>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">TIPO JUSTIF.</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">NÚMERO JUSTIFICANTE</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-left whitespace-nowrap">TIPO ENVASE</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">CAPACIDAD</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">Nº ENVASES</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">NIF</th>
                      <th className="border border-stone-500 px-2.5 py-1.5 text-left min-w-[130px]">RAZÓN SOCIAL</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-center whitespace-nowrap">CAE</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">BLANCO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">TINTO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">BLANCO</th>
                      <th className="border border-stone-500 px-2 py-1.5 text-right whitespace-nowrap">TINTO</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredPe.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showPage1 && showPage2 ? 25 : showPage1 ? 13 : 14}
                      className="border border-stone-300 px-6 py-10 text-center bg-stone-50/60"
                    >
                      <p className="text-sm font-semibold text-stone-800">
                        {aeatProductoElaborado.length === 0
                          ? 'Sin asientos anotados en el Libro de Producto Elaborado'
                          : 'No hay asientos para el tipo de movimiento seleccionado'}
                      </p>
                      <p className="text-xs text-stone-500 mt-1 max-w-lg mx-auto">
                        {aeatProductoElaborado.length === 0
                          ? 'Todos los movimientos desde Recepción de Uva hasta Salida de Botellas se registran automáticamente en este libro.'
                          : 'Selecciona otro filtro o visualiza todos los asientos del libro.'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        {aeatProductoElaborado.length === 0 ? (
                          <>
                            <button
                              onClick={openCreatePe}
                              className="min-h-[40px] px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              + Añadir Asiento Manual
                            </button>
                            <button
                              onClick={() => {
                                const added = syncAeatProductoElaboradoFromBodega();
                                showNotice(
                                  added > 0
                                    ? `Generados ${added} asientos desde la actividad de bodega.`
                                    : 'No hay movimientos pendientes por sincronizar.'
                                );
                              }}
                              className="min-h-[40px] px-4 py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              Sincronizar Bodega
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPeFilter('todos')}
                            className="min-h-[40px] px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Ver Todos los Asientos
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPe.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50 transition-colors">
                      {showPage1 && (
                        <>
                          <td className="border border-stone-300 px-2 py-2 text-center font-semibold tabular-nums">
                            {row.numeroAsiento}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center tabular-nums whitespace-nowrap">
                            {formatFechaEs(row.fechaMovimiento)}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left whitespace-nowrap">
                            <div>{row.tipoMovimiento}</div>
                            <div className="text-[10px] text-stone-400 font-medium">
                              {row.editadoManualmente
                                ? 'Manual / Editado'
                                : row.origenTipo && row.origenTipo !== 'manual'
                                ? 'Auto · Bodega'
                                : 'Manual'}
                            </div>
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left whitespace-nowrap">
                            {row.regimenFiscal}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center">
                            {row.epigrafe}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center font-mono">
                            {row.codigoNc}
                          </td>
                          <td className="border border-stone-300 px-2.5 py-2 text-left font-medium text-stone-900">
                            {row.denominacionProducto}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left font-mono">
                            {row.referenciaInterna}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left">
                            {row.variedad}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums font-medium">
                            {formatSum(row.cantidadProducto)}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums">
                            {row.gradoAlcoholico !== undefined
                              ? String(row.gradoAlcoholico).replace('.', ',')
                              : ''}
                          </td>
                          <td
                            className={`border border-stone-300 px-2 py-2 text-right tabular-nums ${
                              showPage2 ? 'border-r-2 border-r-stone-700' : ''
                            }`}
                          >
                            {row.alcoholPuro !== undefined
                              ? formatNum(row.alcoholPuro, 2)
                              : ''}
                          </td>
                        </>
                      )}
                      {showPage2 && (
                        <>
                          {!showPage1 && (
                            <td className="border border-stone-300 px-2 py-2 text-center font-semibold tabular-nums">
                              {row.numeroAsiento}
                            </td>
                          )}
                          <td className="border border-stone-300 px-2 py-2 text-left whitespace-nowrap">
                            {row.tipoJustificante}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left font-mono whitespace-nowrap">
                            {row.numeroJustificante}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-left whitespace-nowrap">
                            {row.tipoEnvase}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center whitespace-nowrap">
                            {row.capacidadEnvase}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums">
                            {formatNum(row.numeroEnvases)}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center font-mono">
                            {row.origenDestinoNif}
                          </td>
                          <td className="border border-stone-300 px-2.5 py-2 text-left">
                            {row.origenDestinoRazonSocial}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-center font-mono">
                            {row.origenDestinoCae}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums font-medium">
                            {row.saldoGranelBlanco !== undefined ? formatSum(row.saldoGranelBlanco) : ''}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums font-medium">
                            {row.saldoGranelTinto !== undefined ? formatSum(row.saldoGranelTinto) : ''}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums font-medium">
                            {row.saldoEmbotelladoBlanco !== undefined ? formatSum(row.saldoEmbotelladoBlanco) : ''}
                          </td>
                          <td className="border border-stone-300 px-2 py-2 text-right tabular-nums font-medium">
                            {row.saldoEmbotelladoTinto !== undefined ? formatSum(row.saldoEmbotelladoTinto) : ''}
                          </td>
                        </>
                      )}
                      <td className="border border-stone-300 px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditPe(row)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded cursor-pointer"
                            title="Editar asiento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteAeatProductoElaborado(row.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Eliminar asiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SUMA ANTERIOR (MATERIAS PRIMAS)                                */}
      {/* ===================================================================== */}
      {isSumaAntOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-base font-serif-wine">
                Suma Anterior · Libro de Materias Primas
              </h3>
              <button
                onClick={() => setIsSumaAntOpen(false)}
                className="text-stone-300 hover:text-white p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateAeatSumaAnterior(sumaAntForm);
                setIsSumaAntOpen(false);
                showNotice('Suma Anterior actualizada.');
              }}
              className="p-5 space-y-4 text-xs overflow-y-auto"
            >
              {(
                [
                  {
                    group: 'ENTRADAS (Arrastre)',
                    fields: [
                      ['entradasUvasKg', 'Uvas (kg)'],
                      ['entradasBagazosKg', 'Bagazos (kg)'],
                      ['entradasMostoLitros', 'Mosto (litros)'],
                    ],
                  },
                  {
                    group: 'SALIDAS (Arrastre)',
                    fields: [
                      ['salidasUvasKg', 'Uvas (kg)'],
                      ['salidasBagazosKg', 'Bagazos (kg)'],
                      ['salidasMostoLitros', 'Mosto (litros)'],
                    ],
                  },
                  {
                    group: 'EXISTENCIAS (Arrastre)',
                    fields: [
                      ['existenciasUvasKg', 'Uvas (kg)'],
                      ['existenciasBagazosKg', 'Bagazos (kg)'],
                      ['existenciasMostoLitros', 'Mosto (litros)'],
                    ],
                  },
                ] as const
              ).map((sec) => (
                <div key={sec.group} className="space-y-2">
                  <div className="font-bold text-stone-700">{sec.group}</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {sec.fields.map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-stone-600 mb-1">{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={sumaAntForm[key]}
                          onChange={(e) =>
                            setSumaAntForm({
                              ...sumaAntForm,
                              [key]: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSumaAntOpen(false)}
                  className="min-h-[40px] px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 bg-rose-900 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Guardar Suma Anterior
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NUEVO / EDITAR ASIENTO MATERIAS PRIMAS                         */}
      {/* ===================================================================== */}
      {isMpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-base font-serif-wine">
                {editingMpId ? 'Editar Asiento' : 'Nuevo Asiento'} · Libro de Materias Primas
              </h3>
              <button
                onClick={() => setIsMpModalOpen(false)}
                className="text-stone-300 hover:text-white p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMp} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="font-bold text-stone-700 border-b border-stone-200 pb-1">
                Página 1 · Identificación de Operación
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº de Orden *</label>
                  <input
                    type="number"
                    required
                    value={mpForm.numeroOrden}
                    onChange={(e) => setMpForm({ ...mpForm, numeroOrden: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={mpForm.fecha}
                    onChange={(e) => setMpForm({ ...mpForm, fecha: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grado</label>
                  <input
                    type="text"
                    placeholder="ej. 12,2"
                    value={mpForm.grado}
                    onChange={(e) => setMpForm({ ...mpForm, grado: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-medium text-stone-700 mb-1">Observaciones</label>
                  <input
                    type="text"
                    value={mpForm.observaciones}
                    onChange={(e) => setMpForm({ ...mpForm, observaciones: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Doc. Nº</label>
                  <input
                    type="text"
                    value={mpForm.docNumero}
                    onChange={(e) => setMpForm({ ...mpForm, docNumero: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">NIF o CAE</label>
                  <input
                    type="text"
                    value={mpForm.nifOCae}
                    onChange={(e) => setMpForm({ ...mpForm, nifOCae: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="font-bold text-stone-700 border-b border-stone-200 pb-1 pt-2">
                Página 2 · Entradas, Salidas y Existencias
              </div>

              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-stone-600 mb-1.5">ENTRADAS</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-stone-600 mb-1">Uvas (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.entradasUvasKg}
                        onChange={(e) => setMpForm({ ...mpForm, entradasUvasKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Bagazos (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.entradasBagazosKg}
                        onChange={(e) => setMpForm({ ...mpForm, entradasBagazosKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Mosto (Litros)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.entradasMostoLitros}
                        onChange={(e) => setMpForm({ ...mpForm, entradasMostoLitros: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-stone-600 mb-1.5">SALIDAS</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-stone-600 mb-1">Uvas (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.salidasUvasKg}
                        onChange={(e) => setMpForm({ ...mpForm, salidasUvasKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Bagazos (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.salidasBagazosKg}
                        onChange={(e) => setMpForm({ ...mpForm, salidasBagazosKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Mosto (Litros)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.salidasMostoLitros}
                        onChange={(e) => setMpForm({ ...mpForm, salidasMostoLitros: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-stone-600 mb-1.5">EXISTENCIAS</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-stone-600 mb-1">Uvas (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.existenciasUvasKg}
                        onChange={(e) => setMpForm({ ...mpForm, existenciasUvasKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Bagazos (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.existenciasBagazosKg}
                        onChange={(e) => setMpForm({ ...mpForm, existenciasBagazosKg: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 mb-1">Mosto (Litros)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mpForm.existenciasMostoLitros}
                        onChange={(e) => setMpForm({ ...mpForm, existenciasMostoLitros: e.target.value })}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMpModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 bg-rose-900 text-white rounded-xl font-semibold cursor-pointer"
                >
                  {editingMpId ? 'Guardar Cambios' : 'Añadir Asiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NUEVO / EDITAR ASIENTO PRODUCTO ELABORADO                      */}
      {/* ===================================================================== */}
      {isPeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-base font-serif-wine">
                {editingPeId ? 'Editar Asiento' : 'Nuevo Asiento'} · Libro de Producto Elaborado
              </h3>
              <button
                onClick={() => setIsPeModalOpen(false)}
                className="text-stone-300 hover:text-white p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePe} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="font-bold text-stone-700 border-b border-stone-200 pb-1">
                Página 1 · Datos Movimiento y Producto
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Asiento *</label>
                  <input
                    type="number"
                    required
                    value={peForm.numeroAsiento}
                    onChange={(e) => setPeForm({ ...peForm, numeroAsiento: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Fecha Movimiento *</label>
                  <input
                    type="date"
                    required
                    value={peForm.fechaMovimiento}
                    onChange={(e) => setPeForm({ ...peForm, fechaMovimiento: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo Movimiento *</label>
                  <input
                    type="text"
                    required
                    value={peForm.tipoMovimiento}
                    onChange={(e) => setPeForm({ ...peForm, tipoMovimiento: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Régimen Fiscal</label>
                  <input
                    type="text"
                    value={peForm.regimenFiscal}
                    onChange={(e) => setPeForm({ ...peForm, regimenFiscal: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Epígrafe (3)</label>
                  <input
                    type="text"
                    value={peForm.epigrafe}
                    onChange={(e) => setPeForm({ ...peForm, epigrafe: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Código NC</label>
                  <input
                    type="text"
                    value={peForm.codigoNc}
                    onChange={(e) => setPeForm({ ...peForm, codigoNc: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-stone-700 mb-1">Denominación / Descripción Producto *</label>
                  <input
                    type="text"
                    required
                    value={peForm.denominacionProducto}
                    onChange={(e) => setPeForm({ ...peForm, denominacionProducto: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ref. Interna Producto</label>
                  <input
                    type="text"
                    value={peForm.referenciaInterna}
                    onChange={(e) => setPeForm({ ...peForm, referenciaInterna: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Variedad (4)</label>
                  <input
                    type="text"
                    value={peForm.variedad}
                    onChange={(e) => setPeForm({ ...peForm, variedad: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidad Producto (L) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={peForm.cantidadProducto}
                    onChange={(e) => setPeForm({ ...peForm, cantidadProducto: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grado Alcohólico (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={peForm.gradoAlcoholico}
                    onChange={(e) => setPeForm({ ...peForm, gradoAlcoholico: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Alcohol Puro (auto si vacío)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={peForm.alcoholPuro}
                    onChange={(e) => setPeForm({ ...peForm, alcoholPuro: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="font-bold text-stone-700 border-b border-stone-200 pb-1 pt-2">
                Página 2 · Justificante, Envases, Origen/Destino y Saldos Existencias
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo Justif.</label>
                  <input
                    type="text"
                    value={peForm.tipoJustificante}
                    onChange={(e) => setPeForm({ ...peForm, tipoJustificante: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Número Justificante</label>
                  <input
                    type="text"
                    value={peForm.numeroJustificante}
                    onChange={(e) => setPeForm({ ...peForm, numeroJustificante: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo Envase</label>
                  <input
                    type="text"
                    value={peForm.tipoEnvase}
                    onChange={(e) => setPeForm({ ...peForm, tipoEnvase: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Capacidad</label>
                  <input
                    type="text"
                    value={peForm.capacidadEnvase}
                    onChange={(e) => setPeForm({ ...peForm, capacidadEnvase: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Envases</label>
                  <input
                    type="number"
                    value={peForm.numeroEnvases}
                    onChange={(e) => setPeForm({ ...peForm, numeroEnvases: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Origen/Destino NIF</label>
                  <input
                    type="text"
                    value={peForm.origenDestinoNif}
                    onChange={(e) => setPeForm({ ...peForm, origenDestinoNif: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={peForm.origenDestinoRazonSocial}
                    onChange={(e) => setPeForm({ ...peForm, origenDestinoRazonSocial: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">CAE</label>
                  <input
                    type="text"
                    value={peForm.origenDestinoCae}
                    onChange={(e) => setPeForm({ ...peForm, origenDestinoCae: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Saldo Granel Blanco</label>
                  <input
                    type="number"
                    step="0.01"
                    value={peForm.saldoGranelBlanco}
                    onChange={(e) => setPeForm({ ...peForm, saldoGranelBlanco: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Saldo Granel Tinto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={peForm.saldoGranelTinto}
                    onChange={(e) => setPeForm({ ...peForm, saldoGranelTinto: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Saldo Emb. Blanco</label>
                  <input
                    type="number"
                    step="0.01"
                    value={peForm.saldoEmbotelladoBlanco}
                    onChange={(e) => setPeForm({ ...peForm, saldoEmbotelladoBlanco: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Saldo Emb. Tinto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={peForm.saldoEmbotelladoTinto}
                    onChange={(e) => setPeForm({ ...peForm, saldoEmbotelladoTinto: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPeModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 bg-rose-900 text-white rounded-xl font-semibold cursor-pointer"
                >
                  {editingPeId ? 'Guardar Cambios' : 'Añadir Asiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

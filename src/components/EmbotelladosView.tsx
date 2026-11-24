import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileCheck2,
  GitBranch,
  Package,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  EmbotelladoRegistro,
  MARCAS_COMERCIALES,
  MarcaVino,
  TIPOS_VINO,
  TipoBotella,
  TipoCaja,
  TipoCorcho,
  TipoEtiqueta,
  TipoLacre,
  TipoVino,
} from '../types/winery';
import { formatLoteComercialAppcc } from '../data/appccManualData';
import { exportLotAuditDossierPDF } from '../utils/exportUtils';
import {
  TIPO_VINO_THEME,
  inferTipoEtiquetaFromMarca,
  inferTipoVinoFromMarca,
  inferTipoVinoFromVarieties,
  resolveEmbotelladoTipoVino,
} from '../utils/wineType';
import { getLocalIsoDate } from '../utils/dateUtils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const MARCAS_DISPONIBLES: MarcaVino[] = MARCAS_COMERCIALES;

interface EmbotelladosViewProps {
  initialOpenModal?: boolean;
  preselectedDepositoId?: string;
  onNavigateToTraceability?: (lote: string) => void;
  onNavigateToSalidas?: (lote: string) => void;
}

export const EmbotelladosView: React.FC<EmbotelladosViewProps> = ({
  initialOpenModal = false,
  preselectedDepositoId,
  onNavigateToTraceability,
  onNavigateToSalidas,
}) => {
  const {
    bodegaConfig,
    parcelas,
    depositos,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
    addEmbotellado,
    updateEmbotellado,
    deleteEmbotellado,
    checkReferentialIntegrity,
  } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarcaFilter, setSelectedMarcaFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [editingEmbotellado, setEditingEmbotellado] = useState<EmbotelladoRegistro | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    embId: string;
    embLote: string;
    canDelete: boolean;
    warning?: string;
    details: string[];
  }>({
    isOpen: false,
    embId: '',
    embLote: '',
    canDelete: true,
    details: [],
  });

  // Form State
  const [formData, setFormData] = useState<{
    fecha: string;
    marca: MarcaVino;
    tipoVino: TipoVino;
    anada: number;
    depositoProcedenciaId: string;
    cantidadLitros: number;
    etiquetado: boolean;
    lote: string;
    graduacionAlcoholicaVol?: number;
    tipoCorcho: TipoCorcho;
    tipoBotella: TipoBotella;
    lacre: boolean;
    colorLacre?: TipoLacre;
    tipoEtiqueta: TipoEtiqueta;
    tipoCaja: TipoCaja;
    observaciones: string;
  }>({
    fecha: getLocalIsoDate(),
    marca: 'Xouba',
    tipoVino: 'Blanco',
    anada: Number(bodegaConfig.anoCampana) || new Date().getFullYear(),
    depositoProcedenciaId: preselectedDepositoId || depositos[0]?.id || '1',
    cantidadLitros: 750,
    etiquetado: true,
    lote: formatLoteComercialAppcc('Xouba', 1, bodegaConfig.anoCampana),
    graduacionAlcoholicaVol: 12.8,
    tipoCorcho: '1+1',
    tipoBotella: 'verde',
    lacre: false,
    colorLacre: 'Rojo Burdeos',
    tipoEtiqueta: 'xouba',
    tipoCaja: '6 botellas',
    observaciones: '',
  });

  const inferTipoVinoForTank = (depId: string, fallbackMarca: MarcaVino): TipoVino => {
    const elab = elaboraciones.find(
      (e) => (e.depositoDestinoId === depId || e.depositoOrigenId === depId) && e.tipoVino
    );
    if (elab?.tipoVino) return elab.tipoVino;
    const ent = entradasUva.find((e) => e.depositoDestinoId === depId);
    if (ent?.tipoVino) return ent.tipoVino;
    const dep = depositos.find((d) => d.id === depId);
    if (dep && (dep.variedades.length > 0 || dep.vinoNombre)) {
      return inferTipoVinoFromVarieties(dep.variedades, dep.vinoNombre);
    }
    return inferTipoVinoFromMarca(fallbackMarca);
  };

  const inferAnadaForTank = (depId: string, fallbackYear: number): number => {
    const elab = elaboraciones.find(
      (e) => (e.depositoDestinoId === depId || e.depositoOrigenId === depId) && e.anada
    );
    if (elab?.anada) return elab.anada;
    const ent = entradasUva.find((e) => e.depositoDestinoId === depId && e.anada);
    if (ent?.anada) return ent.anada;
    const dep = depositos.find((d) => d.id === depId);
    return dep?.anoCosecha || fallbackYear;
  };

  const inferGradoForTank = (depId: string): number => {
    const elab = elaboraciones.find(
      (e) => (e.depositoDestinoId === depId || e.depositoOrigenId === depId) && e.gradoAlcoholico !== undefined
    );
    if (elab?.gradoAlcoholico !== undefined) return elab.gradoAlcoholico;
    const ent = entradasUva.find((e) => e.depositoDestinoId === depId && e.gradoBaboBaume !== undefined);
    if (ent?.gradoBaboBaume !== undefined) return ent.gradoBaboBaume;
    return 12.8;
  };

  // Automatic calculation of 0.75L bottles
  const calculatedBotellas = Math.floor(formData.cantidadLitros / 0.75);
  const calculatedBoxes = Math.ceil(
    calculatedBotellas / (formData.tipoCaja === '2 botellas' ? 2 : formData.tipoCaja === '3 botellas' ? 3 : 6)
  );

  const lastHandledOpenRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialOpenModal) {
      const openKey = `${initialOpenModal}-${preselectedDepositoId || ''}`;
      if (lastHandledOpenRef.current !== openKey) {
        lastHandledOpenRef.current = openKey;
        handleOpenAddModal(preselectedDepositoId);
      }
    } else {
      lastHandledOpenRef.current = null;
    }
  }, [initialOpenModal, preselectedDepositoId]);

  const handleOpenAddModal = (depId?: string) => {
    setFormError(null);
    setEditingEmbotellado(null);
    const chosenDep =
      (depId ? depositos.find((d) => d.id === depId) : undefined) ||
      depositos.find((d) => d.litrosActuales > 0) ||
      depositos[0];
    const defaultDepId = chosenDep ? chosenDep.id : '1';
    const defaultMarca: MarcaVino = 'Xouba';
    const tagKey = inferTipoEtiquetaFromMarca(defaultMarca);
    const today = getLocalIsoDate();
    const inferredAnada = inferAnadaForTank(defaultDepId, Number(today.slice(0, 4)));

    setFormData({
      fecha: today,
      marca: defaultMarca,
      tipoVino: inferTipoVinoForTank(defaultDepId, defaultMarca),
      anada: inferredAnada,
      depositoProcedenciaId: defaultDepId,
      cantidadLitros: chosenDep && chosenDep.litrosActuales >= 750 ? 750 : chosenDep?.litrosActuales || 750,
      etiquetado: true,
      lote: formatLoteComercialAppcc(defaultMarca, embotellados.filter((e) => e.marca === defaultMarca).length + 1, inferredAnada),
      graduacionAlcoholicaVol: inferGradoForTank(defaultDepId),
      tipoCorcho: 'natural',
      tipoBotella: 'verde',
      lacre: false,
      colorLacre: 'Rojo Burdeos',
      tipoEtiqueta: tagKey,
      tipoCaja: '6 botellas',
      observaciones: 'Llenado y tapado con atmósfera inerte.',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emb: EmbotelladoRegistro) => {
    setFormError(null);
    setEditingEmbotellado(emb);
    setFormData({
      fecha: emb.fecha,
      marca: emb.marca,
      tipoVino: resolveEmbotelladoTipoVino(emb, { entradasUva, elaboraciones, depositos }),
      anada: emb.anada || inferAnadaForTank(emb.depositoProcedenciaId, Number(emb.fecha.slice(0, 4))),
      depositoProcedenciaId: emb.depositoProcedenciaId,
      cantidadLitros: emb.cantidadLitros,
      etiquetado: emb.etiquetado,
      lote: emb.lote,
      graduacionAlcoholicaVol: emb.graduacionAlcoholicaVol ?? inferGradoForTank(emb.depositoProcedenciaId),
      tipoCorcho: emb.insumos.tipoCorcho,
      tipoBotella: emb.insumos.tipoBotella,
      lacre: emb.insumos.lacre,
      colorLacre: emb.insumos.colorLacre,
      tipoEtiqueta: emb.insumos.tipoEtiqueta,
      tipoCaja: emb.insumos.tipoCaja,
      observaciones: emb.observaciones || '',
    });
    setIsModalOpen(true);
  };

  const handleMarcaChange = (newMarca: MarcaVino) => {
    const nextNum = embotellados.filter((e) => e.marca === newMarca).length + 1;
    setFormData({
      ...formData,
      marca: newMarca,
      tipoVino: inferTipoVinoFromMarca(newMarca),
      tipoEtiqueta: inferTipoEtiquetaFromMarca(newMarca),
      lote: formatLoteComercialAppcc(newMarca, nextNum, formData.anada || bodegaConfig.anoCampana),
      tipoBotella: newMarca === 'Rosado' ? 'transparente' : formData.tipoBotella,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cantidadLitros <= 0) {
      setFormError('La cantidad en litros debe ser mayor que 0.');
      return;
    }
    setFormError(null);

    if (editingEmbotellado) {
      updateEmbotellado(editingEmbotellado.id, {
        fecha: formData.fecha,
        marca: formData.marca,
        tipoVino: formData.tipoVino,
        anada: formData.anada,
        depositoProcedenciaId: formData.depositoProcedenciaId,
        cantidadLitros: formData.cantidadLitros,
        etiquetado: formData.etiquetado,
        lote: formData.lote,
        graduacionAlcoholicaVol: formData.graduacionAlcoholicaVol,
        observaciones: formData.observaciones,
        insumos: {
          tipoCorcho: formData.tipoCorcho,
          tipoBotella: formData.tipoBotella,
          lacre: formData.lacre,
          colorLacre: formData.colorLacre,
          tipoEtiqueta: formData.tipoEtiqueta,
          tipoCaja: formData.tipoCaja,
          cajasUtilizadas: calculatedBoxes,
        },
      });
    } else {
      addEmbotellado({
        fecha: formData.fecha,
        marca: formData.marca,
        tipoVino: formData.tipoVino,
        anada: formData.anada,
        depositoProcedenciaId: formData.depositoProcedenciaId,
        cantidadLitros: formData.cantidadLitros,
        etiquetado: formData.etiquetado,
        lote: formData.lote,
        graduacionAlcoholicaVol: formData.graduacionAlcoholicaVol,
        observaciones: formData.observaciones,
        insumos: {
          tipoCorcho: formData.tipoCorcho,
          tipoBotella: formData.tipoBotella,
          lacre: formData.lacre,
          colorLacre: formData.colorLacre,
          tipoEtiqueta: formData.tipoEtiqueta,
          tipoCaja: formData.tipoCaja,
          cajasUtilizadas: calculatedBoxes,
        },
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (emb: EmbotelladoRegistro) => {
    const check = checkReferentialIntegrity('embotellado', emb.id);
    setDeleteConfirm({
      isOpen: true,
      embId: emb.id,
      embLote: emb.lote,
      canDelete: check.canDelete,
      warning: check.warning,
      details: check.details,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.canDelete) {
      deleteEmbotellado(deleteConfirm.embId);
      setDeleteConfirm({ ...deleteConfirm, isOpen: false });
    }
  };

  const handleExportAuditDossier = (lote: string) => {
    exportLotAuditDossierPDF(lote, {
      config: bodegaConfig,
      parcelas,
      depositos,
      entradas: entradasUva,
      elaboraciones,
      embotellados,
      salidas,
    });
  };

  // Filtered embotellados
  const filteredEmbotellados = embotellados.filter((emb) => {
    const matchesSearch =
      emb.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emb.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emb.depositoProcedenciaId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emb.observaciones && emb.observaciones.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMarca = !selectedMarcaFilter || emb.marca === selectedMarcaFilter;

    return matchesSearch && matchesMarca;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Embotellados y Lotes
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Cálculo automático de botellas 0,75L, etiquetado e insumos.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Embotellado</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por lote, marca, depósito..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMarcaFilter}
            onChange={(e) => setSelectedMarcaFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white text-stone-700"
          >
            <option value="">Todas las Marcas</option>
            {Array.from(
              new Set<MarcaVino>([
                ...MARCAS_DISPONIBLES,
                ...embotellados.map((e) => e.marca),
              ])
            )
              .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">
            {filteredEmbotellados.length} lotes
          </span>
        </div>
      </div>

      {/* Wine color visual legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 px-1">
        <span className="font-semibold text-stone-700">Visualización por tipo de vino:</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Blanco (verde pastel)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-100 text-pink-900 border border-pink-300 font-semibold">
          <span className="w-2 h-2 rounded-full bg-pink-500" />
          Rosado (rosa pastel)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-900 border border-red-300 font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Tinto (rojo pastel)
        </span>
      </div>

      {/* Embotellados Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEmbotellados.map((emb) => {
          const salidasLote = salidas
            .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
            .reduce((sum, s) => sum + s.cantidadBotellas, 0);

          const pctVendido = emb.cantidadBotellas075 > 0 ? Math.round((salidasLote / emb.cantidadBotellas075) * 100) : 0;
          const tipoVino = resolveEmbotelladoTipoVino(emb, { entradasUva, elaboraciones, depositos });
          const theme = TIPO_VINO_THEME[tipoVino];

          return (
            <div
              key={emb.id}
              className={`rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${theme.card}`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 tracking-wider uppercase block tabular-nums">
                      {emb.fecha} • Dep. {emb.depositoProcedenciaId} • Añada {emb.anada || emb.fecha.slice(0, 4)}
                      {emb.graduacionAlcoholicaVol !== undefined ? ` • ${emb.graduacionAlcoholicaVol}% vol` : ''}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <h3 className="text-xl font-bold font-serif-wine text-stone-900">{emb.marca}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${theme.badge}`}
                      >
                        {tipoVino}
                      </span>
                    </div>
                    <div className="inline-block mt-1 font-mono font-bold text-xs bg-white/85 text-stone-800 px-2 py-0.5 rounded border border-stone-200">
                      {emb.lote}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(emb)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-white/70 rounded-xl transition-colors cursor-pointer"
                      title="Modificar embotellado"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(emb)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-500 hover:text-rose-700 hover:bg-white/70 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar embotellado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Key volume stats */}
                <div className={`grid grid-cols-2 gap-2 my-3 p-3 rounded-xl text-center ${theme.inner}`}>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Vino Envasado</span>
                    <span className="text-base font-bold text-stone-900">{emb.cantidadLitros.toLocaleString('es-ES')} L</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Botellas 0,75L</span>
                    <span className="text-base font-bold text-rose-900">{emb.cantidadBotellas075.toLocaleString('es-ES')} bot.</span>
                  </div>
                </div>

                {/* Stock bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span className="font-semibold text-emerald-800">
                      Disponibles: {emb.botellasDisponibles.toLocaleString('es-ES')} bot.
                    </span>
                    <span className="text-stone-500">
                      Expedidas: {salidasLote} ({pctVendido}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden border border-stone-200/70">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.max(0, 100 - pctVendido)}%` }}
                    />
                  </div>
                </div>

                {/* Insumos & Etiquetado badges */}
                <div className="space-y-1.5 text-xs text-stone-700 pt-2 border-t border-stone-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Etiquetado:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emb.etiquetado
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {emb.etiquetado ? 'SÍ (Vestido)' : 'NO (En rima)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Corcho:</span>
                    <span className="font-medium text-stone-800 capitalize">
                      {emb.insumos.tipoCorcho === 'natural' ? 'Natural Extra' : 'Técnico 1+1'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Botella:</span>
                    <span className="font-medium text-stone-800 capitalize">
                      {emb.insumos.tipoBotella === 'verde' ? 'Verde canela' : 'Transparente'}
                    </span>
                  </div>

                  {emb.insumos.lacre && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Sellado:</span>
                      <span className="font-medium text-rose-800">
                        Lacre {emb.insumos.colorLacre || 'Rojo'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Embalaje:</span>
                    <span className="font-medium text-stone-800">
                      Cajas {emb.insumos.tipoCaja} ({emb.insumos.cajasUtilizadas || 0} cajas)
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Traceability & Audit Download */}
              <div className={`p-3 flex items-center justify-between gap-2 ${theme.footer}`}>
                <button
                  onClick={() => handleExportAuditDossier(emb.lote)}
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Descargar Ficha Oficial de Trazabilidad del Lote en PDF"
                >
                  <Download className="w-3.5 h-3.5 text-rose-800" />
                  <span>PDF</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {onNavigateToSalidas && emb.botellasDisponibles > 0 && (
                    <button
                      onClick={() => onNavigateToSalidas(emb.lote)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer"
                    >
                      + Salida
                    </button>
                  )}
                  {onNavigateToTraceability && (
                    <button
                      onClick={() => onNavigateToTraceability(emb.lote)}
                      className="min-h-[40px] flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-900 hover:bg-rose-800 rounded-xl cursor-pointer shadow-2xs"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-amber-300" />
                      <span>Trazar 360º</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Embotellado Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wine className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  {editingEmbotellado ? `Modificar Embotellado: ${editingEmbotellado.lote}` : 'Nuevo Embotellado y Lote'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-sm text-stone-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Fecha de Embotellado *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Marca de Vino *</label>
                  <select
                    required
                    value={formData.marca}
                    onChange={(e) => handleMarcaChange(e.target.value as MarcaVino)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-serif-wine font-bold text-rose-950"
                  >
                    {(formData.marca && !MARCAS_DISPONIBLES.includes(formData.marca)
                      ? [...MARCAS_DISPONIBLES, formData.marca]
                      : [...MARCAS_DISPONIBLES]
                    )
                      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
                      .map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Depósito procedencia & Litros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Depósito de Procedencia *</label>
                  <select
                    required
                    value={formData.depositoProcedenciaId}
                    onChange={(e) => {
                      const depId = e.target.value;
                      setFormData({
                        ...formData,
                        depositoProcedenciaId: depId,
                        tipoVino: inferTipoVinoForTank(depId, formData.marca),
                        anada: inferAnadaForTank(depId, formData.anada),
                        graduacionAlcoholicaVol: inferGradoForTank(depId),
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
                  >
                    {[...depositos]
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} - {d.nombre} ({d.litrosActuales} L disponibles)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidad de Litros a Envasar *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={formData.cantidadLitros}
                      onChange={(e) => setFormData({ ...formData, cantidadLitros: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-8 font-semibold text-stone-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">L</span>
                  </div>
                </div>
              </div>

              {/* Automatic Bottle Calculation Highlight Box */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-rose-900 uppercase tracking-wider block">
                    Cálculo Automático Botellas 0,75L
                  </span>
                  <span className="text-xs text-stone-600">
                    Fórmula legal: {formData.cantidadLitros} L / 0.75 L por botella
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-rose-900">
                    {calculatedBotellas.toLocaleString('es-ES')}
                  </div>
                  <span className="text-[10px] text-rose-700 font-bold uppercase">Botellas Resultantes</span>
                </div>
              </div>

              {/* Lote and Etiquetado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Número de Lote Oficial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. L-24-XOU-01"
                    value={formData.lote}
                    onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">¿Etiquetado Inmediato? *</label>
                  <select
                    value={formData.etiquetado ? 'si' : 'no'}
                    onChange={(e) => setFormData({ ...formData, etiquetado: e.target.value === 'si' })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="no">NO - Conservar en rima (Afinamiento sin etiquetar)</option>
                    <option value="si">SÍ - Botellas vestidas y listas para venta</option>
                  </select>
                </div>
              </div>

              {/* Insumos Consumidos Section */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-stone-600" />
                  <h4 className="font-semibold text-stone-900 text-xs uppercase tracking-wider">
                    Insumos del Embotellado (Descuento Automático en Almacén)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de Corcho</label>
                    <select
                      value={formData.tipoCorcho}
                      onChange={(e) => setFormData({ ...formData, tipoCorcho: e.target.value as TipoCorcho })}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="natural">Corcho Natural Extra (Flor)</option>
                      <option value="1+1">Corcho Técnico 1+1</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de Botella</label>
                    <select
                      value={formData.tipoBotella}
                      onChange={(e) => setFormData({ ...formData, tipoBotella: e.target.value as TipoBotella })}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="transparente">Borgoña Transparente Flint (750ml)</option>
                      <option value="verde">Borgoña Verde Canela (750ml)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Lacre Sellado</label>
                    <select
                      value={formData.lacre ? 'si' : 'no'}
                      onChange={(e) => setFormData({ ...formData, lacre: e.target.value === 'si' })}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="si">Con Lacre Superior</option>
                      <option value="no">Sin Lacre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Etiqueta</label>
                    <select
                      value={formData.tipoEtiqueta}
                      onChange={(e) => setFormData({ ...formData, tipoEtiqueta: e.target.value as TipoEtiqueta })}
                      disabled={!formData.etiquetado}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white disabled:opacity-40"
                    >
                      <option value="congostras">Congostras</option>
                      <option value="fontan">Fontán</option>
                      <option value="roucon">O Roucon</option>
                      <option value="seixo">O Seixo</option>
                      <option value="palleiros">Os Palleiros</option>
                      <option value="rosado">Rosado</option>
                      <option value="xouba">Xouba</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de Caja</label>
                    <select
                      value={formData.tipoCaja}
                      onChange={(e) => setFormData({ ...formData, tipoCaja: e.target.value as TipoCaja })}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="2 botellas">2 botellas ({Math.ceil(calculatedBotellas / 2)} cajas)</option>
                      <option value="3 botellas">3 botellas ({Math.ceil(calculatedBotellas / 3)} cajas)</option>
                      <option value="6 botellas">6 botellas ({Math.ceil(calculatedBotellas / 6)} cajas)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo de Vino *</label>
                  <select
                    required
                    value={formData.tipoVino}
                    onChange={(e) => setFormData({ ...formData, tipoVino: e.target.value as TipoVino })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-semibold text-stone-800"
                  >
                    {TIPOS_VINO.map((tv) => (
                      <option key={tv} value={tv}>
                        {tv}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Añada *</label>
                  <input
                    type="number"
                    required
                    min={1990}
                    max={2100}
                    value={formData.anada || ''}
                    onChange={(e) => setFormData({ ...formData, anada: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grado Alcohólico *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      step="0.1"
                      min={0}
                      max={25}
                      value={formData.graduacionAlcoholicaVol ?? ''}
                      onChange={(e) =>
                        setFormData({ ...formData, graduacionAlcoholicaVol: Number(e.target.value) })
                      }
                      placeholder="12.8"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-12 font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">% vol</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Observaciones / Notas de Cata de Lote</label>
                <textarea
                  rows={2}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles sobre temperatura de envasado, filtrado pre-embotellado..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-medium shadow-sm cursor-pointer"
                >
                  {editingEmbotellado ? 'Guardar Cambios' : 'Confirmar Embotellado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={`Eliminar Embotellado Lote: ${deleteConfirm.embLote}`}
        message={
          deleteConfirm.canDelete
            ? `¿Estás seguro de que deseas eliminar este lote de embotellado? Se repondrán los litros al depósito de procedencia y se revertirá el consumo de insumos.`
            : deleteConfirm.warning || 'No se puede eliminar este lote.'
        }
        warningDetails={deleteConfirm.details}
        canDelete={deleteConfirm.canDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

import React, { useState } from 'react';
import {
  Edit2,
  GitBranch,
  MapPin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { Parcela, VARIEDADES_PREDEFINIDAS, VariedadPlantada } from '../types/winery';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ParcelasViewProps {
  onSelectParcelaForTraceability?: (parcelaId: string) => void;
  onOpenNewEntradaForParcela?: (parcelaId: string) => void;
}

export const ParcelasView: React.FC<ParcelasViewProps> = ({
  onSelectParcelaForTraceability,
  onOpenNewEntradaForParcela,
}) => {
  const { parcelas, addParcela, updateParcela, deleteParcela, checkReferentialIntegrity, entradasUva } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariedadFilter, setSelectedVariedadFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParcela, setEditingParcela] = useState<Parcela | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    parcelaId: string;
    parcelaNombre: string;
    canDelete: boolean;
    warning?: string;
    details: string[];
  }>({
    isOpen: false,
    parcelaId: '',
    parcelaNombre: '',
    canDelete: true,
    details: [],
  });

  // Form state
  const [formData, setFormData] = useState<{
    nombre: string;
    paraje: string;
    superficieM2: number;
    totalCepas: number;
    marcoPlantacion: string;
    altitudM: number;
    tipoSuelo: string;
    anoPlantacion: number;
    rendimientoMaxKg?: number;
    observaciones?: string;
    variedadesPlantadas: VariedadPlantada[];
  }>({
    nombre: '',
    paraje: '',
    superficieM2: 5000,
    totalCepas: 1500,
    marcoPlantacion: '1 x 1.8 m',
    altitudM: 50,
    tipoSuelo: 'Areno-granítico',
    anoPlantacion: 1995,
    rendimientoMaxKg: 5000,
    observaciones: '',
    variedadesPlantadas: [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentajeEstimado: 100, cepasAprox: 1500 }],
  });

  const handleOpenAddModal = () => {
    setEditingParcela(null);
    setFormData({
      nombre: '',
      paraje: '',
      superficieM2: 5000,
      totalCepas: 1500,
      marcoPlantacion: '1 x 1.8 m',
      altitudM: 50,
      tipoSuelo: 'Areno-granítico',
      anoPlantacion: 1995,
      rendimientoMaxKg: 5000,
      observaciones: '',
      variedadesPlantadas: [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentajeEstimado: 100, cepasAprox: 1500 }],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Parcela) => {
    setEditingParcela(p);
    const inferredTotalCepas =
      p.totalCepas ??
      (p.variedadesPlantadas.reduce((sum, v) => sum + (v.cepasAprox || 0), 0) || 1500);
    setFormData({
      nombre: p.nombre,
      paraje: p.paraje,
      superficieM2: p.superficieM2 || (p.superficieHa ? p.superficieHa * 10000 : 0) || 5000,
      totalCepas: inferredTotalCepas,
      marcoPlantacion: p.marcoPlantacion || '1 x 1.8 m',
      altitudM: p.altitudM,
      tipoSuelo: p.tipoSuelo,
      anoPlantacion: p.anoPlantacion,
      rendimientoMaxKg: p.rendimientoMaxKg,
      observaciones: p.observaciones || '',
      variedadesPlantadas: p.variedadesPlantadas.length > 0
        ? p.variedadesPlantadas.map((v) => ({
            ...v,
            cepasAprox:
              v.cepasAprox ??
              (inferredTotalCepas > 0
                ? Math.round((inferredTotalCepas * (v.porcentajeEstimado || 0)) / 100)
                : 0),
          }))
        : [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentajeEstimado: 100, cepasAprox: inferredTotalCepas }],
    });
    setIsModalOpen(true);
  };

  const handleTotalCepasChange = (newTotal: number) => {
    const safeTotal = Math.max(0, Math.round(newTotal || 0));
    setFormData((prev) => ({
      ...prev,
      totalCepas: safeTotal,
      variedadesPlantadas: prev.variedadesPlantadas.map((vp) => ({
        ...vp,
        cepasAprox: safeTotal > 0 ? Math.round((safeTotal * (vp.porcentajeEstimado || 0)) / 100) : 0,
      })),
    }));
  };

  const handleAddVarietyRow = () => {
    const usedPct = formData.variedadesPlantadas.reduce(
      (sum, vp) => sum + (vp.porcentajeEstimado || 0),
      0
    );
    const defaultPct = usedPct < 100 ? Math.max(0, 100 - usedPct) : 20;
    const autoCepas =
      formData.totalCepas > 0 ? Math.round((formData.totalCepas * defaultPct) / 100) : 0;
    const usedNames = new Set(formData.variedadesPlantadas.map((vp) => vp.variedad));
    const nextVariety =
      VARIEDADES_PREDEFINIDAS.find((v) => !usedNames.has(v)) || VARIEDADES_PREDEFINIDAS[0];

    setFormData({
      ...formData,
      variedadesPlantadas: [
        ...formData.variedadesPlantadas,
        { variedad: nextVariety, porcentajeEstimado: defaultPct, cepasAprox: autoCepas },
      ],
    });
  };

  const handleRemoveVarietyRow = (index: number) => {
    if (formData.variedadesPlantadas.length <= 1) return;
    setFormData({
      ...formData,
      variedadesPlantadas: formData.variedadesPlantadas.filter((_, idx) => idx !== index),
    });
  };

  const handleVarietyChange = (
    index: number,
    field: keyof VariedadPlantada,
    value: string | number
  ) => {
    const updated = [...formData.variedadesPlantadas];
    if (field === 'variedad') {
      updated[index] = { ...updated[index], variedad: String(value) };
    } else if (field === 'porcentajeEstimado') {
      const pct = Math.max(0, Number(value) || 0);
      updated[index] = {
        ...updated[index],
        porcentajeEstimado: pct,
        cepasAprox:
          formData.totalCepas > 0
            ? Math.round((formData.totalCepas * pct) / 100)
            : updated[index].cepasAprox,
      };
    } else if (field === 'cepasAprox') {
      updated[index] = { ...updated[index], cepasAprox: Math.max(0, Number(value) || 0) };
    }
    setFormData({ ...formData, variedadesPlantadas: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    if (editingParcela) {
      updateParcela(editingParcela.id, formData);
    } else {
      addParcela(formData);
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (p: Parcela) => {
    const check = checkReferentialIntegrity('parcela', p.id);
    setDeleteConfirm({
      isOpen: true,
      parcelaId: p.id,
      parcelaNombre: p.nombre,
      canDelete: check.canDelete,
      warning: check.warning,
      details: check.details,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.canDelete) {
      deleteParcela(deleteConfirm.parcelaId);
      setDeleteConfirm({ ...deleteConfirm, isOpen: false });
    }
  };

  // Filtered parcels
  const filteredParcelas = parcelas.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.paraje.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variedadesPlantadas.some((v) => v.variedad.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesVariedad =
      !selectedVariedadFilter ||
      p.variedadesPlantadas.some((v) => v.variedad.toLowerCase() === selectedVariedadFilter.toLowerCase());

    return matchesSearch && matchesVariedad;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions: Only "Parcelas" without explanatory text */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
          Parcelas
        </h2>

        <button
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Nueva Parcela</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, paraje o variedad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20 focus:border-rose-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedVariedadFilter}
            onChange={(e) => setSelectedVariedadFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white text-stone-700"
          >
            <option value="">Todas las Variedades</option>
            {VARIEDADES_PREDEFINIDAS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">
            {filteredParcelas.length} parcelas
          </span>
        </div>
      </div>

      {/* Parcelas Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredParcelas.map((parcela) => {
          const totalKgRecogidos = entradasUva
            .filter((e) => e.parcelaId === parcela.id)
            .reduce((sum, e) => sum + e.kgTotales, 0);

          const supM2 = parcela.superficieM2 || (parcela.superficieHa ? parcela.superficieHa * 10000 : 0);

          return (
            <div
              key={parcela.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 tracking-wider uppercase block">
                      {parcela.id}
                    </span>
                    <h3 className="text-lg font-bold text-stone-900 line-clamp-1">{parcela.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(parcela)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                      title="Modificar Parcela"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(parcela)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar Parcela"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Paraje, Superficie en m2 y Marco de Plantación */}
                <div className="flex items-center gap-2 text-xs text-stone-600 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span className="line-clamp-1 font-medium">{parcela.paraje}</span>
                  <span className="text-stone-300">•</span>
                  <span className="font-semibold text-stone-800">{supM2.toLocaleString('es-ES')} m²</span>
                  {parcela.marcoPlantacion && (
                    <>
                      <span className="text-stone-300">•</span>
                      <span className="text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                        {parcela.marcoPlantacion}
                      </span>
                    </>
                  )}
                </div>

                {/* Soil, altitude & planting year */}
                <div className="p-3 bg-stone-50 rounded-xl text-xs space-y-1 mb-4 text-stone-600">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Superficie:</span>
                    <span className="font-bold text-stone-900 tabular-nums">{supM2.toLocaleString('es-ES')} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Total de Cepas:</span>
                    <span className="font-bold text-stone-900 tabular-nums">
                      {(parcela.totalCepas ?? parcela.variedadesPlantadas.reduce((s, v) => s + (v.cepasAprox || 0), 0)).toLocaleString('es-ES')} cepas
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Marco de plantación:</span>
                    <span className="font-medium text-stone-800">{parcela.marcoPlantacion || 'No indicado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Tipo de Suelo:</span>
                    <span className="font-medium text-stone-800">{parcela.tipoSuelo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Año de Plantación:</span>
                    <span className="font-medium text-stone-800">{parcela.anoPlantacion} ({new Date().getFullYear() - parcela.anoPlantacion} años)</span>
                  </div>
                  {parcela.rendimientoMaxKg && (
                    <div className="flex justify-between">
                      <span className="text-stone-400">Rendimiento Máx:</span>
                      <span className="font-medium text-stone-800">{parcela.rendimientoMaxKg.toLocaleString('es-ES')} kg</span>
                    </div>
                  )}
                </div>

                {/* Variedades Plantadas list */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                    Variedades Plantadas:
                  </span>
                  <div className="space-y-1.5">
                    {parcela.variedadesPlantadas.map((vp, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-stone-800">
                          <span className="w-2 h-2 rounded-full bg-rose-700"></span>
                          <span>{vp.variedad}</span>
                        </div>
                        <span className="text-stone-500">
                          {vp.porcentajeEstimado}% {vp.cepasAprox ? `(${vp.cepasAprox} cepas)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {parcela.observaciones && (
                  <p className="text-xs text-stone-500 italic mt-3 pt-2 border-t border-stone-100 line-clamp-2">
                    "{parcela.observaciones}"
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-3.5 bg-stone-50/80 border-t border-stone-200/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-400 text-[10px] block uppercase">Vendimia Registrada</span>
                  <span className="font-bold text-stone-800">{totalKgRecogidos.toLocaleString('es-ES')} kg</span>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenNewEntradaForParcela && (
                    <button
                      onClick={() => onOpenNewEntradaForParcela(parcela.id)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-rose-100 text-rose-800 hover:bg-rose-200 rounded-xl transition-colors cursor-pointer"
                    >
                      + Vendimia
                    </button>
                  )}
                  {onSelectParcelaForTraceability && (
                    <button
                      onClick={() => onSelectParcelaForTraceability(parcela.id)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                      title="Ver Trazabilidad de esta parcela"
                    >
                      <GitBranch className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Parcela Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-base font-serif-wine">
                {editingParcela ? `Modificar Parcela: ${editingParcela.nombre}` : 'Añadir Nueva Parcela'}
              </h3>
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
                  <label className="block font-medium text-stone-700 mb-1">Nombre de la Parcela *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Viña da Xouba"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Paraje / Lugar</label>
                  <input
                    type="text"
                    placeholder="Ej. Costeira da Ría"
                    value={formData.paraje}
                    onChange={(e) => setFormData({ ...formData, paraje: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Superficie (m²) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 5000"
                    value={formData.superficieM2}
                    onChange={(e) => setFormData({ ...formData, superficieM2: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Total Cepas *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="Ej. 3000"
                    value={formData.totalCepas || ''}
                    onChange={(e) => handleTotalCepasChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold text-rose-900 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Marco (ej. 1x1.8m)</label>
                  <input
                    type="text"
                    placeholder="Ej. 1x1.8m"
                    value={formData.marcoPlantacion}
                    onChange={(e) => setFormData({ ...formData, marcoPlantacion: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Altitud (m)</label>
                  <input
                    type="number"
                    value={formData.altitudM}
                    onChange={(e) => setFormData({ ...formData, altitudM: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo de Suelo</label>
                  <input
                    type="text"
                    placeholder="Granítico, Xisto..."
                    value={formData.tipoSuelo}
                    onChange={(e) => setFormData({ ...formData, tipoSuelo: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Año de Plantación</label>
                  <input
                    type="number"
                    value={formData.anoPlantacion}
                    onChange={(e) => setFormData({ ...formData, anoPlantacion: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Dynamic Planted Varieties Table */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-stone-900 text-sm">Variedades Plantadas</h4>
                    <p className="text-xs text-stone-500">
                      El nº de cepas se calcula automáticamente según el % sobre el total de cepas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVarietyRow}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-800 hover:text-rose-950 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Variedad</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.variedadesPlantadas.map((vp, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={vp.variedad}
                        onChange={(e) => handleVarietyChange(index, 'variedad', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                      >
                        {(vp.variedad && !VARIEDADES_PREDEFINIDAS.includes(vp.variedad)
                          ? [vp.variedad, ...VARIEDADES_PREDEFINIDAS]
                          : [...VARIEDADES_PREDEFINIDAS]
                        )
                          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
                          .map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                      </select>

                      <div className="w-24 flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="%"
                          value={vp.porcentajeEstimado}
                          onChange={(e) => handleVarietyChange(index, 'porcentajeEstimado', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg text-right font-semibold tabular-nums"
                        />
                        <span className="text-xs text-stone-500">%</span>
                      </div>

                      <div className="w-28 flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Cepas"
                          value={vp.cepasAprox ?? ''}
                          onChange={(e) => handleVarietyChange(index, 'cepasAprox', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-right font-bold text-rose-900 tabular-nums"
                        />
                        <span className="text-[10px] text-stone-400">cepas</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveVarietyRow(index)}
                        disabled={formData.variedadesPlantadas.length <= 1}
                        className="p-1.5 text-stone-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 tabular-nums">
                  <span>
                    Suma asignada:{' '}
                    <strong
                      className={
                        formData.variedadesPlantadas.reduce((s, v) => s + (v.porcentajeEstimado || 0), 0) === 100
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }
                    >
                      {formData.variedadesPlantadas.reduce((s, v) => s + (v.porcentajeEstimado || 0), 0)}%
                    </strong>
                  </span>
                  <span>
                    Total cepas:{' '}
                    <strong className="text-stone-900">
                      {formData.variedadesPlantadas
                        .reduce((s, v) => s + (v.cepasAprox || 0), 0)
                        .toLocaleString('es-ES')}{' '}
                      / {(formData.totalCepas || 0).toLocaleString('es-ES')}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Detalles de conducción, orientación, poda..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

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
                  {editingParcela ? 'Guardar Cambios' : 'Crear Parcela'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Referential Integrity Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={`Eliminar Parcela: ${deleteConfirm.parcelaNombre}`}
        message={
          deleteConfirm.canDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente la parcela "${deleteConfirm.parcelaNombre}"?`
            : deleteConfirm.warning || 'No se puede eliminar la parcela.'
        }
        warningDetails={deleteConfirm.details}
        canDelete={deleteConfirm.canDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

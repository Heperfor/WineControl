import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Droplet,
  Edit2,
  Grape,
  MapPin,
  Percent,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  DesgloseVariedadKg,
  EntradaUva,
  TIPOS_RECIPIENTE_BODEGA,
  TIPOS_VINO,
  TipoRecipiente,
  TipoVino,
  VARIEDADES_PREDEFINIDAS,
} from '../types/winery';
import { mapDepositoIdToZonaLd } from '../utils/appccAutomation';
import { TIPO_VINO_THEME, inferTipoVinoFromVarieties } from '../utils/wineType';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const TIPOS_RECIPIENTE = TIPOS_RECIPIENTE_BODEGA;

interface EntradasUvaViewProps {
  initialOpenModal?: boolean;
  preselectedParcelaId?: string;
  preselectedDepositoId?: string;
  onNavigateToElaboracion?: (depositoId: string) => void;
  onNavigateToAppcc?: (fecha?: string) => void;
}

export const EntradasUvaView: React.FC<EntradasUvaViewProps> = ({
  initialOpenModal = false,
  preselectedParcelaId,
  preselectedDepositoId,
  onNavigateToElaboracion,
  onNavigateToAppcc,
}) => {
  const {
    parcelas,
    depositos,
    entradasUva,
    appccLimpieza,
    addEntradaUva,
    updateEntradaUva,
    deleteEntradaUva,
  } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcelaFilter, setSelectedParcelaFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [editingEntrada, setEditingEntrada] = useState<EntradaUva | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [appccTriggerBanner, setAppccTriggerBanner] = useState<{
    entradaId: string;
    fecha: string;
    parcelaNombre: string;
    zonas: string[];
  } | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entradaId: string;
    details: string;
  }>({
    isOpen: false,
    entradaId: '',
    details: '',
  });

  // Form State: without albaran, estadoSanitario, observaciones
  const [formData, setFormData] = useState<{
    fecha: string;
    parcelaId: string;
    parcelaNombre: string;
    desgloseVariedades: DesgloseVariedadKg[];
    kgTotales: number;
    depositoDestinoId: string;
    litrosMosto: number;
    tipoRecipiente: TipoRecipiente;
    tipoVino: TipoVino;
    anada: number;
    gradoBaboBaume: number;
  }>({
    fecha: new Date().toISOString().slice(0, 10),
    parcelaId: '',
    parcelaNombre: '',
    desgloseVariedades: [],
    kgTotales: 0,
    depositoDestinoId: preselectedDepositoId || depositos[0]?.id || '1',
    litrosMosto: 0,
    tipoRecipiente: 'Inox cerrado',
    tipoVino: 'Blanco',
    anada: new Date().getFullYear(),
    gradoBaboBaume: 12.5,
  });

  // Calculate real yield percentage
  const rendimientoCalculado =
    formData.kgTotales > 0
      ? Number(((formData.litrosMosto / formData.kgTotales) * 100).toFixed(1))
      : 0;

  // Open modal if prop triggers it
  useEffect(() => {
    if (initialOpenModal) {
      handleOpenAddModal(preselectedParcelaId, preselectedDepositoId);
    }
  }, [initialOpenModal, preselectedParcelaId, preselectedDepositoId]);

  const handleOpenAddModal = (parcId?: string, depId?: string) => {
    setFormError(null);
    setEditingEntrada(null);
    const chosenParcela = parcelas.find((p) => p.id === (parcId || parcelas[0]?.id)) || parcelas[0];
    const initialDep = depId || depositos[0]?.id || '1';
    const depObj = depositos.find((d) => d.id === initialDep);

    let initialDesglose: DesgloseVariedadKg[] = [];
    if (chosenParcela && chosenParcela.variedadesPlantadas.length > 0) {
      initialDesglose = chosenParcela.variedadesPlantadas.map((vp) => ({
        variedad: vp.variedad,
        kg: Math.round(1500 * (vp.porcentajeEstimado / 100)),
      }));
    } else {
      initialDesglose = [{ variedad: VARIEDADES_PREDEFINIDAS[0], kg: 1500 }];
    }

    const totalKg = initialDesglose.reduce((sum, item) => sum + item.kg, 0);
    const today = new Date().toISOString().slice(0, 10);

    setFormData({
      fecha: today,
      parcelaId: chosenParcela ? chosenParcela.id : '',
      parcelaNombre: chosenParcela ? chosenParcela.nombre : '',
      desgloseVariedades: initialDesglose,
      kgTotales: totalKg,
      depositoDestinoId: initialDep,
      litrosMosto: Math.round(totalKg * 0.68),
      tipoRecipiente: depObj ? depObj.tipoRecipiente : 'Inox cerrado',
      tipoVino: inferTipoVinoFromVarieties(initialDesglose, chosenParcela?.nombre),
      anada: Number(today.slice(0, 4)),
      gradoBaboBaume: 12.5,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entrada: EntradaUva) => {
    setFormError(null);
    setEditingEntrada(entrada);
    setFormData({
      fecha: entrada.fecha,
      parcelaId: entrada.parcelaId,
      parcelaNombre: entrada.parcelaNombre,
      desgloseVariedades: [...entrada.desgloseVariedades],
      kgTotales: entrada.kgTotales,
      depositoDestinoId: entrada.depositoDestinoId,
      litrosMosto: entrada.litrosMosto || (entrada as any).litrosEstimadosMosto || 0,
      tipoRecipiente: entrada.tipoRecipiente,
      tipoVino:
        entrada.tipoVino ||
        inferTipoVinoFromVarieties(entrada.desgloseVariedades, entrada.parcelaNombre),
      anada: entrada.anada || Number(entrada.fecha.slice(0, 4)),
      gradoBaboBaume: entrada.gradoBaboBaume ?? 12.5,
    });
    setIsModalOpen(true);
  };

  const handleParcelaChange = (parcelaId: string) => {
    const selectedParcela = parcelas.find((p) => p.id === parcelaId);
    if (!selectedParcela) return;

    const newDesglose: DesgloseVariedadKg[] = selectedParcela.variedadesPlantadas.map((vp) => ({
      variedad: vp.variedad,
      kg: Math.round(1500 * (vp.porcentajeEstimado / 100)),
    }));

    const totalKg = newDesglose.reduce((sum, item) => sum + item.kg, 0);

    setFormData({
      ...formData,
      parcelaId: selectedParcela.id,
      parcelaNombre: selectedParcela.nombre,
      desgloseVariedades: newDesglose,
      kgTotales: totalKg,
      litrosMosto: Math.round(totalKg * 0.68),
      tipoVino: inferTipoVinoFromVarieties(newDesglose, selectedParcela.nombre),
    });
  };

  const handleVarietyKgChange = (index: number, kgValue: number) => {
    const updated = [...formData.desgloseVariedades];
    updated[index] = { ...updated[index], kg: Math.max(0, kgValue) };
    const newTotalKg = updated.reduce((sum, item) => sum + item.kg, 0);

    setFormData({
      ...formData,
      desgloseVariedades: updated,
      kgTotales: newTotalKg,
    });
  };

  const handleAddVarietyDesglose = () => {
    const usedNames = new Set(formData.desgloseVariedades.map((v) => v.variedad));
    const nextVariety =
      VARIEDADES_PREDEFINIDAS.find((v) => !usedNames.has(v)) || VARIEDADES_PREDEFINIDAS[0];
    const updated = [...formData.desgloseVariedades, { variedad: nextVariety, kg: 200 }];
    const newTotalKg = updated.reduce((sum, item) => sum + item.kg, 0);
    setFormData({
      ...formData,
      desgloseVariedades: updated,
      kgTotales: newTotalKg,
    });
  };

  const handleRemoveVarietyDesglose = (idx: number) => {
    if (formData.desgloseVariedades.length <= 1) return;
    const updated = formData.desgloseVariedades.filter((_, i) => i !== idx);
    const newTotalKg = updated.reduce((sum, item) => sum + item.kg, 0);
    setFormData({
      ...formData,
      desgloseVariedades: updated,
      kgTotales: newTotalKg,
    });
  };

  const handleDepositoChange = (depId: string) => {
    const dep = depositos.find((d) => d.id === depId);
    setFormData({
      ...formData,
      depositoDestinoId: depId,
      tipoRecipiente: dep ? dep.tipoRecipiente : formData.tipoRecipiente,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parcelaId || formData.kgTotales <= 0) {
      setFormError('Seleccione una parcela y especifique los kg de uva.');
      return;
    }

    setFormError(null);
    const payload = {
      ...formData,
      rendimientoRealPorcentaje: rendimientoCalculado,
    };

    if (editingEntrada) {
      updateEntradaUva(editingEntrada.id, payload);
    } else {
      const created = addEntradaUva(payload);
      const depZona = mapDepositoIdToZonaLd(created.depositoDestinoId);
      setAppccTriggerBanner({
        entradaId: created.id,
        fecha: created.fecha,
        parcelaNombre: created.parcelaNombre,
        zonas: ['DESPALILLADORA', 'BOMBAS', 'MANGUERAS', depZona, 'PRENSA', 'SUELO'],
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (ent: EntradaUva) => {
    setDeleteConfirm({
      isOpen: true,
      entradaId: ent.id,
      details: `${ent.id} - ${ent.parcelaNombre} (${ent.kgTotales} kg a Depósito ${ent.depositoDestinoId})`,
    });
  };

  const confirmDeleteAction = () => {
    deleteEntradaUva(deleteConfirm.entradaId);
    setDeleteConfirm({ ...deleteConfirm, isOpen: false });
  };

  // Filtered entradas
  const filteredEntradas = entradasUva.filter((e) => {
    const matchesSearch =
      e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.parcelaNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.depositoDestinoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.desgloseVariedades.some((v) => v.variedad.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesParcela = !selectedParcelaFilter || e.parcelaId === selectedParcelaFilter;

    return matchesSearch && matchesParcela;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Entradas de Uva
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Pesaje por variedad, litros de mosto y rendimiento real.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Entrada de Uva</span>
        </button>
      </div>

      {/* Confirmation banner when Entrada de Uva triggers APPCC L+D records */}
      {appccTriggerBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 space-y-1">
              <div className="font-bold">
                Registro L+D APPCC generado automáticamente · {appccTriggerBanner.entradaId} ({appccTriggerBanner.fecha})
              </div>
              <div className="text-emerald-800">
                Equipos y depósito receptor anotados como <strong>OK</strong> en{' '}
                {appccTriggerBanner.parcelaNombre}:{' '}
                <span className="font-semibold">{appccTriggerBanner.zonas.join(' · ')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToAppcc && (
              <button
                type="button"
                onClick={() => onNavigateToAppcc(appccTriggerBanner.fecha)}
                className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer"
              >
                Ver en APPCC L+D →
              </button>
            )}
            <button
              type="button"
              onClick={() => setAppccTriggerBanner(null)}
              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por parcela, variedad, depósito..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedParcelaFilter}
            onChange={(e) => setSelectedParcelaFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white text-stone-700"
          >
            <option value="">Todas las Parcelas</option>
            {[...parcelas]
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">
            {filteredEntradas.length} entradas
          </span>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredEntradas.map((entrada) => {
          const litros = entrada.litrosMosto || (entrada as any).litrosEstimadosMosto || 0;
          const rendimiento =
            entrada.rendimientoRealPorcentaje ||
            (entrada.kgTotales > 0 ? Number(((litros / entrada.kgTotales) * 100).toFixed(1)) : 0);

          return (
            <div
              key={entrada.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
                    {entrada.fecha} · Añada {entrada.anada || entrada.fecha.slice(0, 4)} ·{' '}
                    {entrada.gradoBaboBaume !== undefined ? `${entrada.gradoBaboBaume}% vol` : '—'}
                  </span>
                  <h3 className="font-bold text-base text-stone-900 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-4 h-4 text-rose-800 shrink-0" />
                    <span>{entrada.parcelaNombre}</span>
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateToElaboracion && onNavigateToElaboracion(entrada.depositoDestinoId)}
                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-xs shrink-0 cursor-pointer"
                >
                  <Droplet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{entrada.depositoDestinoId}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-stone-50 rounded-xl text-center tabular-nums">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold block">Uva Total</span>
                  <span className="text-sm font-bold text-stone-900">{entrada.kgTotales.toLocaleString('es-ES')} kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold block">Mosto</span>
                  <span className="text-sm font-bold text-emerald-800">{litros.toLocaleString('es-ES')} L</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold block">Rendimiento</span>
                  <span className="text-sm font-bold text-emerald-900">{rendimiento}%</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
                <div className="flex flex-wrap gap-1.5">
                  {entrada.desgloseVariedades.map((v, i) => {
                    const pct =
                      entrada.kgTotales > 0
                        ? ((v.kg / entrada.kgTotales) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 tabular-nums">
                        <strong>{v.variedad}:</strong> {v.kg.toLocaleString('es-ES')} kg ({pct}%)
                      </span>
                    );
                  })}
                </div>
                {(() => {
                  const tipoVino =
                    entrada.tipoVino ||
                    inferTipoVinoFromVarieties(entrada.desgloseVariedades, entrada.parcelaNombre);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TIPO_VINO_THEME[tipoVino].badge}`}
                    >
                      {tipoVino}
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const depZona = mapDepositoIdToZonaLd(entrada.depositoDestinoId);
                const hasLd = appccLimpieza.some(
                  (l) =>
                    l.fecha === entrada.fecha &&
                    (l.referenciaOperacionId === entrada.id ||
                      l.zonaEquipo.toUpperCase() === depZona.toUpperCase())
                );
                return hasLd ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToAppcc && onNavigateToAppcc(entrada.fecha)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>APPCC L+D OK: Despalilladora, Bombas, Mangueras, {depZona}</span>
                  </button>
                ) : null;
              })()}

              <div className="pt-2 border-t border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(entrada)}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(entrada)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
                  aria-label="Eliminar entrada"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Entradas Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Parcela Origen</th>
                <th className="py-3.5 px-4">Variedades y Kg</th>
                <th className="py-3.5 px-4 text-right">Total Kg</th>
                <th className="py-3.5 px-4">Depósito Destino</th>
                <th className="py-3.5 px-4 text-right">Litros Mosto</th>
                <th className="py-3.5 px-4 text-center">Rendimiento Real</th>
                <th className="py-3.5 px-4">Añada / Grado</th>
                <th className="py-3.5 px-4">Tipo Recipiente</th>
                <th className="py-3.5 px-4 text-center">Tipo de Vino</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredEntradas.map((entrada) => {
                const litros = entrada.litrosMosto || (entrada as any).litrosEstimadosMosto || 0;
                const rendimiento =
                  entrada.rendimientoRealPorcentaje ||
                  (entrada.kgTotales > 0 ? Number(((litros / entrada.kgTotales) * 100).toFixed(1)) : 0);

                return (
                  <tr key={entrada.id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      {entrada.fecha}
                    </td>

                    {/* Parcela */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-stone-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                        <span>{entrada.parcelaNombre}</span>
                      </div>
                    </td>

                    {/* Varieties breakdown */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {entrada.desgloseVariedades.map((v, i) => {
                          const pct =
                            entrada.kgTotales > 0
                              ? ((v.kg / entrada.kgTotales) * 100).toFixed(1)
                              : '0.0';
                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs border border-stone-200 tabular-nums"
                            >
                              <span className="font-semibold">{v.variedad}:</span>
                              <span>
                                {v.kg.toLocaleString('es-ES')} kg ({pct}%)
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Total Kg */}
                    <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                      {entrada.kgTotales.toLocaleString('es-ES')}{' '}
                      <span className="text-xs font-normal text-stone-500">kg</span>
                    </td>

                    {/* Destino Deposito */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onNavigateToElaboracion && onNavigateToElaboracion(entrada.depositoDestinoId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold text-xs hover:bg-indigo-100 cursor-pointer"
                      >
                        <Droplet className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{entrada.depositoDestinoId}</span>
                      </button>
                    </td>

                    {/* Mosto Litros (Añadido a mano) */}
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-800">
                      {litros.toLocaleString('es-ES')}{' '}
                      <span className="text-xs font-normal text-stone-500">L</span>
                    </td>

                    {/* Rendimiento Real Obtenido */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                        {rendimiento}%
                      </span>
                    </td>

                    {/* Añada y Grado */}
                    <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-stone-900 text-xs">
                        {entrada.anada || entrada.fecha.slice(0, 4)}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {entrada.gradoBaboBaume !== undefined ? `${entrada.gradoBaboBaume}% vol` : '—'}
                      </div>
                    </td>

                    {/* Tipo Recipiente */}
                    <td className="py-3.5 px-4 text-xs text-stone-600 max-w-[140px] truncate" title={entrada.tipoRecipiente}>
                      {entrada.tipoRecipiente}
                    </td>

                    {/* Tipo de Vino + Estado APPCC */}
                    <td className="py-3.5 px-4 text-center text-xs font-medium text-stone-800">
                      {(() => {
                        const tipoVino =
                          entrada.tipoVino ||
                          inferTipoVinoFromVarieties(entrada.desgloseVariedades, entrada.parcelaNombre);
                        return (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TIPO_VINO_THEME[tipoVino].badge}`}
                          >
                            {tipoVino}
                          </span>
                        );
                      })()}
                      {(() => {
                        const depZona = mapDepositoIdToZonaLd(entrada.depositoDestinoId);
                        const hasLd = appccLimpieza.some(
                          (l) =>
                            l.fecha === entrada.fecha &&
                            (l.referenciaOperacionId === entrada.id ||
                              l.zonaEquipo.toUpperCase() === depZona.toUpperCase())
                        );
                        return hasLd ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => onNavigateToAppcc && onNavigateToAppcc(entrada.fecha)}
                              title={`L+D automático generado para Despalilladora, Bombas, Mangueras y ${depZona}`}
                              className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold hover:bg-emerald-100 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>L+D OK</span>
                            </button>
                          </div>
                        ) : null;
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(entrada)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Modificar entrada"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entrada)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar entrada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Entrada Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Grape className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  {editingEntrada ? `Modificar Entrada: ${editingEntrada.id}` : 'Registrar Entrada de Uva'}
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
                  <label className="block font-medium text-stone-700 mb-1">Fecha de Vendimia *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Parcela de Origen *</label>
                  <select
                    required
                    value={formData.parcelaId}
                    onChange={(e) => handleParcelaChange(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="">-- Seleccionar Parcela --</option>
                    {[...parcelas]
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.paraje})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Varieties and Kg Breakdown */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-stone-900 text-sm">Kg de Uva por Variedad</h4>
                    <p className="text-xs text-stone-500">Desglose de pesajes por variedad</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVarietyDesglose}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-800 hover:text-rose-950 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Variedad</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.desgloseVariedades.map((v, index) => {
                    const pctSobreTotal =
                      formData.kgTotales > 0
                        ? ((v.kg / formData.kgTotales) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={v.variedad}
                          onChange={(e) => {
                            const updated = [...formData.desgloseVariedades];
                            updated[index] = { ...updated[index], variedad: e.target.value };
                            setFormData({
                              ...formData,
                              desgloseVariedades: updated,
                              tipoVino: inferTipoVinoFromVarieties(updated, formData.parcelaNombre),
                            });
                          }}
                          aria-label="Seleccionar variedad"
                          className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                        >
                          {(v.variedad && !VARIEDADES_PREDEFINIDAS.includes(v.variedad)
                            ? [v.variedad, ...VARIEDADES_PREDEFINIDAS]
                            : [...VARIEDADES_PREDEFINIDAS]
                          )
                            .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
                            .map((varName) => (
                              <option key={varName} value={varName}>
                                {varName}
                              </option>
                            ))}
                        </select>

                        <div className="w-28 sm:w-32 flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            value={v.kg || ''}
                            onChange={(e) => handleVarietyKgChange(index, Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg text-right font-semibold tabular-nums"
                          />
                          <span className="text-xs text-stone-500 font-medium">kg</span>
                        </div>

                        <div
                          className="w-20 flex items-center gap-1 shrink-0"
                          title="Porcentaje automático sobre el total vendimiado"
                        >
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={pctSobreTotal}
                            aria-label={`Porcentaje de ${v.variedad}`}
                            className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg bg-stone-100 text-right font-bold text-rose-900 tabular-nums cursor-default focus:outline-none"
                          />
                          <span className="text-xs text-stone-500 font-semibold">%</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveVarietyDesglose(index)}
                          disabled={formData.desgloseVariedades.length <= 1}
                          className="p-1.5 text-stone-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between font-bold text-stone-900 text-sm">
                  <span>Kg Totales Vendimiados:</span>
                  <span className="text-base text-rose-900">{formData.kgTotales.toLocaleString('es-ES')} kg</span>
                </div>
              </div>

              {/* Litros Mosto (Añadido a mano) & Porcentaje Real Obtenido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Litros de Mosto Obtenidos (Entrada a mano) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={formData.litrosMosto || ''}
                      onChange={(e) => setFormData({ ...formData, litrosMosto: Number(e.target.value) })}
                      placeholder="Ej. 1950"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-8 font-bold text-emerald-800 text-base"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-semibold">L</span>
                  </div>
                </div>

                {/* Porcentaje Real Obtenido Auto-calculado */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider block">
                      Rendimiento Real Obtenido
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      ({formData.litrosMosto} L / {formData.kgTotales} kg)
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-900">
                    {rendimientoCalculado}%
                  </div>
                </div>
              </div>

              {/* Depósito Destino y Tipo de Recipiente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Depósito Destino Nº *</label>
                  <select
                    required
                    value={formData.depositoDestinoId}
                    onChange={(e) => handleDepositoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium text-stone-800"
                  >
                    {[...depositos]
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} - {d.nombre} ({d.litrosActuales}/{d.capacidadLitros}L)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo de Recipiente *</label>
                  <select
                    value={formData.tipoRecipiente}
                    onChange={(e) => setFormData({ ...formData, tipoRecipiente: e.target.value as TipoRecipiente })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {TIPOS_RECIPIENTE.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
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
                      value={formData.gradoBaboBaume ?? ''}
                      onChange={(e) => setFormData({ ...formData, gradoBaboBaume: Number(e.target.value) })}
                      placeholder="12.5"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-12 font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">% vol</span>
                  </div>
                </div>
              </div>

              {!editingEntrada && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-950">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Trigger APPCC automático al guardar</div>
                    <div className="text-emerald-800 mt-0.5">
                      Se registrará limpieza y desinfección (<strong>OK</strong>) para{' '}
                      <strong>Despalilladora</strong>, <strong>Bombas</strong>, <strong>Mangueras</strong>,{' '}
                      <strong>{mapDepositoIdToZonaLd(formData.depositoDestinoId)}</strong>, Prensa y Suelo.
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
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
                  {editingEntrada ? 'Guardar Cambios' : 'Registrar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Entrada de Uva"
        message={`¿Deseas eliminar el registro de vendimia "${deleteConfirm.details}"?`}
        warningDetails={['Se restarán automáticamente los litros del depósito destino correspondiente.']}
        canDelete={true}
        onConfirm={confirmDeleteAction}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

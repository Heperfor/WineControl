import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Boxes,
  Calendar,
  Edit2,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { MARCAS_COMERCIALES, MarcaVino, SalidaRegistro } from '../types/winery';
import { getLocalIsoDate } from '../utils/dateUtils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SalidasViewProps {
  initialOpenModal?: boolean;
  preselectedLote?: string;
  onNavigateToTraceability?: (lote: string) => void;
}

export const SalidasView: React.FC<SalidasViewProps> = ({
  initialOpenModal = false,
  preselectedLote,
  onNavigateToTraceability,
}) => {
  const {
    bodegaConfig,
    embotellados,
    salidas,
    addSalida,
    updateSalida,
    deleteSalida,
  } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarcaFilter, setSelectedMarcaFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [editingSalida, setEditingSalida] = useState<SalidaRegistro | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    salidaId: string;
    details: string;
  }>({
    isOpen: false,
    salidaId: '',
    details: '',
  });

  // Form State
  const [formData, setFormData] = useState<{
    fecha: string;
    marca: MarcaVino;
    lote: string;
    anada: number;
    gradoAlcoholico: number;
    embotelladoId?: string;
    cantidadBotellas: number;
    numeroCajas?: number;
    destino: string;
    numeroAlbaranFactura: string;
    tipoSalida: 'Venta Nacional' | 'Exportación' | 'Muestra / Degustación' | 'Autoconsumo' | 'Merma / Rotura';
    pvpUnitario?: number;
    observaciones: string;
  }>({
    fecha: getLocalIsoDate(),
    marca: 'Xouba',
    lote: '',
    anada: new Date().getFullYear(),
    gradoAlcoholico: 12.7,
    cantidadBotellas: 60,
    numeroCajas: 10,
    destino: '',
    numeroAlbaranFactura: `ALB-${bodegaConfig.anoCampana}/${String(salidas.length + 101).padStart(3, '0')}`,
    tipoSalida: 'Venta Nacional',
    pvpUnitario: 14.5,
    observaciones: '',
  });

  const handleOpenAddModal = (loteCode?: string) => {
    setFormError(null);
    setEditingSalida(null);
    const targetLote = loteCode || preselectedLote || (embotellados[0] ? embotellados[0].lote : '');
    const embObj = embotellados.find((e) => e.lote === targetLote) || embotellados[0];

    const cant = 60;
    const today = getLocalIsoDate();
    setFormData({
      fecha: today,
      marca: embObj ? embObj.marca : 'Xouba',
      lote: embObj ? embObj.lote : '',
      anada: embObj?.anada || (embObj ? Number(embObj.fecha.slice(0, 4)) : Number(today.slice(0, 4))),
      gradoAlcoholico: embObj?.graduacionAlcoholicaVol ?? 12.7,
      embotelladoId: embObj ? embObj.id : undefined,
      cantidadBotellas: cant,
      numeroCajas: Math.ceil(cant / 6),
      destino: '',
      numeroAlbaranFactura: `ALB-${bodegaConfig.anoCampana}/${String(salidas.length + 101).padStart(3, '0')}`,
      tipoSalida: 'Venta Nacional',
      pvpUnitario: 14.0,
      observaciones: 'Entrega por transportista refrigerado.',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: SalidaRegistro) => {
    setFormError(null);
    setEditingSalida(s);
    const embMatch = embotellados.find((e) => e.id === s.embotelladoId || e.lote === s.lote);
    setFormData({
      fecha: s.fecha,
      marca: s.marca,
      lote: s.lote,
      anada: s.anada || embMatch?.anada || Number(s.fecha.slice(0, 4)),
      gradoAlcoholico: s.gradoAlcoholico ?? embMatch?.graduacionAlcoholicaVol ?? 12.7,
      embotelladoId: s.embotelladoId,
      cantidadBotellas: s.cantidadBotellas,
      numeroCajas: s.numeroCajas,
      destino: s.destino,
      numeroAlbaranFactura: s.numeroAlbaranFactura,
      tipoSalida: s.tipoSalida,
      pvpUnitario: s.pvpUnitario,
      observaciones: s.observaciones || '',
    });
    setIsModalOpen(true);
  };

  const handleLoteChange = (selectedLote: string) => {
    const emb = embotellados.find((e) => e.lote === selectedLote);
    if (!emb) return;

    setFormData({
      ...formData,
      lote: emb.lote,
      marca: emb.marca,
      anada: emb.anada || Number(emb.fecha.slice(0, 4)),
      gradoAlcoholico: emb.graduacionAlcoholicaVol ?? 12.7,
      embotelladoId: emb.id,
      cantidadBotellas: Math.min(formData.cantidadBotellas, emb.botellasDisponibles || 60),
    });
  };

  const handleCantidadChange = (botellas: number) => {
    setFormData({
      ...formData,
      cantidadBotellas: botellas,
      numeroCajas: Math.ceil(botellas / 6),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lote || !formData.destino.trim() || formData.cantidadBotellas <= 0) {
      setFormError('Complete el lote, el destino y una cantidad válida de botellas.');
      return;
    }
    setFormError(null);

    if (editingSalida) {
      updateSalida(editingSalida.id, formData);
    } else {
      addSalida(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (s: SalidaRegistro) => {
    setDeleteConfirm({
      isOpen: true,
      salidaId: s.id,
      details: `${s.numeroAlbaranFactura} - ${s.cantidadBotellas} bot. (${s.marca} Lote ${s.lote}) a ${s.destino}`,
    });
  };

  const confirmDelete = () => {
    deleteSalida(deleteConfirm.salidaId);
    setDeleteConfirm({ ...deleteConfirm, isOpen: false });
  };

  // Filtered Salidas
  const filteredSalidas = salidas.filter((s) => {
    const matchesSearch =
      s.numeroAlbaranFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.destino.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lote.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMarca = !selectedMarcaFilter || s.marca === selectedMarcaFilter;

    return matchesSearch && matchesMarca;
  });

  const totalBotellasVendidas = salidas.reduce((sum, s) => sum + s.cantidadBotellas, 0);
  const totalFacturacionEstimada = salidas.reduce((sum, s) => sum + (s.pvpUnitario ? s.pvpUnitario * s.cantidadBotellas : 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Salidas y Expedición
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Envíos, albaranes y destinos vinculados al lote de embotellado.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Salida / Albarán</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
            Botellas Expedidas
          </span>
          <div className="text-2xl font-bold text-stone-900 mt-1">
            {totalBotellasVendidas.toLocaleString('es-ES')}{' '}
            <span className="text-xs font-normal text-stone-500">botellas</span>
          </div>
          <span className="text-xs text-stone-400 mt-1 block">
            {salidas.length} albaranes de salida emitidos
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
            Cajas Expedidas (~6 bot)
          </span>
          <div className="text-2xl font-bold text-indigo-900 mt-1">
            {salidas.reduce((sum, s) => sum + (s.numeroCajas || Math.ceil(s.cantidadBotellas / 6)), 0).toLocaleString('es-ES')}{' '}
            <span className="text-xs font-normal text-stone-500">cajas</span>
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Transporte seguro flejado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
            Total Facturación Estimada
          </span>
          <div className="text-2xl font-bold text-emerald-800 mt-1">
            {totalFacturacionEstimada.toLocaleString('es-ES', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-stone-500">€</span>
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Base imponible sin IVA</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por albarán, cliente, destino, marca, lote..."
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
                ...MARCAS_COMERCIALES,
                ...salidas.map((s) => s.marca),
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
            {filteredSalidas.length} albaranes
          </span>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredSalidas.map((salida) => (
          <div
            key={salida.id}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-stone-400 font-mono tabular-nums">
                  {salida.fecha} · {salida.numeroAlbaranFactura}
                </span>
                <h3 className="font-serif-wine font-bold text-lg text-stone-900 mt-0.5">
                  {salida.marca}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-block font-mono text-xs text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    {salida.lote}
                  </span>
                  <span className="text-[11px] text-stone-500 font-medium tabular-nums">
                    Añada {salida.anada || salida.fecha.slice(0, 4)} ·{' '}
                    {salida.gradoAlcoholico !== undefined ? `${salida.gradoAlcoholico}% vol` : '—'}
                  </span>
                </div>
              </div>
              <div className="text-right tabular-nums shrink-0">
                <div className="text-base font-bold text-rose-900">
                  {salida.cantidadBotellas.toLocaleString('es-ES')} bot.
                </div>
                <div className="text-xs text-stone-500">
                  {salida.numeroCajas || Math.ceil(salida.cantidadBotellas / 6)} cajas
                </div>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-stone-900">{salida.destino}</div>
              <div className="flex items-center justify-between text-stone-500">
                <span>{salida.tipoSalida}</span>
                {salida.pvpUnitario && (
                  <span className="font-semibold text-stone-800 tabular-nums">
                    {salida.pvpUnitario.toFixed(2)} €/bot
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center gap-2">
              {onNavigateToTraceability && (
                <button
                  onClick={() => onNavigateToTraceability(salida.lote)}
                  className="min-h-[44px] px-3 py-2 text-xs font-semibold text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
                >
                  Trazar
                </button>
              )}
              <button
                onClick={() => handleOpenEditModal(salida)}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => handleDelete(salida)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
                aria-label="Eliminar salida"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Salidas Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Fecha / Albarán</th>
                <th className="py-3.5 px-4">Marca de Vino</th>
                <th className="py-3.5 px-4">Lote Envasado</th>
                <th className="py-3.5 px-4">Añada / Grado</th>
                <th className="py-3.5 px-4 text-right">Botellas</th>
                <th className="py-3.5 px-4 text-center">Cajas</th>
                <th className="py-3.5 px-4">Destino / Cliente</th>
                <th className="py-3.5 px-4">Tipo Régimen</th>
                <th className="py-3.5 px-4 text-right">PVP Unit.</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredSalidas.map((salida) => (
                <tr key={salida.id} className="hover:bg-stone-50/70 transition-colors">
                  {/* Fecha & Albarán */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-stone-900">{salida.fecha}</div>
                    <div className="text-xs font-mono text-stone-500">
                      {salida.numeroAlbaranFactura}
                    </div>
                  </td>

                  {/* Marca */}
                  <td className="py-3.5 px-4">
                    <span className="font-serif-wine font-bold text-stone-900 text-base">
                      {salida.marca}
                    </span>
                  </td>

                  {/* Lote */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-xs bg-stone-100 text-stone-800 px-2 py-0.5 rounded border border-stone-200">
                      {salida.lote}
                    </span>
                  </td>

                  {/* Añada y Grado */}
                  <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                    <div className="font-semibold text-stone-900 text-xs">
                      {salida.anada || salida.fecha.slice(0, 4)}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {salida.gradoAlcoholico !== undefined ? `${salida.gradoAlcoholico}% vol` : '—'}
                    </div>
                  </td>

                  {/* Botellas */}
                  <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                    {salida.cantidadBotellas.toLocaleString('es-ES')}{' '}
                    <span className="text-xs font-normal text-stone-500">bot.</span>
                  </td>

                  {/* Cajas */}
                  <td className="py-3.5 px-4 text-center text-xs font-semibold text-stone-700">
                    {salida.numeroCajas || Math.ceil(salida.cantidadBotellas / 6)} cajas
                  </td>

                  {/* Destino */}
                  <td className="py-3.5 px-4 font-medium text-stone-900 max-w-xs truncate" title={salida.destino}>
                    {salida.destino}
                  </td>

                  {/* Tipo */}
                  <td className="py-3.5 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-700 border border-stone-200">
                      {salida.tipoSalida}
                    </span>
                  </td>

                  {/* PVP */}
                  <td className="py-3.5 px-4 text-right font-medium text-stone-800">
                    {salida.pvpUnitario ? `${salida.pvpUnitario.toFixed(2)} €` : '-'}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onNavigateToTraceability && (
                        <button
                          onClick={() => onNavigateToTraceability(salida.lote)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver trazabilidad de este lote"
                        >
                          <Send className="w-4 h-4 text-rose-800" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(salida)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Modificar salida"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(salida)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar salida"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Salida Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  {editingSalida ? `Modificar Salida: ${editingSalida.numeroAlbaranFactura}` : 'Registrar Salida / Expedición'}
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
                  <label className="block font-medium text-stone-700 mb-1">Fecha de Salida *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Albarán / Factura *</label>
                  <input
                    type="text"
                    required
                    value={formData.numeroAlbaranFactura}
                    onChange={(e) => setFormData({ ...formData, numeroAlbaranFactura: e.target.value })}
                    placeholder="Ej. ALB-2024/105"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Lote Selector */}
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Lote de Vino a Expedir (Muestra stock actual) *
                </label>
                <select
                  required
                  value={formData.lote}
                  onChange={(e) => handleLoteChange(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-mono font-bold text-stone-900"
                >
                  <option value="">-- Seleccionar Lote Embotellado --</option>
                  {[...embotellados]
                    .sort(
                      (a, b) =>
                        a.marca.localeCompare(b.marca, 'es', { sensitivity: 'base' }) ||
                        a.lote.localeCompare(b.lote, 'es', { numeric: true })
                    )
                    .map((emb) => (
                      <option key={emb.id} value={emb.lote}>
                        {emb.marca} • Lote: {emb.lote} (Disponible: {emb.botellasDisponibles} botellas)
                      </option>
                    ))}
                </select>
              </div>

              {/* Añada y Grado Alcohólico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      value={formData.gradoAlcoholico ?? ''}
                      onChange={(e) => setFormData({ ...formData, gradoAlcoholico: Number(e.target.value) })}
                      placeholder="12.7"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-12 font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">% vol</span>
                  </div>
                </div>
              </div>

              {/* Cantidad Botellas & Cajas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidad de Botellas *</label>
                  <input
                    type="number"
                    required
                    value={formData.cantidadBotellas}
                    onChange={(e) => handleCantidadChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-rose-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Cajas Estimadas</label>
                  <input
                    type="number"
                    value={formData.numeroCajas || ''}
                    onChange={(e) => setFormData({ ...formData, numeroCajas: Number(e.target.value) })}
                    placeholder="Cajas"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Destino */}
              <div>
                <label className="block font-medium text-stone-700 mb-1">Destino / Cliente / Receptor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Restaurante O Camiño da Ría (Vigo) o Vinoteca Madrid..."
                  value={formData.destino}
                  onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sal-tipo-salida" className="block font-medium text-stone-700 mb-1">Régimen / Tipo de Salida *</label>
                  <select
                    id="sal-tipo-salida"
                    value={formData.tipoSalida}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipoSalida: e.target.value as SalidaRegistro['tipoSalida'],
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="Autoconsumo">Autoconsumo Bodega</option>
                    <option value="Exportación">Exportación Comunitaria / Terceros países</option>
                    <option value="Merma / Rotura">Merma / Rotura Accidental</option>
                    <option value="Muestra / Degustación">Muestra Comercial / Cata Oficial</option>
                    <option value="Venta Nacional">Venta Nacional (Hostelería / Tienda)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">PVP Unitario (€/botella)</label>
                  <input
                    type="number"
                    step="0.10"
                    placeholder="14.50"
                    value={formData.pvpUnitario || ''}
                    onChange={(e) => setFormData({ ...formData, pvpUnitario: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas de entrega, transportista, condiciones de pago..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

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
                  {editingSalida ? 'Guardar Cambios' : 'Confirmar Salida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Registro de Salida"
        message={`¿Deseas anular la salida "${deleteConfirm.details}"?`}
        warningDetails={['Las botellas se devolverán automáticamente al stock disponible del lote.']}
        canDelete={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

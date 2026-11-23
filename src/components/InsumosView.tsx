import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CircleDollarSign,
  Download,
  Edit2,
  PackageCheck,
  Plus,
  Search,
  Tag,
  Trash2,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { MovimientoInsumo, TipoEtiqueta } from '../types/winery';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const InsumosView: React.FC = () => {
  const {
    insumoStockSummary,
    insumosMovimientos,
    addMovimientoInsumo,
    updateMovimientoInsumo,
    deleteMovimientoInsumo,
  } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipoFilter, setSelectedTipoFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<MovimientoInsumo | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    movId: string;
    details: string;
  }>({
    isOpen: false,
    movId: '',
    details: '',
  });

  // Form State
  const [formData, setFormData] = useState<{
    fecha: string;
    tipoInsumo: 'corchos' | 'botellas' | 'lacre' | 'etiquetas' | 'cajas';
    subtipo: string;
    movimiento: 'entrada' | 'salida' | 'ajuste';
    cantidad: number;
    proveedor: string;
    loteProveedor: string;
    costeUnitario?: number;
    observaciones: string;
  }>({
    fecha: new Date().toISOString().slice(0, 10),
    tipoInsumo: 'corchos',
    subtipo: 'natural',
    movimiento: 'entrada',
    cantidad: 1000,
    proveedor: 'Corchos Ibéricos S.L.',
    loteProveedor: 'COR-24-99',
    costeUnitario: 0.42,
    observaciones: 'Entrada de compra a proveedor.',
  });

  const handleOpenAddModal = (presetTipo?: any, presetSubtipo?: string) => {
    setEditingMovimiento(null);
    setFormData({
      fecha: new Date().toISOString().slice(0, 10),
      tipoInsumo: presetTipo || 'corchos',
      subtipo: presetSubtipo || (presetTipo === 'botellas' ? 'verde' : presetTipo === 'etiquetas' ? 'xouba' : presetTipo === 'cajas' ? '6 botellas' : 'natural'),
      movimiento: 'entrada',
      cantidad: 1000,
      proveedor: '',
      loteProveedor: '',
      costeUnitario: 0.45,
      observaciones: 'Recepción de material en bodega.',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mov: MovimientoInsumo) => {
    setEditingMovimiento(mov);
    setFormData({
      fecha: mov.fecha,
      tipoInsumo: mov.tipoInsumo,
      subtipo: mov.subtipo,
      movimiento: mov.movimiento,
      cantidad: mov.cantidad,
      proveedor: mov.proveedor || '',
      loteProveedor: mov.loteProveedor || '',
      costeUnitario: mov.costeUnitario,
      observaciones: mov.observaciones || '',
    });
    setIsModalOpen(true);
  };

  const handleTipoInsumoChange = (tipo: 'corchos' | 'botellas' | 'lacre' | 'etiquetas' | 'cajas') => {
    let defaultSubtipo = 'natural';
    if (tipo === 'corchos') defaultSubtipo = 'natural';
    else if (tipo === 'botellas') defaultSubtipo = 'verde';
    else if (tipo === 'lacre') defaultSubtipo = 'Rojo Burdeos';
    else if (tipo === 'etiquetas') defaultSubtipo = 'xouba';
    else if (tipo === 'cajas') defaultSubtipo = '6 botellas';

    setFormData({
      ...formData,
      tipoInsumo: tipo,
      subtipo: defaultSubtipo,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cantidad <= 0) return;

    if (editingMovimiento) {
      updateMovimientoInsumo(editingMovimiento.id, formData);
    } else {
      addMovimientoInsumo(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (mov: MovimientoInsumo) => {
    setDeleteConfirm({
      isOpen: true,
      movId: mov.id,
      details: `${mov.tipoInsumo} (${mov.subtipo}) - ${mov.cantidad} uds. el ${mov.fecha}`,
    });
  };

  const confirmDelete = () => {
    deleteMovimientoInsumo(deleteConfirm.movId);
    setDeleteConfirm({ ...deleteConfirm, isOpen: false });
  };

  // Filtered movements
  const filteredMovimientos = insumosMovimientos.filter((m) => {
    const matchesSearch =
      m.subtipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.tipoInsumo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.proveedor && m.proveedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.embotelladoLoteAsociado && m.embotelladoLoteAsociado.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTipo = !selectedTipoFilter || m.tipoInsumo === selectedTipoFilter;

    return matchesSearch && matchesTipo;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Insumos de Envasado
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Corchos, botellas, lacre, etiquetas y cajas con descuento automático.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Entrada / Compra</span>
        </button>
      </div>

      {/* Stock Cards for the 5 requested packaging materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Corchos */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">1. Corchos</span>
              <PackageCheck className="w-4 h-4 text-amber-700" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="p-2.5 bg-stone-50 rounded-xl">
                <span className="text-[11px] text-stone-500 block">Natural Extra:</span>
                <span className="text-lg font-bold text-stone-900">
                  {insumoStockSummary.corchos.natural.toLocaleString('es-ES')} <span className="text-xs font-normal">uds</span>
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl">
                <span className="text-[11px] text-stone-500 block">Técnico 1+1:</span>
                <span className="text-lg font-bold text-stone-900">
                  {insumoStockSummary.corchos['1+1'].toLocaleString('es-ES')} <span className="text-xs font-normal">uds</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleOpenAddModal('corchos')}
            className="w-full mt-3 py-1.5 text-xs text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            + Entrada Corchos
          </button>
        </div>

        {/* 2. Botellas */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">2. Botellas 750ml</span>
              <Wine className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="p-2.5 bg-stone-50 rounded-xl">
                <span className="text-[11px] text-stone-500 block">Verdes (Canela):</span>
                <span className="text-lg font-bold text-stone-900">
                  {insumoStockSummary.botellas.verde.toLocaleString('es-ES')} <span className="text-xs font-normal">uds</span>
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl">
                <span className="text-[11px] text-stone-500 block">Transparentes:</span>
                <span className="text-lg font-bold text-stone-900">
                  {insumoStockSummary.botellas.transparente.toLocaleString('es-ES')} <span className="text-xs font-normal">uds</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleOpenAddModal('botellas')}
            className="w-full mt-3 py-1.5 text-xs text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            + Entrada Botellas
          </button>
        </div>

        {/* 3. Lacre */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">3. Lacre de Sellado</span>
              <Archive className="w-4 h-4 text-rose-700" />
            </div>
            <div className="p-3 bg-stone-50 rounded-xl my-3 text-center">
              <span className="text-xs text-stone-500 block">Stock Disponible</span>
              <div className="text-2xl font-black text-rose-900 my-1">
                {insumoStockSummary.lacreKg} <span className="text-sm font-normal text-stone-600">kg</span>
              </div>
              <span className="text-[10px] text-stone-400">~60 botellas / kg</span>
            </div>
          </div>
          <button
            onClick={() => handleOpenAddModal('lacre')}
            className="w-full mt-3 py-1.5 text-xs text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            + Entrada Lacre
          </button>
        </div>

        {/* 4. Etiquetas (7 marcas requeridas) */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">4. Etiquetas Marcas</span>
              <Tag className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="space-y-1 mt-2 text-xs">
              {([
                { key: 'congostras', label: 'Congostras' },
                { key: 'fontan', label: 'Fontán' },
                { key: 'roucon', label: 'O Roucon' },
                { key: 'seixo', label: 'O Seixo' },
                { key: 'palleiros', label: 'Os Palleiros' },
                { key: 'rosado', label: 'Rosado' },
                { key: 'xouba', label: 'Xouba' },
              ] as Array<{ key: TipoEtiqueta; label: string }>).map(({ key, label }) => (
                <div key={key} className="flex justify-between items-center py-0.5 border-b border-stone-100">
                  <span className="font-medium text-stone-700">{label}</span>
                  <span className="font-bold text-stone-900">
                    {(insumoStockSummary.etiquetas[key] || 0).toLocaleString('es-ES')}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => handleOpenAddModal('etiquetas')}
            className="w-full mt-3 py-1.5 text-xs text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            + Entrada Etiquetas
          </button>
        </div>

        {/* 5. Cajas (2, 3, 6 botellas) */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">5. Cajas Embalaje</span>
              <Boxes className="w-4 h-4 text-amber-600" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="p-2 bg-stone-50 rounded-lg flex justify-between items-center text-xs">
                <span className="text-stone-600">2 botellas:</span>
                <span className="font-bold text-stone-900">{insumoStockSummary.cajas['2 botellas']} cajas</span>
              </div>
              <div className="p-2 bg-stone-50 rounded-lg flex justify-between items-center text-xs">
                <span className="text-stone-600">3 botellas:</span>
                <span className="font-bold text-stone-900">{insumoStockSummary.cajas['3 botellas']} cajas</span>
              </div>
              <div className="p-2 bg-stone-50 rounded-lg flex justify-between items-center text-xs">
                <span className="text-stone-600">6 botellas:</span>
                <span className="font-bold text-stone-900">{insumoStockSummary.cajas['6 botellas']} cajas</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleOpenAddModal('cajas')}
            className="w-full mt-3 py-1.5 text-xs text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            + Entrada Cajas
          </button>
        </div>
      </div>

      {/* Movement History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold font-serif-wine text-stone-900">
              Historial de Movimientos de Insumos
            </h3>
            <p className="text-xs text-stone-500">
              Registro de compras a proveedores y consumos automáticos generados por los embotellados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTipoFilter}
              onChange={(e) => setSelectedTipoFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-stone-300 rounded-xl bg-white text-stone-700"
            >
              <option value="">Todos los Tipos</option>
              <option value="botellas">Botellas</option>
              <option value="cajas">Cajas</option>
              <option value="corchos">Corchos</option>
              <option value="etiquetas">Etiquetas</option>
              <option value="lacre">Lacre</option>
            </select>
          </div>
        </div>

        {/* Mobile Movement Cards */}
        <div className="md:hidden space-y-2.5">
          {filteredMovimientos.map((mov) => {
            const isOut = mov.movimiento === 'salida';
            return (
              <div key={mov.id} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
                      {mov.fecha} · {mov.tipoInsumo.toUpperCase()}
                    </span>
                    <div className="font-semibold text-sm text-stone-900 capitalize mt-0.5">
                      {mov.subtipo}
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${isOut ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {isOut ? '-' : '+'}{mov.cantidad.toLocaleString('es-ES')} {mov.tipoInsumo === 'lacre' ? 'kg' : 'uds'}
                  </span>
                </div>
                <div className="text-xs text-stone-500">
                  {mov.embotelladoLoteAsociado ? `Lote: ${mov.embotelladoLoteAsociado}` : mov.proveedor || mov.observaciones || '-'}
                </div>
                <div className="pt-2 border-t border-stone-200/70 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(mov)}
                    className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(mov)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-rose-700 bg-rose-50 rounded-xl cursor-pointer"
                    aria-label="Eliminar movimiento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Tipo Insumo</th>
                <th className="py-3 px-4">Subtipo / Especificación</th>
                <th className="py-3 px-4 text-center">Movimiento</th>
                <th className="py-3 px-4 text-right">Cantidad</th>
                <th className="py-3 px-4">Proveedor / Lote Asociado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredMovimientos.map((mov) => {
                const isOut = mov.movimiento === 'salida';
                return (
                  <tr key={mov.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-stone-900">{mov.fecha}</td>
                    <td className="py-3 px-4 uppercase text-xs font-bold text-stone-600">
                      {mov.tipoInsumo}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-stone-800">
                      {mov.subtipo}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          isOut
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {mov.movimiento}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${isOut ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {isOut ? '-' : '+'}{mov.cantidad.toLocaleString('es-ES')}{' '}
                      <span className="text-xs font-normal text-stone-400">
                        {mov.tipoInsumo === 'lacre' ? 'kg' : 'uds'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-500">
                      {mov.embotelladoLoteAsociado ? (
                        <span className="font-mono text-indigo-700 font-semibold">
                          Lote: {mov.embotelladoLoteAsociado}
                        </span>
                      ) : (
                        <span>{mov.proveedor || mov.observaciones || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(mov)}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(mov)}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Insumo Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-base font-serif-wine">
                {editingMovimiento ? 'Modificar Movimiento de Insumo' : 'Registrar Movimiento de Insumo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-sm text-stone-800 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo de Movimiento *</label>
                  <select
                    value={formData.movimiento}
                    onChange={(e) => setFormData({ ...formData, movimiento: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="ajuste">Ajuste de Recuento</option>
                    <option value="entrada">Entrada (Compra / Recepción)</option>
                    <option value="salida">Salida (Gasto manual / Merma)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Tipo de Insumo *</label>
                  <select
                    value={formData.tipoInsumo}
                    onChange={(e) => handleTipoInsumoChange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white uppercase font-bold text-xs"
                  >
                    <option value="botellas">Botellas</option>
                    <option value="cajas">Cajas</option>
                    <option value="corchos">Corchos</option>
                    <option value="etiquetas">Etiquetas</option>
                    <option value="lacre">Lacre</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Subtipo / Especificación *</label>
                  {formData.tipoInsumo === 'corchos' ? (
                    <select
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="natural">Natural Extra</option>
                      <option value="1+1">Técnico 1+1</option>
                    </select>
                  ) : formData.tipoInsumo === 'botellas' ? (
                    <select
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="transparente">Transparente Flint</option>
                      <option value="verde">Verdes Canela</option>
                    </select>
                  ) : formData.tipoInsumo === 'etiquetas' ? (
                    <select
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="congostras">Congostras</option>
                      <option value="fontan">Fontán</option>
                      <option value="roucon">O Roucon</option>
                      <option value="seixo">O Seixo</option>
                      <option value="palleiros">Os Palleiros</option>
                      <option value="rosado">Rosado</option>
                      <option value="xouba">Xouba</option>
                    </select>
                  ) : formData.tipoInsumo === 'cajas' ? (
                    <select
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="2 botellas">2 botellas</option>
                      <option value="3 botellas">3 botellas</option>
                      <option value="6 botellas">6 botellas</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Cantidad {formData.tipoInsumo === 'lacre' ? '(kg)' : '(unidades)'} *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Coste Unitario (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costeUnitario || ''}
                    onChange={(e) => setFormData({ ...formData, costeUnitario: Number(e.target.value) })}
                    placeholder="0.45"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Proveedor / Fabricante</label>
                <input
                  type="text"
                  placeholder="Ej. Vidriera Galaica, Corchos Ibéricos..."
                  value={formData.proveedor}
                  onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
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
                  {editingMovimiento ? 'Guardar Cambios' : 'Registrar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Movimiento de Insumo"
        message={`¿Deseas eliminar el registro "${deleteConfirm.details}"? El stock se recalculará automáticamente.`}
        canDelete={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

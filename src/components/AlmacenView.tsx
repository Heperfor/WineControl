import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  BarChart3,
  CheckCircle2,
  Droplet,
  Edit2,
  Layers,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  Deposito,
  EstadoDeposito,
  TIPOS_RECIPIENTE_BODEGA,
  TipoRecipiente,
} from '../types/winery';
import { TIPO_VINO_THEME, isRedVariety, resolveEmbotelladoTipoVino } from '../utils/wineType';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const TIPOS_RECIPIENTE = TIPOS_RECIPIENTE_BODEGA;

const ESTADOS_DEPOSITO: EstadoDeposito[] = [
  'Crianza en madera',
  'Crianza sobre lías',
  'Estabilización / Reposo',
  'Fermentación Alcohólica',
  'Fermentación Maloláctica',
  'Listo para embotellar',
  'Maceración / Vendimia',
  'Vacío',
];

interface AlmacenViewProps {
  onOpenNewOperacionForDep?: (depositoId: string) => void;
  onOpenNewEmbotelladoForDep?: (depositoId: string) => void;
}

export const AlmacenView: React.FC<AlmacenViewProps> = ({
  onOpenNewOperacionForDep,
  onOpenNewEmbotelladoForDep,
}) => {
  const {
    depositos,
    entradasUva,
    elaboraciones,
    addDeposito,
    updateDeposito,
    deleteDeposito,
    embotellados,
    salidas,
    checkReferentialIntegrity,
  } = useWinery();

  const [activeSubTab, setActiveSubTab] = useState<'depositos' | 'graneles' | 'embotellado'>('depositos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeposito, setEditingDeposito] = useState<Deposito | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    depId: string;
    depCodigo: string;
    canDelete: boolean;
    warning?: string;
    details: string[];
  }>({
    isOpen: false,
    depId: '',
    depCodigo: '',
    canDelete: true,
    details: [],
  });

  // Form State
  const [formData, setFormData] = useState<{
    codigo: string;
    nombre: string;
    tipoRecipiente: TipoRecipiente;
    capacidadLitros: number;
    estado: EstadoDeposito;
    anoCosecha: number;
    vinoNombre: string;
  }>({
    codigo: String(depositos.length + 1),
    nombre: 'Depósito Nuevo',
    tipoRecipiente: 'Inox cerrado',
    capacidadLitros: 1000,
    estado: 'Vacío',
    anoCosecha: new Date().getFullYear(),
    vinoNombre: '',
  });

  // Aggregated totals
  const totalLitrosGranel = depositos.reduce((sum, d) => sum + (d.litrosActuales || 0), 0);
  const totalCapacidad = depositos.reduce((sum, d) => sum + d.capacidadLitros, 0);
  const pctOcupacionGlobal = totalCapacidad > 0 ? Math.round((totalLitrosGranel / totalCapacidad) * 100) : 0;

  // Variedades a Granel Aggregation
  const variedadesGranelResumen: Record<string, { litros: number; depositos: string[] }> = {};
  depositos.forEach((d) => {
    d.variedades.forEach((v) => {
      if (v.litros > 0) {
        if (!variedadesGranelResumen[v.variedad]) {
          variedadesGranelResumen[v.variedad] = { litros: 0, depositos: [] };
        }
        variedadesGranelResumen[v.variedad].litros += v.litros;
        if (!variedadesGranelResumen[v.variedad].depositos.includes(d.codigo)) {
          variedadesGranelResumen[v.variedad].depositos.push(d.codigo);
        }
      }
    });
  });

  const handleOpenAddModal = () => {
    setFormError(null);
    setEditingDeposito(null);
    setFormData({
      codigo: String(depositos.length + 1),
      nombre: 'Depósito Nuevo',
      tipoRecipiente: 'Inox cerrado',
      capacidadLitros: 1000,
      estado: 'Vacío',
      anoCosecha: new Date().getFullYear(),
      vinoNombre: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (d: Deposito) => {
    setFormError(null);
    setEditingDeposito(d);
    setFormData({
      codigo: d.codigo,
      nombre: d.nombre,
      tipoRecipiente: d.tipoRecipiente,
      capacidadLitros: d.capacidadLitros,
      estado: d.estado,
      anoCosecha: d.anoCosecha,
      vinoNombre: d.vinoNombre || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const codigoTrimmed = formData.codigo.trim().toUpperCase();
    if (!codigoTrimmed) {
      setFormError('Indique un código de recipiente válido.');
      return;
    }
    if (!Number.isFinite(formData.capacidadLitros) || formData.capacidadLitros <= 0) {
      setFormError('La capacidad del depósito debe ser mayor que 0 litros.');
      return;
    }
    const isDuplicateCode = depositos.some(
      (d) =>
        d.codigo.trim().toUpperCase() === codigoTrimmed &&
        d.id !== editingDeposito?.id
    );
    if (isDuplicateCode) {
      setFormError(`Ya existe otro depósito registrado con el código "${codigoTrimmed}".`);
      return;
    }

    setFormError(null);
    const payload = {
      ...formData,
      codigo: codigoTrimmed,
      nombre: formData.nombre.trim() || `Depósito ${codigoTrimmed}`,
    };

    if (editingDeposito) {
      updateDeposito(editingDeposito.id, payload);
    } else {
      addDeposito({
        ...payload,
        litrosActuales: 0,
        variedades: [],
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (d: Deposito) => {
    const check = checkReferentialIntegrity('deposito', d.id);
    setDeleteConfirm({
      isOpen: true,
      depId: d.id,
      depCodigo: d.codigo,
      canDelete: check.canDelete,
      warning: check.warning,
      details: check.details,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.canDelete) {
      deleteDeposito(deleteConfirm.depId);
      setDeleteConfirm({ ...deleteConfirm, isOpen: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
          Graneles y embotellado
        </h2>

        <button
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Recipiente / Depósito</span>
        </button>
      </div>

      {/* Subtabs Selector: Depósitos / Variedades Granel / Vino Embotellado */}
      <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveSubTab('depositos')}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-sm font-medium transition-colors cursor-pointer text-center ${
            activeSubTab === 'depositos'
              ? 'bg-rose-900 text-white font-semibold shadow-2xs'
              : 'bg-white sm:bg-transparent text-stone-600 hover:bg-stone-100 border border-stone-200 sm:border-0'
          }`}
        >
          <Archive className="w-4 h-4 shrink-0" />
          <span className="truncate">Depósitos ({depositos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('graneles')}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-sm font-medium transition-colors cursor-pointer text-center ${
            activeSubTab === 'graneles'
              ? 'bg-rose-900 text-white font-semibold shadow-2xs'
              : 'bg-white sm:bg-transparent text-stone-600 hover:bg-stone-100 border border-stone-200 sm:border-0'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span className="truncate">Graneles ({Object.keys(variedadesGranelResumen).length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('embotellado')}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-sm font-medium transition-colors cursor-pointer text-center ${
            activeSubTab === 'embotellado'
              ? 'bg-rose-900 text-white font-semibold shadow-2xs'
              : 'bg-white sm:bg-transparent text-stone-600 hover:bg-stone-100 border border-stone-200 sm:border-0'
          }`}
        >
          <Wine className="w-4 h-4 shrink-0" />
          <span className="truncate">Botellas ({embotellados.length})</span>
        </button>
      </div>

      {/* VIEW 1: Depósitos y Recipientes Grid */}
      {activeSubTab === 'depositos' && (
        <div className="space-y-4">
          {/* Capacity summary bar */}
          <div className="bg-stone-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-xs uppercase text-amber-300 font-semibold tracking-wider">
                Capacidad Global de Bodega
              </span>
              <div className="text-2xl font-bold font-serif-wine mt-0.5">
                {totalLitrosGranel.toLocaleString('es-ES')}{' '}
                <span className="text-sm font-normal text-stone-300">
                  / {totalCapacidad.toLocaleString('es-ES')} Litros ({pctOcupacionGlobal}% ocupación)
                </span>
              </div>
            </div>
            <div className="w-full sm:w-64">
              <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden border border-stone-700">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, pctOcupacionGlobal)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                <span>{depositos.filter((d) => d.litrosActuales > 0).length} en uso</span>
                <span>{depositos.filter((d) => d.litrosActuales === 0).length} vacíos</span>
              </div>
            </div>
          </div>

          {/* Tanks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {depositos.map((dep) => {
              const fillPct =
                dep.capacidadLitros > 0
                  ? Math.round((dep.litrosActuales / dep.capacidadLitros) * 100)
                  : 0;
              const isTankEmpty = dep.litrosActuales === 0;

              return (
                <div
                  key={dep.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-lg text-stone-900">{dep.codigo}</h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isTankEmpty
                                ? 'bg-stone-100 text-stone-500'
                                : dep.estado.includes('Fermentación')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {dep.estado}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 line-clamp-1">{dep.nombre}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(dep)}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(dep)}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Cylindrical Tank Graphic */}
                    <div className="relative my-3 p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center gap-3">
                      {/* Stylized Tank Cylinder */}
                      <div className="w-14 h-24 rounded-t-lg rounded-b-xl border-2 border-stone-400 bg-stone-200 relative overflow-hidden flex flex-col justify-end shadow-inner shrink-0">
                        <div
                          className={`w-full transition-all duration-500 rounded-b-lg ${
                            dep.vinoNombre?.toLowerCase().includes('rosado')
                              ? 'bg-gradient-to-t from-rose-500 to-rose-300'
                              : dep.variedades.some((v) => isRedVariety(v.variedad))
                              ? 'bg-gradient-to-t from-rose-950 to-rose-800'
                              : 'bg-gradient-to-t from-amber-600 to-amber-300'
                          }`}
                          style={{ height: `${Math.min(100, Math.max(isTankEmpty ? 0 : 5, fillPct))}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-stone-800 drop-shadow-xs">
                          {fillPct}%
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="text-xl font-black text-stone-900 tabular-nums">
                          {dep.litrosActuales.toLocaleString('es-ES')}{' '}
                          <span className="text-xs font-normal text-stone-400">/ {dep.capacidadLitros} L</span>
                        </div>
                        <div className="text-[11px] font-semibold text-rose-900 line-clamp-1">
                          {dep.vinoNombre || (isTankEmpty ? 'Depósito Disponible' : 'Mosto / Vino en proceso')}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {dep.tipoRecipiente}
                        </div>
                      </div>
                    </div>

                    {/* Varietal breakdown inside this tank */}
                    {dep.variedades.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-stone-100">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">
                          Composición Varietal:
                        </span>
                        <div className="space-y-1">
                          {dep.variedades.map((v, i) => (
                            <div key={i} className="flex justify-between text-xs text-stone-700 tabular-nums">
                              <span>{v.variedad}</span>
                              <span className="font-semibold text-stone-900">
                                {v.litros} L ({v.porcentaje}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dep.ultimaOperacion && (
                      <div className="text-[10px] text-stone-500 italic mt-2 line-clamp-1">
                        Última op: {dep.ultimaOperacion} ({dep.fechaUltimaOperacion})
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="p-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                    {onOpenNewOperacionForDep && (
                      <button
                        onClick={() => onOpenNewOperacionForDep(dep.id)}
                        className="min-h-[40px] text-indigo-800 hover:text-indigo-950 font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-50 cursor-pointer"
                      >
                        + Práctica
                      </button>
                    )}
                    {onOpenNewEmbotelladoForDep && dep.litrosActuales > 0 && (
                      <button
                        onClick={() => onOpenNewEmbotelladoForDep(dep.id)}
                        className="min-h-[40px] text-rose-900 hover:text-rose-950 font-semibold px-3 py-1.5 rounded-xl hover:bg-rose-50 cursor-pointer"
                      >
                        Embotellar →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Variedades de Vino a Granel */}
      {activeSubTab === 'graneles' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-xl font-bold font-serif-wine text-stone-900">
              Existencias Globales de Vino a Granel por Variedad
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Litros netos de vino y mosto disponibles en el parque de depósitos, clasificados por variedad vinífera.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(variedadesGranelResumen)
              .sort((a, b) => b[1].litros - a[1].litros)
              .map(([variedad, info]) => {
                const pct = totalLitrosGranel > 0 ? Math.round((info.litros / totalLitrosGranel) * 100) : 0;
                return (
                  <div
                    key={variedad}
                    className="p-5 rounded-2xl border border-stone-200 bg-stone-50/60 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-base text-stone-900">{variedad}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        {pct}% del total
                      </span>
                    </div>

                    <div className="text-2xl font-black text-rose-950 my-1">
                      {info.litros.toLocaleString('es-ES')}{' '}
                      <span className="text-sm font-normal text-stone-500">Litros a granel</span>
                    </div>

                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden my-2">
                      <div
                        className="h-full bg-gradient-to-r from-rose-800 to-amber-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="text-xs text-stone-500 mt-2">
                      <span className="font-medium text-stone-700">Presente en:</span>{' '}
                      {info.depositos.join(', ')}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* VIEW 3: Stock de Vino Embotellado */}
      {activeSubTab === 'embotellado' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold font-serif-wine text-stone-900">
                Inventario de Vino Embotellado por Marca y Lote
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Existencias disponibles de botellas 0,75L para comercialización y partidas afinándose en rima.
              </p>
            </div>
          </div>

          {/* Mobile Bottled Stock Cards */}
          <div className="md:hidden space-y-3">
            {embotellados.map((emb) => {
              const salidasLote = salidas
                .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
                .reduce((sum, s) => sum + s.cantidadBotellas, 0);
              const tv = resolveEmbotelladoTipoVino(emb, { entradasUva, elaboraciones, depositos });
              const theme = TIPO_VINO_THEME[tv];

              return (
                <div key={emb.id} className={`p-4 rounded-2xl border space-y-2 ${theme.card}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif-wine font-bold text-stone-900 text-lg">{emb.marca}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${theme.badge}`}>
                          {tv}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-stone-600">{emb.lote} · Dep. {emb.depositoProcedenciaId}</span>
                    </div>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                        emb.etiquetado
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {emb.etiquetado ? 'Vestido' : 'En Rima'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200/60 text-center tabular-nums">
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase block">Envasadas</span>
                      <span className="text-xs font-semibold text-stone-700">{emb.cantidadBotellas075.toLocaleString('es-ES')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase block">Salidas</span>
                      <span className="text-xs font-semibold text-stone-600">{salidasLote.toLocaleString('es-ES')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase block">Disponible</span>
                      <span className="text-sm font-bold text-emerald-800">{emb.botellasDisponibles.toLocaleString('es-ES')} bot.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Marca de Vino</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Lote Oficial</th>
                  <th className="py-3 px-4">Depósito Origen</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Botellas Envasadas</th>
                  <th className="py-3 px-4 text-right">Salidas Realizadas</th>
                  <th className="py-3 px-4 text-right">Stock Disponible</th>
                  <th className="py-3 px-4">Presentación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {embotellados.map((emb) => {
                  const salidasLote = salidas
                    .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
                    .reduce((sum, s) => sum + s.cantidadBotellas, 0);
                  const tv = resolveEmbotelladoTipoVino(emb, { entradasUva, elaboraciones, depositos });
                  const theme = TIPO_VINO_THEME[tv];

                  return (
                    <tr key={emb.id} className={theme.card}>
                      <td className="py-3.5 px-4 font-serif-wine font-bold text-stone-900 text-base">
                        {emb.marca}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${theme.badge}`}>
                          {tv}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-stone-800">
                        {emb.lote}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-indigo-800">
                        {emb.depositoProcedenciaId}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            emb.etiquetado
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {emb.etiquetado ? 'Vestido (Listo)' : 'En Rima (Sin vestir)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-600 font-medium tabular-nums">
                        {emb.cantidadBotellas075.toLocaleString('es-ES')} bot.
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-500 tabular-nums">
                        {salidasLote.toLocaleString('es-ES')} bot.
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-base text-emerald-800 tabular-nums">
                        {emb.botellasDisponibles.toLocaleString('es-ES')} <span className="text-xs font-normal">bot.</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-500">
                        Corcho {emb.insumos.tipoCorcho} • Botella {emb.insumos.tipoBotella} {emb.insumos.lacre ? '• Lacre' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Depósito Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-base font-serif-wine">
                {editingDeposito ? `Modificar Depósito: ${editingDeposito.codigo}` : 'Añadir Nuevo Recipiente / Depósito'}
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
                  <label htmlFor="dep-codigo" className="block font-medium text-stone-700 mb-1">Código Recipiente *</label>
                  <input
                    id="dep-codigo"
                    type="text"
                    required
                    placeholder="Ej. 11, 6F, B4"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="dep-capacidad" className="block font-medium text-stone-700 mb-1">Capacidad Total (Litros) *</label>
                  <input
                    id="dep-capacidad"
                    type="number"
                    required
                    min={1}
                    value={formData.capacidadLitros}
                    onChange={(e) => setFormData({ ...formData, capacidadLitros: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="dep-nombre" className="block font-medium text-stone-700 mb-1">Nombre Descriptivo</label>
                <input
                  id="dep-nombre"
                  type="text"
                  placeholder="Ej. Depósito Inox Cónico 6"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dep-tipo" className="block font-medium text-stone-700 mb-1">Tipo de Recipiente *</label>
                  <select
                    id="dep-tipo"
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

                <div>
                  <label htmlFor="dep-estado" className="block font-medium text-stone-700 mb-1">Estado Operativo</label>
                  <select
                    id="dep-estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as EstadoDeposito })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {ESTADOS_DEPOSITO.map((est) => (
                      <option key={est} value={est}>
                        {est}
                      </option>
                    ))}
                  </select>
                </div>
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
                  {editingDeposito ? 'Guardar Cambios' : 'Añadir Depósito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Referential Integrity Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={`Eliminar Recipiente: ${deleteConfirm.depCodigo}`}
        message={
          deleteConfirm.canDelete
            ? `¿Deseas eliminar permanentemente el depósito "${deleteConfirm.depCodigo}"?`
            : deleteConfirm.warning || 'No se puede eliminar este depósito.'
        }
        warningDetails={deleteConfirm.details}
        canDelete={deleteConfirm.canDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

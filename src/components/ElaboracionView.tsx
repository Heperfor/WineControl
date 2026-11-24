import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Droplet,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  ElaboracionRegistro,
  OperacionElaboracion,
  TIPOS_VINO,
  TipoVino,
  VARIEDADES_PREDEFINIDAS,
} from '../types/winery';
import { TIPO_VINO_THEME, inferTipoVinoFromVarieties } from '../utils/wineType';
import { getLocalIsoDate } from '../utils/dateUtils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const OPERACIONES_ENOLOGICAS: OperacionElaboracion[] = [
  'Battonage sobre lías finas',
  'Clarificación',
  'Correcciones',
  'Desfangado estático en frío',
  'Ensamblaje / Coupage',
  'Estabilización por frío',
  'Fermentación maloláctica',
  'Filtración',
  'Remontado / Bazuqueo',
  'Sulfitado',
  'Trasiego y desborre',
];

interface ElaboracionViewProps {
  initialOpenModal?: boolean;
  preselectedDepositoId?: string;
}

export const ElaboracionView: React.FC<ElaboracionViewProps> = ({
  initialOpenModal = false,
  preselectedDepositoId,
}) => {
  const {
    depositos,
    entradasUva,
    elaboraciones,
    addElaboracion,
    updateElaboracion,
    deleteElaboracion,
  } = useWinery();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepositoFilter, setSelectedDepositoFilter] = useState(preselectedDepositoId || '');
  const [selectedOperacionFilter, setSelectedOperacionFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [editingElaboracion, setEditingElaboracion] = useState<ElaboracionRegistro | null>(null);

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    elabId: string;
    details: string;
  }>({
    isOpen: false,
    elabId: '',
    details: '',
  });

  // Form State
  const [formData, setFormData] = useState<{
    fecha: string;
    depositoOrigenId: string;
    depositoDestinoId?: string;
    destinoTipo: 'mismo_deposito' | 'deposito' | 'embotellado' | 'merma_limpieza';
    cantidadLitros: number;
    operacionRealizada: OperacionElaboracion;
    tipoVino: TipoVino;
    anada: number;
    gradoAlcoholico: number;
    cantidadSulfitado: string;
    detalleCorreccion: string;
    porcentajesVariedades: Array<{ variedad: string; porcentaje: number }>;
  }>({
    fecha: getLocalIsoDate(),
    depositoOrigenId: preselectedDepositoId || depositos[0]?.id || '1',
    depositoDestinoId: preselectedDepositoId || depositos[0]?.id || '1',
    destinoTipo: 'mismo_deposito',
    cantidadLitros: 1000,
    operacionRealizada: 'Battonage sobre lías finas',
    tipoVino: 'Blanco',
    anada: new Date().getFullYear(),
    gradoAlcoholico: 12.5,
    cantidadSulfitado: '',
    detalleCorreccion: '',
    porcentajesVariedades: [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentaje: 100 }],
  });

  const inferTankTipoVino = (depId: string, vars: Array<{ variedad: string; porcentaje: number }>): TipoVino => {
    const depObj = depositos.find((d) => d.id === depId);
    const matchingEntrada = entradasUva.find((e) => e.depositoDestinoId === depId);
    if (matchingEntrada?.tipoVino) return matchingEntrada.tipoVino;
    return inferTipoVinoFromVarieties(vars, depObj?.vinoNombre);
  };

  const inferTankAnada = (depId: string, fallbackYear: number): number => {
    const elab = elaboraciones.find(
      (e) => (e.depositoDestinoId === depId || e.depositoOrigenId === depId) && e.anada
    );
    if (elab?.anada) return elab.anada;
    const ent = entradasUva.find((e) => e.depositoDestinoId === depId && e.anada);
    if (ent?.anada) return ent.anada;
    const depObj = depositos.find((d) => d.id === depId);
    return depObj?.anoCosecha || fallbackYear;
  };

  const inferTankGrado = (depId: string): number => {
    const elab = elaboraciones.find(
      (e) => (e.depositoDestinoId === depId || e.depositoOrigenId === depId) && e.gradoAlcoholico !== undefined
    );
    if (elab?.gradoAlcoholico !== undefined) return elab.gradoAlcoholico;
    const ent = entradasUva.find((e) => e.depositoDestinoId === depId && e.gradoBaboBaume !== undefined);
    if (ent?.gradoBaboBaume !== undefined) return ent.gradoBaboBaume;
    return 12.5;
  };

  const lastHandledOpenRef = useRef<string | null>(null);

  useEffect(() => {
    if (preselectedDepositoId) {
      setSelectedDepositoFilter(preselectedDepositoId);
    }
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
    setEditingElaboracion(null);
    const chosenDepId = depId || selectedDepositoFilter || depositos[0]?.id || '1';
    const depObj = depositos.find((d) => d.id === chosenDepId);
    const today = getLocalIsoDate();

    const initialVars =
      depObj && depObj.variedades.length > 0
        ? depObj.variedades.map((v) => ({ variedad: v.variedad, porcentaje: v.porcentaje }))
        : [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentaje: 100 }];

    setFormData({
      fecha: today,
      depositoOrigenId: chosenDepId,
      depositoDestinoId: chosenDepId,
      destinoTipo: 'mismo_deposito',
      cantidadLitros: depObj?.litrosActuales || 1000,
      operacionRealizada: 'Battonage sobre lías finas',
      tipoVino: inferTankTipoVino(chosenDepId, initialVars),
      anada: inferTankAnada(chosenDepId, Number(today.slice(0, 4))),
      gradoAlcoholico: inferTankGrado(chosenDepId),
      cantidadSulfitado: '',
      detalleCorreccion: '',
      porcentajesVariedades: initialVars,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (elab: ElaboracionRegistro) => {
    setEditingElaboracion(elab);
    setFormData({
      fecha: elab.fecha,
      depositoOrigenId: elab.depositoOrigenId,
      depositoDestinoId: elab.depositoDestinoId || elab.depositoOrigenId,
      destinoTipo: elab.destinoTipo,
      cantidadLitros: elab.cantidadLitros,
      operacionRealizada: elab.operacionRealizada,
      tipoVino: elab.tipoVino || inferTankTipoVino(elab.depositoOrigenId, elab.porcentajesVariedades),
      anada: elab.anada || inferTankAnada(elab.depositoOrigenId, Number(elab.fecha.slice(0, 4))),
      gradoAlcoholico: elab.gradoAlcoholico ?? inferTankGrado(elab.depositoOrigenId),
      cantidadSulfitado: elab.cantidadSulfitado || '',
      detalleCorreccion: elab.detalleCorreccion || '',
      porcentajesVariedades: [...elab.porcentajesVariedades],
    });
    setIsModalOpen(true);
  };

  const handleOrigenChange = (depId: string) => {
    const depObj = depositos.find((d) => d.id === depId);
    const vars =
      depObj && depObj.variedades.length > 0
        ? depObj.variedades.map((v) => ({ variedad: v.variedad, porcentaje: v.porcentaje }))
        : [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentaje: 100 }];

    setFormData({
      ...formData,
      depositoOrigenId: depId,
      cantidadLitros: depObj ? depObj.litrosActuales : formData.cantidadLitros,
      porcentajesVariedades: vars,
      tipoVino: inferTankTipoVino(depId, vars),
      anada: inferTankAnada(depId, Number(formData.fecha.slice(0, 4))),
      gradoAlcoholico: inferTankGrado(depId),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.depositoOrigenId || formData.cantidadLitros <= 0) {
      return;
    }

    if (editingElaboracion) {
      updateElaboracion(editingElaboracion.id, formData);
    } else {
      addElaboracion(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (el: ElaboracionRegistro) => {
    setDeleteConfirm({
      isOpen: true,
      elabId: el.id,
      details: `${el.id} - ${el.operacionRealizada} en Depósito ${el.depositoOrigenId} (${el.cantidadLitros} L)`,
    });
  };

  const confirmDelete = () => {
    deleteElaboracion(deleteConfirm.elabId);
    setDeleteConfirm({ ...deleteConfirm, isOpen: false });
  };

  // Filtered list
  const filteredElaboraciones = elaboraciones.filter((el) => {
    const matchesSearch =
      el.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.operacionRealizada.toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.depositoOrigenId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (el.depositoDestinoId && el.depositoDestinoId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (el.observaciones && el.observaciones.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDep = !selectedDepositoFilter || el.depositoOrigenId === selectedDepositoFilter || el.depositoDestinoId === selectedDepositoFilter;
    const matchesOp = !selectedOperacionFilter || el.operacionRealizada === selectedOperacionFilter;

    return matchesSearch && matchesDep && matchesOp;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Elaboración
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Trasiegos, battonage, clarificación, filtración, sulfitado y correcciones.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Práctica Enológica</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por operación o depósito..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-800/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedDepositoFilter}
            onChange={(e) => setSelectedDepositoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white text-stone-700"
          >
            <option value="">Todos los Depósitos</option>
            {[...depositos]
              .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.codigo} ({d.nombre})
                </option>
              ))}
          </select>

          <select
            value={selectedOperacionFilter}
            onChange={(e) => setSelectedOperacionFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white text-stone-700"
          >
            <option value="">Todas las Operaciones</option>
            {OPERACIONES_ENOLOGICAS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">
            {filteredElaboraciones.length} registros
          </span>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredElaboraciones.map((elab) => {
          const origenDep = depositos.find((d) => d.id === elab.depositoOrigenId);
          return (
            <div
              key={elab.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
                    {elab.fecha} · Añada {elab.anada || origenDep?.anoCosecha || elab.fecha.slice(0, 4)} ·{' '}
                    {elab.gradoAlcoholico !== undefined ? `${elab.gradoAlcoholico}% vol` : '—'}
                  </span>
                  <h3 className="font-bold text-base text-rose-900 mt-0.5">
                    {elab.operacionRealizada}
                  </h3>
                </div>
                <span className="text-sm font-bold text-stone-900 tabular-nums shrink-0 bg-stone-100 px-2.5 py-1 rounded-xl">
                  {elab.cantidadLitros.toLocaleString('es-ES')} L
                </span>
              </div>

              {(elab.operacionRealizada === 'Sulfitado' && elab.cantidadSulfitado) ||
              (elab.operacionRealizada === 'Correcciones' && elab.detalleCorreccion) ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-950">
                  {elab.operacionRealizada === 'Sulfitado'
                    ? `Dosis: ${elab.cantidadSulfitado}`
                    : elab.detalleCorreccion}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-stone-900 bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded-lg border border-indigo-200">
                  <Droplet className="w-3.5 h-3.5 text-indigo-600" />
                  {elab.depositoOrigenId}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                {elab.destinoTipo === 'mismo_deposito' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium">
                    Mismo depósito
                  </span>
                ) : elab.destinoTipo === 'deposito' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
                    {elab.depositoDestinoId}
                  </span>
                ) : elab.destinoTipo === 'embotellado' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                    Salida a Embotellado
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500">
                    Merma / Limpieza
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 tabular-nums">
                <div className="flex flex-wrap gap-1">
                  {elab.porcentajesVariedades.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 bg-stone-100 rounded-md text-stone-700">
                      {v.variedad} {v.porcentaje}%
                    </span>
                  ))}
                </div>
                {(() => {
                  const tv = elab.tipoVino || inferTipoVinoFromVarieties(elab.porcentajesVariedades);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TIPO_VINO_THEME[tv].badge}`}
                    >
                      {tv}
                    </span>
                  );
                })()}
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(elab)}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(elab)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
                  aria-label="Eliminar práctica"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Elaboraciones Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Depósito Origen</th>
                <th className="py-3.5 px-4">Operación Realizada</th>
                <th className="py-3.5 px-4 text-right">Litros</th>
                <th className="py-3.5 px-4">Destino</th>
                <th className="py-3.5 px-4">% Variedades</th>
                <th className="py-3.5 px-4">Añada / Grado</th>
                <th className="py-3.5 px-4 text-center">Tipo de Vino</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredElaboraciones.map((elab) => {
                const origenDep = depositos.find((d) => d.id === elab.depositoOrigenId);
                return (
                  <tr key={elab.id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      {elab.fecha}
                    </td>

                    {/* Origen */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 flex items-center gap-1.5">
                        <Droplet className="w-4 h-4 text-indigo-600" />
                        <span>{elab.depositoOrigenId}</span>
                      </div>
                      <span className="text-xs text-stone-400">
                        {origenDep?.tipoRecipiente || 'Depósito'}
                      </span>
                    </td>

                    {/* Operacion (solo nombre general en rojo y dosis donde proceda) */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-rose-900 flex items-center gap-1.5">
                        <span>{elab.operacionRealizada}</span>
                      </div>
                      {elab.operacionRealizada === 'Sulfitado' && elab.cantidadSulfitado && (
                        <div className="text-xs font-semibold text-amber-800 mt-0.5">
                          Dosis: {elab.cantidadSulfitado}
                        </div>
                      )}
                      {elab.operacionRealizada === 'Correcciones' && elab.detalleCorreccion && (
                        <div className="text-xs font-semibold text-indigo-800 mt-0.5">
                          Dosis: {elab.detalleCorreccion}
                        </div>
                      )}
                    </td>

                    {/* Litros */}
                    <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                      {elab.cantidadLitros.toLocaleString('es-ES')}{' '}
                      <span className="text-xs font-normal text-stone-500">L</span>
                    </td>

                    {/* Destino */}
                    <td className="py-3.5 px-4">
                      {elab.destinoTipo === 'mismo_deposito' ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium border border-stone-200">
                          Mismo depósito
                        </span>
                      ) : elab.destinoTipo === 'deposito' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
                          <ArrowRight className="w-3 h-3" /> {elab.depositoDestinoId}
                        </span>
                      ) : elab.destinoTipo === 'embotellado' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                          Salida a Embotellado
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-500">
                          Merma / Limpieza
                        </span>
                      )}
                    </td>

                    {/* Variedades */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {elab.porcentajesVariedades.map((v, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-700"
                          >
                            {v.variedad} {v.porcentaje}%
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Añada y Grado */}
                    <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-stone-900 text-xs">
                        {elab.anada || origenDep?.anoCosecha || elab.fecha.slice(0, 4)}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {elab.gradoAlcoholico !== undefined ? `${elab.gradoAlcoholico}% vol` : '—'}
                      </div>
                    </td>

                    {/* Tipo de Vino */}
                    <td className="py-3.5 px-4 text-center">
                      {(() => {
                        const tv = elab.tipoVino || inferTipoVinoFromVarieties(elab.porcentajesVariedades);
                        return (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TIPO_VINO_THEME[tv].badge}`}
                          >
                            {tv}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(elab)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Modificar práctica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(elab)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar práctica"
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

      {/* Add / Edit Elaboración Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col pb-safe">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  {editingElaboracion ? `Modificar Práctica: ${editingElaboracion.id}` : 'Registrar Operación de Elaboración'}
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
                  <label htmlFor="elab-fecha" className="block font-medium text-stone-700 mb-1">Fecha de la Práctica *</label>
                  <input
                    id="elab-fecha"
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="elab-dep-origen" className="block font-medium text-stone-700 mb-1">Depósito Origen Nº *</label>
                  <select
                    id="elab-dep-origen"
                    required
                    value={formData.depositoOrigenId}
                    onChange={(e) => handleOrigenChange(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
                  >
                    {[...depositos]
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} - {d.nombre} ({d.litrosActuales} L actuales)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Operación Realizada */}
              <div>
                <label htmlFor="elab-operacion" className="block font-medium text-stone-700 mb-1">Operación Realizada *</label>
                <select
                  id="elab-operacion"
                  required
                  value={formData.operacionRealizada}
                  onChange={(e) => setFormData({ ...formData, operacionRealizada: e.target.value as OperacionElaboracion })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium text-rose-900"
                >
                  {OPERACIONES_ENOLOGICAS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Vino, Añada y Grado Alcohólico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="elab-tipo-vino" className="block font-medium text-stone-700 mb-1">Tipo de Vino *</label>
                  <select
                    id="elab-tipo-vino"
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
                  <label htmlFor="elab-anada" className="block font-medium text-stone-700 mb-1">Añada *</label>
                  <input
                    id="elab-anada"
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
                  <label htmlFor="elab-grado" className="block font-medium text-stone-700 mb-1">Grado Alcohólico *</label>
                  <div className="relative">
                    <input
                      id="elab-grado"
                      type="number"
                      required
                      step="0.1"
                      min={0}
                      max={25}
                      value={formData.gradoAlcoholico ?? ''}
                      onChange={(e) => setFormData({ ...formData, gradoAlcoholico: Number(e.target.value) })}
                      placeholder="12.5"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-12 font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">% vol</span>
                  </div>
                </div>
              </div>

              {/* If Sulfitado is selected: Cantidad añadida */}
              {formData.operacionRealizada === 'Sulfitado' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <label htmlFor="elab-sulfitado" className="block font-medium text-amber-950 text-xs mb-1">
                    Cantidad Añadida de Sulfitado (g/hL o gramos totales) *
                  </label>
                  <input
                    id="elab-sulfitado"
                    type="text"
                    required
                    placeholder="Ej. 35 g/hL metabisulfito potásico (o 50 g totales)"
                    value={formData.cantidadSulfitado}
                    onChange={(e) => setFormData({ ...formData, cantidadSulfitado: e.target.value })}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white text-stone-900 text-sm font-semibold"
                  />
                </div>
              )}

              {/* If Correcciones is selected: Detalle de corrección */}
              {formData.operacionRealizada === 'Correcciones' && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <label htmlFor="elab-correccion" className="block font-medium text-indigo-950 text-xs mb-1">
                    Detalle de la Corrección Realizada *
                  </label>
                  <input
                    id="elab-correccion"
                    type="text"
                    required
                    placeholder="Ej. Corrección ácida con ácido tartárico 1.5 g/L, nutrientes de fermentación..."
                    value={formData.detalleCorreccion}
                    onChange={(e) => setFormData({ ...formData, detalleCorreccion: e.target.value })}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-xl bg-white text-stone-900 text-sm font-semibold"
                  />
                </div>
              )}

              {/* Cantidad Litros and Destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="elab-litros" className="block font-medium text-stone-700 mb-1">Cantidad en Litros Intervenidos *</label>
                  <div className="relative">
                    <input
                      id="elab-litros"
                      type="number"
                      required
                      value={formData.cantidadLitros}
                      onChange={(e) => setFormData({ ...formData, cantidadLitros: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl pr-8 font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">L</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="elab-destino-tipo" className="block font-medium text-stone-700 mb-1">Tipo de Destino *</label>
                  <select
                    id="elab-destino-tipo"
                    value={formData.destinoTipo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destinoTipo: e.target.value as ElaboracionRegistro['destinoTipo'],
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="merma_limpieza">Merma / Desborre</option>
                    <option value="mismo_deposito">Mismo Depósito (Tratamiento en tanque)</option>
                    <option value="deposito">Otro Depósito (Trasiego)</option>
                    <option value="embotellado">Salida a Embotellado</option>
                  </select>
                </div>
              </div>

              {formData.destinoTipo === 'deposito' && (
                <div>
                  <label htmlFor="elab-dep-destino" className="block font-medium text-stone-700 mb-1">Depósito Destino del Trasiego *</label>
                  <select
                    id="elab-dep-destino"
                    required
                    value={formData.depositoDestinoId || ''}
                    onChange={(e) => setFormData({ ...formData, depositoDestinoId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {[...depositos]
                      .filter((d) => d.id !== formData.depositoOrigenId)
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} - {d.nombre} (Capacidad: {d.capacidadLitros}L - Ocupado: {d.litrosActuales}L)
                        </option>
                      ))}
                  </select>
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
                  {editingElaboracion ? 'Guardar Cambios' : 'Registrar Operación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Práctica de Elaboración"
        message={`¿Deseas eliminar el registro "${deleteConfirm.details}"?`}
        canDelete={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
      />
    </div>
  );
};

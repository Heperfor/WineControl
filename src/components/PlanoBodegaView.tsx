import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRightLeft,
  Check,
  Droplet,
  Edit3,
  FlaskConical,
  Grape,
  Move,
  Plus,
  RotateCcw,
  Wine,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  AnaliticaRegistro,
  Deposito,
  EstadoDeposito,
  TIPOS_RECIPIENTE_BODEGA,
  TipoRecipiente,
  VARIEDADES_PREDEFINIDAS,
} from '../types/winery';
import { inferTipoVinoFromVarieties, isRedVariety } from '../utils/wineType';
import { getLocalIsoDate } from '../utils/dateUtils';

interface PlanoBodegaViewProps {
  onOpenNewEntradaForDep?: (depositoId: string) => void;
  onOpenNewOperacionForDep?: (depositoId: string) => void;
  onOpenNewEmbotelladoForDep?: (depositoId: string) => void;
  onOpenAnaliticasForDep?: (depositoId: string) => void;
}

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

const MATERIAL_STYLE: Record<
  TipoRecipiente,
  {
    shortLabel: string;
    stroke: string;
    badgeBg: string;
    badgeText: string;
    swatchBg: string;
    defaultForma: 'cilindro' | 'barrica' | 'anfora';
  }
> = {
  'Inox cerrado': {
    shortLabel: 'Inox cerrado',
    stroke: '#334155',
    badgeBg: 'bg-slate-100 border-slate-300',
    badgeText: 'text-slate-800',
    swatchBg: 'bg-slate-600',
    defaultForma: 'cilindro',
  },
  'Siempre lleno abierto': {
    shortLabel: 'Siempre lleno',
    stroke: '#0369a1',
    badgeBg: 'bg-sky-50 border-sky-300',
    badgeText: 'text-sky-900',
    swatchBg: 'bg-sky-600',
    defaultForma: 'cilindro',
  },
  Inox: {
    shortLabel: 'Inox',
    stroke: '#64748b',
    badgeBg: 'bg-stone-100 border-stone-300',
    badgeText: 'text-stone-800',
    swatchBg: 'bg-stone-500',
    defaultForma: 'cilindro',
  },
  'Barrica roble francés': {
    shortLabel: 'Roble francés',
    stroke: '#78350f',
    badgeBg: 'bg-amber-100/80 border-amber-400',
    badgeText: 'text-amber-950',
    swatchBg: 'bg-amber-900',
    defaultForma: 'barrica',
  },
  'Barrica castaño': {
    shortLabel: 'Barrica castaño',
    stroke: '#b45309',
    badgeBg: 'bg-orange-100/80 border-orange-400',
    badgeText: 'text-orange-950',
    swatchBg: 'bg-amber-600',
    defaultForma: 'barrica',
  },
  Ánfora: {
    shortLabel: 'Ánfora',
    stroke: '#9a3412',
    badgeBg: 'bg-rose-50 border-orange-300',
    badgeText: 'text-orange-900',
    swatchBg: 'bg-orange-700',
    defaultForma: 'anfora',
  },
};

const getWineFillColors = (dep: Deposito): { main: string; top: string; labelColor: string } => {
  if (!dep.litrosActuales || dep.litrosActuales <= 0) {
    return { main: '#f5f5f4', top: '#e7e5e4', labelColor: '#1c1917' };
  }
  const vinoLower = (dep.vinoNombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isRosado = vinoLower.includes('rosado');
  const isTinto =
    vinoLower.includes('tinto') ||
    vinoLower.includes('fontan') ||
    vinoLower.includes('palleiros') ||
    vinoLower.includes('seixo') ||
    vinoLower.includes('castano') ||
    vinoLower.includes('brancellao') ||
    dep.variedades.some((v) => isRedVariety(v.variedad));

  if (isRosado) {
    return { main: '#e11d48', top: '#fb7185', labelColor: '#ffffff' };
  }
  if (isTinto) {
    return { main: '#881337', top: '#be123c', labelColor: '#ffffff' };
  }
  // Vino blanco en verde claro
  return { main: '#86efac', top: '#bbf7d0', labelColor: '#14532d' };
};

const getVesselRadius = (capacidadLitros: number): number => {
  if (capacidadLitros >= 2200) return 60;
  if (capacidadLitros >= 1400) return 51;
  if (capacidadLitros >= 850) return 45;
  if (capacidadLitros >= 600) return 41;
  if (capacidadLitros >= 400) return 37;
  if (capacidadLitros >= 250) return 35;
  if (capacidadLitros >= 140) return 30;
  if (capacidadLitros >= 90) return 27;
  return 24;
};

export const PlanoBodegaView: React.FC<PlanoBodegaViewProps> = ({
  onOpenNewEntradaForDep,
  onOpenNewOperacionForDep,
  onOpenNewEmbotelladoForDep,
  onOpenAnaliticasForDep,
}) => {
  const {
    depositos,
    analiticas,
    addDeposito,
    updateDeposito,
    addElaboracion,
    resetFloorPlanPositions,
  } = useWinery();

  const [selectedDepId, setSelectedDepId] = useState<string>(() => depositos[0]?.id || '1');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [moveMode, setMoveMode] = useState(false);
  const [analiticaModalDepId, setAnaliticaModalDepId] = useState<string | null>(null);
  const [selectedAnaliticaIdx, setSelectedAnaliticaIdx] = useState(0);

  // Drag state
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Inline edit state inside inspector
  const [isEditingDep, setIsEditingDep] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    codigo: string;
    nombre: string;
    tipoRecipiente: TipoRecipiente;
    capacidadLitros: number;
    litrosActuales: number;
    estado: EstadoDeposito;
    vinoNombre: string;
    ubicacion: string;
    forma: 'cilindro' | 'barrica' | 'anfora';
  } | null>(null);

  // Quick transfer (Trasiego rápido) state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferLitros, setTransferLitros] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Add vessel modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDepForm, setNewDepForm] = useState<{
    codigo: string;
    nombre: string;
    tipoRecipiente: TipoRecipiente;
    capacidadLitros: number;
    litrosActuales: number;
    vinoNombre: string;
    zona: 'nave' | 'anexo';
  }>({
    codigo: '',
    nombre: '',
    tipoRecipiente: 'Inox cerrado',
    capacidadLitros: 500,
    litrosActuales: 0,
    vinoNombre: '',
    zona: 'nave',
  });

  const selectedDep = useMemo(
    () => depositos.find((d) => d.id === selectedDepId) || depositos[0],
    [depositos, selectedDepId]
  );

  // Global stats
  const totalLitros = useMemo(
    () => depositos.reduce((sum, d) => sum + (d.litrosActuales || 0), 0),
    [depositos]
  );
  const totalCapacidad = useMemo(
    () => depositos.reduce((sum, d) => sum + d.capacidadLitros, 0),
    [depositos]
  );
  const pctGlobal = totalCapacidad > 0 ? Math.round((totalLitros / totalCapacidad) * 100) : 0;
  const depositosConVino = useMemo(
    () => depositos.filter((d) => d.litrosActuales > 0).length,
    [depositos]
  );

  // Breakdown by the 6 vessel types
  const resumenPorMaterial = useMemo(() => {
    return TIPOS_RECIPIENTE_BODEGA.map((tipo) => {
      const items = depositos.filter((d) => d.tipoRecipiente === tipo);
      const litros = items.reduce((s, d) => s + (d.litrosActuales || 0), 0);
      const cap = items.reduce((s, d) => s + d.capacidadLitros, 0);
      return { tipo, count: items.length, litros, cap };
    });
  }, [depositos]);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2600);
  };

  const getAnaliticasForDep = (dep: Deposito): AnaliticaRegistro[] => {
    if (!dep || dep.litrosActuales <= 0) return [];
    const vinoNorm = (dep.vinoNombre || '').toLowerCase().trim();
    return analiticas
      .filter((a) => {
        if (a.depositoId === dep.id) return true;
        if (!vinoNorm) return false;
        const aVino = (a.vinoNombre || '').toLowerCase().trim();
        const aMuestra = (a.muestra || '').toLowerCase().trim();
        return (
          (aVino && (aVino === vinoNorm || aVino.includes(vinoNorm) || vinoNorm.includes(aVino))) ||
          (aMuestra && vinoNorm.includes(aMuestra))
        );
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  };

  const handleSelectDep = (dep: Deposito) => {
    setSelectedDepId(dep.id);
    setIsEditingDep(false);
    setIsTransferOpen(false);
    setMobileSheetOpen(true);
  };

  const startEditingDep = (dep: Deposito) => {
    const defaultForma =
      dep.plano?.forma || MATERIAL_STYLE[dep.tipoRecipiente]?.defaultForma || 'cilindro';
    setEditDraft({
      codigo: dep.codigo,
      nombre: dep.nombre,
      tipoRecipiente: dep.tipoRecipiente,
      capacidadLitros: dep.capacidadLitros,
      litrosActuales: dep.litrosActuales,
      estado: dep.estado,
      vinoNombre: dep.vinoNombre || '',
      ubicacion: dep.ubicacion || 'Nave Principal',
      forma: defaultForma,
    });
    setIsEditingDep(true);
    setIsTransferOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDep || !editDraft) return;
    const clampedLitros = Math.max(0, Math.min(editDraft.capacidadLitros, editDraft.litrosActuales));
    updateDeposito(selectedDep.id, {
      codigo: editDraft.codigo.trim() || selectedDep.codigo,
      nombre: editDraft.nombre.trim() || `Depósito ${editDraft.codigo}`,
      tipoRecipiente: editDraft.tipoRecipiente,
      capacidadLitros: Math.max(1, editDraft.capacidadLitros),
      litrosActuales: clampedLitros,
      estado: clampedLitros === 0 ? 'Vacío' : editDraft.estado === 'Vacío' ? 'Estabilización / Reposo' : editDraft.estado,
      vinoNombre: editDraft.vinoNombre,
      ubicacion: editDraft.ubicacion,
      plano: {
        x: selectedDep.plano?.x ?? 500,
        y: selectedDep.plano?.y ?? 400,
        zona: selectedDep.plano?.zona ?? 'nave',
        forma: editDraft.forma,
      },
    });
    setIsEditingDep(false);
    showToast(`Depósito ${editDraft.codigo} actualizado.`);
  };

  const handleQuickMaterialChange = (dep: Deposito, newTipo: TipoRecipiente) => {
    const newForma = MATERIAL_STYLE[newTipo]?.defaultForma || 'cilindro';
    updateDeposito(dep.id, {
      tipoRecipiente: newTipo,
      plano: {
        x: dep.plano?.x ?? 500,
        y: dep.plano?.y ?? 400,
        zona: dep.plano?.zona ?? 'nave',
        forma: newForma,
      },
    });
    showToast(`Depósito ${dep.codigo}: cambiado a ${newTipo}.`);
  };

  const handleQuickVolumeDelta = (dep: Deposito, delta: number) => {
    const next = Math.max(0, Math.min(dep.capacidadLitros, dep.litrosActuales + delta));
    updateDeposito(dep.id, {
      litrosActuales: next,
      estado: next === 0 ? 'Vacío' : dep.estado === 'Vacío' ? 'Estabilización / Reposo' : dep.estado,
      fechaUltimaOperacion: getLocalIsoDate(),
    });
  };

  const openQuickTransfer = (dep: Deposito) => {
    const candidate = depositos.find(
      (d) => d.id !== dep.id && d.capacidadLitros - d.litrosActuales > 0
    );
    setTransferTargetId(candidate?.id || '');
    setTransferLitros(dep.litrosActuales);
    setIsTransferOpen(true);
    setIsEditingDep(false);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDep || !transferTargetId || transferLitros <= 0) return;
    const litros = Math.min(selectedDep.litrosActuales, transferLitros);
    const pcts =
      selectedDep.variedades.length > 0
        ? selectedDep.variedades.map((v) => ({ variedad: v.variedad, porcentaje: v.porcentaje }))
        : [{ variedad: VARIEDADES_PREDEFINIDAS[0], porcentaje: 100 }];

    addElaboracion({
      fecha: getLocalIsoDate(),
      depositoOrigenId: selectedDep.id,
      depositoDestinoId: transferTargetId,
      destinoTipo: 'deposito',
      tipoVino: inferTipoVinoFromVarieties(pcts, selectedDep.vinoNombre),
      cantidadLitros: litros,
      operacionRealizada: 'Trasiego y desborre',
      porcentajesVariedades: pcts,
    });

    // Also propagate wine name if destination was empty
    const targetDep = depositos.find((d) => d.id === transferTargetId);
    if (targetDep && !targetDep.vinoNombre && selectedDep.vinoNombre) {
      updateDeposito(transferTargetId, {
        vinoNombre: selectedDep.vinoNombre,
        variedades: selectedDep.variedades,
      });
    }

    setIsTransferOpen(false);
    showToast(`Trasegados ${litros} L de ${selectedDep.codigo} a ${transferTargetId}.`);
  };

  const handleCreateVessel = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = newDepForm.codigo.trim();
    if (!codigo || newDepForm.capacidadLitros <= 0) return;
    const forma = MATERIAL_STYLE[newDepForm.tipoRecipiente].defaultForma;
    const created = addDeposito({
      codigo,
      nombre: newDepForm.nombre.trim() || `Depósito ${codigo}`,
      tipoRecipiente: newDepForm.tipoRecipiente,
      capacidadLitros: newDepForm.capacidadLitros,
      litrosActuales: Math.min(newDepForm.capacidadLitros, Math.max(0, newDepForm.litrosActuales)),
      estado: newDepForm.litrosActuales > 0 ? 'Estabilización / Reposo' : 'Vacío',
      anoCosecha: new Date().getFullYear(),
      vinoNombre: newDepForm.vinoNombre.trim(),
      variedades: [],
      ubicacion: newDepForm.zona === 'anexo' ? 'Zona Anexo / Exterior' : 'Nave Principal',
      plano: {
        x: newDepForm.zona === 'anexo' ? 540 : 695,
        y: newDepForm.zona === 'anexo' ? 84 : 420,
        zona: newDepForm.zona,
        forma,
      },
    });
    setIsAddModalOpen(false);
    setSelectedDepId(created.id);
    setNewDepForm({
      codigo: '',
      nombre: '',
      tipoRecipiente: 'Inox cerrado',
      capacidadLitros: 500,
      litrosActuales: 0,
      vinoNombre: '',
      zona: 'nave',
    });
    showToast(`Depósito ${created.codigo} añadido al plano.`);
  };

  // SVG Pointer drag handlers for Move Mode
  const getSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 980;
    const y = ((clientY - rect.top) / rect.height) * 730;
    return {
      x: Math.round(Math.max(40, Math.min(940, x))),
      y: Math.round(Math.max(40, Math.min(690, y))),
    };
  };

  const handlePointerDownVessel = (e: React.PointerEvent, dep: Deposito) => {
    if (!moveMode) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingId(dep.id);
    setSelectedDepId(dep.id);
  };

  const handlePointerMoveSvg = (e: React.PointerEvent) => {
    if (!moveMode || !draggingId) return;
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const dep = depositos.find((d) => d.id === draggingId);
    if (!dep) return;
    updateDeposito(draggingId, {
      plano: {
        x: coords.x,
        y: coords.y,
        zona: coords.y < 162 ? 'anexo' : 'nave',
        forma: dep.plano?.forma || MATERIAL_STYLE[dep.tipoRecipiente].defaultForma,
      },
    });
  };

  const handlePointerUpSvg = () => {
    if (draggingId) {
      setDraggingId(null);
    }
  };

  // Sorted vessels for the bottom quick-index
  const sortedDepositos = useMemo(() => {
    return [...depositos].sort((a, b) => {
      const aNum = parseInt(a.codigo, 10);
      const bNum = parseInt(b.codigo, 10);
      if (!isNaN(aNum) && !isNaN(bNum) && String(aNum) === a.codigo && String(bNum) === b.codigo) {
        return aNum - bNum;
      }
      return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
    });
  }, [depositos]);

  // Shared Inspector Content (used in desktop side panel + mobile bottom sheet)
  const renderInspectorBody = (dep: Deposito) => {
    const fillPct =
      dep.capacidadLitros > 0 ? Math.round((dep.litrosActuales / dep.capacidadLitros) * 100) : 0;
    const matStyle = MATERIAL_STYLE[dep.tipoRecipiente] || MATERIAL_STYLE['Inox'];
    const wineColors = getWineFillColors(dep);

    if (isEditingDep && editDraft) {
      return (
        <form onSubmit={handleSaveEdit} className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h4 className="font-serif-wine font-bold text-stone-900">
              Editar Depósito {dep.codigo}
            </h4>
            <button
              type="button"
              onClick={() => setIsEditingDep(false)}
              className="text-xs text-stone-500 hover:text-stone-800 px-2 py-1 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Nº / Código</label>
              <input
                type="text"
                required
                value={editDraft.codigo}
                onChange={(e) => setEditDraft({ ...editDraft, codigo: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Capacidad (L)</label>
              <input
                type="number"
                required
                min={1}
                value={editDraft.capacidadLitros}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, capacidadLitros: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Material / Tipo de Depósito
            </label>
            <select
              value={editDraft.tipoRecipiente}
              onChange={(e) => {
                const tipo = e.target.value as TipoRecipiente;
                setEditDraft({
                  ...editDraft,
                  tipoRecipiente: tipo,
                  forma: MATERIAL_STYLE[tipo].defaultForma,
                });
              }}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
            >
              {TIPOS_RECIPIENTE_BODEGA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Vino actual (Litros)
              </label>
              <input
                type="number"
                min={0}
                max={editDraft.capacidadLitros}
                value={editDraft.litrosActuales}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, litrosActuales: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-rose-900 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Silueta plano</label>
              <select
                value={editDraft.forma}
                onChange={(e) =>
                  setEditDraft({
                    ...editDraft,
                    forma: e.target.value as 'cilindro' | 'barrica' | 'anfora',
                  })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
              >
                <option value="anfora">Ánfora</option>
                <option value="barrica">Barrica oval</option>
                <option value="cilindro">Depósito circular</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Vino / Partida</label>
            <input
              type="text"
              placeholder="Ej. Xouba 2024"
              value={editDraft.vinoNombre}
              onChange={(e) => setEditDraft({ ...editDraft, vinoNombre: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Estado</label>
            <select
              value={editDraft.estado}
              onChange={(e) =>
                setEditDraft({ ...editDraft, estado: e.target.value as EstadoDeposito })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
            >
              {ESTADOS_DEPOSITO.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] py-2.5 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </form>
      );
    }

    if (isTransferOpen) {
      return (
        <form onSubmit={handleConfirmTransfer} className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h4 className="font-serif-wine font-bold text-stone-900">
              Trasiego desde Nº {dep.codigo}
            </h4>
            <button
              type="button"
              onClick={() => setIsTransferOpen(false)}
              className="text-xs text-stone-500 hover:text-stone-800 px-2 py-1 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
            Disponible en <strong>Nº {dep.codigo}</strong>:{' '}
            <strong className="text-stone-900 tabular-nums">
              {dep.litrosActuales.toLocaleString('es-ES')} L
            </strong>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Depósito Destino *
            </label>
            <select
              required
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
            >
              <option value="">-- Seleccionar destino --</option>
              {sortedDepositos
                .filter((d) => d.id !== dep.id)
                .map((d) => {
                  const libre = Math.max(0, d.capacidadLitros - d.litrosActuales);
                  return (
                    <option key={d.id} value={d.id}>
                      Nº {d.codigo} ({d.tipoRecipiente}) · Libre: {libre} L / {d.capacidadLitros} L
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Litros a trasegar *
            </label>
            <input
              type="number"
              required
              min={1}
              max={dep.litrosActuales}
              value={transferLitros || ''}
              onChange={(e) => setTransferLitros(Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold tabular-nums"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Confirmar Trasiego en Trazabilidad</span>
          </button>
        </form>
      );
    }

    return (
      <div className="space-y-4">
        {/* Vessel Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-stone-500">
              {dep.ubicacion || 'Bodega'} · {dep.estado}
            </div>
            <h3 className="text-xl font-bold font-serif-wine text-stone-900 mt-0.5">
              Depósito Nº {dep.codigo}
            </h3>
            <p className="text-xs text-stone-500">{dep.nombre}</p>
          </div>

          <button
            onClick={() => startEditingDep(dep)}
            className="min-h-[40px] px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        </div>

        {/* Live Visual Tank Level + Capacity */}
        <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-4">
          <div className="w-14 h-20 rounded-xl border-2 border-stone-400 bg-white relative overflow-hidden flex flex-col justify-end shrink-0">
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${Math.min(100, Math.max(dep.litrosActuales > 0 ? 6 : 0, fillPct))}%`,
                backgroundColor: wineColors.main,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-stone-900 drop-shadow-xs tabular-nums">
              <span className="bg-white/80 px-1 rounded">{fillPct}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-2xl font-bold text-stone-900 tabular-nums leading-tight">
              {dep.litrosActuales.toLocaleString('es-ES')}{' '}
              <span className="text-xs font-medium text-stone-500">
                / {dep.capacidadLitros.toLocaleString('es-ES')} L
              </span>
            </div>
            <div className="text-sm font-semibold text-rose-900 truncate">
              {dep.vinoNombre || (dep.litrosActuales === 0 ? 'Vacío / Disponible' : 'Vino en depósito')}
            </div>
            <div className="text-xs text-stone-500 tabular-nums">
              Espacio libre: {(dep.capacidadLitros - dep.litrosActuales).toLocaleString('es-ES')} L
            </div>
          </div>
        </div>

        {/* Quick Material Switcher (the 6 requested vessel types) */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">
            Material / Tipo de Depósito
          </label>
          <select
            value={dep.tipoRecipiente}
            onChange={(e) => handleQuickMaterialChange(dep, e.target.value as TipoRecipiente)}
            className={`w-full min-h-[42px] px-3 py-2 text-xs font-semibold border rounded-xl cursor-pointer ${matStyle.badgeBg} ${matStyle.badgeText}`}
          >
            {TIPOS_RECIPIENTE_BODEGA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Volume Adjust Strip */}
        <div>
          <span className="block text-xs font-semibold text-stone-600 mb-1.5">
            Ajuste rápido de volumen actual
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickVolumeDelta(dep, -50)}
              disabled={dep.litrosActuales <= 0}
              className="min-h-[40px] rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-xs font-bold text-stone-800 tabular-nums cursor-pointer"
            >
              -50 L
            </button>
            <button
              type="button"
              onClick={() => handleQuickVolumeDelta(dep, 50)}
              disabled={dep.litrosActuales >= dep.capacidadLitros}
              className="min-h-[40px] rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-xs font-bold text-stone-800 tabular-nums cursor-pointer"
            >
              +50 L
            </button>
            <button
              type="button"
              onClick={() => handleQuickVolumeDelta(dep, -dep.litrosActuales)}
              disabled={dep.litrosActuales === 0}
              className="min-h-[40px] rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-xs font-semibold text-rose-900 cursor-pointer"
            >
              Vaciar
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickVolumeDelta(dep, dep.capacidadLitros - dep.litrosActuales)
              }
              disabled={dep.litrosActuales >= dep.capacidadLitros}
              className="min-h-[40px] rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-xs font-semibold text-emerald-900 cursor-pointer"
            >
              Llenar
            </button>
          </div>
        </div>

        {/* Varietal Composition */}
        {dep.variedades && dep.variedades.length > 0 && (
          <div className="pt-2 border-t border-stone-200 space-y-1.5">
            <span className="text-xs font-semibold text-stone-600 block">
              Composición varietal
            </span>
            {dep.variedades.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-stone-700 font-medium">{v.variedad}</span>
                <span className="font-bold text-stone-900">
                  {v.litros} L ({v.porcentaje}%)
                </span>
              </div>
            ))}
          </div>
        )}

        {dep.ultimaOperacion && (
          <div className="text-xs text-stone-500 pt-1 border-t border-stone-100">
            Última operación: <span className="text-stone-700 font-medium">{dep.ultimaOperacion}</span>
            {dep.fechaUltimaOperacion ? ` · ${dep.fechaUltimaOperacion}` : ''}
          </div>
        )}

        {/* Integrated Field & Internal Actions */}
        <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-2">
          {dep.litrosActuales > 0 && (() => {
            const depAnaliticas = getAnaliticasForDep(dep);
            return (
              <button
                type="button"
                onClick={() => {
                  setSelectedAnaliticaIdx(0);
                  setAnaliticaModalDepId(dep.id);
                }}
                className="col-span-2 min-h-[44px] px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <FlaskConical className="w-4 h-4 text-cyan-700" />
                <span>
                  Ver Analítica del Vino
                  {depAnaliticas.length > 0 ? ` (${depAnaliticas[0].fecha})` : ''}
                </span>
              </button>
            );
          })()}
          {dep.litrosActuales > 0 && (
            <button
              type="button"
              onClick={() => openQuickTransfer(dep)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Trasiego rápido</span>
            </button>
          )}
          {onOpenNewOperacionForDep && (
            <button
              type="button"
              onClick={() => onOpenNewOperacionForDep(dep.id)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>+ Práctica</span>
            </button>
          )}
          {onOpenNewEntradaForDep && (
            <button
              type="button"
              onClick={() => onOpenNewEntradaForDep(dep.id)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Grape className="w-3.5 h-3.5" />
              <span>+ Entrada Uva</span>
            </button>
          )}
          {onOpenNewEmbotelladoForDep && dep.litrosActuales > 0 && (
            <button
              type="button"
              onClick={() => onOpenNewEmbotelladoForDep(dep.id)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Wine className="w-3.5 h-3.5 text-amber-300" />
              <span>Embotellar</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Summary Strip */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Plano de Bodega
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 mt-1 tabular-nums">
            <span>{depositos.length} depósitos instalados</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-stone-800">
              {totalLitros.toLocaleString('es-ES')} / {totalCapacidad.toLocaleString('es-ES')} L ({pctGlobal}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>{depositosConVino} con vino</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMoveMode((m) => !m);
              showToast(!moveMode ? 'Modo Mover activo: arrastra cualquier depósito.' : 'Posiciones guardadas.');
            }}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
              moveMode
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200'
            }`}
          >
            <Move className="w-4 h-4" />
            <span>{moveMode ? 'Terminar Mover' : 'Mover plano'}</span>
          </button>

          {moveMode && (
            <button
              type="button"
              onClick={() => {
                resetFloorPlanPositions();
                showToast('Plano restaurado a la distribución original.');
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Depósito</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="bg-stone-900 text-amber-200 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-stone-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Floor Plan Canvas + Legend (8 cols) + Desktop Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Interactive Architectural Floor Plan */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2">
            <div className="text-xs text-stone-600 font-medium truncate">
              {moveMode
                ? 'Arrastra un depósito para cambiar su ubicación'
                : 'Toca un depósito para ver su vino, capacidad y editarlo'}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.25).toFixed(2))))}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                aria-label="Alejar plano"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="min-h-[36px] px-2.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-700 tabular-nums cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.25).toFixed(2))))}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                aria-label="Acercar plano"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable SVG Floor Plan */}
          <div className="overflow-auto bg-[#faf8f5] p-2 sm:p-4 touch-pan-x touch-pan-y">
            <div
              style={{
                width: `${zoom * 100}%`,
                minWidth: zoom === 1 ? '100%' : undefined,
              }}
              className="mx-auto transition-[width] duration-200"
            >
              <svg
                ref={svgRef}
                viewBox="0 0 980 730"
                className={`w-full h-auto select-none rounded-xl border border-stone-200 bg-white shadow-inner ${
                  moveMode ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
                onPointerMove={handlePointerMoveSvg}
                onPointerUp={handlePointerUpSvg}
                onPointerCancel={handlePointerUpSvg}
              >
                <defs>
                  <pattern id="cellarGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path
                      d="M 32 0 L 0 0 0 32"
                      fill="none"
                      stroke="#f1efe9"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>

                {/* Architectural Floor Grid */}
                <rect width="980" height="730" fill="url(#cellarGrid)" />

                {/* Top Exterior / Anexo Zone Box */}
                <rect
                  x="32"
                  y="14"
                  width="500"
                  height="140"
                  rx="14"
                  fill="#fafaf9"
                  stroke="#d6d3d1"
                  strokeDasharray="6 4"
                  strokeWidth="1.5"
                />
                <text
                  x="520"
                  y="34"
                  textAnchor="end"
                  className="fill-stone-500 text-[12px] font-bold uppercase tracking-wider"
                >
                  Anexo / Exterior
                </text>

                {/* MAIN WALLED CELLAR ROOM (Matching PDF geometry) */}
                {/* Room interior slab */}
                <rect x="44" y="176" width="896" height="516" fill="#ffffff" />

                {/* Top Wall Left Segment */}
                <path
                  d="M 36 168 L 154 168 L 154 182 L 50 182 L 50 694 L 36 694 Z"
                  fill="#e7e5e4"
                  stroke="#1c1917"
                  strokeWidth="2"
                />
                {/* Sliding Door / Entrance Portal */}
                <line
                  x1="154"
                  y1="175"
                  x2="374"
                  y2="175"
                  stroke="#78716c"
                  strokeWidth="5"
                  strokeDasharray="10 6"
                />
                <text
                  x="264"
                  y="164"
                  textAnchor="middle"
                  className="fill-stone-500 text-[10px] font-bold uppercase tracking-widest"
                >
                  Portalón Entrada
                </text>

                {/* Top Wall Right + Right Wall */}
                <path
                  d="M 374 168 L 948 168 L 948 702 L 934 702 L 934 182 L 374 182 Z"
                  fill="#e7e5e4"
                  stroke="#1c1917"
                  strokeWidth="2"
                />

                {/* Bottom-Left Recessed Wall + Bottom-Right Wall */}
                <path
                  d="M 36 694 L 160 694 L 160 680 L 420 680 L 420 694 L 465 694 L 465 708 L 146 708 L 146 702 L 36 702 Z"
                  fill="#e7e5e4"
                  stroke="#1c1917"
                  strokeWidth="2"
                />
                <line x1="465" y1="702" x2="948" y2="702" stroke="#1c1917" strokeWidth="3" />

                {/* Structural Square Columns (exact PDF markers) */}
                {[
                  { x: 382, y: 186 },
                  { x: 506, y: 186 },
                  { x: 382, y: 656 },
                  { x: 562, y: 656 },
                ].map((col, idx) => (
                  <g key={idx} transform={`translate(${col.x}, ${col.y})`}>
                    <rect
                      width="14"
                      height="14"
                      fill="#f5f5f4"
                      stroke="#1c1917"
                      strokeWidth="1.8"
                    />
                    <line x1="0" y1="0" x2="14" y2="14" stroke="#1c1917" strokeWidth="1.2" />
                    <line x1="14" y1="0" x2="0" y2="14" stroke="#1c1917" strokeWidth="1.2" />
                  </g>
                ))}

                {/* VESSELS RENDERING */}
                {depositos.map((dep) => {
                  const pos = dep.plano || { x: 685, y: 380, zona: 'nave', forma: 'cilindro' };
                  const forma = pos.forma || MATERIAL_STYLE[dep.tipoRecipiente].defaultForma;
                  const matStyle = MATERIAL_STYLE[dep.tipoRecipiente] || MATERIAL_STYLE['Inox'];
                  const wineColors = getWineFillColors(dep);
                  const fillPct =
                    dep.capacidadLitros > 0
                      ? Math.min(1, Math.max(0, dep.litrosActuales / dep.capacidadLitros))
                      : 0;
                  const r = getVesselRadius(dep.capacidadLitros);
                  const isSelected = dep.id === selectedDep?.id;
                  const clipId = `clip-vessel-${dep.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                  const isSmall = r <= 27;

                  return (
                    <g
                      key={dep.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onPointerDown={(e) => handlePointerDownVessel(e, dep)}
                      onClick={() => {
                        if (!moveMode) handleSelectDep(dep);
                      }}
                      className={moveMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    >
                      {/* Minimum touch halo for small 40L/100L vessels */}
                      <circle cx="0" cy="0" r={Math.max(r + 8, 32)} fill="transparent" />

                      {/* Selection ring */}
                      {isSelected && (
                        forma === 'barrica' ? (
                          <rect
                            x={-59}
                            y={-38}
                            width={118}
                            height={76}
                            rx={34}
                            fill="none"
                            stroke="#881337"
                            strokeWidth="3.5"
                            strokeDasharray="6 3"
                          />
                        ) : (
                          <circle
                            cx="0"
                            cy="0"
                            r={r + 7}
                            fill="none"
                            stroke="#881337"
                            strokeWidth="3.5"
                            strokeDasharray="6 3"
                          />
                        )
                      )}

                      {/* BARREL SHAPE (B1, B2, B3 or any Barrica) */}
                      {forma === 'barrica' ? (
                        <g>
                          <defs>
                            <clipPath id={clipId}>
                              <rect x="-51" y="-31" width="102" height="62" rx="28" />
                            </clipPath>
                          </defs>

                          {/* Base empty barrel interior */}
                          <rect
                            x="-51"
                            y="-31"
                            width="102"
                            height="62"
                            rx="28"
                            fill="#faf7f2"
                          />

                          {/* Live Wine Fill Level from bottom */}
                          {fillPct > 0 && (
                            <rect
                              x="-51"
                              y={31 - 62 * fillPct}
                              width="102"
                              height={62 * fillPct + 2}
                              fill={wineColors.main}
                              opacity={0.92}
                              clipPath={`url(#${clipId})`}
                            />
                          )}

                          {/* Barrel Hoop Lines */}
                          <line
                            x1="-25"
                            y1="-30"
                            x2="-25"
                            y2="30"
                            stroke={matStyle.stroke}
                            strokeWidth="2.2"
                            opacity="0.45"
                          />
                          <line
                            x1="25"
                            y1="-30"
                            x2="25"
                            y2="30"
                            stroke={matStyle.stroke}
                            strokeWidth="2.2"
                            opacity="0.45"
                          />

                          {/* Barrel Outer Rim */}
                          <rect
                            x="-51"
                            y="-31"
                            width="102"
                            height="62"
                            rx="28"
                            fill="none"
                            stroke={matStyle.stroke}
                            strokeWidth={isSelected ? 4 : 3.2}
                          />

                          {/* High-contrast Text Label */}
                          <rect
                            x="-39"
                            y="-20"
                            width="78"
                            height="40"
                            rx="10"
                            fill="rgba(255,255,255,0.92)"
                            stroke="rgba(28,25,23,0.12)"
                            strokeWidth="0.8"
                          />
                          <text
                            x="0"
                            y="-3"
                            textAnchor="middle"
                            className="fill-stone-950 text-[15px] font-extrabold"
                          >
                            {dep.codigo}
                          </text>
                          <text
                            x="0"
                            y="13"
                            textAnchor="middle"
                            className="fill-rose-950 text-[11px] font-bold tabular-nums"
                          >
                            {dep.litrosActuales > 0 ? `${dep.litrosActuales}L` : '0L'} / {dep.capacidadLitros}L
                          </text>
                        </g>
                      ) : (
                        /* CIRCULAR / AMPHORA VESSEL */
                        <g>
                          <defs>
                            <clipPath id={clipId}>
                              <circle cx="0" cy="0" r={r} />
                            </clipPath>
                          </defs>

                          {/* Base empty circle */}
                          <circle cx="0" cy="0" r={r} fill="#fafaf9" />

                          {/* Live Liquid Fill from bottom */}
                          {fillPct > 0 && (
                            <rect
                              x={-r}
                              y={r - 2 * r * fillPct}
                              width={2 * r}
                              height={2 * r * fillPct + 2}
                              fill={wineColors.main}
                              opacity={0.92}
                              clipPath={`url(#${clipId})`}
                            />
                          )}

                          {/* Specific Material Inner Ring */}
                          {dep.tipoRecipiente === 'Siempre lleno abierto' && (
                            <circle
                              cx="0"
                              cy="0"
                              r={Math.max(8, r - 5)}
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                            />
                          )}
                          {(dep.tipoRecipiente === 'Ánfora' || forma === 'anfora') && (
                            <circle
                              cx="0"
                              cy="0"
                              r={Math.max(8, r - 5)}
                              fill="none"
                              stroke="#c2410c"
                              strokeWidth="2.2"
                            />
                          )}
                          {dep.tipoRecipiente === 'Inox cerrado' && (
                            <circle
                              cx="0"
                              cy="0"
                              r={Math.max(8, r - 4)}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="1.4"
                            />
                          )}

                          {/* Outer Structural Rim */}
                          <circle
                            cx="0"
                            cy="0"
                            r={r}
                            fill="none"
                            stroke={matStyle.stroke}
                            strokeWidth={dep.codigo === '14' ? 4.2 : isSelected ? 3.8 : 2.8}
                          />

                          {/* High-contrast readability pill inside vessel */}
                          {isSmall ? (
                            <>
                              <circle
                                cx="0"
                                cy="0"
                                r={17}
                                fill="rgba(255,255,255,0.94)"
                                stroke="rgba(28,25,23,0.12)"
                                strokeWidth="0.8"
                              />
                              <text
                                x="0"
                                y="1"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-stone-950 text-[13px] font-extrabold"
                              >
                                {dep.codigo}
                              </text>
                              {/* External legible capacity/volume tag below compact tanks */}
                              <rect
                                x="-31"
                                y={r + 3}
                                width="62"
                                height="17"
                                rx="5"
                                fill="rgba(255,255,255,0.96)"
                                stroke="#d6d3d1"
                                strokeWidth="1"
                              />
                              <text
                                x="0"
                                y={r + 14.5}
                                textAnchor="middle"
                                className="fill-stone-900 text-[10.5px] font-bold tabular-nums"
                              >
                                {dep.litrosActuales > 0 ? `${dep.litrosActuales}` : '0'}/{dep.capacidadLitros}L
                              </text>
                            </>
                          ) : (
                            <>
                              <rect
                                x={-Math.min(r - 3, 41)}
                                y="-20"
                                width={Math.min(2 * r - 6, 82)}
                                height="40"
                                rx="10"
                                fill="rgba(255,255,255,0.92)"
                                stroke="rgba(28,25,23,0.12)"
                                strokeWidth="0.8"
                              />
                              <text
                                x="0"
                                y="-3"
                                textAnchor="middle"
                                className={`fill-stone-950 font-extrabold ${
                                  r >= 45 ? 'text-[17px]' : 'text-[15px]'
                                }`}
                              >
                                {dep.codigo}
                              </text>
                              <text
                                x="0"
                                y="14"
                                textAnchor="middle"
                                className={`fill-rose-950 font-bold tabular-nums ${
                                  r >= 45 ? 'text-[11.5px]' : r <= 31 ? 'text-[9.5px]' : 'text-[10.5px]'
                                }`}
                              >
                                {dep.litrosActuales > 0 ? `${dep.litrosActuales}` : '0'}/{dep.capacidadLitros}L
                              </text>
                            </>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Separate Large, Crisp Legend Box Below Floor Plan */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-2.5">
            <h3 className="font-serif-wine font-bold text-stone-900 text-base sm:text-lg">
              Leyenda del Plano
            </h3>
            <span className="text-xs text-stone-500">
              Tipo de depósito por contorno y color de llenado según vino
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vessel Materials Legend */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                Materiales / Tipos de Depósito
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    label: 'Inox cerrado',
                    stroke: '#334155',
                    kind: 'inox_cerrado' as const,
                  },
                  {
                    label: 'Siempre lleno abierto',
                    stroke: '#0369a1',
                    kind: 'siempre_lleno' as const,
                  },
                  {
                    label: 'Inox',
                    stroke: '#64748b',
                    kind: 'inox' as const,
                  },
                  {
                    label: 'Barrica roble francés',
                    stroke: '#78350f',
                    kind: 'barrica' as const,
                  },
                  {
                    label: 'Barrica castaño',
                    stroke: '#b45309',
                    kind: 'barrica' as const,
                  },
                  {
                    label: 'Ánfora',
                    stroke: '#9a3412',
                    kind: 'anfora' as const,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80"
                  >
                    <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0">
                      {item.kind === 'barrica' ? (
                        <>
                          <rect
                            x="2"
                            y="7"
                            width="32"
                            height="22"
                            rx="10"
                            fill="#faf7f2"
                            stroke={item.stroke}
                            strokeWidth="2.8"
                          />
                          <line x1="11" y1="8" x2="11" y2="28" stroke={item.stroke} strokeWidth="1.6" opacity="0.5" />
                          <line x1="25" y1="8" x2="25" y2="28" stroke={item.stroke} strokeWidth="1.6" opacity="0.5" />
                        </>
                      ) : (
                        <>
                          <circle
                            cx="18"
                            cy="18"
                            r="13"
                            fill="#ffffff"
                            stroke={item.stroke}
                            strokeWidth="2.8"
                          />
                          {item.kind === 'inox_cerrado' && (
                            <circle cx="18" cy="18" r="9" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
                          )}
                          {item.kind === 'siempre_lleno' && (
                            <circle
                              cx="18"
                              cy="18"
                              r="9"
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth="1.8"
                              strokeDasharray="3 2.5"
                            />
                          )}
                          {item.kind === 'anfora' && (
                            <circle cx="18" cy="18" r="9" fill="none" stroke="#c2410c" strokeWidth="2" />
                          )}
                        </>
                      )}
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold text-stone-800 leading-tight">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wine Fill Colors Legend */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                Contenido y Nivel de Llenado
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Vino blanco', color: '#86efac', border: '#22c55e', desc: 'Verde claro' },
                  { label: 'Vino tinto', color: '#881337', border: '#4c0519', desc: 'Granate' },
                  { label: 'Vino rosado', color: '#e11d48', border: '#9f1239', desc: 'Rosa intenso' },
                  { label: 'Depósito vacío', color: '#f5f5f4', border: '#a8a29e', desc: 'Sin vino (0 L)' },
                ].map((w) => (
                  <div
                    key={w.label}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80"
                  >
                    <span
                      className="w-7 h-7 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: w.color, border: `2px solid ${w.border}` }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                        {w.label}
                      </div>
                      <div className="text-[11px] text-stone-500">{w.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Desktop Sticky Vessel Inspector (hidden on <lg, replaced by bottom sheet when tapped) */}
        <div className="hidden lg:block lg:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sticky top-20">
          {selectedDep ? (
            renderInspectorBody(selectedDep)
          ) : (
            <div className="text-center py-10 text-sm text-stone-500">
              Selecciona un depósito en el plano para ver su ficha.
            </div>
          )}
        </div>
      </div>

      {/* Material Capacity Summary + Interactive Vessel Grid */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-5">
        <div>
          <h3 className="font-serif-wine font-bold text-stone-900 text-base sm:text-lg">
            Resumen por Tipo de Depósito
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
            {resumenPorMaterial.map((item) => {
              const st = MATERIAL_STYLE[item.tipo];
              return (
                <div
                  key={item.tipo}
                  className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 text-left"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.swatchBg}`} />
                    <span className="text-xs font-bold text-stone-900 truncate">{item.tipo}</span>
                  </div>
                  <div className="text-sm font-bold text-stone-900 tabular-nums">
                    {item.litros.toLocaleString('es-ES')} L
                  </div>
                  <div className="text-[11px] text-stone-500 tabular-nums">
                    {item.count} uds · {item.cap.toLocaleString('es-ES')} L cap.
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Vessel List (clickable to select on floor plan) */}
        <div className="pt-4 border-t border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif-wine font-bold text-stone-900 text-base">
              Todos los Depósitos en Bodega ({sortedDepositos.length})
            </h3>
            <span className="text-xs text-stone-500">Toca cualquiera para inspeccionar</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {sortedDepositos.map((dep) => {
              const pct =
                dep.capacidadLitros > 0
                  ? Math.round((dep.litrosActuales / dep.capacidadLitros) * 100)
                  : 0;
              const isSelected = dep.id === selectedDep?.id;
              const st = MATERIAL_STYLE[dep.tipoRecipiente] || MATERIAL_STYLE['Inox'];

              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => handleSelectDep(dep)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-rose-800 bg-rose-50/60 ring-2 ring-rose-800/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-extrabold text-stone-900">Nº {dep.codigo}</span>
                    <span className="text-[11px] font-bold text-stone-500 tabular-nums">
                      {dep.capacidadLitros}L
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">
                    {st.shortLabel}
                  </div>
                  <div className="mt-2 text-xs font-bold text-rose-900 tabular-nums">
                    {dep.litrosActuales > 0 ? `${dep.litrosActuales} L (${pct}%)` : 'Vacío'}
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dep.litrosActuales === 0 ? 'bg-stone-300' : 'bg-rose-800'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet Inspector (shown on <lg when user taps a vessel) */}
      {mobileSheetOpen && selectedDep && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs"
          onClick={() => setMobileSheetOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-h-[88vh] overflow-y-auto p-5 pb-8 shadow-2xl border-t border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />
            <div className="flex justify-end -mt-2 mb-1">
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
                aria-label="Cerrar detalle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderInspectorBody(selectedDep)}
          </div>
        </div>
      )}

      {/* Internal Wine Analysis Modal for Selected Deposit */}
      {analiticaModalDepId && (() => {
        const modalDep = depositos.find((d) => d.id === analiticaModalDepId);
        if (!modalDep) return null;
        const depAnaliticas = getAnaliticasForDep(modalDep);
        const activeAnalitica = depAnaliticas[selectedAnaliticaIdx] || depAnaliticas[0];

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FlaskConical className="w-5 h-5 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base font-serif-wine truncate">
                      Analítica Interna · Dep. Nº {modalDep.codigo}
                    </h3>
                    <p className="text-xs text-stone-300 truncate">
                      {modalDep.vinoNombre || 'Vino en depósito'} · {modalDep.litrosActuales} L (
                      {modalDep.tipoRecipiente})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnaliticaModalDepId(null)}
                  className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer shrink-0"
                  aria-label="Cerrar analítica"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto text-sm text-stone-800">
                {!activeAnalitica ? (
                  <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-center space-y-3">
                    <FlaskConical className="w-8 h-8 text-stone-400 mx-auto" />
                    <div>
                      <p className="font-semibold text-stone-900">
                        Sin analítica vinculada a este depósito todavía
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Sube el Excel del laboratorio en el módulo de Analíticas y asígnalo al Depósito Nº{' '}
                        {modalDep.codigo}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-200">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-cyan-800">
                          Uso interno de bodega · Muestra
                        </div>
                        <div className="font-serif-wine font-bold text-base text-stone-900">
                          {activeAnalitica.muestra}
                          {activeAnalitica.vinoNombre ? ` · ${activeAnalitica.vinoNombre}` : ''}
                        </div>
                        <div className="text-xs text-stone-600 mt-0.5 flex flex-wrap gap-x-3">
                          <span>Fecha: {activeAnalitica.fecha}</span>
                          {activeAnalitica.archivoOrigen && (
                            <span>Excel: {activeAnalitica.archivoOrigen}</span>
                          )}
                        </div>
                      </div>

                      {depAnaliticas.length > 1 && (
                        <select
                          value={selectedAnaliticaIdx}
                          onChange={(e) => setSelectedAnaliticaIdx(Number(e.target.value))}
                          className="px-3 py-2 text-xs font-semibold border border-cyan-300 rounded-xl bg-white text-stone-800"
                        >
                          {depAnaliticas.map((a, idx) => (
                            <option key={a.id} value={idx}>
                              {a.fecha} · {a.muestra}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
                      {activeAnalitica.parametros.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#faf8f5] border border-stone-200 text-center"
                        >
                          <div
                            className="text-[11px] font-bold text-stone-500 truncate"
                            title={p.nombre}
                          >
                            {p.nombre}
                          </div>
                          <div className="text-base font-extrabold text-stone-900 tabular-nums mt-0.5">
                            {p.valor || '-'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {activeAnalitica.observaciones && (
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                        <strong className="text-stone-800">Observaciones:</strong>{' '}
                        {activeAnalitica.observaciones}
                      </div>
                    )}
                  </>
                )}

                <div className="pt-3 border-t border-stone-200 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAnaliticaModalDepId(null)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium cursor-pointer"
                  >
                    Cerrar
                  </button>
                  {onOpenAnaliticasForDep && (
                    <button
                      type="button"
                      onClick={() => {
                        const depId = modalDep.id;
                        setAnaliticaModalDepId(null);
                        onOpenAnaliticasForDep(depId);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4 text-amber-300" />
                      <span>Gestionar / Subir Excel en Analíticas</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add New Vessel Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base font-serif-wine">
                  Añadir Depósito al Plano
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVessel} className="p-5 space-y-4 text-sm text-stone-800 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº / Código *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 11, 6F, B4"
                    value={newDepForm.codigo}
                    onChange={(e) => setNewDepForm({ ...newDepForm, codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Capacidad (L) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newDepForm.capacidadLitros}
                    onChange={(e) =>
                      setNewDepForm({ ...newDepForm, capacidadLitros: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Material / Tipo *</label>
                <select
                  value={newDepForm.tipoRecipiente}
                  onChange={(e) =>
                    setNewDepForm({
                      ...newDepForm,
                      tipoRecipiente: e.target.value as TipoRecipiente,
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
                >
                  {TIPOS_RECIPIENTE_BODEGA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros iniciales</label>
                  <input
                    type="number"
                    min={0}
                    max={newDepForm.capacidadLitros}
                    value={newDepForm.litrosActuales}
                    onChange={(e) =>
                      setNewDepForm({ ...newDepForm, litrosActuales: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Zona en plano</label>
                  <select
                    value={newDepForm.zona}
                    onChange={(e) =>
                      setNewDepForm({ ...newDepForm, zona: e.target.value as 'nave' | 'anexo' })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="anexo">Anexo / Exterior</option>
                    <option value="nave">Nave Principal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Vino / Nombre</label>
                <input
                  type="text"
                  placeholder="Opcional: Ej. Xouba 2024"
                  value={newDepForm.vinoNombre}
                  onChange={(e) => setNewDepForm({ ...newDepForm, vinoNombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Añadir al Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

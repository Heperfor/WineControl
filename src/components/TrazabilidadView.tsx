import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  Download,
  Droplet,
  GitBranch,
  Grape,
  MapPin,
  Package,
  Send,
  Wine,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  Deposito,
  EmbotelladoRegistro,
  EntradaUva,
  MARCAS_COMERCIALES,
  Parcela,
  SalidaRegistro,
} from '../types/winery';
import { exportLotAuditDossierPDF } from '../utils/exportUtils';

interface TrazabilidadViewProps {
  initialLote?: string;
  initialParcelaId?: string;
}

type ReferenceType = 'marca' | 'lote' | 'parcela' | 'deposito';

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  stroke: string;
}

interface SvgConnectorPath {
  id: string;
  d: string;
  label?: string;
  labelX: number;
  labelY: number;
  stroke: string;
}

type SelectedNodeDetail =
  | { kind: 'parcela'; data: Parcela }
  | { kind: 'entrada'; data: EntradaUva }
  | { kind: 'deposito'; data: Deposito }
  | { kind: 'embotellado'; data: EmbotelladoRegistro }
  | { kind: 'salida'; data: SalidaRegistro };

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const TrazabilidadView: React.FC<TrazabilidadViewProps> = ({
  initialLote,
  initialParcelaId,
}) => {
  const {
    bodegaConfig,
    parcelas,
    depositos,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
  } = useWinery();

  // Reference selection state
  const [refType, setRefType] = useState<ReferenceType>(() => {
    if (initialParcelaId) return 'parcela';
    if (initialLote) return 'lote';
    return 'marca';
  });

  // Collect all active product/brand references (predefined default commercial brands + embotellados + tank vinoNombres)
  const availableMarcas = useMemo(() => {
    const seen = new Map<string, string>();

    MARCAS_COMERCIALES.forEach((b) => {
      seen.set(normalizeText(b), b);
    });

    embotellados.forEach((emb) => {
      seen.set(normalizeText(emb.marca), emb.marca);
    });

    depositos.forEach((d) => {
      if (!d.vinoNombre) return;
      const vn = normalizeText(d.vinoNombre);
      const matched = MARCAS_COMERCIALES.find((b) => {
        const nb = normalizeText(b);
        const core = nb.replace(/^os?\s+/, '');
        return vn.includes(nb) || (core.length > 3 && vn.includes(core));
      });
      if (matched) {
        if (!seen.has(normalizeText(matched))) seen.set(normalizeText(matched), matched);
      } else if (d.litrosActuales > 0) {
        seen.set(vn, d.vinoNombre);
      }
    });

    return Array.from(seen.values()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [embotellados, depositos]);

  const [selectedMarca, setSelectedMarca] = useState<string>(
    () => availableMarcas[0] || MARCAS_COMERCIALES[0]
  );
  const [selectedLote, setSelectedLote] = useState<string>(
    () => initialLote || embotellados[0]?.lote || ''
  );
  const [selectedParcelaId, setSelectedParcelaId] = useState<string>(
    () => initialParcelaId || parcelas[0]?.id || ''
  );
  const [selectedDepositoId, setSelectedDepositoId] = useState<string>(
    () => depositos.find((d) => d.litrosActuales > 0)?.id || depositos[0]?.id || ''
  );

  const [selectedNode, setSelectedNode] = useState<SelectedNodeDetail | null>(null);

  // Sync deep-link props from other modules
  useEffect(() => {
    if (initialLote) {
      setRefType('lote');
      setSelectedLote(initialLote);
      setSelectedNode(null);
    }
  }, [initialLote]);

  useEffect(() => {
    if (initialParcelaId) {
      setRefType('parcela');
      setSelectedParcelaId(initialParcelaId);
      setSelectedNode(null);
    }
  }, [initialParcelaId]);

  // Keep valid defaults if data changes
  useEffect(() => {
    if (refType === 'marca' && !availableMarcas.includes(selectedMarca) && availableMarcas[0]) {
      setSelectedMarca(availableMarcas[0]);
    }
  }, [availableMarcas, refType, selectedMarca]);

  // Graph builder: connects Parcelas -> Entradas -> Depósitos (incl. transfers) -> Embotellados -> Salidas/Stock
  const traceGraph = useMemo(() => {
    const depIds = new Set<string>();
    let matchedEmbs: EmbotelladoRegistro[] = [];

    const traverseUpstream = (seeds: string[]) => {
      const queue = [...seeds];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        elaboraciones.forEach((el) => {
          if (
            el.destinoTipo === 'deposito' &&
            el.depositoDestinoId === cur &&
            el.depositoOrigenId &&
            !depIds.has(el.depositoOrigenId)
          ) {
            depIds.add(el.depositoOrigenId);
            queue.push(el.depositoOrigenId);
          }
        });
      }
    };

    const traverseDownstream = (seeds: string[]) => {
      const queue = [...seeds];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        elaboraciones.forEach((el) => {
          if (
            el.destinoTipo === 'deposito' &&
            el.depositoOrigenId === cur &&
            el.depositoDestinoId &&
            !depIds.has(el.depositoDestinoId)
          ) {
            depIds.add(el.depositoDestinoId);
            queue.push(el.depositoDestinoId);
          }
        });
      }
    };

    if (refType === 'marca') {
      const normRef = normalizeText(selectedMarca);
      matchedEmbs = embotellados.filter((e) => normalizeText(e.marca) === normRef);
      const matchingDeps = depositos.filter((d) =>
        normalizeText(d.vinoNombre || '').includes(normRef)
      );
      const seeds = [
        ...matchedEmbs.map((e) => e.depositoProcedenciaId),
        ...matchingDeps.map((d) => d.id),
      ];
      seeds.forEach((id) => depIds.add(id));
      traverseUpstream(seeds);
      traverseDownstream(seeds);
    } else if (refType === 'lote') {
      const emb = embotellados.find(
        (e) => e.lote.toUpperCase() === selectedLote.toUpperCase()
      );
      if (emb) {
        matchedEmbs = [emb];
        depIds.add(emb.depositoProcedenciaId);
        traverseUpstream([emb.depositoProcedenciaId]);
      }
    } else if (refType === 'parcela') {
      const parcEntradas = entradasUva.filter((e) => e.parcelaId === selectedParcelaId);
      const seeds = parcEntradas.map((e) => e.depositoDestinoId);
      seeds.forEach((id) => depIds.add(id));
      traverseDownstream(seeds);
      matchedEmbs = embotellados.filter((e) => depIds.has(e.depositoProcedenciaId));
    } else if (refType === 'deposito') {
      if (selectedDepositoId) {
        depIds.add(selectedDepositoId);
        traverseUpstream([selectedDepositoId]);
        traverseDownstream([selectedDepositoId]);
        matchedEmbs = embotellados.filter((e) => depIds.has(e.depositoProcedenciaId));
      }
    }

    // Collect connected entities
    const relatedEntradas =
      refType === 'parcela'
        ? entradasUva.filter((e) => e.parcelaId === selectedParcelaId)
        : entradasUva.filter((e) => depIds.has(e.depositoDestinoId));

    const parcelaIdSet = new Set(relatedEntradas.map((e) => e.parcelaId));
    if (refType === 'parcela' && selectedParcelaId) {
      parcelaIdSet.add(selectedParcelaId);
    }
    const relatedParcelas = parcelas.filter((p) => parcelaIdSet.has(p.id));

    // Order deposits topologically (origin deposits before transfer destination deposits)
    const relatedDepsRaw = depositos.filter((d) => depIds.has(d.id));
    const relatedDepositos = [...relatedDepsRaw].sort((a, b) => {
      const aToB = elaboraciones.some(
        (el) =>
          el.destinoTipo === 'deposito' &&
          el.depositoOrigenId === a.id &&
          el.depositoDestinoId === b.id
      );
      const bToA = elaboraciones.some(
        (el) =>
          el.destinoTipo === 'deposito' &&
          el.depositoOrigenId === b.id &&
          el.depositoDestinoId === a.id
      );
      if (aToB && !bToA) return -1;
      if (bToA && !aToB) return 1;
      return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
    });

    const relatedElaboraciones = elaboraciones
      .filter(
        (el) =>
          depIds.has(el.depositoOrigenId) ||
          (el.depositoDestinoId ? depIds.has(el.depositoDestinoId) : false)
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const transferEdges = relatedElaboraciones.filter(
      (el) =>
        el.destinoTipo === 'deposito' &&
        el.depositoDestinoId &&
        el.depositoDestinoId !== el.depositoOrigenId &&
        depIds.has(el.depositoOrigenId) &&
        depIds.has(el.depositoDestinoId)
    );

    const embIds = new Set(matchedEmbs.map((e) => e.id));
    const embLotes = new Set(matchedEmbs.map((e) => e.lote.toUpperCase()));
    const relatedSalidas = salidas.filter(
      (s) =>
        (s.embotelladoId && embIds.has(s.embotelladoId)) ||
        embLotes.has(s.lote.toUpperCase())
    );

    // Build explicit directed edges for the visual SVG flow diagram
    const edges: FlowEdge[] = [];

    relatedEntradas.forEach((ent) => {
      if (parcelaIdSet.has(ent.parcelaId)) {
        edges.push({
          id: `edge-p-${ent.parcelaId}-e-${ent.id}`,
          from: `node-parc-${ent.parcelaId}`,
          to: `node-ent-${ent.id}`,
          label: `${ent.kgTotales.toLocaleString('es-ES')} kg`,
          stroke: '#9f1239',
        });
      }
      if (depIds.has(ent.depositoDestinoId)) {
        edges.push({
          id: `edge-e-${ent.id}-d-${ent.depositoDestinoId}`,
          from: `node-ent-${ent.id}`,
          to: `node-dep-${ent.depositoDestinoId}`,
          label: `${ent.litrosMosto} L`,
          stroke: '#4338ca',
        });
      }
    });

    transferEdges.forEach((tr) => {
      edges.push({
        id: `edge-tr-${tr.id}`,
        from: `node-dep-${tr.depositoOrigenId}`,
        to: `node-dep-${tr.depositoDestinoId}`,
        label: `Trasiego ${tr.cantidadLitros} L`,
        stroke: '#4338ca',
      });
    });

    matchedEmbs.forEach((emb) => {
      if (depIds.has(emb.depositoProcedenciaId)) {
        edges.push({
          id: `edge-d-${emb.depositoProcedenciaId}-emb-${emb.id}`,
          from: `node-dep-${emb.depositoProcedenciaId}`,
          to: `node-emb-${emb.id}`,
          label: `${emb.cantidadLitros} L`,
          stroke: '#b45309',
        });
      }

      const salsForEmb = relatedSalidas.filter(
        (s) => s.embotelladoId === emb.id || s.lote.toUpperCase() === emb.lote.toUpperCase()
      );
      salsForEmb.forEach((sal) => {
        edges.push({
          id: `edge-emb-${emb.id}-sal-${sal.id}`,
          from: `node-emb-${emb.id}`,
          to: `node-sal-${sal.id}`,
          label: `${sal.cantidadBotellas} bot.`,
          stroke: '#047857',
        });
      });

      if (emb.botellasDisponibles > 0) {
        edges.push({
          id: `edge-emb-${emb.id}-stock-${emb.id}`,
          from: `node-emb-${emb.id}`,
          to: `node-stock-${emb.id}`,
          label: `${emb.botellasDisponibles} bot.`,
          stroke: '#57534e',
        });
      }
    });

    // If not bottled yet, link deposit -> bulk stock card in Col 5
    const depsWithBulk = relatedDepositos.filter((d) => d.litrosActuales > 0);
    if (matchedEmbs.length === 0) {
      depsWithBulk.forEach((d) => {
        edges.push({
          id: `edge-dep-${d.id}-bulk-${d.id}`,
          from: `node-dep-${d.id}`,
          to: `node-bulk-${d.id}`,
          label: `${d.litrosActuales} L`,
          stroke: '#0369a1',
        });
      });
    }

    // Aggregate metrics for pipeline summary
    const totalKg = relatedEntradas.reduce((s, e) => s + e.kgTotales, 0);
    const totalMosto = relatedEntradas.reduce((s, e) => s + (e.litrosMosto || 0), 0);
    const totalGranel = relatedDepositos.reduce((s, d) => s + (d.litrosActuales || 0), 0);
    const totalBotellas = matchedEmbs.reduce((s, e) => s + e.cantidadBotellas075, 0);
    const totalStockBotellas = matchedEmbs.reduce((s, e) => s + e.botellasDisponibles, 0);
    const totalExpedido = relatedSalidas.reduce((s, s2) => s + s2.cantidadBotellas, 0);

    return {
      parcelas: relatedParcelas,
      entradas: relatedEntradas,
      depositos: relatedDepositos,
      elaboraciones: relatedElaboraciones,
      transfers: transferEdges,
      embotellados: matchedEmbs,
      salidas: relatedSalidas,
      depsWithBulk,
      edges,
      metrics: {
        totalKg,
        totalMosto,
        totalGranel,
        totalBotellas,
        totalStockBotellas,
        totalExpedido,
      },
    };
  }, [
    refType,
    selectedMarca,
    selectedLote,
    selectedParcelaId,
    selectedDepositoId,
    parcelas,
    depositos,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
  ]);

  // SVG curved connector measurement (for desktop horizontal flow diagram)
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | HTMLDivElement | null>>({});
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const [connectorPaths, setConnectorPaths] = useState<SvgConnectorPath[]>([]);

  const setNodeRef = useCallback(
    (key: string) => (el: HTMLButtonElement | HTMLDivElement | null) => {
      nodeRefs.current[key] = el;
    },
    []
  );

  const computeConnectors = useCallback(() => {
    const container = flowContainerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;

    const nextPaths: SvgConnectorPath[] = [];

    traceGraph.edges.forEach((edge) => {
      const fromEl = nodeRefs.current[edge.from];
      const toEl = nodeRefs.current[edge.to];
      if (!fromEl || !toEl) return;

      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      if (fRect.width === 0 || tRect.width === 0) return;

      const sameColumn = Math.abs(fRect.left - tRect.left) < 40;

      if (sameColumn) {
        // Vertical transfer arrow within Stage 3 (e.g. B1 -> B2)
        const x1 = fRect.left - cRect.left + fRect.width / 2;
        const y1 = fRect.bottom - cRect.top;
        const x2 = tRect.left - cRect.left + tRect.width / 2;
        const y2 = tRect.top - cRect.top;
        const midY = (y1 + y2) / 2;
        nextPaths.push({
          id: edge.id,
          d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
          label: edge.label,
          labelX: (x1 + x2) / 2,
          labelY: midY,
          stroke: edge.stroke,
        });
      } else {
        // Horizontal flow Bezier arrow across columns
        const x1 = fRect.right - cRect.left;
        const y1 = fRect.top - cRect.top + fRect.height / 2;
        const x2 = tRect.left - cRect.left;
        const y2 = tRect.top - cRect.top + tRect.height / 2;
        const dx = Math.max(24, (x2 - x1) * 0.5);
        nextPaths.push({
          id: edge.id,
          d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          label: edge.label,
          labelX: (x1 + x2) / 2,
          labelY: (y1 + y2) / 2,
          stroke: edge.stroke,
        });
      }
    });

    setSvgSize({ width: cRect.width, height: cRect.height });
    setConnectorPaths(nextPaths);
  }, [traceGraph]);

  useLayoutEffect(() => {
    computeConnectors();
    const container = flowContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      computeConnectors();
    });
    ro.observe(container);
    window.addEventListener('resize', computeConnectors);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeConnectors);
    };
  }, [computeConnectors]);

  const activePdfLote =
    refType === 'lote'
      ? selectedLote
      : traceGraph.embotellados[0]?.lote || '';

  const handleExportPDF = () => {
    if (!activePdfLote) return;
    exportLotAuditDossierPDF(activePdfLote, {
      config: bodegaConfig,
      parcelas,
      depositos,
      entradas: entradasUva,
      elaboraciones,
      embotellados,
      salidas,
    });
  };

  const activeReferenceTitle = useMemo(() => {
    if (refType === 'marca') return `Referencia: ${selectedMarca}`;
    if (refType === 'lote') {
      const emb = embotellados.find((e) => e.lote.toUpperCase() === selectedLote.toUpperCase());
      return emb ? `${emb.marca} · Lote ${emb.lote}` : `Lote ${selectedLote}`;
    }
    if (refType === 'parcela') {
      const p = parcelas.find((x) => x.id === selectedParcelaId);
      return p ? `Parcela: ${p.nombre}` : 'Parcela';
    }
    const d = depositos.find((x) => x.id === selectedDepositoId);
    return d ? `Depósito Nº ${d.codigo}${d.vinoNombre ? ` · ${d.vinoNombre}` : ''}` : 'Depósito';
  }, [
    refType,
    selectedMarca,
    selectedLote,
    selectedParcelaId,
    selectedDepositoId,
    embotellados,
    parcelas,
    depositos,
  ]);

  const isNodeSelected = (kind: SelectedNodeDetail['kind'], id: string) =>
    selectedNode?.kind === kind && selectedNode.data.id === id;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner & PDF Export */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Trazabilidad 360º
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Diagrama de flujo y recorrido completo por referencia desde el viñedo hasta el cliente.
          </p>
        </div>

        {activePdfLote && (
          <button
            type="button"
            onClick={handleExportPDF}
            className="w-full md:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Ficha Auditoría PDF ({activePdfLote})</span>
          </button>
        )}
      </div>

      {/* Single Unified Dropdown Selector */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-900 shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-stone-500 uppercase block">
              Seleccionar Referencia / Parcela
            </span>
            <div className="text-sm font-bold text-stone-900 truncate">
              {activeReferenceTitle}
            </div>
          </div>
        </div>

        <div className="w-full sm:w-96 shrink-0">
          <select
            value={
              refType === 'marca'
                ? `marca:${selectedMarca}`
                : refType === 'lote'
                ? `lote:${selectedLote}`
                : refType === 'parcela'
                ? `parcela:${selectedParcelaId}`
                : `deposito:${selectedDepositoId}`
            }
            onChange={(e) => {
              const raw = e.target.value;
              const sepIdx = raw.indexOf(':');
              if (sepIdx === -1) return;
              const nextType = raw.slice(0, sepIdx) as ReferenceType;
              const nextVal = raw.slice(sepIdx + 1);
              setRefType(nextType);
              if (nextType === 'marca') setSelectedMarca(nextVal);
              else if (nextType === 'lote') setSelectedLote(nextVal);
              else if (nextType === 'parcela') setSelectedParcelaId(nextVal);
              else if (nextType === 'deposito') setSelectedDepositoId(nextVal);
              setSelectedNode(null);
            }}
            className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl bg-white font-semibold text-stone-900 cursor-pointer"
          >
            <optgroup label="Vinos / Referencias">
              {availableMarcas.map((m) => (
                <option key={`marca:${m}`} value={`marca:${m}`}>
                  Vino: {m}
                </option>
              ))}
            </optgroup>

            <optgroup label="Parcelas de Viñedo">
              {[...parcelas]
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
                .map((p) => (
                  <option key={`parcela:${p.id}`} value={`parcela:${p.id}`}>
                    Parcela: {p.nombre} ({p.paraje})
                  </option>
                ))}
            </optgroup>

            {embotellados.length > 0 && (
              <optgroup label="Lotes de Embotellado">
                {[...embotellados]
                  .sort((a, b) => a.lote.localeCompare(b.lote, 'es', { numeric: true }))
                  .map((emb) => (
                    <option key={`lote:${emb.lote}`} value={`lote:${emb.lote}`}>
                      Lote {emb.lote} · {emb.marca} ({emb.cantidadBotellas075} bot.)
                    </option>
                  ))}
              </optgroup>
            )}

            <optgroup label="Depósitos en Bodega">
              {[...depositos]
                .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                .map((d) => (
                  <option key={`deposito:${d.id}`} value={`deposito:${d.id}`}>
                    Dep. Nº {d.codigo} · {d.tipoRecipiente}
                    {d.vinoNombre ? ` (${d.vinoNombre})` : d.litrosActuales === 0 ? ' (Vacío)' : ''}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* ================================================================= */}
      {/* INTERACTIVE FLOWCHART DIAGRAM BY REFERENCE                        */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Diagram Header + Live Pipeline Numbers */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-rose-950 to-stone-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-amber-200/80 font-semibold block">
                Diagrama de Flujo del Producto
              </span>
              <h3 className="text-base sm:text-lg font-bold font-serif-wine text-white">
                {activeReferenceTitle}
              </h3>
            </div>
          </div>

          {/* Pipeline Quantitative Summary Strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-stone-300">Uva: </span>
              <strong className="text-white">
                {traceGraph.metrics.totalKg.toLocaleString('es-ES')} kg
              </strong>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300 hidden sm:block" />
            <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-stone-300">Mosto: </span>
              <strong className="text-white">
                {traceGraph.metrics.totalMosto.toLocaleString('es-ES')} L
              </strong>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300 hidden sm:block" />
            <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-stone-300">Granel: </span>
              <strong className="text-amber-200">
                {traceGraph.metrics.totalGranel.toLocaleString('es-ES')} L
              </strong>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300 hidden sm:block" />
            <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-stone-300">Embotellado: </span>
              <strong className="text-amber-300">
                {traceGraph.metrics.totalBotellas.toLocaleString('es-ES')} bot.
              </strong>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300 hidden sm:block" />
            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
              <span className="text-emerald-100">Salidas: </span>
              <strong className="text-white">
                {traceGraph.metrics.totalExpedido.toLocaleString('es-ES')} bot.
              </strong>
            </div>
          </div>
        </div>

        {/* Diagram Canvas */}
        <div className="p-4 sm:p-6 bg-[#faf8f5] overflow-x-auto">
          <div className="text-xs text-stone-500 mb-4 flex items-center justify-between gap-2">
            <span>
              Toca cualquier bloque del diagrama para ver sus datos en detalle debajo.
            </span>
            {selectedNode && (
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-rose-800 font-semibold hover:underline cursor-pointer shrink-0"
              >
                Limpiar selección
              </button>
            )}
          </div>

          <div ref={flowContainerRef} className="relative min-w-0 lg:min-w-[920px]">
            {/* Desktop SVG Bezier Arrow Layer */}
            <svg
              width={svgSize.width}
              height={svgSize.height}
              className="hidden lg:block absolute inset-0 pointer-events-none z-0 overflow-visible"
            >
              <defs>
                {['#9f1239', '#4338ca', '#b45309', '#047857', '#57534e', '#0369a1'].map(
                  (col) => (
                    <marker
                      key={col}
                      id={`arrow-${col.replace('#', '')}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={col} />
                    </marker>
                  )
                )}
              </defs>

              {connectorPaths.map((cp) => (
                <g key={cp.id}>
                  <path
                    d={cp.d}
                    fill="none"
                    stroke={cp.stroke}
                    strokeWidth="2.2"
                    strokeOpacity="0.65"
                    markerEnd={`url(#arrow-${cp.stroke.replace('#', '')})`}
                  />
                  {cp.label && (
                    <g transform={`translate(${cp.labelX}, ${cp.labelY})`}>
                      <rect
                        x="-36"
                        y="-10"
                        width="72"
                        height="20"
                        rx="6"
                        fill="#ffffff"
                        stroke={cp.stroke}
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        className="fill-stone-800 text-[10px] font-bold tabular-nums"
                      >
                        {cp.label}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>

            {/* 5-Stage Connected Flow Grid */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-10 items-start">
              {/* STAGE 1: PARCELAS (VIÑEDO) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-100/80 border border-rose-200 text-rose-950">
                  <MapPin className="w-4 h-4 text-rose-800 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">1. Viñedo</span>
                </div>

                {traceGraph.parcelas.length > 0 ? (
                  traceGraph.parcelas.map((p) => (
                    <button
                      key={p.id}
                      ref={setNodeRef(`node-parc-${p.id}`)}
                      type="button"
                      onClick={() => setSelectedNode({ kind: 'parcela', data: p })}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs bg-white ${
                        isNodeSelected('parcela', p.id)
                          ? 'border-rose-800 ring-2 ring-rose-800/20'
                          : 'border-rose-200 hover:border-rose-400'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-rose-800 uppercase">
                        Parcela
                      </div>
                      <div className="font-serif-wine font-bold text-sm text-stone-900 mt-0.5 leading-snug">
                        {p.nombre}
                      </div>
                      <div className="text-xs text-stone-500 mt-1 tabular-nums">
                        {(p.superficieM2 || 0).toLocaleString('es-ES')} m²
                        {p.marcoPlantacion ? ` · ${p.marcoPlantacion}` : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.variedadesPlantadas.map((v, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-rose-50 text-rose-900 rounded text-[10px] font-semibold"
                          >
                            {v.variedad} {v.porcentajeEstimado}%
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-stone-300 bg-white/70 text-xs text-stone-500">
                    Sin entrada de parcela vinculada todavía.
                  </div>
                )}
              </div>

              {/* Mobile Stage Connector 1 -> 2 */}
              <div className="flex lg:hidden items-center justify-center py-0.5">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-900">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>{traceGraph.metrics.totalKg.toLocaleString('es-ES')} kg uva</span>
                </div>
              </div>

              {/* STAGE 2: ENTRADAS DE UVA */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-900 text-white">
                  <Grape className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">2. Vendimia</span>
                </div>

                {traceGraph.entradas.length > 0 ? (
                  traceGraph.entradas.map((ent) => {
                    const litros = ent.litrosMosto || 0;
                    const rend =
                      ent.rendimientoRealPorcentaje ||
                      (ent.kgTotales > 0 ? Number(((litros / ent.kgTotales) * 100).toFixed(1)) : 0);
                    return (
                      <button
                        key={ent.id}
                        ref={setNodeRef(`node-ent-${ent.id}`)}
                        type="button"
                        onClick={() => setSelectedNode({ kind: 'entrada', data: ent })}
                        className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs bg-white ${
                          isNodeSelected('entrada', ent.id)
                            ? 'border-rose-900 ring-2 ring-rose-900/20'
                            : 'border-stone-300 hover:border-rose-500'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono font-bold text-stone-500">
                            {ent.fecha}
                          </span>
                          <span className="text-[11px] font-bold text-rose-900 bg-rose-50 px-1.5 py-0.5 rounded tabular-nums">
                            {rend}% rend.
                          </span>
                        </div>
                        <div className="font-bold text-sm text-stone-900 mt-1 tabular-nums">
                          {ent.kgTotales.toLocaleString('es-ES')} kg ➔ {litros.toLocaleString('es-ES')} L
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5 truncate">
                          {ent.parcelaNombre} ➔ Dep. {ent.depositoDestinoId}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-stone-300 bg-white/70 text-xs text-stone-500">
                    Sin partidas de vendimia registradas para esta selección.
                  </div>
                )}
              </div>

              {/* Mobile Stage Connector 2 -> 3 */}
              <div className="flex lg:hidden items-center justify-center py-0.5">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-900">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>{traceGraph.metrics.totalMosto.toLocaleString('es-ES')} L a bodega</span>
                </div>
              </div>

              {/* STAGE 3: DEPÓSITOS Y ELABORACIÓN */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-950">
                  <Droplet className="w-4 h-4 text-indigo-800 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">3. Elaboración</span>
                </div>

                {traceGraph.depositos.length > 0 ? (
                  traceGraph.depositos.map((dep, idx) => {
                    const depOps = traceGraph.elaboraciones.filter(
                      (el) => el.depositoOrigenId === dep.id
                    );
                    const hasNextTransfer =
                      idx < traceGraph.depositos.length - 1 &&
                      traceGraph.transfers.some((tr) => tr.depositoOrigenId === dep.id);

                    return (
                      <div key={dep.id} className="space-y-2">
                        <button
                          ref={setNodeRef(`node-dep-${dep.id}`)}
                          type="button"
                          onClick={() => setSelectedNode({ kind: 'deposito', data: dep })}
                          className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs bg-white ${
                            isNodeSelected('deposito', dep.id)
                              ? 'border-indigo-700 ring-2 ring-indigo-700/20'
                              : 'border-indigo-200 hover:border-indigo-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-serif-wine font-bold text-sm text-stone-900">
                              Depósito Nº {dep.codigo}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md tabular-nums">
                              {dep.litrosActuales}/{dep.capacidadLitros}L
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-stone-600 mt-0.5">
                            {dep.tipoRecipiente}
                          </div>
                          {dep.vinoNombre && (
                            <div className="text-xs font-semibold text-rose-900 mt-1 truncate">
                              {dep.vinoNombre}
                            </div>
                          )}

                          {depOps.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-stone-100 space-y-1">
                              {depOps.slice(0, 3).map((op) => (
                                <div
                                  key={op.id}
                                  className="text-[11px] text-stone-700 flex items-center gap-1"
                                >
                                  <Activity className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span className="truncate font-medium">
                                    {op.operacionRealizada}
                                  </span>
                                </div>
                              ))}
                              {depOps.length > 3 && (
                                <div className="text-[10px] text-indigo-700 font-semibold">
                                  +{depOps.length - 3} prácticas más
                                </div>
                              )}
                            </div>
                          )}
                        </button>

                        {hasNextTransfer && (
                          <div className="flex lg:hidden justify-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-bold">
                              <ArrowRightLeft className="w-3 h-3" />
                              Trasiego entre recipientes
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-stone-300 bg-white/70 text-xs text-stone-500">
                    Sin depósito asociado.
                  </div>
                )}
              </div>

              {/* Mobile Stage Connector 3 -> 4 */}
              <div className="flex lg:hidden items-center justify-center py-0.5">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>
                    {traceGraph.metrics.totalBotellas > 0
                      ? `${traceGraph.metrics.totalBotellas.toLocaleString('es-ES')} botellas`
                      : `${traceGraph.metrics.totalGranel.toLocaleString('es-ES')} L en depósito`}
                  </span>
                </div>
              </div>

              {/* STAGE 4: EMBOTELLADO E INSUMOS */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-950">
                  <Wine className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">4. Embotellado</span>
                </div>

                {traceGraph.embotellados.length > 0 ? (
                  traceGraph.embotellados.map((emb) => (
                    <button
                      key={emb.id}
                      ref={setNodeRef(`node-emb-${emb.id}`)}
                      type="button"
                      onClick={() => setSelectedNode({ kind: 'embotellado', data: emb })}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs bg-white ${
                        isNodeSelected('embotellado', emb.id)
                          ? 'border-amber-700 ring-2 ring-amber-700/20'
                          : 'border-amber-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                          {emb.lote}
                        </span>
                        <span className="text-[11px] text-stone-500">{emb.fecha}</span>
                      </div>
                      <div className="font-serif-wine font-bold text-sm text-stone-900 mt-1.5">
                        {emb.marca}
                      </div>
                      <div className="text-xs font-bold text-rose-900 mt-0.5 tabular-nums">
                        {emb.cantidadBotellas075.toLocaleString('es-ES')} bot. ({emb.cantidadLitros} L)
                      </div>
                      <div className="text-[11px] text-stone-600 mt-1">
                        {emb.etiquetado ? 'Etiquetado completo' : 'En rima (sin etiquetar)'}
                      </div>
                      <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-500">
                        Corcho {emb.insumos.tipoCorcho} · Bot. {emb.insumos.tipoBotella}
                        {emb.insumos.lacre ? ' · Lacre' : ''}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 text-xs text-amber-900">
                    <div className="font-bold">Pendiente de embotellar</div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Esta referencia sigue en fase de elaboración / crianza en bodega.
                    </p>
                  </div>
                )}
              </div>

              {/* Mobile Stage Connector 4 -> 5 */}
              <div className="flex lg:hidden items-center justify-center py-0.5">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Destino final y stock</span>
                </div>
              </div>

              {/* STAGE 5: SALIDAS Y STOCK EN BODEGA */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-950">
                  <Send className="w-4 h-4 text-emerald-800 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">5. Salidas / Stock</span>
                </div>

                {traceGraph.salidas.map((sal) => (
                  <button
                    key={sal.id}
                    ref={setNodeRef(`node-sal-${sal.id}`)}
                    type="button"
                    onClick={() => setSelectedNode({ kind: 'salida', data: sal })}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs bg-white ${
                      isNodeSelected('salida', sal.id)
                        ? 'border-emerald-700 ring-2 ring-emerald-700/20'
                        : 'border-emerald-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {sal.tipoSalida}
                      </span>
                      <span className="text-[11px] text-stone-500">{sal.fecha}</span>
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-stone-900 mt-1 leading-snug">
                      {sal.destino}
                    </div>
                    <div className="text-xs font-extrabold text-emerald-800 mt-1 tabular-nums">
                      {sal.cantidadBotellas.toLocaleString('es-ES')} bot. · {sal.numeroAlbaranFactura}
                    </div>
                  </button>
                ))}

                {/* Remaining Bottle Stock nodes */}
                {traceGraph.embotellados
                  .filter((emb) => emb.botellasDisponibles > 0)
                  .map((emb) => (
                    <div
                      key={`stock-${emb.id}`}
                      ref={setNodeRef(`node-stock-${emb.id}`)}
                      className="p-3.5 rounded-2xl border-2 border-stone-300 bg-stone-50 shadow-xs"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 uppercase">
                        <Package className="w-3.5 h-3.5 text-stone-700" />
                        <span>Stock en Almacén</span>
                      </div>
                      <div className="font-bold text-sm text-stone-900 mt-1 tabular-nums">
                        {emb.botellasDisponibles.toLocaleString('es-ES')} botellas disponibles
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Lote {emb.lote} {emb.etiquetado ? '· Listo para venta' : '· En rima'}
                      </div>
                    </div>
                  ))}

                {/* If not bottled yet, show current bulk stock */}
                {traceGraph.embotellados.length === 0 &&
                  traceGraph.depsWithBulk.map((d) => (
                    <div
                      key={`bulk-${d.id}`}
                      ref={setNodeRef(`node-bulk-${d.id}`)}
                      className="p-3.5 rounded-2xl border-2 border-sky-200 bg-sky-50/70 shadow-xs"
                    >
                      <div className="text-[11px] font-bold text-sky-900 uppercase">
                        Stock a Granel Actual
                      </div>
                      <div className="font-bold text-sm text-stone-900 mt-1 tabular-nums">
                        {d.litrosActuales.toLocaleString('es-ES')} L en Dep. {d.codigo}
                      </div>
                      <div className="text-[11px] text-sky-800 mt-0.5">{d.estado}</div>
                    </div>
                  ))}

                {traceGraph.embotellados.length === 0 &&
                  traceGraph.depsWithBulk.length === 0 &&
                  traceGraph.salidas.length === 0 && (
                    <div className="p-3.5 rounded-2xl border border-dashed border-stone-300 bg-white/70 text-xs text-stone-500">
                      Sin salidas ni stock activo registrado.
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SELECTED NODE INSPECTOR CARD (when user clicks a node in diagram) */}
      {/* ================================================================= */}
      {selectedNode && (
        <div className="bg-white rounded-2xl border-2 border-rose-900/30 shadow-sm p-4 sm:p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-200">
            <h4 className="font-serif-wine font-bold text-base sm:text-lg text-stone-900">
              {selectedNode.kind === 'parcela' && `Detalle de Parcela: ${selectedNode.data.nombre}`}
              {selectedNode.kind === 'entrada' && `Detalle de Vendimia: ${selectedNode.data.id}`}
              {selectedNode.kind === 'deposito' && `Detalle de Depósito Nº ${selectedNode.data.codigo}`}
              {selectedNode.kind === 'embotellado' && `Detalle de Embotellado: Lote ${selectedNode.data.lote}`}
              {selectedNode.kind === 'salida' && `Detalle de Expedición: ${selectedNode.data.numeroAlbaranFactura}`}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-xs font-semibold text-stone-500 hover:text-stone-900 px-2.5 py-1 rounded-lg bg-stone-100 cursor-pointer"
            >
              Cerrar detalle
            </button>
          </div>

          {selectedNode.kind === 'parcela' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Paraje</span>
                <strong className="text-stone-900">{selectedNode.data.paraje}</strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Superficie</span>
                <strong className="text-stone-900 tabular-nums">
                  {selectedNode.data.superficieM2.toLocaleString('es-ES')} m²
                </strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Marco plantación</span>
                <strong className="text-stone-900">{selectedNode.data.marcoPlantacion || '-'}</strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Suelo</span>
                <strong className="text-stone-900">{selectedNode.data.tipoSuelo}</strong>
              </div>
            </div>
          )}

          {selectedNode.kind === 'entrada' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Fecha</span>
                <strong className="text-stone-900">{selectedNode.data.fecha}</strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Uva / Mosto</span>
                <strong className="text-stone-900 tabular-nums">
                  {selectedNode.data.kgTotales} kg ➔ {selectedNode.data.litrosMosto} L
                </strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Rendimiento real</span>
                <strong className="text-rose-900 tabular-nums">
                  {selectedNode.data.rendimientoRealPorcentaje ??
                    ((selectedNode.data.litrosMosto / (selectedNode.data.kgTotales || 1)) * 100).toFixed(1)}
                  %
                </strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Variedades</span>
                <strong className="text-stone-900">
                  {selectedNode.data.desgloseVariedades
                    .map((v) => `${v.variedad} (${v.kg}kg)`)
                    .join(', ')}
                </strong>
              </div>
            </div>
          )}

          {selectedNode.kind === 'deposito' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Tipo / Material</span>
                  <strong className="text-stone-900">{selectedNode.data.tipoRecipiente}</strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Volumen actual</span>
                  <strong className="text-stone-900 tabular-nums">
                    {selectedNode.data.litrosActuales} / {selectedNode.data.capacidadLitros} L
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Estado</span>
                  <strong className="text-indigo-900">{selectedNode.data.estado}</strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Ubicación</span>
                  <strong className="text-stone-900">{selectedNode.data.ubicacion || 'Bodega'}</strong>
                </div>
              </div>

              {traceGraph.elaboraciones.filter(
                (el) =>
                  el.depositoOrigenId === selectedNode.data.id ||
                  el.depositoDestinoId === selectedNode.data.id
              ).length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-stone-700 block">
                    Prácticas enológicas vinculadas a Nº {selectedNode.data.codigo}:
                  </span>
                  {traceGraph.elaboraciones
                    .filter(
                      (el) =>
                        el.depositoOrigenId === selectedNode.data.id ||
                        el.depositoDestinoId === selectedNode.data.id
                    )
                    .map((el) => (
                      <div
                        key={el.id}
                        className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <strong className="text-stone-900">{el.operacionRealizada}</strong>
                          <span className="text-stone-500 ml-2">
                            ({el.fecha} · {el.cantidadLitros} L)
                          </span>
                          {el.cantidadSulfitado && (
                            <span className="text-indigo-800 ml-2">· {el.cantidadSulfitado}</span>
                          )}
                          {el.detalleCorreccion && (
                            <span className="text-indigo-800 ml-2">· {el.detalleCorreccion}</span>
                          )}
                        </div>
                        {el.depositoDestinoId && el.depositoDestinoId !== el.depositoOrigenId && (
                          <span className="font-bold text-indigo-900">
                            Dep. {el.depositoOrigenId} ➔ Dep. {el.depositoDestinoId}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {selectedNode.kind === 'embotellado' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Fecha / Depósito</span>
                  <strong className="text-stone-900">
                    {selectedNode.data.fecha} · Dep. {selectedNode.data.depositoProcedenciaId}
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Volumen / Botellas</span>
                  <strong className="text-rose-900 tabular-nums">
                    {selectedNode.data.cantidadLitros} L ({selectedNode.data.cantidadBotellas075} bot.)
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Etiquetado</span>
                  <strong className="text-emerald-800">
                    {selectedNode.data.etiquetado ? 'Sí (Vestido)' : 'No (En rima)'}
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <span className="text-stone-500 block">Stock actual</span>
                  <strong className="text-stone-900 tabular-nums">
                    {selectedNode.data.botellasDisponibles} bot.
                  </strong>
                </div>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-wrap gap-2">
                <span>
                  Corcho: <strong className="capitalize">{selectedNode.data.insumos.tipoCorcho}</strong>
                </span>
                <span>·</span>
                <span>
                  Botella: <strong className="capitalize">{selectedNode.data.insumos.tipoBotella}</strong>
                </span>
                <span>·</span>
                <span>
                  Etiqueta: <strong className="capitalize">{selectedNode.data.insumos.tipoEtiqueta}</strong>
                </span>
                <span>·</span>
                <span>
                  Lacre:{' '}
                  <strong>
                    {selectedNode.data.insumos.lacre
                      ? selectedNode.data.insumos.colorLacre || 'Sí'
                      : 'No'}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Cajas:{' '}
                  <strong>
                    {selectedNode.data.insumos.tipoCaja} ({selectedNode.data.insumos.cajasUtilizadas || 0})
                  </strong>
                </span>
              </div>
            </div>
          )}

          {selectedNode.kind === 'salida' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Fecha</span>
                <strong className="text-stone-900">{selectedNode.data.fecha}</strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Cliente / Destino</span>
                <strong className="text-stone-900">{selectedNode.data.destino}</strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Cantidad</span>
                <strong className="text-emerald-800 tabular-nums">
                  {selectedNode.data.cantidadBotellas} botellas
                  {selectedNode.data.numeroCajas ? ` (${selectedNode.data.numeroCajas} cajas)` : ''}
                </strong>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 block">Albarán / Tipo</span>
                <strong className="text-stone-900">
                  {selectedNode.data.numeroAlbaranFactura} · {selectedNode.data.tipoSalida}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* COMPLETE CHRONOLOGICAL AUDIT TRAIL BELOW DIAGRAM                  */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <h3 className="font-serif-wine font-bold text-stone-900 text-base sm:text-lg">
            Historial Cronológico de Elaboración y Movimientos
          </h3>
          <span className="text-xs text-stone-500 tabular-nums">
            {traceGraph.elaboraciones.length} prácticas registradas
          </span>
        </div>

        {traceGraph.elaboraciones.length > 0 ? (
          <div className="space-y-2">
            {traceGraph.elaboraciones.map((el) => (
              <div
                key={el.id}
                className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-stone-900 flex flex-wrap items-center gap-2">
                    <span>{el.operacionRealizada}</span>
                    {el.tipoVino && (
                      <span className="text-[11px] font-semibold text-stone-700 bg-stone-200/70 px-2 py-0.5 rounded">
                        {el.tipoVino}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded">
                      Dep. {el.depositoOrigenId}
                      {el.depositoDestinoId && el.depositoDestinoId !== el.depositoOrigenId
                        ? ` ➔ Dep. ${el.depositoDestinoId}`
                        : ''}
                    </span>
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {el.fecha} · {el.cantidadLitros} L intervenidos
                    {el.cantidadSulfitado ? ` · Dosis: ${el.cantidadSulfitado}` : ''}
                    {el.detalleCorreccion ? ` · Dosis: ${el.detalleCorreccion}` : ''}
                  </div>
                </div>
                <div className="text-stone-600 font-medium">
                  {el.porcentajesVariedades
                    .map((v) => `${v.variedad} ${v.porcentaje}%`)
                    .join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-500 italic">
            No hay operaciones de elaboración registradas todavía en esta cadena.
          </p>
        )}
      </div>
    </div>
  );
};

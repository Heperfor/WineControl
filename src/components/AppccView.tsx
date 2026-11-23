import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Droplets,
  Edit3,
  FileDown,
  FlaskConical,
  Leaf,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  APPCC_BODEGA_INFO,
  APPCC_CUADRO_GESTION,
  APPCC_PREFIJOS_LOTE,
  FLUJO_VINO_BLANCO_APPCC,
  FLUJO_VINO_TINTO_APPCC,
  formatLoteComercialAppcc,
} from '../data/appccManualData';
import {
  AppccAguaRegistro,
  AppccLimpiezaRegistro,
  AppccPlagaMantenimientoRegistro,
  AppccProveedorRegistro,
  AppccResiduoRegistro,
  MarcaVino,
  TipoResiduoAppcc,
} from '../types/winery';
import {
  APPCC_LD_FILAS_BASE,
  MatrizLdFilaDef,
  getCategoriaZonaLd,
  getDaysInMonth,
  mapDepositoIdToZonaLd,
} from '../utils/appccAutomation';
import { exportAppccManualSanidadPDF } from '../utils/appccPdfExport';
import { inferTipoVinoFromVarieties } from '../utils/wineType';

type AppccSectionTab =
  | 'matriz_ld'
  | 'agua_residuos_ddd'
  | 'bodega_trazabilidad'
  | 'proveedores_mant_r4'
  | 'flujo_pcc';

const MESES_NOMBRE = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface AppccViewProps {
  initialMonth?: string;
}

export const AppccView: React.FC<AppccViewProps> = ({ initialMonth }) => {
  const {
    bodegaConfig,
    parcelas,
    depositos,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
    insumosMovimientos,
    appccAgua,
    addAppccAgua,
    updateAppccAgua,
    deleteAppccAgua,
    appccLimpieza,
    addAppccLimpieza,
    updateAppccLimpieza,
    toggleAppccLimpiezaCelda,
    deleteAppccLimpieza,
    appccResiduos,
    addAppccResiduo,
    updateAppccResiduo,
    deleteAppccResiduo,
    appccPlagasMant,
    addAppccPlagaMant,
    updateAppccPlagaMant,
    deleteAppccPlagaMant,
    appccProveedores,
    addAppccProveedor,
    updateAppccProveedor,
    deleteAppccProveedor,
    appccIncidencias,
    addAppccIncidencia,
    updateAppccIncidencia,
    deleteAppccIncidencia,
    generarRegistrosMesAppcc,
  } = useWinery();

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const responsableDefault = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';

  const [activeSection, setActiveSection] = useState<AppccSectionTab>('matriz_ld');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [flowWineType, setFlowWineType] = useState<'tinto' | 'blanco'>('tinto');

  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
      setActiveSection('matriz_ld');
    }
  }, [initialMonth]);

  // Interactive Lote simulator state
  const [simMarca, setSimMarca] = useState<MarcaVino>('Xouba');
  const [simNumEmb, setSimNumEmb] = useState<number>(1);
  const [simCosecha, setSimCosecha] = useState<number>(2024);

  // Toast feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  // Inline Edit States
  const [editingLdId, setEditingLdId] = useState<string | null>(null);
  const [editLdDraft, setEditLdDraft] = useState<Partial<AppccLimpiezaRegistro>>({});

  const [editingAguaId, setEditingAguaId] = useState<string | null>(null);
  const [editAguaDraft, setEditAguaDraft] = useState<Partial<AppccAguaRegistro>>({});

  const [editingProvId, setEditingProvId] = useState<string | null>(null);
  const [editProvDraft, setEditProvDraft] = useState<Partial<AppccProveedorRegistro>>({});

  const [editingMantId, setEditingMantId] = useState<string | null>(null);
  const [editMantDraft, setEditMantDraft] = useState<Partial<AppccPlagaMantenimientoRegistro>>({});

  // Manual Creation Forms
  const [ldForm, setLdForm] = useState({
    fecha: todayStr,
    zonaEquipo: 'BOMBAS',
    productoUsado: 'Circulación agua limpia / solución alcalina',
    conforme: true,
    observaciones: '',
  });

  const [aguaForm, setAguaForm] = useState({
    fecha: todayStr,
    lugarTomaMuestra: 'Grifo zona elaboración',
    cloroResidualMgL: 0.5,
    ph: 7.2,
    aspecto: 'Limpio, incoloro, inodoro',
    organolepticoConforme: true,
    anomaliaSuministro: false,
    observaciones: '',
  });

  const [residuoForm, setResiduoForm] = useState<{
    fecha: string;
    tipoResiduo: TipoResiduoAppcc;
    cantidadEstimada: string;
    destino: string;
    parcelaDestino: string;
    conforme: boolean;
    observaciones: string;
  }>({
    fecha: todayStr,
    tipoResiduo: 'Bagazo de prensado',
    cantidadEstimada: '',
    destino: 'A finca / viñedo propio para compostar',
    parcelaDestino: parcelas[0]?.nombre || 'O Seixo (Ventosela)',
    conforme: true,
    observaciones: '',
  });

  const [pmForm, setPmForm] = useState<{
    fecha: string;
    tipoControl:
      | 'Vigilancia DDD (Plagas · Mensual)'
      | 'Tratamiento DDD Empresa Autorizada'
      | 'Mantenimiento Preventivo Equipos'
      | 'Mantenimiento Instalaciones';
    elementoZona: string;
    localInstalaciones: string;
    maquinariaUtensilios: string;
    resultado: 'Sin anomalías / Conforme' | 'Incidencia detectada';
    observaciones: string;
  }>({
    fecha: todayStr,
    tipoControl: 'Mantenimiento Preventivo Equipos',
    elementoZona: 'Revisión de equipos y estanqueidad',
    localInstalaciones: 'Suelos, paredes y luminarias OK',
    maquinariaUtensilios: 'Despalilladora, prensa, bombas y mangueras OK',
    resultado: 'Sin anomalías / Conforme',
    observaciones: '',
  });

  const [provForm, setProvForm] = useState({
    proveedor: '',
    productos: '',
    localizacion: '',
    conforme: true,
    observaciones: '',
  });

  const [incForm, setIncForm] = useState({
    fecha: todayStr,
    planAfectado: 'Limpieza y Desinfección (L+D)',
    descripcion: '',
    medidaCorrectora: '',
    estado: 'Resuelta' as 'Resuelta' | 'En seguimiento',
    responsable: responsableDefault,
  });

  // Matrix computation for selectedMonth
  const [selYear, selMonth] = useMemo(() => {
    const parts = selectedMonth.split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth]);

  const daysInSelectedMonth = useMemo(
    () => getDaysInMonth(selYear, selMonth),
    [selYear, selMonth]
  );

  const dayNumbers = useMemo(
    () => Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1),
    [daysInSelectedMonth]
  );

  const monthRecordsLd = useMemo(
    () =>
      appccLimpieza
        .filter((l) => l.fecha.startsWith(selectedMonth))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [appccLimpieza, selectedMonth]
  );

  // Include base floor-plan rows plus any custom tank added in Bodega or recorded in the month
  const ldMatrixRows = useMemo<MatrizLdFilaDef[]>(() => {
    const rows: MatrizLdFilaDef[] = [...APPCC_LD_FILAS_BASE];
    const known = new Set(rows.map((r) => r.zona.toUpperCase()));

    depositos.forEach((d) => {
      const zona = mapDepositoIdToZonaLd(d.id);
      if (!known.has(zona.toUpperCase())) {
        known.add(zona.toUpperCase());
        rows.push({
          categoria: 'DEPOSITOS',
          zona,
          frecuenciaLabel: 'Tras vaciado y previo a uso',
        });
      }
    });

    monthRecordsLd.forEach((rec) => {
      const upper = rec.zonaEquipo.toUpperCase();
      if (!known.has(upper)) {
        known.add(upper);
        rows.push({
          categoria: getCategoriaZonaLd(rec.zonaEquipo),
          zona: rec.zonaEquipo,
          frecuenciaLabel: 'Según operación',
        });
      }
    });

    return rows;
  }, [depositos, monthRecordsLd]);

  // Fast lookup map: `${fecha}|${zonaUpper}` -> AppccLimpiezaRegistro
  const ldCellMap = useMemo(() => {
    const map = new Map<string, AppccLimpiezaRegistro>();
    monthRecordsLd.forEach((rec) => {
      const key = `${rec.fecha}|${rec.zonaEquipo.toUpperCase()}`;
      if (!map.has(key)) map.set(key, rec);
    });
    return map;
  }, [monthRecordsLd]);

  // Helper to resolve Insumos Lot numbers for Registro Embotellados (PDF p.4)
  const findLoteInsumo = (tipo: 'botellas' | 'corchos', embLote: string) => {
    const out = insumosMovimientos.find(
      (m) => m.tipoInsumo === tipo && m.embotelladoLoteAsociado === embLote && m.loteProveedor
    );
    if (out?.loteProveedor) return out.loteProveedor;
    const entry = insumosMovimientos.find(
      (m) => m.tipoInsumo === tipo && m.movimiento === 'entrada' && m.loteProveedor
    );
    return entry?.loteProveedor || 'Ver albarán';
  };

  // Summary metrics
  const totalAutoRegistros = useMemo(() => {
    const ldAuto = appccLimpieza.filter((l) => l.origenAutomatico && l.origenAutomatico !== 'Manual').length;
    const agAuto = appccAgua.filter((a) => a.origenAutomatico && a.origenAutomatico !== 'Manual').length;
    const resAuto = appccResiduos.filter((r) => r.origenAutomatico && r.origenAutomatico !== 'Manual').length;
    const pmAuto = appccPlagasMant.filter((p) => p.origenAutomatico && p.origenAutomatico !== 'Manual').length;
    return ldAuto + agAuto + resAuto + pmAuto;
  }, [appccLimpieza, appccAgua, appccResiduos, appccPlagasMant]);

  const sortedAppccAgua = useMemo(
    () => [...appccAgua].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [appccAgua]
  );

  const incidenciasNoOkLd = monthRecordsLd.filter((l) => !l.conforme).length;
  const openIncidentsCount = appccIncidencias.filter((i) => i.estado === 'En seguimiento').length;
  const lastAgua = sortedAppccAgua[0];
  const aguaCumple =
    lastAgua &&
    lastAgua.organolepticoConforme &&
    !lastAgua.anomaliaSuministro &&
    lastAgua.cloroResidualMgL >= 0.2 &&
    lastAgua.cloroResidualMgL <= 1.0;

  // Quick trigger to create an R4 incident from any non-OK register
  const openR4FromWarning = (planAfectado: string, descripcion: string, fecha: string) => {
    setIncForm({
      fecha,
      planAfectado,
      descripcion,
      medidaCorrectora: '',
      estado: 'En seguimiento',
      responsable: responsableDefault,
    });
    setActiveSection('proveedores_mant_r4');
    showToast('Pre-rellenado formulario R4 para documentar la acción correctora.');
  };

  const handleSyncMonthFrequency = () => {
    const added = generarRegistrosMesAppcc(selectedMonth, false);
    if (added > 0) {
      showToast(`Generados automáticamente ${added} registros OK para ${MESES_NOMBRE[selMonth - 1]} ${selYear}.`);
    } else {
      showToast(`Todos los registros automáticos y por frecuencia de ${MESES_NOMBRE[selMonth - 1]} ${selYear} ya están cubiertos.`);
    }
  };

  const handleExportPdf = () => {
    exportAppccManualSanidadPDF({
      mesReferencia: selectedMonth,
      entradasUva,
      depositos,
      elaboraciones,
      embotellados,
      salidas,
      insumosMovimientos,
      agua: appccAgua,
      limpieza: appccLimpieza,
      residuos: appccResiduos,
      plagasMant: appccPlagasMant,
      proveedores: appccProveedores,
      incidencias: appccIncidencias,
    });
    showToast('PDF oficial de Registros APPCC generado.');
  };

  // Submit Handlers
  const handleAddLd = (e: React.FormEvent) => {
    e.preventDefault();
    addAppccLimpieza({
      ...ldForm,
      responsable: responsableDefault,
      origenAutomatico: 'Manual',
      editadoManualmente: true,
    });
    setSelectedMonth(ldForm.fecha.slice(0, 7));
    setLdForm({ ...ldForm, observaciones: '' });
    showToast('Registro L+D guardado.');
  };

  const handleAddAgua = (e: React.FormEvent) => {
    e.preventDefault();
    addAppccAgua({
      ...aguaForm,
      mesReferencia: aguaForm.fecha.slice(0, 7),
      cloroResidualMgL: Number(aguaForm.cloroResidualMgL),
      ph: Number(aguaForm.ph),
      responsable: responsableDefault,
      origenAutomatico: 'Manual',
      editadoManualmente: true,
    });
    setAguaForm({ ...aguaForm, observaciones: '' });
    showToast('Control de Agua Potable guardado.');
  };

  const handleAddResiduo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residuoForm.cantidadEstimada.trim()) return;
    addAppccResiduo({
      ...residuoForm,
      responsable: responsableDefault,
      origenAutomatico: 'Manual',
      editadoManualmente: true,
    });
    setResiduoForm({ ...residuoForm, cantidadEstimada: '', observaciones: '' });
    showToast('Registro de residuos / subproductos guardado.');
  };

  const handleAddPm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmForm.elementoZona.trim()) return;
    addAppccPlagaMant({
      ...pmForm,
      responsable: responsableDefault,
      origenAutomatico: 'Manual',
      editadoManualmente: true,
    });
    setPmForm({ ...pmForm, observaciones: '' });
    showToast('Registro de Mantenimiento / DDD guardado.');
  };

  const handleAddProv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provForm.proveedor.trim() || !provForm.productos.trim()) return;
    addAppccProveedor({
      ...provForm,
      origenAutomatico: 'Manual',
      editadoManualmente: true,
    });
    setProvForm({ proveedor: '', productos: '', localizacion: '', conforme: true, observaciones: '' });
    showToast('Proveedor añadido al Plan de Control.');
  };

  const handleAddInc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incForm.descripcion.trim() || !incForm.medidaCorrectora.trim()) return;
    addAppccIncidencia(incForm);
    setIncForm({ ...incForm, descripcion: '', medidaCorrectora: '' });
    showToast('Incidencia (R4) registrada.');
  };

  const activeFlowSteps =
    flowWineType === 'tinto' ? FLUJO_VINO_TINTO_APPCC : FLUJO_VINO_BLANCO_APPCC;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold text-rose-900">REGISTROS APPCC · Edición 01</span>
            <span aria-hidden="true">·</span>
            <span>Adega {APPCC_BODEGA_INFO.nombreComercial}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">RGE {APPCC_BODEGA_INFO.numeroRge}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900 mt-1">
            Registros Automáticos y Autocontrol APPCC
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-3xl">
            Se cubren automáticamente en estado <strong>OK</strong> al registrar vendimias, trasiegos, embotellados, insumos o frecuencias del plan (RD 3/2023 mensual, L+D semanal/mensual, DDD). Cualquier celda o fila puede modificarse manualmente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncMonthFrequency}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Completar Mes por Frecuencia (OK)</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileDown className="w-4 h-4 text-amber-300" />
            <span>Exportar Registros PDF</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Key Operational Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs text-stone-500">Automatización APPCC</div>
          <div className="text-lg font-bold text-stone-900 tabular-nums mt-1">
            {totalAutoRegistros} registros auto-OK
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            Vendimia, trasiegos, embotellado y frecuencias
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs text-stone-500">Matriz L+D ({MESES_NOMBRE[selMonth - 1]} {selYear})</div>
          <div className="text-lg font-bold text-stone-900 tabular-nums mt-1">
            {monthRecordsLd.length} operaciones L+D
          </div>
          <div className={`text-xs mt-1 font-medium ${incidenciasNoOkLd === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {incidenciasNoOkLd === 0 ? 'Todo OK en el mes seleccionado' : `${incidenciasNoOkLd} marcado(s) con incidencia`}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs text-stone-500">Agua Potable (RD 3/2023)</div>
          <div className="text-lg font-bold text-stone-900 tabular-nums mt-1">
            {lastAgua ? `${lastAgua.cloroResidualMgL.toFixed(2)} mg/l · pH ${lastAgua.ph}` : 'Sin reg.'}
          </div>
          <div className={`text-xs mt-1 font-medium ${aguaCumple ? 'text-emerald-700' : 'text-rose-700'}`}>
            {aguaCumple ? 'Mensual OK (0,2–1,0 mg/l)' : 'Desviación detectada · Revisar'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200">
          <div className="text-xs text-stone-500">Registros de Bodega e Incidencias</div>
          <div className="text-lg font-bold text-stone-900 tabular-nums mt-1">
            {entradasUva.length} uva · {elaboraciones.length} mov. · {embotellados.length} emb.
          </div>
          <div className="text-xs text-stone-500 mt-1 tabular-nums">
            {openIncidentsCount} incidencia(s) R4 en seguimiento
          </div>
        </div>
      </div>

      {/* Primary Section Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-stone-200 rounded-xl overflow-x-auto">
        {(
          [
            { id: 'matriz_ld', label: 'Limpieza y Desinfección (Matriz 1–31)' },
            { id: 'agua_residuos_ddd', label: 'Agua (RD 3/2023), Residuos y Plagas' },
            { id: 'bodega_trazabilidad', label: 'Uva, Movimientos, Embotellado y Salidas' },
            { id: 'proveedores_mant_r4', label: 'Proveedores, Mantenimiento e Incidencias' },
            { id: 'flujo_pcc', label: 'Diagrama de Flujo y PCC' },
          ] as const
        ).map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-stone-900 text-amber-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PLAN DE LIMPIEZA Y DESINFECCION (MATRIZ 1..31 + EDICION)       */}
      {/* ===================================================================== */}
      {activeSection === 'matriz_ld' && (
        <div className="space-y-5">
          {/* Monthly Matrix Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-200">
              <div className="flex items-start gap-2.5">
                <CalendarCheck2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif-wine text-stone-900">
                    PLAN DE LIMPIEZA Y DESINFECCIÓN · {MESES_NOMBRE[selMonth - 1].toUpperCase()} {selYear}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Haz clic en cualquier casilla del calendario para alternar manualmente: <strong>Vacío → OK → INC → Vacío</strong>. Las operaciones de vendimia, trasiego y embotellado marcan automáticamente sus equipos como OK.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="text-xs font-semibold text-stone-600">Mes:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold border border-stone-300 rounded-lg bg-stone-50 text-stone-900"
                />
              </div>
            </div>

            {/* Matrix Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                  OK
                </span>
                <span>Limpieza verificada conforme (automática o manual)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-rose-700 text-white font-bold text-[10px]">
                  INC
                </span>
                <span>Incidencia / Repaso manual necesario</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-6 h-5 rounded border border-stone-300 bg-white text-stone-400 text-[10px]">
                  —
                </span>
                <span>Sin operación / clic para marcar OK</span>
              </div>
            </div>

            {/* Monthly 1..31 Matrix Table (Replica of PDF pages 7-13) */}
            <div className="overflow-x-auto border border-stone-300 rounded-xl">
              <table className="w-full border-collapse text-[11px] select-none">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2 border border-emerald-700 text-left sticky left-0 z-20 bg-emerald-900 min-w-[96px]">
                      ÁREA
                    </th>
                    <th className="p-2 border border-emerald-700 text-left sticky left-[96px] z-20 bg-emerald-900 min-w-[130px]">
                      ZONA / EQUIPO
                    </th>
                    {dayNumbers.map((d) => (
                      <th
                        key={d}
                        className="py-1.5 px-1 border border-emerald-700 text-center font-bold tabular-nums min-w-[26px]"
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ldMatrixRows.map((fila, rowIdx) => {
                    const isFirstInGroup =
                      rowIdx === 0 ||
                      ldMatrixRows[rowIdx - 1].categoria !== fila.categoria;
                    const groupSpan = ldMatrixRows.filter(
                      (f) => f.categoria === fila.categoria
                    ).length;

                    const groupBg =
                      fila.categoria === 'INSTALACIONES'
                        ? 'bg-emerald-50 text-emerald-950'
                        : fila.categoria === 'MAQUINARIA'
                        ? 'bg-amber-50 text-amber-950'
                        : 'bg-stone-100 text-stone-900';

                    return (
                      <tr key={fila.zona} className="hover:bg-stone-50/80">
                        {isFirstInGroup && (
                          <td
                            rowSpan={groupSpan}
                            className={`p-2 border border-stone-300 font-bold text-[10px] tracking-wide align-middle text-center sticky left-0 z-10 ${groupBg}`}
                          >
                            {fila.categoria}
                          </td>
                        )}
                        <td
                          className="px-2 py-1.5 border border-stone-300 font-semibold text-stone-900 bg-white sticky left-[96px] z-10 whitespace-nowrap"
                          title={`Frecuencia: ${fila.frecuenciaLabel}`}
                        >
                          {fila.zona}
                        </td>
                        {dayNumbers.map((d) => {
                          const dayStr = String(d).padStart(2, '0');
                          const fecha = `${selectedMonth}-${dayStr}`;
                          const rec = ldCellMap.get(`${fecha}|${fila.zona.toUpperCase()}`);
                          return (
                            <td
                              key={d}
                              onClick={() => toggleAppccLimpiezaCelda(fecha, fila.zona)}
                              title={
                                rec
                                  ? `${fecha} · ${fila.zona}: ${rec.conforme ? 'OK' : 'INCIDENCIA'} (${rec.origenAutomatico || 'Manual'})\n${rec.productoUsado}${rec.observaciones ? '\n' + rec.observaciones : ''}`
                                  : `Clic para registrar limpieza OK en ${fila.zona} el ${fecha}`
                              }
                              className={`p-0.5 border border-stone-200 text-center cursor-pointer transition-colors ${
                                rec
                                  ? rec.conforme
                                    ? 'bg-emerald-100/80 hover:bg-emerald-200'
                                    : 'bg-rose-100 hover:bg-rose-200'
                                  : 'hover:bg-stone-100'
                              }`}
                            >
                              {rec ? (
                                rec.conforme ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-emerald-700 text-white font-bold text-[9px] leading-none">
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-block px-1 py-0.5 rounded bg-rose-700 text-white font-bold text-[9px] leading-none">
                                    INC
                                  </span>
                                )
                              ) : (
                                <span className="text-stone-300 text-[10px]">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Log & Manual Add/Edit for L+D */}
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
            {/* Manual Add L+D Form */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-900" />
                <h4 className="text-sm font-bold font-serif-wine text-stone-900">
                  Añadir Registro Manual L+D
                </h4>
              </div>
              <form onSubmit={handleAddLd} className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={ldForm.fecha}
                    onChange={(e) => setLdForm({ ...ldForm, fecha: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Zona / Equipo</label>
                  <select
                    value={ldForm.zonaEquipo}
                    onChange={(e) => setLdForm({ ...ldForm, zonaEquipo: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white font-semibold"
                  >
                    {[...ldMatrixRows]
                      .sort(
                        (a, b) =>
                          a.categoria.localeCompare(b.categoria, 'es', { sensitivity: 'base' }) ||
                          a.zona.localeCompare(b.zona, 'es', { sensitivity: 'base' })
                      )
                      .map((f) => (
                        <option key={f.zona} value={f.zona}>
                          {f.categoria} · {f.zona}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Producto / Método utilizado</label>
                  <input
                    type="text"
                    required
                    value={ldForm.productoUsado}
                    onChange={(e) => setLdForm({ ...ldForm, productoUsado: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Opcional..."
                    value={ldForm.observaciones}
                    onChange={(e) => setLdForm({ ...ldForm, observaciones: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <label className="inline-flex items-center gap-2 font-medium text-stone-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={ldForm.conforme}
                    onChange={(e) => setLdForm({ ...ldForm, conforme: e.target.checked })}
                    className="rounded border-stone-300 text-rose-900"
                  />
                  <span>Resultado OK (marcar desactivado si hay incidencia)</span>
                </label>
                <button
                  type="submit"
                  className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>Guardar en Matriz L+D</span>
                </button>
              </form>
            </div>

            {/* Filterable Audit List for Selected Month (with 1-click OK/INC toggle & inline edit) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold font-serif-wine text-stone-900">
                  Detalle de Registros L+D · {MESES_NOMBRE[selMonth - 1]} {selYear} ({monthRecordsLd.length})
                </h4>
                <span className="text-xs text-stone-500">
                  Edita o cambia OK ↔ Incidencia en cualquier fila
                </span>
              </div>

              {monthRecordsLd.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                  No hay registros L+D en {MESES_NOMBRE[selMonth - 1]} {selYear}. Pulsa{' '}
                  <strong>&quot;Completar Mes por Frecuencia (OK)&quot;</strong> o haz clic en las casillas de la matriz superior.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="py-2 pr-2 font-semibold">Fecha / Origen</th>
                        <th className="py-2 pr-2 font-semibold">Zona / Equipo</th>
                        <th className="py-2 pr-2 font-semibold">Producto y Notas</th>
                        <th className="py-2 pr-2 font-semibold">Estado</th>
                        <th className="py-2 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {monthRecordsLd.map((row) => {
                        const isEditing = editingLdId === row.id;
                        return (
                          <tr key={row.id} className="align-top">
                            <td className="py-2.5 pr-2 whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editLdDraft.fecha ?? row.fecha}
                                  onChange={(e) =>
                                    setEditLdDraft({ ...editLdDraft, fecha: e.target.value })
                                  }
                                  className="px-1.5 py-1 border border-stone-300 rounded text-xs"
                                />
                              ) : (
                                <>
                                  <div className="font-bold text-stone-900 tabular-nums">{row.fecha}</div>
                                  <div className="text-[11px] text-stone-500">
                                    {row.origenAutomatico ? `Auto · ${row.origenAutomatico}` : 'Manual'}
                                    {row.editadoManualmente ? ' (editado)' : ''}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="py-2.5 pr-2 font-semibold text-stone-900">
                              {row.zonaEquipo}
                            </td>
                            <td className="py-2.5 pr-2 text-stone-600">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={editLdDraft.productoUsado ?? row.productoUsado}
                                    onChange={(e) =>
                                      setEditLdDraft({ ...editLdDraft, productoUsado: e.target.value })
                                    }
                                    className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Observaciones..."
                                    value={editLdDraft.observaciones ?? row.observaciones ?? ''}
                                    onChange={(e) =>
                                      setEditLdDraft({ ...editLdDraft, observaciones: e.target.value })
                                    }
                                    className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div>{row.productoUsado}</div>
                                  {row.observaciones && (
                                    <div className="text-[11px] text-stone-500 mt-0.5">
                                      {row.observaciones}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 pr-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  updateAppccLimpieza(row.id, { conforme: !row.conforme })
                                }
                                title="Clic para cambiar entre OK e Incidencia"
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                  row.conforme
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                }`}
                              >
                                {row.conforme ? 'OK' : 'INCIDENCIA'}
                              </button>
                              {!row.conforme && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openR4FromWarning(
                                      'Limpieza y Desinfección (L+D)',
                                      `Incidencia L+D en ${row.zonaEquipo} (${row.fecha}): ${row.observaciones || row.productoUsado}`,
                                      row.fecha
                                    )
                                  }
                                  className="block text-[10px] text-rose-800 underline mt-1 cursor-pointer"
                                >
                                  Registrar en R4 →
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateAppccLimpieza(row.id, editLdDraft);
                                      setEditingLdId(null);
                                      showToast('Registro L+D actualizado.');
                                    }}
                                    className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Guardar"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLdId(null)}
                                    className="p-1.5 text-stone-500 hover:bg-stone-100 rounded cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLdId(row.id);
                                      setEditLdDraft({
                                        fecha: row.fecha,
                                        productoUsado: row.productoUsado,
                                        observaciones: row.observaciones,
                                      });
                                    }}
                                    className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
                                    title="Editar manualmente"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteAppccLimpieza(row.id)}
                                    className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CONTROL DE AGUA POTABLE, RESIDUOS Y PLAGAS (DDD)               */}
      {/* ===================================================================== */}
      {activeSection === 'agua_residuos_ddd' && (
        <div className="space-y-6">
          {/* CONTROL DE AGUA POTABLE (Exact PDF p.6 table + edit/add) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-sky-700" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif-wine text-stone-900">
                    CONTROL DE AGUA POTABLE (RD 3/2023 · Frecuencia Mensual)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cubierto 1 vez al mes hasta hoy ({sortedAppccAgua.length} meses registrados) con valores dentro de rango legal (0,20–1,00 mg/l cloro libre). Haz clic en Editar o en OK para ajustar cualquier dato manualmente.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddAgua} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={aguaForm.fecha}
                    onChange={(e) => setAguaForm({ ...aguaForm, fecha: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-stone-600 mb-1">Lugar de toma de muestra</label>
                  <input
                    type="text"
                    required
                    value={aguaForm.lugarTomaMuestra}
                    onChange={(e) => setAguaForm({ ...aguaForm, lugarTomaMuestra: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Cloro (mg/l)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    required
                    value={aguaForm.cloroResidualMgL}
                    onChange={(e) =>
                      setAguaForm({ ...aguaForm, cloroResidualMgL: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">pH</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    required
                    value={aguaForm.ph}
                    onChange={(e) => setAguaForm({ ...aguaForm, ph: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white tabular-nums font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Aspecto</label>
                  <input
                    type="text"
                    required
                    value={aguaForm.aspecto}
                    onChange={(e) => setAguaForm({ ...aguaForm, aspecto: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Opcional..."
                    value={aguaForm.observaciones}
                    onChange={(e) => setAguaForm({ ...aguaForm, observaciones: e.target.value })}
                    className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full min-h-[38px] px-4 py-2 rounded-lg bg-sky-800 hover:bg-sky-900 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir Toma Agua</span>
                  </button>
                </div>
              </div>
            </form>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold">LUGAR DE TOMA DE MUESTRA</th>
                    <th className="p-2.5 font-semibold">CLORO</th>
                    <th className="p-2.5 font-semibold">PH</th>
                    <th className="p-2.5 font-semibold">ASPECTO</th>
                    <th className="p-2.5 font-semibold">OBSERVACIONES</th>
                    <th className="p-2.5 font-semibold">ESTADO</th>
                    <th className="p-2.5 text-right font-semibold">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {sortedAppccAgua.map((row) => {
                    const isEditing = editingAguaId === row.id;
                    const ok =
                      row.organolepticoConforme &&
                      !row.anomaliaSuministro &&
                      row.cloroResidualMgL >= 0.2 &&
                      row.cloroResidualMgL <= 1.0;

                    return (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="p-2.5 tabular-nums whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editAguaDraft.fecha ?? row.fecha}
                              onChange={(e) =>
                                setEditAguaDraft({ ...editAguaDraft, fecha: e.target.value })
                              }
                              className="px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            <>
                              <div className="font-bold text-stone-900">{row.fecha}</div>
                              <div className="text-[10px] text-stone-500">
                                {row.origenAutomatico || 'Manual'}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAguaDraft.lugarTomaMuestra ?? row.lugarTomaMuestra}
                              onChange={(e) =>
                                setEditAguaDraft({ ...editAguaDraft, lugarTomaMuestra: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            row.lugarTomaMuestra
                          )}
                        </td>
                        <td className="p-2.5 tabular-nums font-bold">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editAguaDraft.cloroResidualMgL ?? row.cloroResidualMgL}
                              onChange={(e) =>
                                setEditAguaDraft({
                                  ...editAguaDraft,
                                  cloroResidualMgL: Number(e.target.value),
                                })
                              }
                              className="w-20 px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            `${row.cloroResidualMgL.toFixed(2)} mg/l`
                          )}
                        </td>
                        <td className="p-2.5 tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editAguaDraft.ph ?? row.ph}
                              onChange={(e) =>
                                setEditAguaDraft({ ...editAguaDraft, ph: Number(e.target.value) })
                              }
                              className="w-16 px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            row.ph
                          )}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAguaDraft.aspecto ?? row.aspecto}
                              onChange={(e) =>
                                setEditAguaDraft({ ...editAguaDraft, aspecto: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            row.aspecto
                          )}
                        </td>
                        <td className="p-2.5 text-stone-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAguaDraft.observaciones ?? row.observaciones ?? ''}
                              onChange={(e) =>
                                setEditAguaDraft({ ...editAguaDraft, observaciones: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            row.observaciones || '-'
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              updateAppccAgua(row.id, {
                                organolepticoConforme: !row.organolepticoConforme,
                              })
                            }
                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              ok
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {ok ? 'OK' : 'INCIDENCIA'}
                          </button>
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  updateAppccAgua(row.id, editAguaDraft);
                                  setEditingAguaId(null);
                                  showToast('Control de agua actualizado.');
                                }}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAguaId(null)}
                                className="p-1.5 text-stone-500 hover:bg-stone-100 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAguaId(row.id);
                                  setEditAguaDraft({
                                    fecha: row.fecha,
                                    lugarTomaMuestra: row.lugarTomaMuestra,
                                    cloroResidualMgL: row.cloroResidualMgL,
                                    ph: row.ph,
                                    aspecto: row.aspecto,
                                    observaciones: row.observaciones,
                                  });
                                }}
                                className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAppccAgua(row.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RESIDUOS (BAGAZO / RASPÓN) & VIGILANCIA PLAGAS DDD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Residuos y Subproductos */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-bold font-serif-wine text-stone-900">
                    Registro de Residuos y Subproductos (Bagazo / Raspón a Finca)
                  </h3>
                  <p className="text-xs text-stone-500">
                    El raspón se registra automáticamente al crear entradas de vendimia; bagazo y otros residuos añadibles manualmente.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddResiduo} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-stone-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      required
                      value={residuoForm.fecha}
                      onChange={(e) => setResiduoForm({ ...residuoForm, fecha: e.target.value })}
                      className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-600 mb-1">Tipo</label>
                    <select
                      value={residuoForm.tipoResiduo}
                      onChange={(e) => {
                        const val = e.target.value as TipoResiduoAppcc;
                        const defaultDest =
                          val === 'Bagazo de prensado' || val === 'Raspón de despalillado'
                            ? 'A finca / viñedo propio para compostar'
                            : val === 'Residuos peligrosos (gestor autorizado)'
                            ? 'Gestor autorizado de residuos'
                            : 'Contenedor reciclaje / Servicio municipal';
                        setResiduoForm({ ...residuoForm, tipoResiduo: val, destino: defaultDest });
                      }}
                      className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="Bagazo de prensado">Bagazo de prensado</option>
                      <option value="Raspón de despalillado">Raspón de despalillado</option>
                      <option value="Residuos peligrosos (gestor autorizado)">Residuos peligrosos</option>
                      <option value="Residuos reciclables (vidrio/cartón/plástico)">Residuos reciclables</option>
                      <option value="Residuos urbanos / desperdicios">Residuos urbanos</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Cantidad estimada (ej. 650 kg)"
                    value={residuoForm.cantidadEstimada}
                    onChange={(e) => setResiduoForm({ ...residuoForm, cantidadEstimada: e.target.value })}
                    className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Destino"
                    value={residuoForm.destino}
                    onChange={(e) => setResiduoForm({ ...residuoForm, destino: e.target.value })}
                    className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Parcela / Finca (ej. O Seixo)"
                    value={residuoForm.parcelaDestino}
                    onChange={(e) => setResiduoForm({ ...residuoForm, parcelaDestino: e.target.value })}
                    className="flex-1 px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar</span>
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-2 font-semibold">Fecha</th>
                      <th className="py-2 pr-2 font-semibold">Subproducto</th>
                      <th className="py-2 pr-2 font-semibold">Destino / Finca</th>
                      <th className="py-2 pr-2 font-semibold">Estado</th>
                      <th className="py-2 text-right font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {appccResiduos.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 pr-2 tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-stone-900">{row.fecha}</div>
                          <div className="text-[10px] text-stone-500">{row.origenAutomatico || 'Manual'}</div>
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-stone-900">{row.tipoResiduo}</div>
                          <div className="text-[11px] text-stone-500 tabular-nums">{row.cantidadEstimada}</div>
                        </td>
                        <td className="py-2.5 pr-2">
                          <div>{row.destino}</div>
                          {row.parcelaDestino && (
                            <div className="text-[11px] text-emerald-800 font-medium">{row.parcelaDestino}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <button
                            type="button"
                            onClick={() => updateAppccResiduo(row.id, { conforme: !(row.conforme ?? true) })}
                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              row.conforme !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.conforme !== false ? 'OK' : 'INCIDENCIA'}
                          </button>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => deleteAppccResiduo(row.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vigilancia DDD Mensual (R3) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
                <div>
                  <h3 className="text-base font-bold font-serif-wine text-stone-900">
                    Vigilancia de Plagas (DDD · Mensual R3)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Control automático mensual de desagües anti-múridos, mosquiteras y almacén (OK por defecto).
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-2 font-semibold">Fecha</th>
                      <th className="py-2 pr-2 font-semibold">Revisión DDD</th>
                      <th className="py-2 pr-2 font-semibold">Estado</th>
                      <th className="py-2 text-right font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {appccPlagasMant
                      .filter((p) => p.tipoControl.includes('DDD'))
                      .map((row) => {
                        const ok = row.resultado === 'Sin anomalías / Conforme';
                        return (
                          <tr key={row.id}>
                            <td className="py-2.5 pr-2 tabular-nums whitespace-nowrap">
                              <div className="font-semibold text-stone-900">{row.fecha}</div>
                              <div className="text-[10px] text-stone-500">
                                {row.origenAutomatico || 'Manual'}
                              </div>
                            </td>
                            <td className="py-2.5 pr-2">
                              <div className="font-semibold text-stone-900">{row.elementoZona}</div>
                              <div className="text-[11px] text-stone-500">{row.localInstalaciones || row.observaciones}</div>
                            </td>
                            <td className="py-2.5 pr-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  updateAppccPlagaMant(row.id, {
                                    resultado: ok
                                      ? 'Incidencia detectada'
                                      : 'Sin anomalías / Conforme',
                                  })
                                }
                                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                                  ok
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                }`}
                              >
                                {ok ? 'OK' : 'INCIDENCIA'}
                              </button>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => deleteAppccPlagaMant(row.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: REGISTROS DE BODEGA SINCRONIZADOS (PDF PAGES 1-5)               */}
      {/* ===================================================================== */}
      {activeSection === 'bodega_trazabilidad' && (
        <div className="space-y-6">
          {/* 1. REGISTRO ENTRADA DE UVA (PDF Page 1) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-serif-wine text-stone-900">
                  REGISTRO ENTRADA DE UVA ({entradasUva.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Sincronizado en tiempo real con Vendimia · Cada entrada genera automáticamente L+D (despalilladora, prensa, bombas, mangueras, depósito) y salida de raspón.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold">PARCELA/ZONA</th>
                    <th className="p-2.5 font-semibold">VARIEDADE</th>
                    <th className="p-2.5 font-semibold text-right">KG</th>
                    <th className="p-2.5 font-semibold text-center">DEPOSITO</th>
                    <th className="p-2.5 font-semibold">OBSERVACIONES / L+D AUTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {entradasUva.map((ent) => (
                    <tr key={ent.id} className="hover:bg-stone-50">
                      <td className="p-2.5 tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                        {ent.fecha}
                      </td>
                      <td className="p-2.5 font-semibold text-stone-900">{ent.parcelaNombre}</td>
                      <td className="p-2.5 text-stone-700">
                        {ent.desgloseVariedades.map((v) => v.variedad).join(', ')}
                      </td>
                      <td className="p-2.5 text-right tabular-nums font-bold text-stone-900">
                        {ent.kgTotales} kg
                      </td>
                      <td className="p-2.5 text-center font-bold text-rose-900">
                        {ent.depositoDestinoId}
                      </td>
                      <td className="p-2.5 text-stone-600">
                        {ent.tipoVino || inferTipoVinoFromVarieties(ent.desgloseVariedades, ent.parcelaNombre)} · {ent.litrosMosto} L mosto · L+D Auto OK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. REGISTRO PRACTICAS ENOLOGICAS / MOVIMIENTOS DEPOSITOS (PDF Pages 2-3) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
            <div>
              <h3 className="text-base font-bold font-serif-wine text-stone-900">
                REGISTRO PRÁCTICAS ENOLÓGICAS / MOVIMIENTOS DEPÓSITOS ({elaboraciones.length})
              </h3>
              <p className="text-xs text-stone-500">
                Sincronizado con Elaboración y Trasiegos · Cada trasiego o movimiento anota automáticamente en L+D el depósito origen/destino, bombas y mangueras.
              </p>
            </div>
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-800 text-amber-200 text-[10px] uppercase tracking-wider">
                    <th colSpan={4} className="px-2.5 py-1.5 border-r border-stone-700 text-center">
                      VINO
                    </th>
                    <th colSpan={3} className="px-2.5 py-1.5 text-center">
                      OPERACIÓN / MOVIMIENTO
                    </th>
                  </tr>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold text-center">DEPOSITO</th>
                    <th className="p-2.5 font-semibold">VARIEDAD</th>
                    <th className="p-2.5 font-semibold text-right">CANTIDAD</th>
                    <th className="p-2.5 font-semibold">PRÁCTICA ENOLÓGICA</th>
                    <th className="p-2.5 font-semibold">Q AÑADIDA - RESULTANTE/LOTE</th>
                    <th className="p-2.5 font-semibold text-center">PASA A DEPÓSITO Nº</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {elaboraciones.map((el) => {
                    const dep = depositos.find((d) => d.id === el.depositoOrigenId);
                    const qResult = [el.cantidadSulfitado, el.detalleCorreccion, dep?.vinoNombre]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <tr key={el.id} className="hover:bg-stone-50">
                        <td className="p-2.5 tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                          {el.fecha}
                        </td>
                        <td className="p-2.5 text-center font-bold text-stone-900">
                          {el.depositoOrigenId}
                        </td>
                        <td className="p-2.5 text-stone-700">
                          {el.porcentajesVariedades.map((v) => v.variedad).join(', ') || '-'}
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-bold">
                          {el.cantidadLitros} L
                        </td>
                        <td className="p-2.5 font-semibold text-stone-900">
                          {el.operacionRealizada}
                        </td>
                        <td className="p-2.5 text-stone-700">{qResult || '-'}</td>
                        <td className="p-2.5 text-center font-bold text-rose-900">
                          {el.depositoDestinoId || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. REGISTRO EMBOTELLADOS (PDF Page 4) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
            <div>
              <h3 className="text-base font-bold font-serif-wine text-stone-900">
                REGISTRO EMBOTELLADOS ({embotellados.length})
              </h3>
              <p className="text-xs text-stone-500">
                Cruce automático de Embotellados (REMB) + Lotes de botellas y corchos de Insumos + registro automático de limpieza en llenadora y corchadora.
              </p>
            </div>
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold text-center">DEPOSITO Nº</th>
                    <th className="p-2.5 font-semibold">TIPO VINO</th>
                    <th className="p-2.5 font-semibold">CANTIDAD / BOTELLAS</th>
                    <th className="p-2.5 font-semibold">LOTE VINO</th>
                    <th className="p-2.5 font-semibold">LOTE BOTELLAS</th>
                    <th className="p-2.5 font-semibold">LOTE CORCHOS</th>
                    <th className="p-2.5 font-semibold">OTROS LOTES DE AÑADIDOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {embotellados.map((emb) => (
                    <tr key={emb.id} className="hover:bg-stone-50">
                      <td className="p-2.5 tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                        {emb.fecha}
                      </td>
                      <td className="p-2.5 text-center font-bold">{emb.depositoProcedenciaId}</td>
                      <td className="p-2.5 font-semibold text-stone-900">{emb.marca}</td>
                      <td className="p-2.5 tabular-nums">
                        {emb.cantidadLitros} L / {emb.cantidadBotellas075} bot
                      </td>
                      <td className="p-2.5 font-mono font-bold text-rose-900">{emb.lote}</td>
                      <td className="p-2.5 font-mono text-stone-700">
                        {findLoteInsumo('botellas', emb.lote)}
                      </td>
                      <td className="p-2.5 font-mono text-stone-700">
                        {findLoteInsumo('corchos', emb.lote)}
                      </td>
                      <td className="p-2.5 text-stone-600">
                        {emb.insumos.lacre ? `Lacre ${emb.insumos.colorLacre || 'OK'}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. TRAZABILIDAD HACIA DELANTE (PDF Page 5) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
            <div>
              <h3 className="text-base font-bold font-serif-wine text-stone-900">
                TRAZABILIDAD HACIA DELANTE ({salidas.length})
              </h3>
              <p className="text-xs text-stone-500">
                Sincronizado con el libro de Salidas y Ventas de la bodega.
              </p>
            </div>
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold">DOCUMENTO</th>
                    <th className="p-2.5 font-semibold">PRODUCTO</th>
                    <th className="p-2.5 font-semibold text-right">CANTIDAD</th>
                    <th className="p-2.5 font-semibold">LOTE</th>
                    <th className="p-2.5 font-semibold">OBSERVACIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {salidas.map((sal) => (
                    <tr key={sal.id} className="hover:bg-stone-50">
                      <td className="p-2.5 tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                        {sal.fecha}
                      </td>
                      <td className="p-2.5 font-mono text-stone-700">{sal.numeroAlbaranFactura}</td>
                      <td className="p-2.5 font-semibold text-stone-900">
                        {sal.marca} — {sal.destino}
                      </td>
                      <td className="p-2.5 text-right tabular-nums font-bold">
                        {sal.cantidadBotellas} bot
                      </td>
                      <td className="p-2.5 font-mono font-bold text-rose-900">{sal.lote}</td>
                      <td className="p-2.5 text-stone-600">{sal.observaciones || sal.tipoSalida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: PROVEEDORES, MANTENIMIENTO E INCIDENCIAS (PDF PAGES 14-16)     */}
      {/* ===================================================================== */}
      {activeSection === 'proveedores_mant_r4' && (
        <div className="space-y-6">
          {/* PLAN CONTROL PROVEEDORES (PDF Page 14) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-base font-bold font-serif-wine text-stone-900">
                  PLAN CONTROL PROVEEDORES ({appccProveedores.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Sincronizado automáticamente con las entradas de Insumos (corchos, botellas, cajas, etiquetas) · Estado OK por defecto editable manualmente.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddProv} className="p-3 rounded-xl bg-stone-50 border border-stone-200 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                required
                placeholder="Proveedor *"
                value={provForm.proveedor}
                onChange={(e) => setProvForm({ ...provForm, proveedor: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                required
                placeholder="Productos *"
                value={provForm.productos}
                onChange={(e) => setProvForm({ ...provForm, productos: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                placeholder="Localización"
                value={provForm.localizacion}
                onChange={(e) => setProvForm({ ...provForm, localizacion: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                placeholder="Observaciones"
                value={provForm.observaciones}
                onChange={(e) => setProvForm({ ...provForm, observaciones: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                className="min-h-[38px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Añadir Proveedor</span>
              </button>
            </form>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">PROVEEDOR</th>
                    <th className="p-2.5 font-semibold">PRODUCTOS</th>
                    <th className="p-2.5 font-semibold">LOCALIZACIÓN</th>
                    <th className="p-2.5 font-semibold">OBSERVACIONES</th>
                    <th className="p-2.5 font-semibold">ESTADO</th>
                    <th className="p-2.5 text-right font-semibold">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {appccProveedores.map((p) => {
                    const isEditing = editingProvId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-semibold text-stone-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProvDraft.proveedor ?? p.proveedor}
                              onChange={(e) =>
                                setEditProvDraft({ ...editProvDraft, proveedor: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            p.proveedor
                          )}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProvDraft.productos ?? p.productos}
                              onChange={(e) =>
                                setEditProvDraft({ ...editProvDraft, productos: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            p.productos
                          )}
                        </td>
                        <td className="p-2.5 text-stone-700">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProvDraft.localizacion ?? p.localizacion}
                              onChange={(e) =>
                                setEditProvDraft({ ...editProvDraft, localizacion: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            p.localizacion
                          )}
                        </td>
                        <td className="p-2.5 text-stone-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProvDraft.observaciones ?? p.observaciones ?? ''}
                              onChange={(e) =>
                                setEditProvDraft({ ...editProvDraft, observaciones: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                            />
                          ) : (
                            p.observaciones || '-'
                          )}
                        </td>
                        <td className="p-2.5">
                          <button
                            type="button"
                            onClick={() => updateAppccProveedor(p.id, { conforme: !p.conforme })}
                            className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              p.conforme
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {p.conforme ? 'OK' : 'INCIDENCIA'}
                          </button>
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  updateAppccProveedor(p.id, editProvDraft);
                                  setEditingProvId(null);
                                  showToast('Proveedor actualizado.');
                                }}
                                className="p-1.5 text-emerald-700 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProvId(null)}
                                className="p-1.5 text-stone-500 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProvId(p.id);
                                  setEditProvDraft({
                                    proveedor: p.proveedor,
                                    productos: p.productos,
                                    localizacion: p.localizacion,
                                    observaciones: p.observaciones,
                                  });
                                }}
                                className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAppccProveedor(p.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PLAN DE MANTENIMIENTO (PDF Page 15) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-700" />
              <div>
                <h3 className="text-base font-bold font-serif-wine text-stone-900">
                  PLAN DE MANTENIMIENTO (Local, Instalaciones y Maquinaria)
                </h3>
                <p className="text-xs text-stone-500">
                  Revisión preventiva pre-vendimia automática y actuaciones puntuales editables.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddPm} className="p-3 rounded-xl bg-stone-50 border border-stone-200 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="date"
                required
                value={pmForm.fecha}
                onChange={(e) => setPmForm({ ...pmForm, fecha: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                required
                placeholder="Operación *"
                value={pmForm.elementoZona}
                onChange={(e) => setPmForm({ ...pmForm, elementoZona: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                placeholder="Local e instalaciones"
                value={pmForm.localInstalaciones}
                onChange={(e) => setPmForm({ ...pmForm, localInstalaciones: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <input
                type="text"
                placeholder="Maquinaria / Utensilios"
                value={pmForm.maquinariaUtensilios}
                onChange={(e) => setPmForm({ ...pmForm, maquinariaUtensilios: e.target.value })}
                className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                className="min-h-[38px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Registrar</span>
              </button>
            </form>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold">OPERACIÓN</th>
                    <th className="p-2.5 font-semibold">LOCAL E INSTALACIONES</th>
                    <th className="p-2.5 font-semibold">MAQUINARIA / UTENSILIOS</th>
                    <th className="p-2.5 font-semibold">ESTADO</th>
                    <th className="p-2.5 text-right font-semibold">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {appccPlagasMant
                    .filter((pm) => !pm.tipoControl.includes('DDD'))
                    .map((pm) => {
                      const isEditing = editingMantId === pm.id;
                      const ok = pm.resultado === 'Sin anomalías / Conforme';
                      return (
                        <tr key={pm.id} className="hover:bg-stone-50">
                          <td className="p-2.5 tabular-nums font-semibold whitespace-nowrap">{pm.fecha}</td>
                          <td className="p-2.5 font-semibold text-stone-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editMantDraft.elementoZona ?? pm.elementoZona}
                                onChange={(e) =>
                                  setEditMantDraft({ ...editMantDraft, elementoZona: e.target.value })
                                }
                                className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                              />
                            ) : (
                              pm.elementoZona
                            )}
                          </td>
                          <td className="p-2.5 text-stone-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editMantDraft.localInstalaciones ?? pm.localInstalaciones ?? ''}
                                onChange={(e) =>
                                  setEditMantDraft({
                                    ...editMantDraft,
                                    localInstalaciones: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                              />
                            ) : (
                              pm.localInstalaciones || '-'
                            )}
                          </td>
                          <td className="p-2.5 text-stone-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editMantDraft.maquinariaUtensilios ?? pm.maquinariaUtensilios ?? ''}
                                onChange={(e) =>
                                  setEditMantDraft({
                                    ...editMantDraft,
                                    maquinariaUtensilios: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                              />
                            ) : (
                              pm.maquinariaUtensilios || pm.observaciones || '-'
                            )}
                          </td>
                          <td className="p-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateAppccPlagaMant(pm.id, {
                                  resultado: ok ? 'Incidencia detectada' : 'Sin anomalías / Conforme',
                                })
                              }
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                                ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {ok ? 'OK' : 'INCIDENCIA'}
                            </button>
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateAppccPlagaMant(pm.id, editMantDraft);
                                    setEditingMantId(null);
                                    showToast('Mantenimiento actualizado.');
                                  }}
                                  className="p-1.5 text-emerald-700 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMantId(null)}
                                  className="p-1.5 text-stone-500 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMantId(pm.id);
                                    setEditMantDraft({
                                      elementoZona: pm.elementoZona,
                                      localInstalaciones: pm.localInstalaciones,
                                      maquinariaUtensilios: pm.maquinariaUtensilios,
                                    });
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteAppccPlagaMant(pm.id)}
                                  className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* REGISTRO DE INCIDENCIAS (PDF Page 16) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-800" />
              <div>
                <h3 className="text-base font-bold font-serif-wine text-stone-900">
                  REGISTRO DE INCIDENCIAS Y ACCIÓN CORRECTORA (R4)
                </h3>
                <p className="text-xs text-stone-500">
                  Anotación ante cualquier registro modificado de OK a Incidencia o desviación detectada.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddInc} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="date"
                  required
                  value={incForm.fecha}
                  onChange={(e) => setIncForm({ ...incForm, fecha: e.target.value })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                />
                <select
                  value={incForm.planAfectado}
                  onChange={(e) => setIncForm({ ...incForm, planAfectado: e.target.value })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                >
                  <option>Agua Potable (RD 3/2023)</option>
                  <option>BPF / BPH (Vidrio y Embotellado)</option>
                  <option>Control de Plagas (DDD)</option>
                  <option>Control de Proveedores</option>
                  <option>Control del SO₂</option>
                  <option>Eliminación de Residuos</option>
                  <option>Limpieza y Desinfección (L+D)</option>
                  <option>Mantenimiento Equipos</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Responsable de actuación"
                  value={incForm.responsable}
                  onChange={(e) => setIncForm({ ...incForm, responsable: e.target.value })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Descripción de la incidencia *"
                  value={incForm.descripcion}
                  onChange={(e) => setIncForm({ ...incForm, descripcion: e.target.value })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Acción correctora aplicada *"
                  value={incForm.medidaCorrectora}
                  onChange={(e) => setIncForm({ ...incForm, medidaCorrectora: e.target.value })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={incForm.estado}
                  onChange={(e) => setIncForm({ ...incForm, estado: e.target.value as any })}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg bg-white"
                >
                  <option value="En seguimiento">En seguimiento</option>
                  <option value="Resuelta">Resuelta</option>
                </select>
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Incidencia</span>
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-2.5 font-semibold">FECHA</th>
                    <th className="p-2.5 font-semibold">INCIDENCIA</th>
                    <th className="p-2.5 font-semibold">ACCIÓN CORRECTORA</th>
                    <th className="p-2.5 font-semibold">RESPONSABLE DE ACTUACIÓN</th>
                    <th className="p-2.5 font-semibold">ESTADO</th>
                    <th className="p-2.5 text-right font-semibold">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {appccIncidencias.map((inc) => (
                    <tr key={inc.id} className="hover:bg-stone-50">
                      <td className="p-2.5 tabular-nums font-semibold whitespace-nowrap">{inc.fecha}</td>
                      <td className="p-2.5">
                        <div className="font-semibold text-stone-900">{inc.planAfectado}</div>
                        <div className="text-stone-700">{inc.descripcion}</div>
                      </td>
                      <td className="p-2.5 text-stone-700">{inc.medidaCorrectora}</td>
                      <td className="p-2.5 text-stone-700">{inc.responsable}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            updateAppccIncidencia(inc.id, {
                              estado: inc.estado === 'Resuelta' ? 'En seguimiento' : 'Resuelta',
                            })
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            inc.estado === 'Resuelta'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inc.estado}
                        </button>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => deleteAppccIncidencia(inc.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: DIAGRAMA DE FLUJO ACTUALIZADO, CUADRO PCC Y LOTEADO            */}
      {/* ===================================================================== */}
      {activeSection === 'flujo_pcc' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
              <div>
                <h3 className="text-lg font-bold font-serif-wine text-stone-900">
                  Diagrama de Flujo Actualizado (SO₂, Raspón, Bagazo, Sin Ascórbico)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Adición de SO₂ en despalillado/estrujado, fin maloláctica y antes de embotellar · Salidas de raspón y bagazo a finca para compostar.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFlowWineType('tinto')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    flowWineType === 'tinto' ? 'bg-rose-900 text-white' : 'text-stone-600'
                  }`}
                >
                  Vino Tinto
                </button>
                <button
                  type="button"
                  onClick={() => setFlowWineType('blanco')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    flowWineType === 'blanco' ? 'bg-emerald-800 text-white' : 'text-stone-600'
                  }`}
                >
                  Vino Blanco
                </button>
              </div>
            </div>

            <div className="space-y-2 max-w-4xl mx-auto">
              {activeFlowSteps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(250px,0.7fr)] gap-3 items-center">
                    <div
                      className={`p-3.5 rounded-xl border ${
                        step.esPcc ? 'bg-[#faf8f5] border-stone-300' : 'bg-white border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-500 tabular-nums">
                          Fase {String(index + 1).padStart(2, '0')}
                        </span>
                        {step.esPcc && (
                          <span className="font-bold text-rose-900">Punto de Control (PCC)</span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-stone-900 mt-1">{step.titulo}</h4>
                      <p className="text-xs text-stone-600 mt-1">{step.detalle}</p>
                    </div>
                    {(step.adicionSO2 || step.subproductoSalida) ? (
                      <div className="space-y-2">
                        {step.adicionSO2 && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-amber-700 shrink-0" />
                            <div>
                              <span className="font-bold block">Entrada · SO₂</span>
                              <span>{step.adicionSO2}</span>
                            </div>
                          </div>
                        )}
                        {step.subproductoSalida && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-emerald-700 shrink-0" />
                            <div>
                              <span className="font-bold block">Salida Subproducto</span>
                              <span>{step.subproductoSalida}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="hidden lg:block" />
                    )}
                  </div>
                  {index < activeFlowSteps.length - 1 && (
                    <div className="flex justify-center lg:w-[58%] py-0.5">
                      <ArrowDown className="w-4 h-4 text-stone-400" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
              <h3 className="text-base font-bold font-serif-wine text-stone-900">
                Cuadro de Gestión APPCC (Sin Ácido Ascórbico)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-900 text-amber-200">
                      <th className="p-2.5">Fase</th>
                      <th className="p-2.5">PCC</th>
                      <th className="p-2.5">Límites Críticos</th>
                      <th className="p-2.5">Registros</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {APPCC_CUADRO_GESTION.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="p-2.5 font-bold text-stone-900">{row.fase}</td>
                        <td className="p-2.5 font-bold text-rose-900 whitespace-nowrap">{row.pcc}</td>
                        <td className="p-2.5 text-stone-700">{row.limitesCriticos}</td>
                        <td className="p-2.5 text-stone-600">{row.registros}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-rose-900" />
                <h3 className="text-base font-bold font-serif-wine text-stone-900">
                  Loteado Actual (Referencia Comercial)
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <select
                  value={simMarca}
                  onChange={(e) => setSimMarca(e.target.value as MarcaVino)}
                  className="px-2 py-2 border border-stone-300 rounded-lg bg-white font-semibold"
                >
                  {[...APPCC_PREFIJOS_LOTE]
                    .sort((a, b) => a.marca.localeCompare(b.marca, 'es', { sensitivity: 'base' }))
                    .map((m) => (
                      <option key={m.marca} value={m.marca}>
                        {m.marca} ({m.prefijo})
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={simNumEmb}
                  onChange={(e) => setSimNumEmb(Number(e.target.value))}
                  className="px-2 py-2 border border-stone-300 rounded-lg bg-white tabular-nums font-semibold"
                />
                <input
                  type="number"
                  min={2015}
                  max={2040}
                  value={simCosecha}
                  onChange={(e) => setSimCosecha(Number(e.target.value))}
                  className="px-2 py-2 border border-stone-300 rounded-lg bg-white tabular-nums font-semibold"
                />
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[11px] text-stone-500">Formato lote comercial (ej. L-X01/2024)</div>
                <div className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                  {formatLoteComercialAppcc(simMarca, simNumEmb, simCosecha)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

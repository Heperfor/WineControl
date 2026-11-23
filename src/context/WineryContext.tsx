import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialAnaliticas,
  initialAppccAgua,
  initialAppccIncidencias,
  initialAppccLimpieza,
  initialAppccPlagasMant,
  initialAppccProveedores,
  initialAppccResiduos,
  initialBodegaConfig,
  initialDepositos,
  initialElaboracion,
  initialEmbotellados,
  initialEntradasUva,
  initialInsumosMovimientos,
  initialParcelas,
  initialSalidas,
  initialAeatMateriasPrimas,
  initialAeatMateriasPrimasSumaAnterior,
  initialAeatProductoElaborado,
  initialMedioRuralL1Entradas,
  initialMedioRuralL1Salidas,
  initialMedioRuralL1SumaAnteriorEntradas,
  initialMedioRuralL1SumaAnteriorSalidas,
  initialMedioRuralL2Entradas,
  initialMedioRuralL2Salidas,
  initialMedioRuralL2SumaAnterior,
  initialMedioRuralL3Movimientos,
  initialMedioRuralL3SumaAnterior,
  initialMedioRuralL4Practicas,
  initialMedioRuralL5Procesos,
  initialFoggaDeclaraciones,
  initialInfoviDeclaraciones,
} from '../data/initialData';
import {
  AeatMateriaPrimaRegistro,
  AeatMateriaPrimaSumaAnterior,
  AeatProductoElaboradoRegistro,
  AnaliticaRegistro,
  AppccAguaRegistro,
  AppccIncidenciaRegistro,
  AppccLimpiezaRegistro,
  AppccPlagaMantenimientoRegistro,
  AppccProveedorRegistro,
  AppccResiduoRegistro,
  BodegaConfig,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  InsumoStockSummary,
  MedioRuralEmbotelladoEntradaRegistro,
  MedioRuralEmbotelladoSalidaRegistro,
  MedioRuralEmbotelladoSumaAnterior,
  MedioRuralEntradaRegistro,
  MedioRuralEntradaSalidaSuma,
  MedioRuralMovProductoSumaAnterior,
  MedioRuralMovimientoProductoRegistro,
  MedioRuralPracticaEnologicaRegistro,
  MedioRuralProcesoElaboracionRegistro,
  MedioRuralSalidaRegistro,
  MovimientoInsumo,
  Parcela,
  SalidaRegistro,
  TipoEtiqueta,
  TipoRecipiente,
  FoggaMr441bDeclaracion,
  InfoviDeclaracion,
  InfoviMesPeriodo,
} from '../types/winery';
import {
  buildLimpiezaForElaboracion,
  buildLimpiezaForEmbotellado,
  buildLimpiezaForEntradaUva,
  buildResiduoForEntradaUva,
  extractSuppliersFromInsumos,
  generateBackfillAguaUntilToday,
  generateScheduledAppccForMonth,
  getCategoriaZonaLd,
} from '../utils/appccAutomation';
import {
  buildAeatMateriaPrimaFromEntrada,
  buildAeatProductoFromElaboracion,
  buildAeatProductoFromEmbotellado,
  buildAeatProductoFromEntrada,
  buildAeatProductoFromSalida,
  recalculateProductoElaboradoBalances,
  shouldElaboracionBeInAeat,
  syncMateriasPrimasWithEntradas,
  syncProductoElaboradoWithBodega,
} from '../utils/aeatAutomation';
import {
  buildMedioRuralL1EntradaFromElab,
  buildMedioRuralL1EntradaFromVendimia,
  buildMedioRuralL1SalidaFromElab,
  buildMedioRuralL1SalidaFromEmbotellado,
  buildMedioRuralL2EntradaFromEmbotellado,
  buildMedioRuralL2SalidaFromSalida,
  buildMedioRuralL3FromElaboracion,
  buildMedioRuralL4FromElaboracion,
  buildMedioRuralL5FromElaboracion,
  buildMedioRuralL5FromEntrada,
  reindexLibro5Procesos,
  shouldElaboracionBeInLibro3,
  shouldElaboracionBeInLibro4,
  shouldElaboracionBeInLibro5,
  shouldElaboracionGenerateL1Entrada,
  shouldElaboracionGenerateL1Salida,
  syncMedioRuralLibro1,
  syncMedioRuralLibro2,
  syncMedioRuralLibro3,
  syncMedioRuralLibro4,
  syncMedioRuralLibro5,
} from '../utils/medioRuralAutomation';
import {
  generateFoggaDraftFromVendimia,
  generateInfoviDraftFromWinery,
  getInfoviPeriodBounds,
} from '../utils/foggaInfoviAutomation';
import { inferTipoVinoFromMarca, inferTipoVinoFromVarieties } from '../utils/wineType';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import {
  DirtyIdsMap,
  SYNC_TABLES,
  SyncTableName,
  WineryDatabaseState,
  pullAllFromSupabase,
  pushChangesToSupabase,
} from '../utils/supabaseSync';

const normalizeTipoRecipiente = (tipo: string): TipoRecipiente => {
  switch (tipo) {
    case 'Inox cerrado':
    case 'Barrica roble francés':
    case 'Barrica castaño':
    case 'Ánfora':
    case 'Inox':
    case 'Siempre lleno abierto':
      return tipo;
    case 'Acero Inox (Isotérmico)':
      return 'Inox cerrado';
    case 'Acero Inox (Siemprelleno)':
      return 'Siempre lleno abierto';
    case 'Barrica Roble Francés':
      return 'Barrica roble francés';
    case 'Barrica Roble Americano':
    case 'Tina de Roble':
      return 'Barrica castaño';
    case 'Tinaja de Barro / Cerámica':
      return 'Ánfora';
    default:
      return 'Inox';
  }
};

const LEGACY_DEP_ID_MAP: Record<string, string> = {
  'DEP-01': '1',
  'DEP-02': '2',
  'DEP-03': '14',
  'DEP-04': '10',
  'DEP-05': '3',
  'BAR-01': 'B1',
  'BAR-02': 'B2',
  'TIN-01': 'AN',
};

interface ReferentialCheckResult {
  canDelete: boolean;
  warning?: string;
  affectedCount: number;
  details: string[];
}

interface WineryContextType {
  bodegaConfig: BodegaConfig;
  updateBodegaConfig: (config: BodegaConfig) => void;

  parcelas: Parcela[];
  addParcela: (parcela: Omit<Parcela, 'id'>) => Parcela;
  updateParcela: (id: string, parcela: Partial<Parcela>) => void;
  deleteParcela: (id: string) => boolean;

  depositos: Deposito[];
  addDeposito: (deposito: Omit<Deposito, 'id'>) => Deposito;
  updateDeposito: (id: string, dep: Partial<Deposito>) => void;
  deleteDeposito: (id: string) => boolean;

  entradasUva: EntradaUva[];
  addEntradaUva: (entrada: Omit<EntradaUva, 'id' | 'fechaRegistro'>) => EntradaUva;
  updateEntradaUva: (id: string, entrada: Partial<EntradaUva>) => void;
  deleteEntradaUva: (id: string) => boolean;

  elaboraciones: ElaboracionRegistro[];
  addElaboracion: (elab: Omit<ElaboracionRegistro, 'id' | 'fechaRegistro'>) => ElaboracionRegistro;
  updateElaboracion: (id: string, elab: Partial<ElaboracionRegistro>) => void;
  deleteElaboracion: (id: string) => boolean;

  embotellados: EmbotelladoRegistro[];
  addEmbotellado: (emb: Omit<EmbotelladoRegistro, 'id' | 'fechaRegistro' | 'cantidadBotellas075' | 'botellasDisponibles'>) => EmbotelladoRegistro;
  updateEmbotellado: (id: string, emb: Partial<EmbotelladoRegistro>) => void;
  deleteEmbotellado: (id: string) => boolean;

  salidas: SalidaRegistro[];
  addSalida: (salida: Omit<SalidaRegistro, 'id' | 'fechaRegistro'>) => SalidaRegistro;
  updateSalida: (id: string, salida: Partial<SalidaRegistro>) => void;
  deleteSalida: (id: string) => boolean;

  insumosMovimientos: MovimientoInsumo[];
  addMovimientoInsumo: (mov: Omit<MovimientoInsumo, 'id' | 'fechaRegistro'>) => MovimientoInsumo;
  updateMovimientoInsumo: (id: string, mov: Partial<MovimientoInsumo>) => void;
  deleteMovimientoInsumo: (id: string) => boolean;

  insumoStockSummary: InsumoStockSummary;

  analiticas: AnaliticaRegistro[];
  addAnalitica: (analitica: Omit<AnaliticaRegistro, 'id' | 'fechaRegistro'>) => AnaliticaRegistro;
  addAnaliticasBatch: (items: Array<Omit<AnaliticaRegistro, 'id' | 'fechaRegistro'>>) => AnaliticaRegistro[];
  updateAnalitica: (id: string, updated: Partial<AnaliticaRegistro>) => void;
  deleteAnalitica: (id: string) => boolean;

  // Registros APPCC / Sanidad
  appccAgua: AppccAguaRegistro[];
  addAppccAgua: (item: Omit<AppccAguaRegistro, 'id' | 'fechaRegistro'>) => AppccAguaRegistro;
  updateAppccAgua: (id: string, updated: Partial<AppccAguaRegistro>) => void;
  deleteAppccAgua: (id: string) => boolean;

  appccLimpieza: AppccLimpiezaRegistro[];
  addAppccLimpieza: (item: Omit<AppccLimpiezaRegistro, 'id' | 'fechaRegistro'>) => AppccLimpiezaRegistro;
  updateAppccLimpieza: (id: string, updated: Partial<AppccLimpiezaRegistro>) => void;
  toggleAppccLimpiezaCelda: (fecha: string, zonaEquipo: string) => void;
  deleteAppccLimpieza: (id: string) => boolean;

  appccResiduos: AppccResiduoRegistro[];
  addAppccResiduo: (item: Omit<AppccResiduoRegistro, 'id' | 'fechaRegistro'>) => AppccResiduoRegistro;
  updateAppccResiduo: (id: string, updated: Partial<AppccResiduoRegistro>) => void;
  deleteAppccResiduo: (id: string) => boolean;

  appccPlagasMant: AppccPlagaMantenimientoRegistro[];
  addAppccPlagaMant: (item: Omit<AppccPlagaMantenimientoRegistro, 'id' | 'fechaRegistro'>) => AppccPlagaMantenimientoRegistro;
  updateAppccPlagaMant: (id: string, updated: Partial<AppccPlagaMantenimientoRegistro>) => void;
  deleteAppccPlagaMant: (id: string) => boolean;

  appccProveedores: AppccProveedorRegistro[];
  addAppccProveedor: (item: Omit<AppccProveedorRegistro, 'id' | 'fechaRegistro'>) => AppccProveedorRegistro;
  updateAppccProveedor: (id: string, updated: Partial<AppccProveedorRegistro>) => void;
  deleteAppccProveedor: (id: string) => boolean;

  appccIncidencias: AppccIncidenciaRegistro[];
  addAppccIncidencia: (item: Omit<AppccIncidenciaRegistro, 'id' | 'fechaRegistro'>) => AppccIncidenciaRegistro;
  updateAppccIncidencia: (id: string, updated: Partial<AppccIncidenciaRegistro>) => void;
  deleteAppccIncidencia: (id: string) => boolean;

  generarRegistrosMesAppcc: (yearMonth: string, onlyUpToToday?: boolean) => number;

  // Libros Agencia Tributaria (II.EE.)
  aeatSumaAnterior: AeatMateriaPrimaSumaAnterior;
  updateAeatSumaAnterior: (suma: AeatMateriaPrimaSumaAnterior) => void;
  aeatMateriasPrimas: AeatMateriaPrimaRegistro[];
  addAeatMateriaPrima: (item: Omit<AeatMateriaPrimaRegistro, 'id' | 'fechaRegistro'>) => AeatMateriaPrimaRegistro;
  updateAeatMateriaPrima: (id: string, updated: Partial<AeatMateriaPrimaRegistro>) => void;
  deleteAeatMateriaPrima: (id: string) => boolean;
  syncAeatMateriasPrimasFromVendimia: () => number;

  aeatProductoElaborado: AeatProductoElaboradoRegistro[];
  addAeatProductoElaborado: (item: Omit<AeatProductoElaboradoRegistro, 'id' | 'fechaRegistro'>) => AeatProductoElaboradoRegistro;
  updateAeatProductoElaborado: (id: string, updated: Partial<AeatProductoElaboradoRegistro>) => void;
  deleteAeatProductoElaborado: (id: string) => boolean;
  syncAeatProductoElaboradoFromBodega: () => number;

  // Libros Medio Rural (5 libros Xunta de Galicia)
  mrL1SumaEntradas: MedioRuralEntradaSalidaSuma;
  updateMrL1SumaEntradas: (suma: MedioRuralEntradaSalidaSuma) => void;
  mrL1SumaSalidas: MedioRuralEntradaSalidaSuma;
  updateMrL1SumaSalidas: (suma: MedioRuralEntradaSalidaSuma) => void;
  mrL1Entradas: MedioRuralEntradaRegistro[];
  addMrL1Entrada: (item: Omit<MedioRuralEntradaRegistro, 'id' | 'fechaRegistro'>) => MedioRuralEntradaRegistro;
  updateMrL1Entrada: (id: string, updated: Partial<MedioRuralEntradaRegistro>) => void;
  deleteMrL1Entrada: (id: string) => boolean;
  mrL1Salidas: MedioRuralSalidaRegistro[];
  addMrL1Salida: (item: Omit<MedioRuralSalidaRegistro, 'id' | 'fechaRegistro'>) => MedioRuralSalidaRegistro;
  updateMrL1Salida: (id: string, updated: Partial<MedioRuralSalidaRegistro>) => void;
  deleteMrL1Salida: (id: string) => boolean;

  mrL2SumaAnterior: MedioRuralEmbotelladoSumaAnterior;
  updateMrL2SumaAnterior: (suma: MedioRuralEmbotelladoSumaAnterior) => void;
  mrL2Entradas: MedioRuralEmbotelladoEntradaRegistro[];
  addMrL2Entrada: (item: Omit<MedioRuralEmbotelladoEntradaRegistro, 'id' | 'fechaRegistro'>) => MedioRuralEmbotelladoEntradaRegistro;
  updateMrL2Entrada: (id: string, updated: Partial<MedioRuralEmbotelladoEntradaRegistro>) => void;
  deleteMrL2Entrada: (id: string) => boolean;
  mrL2Salidas: MedioRuralEmbotelladoSalidaRegistro[];
  addMrL2Salida: (item: Omit<MedioRuralEmbotelladoSalidaRegistro, 'id' | 'fechaRegistro'>) => MedioRuralEmbotelladoSalidaRegistro;
  updateMrL2Salida: (id: string, updated: Partial<MedioRuralEmbotelladoSalidaRegistro>) => void;
  deleteMrL2Salida: (id: string) => boolean;

  mrL3SumaAnterior: MedioRuralMovProductoSumaAnterior;
  updateMrL3SumaAnterior: (suma: MedioRuralMovProductoSumaAnterior) => void;
  mrL3Movimientos: MedioRuralMovimientoProductoRegistro[];
  addMrL3Movimiento: (item: Omit<MedioRuralMovimientoProductoRegistro, 'id' | 'fechaRegistro'>) => MedioRuralMovimientoProductoRegistro;
  updateMrL3Movimiento: (id: string, updated: Partial<MedioRuralMovimientoProductoRegistro>) => void;
  deleteMrL3Movimiento: (id: string) => boolean;

  mrL4Practicas: MedioRuralPracticaEnologicaRegistro[];
  addMrL4Practica: (item: Omit<MedioRuralPracticaEnologicaRegistro, 'id' | 'fechaRegistro'>) => MedioRuralPracticaEnologicaRegistro;
  updateMrL4Practica: (id: string, updated: Partial<MedioRuralPracticaEnologicaRegistro>) => void;
  deleteMrL4Practica: (id: string) => boolean;

  mrL5Procesos: MedioRuralProcesoElaboracionRegistro[];
  addMrL5Proceso: (item: Omit<MedioRuralProcesoElaboracionRegistro, 'id' | 'fechaRegistro'>) => MedioRuralProcesoElaboracionRegistro;
  updateMrL5Proceso: (id: string, updated: Partial<MedioRuralProcesoElaboracionRegistro>) => void;
  deleteMrL5Proceso: (id: string) => boolean;

  syncMedioRuralLibro: (libro: 1 | 2 | 3 | 4 | 5) => number;

  // Declaraciones oficiales FOGGA (MR441B) e INFOVI (AICA)
  foggaDeclaraciones: FoggaMr441bDeclaracion[];
  upsertFoggaDeclaracion: (dec: FoggaMr441bDeclaracion) => FoggaMr441bDeclaracion;
  deleteFoggaDeclaracion: (id: string) => void;
  confirmarFoggaPresentada: (
    campanaInicio: number,
    numeroEntrada?: string,
    fechaPresentacion?: string
  ) => void;

  infoviDeclaraciones: InfoviDeclaracion[];
  upsertInfoviDeclaracion: (dec: InfoviDeclaracion) => InfoviDeclaracion;
  deleteInfoviDeclaracion: (id: string) => void;
  confirmarInfoviPresentada: (campanaInicio: number, mes: InfoviMesPeriodo) => void;

  // Integrity checks
  checkReferentialIntegrity: (
    entityType: 'parcela' | 'deposito' | 'entrada' | 'elaboracion' | 'embotellado' | 'salida',
    id: string
  ) => ReferentialCheckResult;

  // Cloud Sync (Supabase Web <-> Mobile)
  syncStatus: 'synced' | 'pending' | 'syncing' | 'error';
  hasPendingSync: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  isSupabaseReady: boolean;
  syncWithCloud: (forceAll?: boolean) => Promise<boolean>;

  // System management
  resetFloorPlanPositions: () => void;
  exportDatabaseJSON: () => string;
}

const STORAGE_KEY = 'adegatrace_db_v3_clean';

type SerializedSnapshot = {
  arrays: Partial<Record<SyncTableName, Map<string, string>>>;
  singletons: Record<string, string>;
};

const readStoredJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const hasAnyMapEntries = (map: DirtyIdsMap): boolean =>
  Object.values(map).some((ids) => Array.isArray(ids) && ids.length > 0);

const buildSerializedSnapshot = (s: WineryDatabaseState): SerializedSnapshot => {
  const toIdMap = <T extends { id: string }>(arr: T[]): Map<string, string> => {
    const map = new Map<string, string>();
    arr.forEach((item) => {
      map.set(item.id, JSON.stringify(item));
    });
    return map;
  };

  return {
    arrays: {
      parcelas: toIdMap(s.parcelas),
      depositos: toIdMap(s.depositos),
      entradas_uva: toIdMap(s.entradasUva),
      elaboraciones: toIdMap(s.elaboraciones),
      embotellados: toIdMap(s.embotellados),
      salidas: toIdMap(s.salidas),
      insumos_movimientos: toIdMap(s.insumosMovimientos),
      analiticas: toIdMap(s.analiticas),
      appcc_agua: toIdMap(s.appccAgua),
      appcc_limpieza: toIdMap(s.appccLimpieza),
      appcc_residuos: toIdMap(s.appccResiduos),
      appcc_plagas_mantenimiento: toIdMap(s.appccPlagasMant),
      appcc_proveedores: toIdMap(s.appccProveedores),
      appcc_incidencias: toIdMap(s.appccIncidencias),
      aeat_materias_primas: toIdMap(s.aeatMateriasPrimas),
      aeat_producto_elaborado: toIdMap(s.aeatProductoElaborado),
      mr_l1_entradas: toIdMap(s.mrL1Entradas),
      mr_l1_salidas: toIdMap(s.mrL1Salidas),
      mr_l2_entradas: toIdMap(s.mrL2Entradas),
      mr_l2_salidas: toIdMap(s.mrL2Salidas),
      mr_l3_movimientos: toIdMap(s.mrL3Movimientos),
      mr_l4_practicas: toIdMap(s.mrL4Practicas),
      mr_l5_procesos: toIdMap(s.mrL5Procesos),
      fogga_declaraciones: toIdMap(s.foggaDeclaraciones),
      infovi_declaraciones: toIdMap(s.infoviDeclaraciones),
    },
    singletons: {
      bodega_config: JSON.stringify(s.bodegaConfig),
      aeat_materias_primas_sumas: JSON.stringify(s.aeatSumaAnterior),
      mr_l1_sumas_entradas: JSON.stringify(s.mrL1SumaEntradas),
      mr_l1_sumas_salidas: JSON.stringify(s.mrL1SumaSalidas),
      mr_l2_sumas: JSON.stringify(s.mrL2SumaAnterior),
      mr_l3_sumas: JSON.stringify(s.mrL3SumaAnterior),
    },
  };
};

const WineryContext = createContext<WineryContextType | null>(null);

export const WineryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bodegaConfig, setBodegaConfig] = useState<BodegaConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_config`);
    if (!saved) return initialBodegaConfig;
    const parsed: BodegaConfig = JSON.parse(saved);
    if (parsed.nombreBodega === 'Adega Vinhas & Microparaxes') {
      return { ...parsed, nombreBodega: 'Adega Microparaxes' };
    }
    return parsed;
  });

  const [parcelas, setParcelas] = useState<Parcela[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_parcelas`);
    return saved ? JSON.parse(saved) : initialParcelas;
  });

  const [depositos, setDepositos] = useState<Deposito[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_depositos`);
    if (!saved) return initialDepositos;
    const parsed: Deposito[] = JSON.parse(saved);
    const hasFloorPlanCoords = parsed.some((d) => Boolean(d.plano));
    const looksLikeLegacyMock =
      !hasFloorPlanCoords &&
      parsed.every((d) => d.id in LEGACY_DEP_ID_MAP);

    if (looksLikeLegacyMock) {
      // Upgrade seamlessly to the 23 real floor-plan vessels while preserving user volumes
      const byNewId = new Map<string, Deposito>();
      parsed.forEach((oldDep) => {
        const mappedId = LEGACY_DEP_ID_MAP[oldDep.id];
        if (mappedId) byNewId.set(mappedId, oldDep);
      });
      return initialDepositos.map((baseDep) => {
        const prev = byNewId.get(baseDep.id);
        if (!prev) return baseDep;
        return {
          ...baseDep,
          litrosActuales: Math.min(baseDep.capacidadLitros, prev.litrosActuales),
          estado: prev.litrosActuales === 0 ? 'Vacío' : prev.estado,
          vinoNombre: prev.vinoNombre || baseDep.vinoNombre,
          variedades: prev.variedades?.length ? prev.variedades : baseDep.variedades,
          ultimaOperacion: prev.ultimaOperacion || baseDep.ultimaOperacion,
          fechaUltimaOperacion: prev.fechaUltimaOperacion || baseDep.fechaUltimaOperacion,
        };
      });
    }

    return parsed.map((d, idx) => {
      const baseMatch = initialDepositos.find((b) => b.id === d.id);
      return {
        ...d,
        tipoRecipiente: normalizeTipoRecipiente(d.tipoRecipiente),
        plano: d.plano || baseMatch?.plano || {
          x: 680 + (idx % 3) * 65,
          y: 300 + Math.floor(idx / 3) * 80,
          zona: 'nave',
          forma:
            normalizeTipoRecipiente(d.tipoRecipiente).includes('Barrica')
              ? 'barrica'
              : normalizeTipoRecipiente(d.tipoRecipiente) === 'Ánfora'
              ? 'anfora'
              : 'cilindro',
        },
      };
    });
  });

  const [entradasUva, setEntradasUva] = useState<EntradaUva[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_entradas`);
    if (!saved) return initialEntradasUva;
    const parsed: EntradaUva[] = JSON.parse(saved);
    return parsed.map((e) => ({
      ...e,
      depositoDestinoId: LEGACY_DEP_ID_MAP[e.depositoDestinoId] || e.depositoDestinoId,
      tipoRecipiente: normalizeTipoRecipiente(e.tipoRecipiente),
      tipoVino: e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre),
    }));
  });

  const [elaboraciones, setElaboraciones] = useState<ElaboracionRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_elaboraciones`);
    if (!saved) return initialElaboracion;
    const parsed: ElaboracionRegistro[] = JSON.parse(saved);
    return parsed.map((el) => ({
      ...el,
      depositoOrigenId: LEGACY_DEP_ID_MAP[el.depositoOrigenId] || el.depositoOrigenId,
      depositoDestinoId: el.depositoDestinoId
        ? LEGACY_DEP_ID_MAP[el.depositoDestinoId] || el.depositoDestinoId
        : undefined,
      tipoVino: el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades),
    }));
  });

  const [embotellados, setEmbotellados] = useState<EmbotelladoRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_embotellados`);
    if (!saved) return initialEmbotellados;
    const parsed: EmbotelladoRegistro[] = JSON.parse(saved);
    return parsed.map((emb) => ({
      ...emb,
      depositoProcedenciaId:
        LEGACY_DEP_ID_MAP[emb.depositoProcedenciaId] || emb.depositoProcedenciaId,
      tipoVino: emb.tipoVino || inferTipoVinoFromMarca(emb.marca),
    }));
  });

  const [salidas, setSalidas] = useState<SalidaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_salidas`);
    return saved ? JSON.parse(saved) : initialSalidas;
  });

  const [insumosMovimientos, setInsumosMovimientos] = useState<MovimientoInsumo[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_insumos`);
    return saved ? JSON.parse(saved) : initialInsumosMovimientos;
  });

  const [analiticas, setAnaliticas] = useState<AnaliticaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_analiticas`);
    return saved ? JSON.parse(saved) : initialAnaliticas;
  });

  const [appccAgua, setAppccAgua] = useState<AppccAguaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_agua`);
    if (!saved) return initialAppccAgua;
    const parsed: AppccAguaRegistro[] = JSON.parse(saved);
    return parsed.map((a) => ({
      ...a,
      lugarTomaMuestra: a.lugarTomaMuestra || 'Grifo zona elaboración',
      ph: typeof a.ph === 'number' ? a.ph : 7.2,
      aspecto: a.aspecto || (a.organolepticoConforme ? 'Limpio, incoloro, inodoro' : 'Revisar aspecto'),
    }));
  });

  const [appccLimpieza, setAppccLimpieza] = useState<AppccLimpiezaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_limpieza`);
    if (!saved) return initialAppccLimpieza;
    const parsed: AppccLimpiezaRegistro[] = JSON.parse(saved);
    const legacyZoneMap: Record<string, string> = {
      BARRICAS: 'B1',
      ÁNFORA: 'Ánfora1',
      ANFORA: 'Ánfora1',
      Nº4F: '4F',
      Nº5F: '5F',
      NºE1: 'E1',
      NºE2: 'E2',
      B3: 'B3 (160L)',
    };
    return parsed.map((item) => {
      const upper = item.zonaEquipo.toUpperCase();
      return legacyZoneMap[upper]
        ? { ...item, zonaEquipo: legacyZoneMap[upper] }
        : item;
    });
  });

  const [appccResiduos, setAppccResiduos] = useState<AppccResiduoRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_residuos`);
    return saved ? JSON.parse(saved) : initialAppccResiduos;
  });

  const [appccPlagasMant, setAppccPlagasMant] = useState<AppccPlagaMantenimientoRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_plagas_mant`);
    return saved ? JSON.parse(saved) : initialAppccPlagasMant;
  });

  const [appccProveedores, setAppccProveedores] = useState<AppccProveedorRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_proveedores`);
    return saved ? JSON.parse(saved) : initialAppccProveedores;
  });

  const [appccIncidencias, setAppccIncidencias] = useState<AppccIncidenciaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appcc_incidencias`);
    return saved ? JSON.parse(saved) : initialAppccIncidencias;
  });

  const [aeatSumaAnterior, setAeatSumaAnterior] = useState<AeatMateriaPrimaSumaAnterior>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_aeat_mp_suma`);
    return saved ? JSON.parse(saved) : initialAeatMateriasPrimasSumaAnterior;
  });

  const [aeatMateriasPrimas, setAeatMateriasPrimas] = useState<AeatMateriaPrimaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_aeat_mp`);
    return saved ? JSON.parse(saved) : initialAeatMateriasPrimas;
  });

  const [aeatProductoElaborado, setAeatProductoElaborado] = useState<AeatProductoElaboradoRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_aeat_pe`);
    return saved ? JSON.parse(saved) : initialAeatProductoElaborado;
  });

  // Medio Rural states
  const [mrL1SumaEntradas, setMrL1SumaEntradas] = useState<MedioRuralEntradaSalidaSuma>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l1_suma_ent`);
    return saved ? JSON.parse(saved) : initialMedioRuralL1SumaAnteriorEntradas;
  });
  const [mrL1SumaSalidas, setMrL1SumaSalidas] = useState<MedioRuralEntradaSalidaSuma>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l1_suma_sal`);
    return saved ? JSON.parse(saved) : initialMedioRuralL1SumaAnteriorSalidas;
  });
  const [mrL1Entradas, setMrL1Entradas] = useState<MedioRuralEntradaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l1_ent`);
    return saved ? JSON.parse(saved) : initialMedioRuralL1Entradas;
  });
  const [mrL1Salidas, setMrL1Salidas] = useState<MedioRuralSalidaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l1_sal`);
    return saved ? JSON.parse(saved) : initialMedioRuralL1Salidas;
  });

  const [mrL2SumaAnterior, setMrL2SumaAnterior] = useState<MedioRuralEmbotelladoSumaAnterior>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l2_suma`);
    return saved ? JSON.parse(saved) : initialMedioRuralL2SumaAnterior;
  });
  const [mrL2Entradas, setMrL2Entradas] = useState<MedioRuralEmbotelladoEntradaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l2_ent`);
    return saved ? JSON.parse(saved) : initialMedioRuralL2Entradas;
  });
  const [mrL2Salidas, setMrL2Salidas] = useState<MedioRuralEmbotelladoSalidaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l2_sal`);
    return saved ? JSON.parse(saved) : initialMedioRuralL2Salidas;
  });

  const [mrL3SumaAnterior, setMrL3SumaAnterior] = useState<MedioRuralMovProductoSumaAnterior>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l3_suma`);
    return saved ? JSON.parse(saved) : initialMedioRuralL3SumaAnterior;
  });
  const [mrL3Movimientos, setMrL3Movimientos] = useState<MedioRuralMovimientoProductoRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l3_mov`);
    return saved ? JSON.parse(saved) : initialMedioRuralL3Movimientos;
  });

  const [mrL4Practicas, setMrL4Practicas] = useState<MedioRuralPracticaEnologicaRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l4_pract`);
    return saved ? JSON.parse(saved) : initialMedioRuralL4Practicas;
  });

  const [mrL5Procesos, setMrL5Procesos] = useState<MedioRuralProcesoElaboracionRegistro[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mr_l5_proc`);
    return saved ? JSON.parse(saved) : initialMedioRuralL5Procesos;
  });

  // Declaraciones oficiales FOGGA MR441B e INFOVI AICA
  const [foggaDeclaraciones, setFoggaDeclaraciones] = useState<FoggaMr441bDeclaracion[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_fogga`);
    if (!saved) return initialFoggaDeclaraciones;
    try {
      const parsed = JSON.parse(saved) as FoggaMr441bDeclaracion[];
      const merged = [...parsed];
      initialFoggaDeclaraciones.forEach((seed) => {
        const idx = merged.findIndex(
          (item) => item.id === seed.id || item.campanaInicio === seed.campanaInicio
        );
        if (idx === -1) {
          merged.push(seed);
        } else if (!merged[idx].confirmadaPresentada && merged[idx].origenDatos !== 'importada_pdf') {
          merged[idx] = seed;
        }
      });
      return merged;
    } catch {
      return initialFoggaDeclaraciones;
    }
  });

  const [infoviDeclaraciones, setInfoviDeclaraciones] = useState<InfoviDeclaracion[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_infovi`);
    const todayIso = new Date().toISOString().slice(0, 10);
    const sanitizeUnopened = (list: InfoviDeclaracion[]) =>
      list.map((d) => {
        if (d.origenDatos === 'importada_pdf') return d;
        const b = getInfoviPeriodBounds(d.campanaInicio, d.mes);
        if (todayIso < b.filingOpen && d.confirmadaPresentada) {
          return {
            ...d,
            estado: 'borrador' as const,
            estadoInfovi: 'BORRADOR' as const,
            cerradoPor: '',
            confirmadaPresentada: false,
            fechaUltGrabacion: undefined,
            fechaRecepcion: undefined,
          };
        }
        return d;
      });
    if (!saved) return initialInfoviDeclaraciones;
    try {
      const parsed = JSON.parse(saved) as InfoviDeclaracion[];
      const merged = [...parsed];
      initialInfoviDeclaraciones.forEach((seed) => {
        const idx = merged.findIndex(
          (item) =>
            item.id === seed.id ||
            (item.campanaInicio === seed.campanaInicio && item.mes === seed.mes)
        );
        if (idx === -1) {
          merged.push(seed);
        } else if (!merged[idx].confirmadaPresentada && merged[idx].origenDatos !== 'importada_pdf') {
          merged[idx] = seed;
        }
      });
      return sanitizeUnopened(merged);
    } catch {
      return initialInfoviDeclaraciones;
    }
  });

  // Cloud Sync refs & state
  const initialDirtyIds = readStoredJson<DirtyIdsMap>(`${STORAGE_KEY}_dirty_ids`, {});
  const initialPendingDeletes = readStoredJson<DirtyIdsMap>(`${STORAGE_KEY}_pending_deletes`, {});

  const dirtyIdsRef = useRef<DirtyIdsMap>(initialDirtyIds);
  const pendingDeletesRef = useRef<DirtyIdsMap>(initialPendingDeletes);
  const isApplyingRemoteRef = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingResyncRef = useRef(false);
  const prevSnapshotRef = useRef<SerializedSnapshot | null>(null);
  const currentStateRef = useRef<WineryDatabaseState | null>(null);

  const [hasPendingSync, setHasPendingSync] = useState<boolean>(
    () => hasAnyMapEntries(initialDirtyIds) || hasAnyMapEntries(initialPendingDeletes)
  );
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'error'>(() =>
    hasAnyMapEntries(initialDirtyIds) || hasAnyMapEntries(initialPendingDeletes)
      ? 'pending'
      : 'synced'
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem(`${STORAGE_KEY}_last_sync`)
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const persistDirtyQueues = useCallback(() => {
    localStorage.setItem(`${STORAGE_KEY}_dirty_ids`, JSON.stringify(dirtyIdsRef.current));
    localStorage.setItem(`${STORAGE_KEY}_pending_deletes`, JSON.stringify(pendingDeletesRef.current));
    const pending =
      hasAnyMapEntries(dirtyIdsRef.current) || hasAnyMapEntries(pendingDeletesRef.current);
    setHasPendingSync(pending);
    if (pending && !isSyncingRef.current) {
      setSyncStatus('pending');
    }
  }, []);

  const applyRemoteState = useCallback(
    (remote: WineryDatabaseState, missingOptionalTables?: SyncTableName[]) => {
      isApplyingRemoteRef.current = true;
      setBodegaConfig(remote.bodegaConfig);
      setParcelas(remote.parcelas);
      setDepositos(
        remote.depositos.map((d, idx) => {
          const baseMatch = initialDepositos.find((b) => b.id === d.id);
          return {
            ...d,
            tipoRecipiente: normalizeTipoRecipiente(d.tipoRecipiente),
            plano: d.plano || baseMatch?.plano || {
              x: 680 + (idx % 3) * 65,
              y: 300 + Math.floor(idx / 3) * 80,
              zona: 'nave',
              forma: normalizeTipoRecipiente(d.tipoRecipiente).includes('Barrica')
                ? 'barrica'
                : normalizeTipoRecipiente(d.tipoRecipiente) === 'Ánfora'
                ? 'anfora'
                : 'cilindro',
            },
          };
        })
      );
      setEntradasUva(remote.entradasUva);
      setElaboraciones(remote.elaboraciones);
      setEmbotellados(remote.embotellados);
      setSalidas(remote.salidas);
      setInsumosMovimientos(remote.insumosMovimientos);
      setAnaliticas(remote.analiticas);
      setAppccAgua(remote.appccAgua);
      setAppccLimpieza(remote.appccLimpieza);
      setAppccResiduos(remote.appccResiduos);
      setAppccPlagasMant(remote.appccPlagasMant);
      setAppccProveedores(remote.appccProveedores);
      setAppccIncidencias(remote.appccIncidencias);
      setAeatSumaAnterior(remote.aeatSumaAnterior);
      setAeatMateriasPrimas(remote.aeatMateriasPrimas);
      setAeatProductoElaborado(remote.aeatProductoElaborado);
      setMrL1SumaEntradas(remote.mrL1SumaEntradas);
      setMrL1SumaSalidas(remote.mrL1SumaSalidas);
      setMrL1Entradas(remote.mrL1Entradas);
      setMrL1Salidas(remote.mrL1Salidas);
      setMrL2SumaAnterior(remote.mrL2SumaAnterior);
      setMrL2Entradas(remote.mrL2Entradas);
      setMrL2Salidas(remote.mrL2Salidas);
      setMrL3SumaAnterior(remote.mrL3SumaAnterior);
      setMrL3Movimientos(remote.mrL3Movimientos);
      setMrL4Practicas(remote.mrL4Practicas);
      setMrL5Procesos(remote.mrL5Procesos);
      if (
        !missingOptionalTables?.includes('fogga_declaraciones') &&
        remote.foggaDeclaraciones.length > 0
      ) {
        setFoggaDeclaraciones(remote.foggaDeclaraciones);
      }
      if (
        !missingOptionalTables?.includes('infovi_declaraciones') &&
        remote.infoviDeclaraciones.length > 0
      ) {
        setInfoviDeclaraciones(remote.infoviDeclaraciones);
      }
    },
    []
  );

  const syncWithCloud = useCallback(
    async (forceAll = false): Promise<boolean> => {
      if (!isSupabaseConfigured || !supabase) {
        setSyncStatus('error');
        setSyncError('Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
        return false;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus(
          hasAnyMapEntries(dirtyIdsRef.current) || hasAnyMapEntries(pendingDeletesRef.current)
            ? 'pending'
            : 'error'
        );
        setSyncError('Sin conexión a internet. Los cambios quedan guardados localmente.');
        return false;
      }

      if (isSyncingRef.current) {
        pendingResyncRef.current = true;
        return false;
      }

      isSyncingRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const snapshotDirty: DirtyIdsMap = {};
        const snapshotDeletes: DirtyIdsMap = {};
        SYNC_TABLES.forEach((t) => {
          if (dirtyIdsRef.current[t]?.length) snapshotDirty[t] = [...dirtyIdsRef.current[t]!];
          if (pendingDeletesRef.current[t]?.length) snapshotDeletes[t] = [...pendingDeletesRef.current[t]!];
        });

        const hasChanges = forceAll || hasAnyMapEntries(snapshotDirty) || hasAnyMapEntries(snapshotDeletes);

        if (hasChanges && currentStateRef.current) {
          const pushRes = await pushChangesToSupabase(
            currentStateRef.current,
            snapshotDirty,
            snapshotDeletes,
            forceAll
          );

          if (!pushRes.ok) {
            setSyncStatus('error');
            setSyncError(pushRes.errorMessage);
            return false;
          }

          // Clear only pushed IDs (preserve any new edits performed during async flight)
          SYNC_TABLES.forEach((t) => {
            if (forceAll) {
              dirtyIdsRef.current[t] = [];
              pendingDeletesRef.current[t] = [];
            } else {
              const pushedUpserts = new Set(snapshotDirty[t] || []);
              const pushedDeletes = new Set(snapshotDeletes[t] || []);
              if (dirtyIdsRef.current[t]?.length) {
                dirtyIdsRef.current[t] = dirtyIdsRef.current[t]!.filter((id) => !pushedUpserts.has(id));
              }
              if (pendingDeletesRef.current[t]?.length) {
                pendingDeletesRef.current[t] = pendingDeletesRef.current[t]!.filter(
                  (id) => !pushedDeletes.has(id)
                );
              }
            }
          });
          persistDirtyQueues();
        }

        const pullRes = await pullAllFromSupabase();
        if (!pullRes.ok) {
          setSyncStatus('error');
          setSyncError(pullRes.errorMessage);
          return false;
        }

        const stillDirty =
          hasAnyMapEntries(dirtyIdsRef.current) || hasAnyMapEntries(pendingDeletesRef.current);

        if (pullRes.state && !stillDirty) {
          applyRemoteState(pullRes.state, pullRes.missingOptionalTables);
        } else if (stillDirty) {
          pendingResyncRef.current = true;
        }

        const nowIso = new Date().toISOString();
        setLastSyncAt(nowIso);
        localStorage.setItem(`${STORAGE_KEY}_last_sync`, nowIso);
        setSyncError(null);
        setSyncStatus(stillDirty ? 'pending' : 'synced');
        return true;
      } finally {
        isSyncingRef.current = false;
        if (pendingResyncRef.current) {
          pendingResyncRef.current = false;
          setTimeout(() => {
            void syncWithCloud(false);
          }, 300);
        }
      }
    },
    [applyRemoteState, persistDirtyQueues]
  );

  // Persist to localStorage & track per-record dirty diffs for Supabase sync
  useEffect(() => {
    const stateObj: WineryDatabaseState = {
      bodegaConfig,
      parcelas,
      depositos,
      entradasUva,
      elaboraciones,
      embotellados,
      salidas,
      insumosMovimientos,
      analiticas,
      appccAgua,
      appccLimpieza,
      appccResiduos,
      appccPlagasMant,
      appccProveedores,
      appccIncidencias,
      aeatSumaAnterior,
      aeatMateriasPrimas,
      aeatProductoElaborado,
      mrL1SumaEntradas,
      mrL1SumaSalidas,
      mrL1Entradas,
      mrL1Salidas,
      mrL2SumaAnterior,
      mrL2Entradas,
      mrL2Salidas,
      mrL3SumaAnterior,
      mrL3Movimientos,
      mrL4Practicas,
      mrL5Procesos,
      foggaDeclaraciones,
      infoviDeclaraciones,
    };

    currentStateRef.current = stateObj;

    localStorage.setItem(`${STORAGE_KEY}_config`, JSON.stringify(bodegaConfig));
    localStorage.setItem(`${STORAGE_KEY}_parcelas`, JSON.stringify(parcelas));
    localStorage.setItem(`${STORAGE_KEY}_depositos`, JSON.stringify(depositos));
    localStorage.setItem(`${STORAGE_KEY}_entradas`, JSON.stringify(entradasUva));
    localStorage.setItem(`${STORAGE_KEY}_elaboraciones`, JSON.stringify(elaboraciones));
    localStorage.setItem(`${STORAGE_KEY}_embotellados`, JSON.stringify(embotellados));
    localStorage.setItem(`${STORAGE_KEY}_salidas`, JSON.stringify(salidas));
    localStorage.setItem(`${STORAGE_KEY}_insumos`, JSON.stringify(insumosMovimientos));
    localStorage.setItem(`${STORAGE_KEY}_analiticas`, JSON.stringify(analiticas));
    localStorage.setItem(`${STORAGE_KEY}_appcc_agua`, JSON.stringify(appccAgua));
    localStorage.setItem(`${STORAGE_KEY}_appcc_limpieza`, JSON.stringify(appccLimpieza));
    localStorage.setItem(`${STORAGE_KEY}_appcc_residuos`, JSON.stringify(appccResiduos));
    localStorage.setItem(`${STORAGE_KEY}_appcc_plagas_mant`, JSON.stringify(appccPlagasMant));
    localStorage.setItem(`${STORAGE_KEY}_appcc_proveedores`, JSON.stringify(appccProveedores));
    localStorage.setItem(`${STORAGE_KEY}_appcc_incidencias`, JSON.stringify(appccIncidencias));
    localStorage.setItem(`${STORAGE_KEY}_aeat_mp_suma`, JSON.stringify(aeatSumaAnterior));
    localStorage.setItem(`${STORAGE_KEY}_aeat_mp`, JSON.stringify(aeatMateriasPrimas));
    localStorage.setItem(`${STORAGE_KEY}_aeat_pe`, JSON.stringify(aeatProductoElaborado));
    localStorage.setItem(`${STORAGE_KEY}_mr_l1_suma_ent`, JSON.stringify(mrL1SumaEntradas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l1_suma_sal`, JSON.stringify(mrL1SumaSalidas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l1_ent`, JSON.stringify(mrL1Entradas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l1_sal`, JSON.stringify(mrL1Salidas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l2_suma`, JSON.stringify(mrL2SumaAnterior));
    localStorage.setItem(`${STORAGE_KEY}_mr_l2_ent`, JSON.stringify(mrL2Entradas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l2_sal`, JSON.stringify(mrL2Salidas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l3_suma`, JSON.stringify(mrL3SumaAnterior));
    localStorage.setItem(`${STORAGE_KEY}_mr_l3_mov`, JSON.stringify(mrL3Movimientos));
    localStorage.setItem(`${STORAGE_KEY}_mr_l4_pract`, JSON.stringify(mrL4Practicas));
    localStorage.setItem(`${STORAGE_KEY}_mr_l5_proc`, JSON.stringify(mrL5Procesos));
    localStorage.setItem(`${STORAGE_KEY}_fogga`, JSON.stringify(foggaDeclaraciones));
    localStorage.setItem(`${STORAGE_KEY}_infovi`, JSON.stringify(infoviDeclaraciones));

    const nextSnap = buildSerializedSnapshot(stateObj);

    if (isApplyingRemoteRef.current) {
      prevSnapshotRef.current = nextSnap;
      isApplyingRemoteRef.current = false;
      return;
    }

    if (!prevSnapshotRef.current) {
      prevSnapshotRef.current = nextSnap;
      return;
    }

    const prevSnap = prevSnapshotRef.current;
    let detectedChange = false;

    const addDirty = (table: SyncTableName, id: string) => {
      const curr = new Set(dirtyIdsRef.current[table] || []);
      curr.add(id);
      dirtyIdsRef.current[table] = Array.from(curr);
      if (pendingDeletesRef.current[table]?.length) {
        pendingDeletesRef.current[table] = pendingDeletesRef.current[table]!.filter((x) => x !== id);
      }
      detectedChange = true;
    };

    const addDelete = (table: SyncTableName, id: string) => {
      const curr = new Set(pendingDeletesRef.current[table] || []);
      curr.add(id);
      pendingDeletesRef.current[table] = Array.from(curr);
      if (dirtyIdsRef.current[table]?.length) {
        dirtyIdsRef.current[table] = dirtyIdsRef.current[table]!.filter((x) => x !== id);
      }
      detectedChange = true;
    };

    (Object.keys(nextSnap.arrays) as SyncTableName[]).forEach((table) => {
      const prevMap = prevSnap.arrays[table] || new Map<string, string>();
      const nextMap = nextSnap.arrays[table] || new Map<string, string>();

      nextMap.forEach((jsonVal, id) => {
        if (prevMap.get(id) !== jsonVal) {
          addDirty(table, id);
        }
      });

      prevMap.forEach((_jsonVal, id) => {
        if (!nextMap.has(id)) {
          addDelete(table, id);
        }
      });
    });

    if (prevSnap.singletons.bodega_config !== nextSnap.singletons.bodega_config) {
      addDirty('bodega_config', 'default');
    }
    if (
      prevSnap.singletons.aeat_materias_primas_sumas !==
      nextSnap.singletons.aeat_materias_primas_sumas
    ) {
      addDirty('aeat_materias_primas_sumas', 'default');
    }
    if (prevSnap.singletons.mr_l1_sumas_entradas !== nextSnap.singletons.mr_l1_sumas_entradas) {
      addDirty('mr_l1_sumas', 'entradas');
    }
    if (prevSnap.singletons.mr_l1_sumas_salidas !== nextSnap.singletons.mr_l1_sumas_salidas) {
      addDirty('mr_l1_sumas', 'salidas');
    }
    if (prevSnap.singletons.mr_l2_sumas !== nextSnap.singletons.mr_l2_sumas) {
      addDirty('mr_l2_sumas', 'default');
    }
    if (prevSnap.singletons.mr_l3_sumas !== nextSnap.singletons.mr_l3_sumas) {
      addDirty('mr_l3_sumas', 'default');
    }

    prevSnapshotRef.current = nextSnap;

    if (detectedChange) {
      persistDirtyQueues();
    }
  }, [
    bodegaConfig,
    parcelas,
    depositos,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
    insumosMovimientos,
    analiticas,
    appccAgua,
    appccLimpieza,
    appccResiduos,
    appccPlagasMant,
    appccProveedores,
    appccIncidencias,
    aeatSumaAnterior,
    aeatMateriasPrimas,
    aeatProductoElaborado,
    mrL1SumaEntradas,
    mrL1SumaSalidas,
    mrL1Entradas,
    mrL1Salidas,
    mrL2SumaAnterior,
    mrL2Entradas,
    mrL2Salidas,
    mrL3SumaAnterior,
    mrL3Movimientos,
    mrL4Practicas,
    mrL5Procesos,
    foggaDeclaraciones,
    infoviDeclaraciones,
    persistDirtyQueues,
  ]);

  // Debounced automatic push to Supabase whenever local changes are pending and online
  useEffect(() => {
    if (!hasPendingSync || !isSupabaseConfigured) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const timer = setTimeout(() => {
      void syncWithCloud(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [hasPendingSync, syncWithCloud, bodegaConfig, parcelas, depositos, entradasUva, elaboraciones, embotellados, salidas, insumosMovimientos, analiticas, appccAgua, appccLimpieza, appccResiduos, appccPlagasMant, appccProveedores, appccIncidencias, aeatSumaAnterior, aeatMateriasPrimas, aeatProductoElaborado, mrL1SumaEntradas, mrL1SumaSalidas, mrL1Entradas, mrL1Salidas, mrL2SumaAnterior, mrL2Entradas, mrL2Salidas, mrL3SumaAnterior, mrL3Movimientos, mrL4Practicas, mrL5Procesos, foggaDeclaraciones, infoviDeclaraciones]);

  // Initial cloud sync + online/focus listeners + Supabase Realtime listener across Web & Android
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const sb = supabase;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      void syncWithCloud(false);
    }

    const handleReconnectOrFocus = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void syncWithCloud(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleReconnectOrFocus();
      }
    };

    window.addEventListener('online', handleReconnectOrFocus);
    window.addEventListener('focus', handleReconnectOrFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = sb
      .channel('winery_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (realtimeTimer) clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
          if (!isSyncingRef.current) {
            void syncWithCloud(false);
          }
        }, 700);
      })
      .subscribe();

    return () => {
      window.removeEventListener('online', handleReconnectOrFocus);
      window.removeEventListener('focus', handleReconnectOrFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      void sb.removeChannel(channel);
    };
  }, [syncWithCloud]);

  // Dynamic stock calculation for packaging supplies (Insumos)
  const insumoStockSummary = useMemo<InsumoStockSummary>(() => {
    const summary: InsumoStockSummary = {
      corchos: {
        natural: 0,
        '1+1': 0,
      },
      botellas: {
        verde: 0,
        transparente: 0,
      },
      lacreKg: 0,
      etiquetas: {
        xouba: 0,
        congostras: 0,
        roucon: 0,
        fontan: 0,
        seixo: 0,
        palleiros: 0,
        rosado: 0,
      },
      cajas: {
        '2 botellas': 0,
        '3 botellas': 0,
        '6 botellas': 0,
      },
    };

    insumosMovimientos.forEach((mov) => {
      const multiplier = mov.movimiento === 'salida' ? -1 : 1;
      const cant = mov.cantidad * multiplier;

      if (mov.tipoInsumo === 'corchos') {
        if (mov.subtipo === 'natural') summary.corchos.natural += cant;
        else if (mov.subtipo === '1+1') summary.corchos['1+1'] += cant;
      } else if (mov.tipoInsumo === 'botellas') {
        if (mov.subtipo === 'verde') summary.botellas.verde += cant;
        else if (mov.subtipo === 'transparente') summary.botellas.transparente += cant;
      } else if (mov.tipoInsumo === 'lacre') {
        summary.lacreKg += cant;
      } else if (mov.tipoInsumo === 'etiquetas') {
        const key = mov.subtipo.toLowerCase() as TipoEtiqueta;
        if (key in summary.etiquetas) {
          summary.etiquetas[key] += cant;
        }
      } else if (mov.tipoInsumo === 'cajas') {
        if (mov.subtipo === '2 botellas') summary.cajas['2 botellas'] += cant;
        else if (mov.subtipo === '3 botellas') summary.cajas['3 botellas'] += cant;
        else if (mov.subtipo === '6 botellas') summary.cajas['6 botellas'] += cant;
      }
    });

    return summary;
  }, [insumosMovimientos]);

  // Recalculate available bottles whenever salidas change
  useEffect(() => {
    setEmbotellados((prev) => {
      let changed = false;
      const next = prev.map((emb) => {
        const totalSalidasParaEsteLote = salidas
          .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
          .reduce((sum, s) => sum + s.cantidadBotellas, 0);

        const disponible = Math.max(0, emb.cantidadBotellas075 - totalSalidasParaEsteLote);
        if (emb.botellasDisponibles !== disponible) {
          changed = true;
          return { ...emb, botellasDisponibles: disponible };
        }
        return emb;
      });
      return changed ? next : prev;
    });
  }, [salidas]);

  // Referential integrity check helper
  const checkReferentialIntegrity = (
    entityType: 'parcela' | 'deposito' | 'entrada' | 'elaboracion' | 'embotellado' | 'salida',
    id: string
  ): ReferentialCheckResult => {
    const details: string[] = [];

    if (entityType === 'parcela') {
      const entradasVinculadas = entradasUva.filter((e) => e.parcelaId === id);
      if (entradasVinculadas.length > 0) {
        details.push(
          `Tiene ${entradasVinculadas.length} entradas de uva asociadas (${entradasVinculadas.map((e) => e.id).join(', ')}).`
        );
        return {
          canDelete: false,
          warning: 'No se puede eliminar la parcela mientras tenga entradas de vendimia registradas. Elimine o reasigne primero esas entradas.',
          affectedCount: entradasVinculadas.length,
          details,
        };
      }
    }

    if (entityType === 'deposito') {
      const entradasEnDep = entradasUva.filter((e) => e.depositoDestinoId === id);
      const elabOrigen = elaboraciones.filter((e) => e.depositoOrigenId === id);
      const elabDest = elaboraciones.filter((e) => e.depositoDestinoId === id);
      const embProcedencia = embotellados.filter((e) => e.depositoProcedenciaId === id);

      const total = entradasEnDep.length + elabOrigen.length + elabDest.length + embProcedencia.length;
      if (total > 0) {
        if (entradasEnDep.length > 0) details.push(`${entradasEnDep.length} entradas de uva recibidas`);
        if (elabOrigen.length > 0) details.push(`${elabOrigen.length} operaciones como origen`);
        if (elabDest.length > 0) details.push(`${elabDest.length} operaciones como destino`);
        if (embProcedencia.length > 0) details.push(`${embProcedencia.length} embotellados realizados`);

        return {
          canDelete: false,
          warning: `El depósito contiene historial de trazabilidad activo (${details.join(', ')}). Vacíelo o elimine primero los registros vinculados.`,
          affectedCount: total,
          details,
        };
      }
    }

    if (entityType === 'embotellado') {
      const emb = embotellados.find((e) => e.id === id);
      if (emb) {
        const salidasLote = salidas.filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id);
        if (salidasLote.length > 0) {
          details.push(`${salidasLote.length} salidas/ventas registradas para el lote ${emb.lote}`);
          return {
            canDelete: false,
            warning: `No se puede eliminar el embotellado de lote "${emb.lote}" porque ya existen salidas/albaranes emitidos para este lote.`,
            affectedCount: salidasLote.length,
            details,
          };
        }
      }
    }

    return {
      canDelete: true,
      affectedCount: 0,
      details: [],
    };
  };

  // CRUD: BodegaConfig
  const updateBodegaConfig = (config: BodegaConfig) => {
    setBodegaConfig(config);
  };

  // CRUD: Parcelas
  const addParcela = (parcelaData: Omit<Parcela, 'id'>): Parcela => {
    const newId = `PARC-${String(parcelas.length + 1).padStart(2, '0')}`;
    const newParcela: Parcela = {
      ...parcelaData,
      id: newId,
    };
    setParcelas((prev) => [...prev, newParcela]);
    return newParcela;
  };

  const updateParcela = (id: string, updated: Partial<Parcela>) => {
    setParcelas((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newP = { ...p, ...updated };
          // Keep entradas in sync if parcel name changed
          if (updated.nombre && updated.nombre !== p.nombre) {
            setEntradasUva((oldEntradas) =>
              oldEntradas.map((e) => (e.parcelaId === id ? { ...e, parcelaNombre: updated.nombre! } : e))
            );
          }
          return newP;
        }
        return p;
      })
    );
  };

  const deleteParcela = (id: string): boolean => {
    const check = checkReferentialIntegrity('parcela', id);
    if (!check.canDelete) return false;
    setParcelas((prev) => prev.filter((p) => p.id !== id));
    return true;
  };

  // CRUD: Depositos
  const addDeposito = (depData: Omit<Deposito, 'id'>): Deposito => {
    const newId = depData.codigo.trim() || `DEP-${String(depositos.length + 1).padStart(2, '0')}`;
    const defaultForma =
      depData.tipoRecipiente.includes('Barrica')
        ? 'barrica'
        : depData.tipoRecipiente === 'Ánfora'
        ? 'anfora'
        : 'cilindro';
    const newDep: Deposito = {
      ...depData,
      id: newId,
      codigo: newId,
      plano: depData.plano || {
        x: 685,
        y: 360 + ((depositos.length % 4) * 70),
        zona: 'nave',
        forma: defaultForma,
      },
    };
    setDepositos((prev) => [...prev, newDep]);
    return newDep;
  };

  const updateDeposito = (id: string, updated: Partial<Deposito>) => {
    setDepositos((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
  };

  const deleteDeposito = (id: string): boolean => {
    const check = checkReferentialIntegrity('deposito', id);
    if (!check.canDelete) return false;
    setDepositos((prev) => prev.filter((d) => d.id !== id));
    return true;
  };

  // CRUD: Entradas de Uva
  const addEntradaUva = (entradaData: Omit<EntradaUva, 'id' | 'fechaRegistro'>): EntradaUva => {
    const year = new Date().getFullYear();
    const prefix = `ENT-${year}-`;
    const maxSeq = entradasUva.reduce((max, item) => {
      if (item.id.startsWith(prefix)) {
        const num = Number(item.id.slice(prefix.length));
        return Number.isFinite(num) && num > max ? num : max;
      }
      return max;
    }, 0);
    const newId = `${prefix}${String(Math.max(entradasUva.length, maxSeq) + 1).padStart(3, '0')}`;
    const newEntrada: EntradaUva = {
      ...entradaData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    setEntradasUva((prev) => [newEntrada, ...prev]);

    // Automatically update the destination tank's volume, varieties and state
    setDepositos((prev) =>
      prev.map((d) => {
        if (d.id === entradaData.depositoDestinoId) {
          const addedLiters =
            entradaData.litrosMosto ||
            (entradaData as any).litrosEstimadosMosto ||
            Math.round(entradaData.kgTotales * 0.68);
          const newTotalLiters = Math.min(d.capacidadLitros, (d.litrosActuales || 0) + addedLiters);

          // Update varieties breakdown
          const currentVarieties = [...(d.variedades || [])];
          entradaData.desgloseVariedades.forEach((v) => {
            const vLiters = Math.round((v.kg / (entradaData.kgTotales || 1)) * addedLiters);
            const idx = currentVarieties.findIndex(
              (cv) => cv.variedad.toLowerCase() === v.variedad.toLowerCase()
            );
            if (idx >= 0) {
              currentVarieties[idx].litros += vLiters;
            } else {
              currentVarieties.push({
                variedad: v.variedad,
                litros: vLiters,
                porcentaje: 0,
              });
            }
          });

          // Recalculate percentages
          const totalV = currentVarieties.reduce((sum, item) => sum + item.litros, 0) || 1;
          const updatedVars = currentVarieties.map((item) => ({
            ...item,
            porcentaje: Math.round((item.litros / totalV) * 100),
          }));

          return {
            ...d,
            litrosActuales: newTotalLiters,
            anoCosecha: entradaData.anada || d.anoCosecha,
            estado: d.estado === 'Vacío' ? 'Fermentación Alcohólica' : d.estado,
            variedades: updatedVars,
            ultimaOperacion: `Entrada uva vendimia (${entradaData.kgTotales} kg)`,
            fechaUltimaOperacion: entradaData.fecha,
          };
        }
        return d;
      })
    );

    // Trigger APPCC Automático: genera registros L+D para despalilladora, bombas, mangueras, depósito receptor (y prensa/suelo) + salida raspón a finca
    const responsableAppcc = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForEntradaUva(newEntrada, responsableAppcc);
    setAppccLimpieza((prev) => {
      const updatedPrev = prev.map((existing) => {
        const sameSlot = autoLd.find(
          (n) =>
            n.fecha === existing.fecha &&
            n.zonaEquipo.toUpperCase() === existing.zonaEquipo.toUpperCase()
        );
        if (
          sameSlot &&
          existing.origenAutomatico === 'Vendimia' &&
          !existing.editadoManualmente &&
          !existing.observaciones?.includes(newEntrada.id)
        ) {
          return {
            ...existing,
            observaciones: existing.observaciones
              ? `${existing.observaciones} · + ${newEntrada.id}: ${newEntrada.parcelaNombre} (${newEntrada.kgTotales} kg) → Dep. ${newEntrada.depositoDestinoId}`
              : sameSlot.observaciones,
          };
        }
        return existing;
      });

      const nuevos = autoLd.filter(
        (n) =>
          !updatedPrev.some(
            (e) =>
              e.fecha === n.fecha &&
              e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
          )
      );
      return [...nuevos, ...updatedPrev];
    });
    const autoRes = buildResiduoForEntradaUva(newEntrada, responsableAppcc);
    setAppccResiduos((prev) => [autoRes, ...prev]);

    // Trigger AEAT Automático: Libro de Materias Primas + Libro de Producto Elaborado
    setAeatMateriasPrimas((prev) => {
      if (prev.some((r) => r.origenEntradaId === newEntrada.id)) return prev;
      const nextOrder = prev.reduce((max, r) => Math.max(max, r.numeroOrden), 0) + 1;
      const newRow = buildAeatMateriaPrimaFromEntrada(newEntrada, nextOrder, bodegaConfig);
      return [...prev, newRow].sort((a, b) => a.numeroOrden - b.numeroOrden);
    });
    setAeatProductoElaborado((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newEntrada.id)) return prev;
      const newRow = buildAeatProductoFromEntrada(newEntrada, depositos, bodegaConfig);
      return recalculateProductoElaboradoBalances([...prev, newRow]);
    });

    // Trigger Medio Rural Automático: Libro 1 (Entradas) + Libro 5 (Procesos Elaboración)
    setMrL1Entradas((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newEntrada.id)) return prev;
      return [...prev, buildMedioRuralL1EntradaFromVendimia(newEntrada)].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
    });
    setMrL5Procesos((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newEntrada.id)) return prev;
      return reindexLibro5Procesos([...prev, buildMedioRuralL5FromEntrada(newEntrada)]);
    });

    return newEntrada;
  };

  const updateEntradaUva = (id: string, updated: Partial<EntradaUva>) => {
    const existing = entradasUva.find((e) => e.id === id);
    const mergedEntrada = existing ? { ...existing, ...updated } : null;
    const nextEntradas = entradasUva.map((e) => (e.id === id ? { ...e, ...updated } : e));

    setEntradasUva(nextEntradas);

    // Keep unedited APPCC L+D & AEAT trigger records synchronized when date, volume, or tank changes
    if (mergedEntrada) {
      const responsableAppcc = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
      const rebuiltLd = buildLimpiezaForEntradaUva(mergedEntrada, responsableAppcc);
      setAppccLimpieza((prev) => {
        const cleaned = prev.filter(
          (l) => !(l.referenciaOperacionId === id && !l.editadoManualmente)
        );
        const nuevos = rebuiltLd.filter(
          (n) =>
            !cleaned.some(
              (e) =>
                e.fecha === n.fecha &&
                e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
            )
        );
        return [...nuevos, ...cleaned];
      });

      setAeatMateriasPrimas((prev) =>
        syncMateriasPrimasWithEntradas(prev, nextEntradas, bodegaConfig, {
          addMissing: false,
          updateExisting: true,
        })
      );
      setAeatProductoElaborado((prev) =>
        syncProductoElaboradoWithBodega(
          prev,
          {
            entradasUva: nextEntradas,
            elaboraciones,
            embotellados,
            salidas,
            depositos,
            config: bodegaConfig,
          },
          { addMissing: false, updateExisting: true }
        )
      );

      // Sync Medio Rural Libro 1 & Libro 5
      setMrL1Entradas((prev) =>
        syncMedioRuralLibro1(
          prev,
          mrL1Salidas,
          { entradasUva: nextEntradas, elaboraciones, embotellados, depositos },
          { addMissing: false, updateExisting: true }
        ).entradas
      );
      setMrL5Procesos((prev) =>
        syncMedioRuralLibro5(
          prev,
          { entradasUva: nextEntradas, elaboraciones, depositos },
          { addMissing: false, updateExisting: true }
        )
      );
    }
  };

  const deleteEntradaUva = (id: string): boolean => {
    const entrada = entradasUva.find((e) => e.id === id);
    if (!entrada) return false;

    // Adjust destination tank volume downwards
    if (entrada.depositoDestinoId) {
      setDepositos((prev) =>
        prev.map((d) => {
          if (d.id === entrada.depositoDestinoId) {
            const removedLiters =
              entrada.litrosMosto ||
              (entrada as any).litrosEstimadosMosto ||
              Math.round(entrada.kgTotales * 0.68);
            const newLiters = Math.max(0, d.litrosActuales - removedLiters);
            return {
              ...d,
              litrosActuales: newLiters,
              estado: newLiters === 0 ? 'Vacío' : d.estado,
            };
          }
          return d;
        })
      );
    }

    const nextEntradas = entradasUva.filter((e) => e.id !== id);
    setEntradasUva(nextEntradas);
    setAppccLimpieza((prev) =>
      prev.filter((l) => !(l.referenciaOperacionId === id && !l.editadoManualmente))
    );
    setAppccResiduos((prev) =>
      prev.filter((r) => !(r.referenciaOperacionId === id && !r.editadoManualmente))
    );
    setAeatMateriasPrimas((prev) =>
      prev.filter((r) => !(r.origenEntradaId === id && !r.editadoManualmente))
    );
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    setMrL1Entradas((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL5Procesos((prev) =>
      reindexLibro5Procesos(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    return true;
  };

  // CRUD: Elaboración
  const addElaboracion = (
    elabData: Omit<ElaboracionRegistro, 'id' | 'fechaRegistro'>
  ): ElaboracionRegistro => {
    const newId = `ELAB-${new Date().getFullYear()}-${String(elaboraciones.length + 1).padStart(3, '0')}`;
    const newElab: ElaboracionRegistro = {
      ...elabData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    setElaboraciones((prev) => [newElab, ...prev]);

    // Update origin tank
    setDepositos((prev) =>
      prev.map((d) => {
        if (d.id === elabData.depositoOrigenId) {
          let newLitros = d.litrosActuales;
          if (elabData.destinoTipo === 'deposito' && elabData.depositoDestinoId !== d.id) {
            newLitros = Math.max(0, d.litrosActuales - elabData.cantidadLitros);
          } else if (elabData.destinoTipo === 'merma_limpieza') {
            newLitros = Math.max(0, d.litrosActuales - elabData.cantidadLitros);
          }

          let newEstado = d.estado;
          if (elabData.operacionRealizada.includes('Crianza')) newEstado = 'Crianza sobre lías';
          else if (elabData.operacionRealizada.includes('trasiego') || elabData.operacionRealizada.includes('Trasiego'))
            newEstado = 'Estabilización / Reposo';
          else if (elabData.operacionRealizada.includes('embotellar') || elabData.operacionRealizada.includes('abrillantado'))
            newEstado = 'Listo para embotellar';

          return {
            ...d,
            litrosActuales: newLitros,
            estado: newLitros === 0 ? 'Vacío' : newEstado,
            ultimaOperacion: elabData.operacionRealizada,
            fechaUltimaOperacion: elabData.fecha,
          };
        }

        // If transferred to another tank
        if (elabData.destinoTipo === 'deposito' && elabData.depositoDestinoId === d.id) {
          const newLitros = Math.min(d.capacidadLitros, d.litrosActuales + elabData.cantidadLitros);
          return {
            ...d,
            litrosActuales: newLitros,
            anoCosecha: elabData.anada || d.anoCosecha,
            estado: 'Estabilización / Reposo',
            ultimaOperacion: `Recepción trasiego desde ${elabData.depositoOrigenId}`,
            fechaUltimaOperacion: elabData.fecha,
          };
        }

        return d;
      })
    );

    // APPCC Automático: si es trasiego, desfangado, filtración, remontado o movimiento entre depósitos -> anotar depósito(s), bombas, mangueras, etc.
    const responsableAppcc = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForElaboracion(newElab, responsableAppcc);
    setAppccLimpieza((prev) => {
      const nuevos = autoLd.filter(
        (n) =>
          !prev.some(
            (e) =>
              e.fecha === n.fecha &&
              e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
          )
      );
      return [...nuevos, ...prev];
    });

    // Trigger AEAT Automático: trasiegos entre depósitos y mermas/pérdidas en Libro de Producto Elaborado
    if (shouldElaboracionBeInAeat(newElab)) {
      setAeatProductoElaborado((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        const newRow = buildAeatProductoFromElaboracion(newElab, depositos, bodegaConfig);
        return recalculateProductoElaboradoBalances([...prev, newRow]);
      });
    }

    // Trigger Medio Rural Automático: Libros 1, 3, 4 y 5 según operación
    if (shouldElaboracionGenerateL1Entrada(newElab)) {
      setMrL1Entradas((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        return [...prev, buildMedioRuralL1EntradaFromElab(newElab, depositos)].sort((a, b) =>
          a.data.localeCompare(b.data)
        );
      });
    }
    if (shouldElaboracionGenerateL1Salida(newElab)) {
      setMrL1Salidas((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        return [...prev, buildMedioRuralL1SalidaFromElab(newElab, depositos)].sort((a, b) =>
          a.data.localeCompare(b.data)
        );
      });
    }
    if (shouldElaboracionBeInLibro3(newElab)) {
      setMrL3Movimientos((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        return [...prev, buildMedioRuralL3FromElaboracion(newElab, bodegaConfig)].sort((a, b) =>
          a.data.localeCompare(b.data)
        );
      });
    }
    if (shouldElaboracionBeInLibro4(newElab)) {
      setMrL4Practicas((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        return [...prev, buildMedioRuralL4FromElaboracion(newElab, depositos)].sort((a, b) =>
          a.data.localeCompare(b.data)
        );
      });
    }
    if (shouldElaboracionBeInLibro5(newElab)) {
      setMrL5Procesos((prev) => {
        if (prev.some((r) => r.origenMovimientoId === newElab.id)) return prev;
        return reindexLibro5Procesos([
          ...prev,
          buildMedioRuralL5FromElaboracion(newElab, depositos),
        ]);
      });
    }

    return newElab;
  };

  const updateElaboracion = (id: string, updated: Partial<ElaboracionRegistro>) => {
    const nextElabs = elaboraciones.map((el) => (el.id === id ? { ...el, ...updated } : el));
    setElaboraciones(nextElabs);

    const edited = nextElabs.find((el) => el.id === id);
    if (edited) {
      setAeatProductoElaborado((prev) => {
        const hasRow = prev.some((r) => r.origenMovimientoId === id);
        if (shouldElaboracionBeInAeat(edited)) {
          if (!hasRow) {
            const newRow = buildAeatProductoFromElaboracion(edited, depositos, bodegaConfig);
            return recalculateProductoElaboradoBalances([...prev, newRow]);
          }
          return syncProductoElaboradoWithBodega(
            prev,
            {
              entradasUva,
              elaboraciones: nextElabs,
              embotellados,
              salidas,
              depositos,
              config: bodegaConfig,
            },
            { addMissing: false, updateExisting: true }
          );
        }
        return recalculateProductoElaboradoBalances(
          prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
        );
      });

      // Sync Medio Rural Libros 1, 3, 4 y 5
      const l1Synced = syncMedioRuralLibro1(
        mrL1Entradas,
        mrL1Salidas,
        { entradasUva, elaboraciones: nextElabs, embotellados, depositos },
        { addMissing: true, updateExisting: true, pruneDeleted: true }
      );
      setMrL1Entradas(l1Synced.entradas);
      setMrL1Salidas(l1Synced.salidas);
      setMrL3Movimientos((prev) =>
        syncMedioRuralLibro3(
          prev,
          { elaboraciones: nextElabs, config: bodegaConfig },
          { addMissing: true, updateExisting: true, pruneDeleted: true }
        )
      );
      setMrL4Practicas((prev) =>
        syncMedioRuralLibro4(
          prev,
          { elaboraciones: nextElabs, depositos },
          { addMissing: true, updateExisting: true, pruneDeleted: true }
        )
      );
      setMrL5Procesos((prev) =>
        syncMedioRuralLibro5(
          prev,
          { entradasUva, elaboraciones: nextElabs, depositos },
          { addMissing: true, updateExisting: true, pruneDeleted: true }
        )
      );
    }
  };

  const deleteElaboracion = (id: string): boolean => {
    setElaboraciones((prev) => prev.filter((el) => el.id !== id));
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    setMrL1Entradas((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL1Salidas((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL3Movimientos((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL4Practicas((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL5Procesos((prev) =>
      reindexLibro5Procesos(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    return true;
  };

  // CRUD: Embotellados (Automatic bottle calculation 0.75L + Supplies deduction + Tank decrease)
  const addEmbotellado = (
    embData: Omit<EmbotelladoRegistro, 'id' | 'fechaRegistro' | 'cantidadBotellas075' | 'botellasDisponibles'>
  ): EmbotelladoRegistro => {
    const newId = `EMB-${new Date().getFullYear()}-${String(embotellados.length + 1).padStart(3, '0')}`;
    // Automatic bottles 0.75 calculation
    const botellasCalc = Math.floor(embData.cantidadLitros / 0.75);

    const newEmb: EmbotelladoRegistro = {
      ...embData,
      id: newId,
      cantidadBotellas075: botellasCalc,
      botellasDisponibles: botellasCalc,
      fechaRegistro: new Date().toISOString(),
    };

    setEmbotellados((prev) => [newEmb, ...prev]);

    // 1. Discount liters from origin tank
    setDepositos((prev) =>
      prev.map((d) => {
        if (d.id === embData.depositoProcedenciaId) {
          const rest = Math.max(0, d.litrosActuales - embData.cantidadLitros);
          return {
            ...d,
            litrosActuales: rest,
            estado: rest === 0 ? 'Vacío' : d.estado,
            ultimaOperacion: `Embotellado Lote ${embData.lote} (${botellasCalc} bot)`,
            fechaUltimaOperacion: embData.fecha,
          };
        }
        return d;
      })
    );

    // 2. Automatically generate supply deductions (movimientos de insumos)
    const newSupplyMovements: MovimientoInsumo[] = [];

    // Corks
    if (embData.insumos.tipoCorcho) {
      newSupplyMovements.push({
        id: `INS-OUT-${Date.now()}-1`,
        fecha: embData.fecha,
        tipoInsumo: 'corchos',
        subtipo: embData.insumos.tipoCorcho,
        movimiento: 'salida',
        cantidad: botellasCalc,
        embotelladoLoteAsociado: embData.lote,
        observaciones: `Consumo automático embotellado lote ${embData.lote}`,
        fechaRegistro: new Date().toISOString(),
      });
    }

    // Bottles
    if (embData.insumos.tipoBotella) {
      newSupplyMovements.push({
        id: `INS-OUT-${Date.now()}-2`,
        fecha: embData.fecha,
        tipoInsumo: 'botellas',
        subtipo: embData.insumos.tipoBotella,
        movimiento: 'salida',
        cantidad: botellasCalc,
        embotelladoLoteAsociado: embData.lote,
        observaciones: `Consumo automático embotellado lote ${embData.lote}`,
        fechaRegistro: new Date().toISOString(),
      });
    }

    // Labels (only if labeled = true)
    if (embData.etiquetado && embData.insumos.tipoEtiqueta) {
      newSupplyMovements.push({
        id: `INS-OUT-${Date.now()}-3`,
        fecha: embData.fecha,
        tipoInsumo: 'etiquetas',
        subtipo: embData.insumos.tipoEtiqueta,
        movimiento: 'salida',
        cantidad: botellasCalc,
        embotelladoLoteAsociado: embData.lote,
        observaciones: `Etiquetas marca ${embData.insumos.tipoEtiqueta} para lote ${embData.lote}`,
        fechaRegistro: new Date().toISOString(),
      });
    }

    // Boxes
    if (embData.insumos.cajasUtilizadas && embData.insumos.cajasUtilizadas > 0) {
      newSupplyMovements.push({
        id: `INS-OUT-${Date.now()}-4`,
        fecha: embData.fecha,
        tipoInsumo: 'cajas',
        subtipo: embData.insumos.tipoCaja,
        movimiento: 'salida',
        cantidad: embData.insumos.cajasUtilizadas,
        embotelladoLoteAsociado: embData.lote,
        observaciones: `Cajas ${embData.insumos.tipoCaja} usadas en lote ${embData.lote}`,
        fechaRegistro: new Date().toISOString(),
      });
    }

    if (newSupplyMovements.length > 0) {
      setInsumosMovimientos((prev) => [...newSupplyMovements, ...prev]);
    }

    // APPCC Automático: embotellado registra limpieza de llenadora, corchadora, bombas, mangueras, depósito y suelo
    const responsableAppcc = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForEmbotellado(newEmb, responsableAppcc);
    setAppccLimpieza((prev) => {
      const nuevos = autoLd.filter(
        (n) =>
          !prev.some(
            (e) =>
              e.fecha === n.fecha &&
              e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
          )
      );
      return [...nuevos, ...prev];
    });

    // Trigger AEAT Automático: Embotellado en Libro de Producto Elaborado
    setAeatProductoElaborado((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newEmb.id)) return prev;
      const newRow = buildAeatProductoFromEmbotellado(newEmb, bodegaConfig);
      return recalculateProductoElaboradoBalances([...prev, newRow]);
    });

    // Trigger Medio Rural Automático: Libro 1 (Saídas) + Libro 2 (Entradas Embotellados)
    setMrL1Salidas((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newEmb.id)) return prev;
      return [...prev, buildMedioRuralL1SalidaFromEmbotellado(newEmb)].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
    });
    setMrL2Entradas((prev) => {
      if (prev.some((r) => r.origenEmbotelladoId === newEmb.id)) return prev;
      return [...prev, buildMedioRuralL2EntradaFromEmbotellado(newEmb)].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
    });

    return newEmb;
  };

  const updateEmbotellado = (id: string, updated: Partial<EmbotelladoRegistro>) => {
    const nextEmbotellados = embotellados.map((emb) => {
      if (emb.id === id) {
        const newLitros = updated.cantidadLitros ?? emb.cantidadLitros;
        const newBotellas = updated.cantidadBotellas075 ?? Math.floor(newLitros / 0.75);
        return {
          ...emb,
          ...updated,
          cantidadLitros: newLitros,
          cantidadBotellas075: newBotellas,
        };
      }
      return emb;
    });
    setEmbotellados(nextEmbotellados);
    setAeatProductoElaborado((prev) =>
      syncProductoElaboradoWithBodega(
        prev,
        {
          entradasUva,
          elaboraciones,
          embotellados: nextEmbotellados,
          salidas,
          depositos,
          config: bodegaConfig,
        },
        { addMissing: false, updateExisting: true }
      )
    );
    setMrL1Salidas((prev) =>
      syncMedioRuralLibro1(
        mrL1Entradas,
        prev,
        { entradasUva, elaboraciones, embotellados: nextEmbotellados, depositos },
        { addMissing: false, updateExisting: true }
      ).salidas
    );
    setMrL2Entradas((prev) =>
      syncMedioRuralLibro2(
        prev,
        mrL2Salidas,
        { embotellados: nextEmbotellados, salidas },
        { addMissing: false, updateExisting: true }
      ).entradas
    );
  };

  const deleteEmbotellado = (id: string): boolean => {
    const check = checkReferentialIntegrity('embotellado', id);
    if (!check.canDelete) return false;

    const emb = embotellados.find((e) => e.id === id);
    if (emb) {
      // Revert supply movements for this lot
      setInsumosMovimientos((prev) => prev.filter((m) => m.embotelladoLoteAsociado !== emb.lote));

      // Revert liters back to origin tank if it exists
      if (emb.depositoProcedenciaId) {
        setDepositos((prev) =>
          prev.map((d) => {
            if (d.id === emb.depositoProcedenciaId) {
              return {
                ...d,
                litrosActuales: Math.min(d.capacidadLitros, d.litrosActuales + emb.cantidadLitros),
              };
            }
            return d;
          })
        );
      }
    }

    setEmbotellados((prev) => prev.filter((e) => e.id !== id));
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    setMrL1Salidas((prev) =>
      prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    setMrL2Entradas((prev) =>
      prev.filter((r) => !(r.origenEmbotelladoId === id && !r.editadoManualmente))
    );
    return true;
  };

  // CRUD: Salidas
  const addSalida = (salidaData: Omit<SalidaRegistro, 'id' | 'fechaRegistro'>): SalidaRegistro => {
    const newId = `SAL-${new Date().getFullYear()}-${String(salidas.length + 1).padStart(3, '0')}`;
    const newSalida: SalidaRegistro = {
      ...salidaData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    setSalidas((prev) => [newSalida, ...prev]);

    // Trigger AEAT Automático: Salida / Expedición en Libro de Producto Elaborado
    setAeatProductoElaborado((prev) => {
      if (prev.some((r) => r.origenMovimientoId === newSalida.id)) return prev;
      const newRow = buildAeatProductoFromSalida(newSalida, embotellados);
      return recalculateProductoElaboradoBalances([...prev, newRow]);
    });

    // Trigger Medio Rural Automático: Libro 2 Saídas Embotellados
    setMrL2Salidas((prev) => {
      if (prev.some((r) => r.origenSalidaId === newSalida.id)) return prev;
      return [...prev, buildMedioRuralL2SalidaFromSalida(newSalida)].sort((a, b) =>
        a.data.localeCompare(b.data)
      );
    });

    return newSalida;
  };

  const updateSalida = (id: string, updated: Partial<SalidaRegistro>) => {
    const nextSalidas = salidas.map((s) => (s.id === id ? { ...s, ...updated } : s));
    setSalidas(nextSalidas);
    setAeatProductoElaborado((prev) =>
      syncProductoElaboradoWithBodega(
        prev,
        {
          entradasUva,
          elaboraciones,
          embotellados,
          salidas: nextSalidas,
          depositos,
          config: bodegaConfig,
        },
        { addMissing: false, updateExisting: true }
      )
    );
    setMrL2Salidas((prev) =>
      syncMedioRuralLibro2(
        mrL2Entradas,
        prev,
        { embotellados, salidas: nextSalidas },
        { addMissing: false, updateExisting: true }
      ).salidas
    );
  };

  const deleteSalida = (id: string): boolean => {
    setSalidas((prev) => prev.filter((s) => s.id !== id));
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(
        prev.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
      )
    );
    setMrL2Salidas((prev) =>
      prev.filter((r) => !(r.origenSalidaId === id && !r.editadoManualmente))
    );
    return true;
  };

  // CRUD: Insumos
  const addMovimientoInsumo = (
    movData: Omit<MovimientoInsumo, 'id' | 'fechaRegistro'>
  ): MovimientoInsumo => {
    const newId = `INS-${Date.now()}`;
    const newMov: MovimientoInsumo = {
      ...movData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    setInsumosMovimientos((prev) => [newMov, ...prev]);

    // Sincronizar proveedor en Plan Control Proveedores APPCC si aún no existe
    if (movData.proveedor && movData.proveedor.trim()) {
      setAppccProveedores((prev) => {
        const nuevos = extractSuppliersFromInsumos([newMov], prev);
        return nuevos.length > 0 ? [...nuevos, ...prev] : prev;
      });
    }

    return newMov;
  };

  const updateMovimientoInsumo = (id: string, updated: Partial<MovimientoInsumo>) => {
    setInsumosMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
  };

  const deleteMovimientoInsumo = (id: string): boolean => {
    setInsumosMovimientos((prev) => prev.filter((m) => m.id !== id));
    return true;
  };

  // CRUD: Analíticas internas (no aparecen en trazabilidad ni libros oficiales)
  const addAnalitica = (
    data: Omit<AnaliticaRegistro, 'id' | 'fechaRegistro'>
  ): AnaliticaRegistro => {
    const newItem: AnaliticaRegistro = {
      ...data,
      id: `ANA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAnaliticas((prev) => [newItem, ...prev]);
    return newItem;
  };

  const addAnaliticasBatch = (
    items: Array<Omit<AnaliticaRegistro, 'id' | 'fechaRegistro'>>
  ): AnaliticaRegistro[] => {
    const now = Date.now();
    const created: AnaliticaRegistro[] = items.map((item, idx) => ({
      ...item,
      id: `ANA-${now}-${idx}`,
      fechaRegistro: new Date().toISOString(),
    }));
    setAnaliticas((prev) => [...created, ...prev]);
    return created;
  };

  const updateAnalitica = (id: string, updated: Partial<AnaliticaRegistro>) => {
    setAnaliticas((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  };

  const deleteAnalitica = (id: string): boolean => {
    setAnaliticas((prev) => prev.filter((a) => a.id !== id));
    return true;
  };

  // CRUD: APPCC Sanidad
  const addAppccAgua = (item: Omit<AppccAguaRegistro, 'id' | 'fechaRegistro'>): AppccAguaRegistro => {
    const created: AppccAguaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `APPCC-AG-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccAgua((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccAgua = (id: string, updated: Partial<AppccAguaRegistro>) => {
    setAppccAgua((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...updated, editadoManualmente: true } : x))
    );
  };

  const deleteAppccAgua = (id: string): boolean => {
    setAppccAgua((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const addAppccLimpieza = (item: Omit<AppccLimpiezaRegistro, 'id' | 'fechaRegistro'>): AppccLimpiezaRegistro => {
    const created: AppccLimpiezaRegistro = {
      ...item,
      categoria: item.categoria || getCategoriaZonaLd(item.zonaEquipo),
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `APPCC-LD-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccLimpieza((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccLimpieza = (id: string, updated: Partial<AppccLimpiezaRegistro>) => {
    setAppccLimpieza((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...updated, editadoManualmente: true } : x))
    );
  };

  const toggleAppccLimpiezaCelda = (fecha: string, zonaEquipo: string) => {
    const zonaUpper = zonaEquipo.toUpperCase();
    const existente = appccLimpieza.find(
      (l) => l.fecha === fecha && l.zonaEquipo.toUpperCase() === zonaUpper
    );
    if (!existente) {
      const created: AppccLimpiezaRegistro = {
        id: `APPCC-LD-CELL-${Date.now()}-${zonaUpper}`,
        fecha,
        categoria: getCategoriaZonaLd(zonaUpper),
        zonaEquipo: zonaUpper,
        productoUsado:
          getCategoriaZonaLd(zonaUpper) === 'DEPOSITOS'
            ? 'Sosa cáustica diluida + aclarado abundante'
            : getCategoriaZonaLd(zonaUpper) === 'MAQUINARIA'
            ? 'Agua potable a presión / solución alimentaria'
            : 'Detergente / desinfectante alimentario',
        conforme: true,
        responsable: bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso',
        origenAutomatico: 'Manual',
        editadoManualmente: true,
        observaciones: 'Marcado manualmente desde matriz L+D.',
        fechaRegistro: new Date().toISOString(),
      };
      setAppccLimpieza((prev) => [created, ...prev]);
    } else if (existente.conforme) {
      setAppccLimpieza((prev) =>
        prev.map((x) =>
          x.id === existente.id
            ? {
                ...x,
                conforme: false,
                editadoManualmente: true,
                observaciones: x.observaciones
                  ? `${x.observaciones} (Marcado incidencia manual)`
                  : 'Marcado incidencia manual en matriz L+D',
              }
            : x
        )
      );
    } else {
      setAppccLimpieza((prev) => prev.filter((x) => x.id !== existente.id));
    }
  };

  const deleteAppccLimpieza = (id: string): boolean => {
    setAppccLimpieza((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const addAppccResiduo = (item: Omit<AppccResiduoRegistro, 'id' | 'fechaRegistro'>): AppccResiduoRegistro => {
    const created: AppccResiduoRegistro = {
      ...item,
      conforme: item.conforme ?? true,
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `APPCC-RES-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccResiduos((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccResiduo = (id: string, updated: Partial<AppccResiduoRegistro>) => {
    setAppccResiduos((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...updated, editadoManualmente: true } : x))
    );
  };

  const deleteAppccResiduo = (id: string): boolean => {
    setAppccResiduos((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const addAppccPlagaMant = (
    item: Omit<AppccPlagaMantenimientoRegistro, 'id' | 'fechaRegistro'>
  ): AppccPlagaMantenimientoRegistro => {
    const created: AppccPlagaMantenimientoRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `APPCC-PM-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccPlagasMant((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccPlagaMant = (
    id: string,
    updated: Partial<AppccPlagaMantenimientoRegistro>
  ) => {
    setAppccPlagasMant((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...updated, editadoManualmente: true } : x))
    );
  };

  const deleteAppccPlagaMant = (id: string): boolean => {
    setAppccPlagasMant((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const addAppccProveedor = (
    item: Omit<AppccProveedorRegistro, 'id' | 'fechaRegistro'>
  ): AppccProveedorRegistro => {
    const created: AppccProveedorRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `APPCC-PROV-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccProveedores((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccProveedor = (id: string, updated: Partial<AppccProveedorRegistro>) => {
    setAppccProveedores((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...updated, editadoManualmente: true } : x))
    );
  };

  const deleteAppccProveedor = (id: string): boolean => {
    setAppccProveedores((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const addAppccIncidencia = (
    item: Omit<AppccIncidenciaRegistro, 'id' | 'fechaRegistro'>
  ): AppccIncidenciaRegistro => {
    const created: AppccIncidenciaRegistro = {
      ...item,
      id: `APPCC-INC-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAppccIncidencias((prev) => [created, ...prev]);
    return created;
  };

  const updateAppccIncidencia = (id: string, updated: Partial<AppccIncidenciaRegistro>) => {
    setAppccIncidencias((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
  };

  const deleteAppccIncidencia = (id: string): boolean => {
    setAppccIncidencias((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const generarRegistrosMesAppcc = (yearMonth: string, onlyUpToToday = false): number => {
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return 0;

    const responsableAppcc = bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    let addedTotal = 0;

    // 1. Sync unlogged operational records from entradasUva, elaboraciones, embotellados
    const opLdCandidates: AppccLimpiezaRegistro[] = [];
    entradasUva.forEach((ent) => {
      if (ent.fecha.startsWith(yearMonth)) {
        opLdCandidates.push(...buildLimpiezaForEntradaUva(ent, responsableAppcc));
      }
    });
    elaboraciones.forEach((el) => {
      if (el.fecha.startsWith(yearMonth)) {
        opLdCandidates.push(...buildLimpiezaForElaboracion(el, responsableAppcc));
      }
    });
    embotellados.forEach((emb) => {
      if (emb.fecha.startsWith(yearMonth)) {
        opLdCandidates.push(...buildLimpiezaForEmbotellado(emb, responsableAppcc));
      }
    });

    // 2. Scheduled frequencies (Agua mensual RD 3/2023 + backfill hasta hoy, L+D semanal/mensual, DDD mensual, Mantenimiento anual)
    const { newAgua, newLimpieza, newPlagasMant } = generateScheduledAppccForMonth({
      year,
      month,
      existingAgua: appccAgua,
      existingLimpieza: [...opLdCandidates, ...appccLimpieza],
      existingPlagasMant: appccPlagasMant,
      responsable: responsableAppcc,
      onlyUpToToday,
    });

    const backfillAgua = generateBackfillAguaUntilToday({
      existingAgua: [...newAgua, ...appccAgua],
      startYearMonth: '2024-09',
      responsable: responsableAppcc,
    });
    const totalNewAgua = [...newAgua, ...backfillAgua];

    const missingOpLd = opLdCandidates.filter(
      (cand) =>
        !appccLimpieza.some(
          (ex) =>
            ex.fecha === cand.fecha &&
            ex.zonaEquipo.toUpperCase() === cand.zonaEquipo.toUpperCase()
        )
    );

    // Deduplicate combined missing L+D
    const combinedNewLd: AppccLimpiezaRegistro[] = [];
    [...missingOpLd, ...newLimpieza].forEach((item) => {
      const dup =
        appccLimpieza.some(
          (ex) =>
            ex.fecha === item.fecha &&
            ex.zonaEquipo.toUpperCase() === item.zonaEquipo.toUpperCase()
        ) ||
        combinedNewLd.some(
          (ex) =>
            ex.fecha === item.fecha &&
            ex.zonaEquipo.toUpperCase() === item.zonaEquipo.toUpperCase()
        );
      if (!dup) combinedNewLd.push(item);
    });

    if (totalNewAgua.length > 0) {
      setAppccAgua((prev) =>
        [...totalNewAgua, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha))
      );
      addedTotal += totalNewAgua.length;
    }
    if (combinedNewLd.length > 0) {
      setAppccLimpieza((prev) => [...combinedNewLd, ...prev]);
      addedTotal += combinedNewLd.length;
    }
    if (newPlagasMant.length > 0) {
      setAppccPlagasMant((prev) => [...newPlagasMant, ...prev]);
      addedTotal += newPlagasMant.length;
    }

    // 3. Ensure suppliers from insumos are present
    const missingProv = extractSuppliersFromInsumos(insumosMovimientos, appccProveedores);
    if (missingProv.length > 0) {
      setAppccProveedores((prev) => [...missingProv, ...prev]);
      addedTotal += missingProv.length;
    }

    return addedTotal;
  };

  // CRUD: Libros Agencia Tributaria (II.EE.)
  const updateAeatSumaAnterior = (suma: AeatMateriaPrimaSumaAnterior) => {
    setAeatSumaAnterior(suma);
  };

  const addAeatMateriaPrima = (
    item: Omit<AeatMateriaPrimaRegistro, 'id' | 'fechaRegistro'>
  ): AeatMateriaPrimaRegistro => {
    const created: AeatMateriaPrimaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      id: `AEAT-MP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAeatMateriasPrimas((prev) =>
      [...prev, created].sort((a, b) => a.numeroOrden - b.numeroOrden)
    );
    return created;
  };

  const updateAeatMateriaPrima = (
    id: string,
    updated: Partial<AeatMateriaPrimaRegistro>
  ) => {
    setAeatMateriasPrimas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.numeroOrden - b.numeroOrden)
    );
  };

  const deleteAeatMateriaPrima = (id: string): boolean => {
    setAeatMateriasPrimas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const syncAeatMateriasPrimasFromVendimia = (): number => {
    const next = syncMateriasPrimasWithEntradas(
      aeatMateriasPrimas,
      entradasUva,
      bodegaConfig,
      {
        addMissing: true,
        updateExisting: true,
      }
    );
    const addedCount = Math.max(0, next.length - aeatMateriasPrimas.length);
    setAeatMateriasPrimas(next);
    return addedCount;
  };

  const addAeatProductoElaborado = (
    item: Omit<AeatProductoElaboradoRegistro, 'id' | 'fechaRegistro'>
  ): AeatProductoElaboradoRegistro => {
    const created: AeatProductoElaboradoRegistro = {
      ...item,
      origenTipo: item.origenTipo || 'manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `AEAT-PE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances([...prev, created])
    );
    return created;
  };

  const updateAeatProductoElaborado = (
    id: string,
    updated: Partial<AeatProductoElaboradoRegistro>
  ) => {
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(
        prev.map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
      )
    );
  };

  const deleteAeatProductoElaborado = (id: string): boolean => {
    setAeatProductoElaborado((prev) =>
      recalculateProductoElaboradoBalances(prev.filter((r) => r.id !== id))
    );
    return true;
  };

  const syncAeatProductoElaboradoFromBodega = (): number => {
    const next = syncProductoElaboradoWithBodega(
      aeatProductoElaborado,
      {
        entradasUva,
        elaboraciones,
        embotellados,
        salidas,
        depositos,
        config: bodegaConfig,
      },
      { addMissing: true, updateExisting: true }
    );
    const addedCount = Math.max(0, next.length - aeatProductoElaborado.length);
    setAeatProductoElaborado(next);
    return addedCount;
  };

  // CRUD: Libros Medio Rural (Xunta de Galicia)
  const updateMrL1SumaEntradas = (suma: MedioRuralEntradaSalidaSuma) => {
    setMrL1SumaEntradas(suma);
  };

  const updateMrL1SumaSalidas = (suma: MedioRuralEntradaSalidaSuma) => {
    setMrL1SumaSalidas(suma);
  };

  const addMrL1Entrada = (
    item: Omit<MedioRuralEntradaRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralEntradaRegistro => {
    const created: MedioRuralEntradaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L1-ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL1Entradas((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL1Entrada = (id: string, updated: Partial<MedioRuralEntradaRegistro>) => {
    setMrL1Entradas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL1Entrada = (id: string): boolean => {
    setMrL1Entradas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const addMrL1Salida = (
    item: Omit<MedioRuralSalidaRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralSalidaRegistro => {
    const created: MedioRuralSalidaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L1-SAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL1Salidas((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL1Salida = (id: string, updated: Partial<MedioRuralSalidaRegistro>) => {
    setMrL1Salidas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL1Salida = (id: string): boolean => {
    setMrL1Salidas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const updateMrL2SumaAnterior = (suma: MedioRuralEmbotelladoSumaAnterior) => {
    setMrL2SumaAnterior(suma);
  };

  const addMrL2Entrada = (
    item: Omit<MedioRuralEmbotelladoEntradaRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralEmbotelladoEntradaRegistro => {
    const created: MedioRuralEmbotelladoEntradaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L2-ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL2Entradas((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL2Entrada = (
    id: string,
    updated: Partial<MedioRuralEmbotelladoEntradaRegistro>
  ) => {
    setMrL2Entradas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL2Entrada = (id: string): boolean => {
    setMrL2Entradas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const addMrL2Salida = (
    item: Omit<MedioRuralEmbotelladoSalidaRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralEmbotelladoSalidaRegistro => {
    const created: MedioRuralEmbotelladoSalidaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L2-SAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL2Salidas((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL2Salida = (
    id: string,
    updated: Partial<MedioRuralEmbotelladoSalidaRegistro>
  ) => {
    setMrL2Salidas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL2Salida = (id: string): boolean => {
    setMrL2Salidas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const updateMrL3SumaAnterior = (suma: MedioRuralMovProductoSumaAnterior) => {
    setMrL3SumaAnterior(suma);
  };

  const addMrL3Movimiento = (
    item: Omit<MedioRuralMovimientoProductoRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralMovimientoProductoRegistro => {
    const created: MedioRuralMovimientoProductoRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L3-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL3Movimientos((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL3Movimiento = (
    id: string,
    updated: Partial<MedioRuralMovimientoProductoRegistro>
  ) => {
    setMrL3Movimientos((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL3Movimiento = (id: string): boolean => {
    setMrL3Movimientos((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const addMrL4Practica = (
    item: Omit<MedioRuralPracticaEnologicaRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralPracticaEnologicaRegistro => {
    const created: MedioRuralPracticaEnologicaRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L4-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL4Practicas((prev) => [...prev, created].sort((a, b) => a.data.localeCompare(b.data)));
    return created;
  };

  const updateMrL4Practica = (
    id: string,
    updated: Partial<MedioRuralPracticaEnologicaRegistro>
  ) => {
    setMrL4Practicas((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
        .sort((a, b) => a.data.localeCompare(b.data))
    );
  };

  const deleteMrL4Practica = (id: string): boolean => {
    setMrL4Practicas((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  const addMrL5Proceso = (
    item: Omit<MedioRuralProcesoElaboracionRegistro, 'id' | 'fechaRegistro'>
  ): MedioRuralProcesoElaboracionRegistro => {
    const created: MedioRuralProcesoElaboracionRegistro = {
      ...item,
      origenAutomatico: item.origenAutomatico || 'Manual',
      editadoManualmente: item.editadoManualmente ?? true,
      id: `MR-L5-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fechaRegistro: new Date().toISOString(),
    };
    setMrL5Procesos((prev) => reindexLibro5Procesos([...prev, created]));
    return created;
  };

  const updateMrL5Proceso = (
    id: string,
    updated: Partial<MedioRuralProcesoElaboracionRegistro>
  ) => {
    setMrL5Procesos((prev) =>
      reindexLibro5Procesos(
        prev.map((r) => (r.id === id ? { ...r, ...updated, editadoManualmente: true } : r))
      )
    );
  };

  const deleteMrL5Proceso = (id: string): boolean => {
    setMrL5Procesos((prev) => reindexLibro5Procesos(prev.filter((r) => r.id !== id)));
    return true;
  };

  const syncMedioRuralLibro = (libro: 1 | 2 | 3 | 4 | 5): number => {
    if (libro === 1) {
      const next = syncMedioRuralLibro1(
        mrL1Entradas,
        mrL1Salidas,
        { entradasUva, elaboraciones, embotellados, depositos },
        { addMissing: true, updateExisting: true }
      );
      const added =
        Math.max(0, next.entradas.length - mrL1Entradas.length) +
        Math.max(0, next.salidas.length - mrL1Salidas.length);
      setMrL1Entradas(next.entradas);
      setMrL1Salidas(next.salidas);
      return added;
    }
    if (libro === 2) {
      const next = syncMedioRuralLibro2(
        mrL2Entradas,
        mrL2Salidas,
        { embotellados, salidas },
        { addMissing: true, updateExisting: true }
      );
      const added =
        Math.max(0, next.entradas.length - mrL2Entradas.length) +
        Math.max(0, next.salidas.length - mrL2Salidas.length);
      setMrL2Entradas(next.entradas);
      setMrL2Salidas(next.salidas);
      return added;
    }
    if (libro === 3) {
      const next = syncMedioRuralLibro3(
        mrL3Movimientos,
        { elaboraciones, config: bodegaConfig },
        { addMissing: true, updateExisting: true }
      );
      const added = Math.max(0, next.length - mrL3Movimientos.length);
      setMrL3Movimientos(next);
      return added;
    }
    if (libro === 4) {
      const next = syncMedioRuralLibro4(
        mrL4Practicas,
        { elaboraciones, depositos },
        { addMissing: true, updateExisting: true }
      );
      const added = Math.max(0, next.length - mrL4Practicas.length);
      setMrL4Practicas(next);
      return added;
    }
    const next = syncMedioRuralLibro5(
      mrL5Procesos,
      { entradasUva, elaboraciones, depositos },
      { addMissing: true, updateExisting: true }
    );
    const added = Math.max(0, next.length - mrL5Procesos.length);
    setMrL5Procesos(next);
    return added;
  };

  // ---------------- DECLARACIONES FOGGA (MR441B) E INFOVI (AICA) ----------------
  const upsertFoggaDeclaracion = (dec: FoggaMr441bDeclaracion): FoggaMr441bDeclaracion => {
    setFoggaDeclaraciones((prev) => {
      const idx = prev.findIndex((item) => item.id === dec.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = dec;
        return copy;
      }
      return [dec, ...prev].sort((a, b) => b.campanaInicio - a.campanaInicio);
    });
    return dec;
  };

  const deleteFoggaDeclaracion = (id: string) => {
    setFoggaDeclaraciones((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmarFoggaPresentada = (
    campanaInicio: number,
    numeroEntrada?: string,
    fechaPresentacion?: string
  ) => {
    const today = fechaPresentacion || new Date().toISOString().slice(0, 10);
    setFoggaDeclaraciones((prev) => {
      const existing = prev.find((d) => d.campanaInicio === campanaInicio);
      if (existing) {
        return prev.map((d) =>
          d.campanaInicio === campanaInicio
            ? {
                ...d,
                estado: 'presentada',
                confirmadaPresentada: true,
                fechaPresentacion: d.fechaPresentacion || today,
                numeroEntrada: numeroEntrada || d.numeroEntrada,
              }
            : d
        );
      }
      const { declaracion } = generateFoggaDraftFromVendimia(campanaInicio, {
        entradasUva,
        parcelas,
        bodegaConfig,
        existingFogga: prev,
      });
      return [
        {
          ...declaracion,
          estado: 'presentada' as const,
          confirmadaPresentada: true,
          fechaPresentacion: today,
          numeroEntrada: numeroEntrada || declaracion.numeroEntrada,
        },
        ...prev,
      ].sort((a, b) => b.campanaInicio - a.campanaInicio);
    });
  };

  const upsertInfoviDeclaracion = (dec: InfoviDeclaracion): InfoviDeclaracion => {
    setInfoviDeclaraciones((prev) => {
      const idx = prev.findIndex((item) => item.id === dec.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = dec;
        return copy;
      }
      return [dec, ...prev].sort((a, b) => {
        if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
        return a.mes === 'JULIO' ? -1 : 1;
      });
    });
    return dec;
  };

  const deleteInfoviDeclaracion = (id: string) => {
    setInfoviDeclaraciones((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmarInfoviPresentada = (campanaInicio: number, mes: InfoviMesPeriodo) => {
    const today = new Date().toISOString().slice(0, 10);
    setInfoviDeclaraciones((prev) => {
      const existing = prev.find(
        (d) => d.campanaInicio === campanaInicio && d.mes === mes
      );
      if (existing) {
        return prev.map((d) =>
          d.id === existing.id
            ? {
                ...d,
                estado: 'presentada',
                estadoInfovi: 'CERRADA',
                cerradoPor: d.cerradoPor || 'INSTALACIÓN',
                confirmadaPresentada: true,
                fechaUltGrabacion: d.fechaUltGrabacion || today,
                fechaRecepcion: d.fechaRecepcion || today,
              }
            : d
        );
      }
      const { declaracion } = generateInfoviDraftFromWinery(campanaInicio, mes, {
        entradasUva,
        elaboraciones,
        embotellados,
        salidas,
        depositos,
        parcelas,
        bodegaConfig,
        existingInfovi: prev,
      });
      return [
        {
          ...declaracion,
          estado: 'presentada' as const,
          estadoInfovi: 'CERRADA' as const,
          cerradoPor: 'INSTALACIÓN',
          confirmadaPresentada: true,
          fechaUltGrabacion: today,
          fechaRecepcion: today,
        },
        ...prev,
      ].sort((a, b) => {
        if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
        return a.mes === 'JULIO' ? -1 : 1;
      });
    });
  };

  const resetFloorPlanPositions = () => {
    setDepositos((prev) =>
      prev.map((d, idx) => {
        const base = initialDepositos.find((b) => b.id === d.id);
        if (base?.plano) {
          return { ...d, plano: base.plano };
        }
        return {
          ...d,
          plano: {
            x: 685,
            y: 310 + (idx % 5) * 70,
            zona: 'nave',
            forma:
              d.tipoRecipiente.includes('Barrica')
                ? 'barrica'
                : d.tipoRecipiente === 'Ánfora'
                ? 'anfora'
                : 'cilindro',
          },
        };
      })
    );
  };

  // Export full JSON database backup
  const exportDatabaseJSON = (): string => {
    const dbBackup = {
      version: '3.1',
      exportDate: new Date().toISOString(),
      bodegaConfig,
      parcelas,
      depositos,
      entradasUva,
      elaboraciones,
      embotellados,
      salidas,
      insumosMovimientos,
      analiticas,
      appccAgua,
      appccLimpieza,
      appccResiduos,
      appccPlagasMant,
      appccProveedores,
      appccIncidencias,
      aeatSumaAnterior,
      aeatMateriasPrimas,
      aeatProductoElaborado,
      mrL1SumaEntradas,
      mrL1SumaSalidas,
      mrL1Entradas,
      mrL1Salidas,
      mrL2SumaAnterior,
      mrL2Entradas,
      mrL2Salidas,
      mrL3SumaAnterior,
      mrL3Movimientos,
      mrL4Practicas,
      mrL5Procesos,
      foggaDeclaraciones,
      infoviDeclaraciones,
    };
    return JSON.stringify(dbBackup, null, 2);
  };

  return (
    <WineryContext.Provider
      value={{
        bodegaConfig,
        updateBodegaConfig,
        parcelas,
        addParcela,
        updateParcela,
        deleteParcela,
        depositos,
        addDeposito,
        updateDeposito,
        deleteDeposito,
        entradasUva,
        addEntradaUva,
        updateEntradaUva,
        deleteEntradaUva,
        elaboraciones,
        addElaboracion,
        updateElaboracion,
        deleteElaboracion,
        embotellados,
        addEmbotellado,
        updateEmbotellado,
        deleteEmbotellado,
        salidas,
        addSalida,
        updateSalida,
        deleteSalida,
        insumosMovimientos,
        addMovimientoInsumo,
        updateMovimientoInsumo,
        deleteMovimientoInsumo,
        insumoStockSummary,
        analiticas,
        addAnalitica,
        addAnaliticasBatch,
        updateAnalitica,
        deleteAnalitica,
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
        aeatSumaAnterior,
        updateAeatSumaAnterior,
        aeatMateriasPrimas,
        addAeatMateriaPrima,
        updateAeatMateriaPrima,
        deleteAeatMateriaPrima,
        syncAeatMateriasPrimasFromVendimia,
        aeatProductoElaborado,
        addAeatProductoElaborado,
        updateAeatProductoElaborado,
        deleteAeatProductoElaborado,
        syncAeatProductoElaboradoFromBodega,
        mrL1SumaEntradas,
        updateMrL1SumaEntradas,
        mrL1SumaSalidas,
        updateMrL1SumaSalidas,
        mrL1Entradas,
        addMrL1Entrada,
        updateMrL1Entrada,
        deleteMrL1Entrada,
        mrL1Salidas,
        addMrL1Salida,
        updateMrL1Salida,
        deleteMrL1Salida,
        mrL2SumaAnterior,
        updateMrL2SumaAnterior,
        mrL2Entradas,
        addMrL2Entrada,
        updateMrL2Entrada,
        deleteMrL2Entrada,
        mrL2Salidas,
        addMrL2Salida,
        updateMrL2Salida,
        deleteMrL2Salida,
        mrL3SumaAnterior,
        updateMrL3SumaAnterior,
        mrL3Movimientos,
        addMrL3Movimiento,
        updateMrL3Movimiento,
        deleteMrL3Movimiento,
        mrL4Practicas,
        addMrL4Practica,
        updateMrL4Practica,
        deleteMrL4Practica,
        mrL5Procesos,
        addMrL5Proceso,
        updateMrL5Proceso,
        deleteMrL5Proceso,
        syncMedioRuralLibro,
        foggaDeclaraciones,
        upsertFoggaDeclaracion,
        deleteFoggaDeclaracion,
        confirmarFoggaPresentada,
        infoviDeclaraciones,
        upsertInfoviDeclaracion,
        deleteInfoviDeclaracion,
        confirmarInfoviPresentada,
        checkReferentialIntegrity,
        syncStatus,
        hasPendingSync,
        lastSyncAt,
        syncError,
        isSupabaseReady: isSupabaseConfigured,
        syncWithCloud,
        resetFloorPlanPositions,
        exportDatabaseJSON,
      }}
    >
      {children}
    </WineryContext.Provider>
  );
};

export const useWinery = () => {
  const ctx = useContext(WineryContext);
  if (!ctx) {
    throw new Error('useWinery must be used within a WineryProvider');
  }
  return ctx;
};

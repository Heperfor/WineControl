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
import { getLocalIsoDate } from '../utils/dateUtils';

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
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const getChangedRecordIds = <T extends { id: string }>(prevArr: T[], nextArr: T[]): string[] => {
  const prevMap = new Map(prevArr.map((item) => [item.id, JSON.stringify(item)]));
  const changed: string[] = [];
  nextArr.forEach((item) => {
    if (prevMap.get(item.id) !== JSON.stringify(item)) {
      changed.push(item.id);
    }
  });
  return changed;
};

const getNextSeqId = (items: Array<{ id: string }>, prefix: string, padLen = 3): string => {
  const maxSeq = items.reduce((max, item) => {
    if (item.id.startsWith(prefix)) {
      const num = Number(item.id.slice(prefix.length));
      return Number.isFinite(num) && num > max ? num : max;
    }
    return max;
  }, 0);
  return `${prefix}${String(Math.max(items.length, maxSeq) + 1).padStart(padLen, '0')}`;
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
    const parsed = readStoredJson<BodegaConfig>(`${STORAGE_KEY}_config`, initialBodegaConfig);
    if (parsed.nombreBodega === 'Adega Vinhas & Microparaxes') {
      return { ...parsed, nombreBodega: 'Adega Microparaxes' };
    }
    return parsed;
  });

  const [parcelas, setParcelas] = useState<Parcela[]>(() =>
    readStoredJson<Parcela[]>(`${STORAGE_KEY}_parcelas`, initialParcelas)
  );

  const [depositos, setDepositos] = useState<Deposito[]>(() => {
    const parsed = readStoredJson<Deposito[] | null>(`${STORAGE_KEY}_depositos`, null);
    if (!parsed || !Array.isArray(parsed)) return initialDepositos;
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
    const parsed = readStoredJson<EntradaUva[] | null>(`${STORAGE_KEY}_entradas`, null);
    if (!parsed || !Array.isArray(parsed)) return initialEntradasUva;
    return parsed.map((e) => ({
      ...e,
      depositoDestinoId: LEGACY_DEP_ID_MAP[e.depositoDestinoId] || e.depositoDestinoId,
      tipoRecipiente: normalizeTipoRecipiente(e.tipoRecipiente),
      tipoVino: e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre),
    }));
  });

  const [elaboraciones, setElaboraciones] = useState<ElaboracionRegistro[]>(() => {
    const parsed = readStoredJson<ElaboracionRegistro[] | null>(
      `${STORAGE_KEY}_elaboraciones`,
      null
    );
    if (!parsed || !Array.isArray(parsed)) return initialElaboracion;
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
    const parsed = readStoredJson<EmbotelladoRegistro[] | null>(
      `${STORAGE_KEY}_embotellados`,
      null
    );
    if (!parsed || !Array.isArray(parsed)) return initialEmbotellados;
    return parsed.map((emb) => ({
      ...emb,
      depositoProcedenciaId:
        LEGACY_DEP_ID_MAP[emb.depositoProcedenciaId] || emb.depositoProcedenciaId,
      tipoVino: emb.tipoVino || inferTipoVinoFromMarca(emb.marca),
    }));
  });

  const [salidas, setSalidas] = useState<SalidaRegistro[]>(() =>
    readStoredJson<SalidaRegistro[]>(`${STORAGE_KEY}_salidas`, initialSalidas)
  );

  const [insumosMovimientos, setInsumosMovimientos] = useState<MovimientoInsumo[]>(() =>
    readStoredJson<MovimientoInsumo[]>(`${STORAGE_KEY}_insumos`, initialInsumosMovimientos)
  );

  const [analiticas, setAnaliticas] = useState<AnaliticaRegistro[]>(() =>
    readStoredJson<AnaliticaRegistro[]>(`${STORAGE_KEY}_analiticas`, initialAnaliticas)
  );

  const [appccAgua, setAppccAgua] = useState<AppccAguaRegistro[]>(() => {
    const parsed = readStoredJson<AppccAguaRegistro[] | null>(
      `${STORAGE_KEY}_appcc_agua`,
      null
    );
    if (!parsed || !Array.isArray(parsed)) return initialAppccAgua;
    return parsed.map((a) => ({
      ...a,
      lugarTomaMuestra: a.lugarTomaMuestra || 'Grifo zona elaboración',
      ph: typeof a.ph === 'number' ? a.ph : 7.2,
      aspecto: a.aspecto || (a.organolepticoConforme ? 'Limpio, incoloro, inodoro' : 'Revisar aspecto'),
    }));
  });

  const [appccLimpieza, setAppccLimpieza] = useState<AppccLimpiezaRegistro[]>(() => {
    const parsed = readStoredJson<AppccLimpiezaRegistro[] | null>(
      `${STORAGE_KEY}_appcc_limpieza`,
      null
    );
    if (!parsed || !Array.isArray(parsed)) return initialAppccLimpieza;
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

  const [appccResiduos, setAppccResiduos] = useState<AppccResiduoRegistro[]>(() =>
    readStoredJson<AppccResiduoRegistro[]>(`${STORAGE_KEY}_appcc_residuos`, initialAppccResiduos)
  );

  const [appccPlagasMant, setAppccPlagasMant] = useState<AppccPlagaMantenimientoRegistro[]>(() =>
    readStoredJson<AppccPlagaMantenimientoRegistro[]>(
      `${STORAGE_KEY}_appcc_plagas_mant`,
      initialAppccPlagasMant
    )
  );

  const [appccProveedores, setAppccProveedores] = useState<AppccProveedorRegistro[]>(() =>
    readStoredJson<AppccProveedorRegistro[]>(
      `${STORAGE_KEY}_appcc_proveedores`,
      initialAppccProveedores
    )
  );

  const [appccIncidencias, setAppccIncidencias] = useState<AppccIncidenciaRegistro[]>(() =>
    readStoredJson<AppccIncidenciaRegistro[]>(
      `${STORAGE_KEY}_appcc_incidencias`,
      initialAppccIncidencias
    )
  );

  const [aeatSumaAnterior, setAeatSumaAnterior] = useState<AeatMateriaPrimaSumaAnterior>(() =>
    readStoredJson<AeatMateriaPrimaSumaAnterior>(
      `${STORAGE_KEY}_aeat_mp_suma`,
      initialAeatMateriasPrimasSumaAnterior
    )
  );

  const [aeatMateriasPrimas, setAeatMateriasPrimas] = useState<AeatMateriaPrimaRegistro[]>(() =>
    readStoredJson<AeatMateriaPrimaRegistro[]>(
      `${STORAGE_KEY}_aeat_mp`,
      initialAeatMateriasPrimas
    )
  );

  const [aeatProductoElaborado, setAeatProductoElaborado] = useState<AeatProductoElaboradoRegistro[]>(() =>
    readStoredJson<AeatProductoElaboradoRegistro[]>(
      `${STORAGE_KEY}_aeat_pe`,
      initialAeatProductoElaborado
    )
  );

  // Medio Rural states
  const [mrL1SumaEntradas, setMrL1SumaEntradas] = useState<MedioRuralEntradaSalidaSuma>(() =>
    readStoredJson<MedioRuralEntradaSalidaSuma>(
      `${STORAGE_KEY}_mr_l1_suma_ent`,
      initialMedioRuralL1SumaAnteriorEntradas
    )
  );
  const [mrL1SumaSalidas, setMrL1SumaSalidas] = useState<MedioRuralEntradaSalidaSuma>(() =>
    readStoredJson<MedioRuralEntradaSalidaSuma>(
      `${STORAGE_KEY}_mr_l1_suma_sal`,
      initialMedioRuralL1SumaAnteriorSalidas
    )
  );
  const [mrL1Entradas, setMrL1Entradas] = useState<MedioRuralEntradaRegistro[]>(() =>
    readStoredJson<MedioRuralEntradaRegistro[]>(
      `${STORAGE_KEY}_mr_l1_ent`,
      initialMedioRuralL1Entradas
    )
  );
  const [mrL1Salidas, setMrL1Salidas] = useState<MedioRuralSalidaRegistro[]>(() =>
    readStoredJson<MedioRuralSalidaRegistro[]>(
      `${STORAGE_KEY}_mr_l1_sal`,
      initialMedioRuralL1Salidas
    )
  );

  const [mrL2SumaAnterior, setMrL2SumaAnterior] = useState<MedioRuralEmbotelladoSumaAnterior>(() =>
    readStoredJson<MedioRuralEmbotelladoSumaAnterior>(
      `${STORAGE_KEY}_mr_l2_suma`,
      initialMedioRuralL2SumaAnterior
    )
  );
  const [mrL2Entradas, setMrL2Entradas] = useState<MedioRuralEmbotelladoEntradaRegistro[]>(() =>
    readStoredJson<MedioRuralEmbotelladoEntradaRegistro[]>(
      `${STORAGE_KEY}_mr_l2_ent`,
      initialMedioRuralL2Entradas
    )
  );
  const [mrL2Salidas, setMrL2Salidas] = useState<MedioRuralEmbotelladoSalidaRegistro[]>(() =>
    readStoredJson<MedioRuralEmbotelladoSalidaRegistro[]>(
      `${STORAGE_KEY}_mr_l2_sal`,
      initialMedioRuralL2Salidas
    )
  );

  const [mrL3SumaAnterior, setMrL3SumaAnterior] = useState<MedioRuralMovProductoSumaAnterior>(() =>
    readStoredJson<MedioRuralMovProductoSumaAnterior>(
      `${STORAGE_KEY}_mr_l3_suma`,
      initialMedioRuralL3SumaAnterior
    )
  );
  const [mrL3Movimientos, setMrL3Movimientos] = useState<MedioRuralMovimientoProductoRegistro[]>(() =>
    readStoredJson<MedioRuralMovimientoProductoRegistro[]>(
      `${STORAGE_KEY}_mr_l3_mov`,
      initialMedioRuralL3Movimientos
    )
  );

  const [mrL4Practicas, setMrL4Practicas] = useState<MedioRuralPracticaEnologicaRegistro[]>(() =>
    readStoredJson<MedioRuralPracticaEnologicaRegistro[]>(
      `${STORAGE_KEY}_mr_l4_pract`,
      initialMedioRuralL4Practicas
    )
  );

  const [mrL5Procesos, setMrL5Procesos] = useState<MedioRuralProcesoElaboracionRegistro[]>(() =>
    readStoredJson<MedioRuralProcesoElaboracionRegistro[]>(
      `${STORAGE_KEY}_mr_l5_proc`,
      initialMedioRuralL5Procesos
    )
  );

  // Declaraciones oficiales FOGGA MR441B e INFOVI AICA
  const [foggaDeclaraciones, setFoggaDeclaraciones] = useState<FoggaMr441bDeclaracion[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_fogga`);
    if (!saved) return initialFoggaDeclaraciones;
    try {
      const parsed = JSON.parse(saved) as FoggaMr441bDeclaracion[];
      if (!Array.isArray(parsed)) return initialFoggaDeclaraciones;
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
    const todayIso = getLocalIsoDate();
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

  const markRecordsDirty = useCallback(
    (table: SyncTableName, ids: string[]) => {
      const validIds = ids.filter(Boolean);
      if (validIds.length === 0) return;
      const curr = new Set(dirtyIdsRef.current[table] || []);
      validIds.forEach((id) => curr.add(id));
      dirtyIdsRef.current[table] = Array.from(curr);
      if (pendingDeletesRef.current[table]?.length) {
        const idSet = new Set(validIds);
        pendingDeletesRef.current[table] = pendingDeletesRef.current[table]!.filter(
          (x) => !idSet.has(x)
        );
      }
      persistDirtyQueues();
    },
    [persistDirtyQueues]
  );

  const applyRemoteState = useCallback(
    (remote: WineryDatabaseState, missingOptionalTables?: SyncTableName[]) => {
      const normalizedDepositos = remote.depositos.map((d, idx) => {
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
      });

      const normalizedEmbotellados = remote.embotellados.map((emb) => {
        const totalSalidasParaEsteLote = remote.salidas
          .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
          .reduce((sum, s) => sum + s.cantidadBotellas, 0);
        const disponible = Math.max(0, emb.cantidadBotellas075 - totalSalidasParaEsteLote);
        return emb.botellasDisponibles === disponible
          ? emb
          : { ...emb, botellasDisponibles: disponible };
      });

      const applyFogga = !missingOptionalTables?.includes('fogga_declaraciones');
      const applyInfovi = !missingOptionalTables?.includes('infovi_declaraciones');
      const prevLocal = currentStateRef.current;

      const appliedState: WineryDatabaseState = {
        ...remote,
        depositos: normalizedDepositos,
        embotellados: normalizedEmbotellados,
        foggaDeclaraciones: applyFogga
          ? remote.foggaDeclaraciones
          : prevLocal?.foggaDeclaraciones ?? [],
        infoviDeclaraciones: applyInfovi
          ? remote.infoviDeclaraciones
          : prevLocal?.infoviDeclaraciones ?? [],
      };

      isApplyingRemoteRef.current = true;
      prevSnapshotRef.current = buildSerializedSnapshot(appliedState);
      currentStateRef.current = appliedState;

      setBodegaConfig(remote.bodegaConfig);
      setParcelas(remote.parcelas);
      setDepositos(normalizedDepositos);
      setEntradasUva(remote.entradasUva);
      setElaboraciones(remote.elaboraciones);
      setEmbotellados(normalizedEmbotellados);
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
      if (applyFogga) {
        setFoggaDeclaraciones(remote.foggaDeclaraciones);
      }
      if (applyInfovi) {
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

  const getLiveState = (): WineryDatabaseState =>
    currentStateRef.current || {
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

  // CRUD: BodegaConfig
  const updateBodegaConfig = (config: BodegaConfig) => {
    const live = getLiveState();
    currentStateRef.current = { ...live, bodegaConfig: config };
    setBodegaConfig(config);
  };

  // CRUD: Parcelas
  const addParcela = (parcelaData: Omit<Parcela, 'id'>): Parcela => {
    const live = getLiveState();
    const newId = getNextSeqId(live.parcelas, 'PARC-', 2);
    const newParcela: Parcela = {
      ...parcelaData,
      id: newId,
    };
    const nextParcelas = [...live.parcelas, newParcela];
    currentStateRef.current = { ...live, parcelas: nextParcelas };
    setParcelas(nextParcelas);
    return newParcela;
  };

  const updateParcela = (id: string, updated: Partial<Parcela>) => {
    const live = getLiveState();
    const prevParcela = live.parcelas.find((p) => p.id === id);
    const nextParcelas = live.parcelas.map((p) => (p.id === id ? { ...p, ...updated } : p));
    let nextEntradas = live.entradasUva;
    if (prevParcela && updated.nombre && updated.nombre !== prevParcela.nombre) {
      nextEntradas = live.entradasUva.map((e) =>
        e.parcelaId === id ? { ...e, parcelaNombre: updated.nombre! } : e
      );
      setEntradasUva(nextEntradas);
    }
    currentStateRef.current = { ...live, parcelas: nextParcelas, entradasUva: nextEntradas };
    setParcelas(nextParcelas);
  };

  const deleteParcela = (id: string): boolean => {
    const check = checkReferentialIntegrity('parcela', id);
    if (!check.canDelete) return false;
    const live = getLiveState();
    const nextParcelas = live.parcelas.filter((p) => p.id !== id);
    currentStateRef.current = { ...live, parcelas: nextParcelas };
    setParcelas(nextParcelas);
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
  const getEntradaLiters = (ent: Pick<EntradaUva, 'litrosMosto' | 'litrosEstimadosMosto' | 'kgTotales'>): number =>
    ent.litrosMosto || ent.litrosEstimadosMosto || Math.round(ent.kgTotales * 0.68);

  const adjustTankVarieties = (
    varieties: Deposito['variedades'] | undefined,
    desglose: EntradaUva['desgloseVariedades'],
    kgTotales: number,
    totalLiters: number,
    sign: 1 | -1
  ) => {
    const currentVarieties = (varieties || []).map((cv) => ({ ...cv }));
    desglose.forEach((v) => {
      const vLiters = Math.round((v.kg / (kgTotales || 1)) * totalLiters);
      const idx = currentVarieties.findIndex(
        (cv) => cv.variedad.toLowerCase() === v.variedad.toLowerCase()
      );
      if (idx >= 0) {
        currentVarieties[idx] = {
          ...currentVarieties[idx],
          litros: Math.max(0, currentVarieties[idx].litros + sign * vLiters),
        };
      } else if (sign > 0 && vLiters > 0) {
        currentVarieties.push({
          variedad: v.variedad,
          litros: vLiters,
          porcentaje: 0,
        });
      }
    });

    const filtered = currentVarieties.filter((item) => item.litros > 0);
    const totalV = filtered.reduce((sum, item) => sum + item.litros, 0) || 1;
    return filtered.map((item) => ({
      ...item,
      porcentaje: Math.round((item.litros / totalV) * 100),
    }));
  };

  const addEntradaUva = (entradaData: Omit<EntradaUva, 'id' | 'fechaRegistro'>): EntradaUva => {
    const live = getLiveState();
    const year = new Date().getFullYear();
    const newId = getNextSeqId(live.entradasUva, `ENT-${year}-`, 3);
    const newEntrada: EntradaUva = {
      ...entradaData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    const nextEntradas = [newEntrada, ...live.entradasUva];

    // Automatically update the destination tank's volume, varieties and state immutably
    const nextDepositos = live.depositos.map((d) => {
      if (d.id === entradaData.depositoDestinoId) {
        const addedLiters = getEntradaLiters(entradaData);
        const newTotalLiters = Math.min(d.capacidadLitros, (d.litrosActuales || 0) + addedLiters);
        const updatedVars = adjustTankVarieties(
          d.variedades,
          entradaData.desgloseVariedades,
          entradaData.kgTotales,
          addedLiters,
          1
        );

        return {
          ...d,
          litrosActuales: newTotalLiters,
          anoCosecha: entradaData.anada || d.anoCosecha,
          estado: d.estado === 'Vacío' ? ('Fermentación Alcohólica' as const) : d.estado,
          variedades: updatedVars,
          ultimaOperacion: `Entrada uva vendimia (${entradaData.kgTotales} kg)`,
          fechaUltimaOperacion: entradaData.fecha,
        };
      }
      return d;
    });

    // Trigger APPCC Automático
    const responsableAppcc = live.bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForEntradaUva(newEntrada, responsableAppcc);
    const updatedPrevLd = live.appccLimpieza.map((existing) => {
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
    const nuevosLd = autoLd.filter(
      (n) =>
        !updatedPrevLd.some(
          (e) =>
            e.fecha === n.fecha &&
            e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
        )
    );
    const nextAppccLimpieza = [...nuevosLd, ...updatedPrevLd];
    const autoRes = buildResiduoForEntradaUva(newEntrada, responsableAppcc);
    const nextAppccResiduos = [autoRes, ...live.appccResiduos];

    // Trigger AEAT Automático using fresh nextDepositos
    let nextAeatMp = live.aeatMateriasPrimas;
    if (!live.aeatMateriasPrimas.some((r) => r.origenEntradaId === newEntrada.id)) {
      const nextOrder = live.aeatMateriasPrimas.reduce((max, r) => Math.max(max, r.numeroOrden), 0) + 1;
      const newRow = buildAeatMateriaPrimaFromEntrada(newEntrada, nextOrder, live.bodegaConfig);
      nextAeatMp = [...live.aeatMateriasPrimas, newRow].sort((a, b) => a.numeroOrden - b.numeroOrden);
    }

    let nextAeatPe = live.aeatProductoElaborado;
    if (!live.aeatProductoElaborado.some((r) => r.origenMovimientoId === newEntrada.id)) {
      const newRow = buildAeatProductoFromEntrada(newEntrada, nextDepositos, live.bodegaConfig);
      nextAeatPe = recalculateProductoElaboradoBalances([...live.aeatProductoElaborado, newRow]);
    }

    // Trigger Medio Rural Automático: Libro 1 (Entradas) + Libro 5 (Procesos Elaboración)
    let nextMrL1Entradas = live.mrL1Entradas;
    if (!live.mrL1Entradas.some((r) => r.origenMovimientoId === newEntrada.id)) {
      nextMrL1Entradas = [...live.mrL1Entradas, buildMedioRuralL1EntradaFromVendimia(newEntrada)].sort(
        (a, b) => a.data.localeCompare(b.data)
      );
    }

    let nextMrL5Procesos = live.mrL5Procesos;
    if (!live.mrL5Procesos.some((r) => r.origenMovimientoId === newEntrada.id)) {
      nextMrL5Procesos = reindexLibro5Procesos([
        ...live.mrL5Procesos,
        buildMedioRuralL5FromEntrada(newEntrada),
      ]);
    }

    currentStateRef.current = {
      ...live,
      entradasUva: nextEntradas,
      depositos: nextDepositos,
      appccLimpieza: nextAppccLimpieza,
      appccResiduos: nextAppccResiduos,
      aeatMateriasPrimas: nextAeatMp,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL5Procesos: nextMrL5Procesos,
    };

    setEntradasUva(nextEntradas);
    setDepositos(nextDepositos);
    setAppccLimpieza(nextAppccLimpieza);
    setAppccResiduos(nextAppccResiduos);
    setAeatMateriasPrimas(nextAeatMp);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Entradas(nextMrL1Entradas);
    setMrL5Procesos(nextMrL5Procesos);

    markRecordsDirty('aeat_materias_primas', getChangedRecordIds(live.aeatMateriasPrimas, nextAeatMp));
    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l1_entradas', getChangedRecordIds(live.mrL1Entradas, nextMrL1Entradas));
    markRecordsDirty('mr_l5_procesos', getChangedRecordIds(live.mrL5Procesos, nextMrL5Procesos));

    return newEntrada;
  };

  const updateEntradaUva = (id: string, updated: Partial<EntradaUva>) => {
    const live = getLiveState();
    const existing = live.entradasUva.find((e) => e.id === id);
    if (!existing) return;

    const mergedEntrada: EntradaUva = { ...existing, ...updated };
    const nextEntradas = live.entradasUva.map((e) => (e.id === id ? mergedEntrada : e));

    // Recalculate tank volume & varieties coherently (same tank or tank transfer)
    const oldLiters = getEntradaLiters(existing);
    const newLiters = getEntradaLiters(mergedEntrada);
    const tankChanged = existing.depositoDestinoId !== mergedEntrada.depositoDestinoId;
    const litersOrVarietiesChanged =
      oldLiters !== newLiters ||
      existing.kgTotales !== mergedEntrada.kgTotales ||
      JSON.stringify(existing.desgloseVariedades) !== JSON.stringify(mergedEntrada.desgloseVariedades);

    let nextDepositos = live.depositos;
    if (tankChanged || litersOrVarietiesChanged) {
      nextDepositos = live.depositos.map((d) => {
        if (tankChanged) {
          if (d.id === existing.depositoDestinoId) {
            const reducedLiters = Math.max(0, (d.litrosActuales || 0) - oldLiters);
            return {
              ...d,
              litrosActuales: reducedLiters,
              estado: reducedLiters === 0 ? ('Vacío' as const) : d.estado,
              variedades: adjustTankVarieties(
                d.variedades,
                existing.desgloseVariedades,
                existing.kgTotales,
                oldLiters,
                -1
              ),
            };
          }
          if (d.id === mergedEntrada.depositoDestinoId) {
            const addedTotal = Math.min(d.capacidadLitros, (d.litrosActuales || 0) + newLiters);
            return {
              ...d,
              litrosActuales: addedTotal,
              anoCosecha: mergedEntrada.anada || d.anoCosecha,
              estado: d.estado === 'Vacío' ? ('Fermentación Alcohólica' as const) : d.estado,
              variedades: adjustTankVarieties(
                d.variedades,
                mergedEntrada.desgloseVariedades,
                mergedEntrada.kgTotales,
                newLiters,
                1
              ),
              ultimaOperacion: `Entrada uva vendimia (${mergedEntrada.kgTotales} kg)`,
              fechaUltimaOperacion: mergedEntrada.fecha,
            };
          }
          return d;
        }

        if (d.id === mergedEntrada.depositoDestinoId) {
          const delta = newLiters - oldLiters;
          const nextLiters = Math.min(d.capacidadLitros, Math.max(0, (d.litrosActuales || 0) + delta));
          const afterSub = adjustTankVarieties(
            d.variedades,
            existing.desgloseVariedades,
            existing.kgTotales,
            oldLiters,
            -1
          );
          const afterAdd = adjustTankVarieties(
            afterSub,
            mergedEntrada.desgloseVariedades,
            mergedEntrada.kgTotales,
            newLiters,
            1
          );
          return {
            ...d,
            litrosActuales: nextLiters,
            anoCosecha: mergedEntrada.anada || d.anoCosecha,
            estado: nextLiters === 0 ? ('Vacío' as const) : d.estado === 'Vacío' ? ('Fermentación Alcohólica' as const) : d.estado,
            variedades: afterAdd,
            ultimaOperacion: `Entrada uva vendimia (${mergedEntrada.kgTotales} kg)`,
            fechaUltimaOperacion: mergedEntrada.fecha,
          };
        }
        return d;
      });
    }

    // Keep unedited APPCC L+D & regulatory records synchronized using fresh nextDepositos/nextEntradas
    const responsableAppcc = live.bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const rebuiltLd = buildLimpiezaForEntradaUva(mergedEntrada, responsableAppcc);
    const cleanedLd = live.appccLimpieza.filter(
      (l) => !(l.referenciaOperacionId === id && !l.editadoManualmente)
    );
    const nuevosLd = rebuiltLd.filter(
      (n) =>
        !cleanedLd.some(
          (e) =>
            e.fecha === n.fecha &&
            e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
        )
    );
    const nextAppccLimpieza = [...nuevosLd, ...cleanedLd];

    const nextAeatMp = syncMateriasPrimasWithEntradas(
      live.aeatMateriasPrimas,
      nextEntradas,
      live.bodegaConfig,
      { addMissing: false, updateExisting: true }
    );
    const nextAeatPe = syncProductoElaboradoWithBodega(
      live.aeatProductoElaborado,
      {
        entradasUva: nextEntradas,
        elaboraciones: live.elaboraciones,
        embotellados: live.embotellados,
        salidas: live.salidas,
        depositos: nextDepositos,
        config: live.bodegaConfig,
      },
      { addMissing: false, updateExisting: true }
    );
    const nextMrL1Entradas = syncMedioRuralLibro1(
      live.mrL1Entradas,
      live.mrL1Salidas,
      {
        entradasUva: nextEntradas,
        elaboraciones: live.elaboraciones,
        embotellados: live.embotellados,
        depositos: nextDepositos,
      },
      { addMissing: false, updateExisting: true }
    ).entradas;
    const nextMrL5Procesos = syncMedioRuralLibro5(
      live.mrL5Procesos,
      {
        entradasUva: nextEntradas,
        elaboraciones: live.elaboraciones,
        depositos: nextDepositos,
      },
      { addMissing: false, updateExisting: true }
    );

    currentStateRef.current = {
      ...live,
      entradasUva: nextEntradas,
      depositos: nextDepositos,
      appccLimpieza: nextAppccLimpieza,
      aeatMateriasPrimas: nextAeatMp,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL5Procesos: nextMrL5Procesos,
    };

    setEntradasUva(nextEntradas);
    if (nextDepositos !== live.depositos) {
      setDepositos(nextDepositos);
    }
    setAppccLimpieza(nextAppccLimpieza);
    setAeatMateriasPrimas(nextAeatMp);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Entradas(nextMrL1Entradas);
    setMrL5Procesos(nextMrL5Procesos);

    markRecordsDirty('aeat_materias_primas', getChangedRecordIds(live.aeatMateriasPrimas, nextAeatMp));
    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l1_entradas', getChangedRecordIds(live.mrL1Entradas, nextMrL1Entradas));
    markRecordsDirty('mr_l5_procesos', getChangedRecordIds(live.mrL5Procesos, nextMrL5Procesos));
  };

  const deleteEntradaUva = (id: string): boolean => {
    const live = getLiveState();
    const entrada = live.entradasUva.find((e) => e.id === id);
    if (!entrada) return false;

    const removedLiters = getEntradaLiters(entrada);
    const nextDepositos = entrada.depositoDestinoId
      ? live.depositos.map((d) => {
          if (d.id === entrada.depositoDestinoId) {
            const newLiters = Math.max(0, d.litrosActuales - removedLiters);
            return {
              ...d,
              litrosActuales: newLiters,
              estado: newLiters === 0 ? ('Vacío' as const) : d.estado,
              variedades: adjustTankVarieties(
                d.variedades,
                entrada.desgloseVariedades,
                entrada.kgTotales,
                removedLiters,
                -1
              ),
            };
          }
          return d;
        })
      : live.depositos;

    const nextEntradas = live.entradasUva.filter((e) => e.id !== id);
    const nextAppccLimpieza = live.appccLimpieza.filter(
      (l) => !(l.referenciaOperacionId === id && !l.editadoManualmente)
    );
    const nextAppccResiduos = live.appccResiduos.filter(
      (r) => !(r.referenciaOperacionId === id && !r.editadoManualmente)
    );
    const nextAeatMp = live.aeatMateriasPrimas.filter(
      (r) => !(r.origenEntradaId === id && !r.editadoManualmente)
    );
    const nextAeatPe = recalculateProductoElaboradoBalances(
      live.aeatProductoElaborado.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );
    const nextMrL1Entradas = live.mrL1Entradas.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL5Procesos = reindexLibro5Procesos(
      live.mrL5Procesos.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );

    currentStateRef.current = {
      ...live,
      depositos: nextDepositos,
      entradasUva: nextEntradas,
      appccLimpieza: nextAppccLimpieza,
      appccResiduos: nextAppccResiduos,
      aeatMateriasPrimas: nextAeatMp,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL5Procesos: nextMrL5Procesos,
    };

    if (nextDepositos !== live.depositos) setDepositos(nextDepositos);
    setEntradasUva(nextEntradas);
    setAppccLimpieza(nextAppccLimpieza);
    setAppccResiduos(nextAppccResiduos);
    setAeatMateriasPrimas(nextAeatMp);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Entradas(nextMrL1Entradas);
    setMrL5Procesos(nextMrL5Procesos);
    return true;
  };

  // CRUD: Elaboración
  const addElaboracion = (
    elabData: Omit<ElaboracionRegistro, 'id' | 'fechaRegistro'>
  ): ElaboracionRegistro => {
    const live = getLiveState();
    const newId = getNextSeqId(live.elaboraciones, `ELAB-${new Date().getFullYear()}-`, 3);
    const newElab: ElaboracionRegistro = {
      ...elabData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    const nextElabs = [newElab, ...live.elaboraciones];

    // Update origin & optional destination tank
    const nextDepositos = live.depositos.map((d) => {
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
          estado: newLitros === 0 ? ('Vacío' as const) : newEstado,
          ultimaOperacion: elabData.operacionRealizada,
          fechaUltimaOperacion: elabData.fecha,
        };
      }

      if (elabData.destinoTipo === 'deposito' && elabData.depositoDestinoId === d.id) {
        const newLitros = Math.min(d.capacidadLitros, d.litrosActuales + elabData.cantidadLitros);
        return {
          ...d,
          litrosActuales: newLitros,
          anoCosecha: elabData.anada || d.anoCosecha,
          estado: 'Estabilización / Reposo' as const,
          ultimaOperacion: `Recepción trasiego desde ${elabData.depositoOrigenId}`,
          fechaUltimaOperacion: elabData.fecha,
        };
      }

      return d;
    });

    // APPCC Automático
    const responsableAppcc = live.bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForElaboracion(newElab, responsableAppcc);
    const nuevosLd = autoLd.filter(
      (n) =>
        !live.appccLimpieza.some(
          (e) =>
            e.fecha === n.fecha &&
            e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
        )
    );
    const nextAppccLimpieza = [...nuevosLd, ...live.appccLimpieza];

    // AEAT Automático using fresh nextDepositos
    let nextAeatPe = live.aeatProductoElaborado;
    if (
      shouldElaboracionBeInAeat(newElab) &&
      !live.aeatProductoElaborado.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      const newRow = buildAeatProductoFromElaboracion(newElab, nextDepositos, live.bodegaConfig);
      nextAeatPe = recalculateProductoElaboradoBalances([...live.aeatProductoElaborado, newRow]);
    }

    // Medio Rural Automático using fresh nextDepositos
    let nextMrL1Entradas = live.mrL1Entradas;
    if (
      shouldElaboracionGenerateL1Entrada(newElab) &&
      !live.mrL1Entradas.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      nextMrL1Entradas = [
        ...live.mrL1Entradas,
        buildMedioRuralL1EntradaFromElab(newElab, nextDepositos),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    let nextMrL1Salidas = live.mrL1Salidas;
    if (
      shouldElaboracionGenerateL1Salida(newElab) &&
      !live.mrL1Salidas.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      nextMrL1Salidas = [
        ...live.mrL1Salidas,
        buildMedioRuralL1SalidaFromElab(newElab, nextDepositos),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    let nextMrL3Movimientos = live.mrL3Movimientos;
    if (
      shouldElaboracionBeInLibro3(newElab) &&
      !live.mrL3Movimientos.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      nextMrL3Movimientos = [
        ...live.mrL3Movimientos,
        buildMedioRuralL3FromElaboracion(newElab, live.bodegaConfig),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    let nextMrL4Practicas = live.mrL4Practicas;
    if (
      shouldElaboracionBeInLibro4(newElab) &&
      !live.mrL4Practicas.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      nextMrL4Practicas = [
        ...live.mrL4Practicas,
        buildMedioRuralL4FromElaboracion(newElab, nextDepositos),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    let nextMrL5Procesos = live.mrL5Procesos;
    if (
      shouldElaboracionBeInLibro5(newElab) &&
      !live.mrL5Procesos.some((r) => r.origenMovimientoId === newElab.id)
    ) {
      nextMrL5Procesos = reindexLibro5Procesos([
        ...live.mrL5Procesos,
        buildMedioRuralL5FromElaboracion(newElab, nextDepositos),
      ]);
    }

    currentStateRef.current = {
      ...live,
      elaboraciones: nextElabs,
      depositos: nextDepositos,
      appccLimpieza: nextAppccLimpieza,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL1Salidas: nextMrL1Salidas,
      mrL3Movimientos: nextMrL3Movimientos,
      mrL4Practicas: nextMrL4Practicas,
      mrL5Procesos: nextMrL5Procesos,
    };

    setElaboraciones(nextElabs);
    setDepositos(nextDepositos);
    setAppccLimpieza(nextAppccLimpieza);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Entradas(nextMrL1Entradas);
    setMrL1Salidas(nextMrL1Salidas);
    setMrL3Movimientos(nextMrL3Movimientos);
    setMrL4Practicas(nextMrL4Practicas);
    setMrL5Procesos(nextMrL5Procesos);

    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l1_entradas', getChangedRecordIds(live.mrL1Entradas, nextMrL1Entradas));
    markRecordsDirty('mr_l1_salidas', getChangedRecordIds(live.mrL1Salidas, nextMrL1Salidas));
    markRecordsDirty('mr_l3_movimientos', getChangedRecordIds(live.mrL3Movimientos, nextMrL3Movimientos));
    markRecordsDirty('mr_l4_practicas', getChangedRecordIds(live.mrL4Practicas, nextMrL4Practicas));
    markRecordsDirty('mr_l5_procesos', getChangedRecordIds(live.mrL5Procesos, nextMrL5Procesos));

    return newElab;
  };

  const updateElaboracion = (id: string, updated: Partial<ElaboracionRegistro>) => {
    const live = getLiveState();
    const nextElabs = live.elaboraciones.map((el) => (el.id === id ? { ...el, ...updated } : el));
    const edited = nextElabs.find((el) => el.id === id);

    let nextAeatPe = live.aeatProductoElaborado;
    let nextMrL1Entradas = live.mrL1Entradas;
    let nextMrL1Salidas = live.mrL1Salidas;
    let nextMrL3Movimientos = live.mrL3Movimientos;
    let nextMrL4Practicas = live.mrL4Practicas;
    let nextMrL5Procesos = live.mrL5Procesos;

    if (edited) {
      const hasRow = live.aeatProductoElaborado.some((r) => r.origenMovimientoId === id);
      if (shouldElaboracionBeInAeat(edited)) {
        if (!hasRow) {
          const newRow = buildAeatProductoFromElaboracion(
            edited,
            live.depositos,
            live.bodegaConfig
          );
          nextAeatPe = recalculateProductoElaboradoBalances([...live.aeatProductoElaborado, newRow]);
        } else {
          nextAeatPe = syncProductoElaboradoWithBodega(
            live.aeatProductoElaborado,
            {
              entradasUva: live.entradasUva,
              elaboraciones: nextElabs,
              embotellados: live.embotellados,
              salidas: live.salidas,
              depositos: live.depositos,
              config: live.bodegaConfig,
            },
            { addMissing: false, updateExisting: true }
          );
        }
      } else {
        nextAeatPe = recalculateProductoElaboradoBalances(
          live.aeatProductoElaborado.filter(
            (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
          )
        );
      }

      const l1Synced = syncMedioRuralLibro1(
        live.mrL1Entradas,
        live.mrL1Salidas,
        {
          entradasUva: live.entradasUva,
          elaboraciones: nextElabs,
          embotellados: live.embotellados,
          depositos: live.depositos,
        },
        { addMissing: true, updateExisting: true, pruneDeleted: true }
      );
      nextMrL1Entradas = l1Synced.entradas;
      nextMrL1Salidas = l1Synced.salidas;

      nextMrL3Movimientos = syncMedioRuralLibro3(
        live.mrL3Movimientos,
        { elaboraciones: nextElabs, config: live.bodegaConfig },
        { addMissing: true, updateExisting: true, pruneDeleted: true }
      );
      nextMrL4Practicas = syncMedioRuralLibro4(
        live.mrL4Practicas,
        { elaboraciones: nextElabs, depositos: live.depositos },
        { addMissing: true, updateExisting: true, pruneDeleted: true }
      );
      nextMrL5Procesos = syncMedioRuralLibro5(
        live.mrL5Procesos,
        {
          entradasUva: live.entradasUva,
          elaboraciones: nextElabs,
          depositos: live.depositos,
        },
        { addMissing: true, updateExisting: true, pruneDeleted: true }
      );
    }

    currentStateRef.current = {
      ...live,
      elaboraciones: nextElabs,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL1Salidas: nextMrL1Salidas,
      mrL3Movimientos: nextMrL3Movimientos,
      mrL4Practicas: nextMrL4Practicas,
      mrL5Procesos: nextMrL5Procesos,
    };

    setElaboraciones(nextElabs);
    if (edited) {
      setAeatProductoElaborado(nextAeatPe);
      setMrL1Entradas(nextMrL1Entradas);
      setMrL1Salidas(nextMrL1Salidas);
      setMrL3Movimientos(nextMrL3Movimientos);
      setMrL4Practicas(nextMrL4Practicas);
      setMrL5Procesos(nextMrL5Procesos);

      markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
      markRecordsDirty('mr_l1_entradas', getChangedRecordIds(live.mrL1Entradas, nextMrL1Entradas));
      markRecordsDirty('mr_l1_salidas', getChangedRecordIds(live.mrL1Salidas, nextMrL1Salidas));
      markRecordsDirty('mr_l3_movimientos', getChangedRecordIds(live.mrL3Movimientos, nextMrL3Movimientos));
      markRecordsDirty('mr_l4_practicas', getChangedRecordIds(live.mrL4Practicas, nextMrL4Practicas));
      markRecordsDirty('mr_l5_procesos', getChangedRecordIds(live.mrL5Procesos, nextMrL5Procesos));
    }
  };

  const deleteElaboracion = (id: string): boolean => {
    const live = getLiveState();
    const nextElabs = live.elaboraciones.filter((el) => el.id !== id);
    const nextAeatPe = recalculateProductoElaboradoBalances(
      live.aeatProductoElaborado.filter(
        (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
      )
    );
    const nextMrL1Entradas = live.mrL1Entradas.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL1Salidas = live.mrL1Salidas.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL3Movimientos = live.mrL3Movimientos.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL4Practicas = live.mrL4Practicas.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL5Procesos = reindexLibro5Procesos(
      live.mrL5Procesos.filter((r) => !(r.origenMovimientoId === id && !r.editadoManualmente))
    );

    currentStateRef.current = {
      ...live,
      elaboraciones: nextElabs,
      aeatProductoElaborado: nextAeatPe,
      mrL1Entradas: nextMrL1Entradas,
      mrL1Salidas: nextMrL1Salidas,
      mrL3Movimientos: nextMrL3Movimientos,
      mrL4Practicas: nextMrL4Practicas,
      mrL5Procesos: nextMrL5Procesos,
    };

    setElaboraciones(nextElabs);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Entradas(nextMrL1Entradas);
    setMrL1Salidas(nextMrL1Salidas);
    setMrL3Movimientos(nextMrL3Movimientos);
    setMrL4Practicas(nextMrL4Practicas);
    setMrL5Procesos(nextMrL5Procesos);
    return true;
  };

  // CRUD: Embotellados (Automatic bottle calculation 0.75L + Supplies deduction + Tank decrease)
  const addEmbotellado = (
    embData: Omit<EmbotelladoRegistro, 'id' | 'fechaRegistro' | 'cantidadBotellas075' | 'botellasDisponibles'>
  ): EmbotelladoRegistro => {
    const live = getLiveState();
    const newId = getNextSeqId(live.embotellados, `EMB-${new Date().getFullYear()}-`, 3);
    const botellasCalc = Math.floor(embData.cantidadLitros / 0.75);

    const newEmb: EmbotelladoRegistro = {
      ...embData,
      id: newId,
      cantidadBotellas075: botellasCalc,
      botellasDisponibles: botellasCalc,
      fechaRegistro: new Date().toISOString(),
    };

    const nextEmbotellados = [newEmb, ...live.embotellados];

    // 1. Discount liters from origin tank
    const nextDepositos = live.depositos.map((d) => {
      if (d.id === embData.depositoProcedenciaId) {
        const rest = Math.max(0, d.litrosActuales - embData.cantidadLitros);
        return {
          ...d,
          litrosActuales: rest,
          estado: rest === 0 ? ('Vacío' as const) : d.estado,
          ultimaOperacion: `Embotellado Lote ${embData.lote} (${botellasCalc} bot)`,
          fechaUltimaOperacion: embData.fecha,
        };
      }
      return d;
    });

    // 2. Automatically generate supply deductions (movimientos de insumos)
    const nowTs = Date.now();
    const newSupplyMovements: MovimientoInsumo[] = [];

    if (embData.insumos.tipoCorcho) {
      newSupplyMovements.push({
        id: `INS-OUT-${nowTs}-1`,
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

    if (embData.insumos.tipoBotella) {
      newSupplyMovements.push({
        id: `INS-OUT-${nowTs}-2`,
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

    if (embData.etiquetado && embData.insumos.tipoEtiqueta) {
      newSupplyMovements.push({
        id: `INS-OUT-${nowTs}-3`,
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

    if (embData.insumos.cajasUtilizadas && embData.insumos.cajasUtilizadas > 0) {
      newSupplyMovements.push({
        id: `INS-OUT-${nowTs}-4`,
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

    const nextInsumos =
      newSupplyMovements.length > 0
        ? [...newSupplyMovements, ...live.insumosMovimientos]
        : live.insumosMovimientos;

    // APPCC Automático
    const responsableAppcc = live.bodegaConfig.responsableTecnico || 'Héctor Pérez Formoso';
    const autoLd = buildLimpiezaForEmbotellado(newEmb, responsableAppcc);
    const nuevosLd = autoLd.filter(
      (n) =>
        !live.appccLimpieza.some(
          (e) =>
            e.fecha === n.fecha &&
            e.zonaEquipo.toUpperCase() === n.zonaEquipo.toUpperCase()
        )
    );
    const nextAppccLimpieza = [...nuevosLd, ...live.appccLimpieza];

    // AEAT Automático
    let nextAeatPe = live.aeatProductoElaborado;
    if (!live.aeatProductoElaborado.some((r) => r.origenMovimientoId === newEmb.id)) {
      const newRow = buildAeatProductoFromEmbotellado(newEmb, live.bodegaConfig);
      nextAeatPe = recalculateProductoElaboradoBalances([...live.aeatProductoElaborado, newRow]);
    }

    // Medio Rural Automático: Libro 1 (Saídas) + Libro 2 (Entradas Embotellados)
    let nextMrL1Salidas = live.mrL1Salidas;
    if (!live.mrL1Salidas.some((r) => r.origenMovimientoId === newEmb.id)) {
      nextMrL1Salidas = [
        ...live.mrL1Salidas,
        buildMedioRuralL1SalidaFromEmbotellado(newEmb),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    let nextMrL2Entradas = live.mrL2Entradas;
    if (!live.mrL2Entradas.some((r) => r.origenEmbotelladoId === newEmb.id)) {
      nextMrL2Entradas = [
        ...live.mrL2Entradas,
        buildMedioRuralL2EntradaFromEmbotellado(newEmb),
      ].sort((a, b) => a.data.localeCompare(b.data));
    }

    currentStateRef.current = {
      ...live,
      embotellados: nextEmbotellados,
      depositos: nextDepositos,
      insumosMovimientos: nextInsumos,
      appccLimpieza: nextAppccLimpieza,
      aeatProductoElaborado: nextAeatPe,
      mrL1Salidas: nextMrL1Salidas,
      mrL2Entradas: nextMrL2Entradas,
    };

    setEmbotellados(nextEmbotellados);
    setDepositos(nextDepositos);
    if (nextInsumos !== live.insumosMovimientos) setInsumosMovimientos(nextInsumos);
    setAppccLimpieza(nextAppccLimpieza);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Salidas(nextMrL1Salidas);
    setMrL2Entradas(nextMrL2Entradas);

    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l1_salidas', getChangedRecordIds(live.mrL1Salidas, nextMrL1Salidas));
    markRecordsDirty('mr_l2_entradas', getChangedRecordIds(live.mrL2Entradas, nextMrL2Entradas));

    return newEmb;
  };

  const updateEmbotellado = (id: string, updated: Partial<EmbotelladoRegistro>) => {
    const live = getLiveState();
    const nextEmbotellados = live.embotellados.map((emb) => {
      if (emb.id === id) {
        const newLitros = updated.cantidadLitros ?? emb.cantidadLitros;
        const newBotellas = updated.cantidadBotellas075 ?? Math.floor(newLitros / 0.75);
        const newLote = updated.lote ?? emb.lote;
        const totalSalidasParaEsteLote = live.salidas
          .filter((s) => s.lote === newLote || s.embotelladoId === emb.id)
          .reduce((sum, s) => sum + s.cantidadBotellas, 0);
        const disponible =
          updated.botellasDisponibles ?? Math.max(0, newBotellas - totalSalidasParaEsteLote);
        return {
          ...emb,
          ...updated,
          cantidadLitros: newLitros,
          cantidadBotellas075: newBotellas,
          botellasDisponibles: disponible,
        };
      }
      return emb;
    });

    const nextAeatPe = syncProductoElaboradoWithBodega(
      live.aeatProductoElaborado,
      {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        embotellados: nextEmbotellados,
        salidas: live.salidas,
        depositos: live.depositos,
        config: live.bodegaConfig,
      },
      { addMissing: false, updateExisting: true }
    );
    const nextMrL1Salidas = syncMedioRuralLibro1(
      live.mrL1Entradas,
      live.mrL1Salidas,
      {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        embotellados: nextEmbotellados,
        depositos: live.depositos,
      },
      { addMissing: false, updateExisting: true }
    ).salidas;
    const nextMrL2Entradas = syncMedioRuralLibro2(
      live.mrL2Entradas,
      live.mrL2Salidas,
      { embotellados: nextEmbotellados, salidas: live.salidas },
      { addMissing: false, updateExisting: true }
    ).entradas;

    currentStateRef.current = {
      ...live,
      embotellados: nextEmbotellados,
      aeatProductoElaborado: nextAeatPe,
      mrL1Salidas: nextMrL1Salidas,
      mrL2Entradas: nextMrL2Entradas,
    };

    setEmbotellados(nextEmbotellados);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Salidas(nextMrL1Salidas);
    setMrL2Entradas(nextMrL2Entradas);

    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l1_salidas', getChangedRecordIds(live.mrL1Salidas, nextMrL1Salidas));
    markRecordsDirty('mr_l2_entradas', getChangedRecordIds(live.mrL2Entradas, nextMrL2Entradas));
  };

  const deleteEmbotellado = (id: string): boolean => {
    const check = checkReferentialIntegrity('embotellado', id);
    if (!check.canDelete) return false;

    const live = getLiveState();
    const emb = live.embotellados.find((e) => e.id === id);
    let nextInsumos = live.insumosMovimientos;
    let nextDepositos = live.depositos;

    if (emb) {
      nextInsumos = live.insumosMovimientos.filter((m) => m.embotelladoLoteAsociado !== emb.lote);
      if (emb.depositoProcedenciaId) {
        nextDepositos = live.depositos.map((d) => {
          if (d.id === emb.depositoProcedenciaId) {
            return {
              ...d,
              litrosActuales: Math.min(d.capacidadLitros, d.litrosActuales + emb.cantidadLitros),
            };
          }
          return d;
        });
      }
    }

    const nextEmbotellados = live.embotellados.filter((e) => e.id !== id);
    const nextAeatPe = recalculateProductoElaboradoBalances(
      live.aeatProductoElaborado.filter(
        (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
      )
    );
    const nextMrL1Salidas = live.mrL1Salidas.filter(
      (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
    );
    const nextMrL2Entradas = live.mrL2Entradas.filter(
      (r) => !(r.origenEmbotelladoId === id && !r.editadoManualmente)
    );

    currentStateRef.current = {
      ...live,
      insumosMovimientos: nextInsumos,
      depositos: nextDepositos,
      embotellados: nextEmbotellados,
      aeatProductoElaborado: nextAeatPe,
      mrL1Salidas: nextMrL1Salidas,
      mrL2Entradas: nextMrL2Entradas,
    };

    if (nextInsumos !== live.insumosMovimientos) setInsumosMovimientos(nextInsumos);
    if (nextDepositos !== live.depositos) setDepositos(nextDepositos);
    setEmbotellados(nextEmbotellados);
    setAeatProductoElaborado(nextAeatPe);
    setMrL1Salidas(nextMrL1Salidas);
    setMrL2Entradas(nextMrL2Entradas);
    return true;
  };

  // CRUD: Salidas
  const addSalida = (salidaData: Omit<SalidaRegistro, 'id' | 'fechaRegistro'>): SalidaRegistro => {
    const live = getLiveState();
    const newId = getNextSeqId(live.salidas, `SAL-${new Date().getFullYear()}-`, 3);
    const newSalida: SalidaRegistro = {
      ...salidaData,
      id: newId,
      fechaRegistro: new Date().toISOString(),
    };

    const nextSalidas = [newSalida, ...live.salidas];

    // Update available bottles on embotellados immediately using fresh nextSalidas
    const nextEmbotellados = live.embotellados.map((emb) => {
      const totalSalidasParaEsteLote = nextSalidas
        .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
        .reduce((sum, s) => sum + s.cantidadBotellas, 0);
      const disponible = Math.max(0, emb.cantidadBotellas075 - totalSalidasParaEsteLote);
      return emb.botellasDisponibles === disponible
        ? emb
        : { ...emb, botellasDisponibles: disponible };
    });

    // Trigger AEAT Automático using fresh embotellados
    let nextAeatPe = live.aeatProductoElaborado;
    if (!live.aeatProductoElaborado.some((r) => r.origenMovimientoId === newSalida.id)) {
      const newRow = buildAeatProductoFromSalida(newSalida, nextEmbotellados);
      nextAeatPe = recalculateProductoElaboradoBalances([...live.aeatProductoElaborado, newRow]);
    }

    // Trigger Medio Rural Automático: Libro 2 Saídas Embotellados
    let nextMrL2Salidas = live.mrL2Salidas;
    if (!live.mrL2Salidas.some((r) => r.origenSalidaId === newSalida.id)) {
      nextMrL2Salidas = [...live.mrL2Salidas, buildMedioRuralL2SalidaFromSalida(newSalida)].sort(
        (a, b) => a.data.localeCompare(b.data)
      );
    }

    currentStateRef.current = {
      ...live,
      salidas: nextSalidas,
      embotellados: nextEmbotellados,
      aeatProductoElaborado: nextAeatPe,
      mrL2Salidas: nextMrL2Salidas,
    };

    setSalidas(nextSalidas);
    setEmbotellados(nextEmbotellados);
    setAeatProductoElaborado(nextAeatPe);
    setMrL2Salidas(nextMrL2Salidas);

    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l2_salidas', getChangedRecordIds(live.mrL2Salidas, nextMrL2Salidas));

    return newSalida;
  };

  const updateSalida = (id: string, updated: Partial<SalidaRegistro>) => {
    const live = getLiveState();
    const nextSalidas = live.salidas.map((s) => (s.id === id ? { ...s, ...updated } : s));
    const nextEmbotellados = live.embotellados.map((emb) => {
      const totalSalidasParaEsteLote = nextSalidas
        .filter((s) => s.lote === emb.lote || s.embotelladoId === emb.id)
        .reduce((sum, s) => sum + s.cantidadBotellas, 0);
      const disponible = Math.max(0, emb.cantidadBotellas075 - totalSalidasParaEsteLote);
      return emb.botellasDisponibles === disponible
        ? emb
        : { ...emb, botellasDisponibles: disponible };
    });

    const nextAeatPe = syncProductoElaboradoWithBodega(
      live.aeatProductoElaborado,
      {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        embotellados: nextEmbotellados,
        salidas: nextSalidas,
        depositos: live.depositos,
        config: live.bodegaConfig,
      },
      { addMissing: false, updateExisting: true }
    );
    const nextMrL2Salidas = syncMedioRuralLibro2(
      live.mrL2Entradas,
      live.mrL2Salidas,
      { embotellados: nextEmbotellados, salidas: nextSalidas },
      { addMissing: false, updateExisting: true }
    ).salidas;

    currentStateRef.current = {
      ...live,
      salidas: nextSalidas,
      embotellados: nextEmbotellados,
      aeatProductoElaborado: nextAeatPe,
      mrL2Salidas: nextMrL2Salidas,
    };

    setSalidas(nextSalidas);
    setEmbotellados(nextEmbotellados);
    setAeatProductoElaborado(nextAeatPe);
    setMrL2Salidas(nextMrL2Salidas);

    markRecordsDirty('aeat_producto_elaborado', getChangedRecordIds(live.aeatProductoElaborado, nextAeatPe));
    markRecordsDirty('mr_l2_salidas', getChangedRecordIds(live.mrL2Salidas, nextMrL2Salidas));
  };

  const deleteSalida = (id: string): boolean => {
    const live = getLiveState();
    const nextSalidas = live.salidas.filter((s) => s.id !== id);
    const nextAeatPe = recalculateProductoElaboradoBalances(
      live.aeatProductoElaborado.filter(
        (r) => !(r.origenMovimientoId === id && !r.editadoManualmente)
      )
    );
    const nextMrL2Salidas = live.mrL2Salidas.filter(
      (r) => !(r.origenSalidaId === id && !r.editadoManualmente)
    );

    currentStateRef.current = {
      ...live,
      salidas: nextSalidas,
      aeatProductoElaborado: nextAeatPe,
      mrL2Salidas: nextMrL2Salidas,
    };

    setSalidas(nextSalidas);
    setAeatProductoElaborado(nextAeatPe);
    setMrL2Salidas(nextMrL2Salidas);
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
    const live = getLiveState();
    const next = syncMateriasPrimasWithEntradas(
      live.aeatMateriasPrimas,
      live.entradasUva,
      live.bodegaConfig,
      {
        addMissing: true,
        updateExisting: true,
      }
    );
    const addedCount = Math.max(0, next.length - live.aeatMateriasPrimas.length);
    const changedIds = getChangedRecordIds(live.aeatMateriasPrimas, next);
    currentStateRef.current = { ...live, aeatMateriasPrimas: next };
    setAeatMateriasPrimas(next);
    markRecordsDirty('aeat_materias_primas', changedIds);
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
    const live = getLiveState();
    const next = syncProductoElaboradoWithBodega(
      live.aeatProductoElaborado,
      {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        embotellados: live.embotellados,
        salidas: live.salidas,
        depositos: live.depositos,
        config: live.bodegaConfig,
      },
      { addMissing: true, updateExisting: true }
    );
    const addedCount = Math.max(0, next.length - live.aeatProductoElaborado.length);
    const changedIds = getChangedRecordIds(live.aeatProductoElaborado, next);
    currentStateRef.current = { ...live, aeatProductoElaborado: next };
    setAeatProductoElaborado(next);
    markRecordsDirty('aeat_producto_elaborado', changedIds);
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
    const live = getLiveState();
    if (libro === 1) {
      const next = syncMedioRuralLibro1(
        live.mrL1Entradas,
        live.mrL1Salidas,
        {
          entradasUva: live.entradasUva,
          elaboraciones: live.elaboraciones,
          embotellados: live.embotellados,
          depositos: live.depositos,
        },
        { addMissing: true, updateExisting: true }
      );
      const added =
        Math.max(0, next.entradas.length - live.mrL1Entradas.length) +
        Math.max(0, next.salidas.length - live.mrL1Salidas.length);
      const changedEnt = getChangedRecordIds(live.mrL1Entradas, next.entradas);
      const changedSal = getChangedRecordIds(live.mrL1Salidas, next.salidas);
      currentStateRef.current = {
        ...live,
        mrL1Entradas: next.entradas,
        mrL1Salidas: next.salidas,
      };
      setMrL1Entradas(next.entradas);
      setMrL1Salidas(next.salidas);
      markRecordsDirty('mr_l1_entradas', changedEnt);
      markRecordsDirty('mr_l1_salidas', changedSal);
      return added;
    }
    if (libro === 2) {
      const next = syncMedioRuralLibro2(
        live.mrL2Entradas,
        live.mrL2Salidas,
        { embotellados: live.embotellados, salidas: live.salidas },
        { addMissing: true, updateExisting: true }
      );
      const added =
        Math.max(0, next.entradas.length - live.mrL2Entradas.length) +
        Math.max(0, next.salidas.length - live.mrL2Salidas.length);
      const changedEnt = getChangedRecordIds(live.mrL2Entradas, next.entradas);
      const changedSal = getChangedRecordIds(live.mrL2Salidas, next.salidas);
      currentStateRef.current = {
        ...live,
        mrL2Entradas: next.entradas,
        mrL2Salidas: next.salidas,
      };
      setMrL2Entradas(next.entradas);
      setMrL2Salidas(next.salidas);
      markRecordsDirty('mr_l2_entradas', changedEnt);
      markRecordsDirty('mr_l2_salidas', changedSal);
      return added;
    }
    if (libro === 3) {
      const next = syncMedioRuralLibro3(
        live.mrL3Movimientos,
        { elaboraciones: live.elaboraciones, config: live.bodegaConfig },
        { addMissing: true, updateExisting: true }
      );
      const added = Math.max(0, next.length - live.mrL3Movimientos.length);
      const changed = getChangedRecordIds(live.mrL3Movimientos, next);
      currentStateRef.current = { ...live, mrL3Movimientos: next };
      setMrL3Movimientos(next);
      markRecordsDirty('mr_l3_movimientos', changed);
      return added;
    }
    if (libro === 4) {
      const next = syncMedioRuralLibro4(
        live.mrL4Practicas,
        { elaboraciones: live.elaboraciones, depositos: live.depositos },
        { addMissing: true, updateExisting: true }
      );
      const added = Math.max(0, next.length - live.mrL4Practicas.length);
      const changed = getChangedRecordIds(live.mrL4Practicas, next);
      currentStateRef.current = { ...live, mrL4Practicas: next };
      setMrL4Practicas(next);
      markRecordsDirty('mr_l4_practicas', changed);
      return added;
    }
    const next = syncMedioRuralLibro5(
      live.mrL5Procesos,
      {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        depositos: live.depositos,
      },
      { addMissing: true, updateExisting: true }
    );
    const added = Math.max(0, next.length - live.mrL5Procesos.length);
    const changed = getChangedRecordIds(live.mrL5Procesos, next);
    currentStateRef.current = { ...live, mrL5Procesos: next };
    setMrL5Procesos(next);
    markRecordsDirty('mr_l5_procesos', changed);
    return added;
  };

  // ---------------- DECLARACIONES FOGGA (MR441B) E INFOVI (AICA) ----------------
  const upsertFoggaDeclaracion = (dec: FoggaMr441bDeclaracion): FoggaMr441bDeclaracion => {
    const live = getLiveState();
    const idx = live.foggaDeclaraciones.findIndex((item) => item.id === dec.id);
    const nextFogga =
      idx >= 0
        ? live.foggaDeclaraciones.map((item, i) => (i === idx ? dec : item))
        : [dec, ...live.foggaDeclaraciones].sort((a, b) => b.campanaInicio - a.campanaInicio);
    currentStateRef.current = { ...live, foggaDeclaraciones: nextFogga };
    setFoggaDeclaraciones(nextFogga);
    markRecordsDirty('fogga_declaraciones', [dec.id]);
    return dec;
  };

  const deleteFoggaDeclaracion = (id: string) => {
    const live = getLiveState();
    const nextFogga = live.foggaDeclaraciones.filter((item) => item.id !== id);
    currentStateRef.current = { ...live, foggaDeclaraciones: nextFogga };
    setFoggaDeclaraciones(nextFogga);
  };

  const confirmarFoggaPresentada = (
    campanaInicio: number,
    numeroEntrada?: string,
    fechaPresentacion?: string
  ) => {
    const today = fechaPresentacion || getLocalIsoDate();
    const live = getLiveState();
    const existing = live.foggaDeclaraciones.find((d) => d.campanaInicio === campanaInicio);
    let targetId: string;
    let nextFogga: FoggaMr441bDeclaracion[];

    if (existing) {
      targetId = existing.id;
      nextFogga = live.foggaDeclaraciones.map((d) =>
        d.campanaInicio === campanaInicio
          ? {
              ...d,
              estado: 'presentada' as const,
              confirmadaPresentada: true,
              fechaPresentacion: d.fechaPresentacion || today,
              numeroEntrada: numeroEntrada || d.numeroEntrada,
            }
          : d
      );
    } else {
      const { declaracion } = generateFoggaDraftFromVendimia(campanaInicio, {
        entradasUva: live.entradasUva,
        parcelas: live.parcelas,
        bodegaConfig: live.bodegaConfig,
        existingFogga: live.foggaDeclaraciones,
      });
      targetId = declaracion.id;
      nextFogga = [
        {
          ...declaracion,
          estado: 'presentada' as const,
          confirmadaPresentada: true,
          fechaPresentacion: today,
          numeroEntrada: numeroEntrada || declaracion.numeroEntrada,
        },
        ...live.foggaDeclaraciones,
      ].sort((a, b) => b.campanaInicio - a.campanaInicio);
    }

    currentStateRef.current = { ...live, foggaDeclaraciones: nextFogga };
    setFoggaDeclaraciones(nextFogga);
    markRecordsDirty('fogga_declaraciones', [targetId]);
  };

  const upsertInfoviDeclaracion = (dec: InfoviDeclaracion): InfoviDeclaracion => {
    const live = getLiveState();
    const idx = live.infoviDeclaraciones.findIndex((item) => item.id === dec.id);
    const nextInfovi =
      idx >= 0
        ? live.infoviDeclaraciones.map((item, i) => (i === idx ? dec : item))
        : [dec, ...live.infoviDeclaraciones].sort((a, b) => {
            if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
            return a.mes === 'JULIO' ? -1 : 1;
          });
    currentStateRef.current = { ...live, infoviDeclaraciones: nextInfovi };
    setInfoviDeclaraciones(nextInfovi);
    markRecordsDirty('infovi_declaraciones', [dec.id]);
    return dec;
  };

  const deleteInfoviDeclaracion = (id: string) => {
    const live = getLiveState();
    const nextInfovi = live.infoviDeclaraciones.filter((item) => item.id !== id);
    currentStateRef.current = { ...live, infoviDeclaraciones: nextInfovi };
    setInfoviDeclaraciones(nextInfovi);
  };

  const confirmarInfoviPresentada = (campanaInicio: number, mes: InfoviMesPeriodo) => {
    const today = getLocalIsoDate();
    const live = getLiveState();
    const existing = live.infoviDeclaraciones.find(
      (d) => d.campanaInicio === campanaInicio && d.mes === mes
    );
    let targetId: string;
    let nextInfovi: InfoviDeclaracion[];

    if (existing) {
      targetId = existing.id;
      nextInfovi = live.infoviDeclaraciones.map((d) =>
        d.id === existing.id
          ? {
              ...d,
              estado: 'presentada' as const,
              estadoInfovi: 'CERRADA' as const,
              cerradoPor: d.cerradoPor || 'INSTALACIÓN',
              confirmadaPresentada: true,
              fechaUltGrabacion: d.fechaUltGrabacion || today,
              fechaRecepcion: d.fechaRecepcion || today,
            }
          : d
      );
    } else {
      const { declaracion } = generateInfoviDraftFromWinery(campanaInicio, mes, {
        entradasUva: live.entradasUva,
        elaboraciones: live.elaboraciones,
        embotellados: live.embotellados,
        salidas: live.salidas,
        depositos: live.depositos,
        parcelas: live.parcelas,
        bodegaConfig: live.bodegaConfig,
        existingInfovi: live.infoviDeclaraciones,
      });
      targetId = declaracion.id;
      nextInfovi = [
        {
          ...declaracion,
          estado: 'presentada' as const,
          estadoInfovi: 'CERRADA' as const,
          cerradoPor: 'INSTALACIÓN',
          confirmadaPresentada: true,
          fechaUltGrabacion: today,
          fechaRecepcion: today,
        },
        ...live.infoviDeclaraciones,
      ].sort((a, b) => {
        if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
        return a.mes === 'JULIO' ? -1 : 1;
      });
    }

    currentStateRef.current = { ...live, infoviDeclaraciones: nextInfovi };
    setInfoviDeclaraciones(nextInfovi);
    markRecordsDirty('infovi_declaraciones', [targetId]);
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

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
  FoggaMr441bDeclaracion,
  InfoviDeclaracion,
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
} from '../types/winery';
import {
  initialAeatMateriasPrimasSumaAnterior,
  initialBodegaConfig,
  initialDepositos,
  initialMedioRuralL1SumaAnteriorEntradas,
  initialMedioRuralL1SumaAnteriorSalidas,
  initialMedioRuralL2SumaAnterior,
  initialMedioRuralL3SumaAnterior,
} from '../data/initialData';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const SYNC_TABLES = [
  'bodega_config',
  'parcelas',
  'depositos',
  'entradas_uva',
  'elaboraciones',
  'embotellados',
  'salidas',
  'insumos_movimientos',
  'analiticas',
  'appcc_agua',
  'appcc_limpieza',
  'appcc_residuos',
  'appcc_plagas_mantenimiento',
  'appcc_proveedores',
  'appcc_incidencias',
  'aeat_materias_primas_sumas',
  'aeat_materias_primas',
  'aeat_producto_elaborado',
  'mr_l1_sumas',
  'mr_l1_entradas',
  'mr_l1_salidas',
  'mr_l2_sumas',
  'mr_l2_entradas',
  'mr_l2_salidas',
  'mr_l3_sumas',
  'mr_l3_movimientos',
  'mr_l4_practicas',
  'mr_l5_procesos',
  'fogga_declaraciones',
  'infovi_declaraciones',
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

const OPTIONAL_SYNC_TABLES = new Set<SyncTableName>([
  'fogga_declaraciones',
  'infovi_declaraciones',
]);

const isMissingTableError = (error?: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
};

export type DirtyIdsMap = Partial<Record<SyncTableName, string[]>>;

export interface WineryDatabaseState {
  bodegaConfig: BodegaConfig;
  parcelas: Parcela[];
  depositos: Deposito[];
  entradasUva: EntradaUva[];
  elaboraciones: ElaboracionRegistro[];
  embotellados: EmbotelladoRegistro[];
  salidas: SalidaRegistro[];
  insumosMovimientos: MovimientoInsumo[];
  analiticas: AnaliticaRegistro[];
  appccAgua: AppccAguaRegistro[];
  appccLimpieza: AppccLimpiezaRegistro[];
  appccResiduos: AppccResiduoRegistro[];
  appccPlagasMant: AppccPlagaMantenimientoRegistro[];
  appccProveedores: AppccProveedorRegistro[];
  appccIncidencias: AppccIncidenciaRegistro[];
  aeatSumaAnterior: AeatMateriaPrimaSumaAnterior;
  aeatMateriasPrimas: AeatMateriaPrimaRegistro[];
  aeatProductoElaborado: AeatProductoElaboradoRegistro[];
  mrL1SumaEntradas: MedioRuralEntradaSalidaSuma;
  mrL1SumaSalidas: MedioRuralEntradaSalidaSuma;
  mrL1Entradas: MedioRuralEntradaRegistro[];
  mrL1Salidas: MedioRuralSalidaRegistro[];
  mrL2SumaAnterior: MedioRuralEmbotelladoSumaAnterior;
  mrL2Entradas: MedioRuralEmbotelladoEntradaRegistro[];
  mrL2Salidas: MedioRuralEmbotelladoSalidaRegistro[];
  mrL3SumaAnterior: MedioRuralMovProductoSumaAnterior;
  mrL3Movimientos: MedioRuralMovimientoProductoRegistro[];
  mrL4Practicas: MedioRuralPracticaEnologicaRegistro[];
  mrL5Procesos: MedioRuralProcesoElaboracionRegistro[];
  foggaDeclaraciones: FoggaMr441bDeclaracion[];
  infoviDeclaraciones: InfoviDeclaracion[];
}

export type SyncResult =
  | { ok: true; state?: WineryDatabaseState; pushedCount?: number; missingOptionalTables?: SyncTableName[] }
  | { ok: false; errorMessage: string; errorCode?: string };

const UPSERT_ORDER: SyncTableName[] = [...SYNC_TABLES];
const DELETE_ORDER: SyncTableName[] = [...SYNC_TABLES].reverse();

const nullIfEmpty = (v?: string | null): string | null => {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullIfEmptyDate = (v?: string | null): string | null => {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
};

const toNum = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toOptNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toStr = (v: unknown, fallback = ''): string =>
  v === null || v === undefined ? fallback : String(v);

const toOptStr = (v: unknown): string | undefined =>
  v === null || v === undefined || v === '' ? undefined : String(v);

const formatSupabaseError = (table: string, error: { code?: string; message?: string }): string => {
  const code = error.code || '';
  const msg = error.message || 'Error desconocido';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('row-level security')) {
    return `Permiso denegado en Supabase (${table}). Ejecuta las políticas RLS para "anon" en Supabase.`;
  }
  if (code === '42P01' || lower.includes('does not exist')) {
    return `La tabla "${table}" no existe en Supabase. Verifica tu esquema SQL.`;
  }
  if (code === 'PGRST204') {
    return `Columna no encontrada en "${table}": ${msg}`;
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return `Falta un registro relacionado en Supabase para "${table}". Pulsa "Subir todo a la nube" en Configuración.`;
  }
  if (code === '23514' || code === '23502' || code === '22007' || code === '22P02') {
    return `Dato incompatible en "${table}" (${code}): ${msg}`;
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return `Sin respuesta del servidor Supabase (revisa internet o VITE_SUPABASE_URL).`;
  }
  return `Error en ${table}: ${msg}`;
};

// ---------------- MAPPERS: App -> DB Row ----------------

const toConfigRow = (c: BodegaConfig) => ({
  id: 'default',
  nombre_bodega: c.nombreBodega || 'Adega Microparaxes',
  denominacion_origen: c.denominacionOrigen ?? '',
  cif_nif: c.cifNif ?? '',
  numero_registro_vitivinicola: c.numeroRegistroVitivinicola ?? '',
  direccion: c.direccion ?? '',
  localidad: c.localidad ?? '',
  provincia: c.provincia ?? '',
  responsable_tecnico: c.responsableTecnico ?? '',
  ano_campana: toNum(c.anoCampana, new Date().getFullYear()),
});

const toParcelaRow = (p: Parcela) => ({
  id: p.id,
  nombre: p.nombre,
  paraje: p.paraje ?? '',
  superficie_m2: toNum(p.superficieM2),
  total_cepas: p.totalCepas ?? null,
  marco_plantacion: p.marcoPlantacion ?? '',
  altitud_m: toNum(p.altitudM),
  tipo_suelo: p.tipoSuelo ?? '',
  ano_plantacion: toNum(p.anoPlantacion),
  variedades_plantadas: p.variedadesPlantadas || [],
  rendimiento_max_kg: p.rendimientoMaxKg ?? null,
  observaciones: p.observaciones ?? '',
});

const toDepositoRow = (d: Deposito) => ({
  id: d.id,
  codigo: d.codigo,
  nombre: d.nombre,
  tipo_recipiente: d.tipoRecipiente,
  capacidad_litros: toNum(d.capacidadLitros),
  litros_actuales: toNum(d.litrosActuales),
  estado: d.estado,
  ano_cosecha: toNum(d.anoCosecha, new Date().getFullYear()),
  vino_nombre: d.vinoNombre ?? '',
  variedades: d.variedades || [],
  ultima_operacion: d.ultimaOperacion ?? null,
  fecha_ultima_operacion: nullIfEmptyDate(d.fechaUltimaOperacion),
  ubicacion: d.ubicacion ?? '',
  plano: d.plano ?? null,
});

const toEntradaUvaRow = (e: EntradaUva) => ({
  id: e.id,
  fecha: nullIfEmptyDate(e.fecha),
  parcela_id: nullIfEmpty(e.parcelaId),
  parcela_nombre: e.parcelaNombre ?? '',
  desglose_variedades: e.desgloseVariedades || [],
  kg_totales: toNum(e.kgTotales),
  deposito_destino_id: nullIfEmpty(e.depositoDestinoId),
  litros_mosto: toNum(e.litrosMosto),
  rendimiento_real_porcentaje: e.rendimientoRealPorcentaje ?? null,
  tipo_recipiente: e.tipoRecipiente,
  tipo_vino: e.tipoVino,
  anada: e.anada ?? null,
  grado_babo_baume: e.gradoBaboBaume ?? null,
  fecha_registro: e.fechaRegistro || new Date().toISOString(),
});

const toElaboracionRow = (el: ElaboracionRegistro) => ({
  id: el.id,
  fecha: nullIfEmptyDate(el.fecha),
  deposito_origen_id: nullIfEmpty(el.depositoOrigenId),
  deposito_destino_id: nullIfEmpty(el.depositoDestinoId),
  destino_tipo: el.destinoTipo,
  cantidad_litros: toNum(el.cantidadLitros),
  operacion_realizada: el.operacionRealizada,
  tipo_vino: el.tipoVino,
  anada: el.anada ?? null,
  grado_alcoholico: el.gradoAlcoholico ?? null,
  cantidad_sulfitado: el.cantidadSulfitado ?? null,
  detalle_correccion: el.detalleCorreccion ?? null,
  porcentajes_variedades: el.porcentajesVariedades || [],
  temperatura_c: el.temperaturaC ?? null,
  densidad: el.densidad ?? null,
  sulfuroso_libre: el.sulfurosoLibre ?? null,
  observaciones: el.observaciones ?? null,
  fecha_registro: el.fechaRegistro || new Date().toISOString(),
});

const toEmbotelladoRow = (emb: EmbotelladoRegistro) => ({
  id: emb.id,
  fecha: nullIfEmptyDate(emb.fecha),
  marca: emb.marca,
  tipo_vino: emb.tipoVino ?? null,
  anada: emb.anada ?? null,
  deposito_procedencia_id: nullIfEmpty(emb.depositoProcedenciaId),
  cantidad_litros: toNum(emb.cantidadLitros),
  cantidad_botellas_075: toNum(emb.cantidadBotellas075),
  etiquetado: Boolean(emb.etiquetado),
  lote: emb.lote,
  graduacion_alcoholica_vol: emb.graduacionAlcoholicaVol ?? null,
  insumos: emb.insumos,
  botellas_disponibles: toNum(emb.botellasDisponibles),
  observaciones: emb.observaciones ?? null,
  fecha_registro: emb.fechaRegistro || new Date().toISOString(),
});

const toSalidaRow = (s: SalidaRegistro) => ({
  id: s.id,
  fecha: nullIfEmptyDate(s.fecha),
  marca: s.marca,
  lote: s.lote,
  anada: s.anada ?? null,
  grado_alcoholico: s.gradoAlcoholico ?? null,
  embotellado_id: nullIfEmpty(s.embotelladoId),
  cantidad_botellas: toNum(s.cantidadBotellas),
  numero_cajas: s.numeroCajas ?? null,
  destino: s.destino ?? '',
  numero_albaran_factura: s.numeroAlbaranFactura ?? '',
  tipo_salida: s.tipoSalida,
  pvp_unitario: s.pvpUnitario ?? null,
  observaciones: s.observaciones ?? null,
  fecha_registro: s.fechaRegistro || new Date().toISOString(),
});

const toInsumoRow = (m: MovimientoInsumo) => ({
  id: m.id,
  fecha: nullIfEmptyDate(m.fecha),
  tipo_insumo: m.tipoInsumo,
  subtipo: m.subtipo,
  movimiento: m.movimiento,
  cantidad: toNum(m.cantidad),
  proveedor: m.proveedor ?? null,
  lote_proveedor: m.loteProveedor ?? null,
  coste_unitario: m.costeUnitario ?? null,
  observaciones: m.observaciones ?? null,
  embotellado_lote_asociado: m.embotelladoLoteAsociado ?? null,
  fecha_registro: m.fechaRegistro || new Date().toISOString(),
});

const toAnaliticaRow = (a: AnaliticaRegistro) => ({
  id: a.id,
  fecha: nullIfEmptyDate(a.fecha),
  muestra: a.muestra,
  vino_nombre: a.vinoNombre ?? null,
  deposito_id: nullIfEmpty(a.depositoId),
  archivo_origen: a.archivoOrigen ?? null,
  parametros: a.parametros || [],
  observaciones: a.observaciones ?? null,
  fecha_registro: a.fechaRegistro || new Date().toISOString(),
});

const toAppccAguaRow = (r: AppccAguaRegistro) => ({
  id: r.id,
  fecha: nullIfEmptyDate(r.fecha),
  mes_referencia: r.mesReferencia,
  lugar_toma_muestra: r.lugarTomaMuestra,
  organoleptico_conforme: Boolean(r.organolepticoConforme),
  cloro_residual_mg_l: toNum(r.cloroResidualMgL),
  ph: toNum(r.ph, 7.2),
  aspecto: r.aspecto,
  anomalia_suministro: Boolean(r.anomaliaSuministro),
  responsable: r.responsable,
  observaciones: r.observaciones ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAppccLimpiezaRow = (r: AppccLimpiezaRegistro) => ({
  id: r.id,
  fecha: nullIfEmptyDate(r.fecha),
  categoria: r.categoria ?? null,
  zona_equipo: r.zonaEquipo,
  producto_usado: r.productoUsado,
  conforme: Boolean(r.conforme),
  responsable: r.responsable,
  origen_automatico: r.origenAutomatico ?? null,
  referencia_operacion_id: r.referenciaOperacionId ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  observaciones: r.observaciones ?? null,
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAppccResiduoRow = (r: AppccResiduoRegistro) => ({
  id: r.id,
  fecha: nullIfEmptyDate(r.fecha),
  tipo_residuo: r.tipoResiduo,
  cantidad_estimada: r.cantidadEstimada,
  destino: r.destino,
  parcela_destino: r.parcelaDestino ?? null,
  conforme: r.conforme ?? true,
  responsable: r.responsable,
  origen_automatico: r.origenAutomatico ?? null,
  referencia_operacion_id: r.referenciaOperacionId ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  observaciones: r.observaciones ?? null,
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAppccPlagaMantRow = (r: AppccPlagaMantenimientoRegistro) => ({
  id: r.id,
  fecha: nullIfEmptyDate(r.fecha),
  tipo_control: r.tipoControl,
  elemento_zona: r.elementoZona,
  local_instalaciones: r.localInstalaciones ?? null,
  maquinaria_utensilios: r.maquinariaUtensilios ?? null,
  resultado: r.resultado,
  responsable: r.responsable,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  observaciones: r.observaciones ?? null,
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAppccProveedorRow = (r: AppccProveedorRegistro) => ({
  id: r.id,
  proveedor: r.proveedor,
  productos: r.productos,
  localizacion: r.localizacion,
  conforme: Boolean(r.conforme),
  observaciones: r.observaciones ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAppccIncidenciaRow = (r: AppccIncidenciaRegistro) => ({
  id: r.id,
  fecha: nullIfEmptyDate(r.fecha),
  plan_afectado: r.planAfectado,
  descripcion: r.descripcion,
  medida_correctora: r.medidaCorrectora,
  estado: r.estado,
  responsable: r.responsable,
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAeatSumaRow = (s: AeatMateriaPrimaSumaAnterior) => ({
  id: 'default',
  entradas_uvas_kg: toNum(s.entradasUvasKg),
  entradas_bagazos_kg: toNum(s.entradasBagazosKg),
  entradas_mosto_litros: toNum(s.entradasMostoLitros),
  salidas_uvas_kg: toNum(s.salidasUvasKg),
  salidas_bagazos_kg: toNum(s.salidasBagazosKg),
  salidas_mosto_litros: toNum(s.salidasMostoLitros),
  existencias_uvas_kg: toNum(s.existenciasUvasKg),
  existencias_bagazos_kg: toNum(s.existenciasBagazosKg),
  existencias_mosto_litros: toNum(s.existenciasMostoLitros),
});

const toAeatMateriaPrimaRow = (r: AeatMateriaPrimaRegistro) => ({
  id: r.id,
  numero_orden: toNum(r.numeroOrden),
  observaciones: r.observaciones ?? '',
  fecha: nullIfEmptyDate(r.fecha),
  doc_numero: r.docNumero ?? '',
  nif_o_cae: r.nifOCae ?? '',
  grado: r.grado ?? null,
  entradas_uvas_kg: r.entradasUvasKg ?? null,
  entradas_bagazos_kg: r.entradasBagazosKg ?? null,
  entradas_mosto_litros: r.entradasMostoLitros ?? null,
  salidas_uvas_kg: r.salidasUvasKg ?? null,
  salidas_bagazos_kg: r.salidasBagazosKg ?? null,
  salidas_mosto_litros: r.salidasMostoLitros ?? null,
  existencias_uvas_kg: r.existenciasUvasKg ?? null,
  existencias_bagazos_kg: r.existenciasBagazosKg ?? null,
  existencias_mosto_litros: r.existenciasMostoLitros ?? null,
  origen_entrada_id: r.origenEntradaId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toAeatProductoRow = (r: AeatProductoElaboradoRegistro) => ({
  id: r.id,
  numero_asiento: toNum(r.numeroAsiento),
  fecha_movimiento: nullIfEmptyDate(r.fechaMovimiento),
  tipo_movimiento: r.tipoMovimiento ?? '',
  regimen_fiscal: r.regimenFiscal ?? '',
  epigrafe: r.epigrafe ?? '',
  codigo_nc: r.codigoNc ?? '',
  denominacion_producto: r.denominacionProducto ?? '',
  referencia_interna: r.referenciaInterna ?? '',
  variedad: r.variedad ?? '',
  cantidad_producto: toNum(r.cantidadProducto),
  grado_alcoholico: r.gradoAlcoholico ?? null,
  alcohol_puro: r.alcoholPuro ?? null,
  tipo_justificante: r.tipoJustificante ?? '',
  numero_justificante: r.numeroJustificante ?? '',
  tipo_envase: r.tipoEnvase ?? '',
  capacidad_envase: r.capacidadEnvase ?? '',
  numero_envases: r.numeroEnvases ?? null,
  origen_destino_nif: r.origenDestinoNif ?? '',
  origen_destino_razon_social: r.origenDestinoRazonSocial ?? '',
  origen_destino_cae: r.origenDestinoCae ?? '',
  saldo_granel_blanco: r.saldoGranelBlanco ?? null,
  saldo_granel_tinto: r.saldoGranelTinto ?? null,
  saldo_embotellado_blanco: r.saldoEmbotelladoBlanco ?? null,
  saldo_embotellado_tinto: r.saldoEmbotelladoTinto ?? null,
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_tipo: r.origenTipo ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL1SumaRow = (id: 'entradas' | 'salidas', s: MedioRuralEntradaSalidaSuma) => ({
  id,
  mosto_brancos: toNum(s.mostoBrancos),
  mosto_tintos: toNum(s.mostoTintos),
  vino_brancos: toNum(s.vinoBrancos),
  vino_tintos: toNum(s.vinoTintos),
});

const toMrL1EntradaRow = (r: MedioRuralEntradaRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  doc_clase: r.docClase ?? '',
  doc_numero: r.docNumero ?? '',
  procedencia: r.procedencia ?? '',
  zona_viticola: r.zonaViticola ?? '',
  mosto_brancos: r.mostoBrancos ?? null,
  mosto_tintos: r.mostoTintos ?? null,
  vino_brancos: r.vinoBrancos ?? null,
  vino_tintos: r.vinoTintos ?? null,
  outros_designacion: r.outrosDesignacion ?? null,
  outros_cantidade: r.outrosCantidade ?? null,
  graduacion_adquirida: r.graduacionAdquirida ?? null,
  graduacion_total: r.graduacionTotal ?? null,
  observacions: r.observacions ?? '',
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL1SalidaRow = (r: MedioRuralSalidaRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  doc_clase: r.docClase ?? '',
  doc_numero_referencia: r.docNumeroReferencia ?? '',
  destino: r.destino ?? '',
  zona_viticola: r.zonaViticola ?? '',
  mosto_brancos: r.mostoBrancos ?? null,
  mosto_tintos: r.mostoTintos ?? null,
  vino_brancos: r.vinoBrancos ?? null,
  vino_tintos: r.vinoTintos ?? null,
  outros_designacion: r.outrosDesignacion ?? null,
  outros_cantidade: r.outrosCantidade ?? null,
  graduacion_adquirida: r.graduacionAdquirida ?? null,
  graduacion_total: r.graduacionTotal ?? null,
  observacions: r.observacions ?? '',
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL2SumaRow = (s: MedioRuralEmbotelladoSumaAnterior) => ({
  id: 'default',
  entradas_litros: toNum(s.entradasLitros),
  entradas_botellas: toNum(s.entradasBotellas),
  saidas_litros: toNum(s.saidasLitros),
});

const toMrL2EntradaRow = (r: MedioRuralEmbotelladoEntradaRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  designacion_produto: r.designacionProduto ?? '',
  litros: toNum(r.litros),
  num_botellas: toNum(r.numBotellas),
  referencia_precintas: r.referenciaPrecintas ?? '',
  lote: r.lote ?? '',
  encargo_nome_embotellador: r.encargoNomeEmbotellador ?? '',
  encargo_enderezo: r.encargoEnderezo ?? '',
  origen_embotellado_id: r.origenEmbotelladoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL2SalidaRow = (r: MedioRuralEmbotelladoSalidaRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  documento_comercial: r.documentoComercial ?? '',
  litros: toNum(r.litros),
  observacions: r.observacions ?? '',
  origen_salida_id: r.origenSalidaId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL3SumaRow = (s: MedioRuralMovProductoSumaAnterior) => ({
  id: 'default',
  acido_tartarico_entrada_kg: toNum(s.acidoTartaricoEntradaKg),
  acido_tartarico_saida_kg: toNum(s.acidoTartaricoSaidaKg),
  mosto_conc_entrada_litros: toNum(s.mostoConcEntradaLitros),
  mosto_conc_saida_litros: toNum(s.mostoConcSaidaLitros),
  alcohol_entrada_litros: toNum(s.alcoholEntradaLitros),
  alcohol_saida_litros: toNum(s.alcoholSaidaLitros),
  sacarosa_entrada_kg: toNum(s.sacarosaEntradaKg),
  sacarosa_saida_kg: toNum(s.sacarosaSaidaKg),
  outros_entrada_litro_kg: toNum(s.outrosEntradaLitroKg),
  outros_saida_litro_kg: toNum(s.outrosSaidaLitroKg),
});

const toMrL3MovimientoRow = (r: MedioRuralMovimientoProductoRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  procedencia_razon_social: r.procedenciaRazonSocial ?? '',
  procedencia_enderezo: r.procedenciaEnderezo ?? '',
  destino_razon_social: r.destinoRazonSocial ?? '',
  destino_enderezo: r.destinoEnderezo ?? '',
  documento_factura: r.documentoFactura ?? '',
  acido_tartarico_entrada_kg: r.acidoTartaricoEntradaKg ?? null,
  acido_tartarico_saida_kg: r.acidoTartaricoSaidaKg ?? null,
  mosto_conc_concentracion: r.mostoConcConcentracion ?? '',
  mosto_conc_entrada_litros: r.mostoConcEntradaLitros ?? null,
  mosto_conc_saida_litros: r.mostoConcSaidaLitros ?? null,
  alcohol_tipo_grao: r.alcoholTipoGrao ?? '',
  alcohol_entrada_litros: r.alcoholEntradaLitros ?? null,
  alcohol_saida_litros: r.alcoholSaidaLitros ?? null,
  sacarosa_entrada_kg: r.sacarosaEntradaKg ?? null,
  sacarosa_saida_kg: r.sacarosaSaidaKg ?? null,
  outros_produto: r.outrosProduto ?? '',
  outros_grad_concentracion: r.outrosGradConcentracion ?? '',
  outros_entrada_litro_kg: r.outrosEntradaLitroKg ?? null,
  outros_saida_litro_kg: r.outrosSaidaLitroKg ?? null,
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL4PracticaRow = (r: MedioRuralPracticaEnologicaRegistro) => ({
  id: r.id,
  data: nullIfEmptyDate(r.data),
  partida_iden_envases: r.partidaIdenEnvases ?? '',
  partida_produto: r.partidaProduto ?? '',
  partida_litros_utilizados: toNum(r.partidaLitrosUtilizados),
  partida_graduacion_adq: r.partidaGraduacionAdq ?? null,
  partida_graduacion_total: r.partidaGraduacionTotal ?? null,
  partida_acidez_total_gl: r.partidaAcidezTotalGl ?? null,
  sulfitado_produto: r.sulfitadoProduto ?? '',
  sulfitado_dose_gl: r.sulfitadoDoseGl ?? null,
  sulfitado_cantidade_kg: r.sulfitadoCantidadeKg ?? null,
  acid_produto: r.acidProduto ?? '',
  acid_doses_gl: r.acidDosesGl ?? null,
  acid_cantidade_kg: r.acidCantidadeKg ?? null,
  outras_produto: r.outrasProduto ?? '',
  outras_grad_densidade: r.outrasGradDensidade ?? '',
  outras_cantidade_kg_o_l: r.outrasCantidadeKgOL ?? '',
  final_iden_envases: r.finalIdenEnvases ?? '',
  final_produto: r.finalProduto ?? '',
  final_litros_obtidos: toNum(r.finalLitrosObtidos),
  final_graduacion_adq: r.finalGraduacionAdq ?? null,
  final_graduacion_total: r.finalGraduacionTotal ?? null,
  final_acidez_gl: r.finalAcidezGl ?? null,
  observacions: r.observacions ?? '',
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toMrL5ProcesoRow = (r: MedioRuralProcesoElaboracionRegistro) => ({
  id: r.id,
  num: toNum(r.num),
  data_inicio: nullIfEmptyDate(r.dataInicio),
  proceso_codigo: r.procesoCodigo ?? '',
  partida_iden_envases: r.partidaIdenEnvases ?? '',
  partida_produto: r.partidaProduto ?? '',
  partida_litros_utilizados: toNum(r.partidaLitrosUtilizados),
  partida_grad_densidade: r.partidaGradDensidade ?? '',
  incorporado_produto: r.incorporadoProduto ?? '',
  incorporado_grad_densidade: r.incorporadoGradDensidade ?? '',
  incorporado_cantidade_l_kg: r.incorporadoCantidadeLKg ?? '',
  final_iden_envases: r.finalIdenEnvases ?? '',
  final_produto: r.finalProduto ?? '',
  final_litros_obtidos: toNum(r.finalLitrosObtidos),
  final_grad_adq: r.finalGradAdq ?? null,
  final_grad_total: r.finalGradTotal ?? null,
  observacions: r.observacions ?? '',
  origen_movimiento_id: r.origenMovimientoId ?? null,
  origen_automatico: r.origenAutomatico ?? null,
  editado_manualmente: Boolean(r.editadoManualmente),
  fecha_registro: r.fechaRegistro || new Date().toISOString(),
});

const toFoggaDeclaracionRow = (f: FoggaMr441bDeclaracion) => ({
  id: f.id,
  campana_inicio: toNum(f.campanaInicio),
  campana_fin: toNum(f.campanaFin),
  tipo_declaracion: f.tipoDeclaracion,
  codev: f.codev ?? '',
  vinedo_sito_en: f.vinedoSitoEn ?? '',
  concellos: f.concellos ?? '',
  declarante: f.declarante,
  cadro_a: f.cadroA,
  cadro_b: f.cadroB,
  cadro_c: f.cadroC || [],
  estado: f.estado,
  confirmada_presentada: Boolean(f.confirmadaPresentada),
  fecha_presentacion: nullIfEmptyDate(f.fechaPresentacion),
  hora_presentacion: f.horaPresentacion ?? null,
  numero_entrada: f.numeroEntrada ?? null,
  metodo_firma: f.metodoFirma ?? null,
  lugar_firma: f.lugarFirma ?? null,
  xefatura_territorial: f.xefaturaTerritorial ?? null,
  observaciones: f.observaciones ?? null,
  origen_datos: f.origenDatos ?? null,
  fecha_registro: f.fechaRegistro || new Date().toISOString(),
});

const toInfoviDeclaracionRow = (d: InfoviDeclaracion) => ({
  id: d.id,
  campana: d.campana,
  campana_inicio: toNum(d.campanaInicio),
  mes: d.mes,
  operador: d.operador,
  produccion_media_hl: toNum(d.produccionMediaHl),
  estado_infovi: d.estadoInfovi,
  cerrado_por: d.cerradoPor ?? '',
  fecha_ult_grabacion: nullIfEmptyDate(d.fechaUltGrabacion),
  fecha_recepcion: nullIfEmptyDate(d.fechaRecepcion),
  fecha_impresion: nullIfEmptyDate(d.fechaImpresion),
  entrada_uva_kg: d.entradaUvaKg,
  cuadro_h: d.cuadroH,
  cuadro_i: d.cuadroI,
  cuadro_j: d.cuadroJ,
  cuadro_k: d.cuadroK,
  mosto: d.mosto,
  observaciones: d.observaciones ?? '',
  estado: d.estado,
  confirmada_presentada: Boolean(d.confirmadaPresentada),
  origen_datos: d.origenDatos ?? null,
  fecha_registro: d.fechaRegistro || new Date().toISOString(),
});

// ---------------- MAPPERS: DB Row -> App ----------------

const fromConfigRow = (r: any): BodegaConfig => ({
  nombreBodega: toStr(r.nombre_bodega, 'Adega Microparaxes'),
  denominacionOrigen: toStr(r.denominacion_origen),
  cifNif: toStr(r.cif_nif),
  numeroRegistroVitivinicola: toStr(r.numero_registro_vitivinicola),
  direccion: toStr(r.direccion),
  localidad: toStr(r.localidad),
  provincia: toStr(r.provincia),
  responsableTecnico: toStr(r.responsable_tecnico),
  anoCampana: toNum(r.ano_campana, new Date().getFullYear()),
});

const fromParcelaRow = (r: any): Parcela => ({
  id: toStr(r.id),
  nombre: toStr(r.nombre),
  paraje: toStr(r.paraje),
  superficieM2: toNum(r.superficie_m2),
  totalCepas: toOptNum(r.total_cepas),
  marcoPlantacion: toOptStr(r.marco_plantacion),
  altitudM: toNum(r.altitud_m),
  tipoSuelo: toStr(r.tipo_suelo),
  anoPlantacion: toNum(r.ano_plantacion),
  variedadesPlantadas: Array.isArray(r.variedades_plantadas) ? r.variedades_plantadas : [],
  rendimientoMaxKg: toOptNum(r.rendimiento_max_kg),
  observaciones: toOptStr(r.observaciones),
});

const fromDepositoRow = (r: any): Deposito => ({
  id: toStr(r.id),
  codigo: toStr(r.codigo),
  nombre: toStr(r.nombre),
  tipoRecipiente: r.tipo_recipiente,
  capacidadLitros: toNum(r.capacidad_litros),
  litrosActuales: toNum(r.litros_actuales),
  estado: r.estado,
  anoCosecha: toNum(r.ano_cosecha, new Date().getFullYear()),
  vinoNombre: toStr(r.vino_nombre),
  variedades: Array.isArray(r.variedades) ? r.variedades : [],
  ultimaOperacion: toOptStr(r.ultima_operacion),
  fechaUltimaOperacion: toOptStr(r.fecha_ultima_operacion),
  ubicacion: toOptStr(r.ubicacion),
  plano: r.plano ?? undefined,
});

const fromEntradaUvaRow = (r: any): EntradaUva => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  parcelaId: toStr(r.parcela_id),
  parcelaNombre: toStr(r.parcela_nombre),
  desgloseVariedades: Array.isArray(r.desglose_variedades) ? r.desglose_variedades : [],
  kgTotales: toNum(r.kg_totales),
  depositoDestinoId: toStr(r.deposito_destino_id),
  litrosMosto: toNum(r.litros_mosto),
  rendimientoRealPorcentaje: toOptNum(r.rendimiento_real_porcentaje),
  tipoRecipiente: r.tipo_recipiente,
  tipoVino: r.tipo_vino,
  anada: toOptNum(r.anada),
  gradoBaboBaume: toOptNum(r.grado_babo_baume),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromElaboracionRow = (r: any): ElaboracionRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  depositoOrigenId: toStr(r.deposito_origen_id),
  depositoDestinoId: toOptStr(r.deposito_destino_id),
  destinoTipo: r.destino_tipo,
  cantidadLitros: toNum(r.cantidad_litros),
  operacionRealizada: r.operacion_realizada,
  tipoVino: r.tipo_vino,
  anada: toOptNum(r.anada),
  gradoAlcoholico: toOptNum(r.grado_alcoholico),
  cantidadSulfitado: toOptStr(r.cantidad_sulfitado),
  detalleCorreccion: toOptStr(r.detalle_correccion),
  porcentajesVariedades: Array.isArray(r.porcentajes_variedades) ? r.porcentajes_variedades : [],
  temperaturaC: toOptNum(r.temperatura_c),
  densidad: toOptNum(r.densidad),
  sulfurosoLibre: toOptNum(r.sulfuroso_libre),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromEmbotelladoRow = (r: any): EmbotelladoRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  marca: r.marca,
  tipoVino: r.tipo_vino ?? undefined,
  anada: toOptNum(r.anada),
  depositoProcedenciaId: toStr(r.deposito_procedencia_id),
  cantidadLitros: toNum(r.cantidad_litros),
  cantidadBotellas075: toNum(r.cantidad_botellas_075),
  etiquetado: Boolean(r.etiquetado),
  lote: toStr(r.lote),
  graduacionAlcoholicaVol: toOptNum(r.graduacion_alcoholica_vol),
  insumos: r.insumos || {
    tipoCorcho: 'natural',
    tipoBotella: 'verde',
    lacre: false,
    tipoEtiqueta: 'xouba',
    tipoCaja: '6 botellas',
  },
  botellasDisponibles: toNum(r.botellas_disponibles),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromSalidaRow = (r: any): SalidaRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  marca: r.marca,
  lote: toStr(r.lote),
  anada: toOptNum(r.anada),
  gradoAlcoholico: toOptNum(r.grado_alcoholico),
  embotelladoId: toOptStr(r.embotellado_id),
  cantidadBotellas: toNum(r.cantidad_botellas),
  numeroCajas: toOptNum(r.numero_cajas),
  destino: toStr(r.destino),
  numeroAlbaranFactura: toStr(r.numero_albaran_factura),
  tipoSalida: r.tipo_salida,
  pvpUnitario: toOptNum(r.pvp_unitario),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromInsumoRow = (r: any): MovimientoInsumo => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  tipoInsumo: r.tipo_insumo,
  subtipo: toStr(r.subtipo),
  movimiento: r.movimiento,
  cantidad: toNum(r.cantidad),
  proveedor: toOptStr(r.proveedor),
  loteProveedor: toOptStr(r.lote_proveedor),
  costeUnitario: toOptNum(r.coste_unitario),
  observaciones: toOptStr(r.observaciones),
  embotelladoLoteAsociado: toOptStr(r.embotellado_lote_asociado),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAnaliticaRow = (r: any): AnaliticaRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  muestra: toStr(r.muestra),
  vinoNombre: toOptStr(r.vino_nombre),
  depositoId: toOptStr(r.deposito_id),
  archivoOrigen: toOptStr(r.archivo_origen),
  parametros: Array.isArray(r.parametros) ? r.parametros : [],
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccAguaRow = (r: any): AppccAguaRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  mesReferencia: toStr(r.mes_referencia),
  lugarTomaMuestra: toStr(r.lugar_toma_muestra),
  organolepticoConforme: Boolean(r.organoleptico_conforme),
  cloroResidualMgL: toNum(r.cloro_residual_mg_l),
  ph: toNum(r.ph, 7.2),
  aspecto: toStr(r.aspecto),
  anomaliaSuministro: Boolean(r.anomalia_suministro),
  responsable: toStr(r.responsable),
  observaciones: toOptStr(r.observaciones),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccLimpiezaRow = (r: any): AppccLimpiezaRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  categoria: r.categoria ?? undefined,
  zonaEquipo: toStr(r.zona_equipo),
  productoUsado: toStr(r.producto_usado),
  conforme: Boolean(r.conforme),
  responsable: toStr(r.responsable),
  origenAutomatico: r.origen_automatico ?? undefined,
  referenciaOperacionId: toOptStr(r.referencia_operacion_id),
  editadoManualmente: Boolean(r.editado_manualmente),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccResiduoRow = (r: any): AppccResiduoRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  tipoResiduo: r.tipo_residuo,
  cantidadEstimada: toStr(r.cantidad_estimada),
  destino: toStr(r.destino),
  parcelaDestino: toOptStr(r.parcela_destino),
  conforme: r.conforme ?? true,
  responsable: toStr(r.responsable),
  origenAutomatico: r.origen_automatico ?? undefined,
  referenciaOperacionId: toOptStr(r.referencia_operacion_id),
  editadoManualmente: Boolean(r.editado_manualmente),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccPlagaMantRow = (r: any): AppccPlagaMantenimientoRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  tipoControl: r.tipo_control,
  elementoZona: toStr(r.elemento_zona),
  localInstalaciones: toOptStr(r.local_instalaciones),
  maquinariaUtensilios: toOptStr(r.maquinaria_utensilios),
  resultado: r.resultado,
  responsable: toStr(r.responsable),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  observaciones: toOptStr(r.observaciones),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccProveedorRow = (r: any): AppccProveedorRegistro => ({
  id: toStr(r.id),
  proveedor: toStr(r.proveedor),
  productos: toStr(r.productos),
  localizacion: toStr(r.localizacion),
  conforme: Boolean(r.conforme),
  observaciones: toOptStr(r.observaciones),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAppccIncidenciaRow = (r: any): AppccIncidenciaRegistro => ({
  id: toStr(r.id),
  fecha: toStr(r.fecha),
  planAfectado: toStr(r.plan_afectado),
  descripcion: toStr(r.descripcion),
  medidaCorrectora: toStr(r.medida_correctora),
  estado: r.estado,
  responsable: toStr(r.responsable),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAeatSumaRow = (r: any): AeatMateriaPrimaSumaAnterior => ({
  entradasUvasKg: toNum(r.entradas_uvas_kg),
  entradasBagazosKg: toNum(r.entradas_bagazos_kg),
  entradasMostoLitros: toNum(r.entradas_mosto_litros),
  salidasUvasKg: toNum(r.salidas_uvas_kg),
  salidasBagazosKg: toNum(r.salidas_bagazos_kg),
  salidasMostoLitros: toNum(r.salidas_mosto_litros),
  existenciasUvasKg: toNum(r.existencias_uvas_kg),
  existenciasBagazosKg: toNum(r.existencias_bagazos_kg),
  existenciasMostoLitros: toNum(r.existencias_mosto_litros),
});

const fromAeatMateriaPrimaRow = (r: any): AeatMateriaPrimaRegistro => ({
  id: toStr(r.id),
  numeroOrden: toNum(r.numero_orden),
  observaciones: toStr(r.observaciones),
  fecha: toStr(r.fecha),
  docNumero: toStr(r.doc_numero),
  nifOCae: toStr(r.nif_o_cae),
  grado: toOptNum(r.grado),
  entradasUvasKg: toOptNum(r.entradas_uvas_kg),
  entradasBagazosKg: toOptNum(r.entradas_bagazos_kg),
  entradasMostoLitros: toOptNum(r.entradas_mosto_litros),
  salidasUvasKg: toOptNum(r.salidas_uvas_kg),
  salidasBagazosKg: toOptNum(r.salidas_bagazos_kg),
  salidasMostoLitros: toOptNum(r.salidas_mosto_litros),
  existenciasUvasKg: toOptNum(r.existencias_uvas_kg),
  existenciasBagazosKg: toOptNum(r.existencias_bagazos_kg),
  existenciasMostoLitros: toOptNum(r.existencias_mosto_litros),
  origenEntradaId: toOptStr(r.origen_entrada_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromAeatProductoRow = (r: any): AeatProductoElaboradoRegistro => ({
  id: toStr(r.id),
  numeroAsiento: toNum(r.numero_asiento),
  fechaMovimiento: toStr(r.fecha_movimiento),
  tipoMovimiento: toStr(r.tipo_movimiento),
  regimenFiscal: toStr(r.regimen_fiscal),
  epigrafe: toStr(r.epigrafe),
  codigoNc: toStr(r.codigo_nc),
  denominacionProducto: toStr(r.denominacion_producto),
  referenciaInterna: toStr(r.referencia_interna),
  variedad: toStr(r.variedad),
  cantidadProducto: toNum(r.cantidad_producto),
  gradoAlcoholico: toOptNum(r.grado_alcoholico),
  alcoholPuro: toOptNum(r.alcohol_puro),
  tipoJustificante: toStr(r.tipo_justificante),
  numeroJustificante: toStr(r.numero_justificante),
  tipoEnvase: toStr(r.tipo_envase),
  capacidadEnvase: toStr(r.capacidad_envase),
  numeroEnvases: toOptNum(r.numero_envases),
  origenDestinoNif: toStr(r.origen_destino_nif),
  origenDestinoRazonSocial: toStr(r.origen_destino_razon_social),
  origenDestinoCae: toStr(r.origen_destino_cae),
  saldoGranelBlanco: toOptNum(r.saldo_granel_blanco),
  saldoGranelTinto: toOptNum(r.saldo_granel_tinto),
  saldoEmbotelladoBlanco: toOptNum(r.saldo_embotellado_blanco),
  saldoEmbotelladoTinto: toOptNum(r.saldo_embotellado_tinto),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenTipo: r.origen_tipo ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL1SumaRow = (r: any): MedioRuralEntradaSalidaSuma => ({
  mostoBrancos: toNum(r.mosto_brancos),
  mostoTintos: toNum(r.mosto_tintos),
  vinoBrancos: toNum(r.vino_brancos),
  vinoTintos: toNum(r.vino_tintos),
});

const fromMrL1EntradaRow = (r: any): MedioRuralEntradaRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  docClase: toStr(r.doc_clase),
  docNumero: toStr(r.doc_numero),
  procedencia: toStr(r.procedencia),
  zonaViticola: toStr(r.zona_viticola),
  mostoBrancos: toOptNum(r.mosto_brancos),
  mostoTintos: toOptNum(r.mosto_tintos),
  vinoBrancos: toOptNum(r.vino_brancos),
  vinoTintos: toOptNum(r.vino_tintos),
  outrosDesignacion: toOptStr(r.outros_designacion),
  outrosCantidade: toOptStr(r.outros_cantidade),
  graduacionAdquirida: toOptNum(r.graduacion_adquirida),
  graduacionTotal: toOptNum(r.graduacion_total),
  observacions: toStr(r.observacions),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL1SalidaRow = (r: any): MedioRuralSalidaRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  docClase: toStr(r.doc_clase),
  docNumeroReferencia: toStr(r.doc_numero_referencia),
  destino: toStr(r.destino),
  zonaViticola: toStr(r.zona_viticola),
  mostoBrancos: toOptNum(r.mosto_brancos),
  mostoTintos: toOptNum(r.mosto_tintos),
  vinoBrancos: toOptNum(r.vino_brancos),
  vinoTintos: toOptNum(r.vino_tintos),
  outrosDesignacion: toOptStr(r.outros_designacion),
  outrosCantidade: toOptStr(r.outros_cantidade),
  graduacionAdquirida: toOptNum(r.graduacion_adquirida),
  graduacionTotal: toOptNum(r.graduacion_total),
  observacions: toStr(r.observacions),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL2SumaRow = (r: any): MedioRuralEmbotelladoSumaAnterior => ({
  entradasLitros: toNum(r.entradas_litros),
  entradasBotellas: toNum(r.entradas_botellas),
  saidasLitros: toNum(r.saidas_litros),
});

const fromMrL2EntradaRow = (r: any): MedioRuralEmbotelladoEntradaRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  designacionProduto: toStr(r.designacion_produto),
  litros: toNum(r.litros),
  numBotellas: toNum(r.num_botellas),
  referenciaPrecintas: toStr(r.referencia_precintas),
  lote: toStr(r.lote),
  encargoNomeEmbotellador: toStr(r.encargo_nome_embotellador),
  encargoEnderezo: toStr(r.encargo_enderezo),
  origenEmbotelladoId: toOptStr(r.origen_embotellado_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL2SalidaRow = (r: any): MedioRuralEmbotelladoSalidaRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  documentoComercial: toStr(r.documento_comercial),
  litros: toNum(r.litros),
  observacions: toStr(r.observacions),
  origenSalidaId: toOptStr(r.origen_salida_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL3SumaRow = (r: any): MedioRuralMovProductoSumaAnterior => ({
  acidoTartaricoEntradaKg: toNum(r.acido_tartarico_entrada_kg),
  acidoTartaricoSaidaKg: toNum(r.acido_tartarico_saida_kg),
  mostoConcEntradaLitros: toNum(r.mosto_conc_entrada_litros),
  mostoConcSaidaLitros: toNum(r.mosto_conc_saida_litros),
  alcoholEntradaLitros: toNum(r.alcohol_entrada_litros),
  alcoholSaidaLitros: toNum(r.alcohol_saida_litros),
  sacarosaEntradaKg: toNum(r.sacarosa_entrada_kg),
  sacarosaSaidaKg: toNum(r.sacarosa_saida_kg),
  outrosEntradaLitroKg: toNum(r.outros_entrada_litro_kg),
  outrosSaidaLitroKg: toNum(r.outros_saida_litro_kg),
});

const fromMrL3MovimientoRow = (r: any): MedioRuralMovimientoProductoRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  procedenciaRazonSocial: toStr(r.procedencia_razon_social),
  procedenciaEnderezo: toStr(r.procedencia_enderezo),
  destinoRazonSocial: toStr(r.destino_razon_social),
  destinoEnderezo: toStr(r.destino_enderezo),
  documentoFactura: toStr(r.documento_factura),
  acidoTartaricoEntradaKg: toOptNum(r.acido_tartarico_entrada_kg),
  acidoTartaricoSaidaKg: toOptNum(r.acido_tartarico_saida_kg),
  mostoConcConcentracion: toStr(r.mosto_conc_concentracion),
  mostoConcEntradaLitros: toOptNum(r.mosto_conc_entrada_litros),
  mostoConcSaidaLitros: toOptNum(r.mosto_conc_saida_litros),
  alcoholTipoGrao: toStr(r.alcohol_tipo_grao),
  alcoholEntradaLitros: toOptNum(r.alcohol_entrada_litros),
  alcoholSaidaLitros: toOptNum(r.alcohol_saida_litros),
  sacarosaEntradaKg: toOptNum(r.sacarosa_entrada_kg),
  sacarosaSaidaKg: toOptNum(r.sacarosa_saida_kg),
  outrosProduto: toStr(r.outros_produto),
  outrosGradConcentracion: toStr(r.outros_grad_concentracion),
  outrosEntradaLitroKg: toOptNum(r.outros_entrada_litro_kg),
  outrosSaidaLitroKg: toOptNum(r.outros_saida_litro_kg),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL4PracticaRow = (r: any): MedioRuralPracticaEnologicaRegistro => ({
  id: toStr(r.id),
  data: toStr(r.data),
  partidaIdenEnvases: toStr(r.partida_iden_envases),
  partidaProduto: toStr(r.partida_produto),
  partidaLitrosUtilizados: toNum(r.partida_litros_utilizados),
  partidaGraduacionAdq: toOptNum(r.partida_graduacion_adq),
  partidaGraduacionTotal: toOptNum(r.partida_graduacion_total),
  partidaAcidezTotalGl: toOptNum(r.partida_acidez_total_gl),
  sulfitadoProduto: toStr(r.sulfitado_produto),
  sulfitadoDoseGl: toOptNum(r.sulfitado_dose_gl),
  sulfitadoCantidadeKg: toOptNum(r.sulfitado_cantidade_kg),
  acidProduto: toStr(r.acid_produto),
  acidDosesGl: toOptNum(r.acid_doses_gl),
  acidCantidadeKg: toOptNum(r.acid_cantidade_kg),
  outrasProduto: toStr(r.outras_produto),
  outrasGradDensidade: toStr(r.outras_grad_densidade),
  outrasCantidadeKgOL: toStr(r.outras_cantidade_kg_o_l),
  finalIdenEnvases: toStr(r.final_iden_envases),
  finalProduto: toStr(r.final_produto),
  finalLitrosObtidos: toNum(r.final_litros_obtidos),
  finalGraduacionAdq: toOptNum(r.final_graduacion_adq),
  finalGraduacionTotal: toOptNum(r.final_graduacion_total),
  finalAcidezGl: toOptNum(r.final_acidez_gl),
  observacions: toStr(r.observacions),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromMrL5ProcesoRow = (r: any): MedioRuralProcesoElaboracionRegistro => ({
  id: toStr(r.id),
  num: toNum(r.num),
  dataInicio: toStr(r.data_inicio),
  procesoCodigo: toStr(r.proceso_codigo),
  partidaIdenEnvases: toStr(r.partida_iden_envases),
  partidaProduto: toStr(r.partida_produto),
  partidaLitrosUtilizados: toNum(r.partida_litros_utilizados),
  partidaGradDensidade: toStr(r.partida_grad_densidade),
  incorporadoProduto: toStr(r.incorporado_produto),
  incorporadoGradDensidade: toStr(r.incorporado_grad_densidade),
  incorporadoCantidadeLKg: toStr(r.incorporado_cantidade_l_kg),
  finalIdenEnvases: toStr(r.final_iden_envases),
  finalProduto: toStr(r.final_produto),
  finalLitrosObtidos: toNum(r.final_litros_obtidos),
  finalGradAdq: toOptNum(r.final_grad_adq),
  finalGradTotal: toOptNum(r.final_grad_total),
  observacions: toStr(r.observacions),
  origenMovimientoId: toOptStr(r.origen_movimiento_id),
  origenAutomatico: r.origen_automatico ?? undefined,
  editadoManualmente: Boolean(r.editado_manualmente),
  fechaRegistro: toStr(r.fecha_registro),
});

const fromFoggaDeclaracionRow = (r: any): FoggaMr441bDeclaracion => ({
  id: toStr(r.id),
  campanaInicio: toNum(r.campana_inicio),
  campanaFin: toNum(r.campana_fin),
  tipoDeclaracion: r.tipo_declaracion || 'Modificación',
  codev: toStr(r.codev),
  vinedoSitoEn: toStr(r.vinedo_sito_en),
  concellos: toStr(r.concellos),
  declarante: r.declarante || {},
  cadroA: r.cadro_a || {},
  cadroB: r.cadro_b || {},
  cadroC: Array.isArray(r.cadro_c) ? r.cadro_c : [],
  estado: r.estado === 'presentada' ? 'presentada' : 'borrador',
  confirmadaPresentada: Boolean(r.confirmada_presentada),
  fechaPresentacion: toOptStr(r.fecha_presentacion),
  horaPresentacion: toOptStr(r.hora_presentacion),
  numeroEntrada: toOptStr(r.numero_entrada),
  metodoFirma: toOptStr(r.metodo_firma),
  lugarFirma: toOptStr(r.lugar_firma),
  xefaturaTerritorial: toOptStr(r.xefatura_territorial),
  observaciones: toOptStr(r.observaciones),
  origenDatos: r.origen_datos ?? undefined,
  fechaRegistro: toStr(r.fecha_registro),
});

const fromInfoviDeclaracionRow = (r: any): InfoviDeclaracion => ({
  id: toStr(r.id),
  campana: toStr(r.campana),
  campanaInicio: toNum(r.campana_inicio),
  mes: r.mes === 'JULIO' ? 'JULIO' : 'NOVIEMBRE',
  operador: r.operador || {},
  produccionMediaHl: toNum(r.produccion_media_hl),
  estadoInfovi: r.estado_infovi === 'CERRADA' ? 'CERRADA' : 'BORRADOR',
  cerradoPor: toStr(r.cerrado_por),
  fechaUltGrabacion: toOptStr(r.fecha_ult_grabacion),
  fechaRecepcion: toOptStr(r.fecha_recepcion),
  fechaImpresion: toOptStr(r.fecha_impresion),
  entradaUvaKg: r.entrada_uva_kg || { tinta: 0, blanca: 0 },
  cuadroH: r.cuadro_h || {},
  cuadroI: r.cuadro_i || {},
  cuadroJ: r.cuadro_j || {},
  cuadroK: r.cuadro_k || {},
  mosto: r.mosto || {},
  observaciones: toStr(r.observaciones),
  estado: r.estado === 'presentada' ? 'presentada' : 'borrador',
  confirmadaPresentada: Boolean(r.confirmada_presentada),
  origenDatos: r.origen_datos ?? undefined,
  fechaRegistro: toStr(r.fecha_registro),
});

// ---------------- SYNC ENGINE ----------------

const buildTableRows = (table: SyncTableName, state: WineryDatabaseState, filterIds?: Set<string>): any[] => {
  const byId = <T extends { id: string }>(items: T[]) =>
    filterIds ? items.filter((item) => filterIds.has(item.id)) : items;

  switch (table) {
    case 'bodega_config':
      return !filterIds || filterIds.has('default') ? [toConfigRow(state.bodegaConfig)] : [];
    case 'parcelas':
      return byId(state.parcelas).map(toParcelaRow);
    case 'depositos':
      return byId(state.depositos).map(toDepositoRow);
    case 'entradas_uva':
      return byId(state.entradasUva).map(toEntradaUvaRow);
    case 'elaboraciones':
      return byId(state.elaboraciones).map(toElaboracionRow);
    case 'embotellados':
      return byId(state.embotellados).map(toEmbotelladoRow);
    case 'salidas':
      return byId(state.salidas).map(toSalidaRow);
    case 'insumos_movimientos':
      return byId(state.insumosMovimientos).map(toInsumoRow);
    case 'analiticas':
      return byId(state.analiticas).map(toAnaliticaRow);
    case 'appcc_agua':
      return byId(state.appccAgua).map(toAppccAguaRow);
    case 'appcc_limpieza':
      return byId(state.appccLimpieza).map(toAppccLimpiezaRow);
    case 'appcc_residuos':
      return byId(state.appccResiduos).map(toAppccResiduoRow);
    case 'appcc_plagas_mantenimiento':
      return byId(state.appccPlagasMant).map(toAppccPlagaMantRow);
    case 'appcc_proveedores':
      return byId(state.appccProveedores).map(toAppccProveedorRow);
    case 'appcc_incidencias':
      return byId(state.appccIncidencias).map(toAppccIncidenciaRow);
    case 'aeat_materias_primas_sumas':
      return !filterIds || filterIds.has('default') ? [toAeatSumaRow(state.aeatSumaAnterior)] : [];
    case 'aeat_materias_primas':
      return byId(state.aeatMateriasPrimas).map(toAeatMateriaPrimaRow);
    case 'aeat_producto_elaborado':
      return byId(state.aeatProductoElaborado).map(toAeatProductoRow);
    case 'mr_l1_sumas': {
      const rows: any[] = [];
      if (!filterIds || filterIds.has('entradas')) rows.push(toMrL1SumaRow('entradas', state.mrL1SumaEntradas));
      if (!filterIds || filterIds.has('salidas')) rows.push(toMrL1SumaRow('salidas', state.mrL1SumaSalidas));
      return rows;
    }
    case 'mr_l1_entradas':
      return byId(state.mrL1Entradas).map(toMrL1EntradaRow);
    case 'mr_l1_salidas':
      return byId(state.mrL1Salidas).map(toMrL1SalidaRow);
    case 'mr_l2_sumas':
      return !filterIds || filterIds.has('default') ? [toMrL2SumaRow(state.mrL2SumaAnterior)] : [];
    case 'mr_l2_entradas':
      return byId(state.mrL2Entradas).map(toMrL2EntradaRow);
    case 'mr_l2_salidas':
      return byId(state.mrL2Salidas).map(toMrL2SalidaRow);
    case 'mr_l3_sumas':
      return !filterIds || filterIds.has('default') ? [toMrL3SumaRow(state.mrL3SumaAnterior)] : [];
    case 'mr_l3_movimientos':
      return byId(state.mrL3Movimientos).map(toMrL3MovimientoRow);
    case 'mr_l4_practicas':
      return byId(state.mrL4Practicas).map(toMrL4PracticaRow);
    case 'mr_l5_procesos':
      return byId(state.mrL5Procesos).map(toMrL5ProcesoRow);
    case 'fogga_declaraciones':
      return byId(state.foggaDeclaraciones).map(toFoggaDeclaracionRow);
    case 'infovi_declaraciones':
      return byId(state.infoviDeclaraciones).map(toInfoviDeclaracionRow);
  }
};

const augmentDirtyWithParentDependencies = (
  state: WineryDatabaseState,
  dirtyIds: DirtyIdsMap
): DirtyIdsMap => {
  const next: DirtyIdsMap = {};
  SYNC_TABLES.forEach((t) => {
    if (dirtyIds[t]?.length) next[t] = [...dirtyIds[t]!];
  });

  const addParent = (table: SyncTableName, id?: string | null) => {
    const clean = id?.trim();
    if (!clean) return;
    const list = next[table] || [];
    if (!list.includes(clean)) {
      next[table] = [...list, clean];
    }
  };

  if (next.entradas_uva?.length) {
    const dirtySet = new Set(next.entradas_uva);
    state.entradasUva.forEach((e) => {
      if (dirtySet.has(e.id)) {
        addParent('parcelas', e.parcelaId);
        addParent('depositos', e.depositoDestinoId);
      }
    });
  }

  if (next.elaboraciones?.length) {
    const dirtySet = new Set(next.elaboraciones);
    state.elaboraciones.forEach((el) => {
      if (dirtySet.has(el.id)) {
        addParent('depositos', el.depositoOrigenId);
        addParent('depositos', el.depositoDestinoId);
      }
    });
  }

  if (next.embotellados?.length) {
    const dirtySet = new Set(next.embotellados);
    state.embotellados.forEach((emb) => {
      if (dirtySet.has(emb.id)) {
        addParent('depositos', emb.depositoProcedenciaId);
      }
    });
  }

  if (next.salidas?.length) {
    const dirtySet = new Set(next.salidas);
    const embMap = new Map(state.embotellados.map((emb) => [emb.id, emb]));
    state.salidas.forEach((sal) => {
      if (dirtySet.has(sal.id) && sal.embotelladoId) {
        addParent('embotellados', sal.embotelladoId);
        const parentEmb = embMap.get(sal.embotelladoId);
        if (parentEmb) {
          addParent('depositos', parentEmb.depositoProcedenciaId);
        }
      }
    });
  }

  if (next.analiticas?.length) {
    const dirtySet = new Set(next.analiticas);
    state.analiticas.forEach((a) => {
      if (dirtySet.has(a.id)) {
        addParent('depositos', a.depositoId);
      }
    });
  }

  return next;
};

export const pushChangesToSupabase = async (
  state: WineryDatabaseState,
  dirtyIds: DirtyIdsMap,
  pendingDeletes: DirtyIdsMap,
  forceAll = false
): Promise<SyncResult> => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      errorMessage: 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.',
    };
  }

  let pushedCount = 0;

  try {
    // 1. Check if remote depositos table is empty (brand-new DB needs base vessels & config seeded for FKs)
    const { data: remoteDepsCheck, error: checkError } = await supabase
      .from('depositos')
      .select('id')
      .limit(1);

    if (checkError) {
      return {
        ok: false,
        errorCode: checkError.code,
        errorMessage: formatSupabaseError('depositos', checkError),
      };
    }

    const isRemoteVesselsEmpty = !remoteDepsCheck || remoteDepsCheck.length === 0;
    const effectiveDirtyIds = forceAll ? dirtyIds : augmentDirtyWithParentDependencies(state, dirtyIds);

    // 2. Delete pendingDeletes in reverse FK order (child -> parent)
    for (const table of DELETE_ORDER) {
      const ids = pendingDeletes[table];
      if (!ids || ids.length === 0) continue;
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) {
        if (OPTIONAL_SYNC_TABLES.has(table) && isMissingTableError(error)) {
          continue;
        }
        return {
          ok: false,
          errorCode: error.code,
          errorMessage: formatSupabaseError(table, error),
        };
      }
      pushedCount += ids.length;
    }

    let didFallbackParentPush = false;
    const ensureParentTablesPushed = async (): Promise<SyncResult | null> => {
      if (didFallbackParentPush) return null;
      didFallbackParentPush = true;
      const parentTables: SyncTableName[] = ['bodega_config', 'parcelas', 'depositos', 'embotellados'];
      for (const pTable of parentTables) {
        const pRows = buildTableRows(pTable, state, undefined);
        for (let j = 0; j < pRows.length; j += 200) {
          const pChunk = pRows.slice(j, j + 200);
          const { error: pErr } = await supabase!.from(pTable).upsert(pChunk, { onConflict: 'id' });
          if (pErr) {
            return {
              ok: false,
              errorCode: pErr.code,
              errorMessage: formatSupabaseError(pTable, pErr),
            };
          }
        }
      }
      return null;
    };

    // 3. Upsert dirty records in FK order (parent -> child)
    for (const table of UPSERT_ORDER) {
      const shouldPushAllForTable =
        forceAll ||
        (isRemoteVesselsEmpty &&
          (table === 'depositos' ||
            table === 'bodega_config' ||
            table === 'aeat_materias_primas_sumas' ||
            table === 'mr_l1_sumas' ||
            table === 'mr_l2_sumas' ||
            table === 'mr_l3_sumas'));

      const dirtySet = !shouldPushAllForTable && effectiveDirtyIds[table]?.length
        ? new Set(effectiveDirtyIds[table])
        : shouldPushAllForTable
        ? undefined
        : null;

      if (dirtySet === null) continue;

      const rows = buildTableRows(table, state, dirtySet);
      if (rows.length === 0) continue;

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        let { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
        if (error && error.code === '23503' && !forceAll && !didFallbackParentPush) {
          const parentErr = await ensureParentTablesPushed();
          if (parentErr) return parentErr;
          const retry = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
          error = retry.error;
        }
        if (error) {
          if (OPTIONAL_SYNC_TABLES.has(table) && isMissingTableError(error)) {
            break;
          }
          return {
            ok: false,
            errorCode: error.code,
            errorMessage: formatSupabaseError(table, error),
          };
        }
        pushedCount += chunk.length;
      }
    }

    return { ok: true, pushedCount };
  } catch (err: any) {
    return {
      ok: false,
      errorMessage: err?.message || 'Error de conexión al sincronizar con Supabase.',
    };
  }
};

export const pullAllFromSupabase = async (): Promise<SyncResult> => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      errorMessage: 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.',
    };
  }

  try {
    const [
      cfgRes,
      parcRes,
      depRes,
      entRes,
      elabRes,
      embRes,
      salRes,
      insRes,
      anaRes,
      aguaRes,
      limpRes,
      resRes,
      pmRes,
      provRes,
      incRes,
      aeatSumRes,
      aeatMpRes,
      aeatPeRes,
      mrL1SumRes,
      mrL1EntRes,
      mrL1SalRes,
      mrL2SumRes,
      mrL2EntRes,
      mrL2SalRes,
      mrL3SumRes,
      mrL3MovRes,
      mrL4Res,
      mrL5Res,
      foggaRes,
      infoviRes,
    ] = await Promise.all([
      supabase.from('bodega_config').select('*'),
      supabase.from('parcelas').select('*').order('id').range(0, 4999),
      supabase.from('depositos').select('*').range(0, 4999),
      supabase.from('entradas_uva').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('elaboraciones').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('embotellados').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('salidas').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('insumos_movimientos').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('analiticas').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('appcc_agua').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('appcc_limpieza').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('appcc_residuos').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('appcc_plagas_mantenimiento').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('appcc_proveedores').select('*').order('fecha_registro', { ascending: false }).range(0, 4999),
      supabase.from('appcc_incidencias').select('*').order('fecha', { ascending: false }).range(0, 4999),
      supabase.from('aeat_materias_primas_sumas').select('*'),
      supabase.from('aeat_materias_primas').select('*').order('numero_orden').range(0, 4999),
      supabase.from('aeat_producto_elaborado').select('*').order('numero_asiento').range(0, 4999),
      supabase.from('mr_l1_sumas').select('*'),
      supabase.from('mr_l1_entradas').select('*').order('data').range(0, 4999),
      supabase.from('mr_l1_salidas').select('*').order('data').range(0, 4999),
      supabase.from('mr_l2_sumas').select('*'),
      supabase.from('mr_l2_entradas').select('*').order('data').range(0, 4999),
      supabase.from('mr_l2_salidas').select('*').order('data').range(0, 4999),
      supabase.from('mr_l3_sumas').select('*'),
      supabase.from('mr_l3_movimientos').select('*').order('data').range(0, 4999),
      supabase.from('mr_l4_practicas').select('*').order('data').range(0, 4999),
      supabase.from('mr_l5_procesos').select('*').order('num').range(0, 4999),
      supabase.from('fogga_declaraciones').select('*').order('campana_inicio', { ascending: false }).range(0, 499),
      supabase.from('infovi_declaraciones').select('*').order('campana_inicio', { ascending: false }).range(0, 499),
    ]);

    const checks: Array<[SyncTableName, { error: any }]> = [
      ['bodega_config', cfgRes],
      ['parcelas', parcRes],
      ['depositos', depRes],
      ['entradas_uva', entRes],
      ['elaboraciones', elabRes],
      ['embotellados', embRes],
      ['salidas', salRes],
      ['insumos_movimientos', insRes],
      ['analiticas', anaRes],
      ['appcc_agua', aguaRes],
      ['appcc_limpieza', limpRes],
      ['appcc_residuos', resRes],
      ['appcc_plagas_mantenimiento', pmRes],
      ['appcc_proveedores', provRes],
      ['appcc_incidencias', incRes],
      ['aeat_materias_primas_sumas', aeatSumRes],
      ['aeat_materias_primas', aeatMpRes],
      ['aeat_producto_elaborado', aeatPeRes],
      ['mr_l1_sumas', mrL1SumRes],
      ['mr_l1_entradas', mrL1EntRes],
      ['mr_l1_salidas', mrL1SalRes],
      ['mr_l2_sumas', mrL2SumRes],
      ['mr_l2_entradas', mrL2EntRes],
      ['mr_l2_salidas', mrL2SalRes],
      ['mr_l3_sumas', mrL3SumRes],
      ['mr_l3_movimientos', mrL3MovRes],
      ['mr_l4_practicas', mrL4Res],
      ['mr_l5_procesos', mrL5Res],
      ['fogga_declaraciones', foggaRes],
      ['infovi_declaraciones', infoviRes],
    ];

    const missingOptionalTables: SyncTableName[] = [];

    for (const [table, res] of checks) {
      if (res.error) {
        if (OPTIONAL_SYNC_TABLES.has(table) && isMissingTableError(res.error)) {
          missingOptionalTables.push(table);
          continue;
        }
        return {
          ok: false,
          errorCode: res.error.code,
          errorMessage: formatSupabaseError(table, res.error),
        };
      }
    }

    const remoteConfig = cfgRes.data?.[0] ? fromConfigRow(cfgRes.data[0]) : initialBodegaConfig;
    const remoteDepositos =
      depRes.data && depRes.data.length > 0
        ? depRes.data.map(fromDepositoRow)
        : initialDepositos;

    const mrL1SumEntRow = mrL1SumRes.data?.find((r: any) => r.id === 'entradas');
    const mrL1SumSalRow = mrL1SumRes.data?.find((r: any) => r.id === 'salidas');

    const state: WineryDatabaseState = {
      bodegaConfig: remoteConfig,
      parcelas: (parcRes.data || []).map(fromParcelaRow),
      depositos: remoteDepositos,
      entradasUva: (entRes.data || []).map(fromEntradaUvaRow),
      elaboraciones: (elabRes.data || []).map(fromElaboracionRow),
      embotellados: (embRes.data || []).map(fromEmbotelladoRow),
      salidas: (salRes.data || []).map(fromSalidaRow),
      insumosMovimientos: (insRes.data || []).map(fromInsumoRow),
      analiticas: (anaRes.data || []).map(fromAnaliticaRow),
      appccAgua: (aguaRes.data || []).map(fromAppccAguaRow),
      appccLimpieza: (limpRes.data || []).map(fromAppccLimpiezaRow),
      appccResiduos: (resRes.data || []).map(fromAppccResiduoRow),
      appccPlagasMant: (pmRes.data || []).map(fromAppccPlagaMantRow),
      appccProveedores: (provRes.data || []).map(fromAppccProveedorRow),
      appccIncidencias: (incRes.data || []).map(fromAppccIncidenciaRow),
      aeatSumaAnterior: aeatSumRes.data?.[0]
        ? fromAeatSumaRow(aeatSumRes.data[0])
        : initialAeatMateriasPrimasSumaAnterior,
      aeatMateriasPrimas: (aeatMpRes.data || []).map(fromAeatMateriaPrimaRow),
      aeatProductoElaborado: (aeatPeRes.data || []).map(fromAeatProductoRow),
      mrL1SumaEntradas: mrL1SumEntRow
        ? fromMrL1SumaRow(mrL1SumEntRow)
        : initialMedioRuralL1SumaAnteriorEntradas,
      mrL1SumaSalidas: mrL1SumSalRow
        ? fromMrL1SumaRow(mrL1SumSalRow)
        : initialMedioRuralL1SumaAnteriorSalidas,
      mrL1Entradas: (mrL1EntRes.data || []).map(fromMrL1EntradaRow),
      mrL1Salidas: (mrL1SalRes.data || []).map(fromMrL1SalidaRow),
      mrL2SumaAnterior: mrL2SumRes.data?.[0]
        ? fromMrL2SumaRow(mrL2SumRes.data[0])
        : initialMedioRuralL2SumaAnterior,
      mrL2Entradas: (mrL2EntRes.data || []).map(fromMrL2EntradaRow),
      mrL2Salidas: (mrL2SalRes.data || []).map(fromMrL2SalidaRow),
      mrL3SumaAnterior: mrL3SumRes.data?.[0]
        ? fromMrL3SumaRow(mrL3SumRes.data[0])
        : initialMedioRuralL3SumaAnterior,
      mrL3Movimientos: (mrL3MovRes.data || []).map(fromMrL3MovimientoRow),
      mrL4Practicas: (mrL4Res.data || []).map(fromMrL4PracticaRow),
      mrL5Procesos: (mrL5Res.data || []).map(fromMrL5ProcesoRow),
      foggaDeclaraciones: missingOptionalTables.includes('fogga_declaraciones')
        ? []
        : (foggaRes.data || []).map(fromFoggaDeclaracionRow),
      infoviDeclaraciones: missingOptionalTables.includes('infovi_declaraciones')
        ? []
        : (infoviRes.data || []).map(fromInfoviDeclaracionRow),
    };

    return { ok: true, state, missingOptionalTables };
  } catch (err: any) {
    return {
      ok: false,
      errorMessage: err?.message || 'Error de red al leer datos de Supabase.',
    };
  }
};

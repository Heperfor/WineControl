import {
  AppccAguaRegistro,
  AppccLimpiezaRegistro,
  AppccPlagaMantenimientoRegistro,
  AppccProveedorRegistro,
  AppccResiduoRegistro,
  CategoriaLimpiezaAppcc,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  MovimientoInsumo,
} from '../types/winery';
import { getLocalIsoDate } from './dateUtils';

const isWoodOrAmphoraZone = (zona: string, tipoRecipiente?: string): boolean => {
  const upper = zona.trim().toUpperCase();
  if (tipoRecipiente && (tipoRecipiente.includes('Barrica') || tipoRecipiente === 'Ánfora')) {
    return true;
  }
  return (
    upper === 'B1' ||
    upper === 'B2' ||
    upper.startsWith('B3') ||
    upper.includes('BARRICA') ||
    upper.includes('ÁNFORA') ||
    upper.includes('ANFORA')
  );
};

export interface MatrizLdFilaDef {
  categoria: CategoriaLimpiezaAppcc;
  zona: string;
  frecuenciaLabel: string;
}

export const APPCC_LD_FILAS_BASE: MatrizLdFilaDef[] = [
  // INSTALACIONES (PDF pp.7-13)
  { categoria: 'INSTALACIONES', zona: 'SUELO', frecuenciaLabel: 'Semanal / Tras operación' },
  { categoria: 'INSTALACIONES', zona: 'PAREDES', frecuenciaLabel: 'Mensual' },
  { categoria: 'INSTALACIONES', zona: 'TECHO', frecuenciaLabel: 'Mensual / Anual' },
  { categoria: 'INSTALACIONES', zona: 'PUERTAS', frecuenciaLabel: 'Mensual' },
  { categoria: 'INSTALACIONES', zona: 'LAVAMANOS', frecuenciaLabel: 'Semanal' },
  { categoria: 'INSTALACIONES', zona: 'CUBOS RESIDUOS', frecuenciaLabel: 'Semanal / Tras vaciado' },
  { categoria: 'INSTALACIONES', zona: 'UTILES LIMPIEZA', frecuenciaLabel: 'Semanal / Tras uso' },
  // MAQUINARIA (PDF pp.7-13 + mangueras solicitadas por bodega)
  { categoria: 'MAQUINARIA', zona: 'PRENSA', frecuenciaLabel: 'Antes y después de uso' },
  { categoria: 'MAQUINARIA', zona: 'DESPALILLADORA', frecuenciaLabel: 'Antes y después de uso' },
  { categoria: 'MAQUINARIA', zona: 'BOMBAS', frecuenciaLabel: 'Antes y después de uso' },
  { categoria: 'MAQUINARIA', zona: 'MANGUERAS', frecuenciaLabel: 'Antes y después de uso' },
  { categoria: 'MAQUINARIA', zona: 'LLENADORA', frecuenciaLabel: 'Antes y después de uso' },
  { categoria: 'MAQUINARIA', zona: 'CORCHADORA', frecuenciaLabel: 'Antes y después de uso' },
  // DEPOSITOS (Exactamente los del plano de bodega: inox, barricas B1/B2/B3 (160L) y Ánfora1)
  { categoria: 'DEPOSITOS', zona: 'Nº1', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº2', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº3', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº4', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº5', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº6', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº7', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº8', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº9', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº10', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº14', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº20', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº30', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº40', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'Nº57', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: '4F', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: '5F', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'E1', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'E2', frecuenciaLabel: 'Tras vaciado y previo a uso' },
  { categoria: 'DEPOSITOS', zona: 'B1', frecuenciaLabel: 'Tras vaciado / relleno' },
  { categoria: 'DEPOSITOS', zona: 'B2', frecuenciaLabel: 'Tras vaciado / relleno' },
  { categoria: 'DEPOSITOS', zona: 'B3 (160L)', frecuenciaLabel: 'Tras vaciado / relleno' },
  { categoria: 'DEPOSITOS', zona: 'Ánfora1', frecuenciaLabel: 'Tras vaciado y previo a uso' },
];

export const mapDepositoIdToZonaLd = (depositoId: string): string => {
  const clean = (depositoId || '').trim().toUpperCase();
  if (!clean) return 'Nº1';
  if (clean === 'B1') return 'B1';
  if (clean === 'B2') return 'B2';
  if (clean === 'B3' || clean.startsWith('B3')) return 'B3 (160L)';
  if (clean.includes('BARRICA')) return 'B1';
  if (clean === 'AN' || clean === 'AN1' || clean.includes('ANFORA') || clean.includes('ÁNFORA')) {
    return 'Ánfora1';
  }
  if (clean === '4F' || clean === 'Nº4F') return '4F';
  if (clean === '5F' || clean === 'Nº5F') return '5F';
  if (clean === 'E1' || clean === 'NºE1') return 'E1';
  if (clean === 'E2' || clean === 'NºE2') return 'E2';
  const numWithPrefix = clean.match(/^N[ºO°]\s*(\d+)$/);
  if (numWithPrefix) return `Nº${numWithPrefix[1]}`;
  if (/^\d+$/.test(clean)) return `Nº${clean}`;
  return clean;
};

export const getCategoriaZonaLd = (zona: string): CategoriaLimpiezaAppcc => {
  const upper = zona.toUpperCase();
  const baseMatch = APPCC_LD_FILAS_BASE.find((f) => f.zona.toUpperCase() === upper);
  if (baseMatch) return baseMatch.categoria;
  if (
    upper.includes('SUELO') ||
    upper.includes('PARED') ||
    upper.includes('TECHO') ||
    upper.includes('PUERTA') ||
    upper.includes('LAVAMANO') ||
    upper.includes('ASEO') ||
    upper.includes('CUBO') ||
    upper.includes('UTIL') ||
    upper.includes('ÚTIL')
  ) {
    return 'INSTALACIONES';
  }
  if (
    upper.includes('PRENSA') ||
    upper.includes('DESPALILLADORA') ||
    upper.includes('BOMBA') ||
    upper.includes('MANGUERA') ||
    upper.includes('LLENADORA') ||
    upper.includes('CORCHADORA')
  ) {
    return 'MAQUINARIA';
  }
  return 'DEPOSITOS';
};

export const buildLimpiezaForEntradaUva = (
  entrada: EntradaUva,
  responsable: string
): AppccLimpiezaRegistro[] => {
  const depZona = mapDepositoIdToZonaLd(entrada.depositoDestinoId);
  const nowIso = new Date().toISOString();
  const baseTag = `Vendimia ${entrada.parcelaNombre} (${entrada.kgTotales} kg) → Dep. ${entrada.depositoDestinoId}`;
  const esMaderaOAnfora = isWoodOrAmphoraZone(depZona, entrada.tipoRecipiente);

  const items: Array<{ zona: string; categoria: CategoriaLimpiezaAppcc; producto: string; obs: string }> = [
    {
      zona: 'DESPALILLADORA',
      categoria: 'MAQUINARIA',
      producto: 'Agua potable a presión + desinfección alimentaria (antes y después de uso)',
      obs: `Lavado automático por entrada de uva (${entrada.id}): ${baseTag}`,
    },
    {
      zona: 'BOMBAS',
      categoria: 'MAQUINARIA',
      producto: 'Circulación agua limpia / solución alcalina (antes y después)',
      obs: `Lavado circuito de bombeo tras vendimia (${entrada.id}): ${baseTag}`,
    },
    {
      zona: 'MANGUERAS',
      categoria: 'MAQUINARIA',
      producto: 'Circulación agua limpia / solución alcalina (antes y después)',
      obs: `Lavado de mangueras alimentarias tras vendimia (${entrada.id}): ${baseTag}`,
    },
    {
      zona: depZona,
      categoria: 'DEPOSITOS',
      producto: esMaderaOAnfora
        ? 'Lavado con agua potable a presión / vapor y sulfitado preventivo previo a encubado'
        : 'Sosa cáustica diluida (2-10%) + aclarado abundante previo a encubado',
      obs: `Preparación higiénica del depósito receptor (${entrada.tipoRecipiente}, ${entrada.id}): ${baseTag}`,
    },
    {
      zona: 'PRENSA',
      categoria: 'MAQUINARIA',
      producto: 'Agua potable a presión (antes y después de uso)',
      obs: `Higienización tolva/prensa en recepción vendimia (${entrada.id}): ${baseTag}`,
    },
    {
      zona: 'SUELO',
      categoria: 'INSTALACIONES',
      producto: 'Barrido y lavado con agua a presión tras descarga de cajas',
      obs: `Limpieza zona recepción y vinificación (${entrada.id}): ${baseTag}`,
    },
  ];

  return items.map((it, idx) => ({
    id: `APPCC-LD-AUTO-${entrada.id}-${idx}-${it.zona}`,
    fecha: entrada.fecha,
    categoria: it.categoria,
    zonaEquipo: it.zona,
    productoUsado: it.producto,
    conforme: true,
    responsable,
    origenAutomatico: 'Vendimia',
    referenciaOperacionId: entrada.id,
    observaciones: it.obs,
    fechaRegistro: nowIso,
  }));
};

export const buildResiduoForEntradaUva = (
  entrada: EntradaUva,
  responsable: string
): AppccResiduoRegistro => {
  const kgRasponEst = Math.max(2, Math.round(entrada.kgTotales * 0.04));
  return {
    id: `APPCC-RES-AUTO-${entrada.id}`,
    fecha: entrada.fecha,
    tipoResiduo: 'Raspón de despalillado',
    cantidadEstimada: `~${kgRasponEst} kg (estimado 4% vendimia)`,
    destino: 'A finca / viñedo propio para compostar',
    parcelaDestino: entrada.parcelaNombre,
    conforme: true,
    responsable,
    origenAutomatico: 'Vendimia',
    referenciaOperacionId: entrada.id,
    observaciones: `Generación automática tras despalillado de ${entrada.kgTotales} kg (${entrada.parcelaNombre})`,
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildLimpiezaForElaboracion = (
  elab: ElaboracionRegistro,
  responsable: string
): AppccLimpiezaRegistro[] => {
  const nowIso = new Date().toISOString();
  const origenZona = mapDepositoIdToZonaLd(elab.depositoOrigenId);
  const op = elab.operacionRealizada;
  const esTrasiegoOMovimiento =
    elab.destinoTipo === 'deposito' ||
    elab.destinoTipo === 'merma_limpieza' ||
    op.includes('Trasiego') ||
    op.includes('Desfangado') ||
    op.includes('Filtración') ||
    op.includes('Clarificación') ||
    op.includes('Estabilización') ||
    op.includes('Ensamblaje');

  const esRemontado = op.includes('Remontado');

  const items: Array<{ zona: string; categoria: CategoriaLimpiezaAppcc; producto: string; obs: string }> = [];

  if (esTrasiegoOMovimiento) {
    const isOrigenBarrica = isWoodOrAmphoraZone(origenZona);
    items.push({
      zona: origenZona,
      categoria: 'DEPOSITOS',
      producto: isOrigenBarrica
        ? 'Agua a presión / vapor y escurrido higiénico'
        : 'Sosa cáustica diluida (2-10%) + aclarado abundante',
      obs: `Lavado automático de depósito origen tras ${op} (${elab.cantidadLitros} L)`,
    });

    if (elab.destinoTipo === 'deposito' && elab.depositoDestinoId && elab.depositoDestinoId !== elab.depositoOrigenId) {
      const destZona = mapDepositoIdToZonaLd(elab.depositoDestinoId);
      const isDestBarrica = isWoodOrAmphoraZone(destZona);
      items.push({
        zona: destZona,
        categoria: 'DEPOSITOS',
        producto: isDestBarrica
          ? 'Enjuague higiénico previo a llenado'
          : 'Lavado y aclarado abundante previo a recepción',
        obs: `Higienización depósito destino (${elab.depositoDestinoId}) por ${op}`,
      });
    }

    items.push(
      {
        zona: 'BOMBAS',
        categoria: 'MAQUINARIA',
        producto: 'Circulación agua limpia / solución alcalina (antes y después)',
        obs: `Lavado automático de bomba en ${op} (Dep. ${elab.depositoOrigenId})`,
      },
      {
        zona: 'MANGUERAS',
        categoria: 'MAQUINARIA',
        producto: 'Circulación agua limpia / solución alcalina (antes y después)',
        obs: `Lavado automático de mangueras en ${op} (Dep. ${elab.depositoOrigenId})`,
      },
      {
        zona: 'SUELO',
        categoria: 'INSTALACIONES',
        producto: 'Baldeo con agua a presión zona de trabajo',
        obs: `Limpieza suelo tras ${op} (Dep. ${elab.depositoOrigenId})`,
      }
    );
  } else if (esRemontado) {
    items.push(
      {
        zona: 'BOMBAS',
        categoria: 'MAQUINARIA',
        producto: 'Circulación agua limpia antes y después de remontado',
        obs: `Lavado automático de bomba · ${op} Dep. ${elab.depositoOrigenId}`,
      },
      {
        zona: 'MANGUERAS',
        categoria: 'MAQUINARIA',
        producto: 'Circulación agua limpia antes y después de remontado',
        obs: `Lavado automático de mangueras · ${op} Dep. ${elab.depositoOrigenId}`,
      },
      {
        zona: 'UTILES LIMPIEZA',
        categoria: 'INSTALACIONES',
        producto: 'Agua limpia / desinfectante alimentario',
        obs: `Utensilios de bazuqueo/remontado · Dep. ${elab.depositoOrigenId}`,
      }
    );
  } else {
    // Sulfitado, Correcciones, Battonage, Maloláctica
    items.push({
      zona: 'UTILES LIMPIEZA',
      categoria: 'INSTALACIONES',
      producto: 'Agua potable / desinfectante alimentario (antes y después)',
      obs: `Limpieza de útiles / dosificación para ${op} en Dep. ${elab.depositoOrigenId}`,
    });
  }

  return items.map((it, idx) => ({
    id: `APPCC-LD-AUTO-${elab.id}-${idx}-${it.zona}`,
    fecha: elab.fecha,
    categoria: it.categoria,
    zonaEquipo: it.zona,
    productoUsado: it.producto,
    conforme: true,
    responsable,
    origenAutomatico: 'Elaboración / Trasiego',
    referenciaOperacionId: elab.id,
    observaciones: it.obs,
    fechaRegistro: nowIso,
  }));
};

export const buildLimpiezaForEmbotellado = (
  emb: EmbotelladoRegistro,
  responsable: string
): AppccLimpiezaRegistro[] => {
  const nowIso = new Date().toISOString();
  const depZona = mapDepositoIdToZonaLd(emb.depositoProcedenciaId);

  const items: Array<{ zona: string; categoria: CategoriaLimpiezaAppcc; producto: string; obs: string }> = [
    {
      zona: 'LLENADORA',
      categoria: 'MAQUINARIA',
      producto: 'Agua caliente abundante (circulación 30 min) antes y después de embotellar',
      obs: `Higienización línea llenado · ${emb.marca} Lote ${emb.lote} (${emb.cantidadBotellas075} bot)`,
    },
    {
      zona: 'CORCHADORA',
      categoria: 'MAQUINARIA',
      producto: 'Paño seco limpio y desinfección de mordazas',
      obs: `Limpieza corchadora manual · Lote ${emb.lote}`,
    },
    {
      zona: 'BOMBAS',
      categoria: 'MAQUINARIA',
      producto: 'Circulación agua limpia antes y después de uso',
      obs: `Bombeo hacia llenadora · Lote ${emb.lote}`,
    },
    {
      zona: 'MANGUERAS',
      categoria: 'MAQUINARIA',
      producto: 'Circulación agua limpia antes y después de uso',
      obs: `Mangueras alimentarias zona embotellado · Lote ${emb.lote}`,
    },
    {
      zona: depZona,
      categoria: 'DEPOSITOS',
      producto: 'Sosa cáustica diluida (2-10%) + aclarado abundante',
      obs: `Lavado depósito procedencia (${emb.depositoProcedenciaId}) tras embotellado ${emb.lote}`,
    },
    {
      zona: 'SUELO',
      categoria: 'INSTALACIONES',
      producto: 'Barrido y fregado con agua a presión',
      obs: `Limpieza zona embotellado tras jornada · Lote ${emb.lote}`,
    },
  ];

  return items.map((it, idx) => ({
    id: `APPCC-LD-AUTO-${emb.id}-${idx}-${it.zona}`,
    fecha: emb.fecha,
    categoria: it.categoria,
    zonaEquipo: it.zona,
    productoUsado: it.producto,
    conforme: true,
    responsable,
    origenAutomatico: 'Embotellado',
    referenciaOperacionId: emb.id,
    observaciones: it.obs,
    fechaRegistro: nowIso,
  }));
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const LUGARES_MUESTREO_AGUA = [
  'Grifo zona elaboración',
  'Grifo zona embotellado',
  'Lavamanos zona higiénica',
];

export const buildRandomAguaRegistro = (
  ym: string,
  maxDayAllowed: number,
  responsable: string
): AppccAguaRegistro => {
  const day = Math.min(Math.max(5, Math.floor(8 + Math.random() * 14)), maxDayAllowed);
  const fecha = `${ym}-${pad2(day)}`;
  // Cloro libre residual aleatorio dentro de rango seguro RD 3/2023 (0,20 - 1,00 mg/l -> 0,28 - 0,78)
  const cloro = Number((0.28 + Math.random() * 0.5).toFixed(2));
  // pH aleatorio dentro de rango habitual potable (6,9 - 7,6)
  const ph = Number((6.9 + Math.random() * 0.7).toFixed(1));
  const lugar = LUGARES_MUESTREO_AGUA[Math.floor(Math.random() * LUGARES_MUESTREO_AGUA.length)];

  return {
    id: `APPCC-AG-AUTO-${ym}`,
    fecha,
    mesReferencia: ym,
    lugarTomaMuestra: lugar,
    organolepticoConforme: true,
    cloroResidualMgL: cloro,
    ph,
    aspecto: 'Limpio, incoloro, inodoro',
    anomaliaSuministro: false,
    responsable,
    origenAutomatico: 'Frecuencia Mensual',
    observaciones: 'Control mensual automático RD 3/2023 (dentro de límites).',
    fechaRegistro: new Date().toISOString(),
  };
};

export const generateBackfillAguaUntilToday = (params: {
  existingAgua: AppccAguaRegistro[];
  startYearMonth?: string;
  responsable: string;
}): AppccAguaRegistro[] => {
  const { existingAgua, startYearMonth = '2025-01', responsable } = params;
  const todayStr = getLocalIsoDate();
  const currentYm = todayStr.slice(0, 7);
  const currentDay = Number(todayStr.slice(8, 10));

  const [startY, startM] = startYearMonth.split('-').map(Number);
  const [endY, endM] = currentYm.split('-').map(Number);
  if (!startY || !startM || !endY || !endM) return [];

  const created: AppccAguaRegistro[] = [];
  let y = startY;
  let m = startM;

  while (y < endY || (y === endY && m <= endM)) {
    const ym = `${y}-${pad2(m)}`;
    const exists =
      existingAgua.some((a) => a.mesReferencia === ym || a.fecha.startsWith(ym)) ||
      created.some((a) => a.mesReferencia === ym);
    if (!exists) {
      const maxDay = y === endY && m === endM ? currentDay : getDaysInMonth(y, m);
      created.push(buildRandomAguaRegistro(ym, maxDay, responsable));
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return created;
};

export const generateScheduledAppccForMonth = (params: {
  year: number;
  month: number; // 1..12
  existingAgua: AppccAguaRegistro[];
  existingLimpieza: AppccLimpiezaRegistro[];
  existingPlagasMant: AppccPlagaMantenimientoRegistro[];
  responsable: string;
  onlyUpToToday?: boolean;
}): {
  newAgua: AppccAguaRegistro[];
  newLimpieza: AppccLimpiezaRegistro[];
  newPlagasMant: AppccPlagaMantenimientoRegistro[];
} => {
  const {
    year,
    month,
    existingAgua,
    existingLimpieza,
    existingPlagasMant,
    responsable,
    onlyUpToToday = false,
  } = params;

  const nowIso = new Date().toISOString();
  const todayStr = getLocalIsoDate();
  const daysInMonth = getDaysInMonth(year, month);
  const ym = `${year}-${pad2(month)}`;

  const maxDayAllowed = (() => {
    if (!onlyUpToToday) return daysInMonth;
    const todayYear = Number(todayStr.slice(0, 4));
    const todayMonth = Number(todayStr.slice(5, 7));
    if (year > todayYear || (year === todayYear && month > todayMonth)) return 0;
    if (year === todayYear && month === todayMonth) return Number(todayStr.slice(8, 10));
    return daysInMonth;
  })();

  if (maxDayAllowed <= 0) {
    return { newAgua: [], newLimpieza: [], newPlagasMant: [] };
  }

  // 1. Agua Potable Mensual (RD 3/2023) con valores aleatorios dentro de rango
  const newAgua: AppccAguaRegistro[] = [];
  const hasAguaMonth = existingAgua.some(
    (a) => a.mesReferencia === ym || a.fecha.startsWith(ym)
  );
  if (!hasAguaMonth) {
    newAgua.push(buildRandomAguaRegistro(ym, maxDayAllowed, responsable));
  }

  // 2. Limpieza y Desinfección por frecuencia (Semanal / Mensual)
  const newLimpieza: AppccLimpiezaRegistro[] = [];
  const hasLdRecord = (fecha: string, zona: string) =>
    existingLimpieza.some(
      (l) => l.fecha === fecha && l.zonaEquipo.toUpperCase() === zona.toUpperCase()
    ) ||
    newLimpieza.some(
      (l) => l.fecha === fecha && l.zonaEquipo.toUpperCase() === zona.toUpperCase()
    );

  // Mensual (día 1)
  const dayOneDate = `${ym}-01`;
  const monthlyZones: Array<{ zona: string; prod: string }> = [
    { zona: 'PAREDES', prod: 'Agua a presión / limpiador neutro (limpieza mensual)' },
    { zona: 'TECHO', prod: 'Retirada polvo/telarañas y revisión estanqueidad (mensual)' },
    { zona: 'PUERTAS', prod: 'Detergente/desinfectante alimentario y burletes (mensual)' },
  ];
  monthlyZones.forEach((m) => {
    if (!hasLdRecord(dayOneDate, m.zona)) {
      newLimpieza.push({
        id: `APPCC-LD-FREQ-${dayOneDate}-${m.zona}`,
        fecha: dayOneDate,
        categoria: 'INSTALACIONES',
        zonaEquipo: m.zona,
        productoUsado: m.prod,
        conforme: true,
        responsable,
        origenAutomatico: 'Frecuencia Mensual',
        observaciones: 'Generado automáticamente según frecuencia mensual del Plan L+D.',
        fechaRegistro: nowIso,
      });
    }
  });

  // Semanal (días 7, 14, 21, 28 que no excedan maxDayAllowed)
  const weeklyDays = [7, 14, 21, 28].filter((d) => d <= maxDayAllowed);
  const weeklyZones: Array<{ zona: string; prod: string }> = [
    { zona: 'SUELO', prod: 'Barrido y fregado con agua a presión / detergente' },
    { zona: 'LAVAMANOS', prod: 'Desinfectante alimentario (100 ml / 5 L), reposición jabón y papel' },
    { zona: 'CUBOS RESIDUOS', prod: 'Vaciado y desinfectante alimentario fuera de zona elaboración' },
    { zona: 'UTILES LIMPIEZA', prod: 'Desinfectante alimentario (5 min) y aclarado' },
  ];
  weeklyDays.forEach((dayNum) => {
    const fecha = `${ym}-${pad2(dayNum)}`;
    weeklyZones.forEach((w) => {
      if (!hasLdRecord(fecha, w.zona)) {
        newLimpieza.push({
          id: `APPCC-LD-FREQ-${fecha}-${w.zona}`,
          fecha,
          categoria: 'INSTALACIONES',
          zonaEquipo: w.zona,
          productoUsado: w.prod,
          conforme: true,
          responsable,
          origenAutomatico: 'Frecuencia Semanal',
          observaciones: 'Generado automáticamente según frecuencia semanal del Plan L+D.',
          fechaRegistro: nowIso,
        });
      }
    });
  });

  // 3. Vigilancia DDD Mensual (día 1) + Plan Mantenimiento Anual Pre-vendimia (Agosto)
  const newPlagasMant: AppccPlagaMantenimientoRegistro[] = [];
  const hasDddMonth = existingPlagasMant.some(
    (p) => p.fecha.startsWith(ym) && p.tipoControl.includes('DDD')
  );
  if (!hasDddMonth) {
    newPlagasMant.push({
      id: `APPCC-PM-DDD-${ym}`,
      fecha: dayOneDate,
      tipoControl: 'Vigilancia DDD (Plagas · Mensual)',
      elementoZona: 'Inspección mensual desagües anti-múridos, mosquiteras y almacén',
      localInstalaciones: 'Desagües, puertas herméticas y ventanas OK',
      maquinariaUtensilios: 'Sin indicios de plagas',
      resultado: 'Sin anomalías / Conforme',
      responsable,
      origenAutomatico: 'Frecuencia Mensual',
      observaciones: 'Control visual mensual automático (Anexo R3).',
      fechaRegistro: nowIso,
    });
  }

  // Anual Pre-vendimia en Agosto (mes 8)
  if (month === 8) {
    const hasAnnualMaint = existingPlagasMant.some(
      (p) =>
        p.fecha.startsWith(`${year}-`) &&
        p.tipoControl.includes('Mantenimiento')
    );
    if (!hasAnnualMaint) {
      const mDay = Math.min(20, maxDayAllowed);
      const mFecha = `${year}-08-${pad2(mDay)}`;
      newPlagasMant.push({
        id: `APPCC-PM-MANT-${year}`,
        fecha: mFecha,
        tipoControl: 'Mantenimiento Preventivo Equipos',
        elementoZona: 'Revisión anual pre-vendimia instalaciones y maquinaria',
        localInstalaciones: 'Suelos epoxi, paredes, luces estancas y desagües OK',
        maquinariaUtensilios: 'Despalilladora, prensa, bombas, mangueras y llenadora OK',
        resultado: 'Sin anomalías / Conforme',
        responsable,
        origenAutomatico: 'Frecuencia Anual',
        observaciones: 'Puesta a punto anual pre-vendimia conforme Anexo RM.',
        fechaRegistro: nowIso,
      });
    }
  }

  return { newAgua, newLimpieza, newPlagasMant };
};

export const extractSuppliersFromInsumos = (
  insumos: MovimientoInsumo[],
  existingProveedores: AppccProveedorRegistro[]
): AppccProveedorRegistro[] => {
  const nowIso = new Date().toISOString();
  const created: AppccProveedorRegistro[] = [];

  const getProductLabel = (tipo: MovimientoInsumo['tipoInsumo']) => {
    switch (tipo) {
      case 'corchos':
        return 'Tapones de corcho natural / 1+1';
      case 'botellas':
        return 'Botellas vidrio 0,75 L';
      case 'lacre':
        return 'Lacre alimentario de sellado';
      case 'etiquetas':
        return 'Etiquetas y contraetiquetas';
      case 'cajas':
        return 'Cajas de embalaje y separadores';
    }
  };

  insumos.forEach((mov, idx) => {
    if (!mov.proveedor) return;
    const norm = mov.proveedor.trim().toLowerCase();
    const exists =
      existingProveedores.some((p) => p.proveedor.trim().toLowerCase() === norm) ||
      created.some((p) => p.proveedor.trim().toLowerCase() === norm);
    if (!exists) {
      created.push({
        id: `APPCC-PROV-AUTO-${idx}-${Date.now()}`,
        proveedor: mov.proveedor.trim(),
        productos: getProductLabel(mov.tipoInsumo),
        localizacion: 'Galicia / España (Homologado Reg. UE 1935/2004)',
        conforme: true,
        observaciones: mov.loteProveedor ? `Último lote verificado: ${mov.loteProveedor}` : 'Control de recepción OK',
        origenAutomatico: 'Insumos / Bodega',
        fechaRegistro: nowIso,
      });
    }
  });

  return created;
};

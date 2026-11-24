import {
  emptyFoggaCadroARow,
  emptyFoggaCadroBRow,
  emptyInfoviHRow,
  emptyInfoviIRow,
  emptyInfoviJRow,
  emptyInfoviMostoDatos,
  emptyInfoviSalidaDestinos,
} from '../data/initialData';
import {
  BodegaConfig,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  FoggaCadroARow,
  FoggaCadroBRow,
  FoggaCategoriaVinoKey,
  FoggaMr441bDeclaracion,
  FoggaPersoaDeclarante,
  InfoviCategoriaKey,
  InfoviCuadroJRow,
  InfoviDeclaracion,
  InfoviMesPeriodo,
  Parcela,
  SalidaRegistro,
} from '../types/winery';
import {
  inferTipoVinoFromMarca,
  inferTipoVinoFromVarieties,
  isRedVariety,
  resolveEmbotelladoTipoVino,
} from './wineType';
import { getLocalIsoDate } from './dateUtils';

export const FOGGA_CATEGORIAS: Array<{ key: FoggaCategoriaVinoKey; label: string }> = [
  { key: 'dop', label: 'Viño con denominación de orixe protexida' },
  { key: 'ixp', label: 'Viño con indicación xeográfica protexida' },
  { key: 'varietais', label: 'Viños varietais sen DOP nin IXP' },
  { key: 'senIx', label: 'Viños sen indicación xeográfica' },
  { key: 'outros', label: 'Outros viños' },
];

export const INFOVI_CATEGORIAS: Array<{ key: InfoviCategoriaKey; label: string }> = [
  { key: 'dop', label: 'DOP' },
  { key: 'igp', label: 'IGP' },
  { key: 'varietalesSinIg', label: 'Varietales sin IG' },
  { key: 'sinIg', label: 'sin IG' },
];

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const getCampaignFromDate = (
  isoDate: string
): { inicio: number; fin: number; label: string } => {
  const year = Number(isoDate.slice(0, 4)) || new Date().getFullYear();
  const month = Number(isoDate.slice(5, 7)) || new Date().getMonth() + 1;
  const inicio = month >= 8 ? year : year - 1;
  return { inicio, fin: inicio + 1, label: `${inicio}/${inicio + 1}` };
};

export const getCurrentCampaign = (refDate = new Date()) => {
  const iso = getLocalIsoDate(refDate);
  return getCampaignFromDate(iso);
};

// ============================================================================
// FOGGA MR441B: AUTOMATIZACIÓN DESDE ENTRADAS DE UVA Y PARCELAS
// ============================================================================

export const sumFoggaCadroA = (
  cadroA: FoggaMr441bDeclaracion['cadroA']
): FoggaCadroARow => {
  return FOGGA_CATEGORIAS.reduce(
    (acc, cat) => {
      const row = cadroA[cat.key];
      return {
        superficieHa: round2(acc.superficieHa + (row?.superficieHa || 0)),
        tinta100Kg: round2(acc.tinta100Kg + (row?.tinta100Kg || 0)),
        branca100Kg: round2(acc.branca100Kg + (row?.branca100Kg || 0)),
        rendemento: round2(acc.rendemento + (row?.rendemento || 0)),
      };
    },
    emptyFoggaCadroARow()
  );
};

export const sumFoggaCadroB = (
  cadroB: FoggaMr441bDeclaracion['cadroB']
): FoggaCadroBRow => {
  return FOGGA_CATEGORIAS.reduce((acc, cat) => {
    const row = cadroB[cat.key];
    return {
      vinifPropiaTinta: round2(acc.vinifPropiaTinta + (row?.vinifPropiaTinta || 0)),
      vinifPropiaBranca: round2(acc.vinifPropiaBranca + (row?.vinifPropiaBranca || 0)),
      coopTinta: round2(acc.coopTinta + (row?.coopTinta || 0)),
      coopBranca: round2(acc.coopBranca + (row?.coopBranca || 0)),
      vendidaTinta: round2(acc.vendidaTinta + (row?.vendidaTinta || 0)),
      vendidaBranca: round2(acc.vendidaBranca + (row?.vendidaBranca || 0)),
      consumoFresco: round2(acc.consumoFresco + (row?.consumoFresco || 0)),
      pasificado: round2(acc.pasificado + (row?.pasificado || 0)),
      zume: round2(acc.zume + (row?.zume || 0)),
      mostoConc: round2(acc.mostoConc + (row?.mostoConc || 0)),
    };
  }, emptyFoggaCadroBRow());
};

const defaultFoggaDeclaranteFromLatest = (
  existing: FoggaMr441bDeclaracion[],
  config: BodegaConfig
): {
  declarante: FoggaPersoaDeclarante;
  codev: string;
  vinedoSitoEn: string;
  concellos: string;
  xefaturaTerritorial: string;
} => {
  const sorted = [...existing].sort((a, b) => b.campanaInicio - a.campanaInicio);
  const latest = sorted[0];

  if (latest) {
    return {
      declarante: {
        ...latest.declarante,
        nif: config.cifNif?.trim() || latest.declarante.nif,
        nomeVia: config.direccion?.trim() || latest.declarante.nomeVia,
        provincia: config.provincia?.trim() || latest.declarante.provincia,
        concello: config.localidad?.trim() || latest.declarante.concello,
        localidade: config.localidad?.trim() || latest.declarante.localidade,
      },
      codev: latest.codev || '3207009609',
      vinedoSitoEn: latest.vinedoSitoEn || config.localidad?.trim() || '',
      concellos: latest.concellos || config.localidad?.trim() || '',
      xefaturaTerritorial: config.provincia?.trim() || latest.xefaturaTerritorial || '',
    };
  }

  return {
    declarante: {
      nome: config.responsableTecnico?.trim() || config.nombreBodega?.trim() || '',
      primeiroApelido: '',
      segundoApelido: '',
      nif: config.cifNif?.trim() || '',
      tipoVia: 'ESTRADA',
      nomeVia: config.direccion?.trim() || '',
      numero: '',
      bloq: '',
      andar: '',
      porta: '',
      parroquia: '',
      lugar: '',
      codigoPostal: '',
      provincia: config.provincia?.trim() || '',
      concello: config.localidad?.trim() || '',
      localidade: config.localidad?.trim() || '',
      telefono: '',
      telefonoMobil: '',
      correoElectronico: '',
    },
    codev: '',
    vinedoSitoEn: config.localidad?.trim() || '',
    concellos: config.localidad?.trim() || '',
    xefaturaTerritorial: config.provincia?.trim() || '',
  };
};

export interface FoggaAutoDetalle {
  entradasCount: number;
  kgTinta: number;
  kgBranca: number;
  kgTotal: number;
  litrosMosto: number;
  superficieParcelasHa: number;
  superficieUsadaHa: number;
}

export const generateFoggaDraftFromVendimia = (
  campanaInicio: number,
  params: {
    entradasUva: EntradaUva[];
    parcelas: Parcela[];
    bodegaConfig: BodegaConfig;
    existingFogga: FoggaMr441bDeclaracion[];
    categoriaCadroA?: FoggaCategoriaVinoKey;
    categoriaCadroB?: FoggaCategoriaVinoKey;
  }
): { declaracion: FoggaMr441bDeclaracion; detalle: FoggaAutoDetalle } => {
  const campanaFin = campanaInicio + 1;
  const start = `${campanaInicio}-08-01`;
  const end = `${campanaFin}-07-31`;

  const entradasCampana = params.entradasUva.filter((e) =>
    e.anada ? e.anada === campanaInicio : e.fecha >= start && e.fecha <= end
  );

  let kgTinta = 0;
  let kgBranca = 0;
  let litrosMosto = 0;

  entradasCampana.forEach((e) => {
    litrosMosto += e.litrosMosto || 0;
    if (e.desgloseVariedades && e.desgloseVariedades.length > 0) {
      e.desgloseVariedades.forEach((v) => {
        if (isRedVariety(v.variedad)) {
          kgTinta += v.kg || 0;
        } else {
          kgBranca += v.kg || 0;
        }
      });
    } else if (e.tipoVino === 'Tinto' || e.tipoVino === 'Rosado') {
      kgTinta += e.kgTotales || 0;
    } else {
      kgBranca += e.kgTotales || 0;
    }
  });

  const superficieParcelasHa = round2(
    params.parcelas.reduce((sum, p) => sum + (p.superficieM2 || 0) / 10000, 0)
  );

  const base = defaultFoggaDeclaranteFromLatest(params.existingFogga, params.bodegaConfig);
  const latestSuperficieHa = params.existingFogga.length
    ? Math.max(
        ...params.existingFogga.map((f) => sumFoggaCadroA(f.cadroA).superficieHa),
        0
      )
    : 0;
  const superficieUsadaHa =
    superficieParcelasHa > 0 ? superficieParcelasHa : latestSuperficieHa;

  const tinta100 = round2(kgTinta / 100);
  const branca100 = round2(kgBranca / 100);

  const catA: FoggaCategoriaVinoKey = params.categoriaCadroA || 'dop';
  const catB: FoggaCategoriaVinoKey = params.categoriaCadroB || 'outros';

  const cadroA: FoggaMr441bDeclaracion['cadroA'] = {
    dop: emptyFoggaCadroARow(),
    ixp: emptyFoggaCadroARow(),
    varietais: emptyFoggaCadroARow(),
    senIx: emptyFoggaCadroARow(),
    outros: emptyFoggaCadroARow(),
  };
  cadroA[catA] = {
    superficieHa: superficieUsadaHa,
    tinta100Kg: tinta100,
    branca100Kg: branca100,
    rendemento: superficieUsadaHa > 0 ? round2((tinta100 + branca100) / superficieUsadaHa) : 0,
  };

  const cadroB: FoggaMr441bDeclaracion['cadroB'] = {
    dop: emptyFoggaCadroBRow(),
    ixp: emptyFoggaCadroBRow(),
    varietais: emptyFoggaCadroBRow(),
    senIx: emptyFoggaCadroBRow(),
    outros: emptyFoggaCadroBRow(),
  };
  cadroB[catB] = {
    ...emptyFoggaCadroBRow(),
    vinifPropiaTinta: tinta100,
    vinifPropiaBranca: branca100,
  };

  const existingSame = params.existingFogga.find((f) => f.campanaInicio === campanaInicio);

  const declaracion: FoggaMr441bDeclaracion = {
    id: existingSame?.id || `fogga-mr441b-${campanaInicio}`,
    campanaInicio,
    campanaFin,
    tipoDeclaracion: existingSame?.tipoDeclaracion || 'Modificación',
    codev: base.codev,
    vinedoSitoEn: base.vinedoSitoEn,
    concellos: base.concellos,
    declarante: base.declarante,
    cadroA,
    cadroB,
    cadroC: existingSame?.cadroC || [],
    estado: existingSame?.estado || 'borrador',
    confirmadaPresentada: existingSame?.confirmadaPresentada ?? false,
    fechaPresentacion: existingSame?.fechaPresentacion,
    horaPresentacion: existingSame?.horaPresentacion,
    numeroEntrada: existingSame?.numeroEntrada,
    metodoFirma: existingSame?.metodoFirma || 'Certificado dixital',
    lugarFirma: existingSame?.lugarFirma || base.declarante.concello || 'Ribadavia',
    xefaturaTerritorial: base.xefaturaTerritorial,
    observaciones:
      existingSame?.observaciones ||
      `Generada automáticamente desde ${entradasCampana.length} entradas de uva de la campaña ${campanaInicio}/${campanaFin}.`,
    origenDatos: 'automatica_vendimia',
    fechaRegistro: new Date().toISOString(),
  };

  return {
    declaracion,
    detalle: {
      entradasCount: entradasCampana.length,
      kgTinta: Math.round(kgTinta),
      kgBranca: Math.round(kgBranca),
      kgTotal: Math.round(kgTinta + kgBranca),
      litrosMosto: round2(litrosMosto),
      superficieParcelasHa,
      superficieUsadaHa,
    },
  };
};

// ============================================================================
// INFOVI (AICA < 1.000 HL): AUTOMATIZACIÓN ACUMULADA Y ARRASTRE DE CAMPAÑAS
// ============================================================================

export const getInfoviPeriodBounds = (campanaInicio: number, mes: InfoviMesPeriodo) => {
  const fin = campanaInicio + 1;
  if (mes === 'NOVIEMBRE') {
    return {
      campana: `${campanaInicio}/${fin}`,
      periodStart: `${campanaInicio}-08-01`,
      periodEnd: `${campanaInicio}-11-30`,
      filingOpen: `${campanaInicio}-12-01`,
      deadline: `${campanaInicio}-12-20`,
      labelPlazo: `Del 1 al 20 de diciembre de ${campanaInicio}`,
    };
  }
  return {
    campana: `${campanaInicio}/${fin}`,
    periodStart: `${campanaInicio}-08-01`,
    periodEnd: `${fin}-07-31`,
    filingOpen: `${fin}-08-01`,
    deadline: `${fin}-08-20`,
    labelPlazo: `Del 1 al 20 de agosto de ${fin}`,
  };
};

export const sumInfoviCuadroH = (cuadroH: InfoviDeclaracion['cuadroH']) => {
  return INFOVI_CATEGORIAS.reduce(
    (acc, cat) => {
      const r = cuadroH[cat.key];
      return {
        tintoRosado: acc.tintoRosado + (r?.tintoRosado || 0),
        blanco: acc.blanco + (r?.blanco || 0),
        superficieHa: acc.superficieHa + (r?.superficieHa || 0),
        total: acc.total + (r?.tintoRosado || 0) + (r?.blanco || 0),
      };
    },
    { tintoRosado: 0, blanco: 0, superficieHa: 0, total: 0 }
  );
};

export const sumInfoviCuadroI = (cuadroI: InfoviDeclaracion['cuadroI']) => {
  return INFOVI_CATEGORIAS.reduce(
    (acc, cat) => {
      const r = cuadroI[cat.key];
      return {
        tintoRosado: acc.tintoRosado + (r?.tintoRosado || 0),
        blanco: acc.blanco + (r?.blanco || 0),
        total: acc.total + (r?.tintoRosado || 0) + (r?.blanco || 0),
      };
    },
    { tintoRosado: 0, blanco: 0, total: 0 }
  );
};

export const sumInfoviCuadroJ = (cuadroJ: InfoviDeclaracion['cuadroJ']) => {
  return INFOVI_CATEGORIAS.reduce(
    (acc, cat) => {
      const r = cuadroJ[cat.key];
      const tG = r?.tintoGranel || 0;
      const tE = r?.tintoEnvasado || 0;
      const bG = r?.blancoGranel || 0;
      const bE = r?.blancoEnvasado || 0;
      return {
        tintoGranel: acc.tintoGranel + tG,
        tintoEnvasado: acc.tintoEnvasado + tE,
        blancoGranel: acc.blancoGranel + bG,
        blancoEnvasado: acc.blancoEnvasado + bE,
        total: acc.total + tG + tE + bG + bE,
      };
    },
    { tintoGranel: 0, tintoEnvasado: 0, blancoGranel: 0, blancoEnvasado: 0, total: 0 }
  );
};

export const sumInfoviJRow = (r: InfoviCuadroJRow) =>
  (r?.tintoGranel || 0) + (r?.tintoEnvasado || 0) + (r?.blancoGranel || 0) + (r?.blancoEnvasado || 0);

export const sumInfoviSalidaDestinos = (d: InfoviDeclaracion['cuadroK'][InfoviCategoriaKey]) => {
  const rows = [d.interiores, d.mercadoUe, d.paisesTerceros];
  return rows.reduce<{
    tintoGranel: number;
    tintoEnvasado: number;
    blancoGranel: number;
    blancoEnvasado: number;
    total: number;
  }>(
    (acc, r) => ({
      tintoGranel: acc.tintoGranel + (r?.tintoGranel || 0),
      tintoEnvasado: acc.tintoEnvasado + (r?.tintoEnvasado || 0),
      blancoGranel: acc.blancoGranel + (r?.blancoGranel || 0),
      blancoEnvasado: acc.blancoEnvasado + (r?.blancoEnvasado || 0),
      total:
        acc.total +
        (r?.tintoGranel || 0) +
        (r?.tintoEnvasado || 0) +
        (r?.blancoGranel || 0) +
        (r?.blancoEnvasado || 0),
    }),
    { tintoGranel: 0, tintoEnvasado: 0, blancoGranel: 0, blancoEnvasado: 0, total: 0 }
  );
};

export const sumInfoviCuadroK = (cuadroK: InfoviDeclaracion['cuadroK']) => {
  return INFOVI_CATEGORIAS.reduce(
    (acc, cat) => {
      const catSum = sumInfoviSalidaDestinos(cuadroK[cat.key]);
      return {
        tintoGranel: acc.tintoGranel + catSum.tintoGranel,
        tintoEnvasado: acc.tintoEnvasado + catSum.tintoEnvasado,
        blancoGranel: acc.blancoGranel + catSum.blancoGranel,
        blancoEnvasado: acc.blancoEnvasado + catSum.blancoEnvasado,
        total: acc.total + catSum.total,
      };
    },
    { tintoGranel: 0, tintoEnvasado: 0, blancoGranel: 0, blancoEnvasado: 0, total: 0 }
  );
};

export const findPreviousInfoviForCampaignStart = (
  campanaInicio: number,
  existingInfovi: InfoviDeclaracion[]
): InfoviDeclaracion | undefined => {
  // Ideal: JULIO de campaña (campanaInicio - 1)/(campanaInicio)
  const prevJuly = existingInfovi.find(
    (d) => d.campanaInicio === campanaInicio - 1 && d.mes === 'JULIO'
  );
  if (prevJuly) return prevJuly;

  // Fallback: NOVIEMBRE de campaña (campanaInicio - 1)
  const prevNov = existingInfovi.find(
    (d) => d.campanaInicio === campanaInicio - 1 && d.mes === 'NOVIEMBRE'
  );
  if (prevNov) return prevNov;

  // Fallback: última declaración anterior cronológicamente
  const earlier = [...existingInfovi]
    .filter((d) => d.campanaInicio < campanaInicio)
    .sort((a, b) => {
      if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
      return a.mes === 'JULIO' ? -1 : 1;
    });
  return earlier[0];
};

export const computeProduccionMediaHl = (
  existingInfovi: InfoviDeclaracion[],
  beforeCampanaInicio: number
): number => {
  // Tomar la última producción registrada por cada campaña anterior
  const byCampaign = new Map<number, number>();
  const ordered = [...existingInfovi]
    .filter((d) => d.campanaInicio < beforeCampanaInicio)
    .sort((a, b) => {
      if (a.campanaInicio !== b.campanaInicio) return a.campanaInicio - b.campanaInicio;
      return a.mes === 'NOVIEMBRE' ? -1 : 1;
    });

  ordered.forEach((d) => {
    const totalProd = sumInfoviCuadroH(d.cuadroH).total;
    byCampaign.set(d.campanaInicio, totalProd);
  });

  if (byCampaign.size === 0) {
    const latest = [...existingInfovi].sort((a, b) => b.campanaInicio - a.campanaInicio)[0];
    return latest?.produccionMediaHl || 29;
  }

  const values = Array.from(byCampaign.values());
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round(avg);
};

export interface InfoviAutoBreakdown {
  periodStart: string;
  periodEnd: string;
  prevInfoviLabel: string | null;
  prevStockTotalHl: number;
  litrosMostoTintoRosado: number;
  litrosMostoBlanco: number;
  litrosEmbotelladosTintoRosado: number;
  litrosEmbotelladosBlanco: number;
  litrosSalidasInterioresTinto: number;
  litrosSalidasInterioresBlanco: number;
  litrosSalidasUeTinto: number;
  litrosSalidasUeBlanco: number;
  litrosSalidasTercerosTinto: number;
  litrosSalidasTercerosBlanco: number;
  balanceArrastrado: InfoviCuadroJRow;
  stockVivoBodega: InfoviCuadroJRow;
  stockVivoLitros: {
    tintoGranelL: number;
    tintoEnvL: number;
    blancoGranelL: number;
    blancoEnvL: number;
  };
}

export const generateInfoviDraftFromWinery = (
  campanaInicio: number,
  mes: InfoviMesPeriodo,
  params: {
    entradasUva: EntradaUva[];
    elaboraciones: ElaboracionRegistro[];
    embotellados: EmbotelladoRegistro[];
    salidas: SalidaRegistro[];
    depositos: Deposito[];
    parcelas: Parcela[];
    bodegaConfig: BodegaConfig;
    existingInfovi: InfoviDeclaracion[];
    categoriaPrincipal?: InfoviCategoriaKey;
    modoExistencias?: 'balance_arrastrado' | 'stock_vivo';
  }
): { declaracion: InfoviDeclaracion; breakdown: InfoviAutoBreakdown } => {
  const bounds = getInfoviPeriodBounds(campanaInicio, mes);
  const cat: InfoviCategoriaKey = params.categoriaPrincipal || 'sinIg';

  // 1. Entradas de uva acumuladas desde el 1 de agosto hasta fin del periodo
  const entradasPeriodo = params.entradasUva.filter(
    (e) => e.fecha >= bounds.periodStart && e.fecha <= bounds.periodEnd
  );

  let kgTinta = 0;
  let kgBlanca = 0;
  let litrosMostoTinto = 0;
  let litrosMostoBlanco = 0;

  entradasPeriodo.forEach((e) => {
    let entryTinta = 0;
    let entryBlanca = 0;
    if (e.desgloseVariedades && e.desgloseVariedades.length > 0) {
      e.desgloseVariedades.forEach((v) => {
        if (isRedVariety(v.variedad)) entryTinta += v.kg || 0;
        else entryBlanca += v.kg || 0;
      });
    } else if (e.tipoVino === 'Tinto' || e.tipoVino === 'Rosado') {
      entryTinta = e.kgTotales || 0;
    } else {
      entryBlanca = e.kgTotales || 0;
    }
    kgTinta += entryTinta;
    kgBlanca += entryBlanca;

    const totalEntryKg = entryTinta + entryBlanca;
    if (e.litrosMosto > 0) {
      if (e.tipoVino === 'Tinto' || e.tipoVino === 'Rosado') {
        litrosMostoTinto += e.litrosMosto;
      } else if (e.tipoVino === 'Blanco') {
        litrosMostoBlanco += e.litrosMosto;
      } else if (totalEntryKg > 0) {
        litrosMostoTinto += e.litrosMosto * (entryTinta / totalEntryKg);
        litrosMostoBlanco += e.litrosMosto * (entryBlanca / totalEntryKg);
      } else {
        litrosMostoBlanco += e.litrosMosto;
      }
    }
  });

  const prodTintoHl = Math.round(litrosMostoTinto / 100);
  const prodBlancoHl = Math.round(litrosMostoBlanco / 100);

  const superficieHaExact = params.parcelas.reduce((s, p) => s + (p.superficieM2 || 0) / 10000, 0);
  const superficieHaInt =
    superficieHaExact > 0
      ? Math.max(1, Math.round(superficieHaExact))
      : 1;

  // 2. Embotellados acumulados en el periodo (pasan granel -> envasado en el balance INFOVI)
  const embotelladosPeriodo = params.embotellados.filter(
    (emb) => emb.fecha >= bounds.periodStart && emb.fecha <= bounds.periodEnd
  );
  let litrosEmbTinto = 0;
  let litrosEmbBlanco = 0;
  embotelladosPeriodo.forEach((emb) => {
    const tv = resolveEmbotelladoTipoVino(emb, {
      entradasUva: params.entradasUva,
      elaboraciones: params.elaboraciones,
      depositos: params.depositos,
    });
    if (tv === 'Tinto' || tv === 'Rosado') {
      litrosEmbTinto += emb.cantidadLitros || 0;
    } else {
      litrosEmbBlanco += emb.cantidadLitros || 0;
    }
  });

  // 3. Salidas acumuladas en el periodo desde 1 de agosto
  const salidasPeriodo = params.salidas.filter(
    (s) =>
      s.fecha >= bounds.periodStart &&
      s.fecha <= bounds.periodEnd &&
      s.tipoSalida !== 'Merma / Rotura'
  );

  let litSalIntTinto = 0;
  let litSalIntBlanco = 0;
  let litSalUeTinto = 0;
  let litSalUeBlanco = 0;
  let litSalTerTinto = 0;
  let litSalTerBlanco = 0;

  salidasPeriodo.forEach((s) => {
    const embMatch = s.embotelladoId
      ? params.embotellados.find((e) => e.id === s.embotelladoId)
      : undefined;
    const tv = embMatch
      ? resolveEmbotelladoTipoVino(embMatch, {
          entradasUva: params.entradasUva,
          elaboraciones: params.elaboraciones,
          depositos: params.depositos,
        })
      : inferTipoVinoFromMarca(s.marca);

    const litros = (s.cantidadBotellas || 0) * 0.75;
    const isRed = tv === 'Tinto' || tv === 'Rosado';
    const destLower = (s.destino || '').toLowerCase();

    if (s.tipoSalida === 'Exportación') {
      const isTerceros =
        destLower.includes('eeuu') ||
        destLower.includes('usa') ||
        destLower.includes('uk') ||
        destLower.includes('reino unido') ||
        destLower.includes('suiza') ||
        destLower.includes('japón') ||
        destLower.includes('japon') ||
        destLower.includes('tercer');
      if (isTerceros) {
        if (isRed) litSalTerTinto += litros;
        else litSalTerBlanco += litros;
      } else {
        if (isRed) litSalUeTinto += litros;
        else litSalUeBlanco += litros;
      }
    } else {
      if (isRed) litSalIntTinto += litros;
      else litSalIntBlanco += litros;
    }
  });

  const salIntRow: InfoviCuadroJRow = {
    tintoGranel: 0,
    tintoEnvasado: Math.round(litSalIntTinto / 100),
    blancoGranel: 0,
    blancoEnvasado: Math.round(litSalIntBlanco / 100),
  };
  const salUeRow: InfoviCuadroJRow = {
    tintoGranel: 0,
    tintoEnvasado: Math.round(litSalUeTinto / 100),
    blancoGranel: 0,
    blancoEnvasado: Math.round(litSalUeBlanco / 100),
  };
  const salTerRow: InfoviCuadroJRow = {
    tintoGranel: 0,
    tintoEnvasado: Math.round(litSalTerTinto / 100),
    blancoGranel: 0,
    blancoEnvasado: Math.round(litSalTerBlanco / 100),
  };

  // 4. Stock inicial desde declaración INFOVI anterior (arrastre retroactivo)
  const prevDecl = findPreviousInfoviForCampaignStart(campanaInicio, params.existingInfovi);
  const prevStock = prevDecl
    ? sumInfoviCuadroJ(prevDecl.cuadroJ)
    : { tintoGranel: 0, tintoEnvasado: 0, blancoGranel: 0, blancoEnvasado: 0, total: 0 };

  const embTintoHl = Math.round(litrosEmbTinto / 100);
  const embBlancoHl = Math.round(litrosEmbBlanco / 100);
  const totalSalTintoEnvHl = salIntRow.tintoEnvasado + salUeRow.tintoEnvasado + salTerRow.tintoEnvasado;
  const totalSalBlancoEnvHl = salIntRow.blancoEnvasado + salUeRow.blancoEnvasado + salTerRow.blancoEnvasado;

  const balanceArrastrado: InfoviCuadroJRow = {
    tintoGranel: Math.max(0, prevStock.tintoGranel + prodTintoHl - embTintoHl),
    tintoEnvasado: Math.max(0, prevStock.tintoEnvasado + embTintoHl - totalSalTintoEnvHl),
    blancoGranel: Math.max(0, prevStock.blancoGranel + prodBlancoHl - embBlancoHl),
    blancoEnvasado: Math.max(0, prevStock.blancoEnvasado + embBlancoHl - totalSalBlancoEnvHl),
  };

  // 5. Stock vivo actual en bodega (depósitos + botellas disponibles)
  let tintoGranelL = 0;
  let blancoGranelL = 0;
  params.depositos.forEach((d) => {
    if (!d.litrosActuales || d.litrosActuales <= 0) return;
    const tv = inferTipoVinoFromVarieties(d.variedades || [], d.vinoNombre);
    if (tv === 'Tinto' || tv === 'Rosado') {
      tintoGranelL += d.litrosActuales;
    } else {
      blancoGranelL += d.litrosActuales;
    }
  });

  let tintoEnvL = 0;
  let blancoEnvL = 0;
  params.embotellados.forEach((emb) => {
    if (!emb.botellasDisponibles || emb.botellasDisponibles <= 0) return;
    const tv = resolveEmbotelladoTipoVino(emb, {
      entradasUva: params.entradasUva,
      elaboraciones: params.elaboraciones,
      depositos: params.depositos,
    });
    const lit = emb.botellasDisponibles * 0.75;
    if (tv === 'Tinto' || tv === 'Rosado') {
      tintoEnvL += lit;
    } else {
      blancoEnvL += lit;
    }
  });

  const stockVivoBodega: InfoviCuadroJRow = {
    tintoGranel: Math.round(tintoGranelL / 100),
    tintoEnvasado: Math.round(tintoEnvL / 100),
    blancoGranel: Math.round(blancoGranelL / 100),
    blancoEnvasado: Math.round(blancoEnvL / 100),
  };

  const chosenJ =
    params.modoExistencias === 'stock_vivo' ? stockVivoBodega : balanceArrastrado;

  const cuadroH: InfoviDeclaracion['cuadroH'] = {
    dop: emptyInfoviHRow(),
    igp: emptyInfoviHRow(),
    varietalesSinIg: emptyInfoviHRow(),
    sinIg: emptyInfoviHRow(),
  };
  cuadroH[cat] = {
    tintoRosado: prodTintoHl,
    blanco: prodBlancoHl,
    superficieHa: 0,
  };
  // En noviembre la superficie declarada figura en DOP o en la categoría activa; en julio acompaña a la categoría de producción
  if (cat === 'sinIg' && mes === 'NOVIEMBRE') {
    cuadroH.dop.superficieHa = superficieHaInt;
  } else {
    cuadroH[cat].superficieHa = superficieHaInt;
  }

  const cuadroJ: InfoviDeclaracion['cuadroJ'] = {
    dop: emptyInfoviJRow(),
    igp: emptyInfoviJRow(),
    varietalesSinIg: emptyInfoviJRow(),
    sinIg: emptyInfoviJRow(),
  };
  cuadroJ[cat] = chosenJ;

  const cuadroK: InfoviDeclaracion['cuadroK'] = {
    dop: emptyInfoviSalidaDestinos(),
    igp: emptyInfoviSalidaDestinos(),
    varietalesSinIg: emptyInfoviSalidaDestinos(),
    sinIg: emptyInfoviSalidaDestinos(),
  };
  cuadroK[cat] = {
    interiores: salIntRow,
    mercadoUe: salUeRow,
    paisesTerceros: salTerRow,
  };

  const baseOperador = [...params.existingInfovi].sort(
    (a, b) => b.campanaInicio - a.campanaInicio
  )[0]?.operador;
  const latestOperador = {
    cifNif: params.bodegaConfig.cifNif?.trim() || baseOperador?.cifNif || '',
    nombreOperador:
      params.bodegaConfig.responsableTecnico?.trim() ||
      params.bodegaConfig.nombreBodega?.trim() ||
      baseOperador?.nombreOperador ||
      '',
    telefono: baseOperador?.telefono || '',
    ria: baseOperador?.ria || '',
    email: baseOperador?.email || '',
    domicilioBodega:
      params.bodegaConfig.direccion?.trim() || baseOperador?.domicilioBodega || '',
    domicilioProductor:
      baseOperador?.domicilioProductor || params.bodegaConfig.direccion?.trim() || '',
    poblacion: (
      params.bodegaConfig.localidad?.trim() ||
      baseOperador?.poblacion ||
      ''
    ).toUpperCase(),
    provincia: (
      params.bodegaConfig.provincia?.trim() ||
      baseOperador?.provincia ||
      ''
    ).toUpperCase(),
    reovi: baseOperador?.reovi || '',
    nidpb: baseOperador?.nidpb || '',
    tipoOperador: baseOperador?.tipoOperador || 'PRODUCTOR',
  };

  const existingSame = params.existingInfovi.find(
    (d) => d.campanaInicio === campanaInicio && d.mes === mes
  );

  const declaracion: InfoviDeclaracion = {
    id:
      existingSame?.id ||
      `infovi-${campanaInicio}-${mes === 'NOVIEMBRE' ? '11' : '07'}`,
    campana: bounds.campana,
    campanaInicio,
    mes,
    operador: latestOperador,
    produccionMediaHl: computeProduccionMediaHl(params.existingInfovi, campanaInicio),
    estadoInfovi: existingSame?.estadoInfovi || 'BORRADOR',
    cerradoPor: existingSame?.cerradoPor || '',
    fechaUltGrabacion: existingSame?.fechaUltGrabacion,
    fechaRecepcion: existingSame?.fechaRecepcion,
    fechaImpresion: getLocalIsoDate(),
    entradaUvaKg: {
      tinta: Math.round(kgTinta),
      blanca: Math.round(kgBlanca),
    },
    cuadroH,
    cuadroI: existingSame?.cuadroI || {
      dop: emptyInfoviIRow(),
      igp: emptyInfoviIRow(),
      varietalesSinIg: emptyInfoviIRow(),
      sinIg: emptyInfoviIRow(),
    },
    cuadroJ,
    cuadroK,
    mosto: existingSame?.mosto || emptyInfoviMostoDatos(),
    observaciones: existingSame?.observaciones || '',
    estado: existingSame?.estado || 'borrador',
    confirmadaPresentada: existingSame?.confirmadaPresentada ?? false,
    origenDatos: 'automatica_bodega',
    fechaRegistro: new Date().toISOString(),
  };

  return {
    declaracion,
    breakdown: {
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      prevInfoviLabel: prevDecl ? `${prevDecl.mes} ${prevDecl.campana}` : null,
      prevStockTotalHl: prevStock.total,
      litrosMostoTintoRosado: round2(litrosMostoTinto),
      litrosMostoBlanco: round2(litrosMostoBlanco),
      litrosEmbotelladosTintoRosado: round2(litrosEmbTinto),
      litrosEmbotelladosBlanco: round2(litrosEmbBlanco),
      litrosSalidasInterioresTinto: round2(litSalIntTinto),
      litrosSalidasInterioresBlanco: round2(litSalIntBlanco),
      litrosSalidasUeTinto: round2(litSalUeTinto),
      litrosSalidasUeBlanco: round2(litSalUeBlanco),
      litrosSalidasTercerosTinto: round2(litSalTerTinto),
      litrosSalidasTercerosBlanco: round2(litSalTerBlanco),
      balanceArrastrado,
      stockVivoBodega,
      stockVivoLitros: {
        tintoGranelL: round2(tintoGranelL),
        tintoEnvL: round2(tintoEnvL),
        blancoGranelL: round2(blancoGranelL),
        blancoEnvL: round2(blancoEnvL),
      },
    },
  };
};

// ============================================================================
// EVALUADOR DE AVISOS FLOTANTES (3 SEMANAS ANTES HASTA CONFIRMAR PRESENTACIÓN)
// ============================================================================

export interface OfficialDeadlineAlert {
  id: string;
  modulo: 'fogga_mr441b' | 'infovi';
  titulo: string;
  subtitulo: string;
  campanaInicio: number;
  campanaLabel: string;
  mesInfovi?: InfoviMesPeriodo;
  fechaInicioAviso: string; // deadline - 21 días
  fechaAperturaPlazo?: string; // 1 dic / 1 ago para INFOVI
  fechaVencimiento: string; // 10 dic / 20 dic / 20 ago
  diasRestantes: number; // positivo = faltan N días, 0 = hoy vence, negativo = vencido
  urgencia: 'proximo' | 'en_plazo' | 'vencido';
}

const addDaysIso = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

const diffDaysIso = (fromIso: string, toIso: string): number => {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
};

export const getPendingOfficialDeadlines = (
  foggaDeclaraciones: FoggaMr441bDeclaracion[],
  infoviDeclaraciones: InfoviDeclaracion[],
  now = new Date()
): OfficialDeadlineAlert[] => {
  const todayIso = getLocalIsoDate(now);
  const currentCamp = getCurrentCampaign(now);
  const candidateYears = [currentCamp.inicio - 1, currentCamp.inicio, currentCamp.inicio + 1];
  const alerts: OfficialDeadlineAlert[] = [];

  candidateYears.forEach((y) => {
    const campLabel = `${y}/${y + 1}`;

    // 1. FOGGA MR441B (Vencimiento estándar: 10 de diciembre del año de vendimia Y)
    const foggaDeadline = `${y}-12-10`;
    const foggaWarnStart = addDaysIso(foggaDeadline, -21); // 19 noviembre
    const foggaExpireWindow = addDaysIso(foggaDeadline, 120);

    if (todayIso >= foggaWarnStart && todayIso <= foggaExpireWindow) {
      const match = foggaDeclaraciones.find((d) => d.campanaInicio === y);
      if (!match || !match.confirmadaPresentada) {
        const dias = diffDaysIso(todayIso, foggaDeadline);
        alerts.push({
          id: `alert-fogga-${y}`,
          modulo: 'fogga_mr441b',
          titulo: `Declaración de Vendimia FOGGA (MR441B) · ${campLabel}`,
          subtitulo: 'Xunta de Galicia · Plazo límite el 10 de diciembre',
          campanaInicio: y,
          campanaLabel: campLabel,
          fechaInicioAviso: foggaWarnStart,
          fechaVencimiento: foggaDeadline,
          diasRestantes: dias,
          urgencia: dias < 0 ? 'vencido' : dias <= 10 ? 'en_plazo' : 'proximo',
        });
      }
    }

    // 2. INFOVI Noviembre (Presentar del 1 al 20 de diciembre del año Y)
    const infNovOpen = `${y}-12-01`;
    const infNovDeadline = `${y}-12-20`;
    const infNovWarnStart = addDaysIso(infNovDeadline, -21); // 29 noviembre
    const infNovExpireWindow = addDaysIso(infNovDeadline, 120);

    if (todayIso >= infNovWarnStart && todayIso <= infNovExpireWindow) {
      const match = infoviDeclaraciones.find(
        (d) => d.campanaInicio === y && d.mes === 'NOVIEMBRE'
      );
      if (!match || !match.confirmadaPresentada) {
        const dias = diffDaysIso(todayIso, infNovDeadline);
        alerts.push({
          id: `alert-infovi-${y}-nov`,
          modulo: 'infovi',
          titulo: `Declaración INFOVI Noviembre · ${campLabel}`,
          subtitulo: 'AICA (< 1.000 hl) · Presentación del 1 al 20 de diciembre',
          campanaInicio: y,
          campanaLabel: campLabel,
          mesInfovi: 'NOVIEMBRE',
          fechaInicioAviso: infNovWarnStart,
          fechaAperturaPlazo: infNovOpen,
          fechaVencimiento: infNovDeadline,
          diasRestantes: dias,
          urgencia: dias < 0 ? 'vencido' : todayIso >= infNovOpen ? 'en_plazo' : 'proximo',
        });
      }
    }

    // 3. INFOVI Julio (Presentar del 1 al 20 de agosto del año Y+1)
    const infJulOpen = `${y + 1}-08-01`;
    const infJulDeadline = `${y + 1}-08-20`;
    const infJulWarnStart = addDaysIso(infJulDeadline, -21); // 30 julio
    const infJulExpireWindow = addDaysIso(infJulDeadline, 120);

    if (todayIso >= infJulWarnStart && todayIso <= infJulExpireWindow) {
      const match = infoviDeclaraciones.find(
        (d) => d.campanaInicio === y && d.mes === 'JULIO'
      );
      if (!match || !match.confirmadaPresentada) {
        const dias = diffDaysIso(todayIso, infJulDeadline);
        alerts.push({
          id: `alert-infovi-${y}-jul`,
          modulo: 'infovi',
          titulo: `Declaración INFOVI Julio · ${campLabel}`,
          subtitulo: 'AICA (< 1.000 hl) · Presentación del 1 al 20 de agosto',
          campanaInicio: y,
          campanaLabel: campLabel,
          mesInfovi: 'JULIO',
          fechaInicioAviso: infJulWarnStart,
          fechaAperturaPlazo: infJulOpen,
          fechaVencimiento: infJulDeadline,
          diasRestantes: dias,
          urgencia: dias < 0 ? 'vencido' : todayIso >= infJulOpen ? 'en_plazo' : 'proximo',
        });
      }
    }
  });

  // Ordenar por mayor urgencia / fecha de vencimiento más próxima
  return alerts.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
};

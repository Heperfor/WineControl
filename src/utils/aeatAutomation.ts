import {
  AeatMateriaPrimaRegistro,
  AeatProductoElaboradoRegistro,
  BodegaConfig,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  SalidaRegistro,
  TipoVino,
} from '../types/winery';
import { inferTipoVinoFromMarca, inferTipoVinoFromVarieties } from './wineType';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const buildAeatMateriaPrimaFromEntrada = (
  ent: EntradaUva,
  numeroOrden: number,
  config: BodegaConfig
): AeatMateriaPrimaRegistro => {
  const mosto = ent.litrosMosto || 0;
  const bagazo = mosto > 0 ? Math.max(0, round2(ent.kgTotales - mosto)) : undefined;
  const varsLabel = ent.desgloseVariedades.map((v) => v.variedad).join(', ');
  const anada = ent.anada || Number(ent.fecha.slice(0, 4));

  return {
    id: `AEAT-MP-${ent.id}`,
    numeroOrden,
    observaciones: `Colleita propia ${anada} · ${ent.parcelaNombre}${varsLabel ? ` (${varsLabel})` : ''}`,
    fecha: ent.fecha,
    docNumero: ent.id,
    nifOCae: config.cifNif || '76721750Y',
    grado: ent.gradoBaboBaume,
    entradasUvasKg: ent.kgTotales,
    salidasBagazosKg: bagazo,
    existenciasUvasKg: mosto === 0 ? ent.kgTotales : undefined,
    existenciasMostoLitros: mosto > 0 ? mosto : undefined,
    origenEntradaId: ent.id,
    origenAutomatico: 'Vendimia',
    fechaRegistro: new Date().toISOString(),
  };
};

export const syncMateriasPrimasWithEntradas = (
  existing: AeatMateriaPrimaRegistro[],
  entradasUva: EntradaUva[],
  config: BodegaConfig,
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): AeatMateriaPrimaRegistro[] => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const entradaMap = new Map(entradasUva.map((e) => [e.id, e]));

  let result = existing.filter((row) => {
    if (!pruneDeleted || !row.origenEntradaId || row.editadoManualmente) return true;
    return entradaMap.has(row.origenEntradaId);
  });

  if (updateExisting) {
    result = result.map((row) => {
      if (!row.origenEntradaId || row.editadoManualmente) return row;
      const ent = entradaMap.get(row.origenEntradaId);
      if (!ent) return row;
      const rebuilt = buildAeatMateriaPrimaFromEntrada(ent, row.numeroOrden, config);
      return {
        ...rebuilt,
        id: row.id,
        fechaRegistro: row.fechaRegistro,
      };
    });
  }

  if (addMissing) {
    const presentIds = new Set(result.map((r) => r.origenEntradaId).filter(Boolean));
    const missing = entradasUva
      .filter((ent) => !presentIds.has(ent.id))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (missing.length > 0) {
      let nextOrder = result.reduce((max, r) => Math.max(max, r.numeroOrden), 0) + 1;
      const created = missing.map((ent) =>
        buildAeatMateriaPrimaFromEntrada(ent, nextOrder++, config)
      );
      result = [...result, ...created];
    }
  }

  return [...result].sort((a, b) => a.numeroOrden - b.numeroOrden);
};

export const shouldElaboracionBeInAeat = (el: ElaboracionRegistro): boolean => {
  return el.destinoTipo === 'merma_limpieza' || el.destinoTipo === 'deposito';
};

const inferRowTipoColor = (
  row: Pick<AeatProductoElaboradoRegistro, 'denominacionProducto' | 'variedad'>
): 'Blanco' | 'Tinto' => {
  const text = `${row.denominacionProducto} ${row.variedad}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    text.includes('tinto') ||
    text.includes('rosado') ||
    text.includes('fontan') ||
    text.includes('palleiros') ||
    text.includes('seixo') ||
    text.includes('caino tinto') ||
    text.includes('espadeiro') ||
    text.includes('souson')
  ) {
    return 'Tinto';
  }
  return 'Blanco';
};

const PHASE_PRIORITY: Record<string, number> = {
  entrada: 1,
  elaboracion: 2,
  embotellado: 3,
  salida: 4,
  manual: 5,
};

export const recalculateProductoElaboradoBalances = (
  rows: AeatProductoElaboradoRegistro[]
): AeatProductoElaboradoRegistro[] => {
  const sorted = [...rows].sort((a, b) => {
    const dateCmp = a.fechaMovimiento.localeCompare(b.fechaMovimiento);
    if (dateCmp !== 0) return dateCmp;
    const pA = PHASE_PRIORITY[a.origenTipo || 'manual'] ?? 5;
    const pB = PHASE_PRIORITY[b.origenTipo || 'manual'] ?? 5;
    if (pA !== pB) return pA - pB;
    return a.numeroAsiento - b.numeroAsiento;
  });

  let granelBlanco = 0;
  let granelTinto = 0;
  let embBlanco = 0;
  let embTinto = 0;

  return sorted.map((row, index) => {
    const color = inferRowTipoColor(row);
    const cant = Number(row.cantidadProducto) || 0;
    const movLower = row.tipoMovimiento.toLowerCase();
    const origenTipo = row.origenTipo || 'manual';

    if (row.editadoManualmente && origenTipo === 'manual') {
      // Respect manually entered balances if provided, otherwise update via deltas
      if (row.saldoGranelBlanco !== undefined) granelBlanco = row.saldoGranelBlanco;
      if (row.saldoGranelTinto !== undefined) granelTinto = row.saldoGranelTinto;
      if (row.saldoEmbotelladoBlanco !== undefined) embBlanco = row.saldoEmbotelladoBlanco;
      if (row.saldoEmbotelladoTinto !== undefined) embTinto = row.saldoEmbotelladoTinto;
      return { ...row, numeroAsiento: index + 1 };
    }

    if (origenTipo === 'entrada' || movLower.includes('obtención') || movLower.includes('entrada')) {
      if (color === 'Tinto') granelTinto = round2(granelTinto + cant);
      else granelBlanco = round2(granelBlanco + cant);
    } else if (origenTipo === 'elaboracion') {
      if (movLower.includes('merma') || movLower.includes('pérdida') || movLower.includes('limpieza')) {
        if (color === 'Tinto') granelTinto = Math.max(0, round2(granelTinto - cant));
        else granelBlanco = Math.max(0, round2(granelBlanco - cant));
      }
      // Trasiego / movimiento interno entre depósitos no cambia el total de granel
    } else if (origenTipo === 'embotellado' || movLower.includes('embotellado')) {
      if (color === 'Tinto') {
        granelTinto = Math.max(0, round2(granelTinto - cant));
        embTinto = round2(embTinto + cant);
      } else {
        granelBlanco = Math.max(0, round2(granelBlanco - cant));
        embBlanco = round2(embBlanco + cant);
      }
    } else if (origenTipo === 'salida' || movLower.includes('salida')) {
      if (color === 'Tinto') {
        embTinto = Math.max(0, round2(embTinto - cant));
      } else {
        embBlanco = Math.max(0, round2(embBlanco - cant));
      }
    }

    if (row.editadoManualmente) {
      if (row.saldoGranelBlanco !== undefined) granelBlanco = row.saldoGranelBlanco;
      if (row.saldoGranelTinto !== undefined) granelTinto = row.saldoGranelTinto;
      if (row.saldoEmbotelladoBlanco !== undefined) embBlanco = row.saldoEmbotelladoBlanco;
      if (row.saldoEmbotelladoTinto !== undefined) embTinto = row.saldoEmbotelladoTinto;
      return { ...row, numeroAsiento: index + 1 };
    }

    return {
      ...row,
      numeroAsiento: index + 1,
      saldoGranelBlanco: granelBlanco,
      saldoGranelTinto: granelTinto,
      saldoEmbotelladoBlanco: embBlanco,
      saldoEmbotelladoTinto: embTinto,
    };
  });
};

export const buildAeatProductoFromEntrada = (
  ent: EntradaUva,
  depositos: Deposito[],
  config: BodegaConfig,
  numeroAsiento = 1
): AeatProductoElaboradoRegistro => {
  const tipo: TipoVino =
    ent.tipoVino || inferTipoVinoFromVarieties(ent.desgloseVariedades, ent.parcelaNombre);
  const litros = ent.litrosMosto || Math.round(ent.kgTotales * 0.68);
  const dep = depositos.find((d) => d.id === ent.depositoDestinoId);
  const vars = ent.desgloseVariedades.map((v) => v.variedad).join(', ');
  const anada = ent.anada || Number(ent.fecha.slice(0, 4));
  const grad = ent.gradoBaboBaume ?? 12.5;

  return {
    id: `AEAT-PE-${ent.id}`,
    numeroAsiento,
    fechaMovimiento: ent.fecha,
    tipoMovimiento: 'Obtención / Entrada mosto',
    regimenFiscal: 'Suspensivo',
    epigrafe: 'V0',
    codigoNc: '220429',
    denominacionProducto: `Mosto/Vino ${tipo} (${dep?.vinoNombre || ent.parcelaNombre}) · Añada ${anada}`,
    referenciaInterna: `Dep. ${ent.depositoDestinoId}`,
    variedad: vars,
    cantidadProducto: litros,
    gradoAlcoholico: grad,
    alcoholPuro: round2((litros * grad) / 100),
    tipoJustificante: 'Parte Vendimia',
    numeroJustificante: ent.id,
    tipoEnvase: ent.tipoRecipiente,
    capacidadEnvase: dep ? `${dep.capacidadLitros} L` : 'Granel',
    numeroEnvases: 1,
    origenDestinoNif: config.cifNif || '',
    origenDestinoRazonSocial: 'Colleita propia',
    origenDestinoCae: '',
    origenMovimientoId: ent.id,
    origenTipo: 'entrada',
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildAeatProductoFromElaboracion = (
  el: ElaboracionRegistro,
  depositos: Deposito[],
  config: BodegaConfig,
  numeroAsiento = 1
): AeatProductoElaboradoRegistro => {
  const depOrigen = depositos.find((d) => d.id === el.depositoOrigenId);
  const tipo: TipoVino =
    el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades, depOrigen?.vinoNombre);
  const vars = el.porcentajesVariedades.map((v) => v.variedad).join(', ');
  const anada = el.anada || depOrigen?.anoCosecha || Number(el.fecha.slice(0, 4));
  const grad = el.gradoAlcoholico ?? 12.5;
  const isMerma = el.destinoTipo === 'merma_limpieza';

  return {
    id: `AEAT-PE-${el.id}`,
    numeroAsiento,
    fechaMovimiento: el.fecha,
    tipoMovimiento: isMerma
      ? 'Merma / Pérdida elaboración'
      : `Movimiento interno (${el.operacionRealizada})`,
    regimenFiscal: 'Suspensivo',
    epigrafe: 'V0',
    codigoNc: '220429',
    denominacionProducto: `Vino ${tipo} (${depOrigen?.vinoNombre || `Dep. ${el.depositoOrigenId}`}) · Añada ${anada}`,
    referenciaInterna: isMerma
      ? `Dep. ${el.depositoOrigenId} (Merma)`
      : `Dep. ${el.depositoOrigenId} -> ${el.depositoDestinoId || el.depositoOrigenId}`,
    variedad: vars,
    cantidadProducto: el.cantidadLitros,
    gradoAlcoholico: grad,
    alcoholPuro: round2((el.cantidadLitros * grad) / 100),
    tipoJustificante: 'Parte Bodega',
    numeroJustificante: el.id,
    tipoEnvase: depOrigen?.tipoRecipiente || 'Depósito',
    capacidadEnvase: depOrigen ? `${depOrigen.capacidadLitros} L` : 'Granel',
    numeroEnvases: 1,
    origenDestinoNif: config.cifNif || '',
    origenDestinoRazonSocial: isMerma
      ? 'Merma / Limpieza interna'
      : `Trasiego a Dep. ${el.depositoDestinoId || el.depositoOrigenId}`,
    origenDestinoCae: '',
    origenMovimientoId: el.id,
    origenTipo: 'elaboracion',
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildAeatProductoFromEmbotellado = (
  emb: EmbotelladoRegistro,
  config: BodegaConfig,
  numeroAsiento = 1
): AeatProductoElaboradoRegistro => {
  const tipo: TipoVino = emb.tipoVino || inferTipoVinoFromMarca(emb.marca);
  const anada = emb.anada || Number(emb.fecha.slice(0, 4));
  const grad = emb.graduacionAlcoholicaVol ?? 12.5;

  return {
    id: `AEAT-PE-${emb.id}`,
    numeroAsiento,
    fechaMovimiento: emb.fecha,
    tipoMovimiento: 'Embotellado',
    regimenFiscal: 'Suspensivo',
    epigrafe: 'V0',
    codigoNc: '220421',
    denominacionProducto: `Vino ${tipo} D.O. Rías Baixas - ${emb.marca} · Añada ${anada}`,
    referenciaInterna: emb.lote,
    variedad: emb.marca,
    cantidadProducto: emb.cantidadLitros,
    gradoAlcoholico: grad,
    alcoholPuro: round2((emb.cantidadLitros * grad) / 100),
    tipoJustificante: 'Parte Embotellado',
    numeroJustificante: emb.id,
    tipoEnvase: 'Botella 0,75 L',
    capacidadEnvase: '0,75 L',
    numeroEnvases: emb.cantidadBotellas075,
    origenDestinoNif: config.cifNif || '',
    origenDestinoRazonSocial: config.nombreBodega,
    origenDestinoCae: '',
    origenMovimientoId: emb.id,
    origenTipo: 'embotellado',
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildAeatProductoFromSalida = (
  sal: SalidaRegistro,
  embotellados: EmbotelladoRegistro[],
  numeroAsiento = 1
): AeatProductoElaboradoRegistro => {
  const embMatch = embotellados.find(
    (e) => e.id === sal.embotelladoId || e.lote === sal.lote
  );
  const tipo: TipoVino = embMatch?.tipoVino || inferTipoVinoFromMarca(sal.marca);
  const litros = round2(sal.cantidadBotellas * 0.75);
  const anada = sal.anada || embMatch?.anada || Number(sal.fecha.slice(0, 4));
  const grad = sal.gradoAlcoholico ?? embMatch?.graduacionAlcoholicaVol ?? 12.5;

  return {
    id: `AEAT-PE-${sal.id}`,
    numeroAsiento,
    fechaMovimiento: sal.fecha,
    tipoMovimiento: `Salida (${sal.tipoSalida})`,
    regimenFiscal: sal.tipoSalida === 'Exportación' ? 'Suspensivo / Exp.' : 'Imp. Devengado (0€)',
    epigrafe: 'V0',
    codigoNc: '220421',
    denominacionProducto: `Vino ${tipo} D.O. Rías Baixas - ${sal.marca} · Añada ${anada}`,
    referenciaInterna: sal.lote,
    variedad: sal.marca,
    cantidadProducto: litros,
    gradoAlcoholico: grad,
    alcoholPuro: round2((litros * grad) / 100),
    tipoJustificante: 'Albarán / Factura',
    numeroJustificante: sal.numeroAlbaranFactura,
    tipoEnvase: 'Botella 0,75 L',
    capacidadEnvase: '0,75 L',
    numeroEnvases: sal.cantidadBotellas,
    origenDestinoNif: '',
    origenDestinoRazonSocial: sal.destino,
    origenDestinoCae: '',
    origenMovimientoId: sal.id,
    origenTipo: 'salida',
    fechaRegistro: new Date().toISOString(),
  };
};

export const syncProductoElaboradoWithBodega = (
  existing: AeatProductoElaboradoRegistro[],
  params: {
    entradasUva: EntradaUva[];
    elaboraciones: ElaboracionRegistro[];
    embotellados: EmbotelladoRegistro[];
    salidas: SalidaRegistro[];
    depositos: Deposito[];
    config: BodegaConfig;
  },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): AeatProductoElaboradoRegistro[] => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const { entradasUva, elaboraciones, embotellados, salidas, depositos, config } = params;

  const entradaMap = new Map(entradasUva.map((e) => [e.id, e]));
  const elabMap = new Map(
    elaboraciones.filter(shouldElaboracionBeInAeat).map((el) => [el.id, el])
  );
  const embMap = new Map(embotellados.map((em) => [em.id, em]));
  const salMap = new Map(salidas.map((s) => [s.id, s]));

  let rows = existing.filter((row) => {
    if (!pruneDeleted || !row.origenMovimientoId || row.editadoManualmente) return true;
    return (
      entradaMap.has(row.origenMovimientoId) ||
      elabMap.has(row.origenMovimientoId) ||
      embMap.has(row.origenMovimientoId) ||
      salMap.has(row.origenMovimientoId)
    );
  });

  if (updateExisting) {
    rows = rows.map((row) => {
      if (!row.origenMovimientoId || row.editadoManualmente) return row;
      const oid = row.origenMovimientoId;
      if (entradaMap.has(oid)) {
        const rebuilt = buildAeatProductoFromEntrada(
          entradaMap.get(oid)!,
          depositos,
          config,
          row.numeroAsiento
        );
        return { ...rebuilt, id: row.id, fechaRegistro: row.fechaRegistro };
      }
      if (elabMap.has(oid)) {
        const rebuilt = buildAeatProductoFromElaboracion(
          elabMap.get(oid)!,
          depositos,
          config,
          row.numeroAsiento
        );
        return { ...rebuilt, id: row.id, fechaRegistro: row.fechaRegistro };
      }
      if (embMap.has(oid)) {
        const rebuilt = buildAeatProductoFromEmbotellado(
          embMap.get(oid)!,
          config,
          row.numeroAsiento
        );
        return { ...rebuilt, id: row.id, fechaRegistro: row.fechaRegistro };
      }
      if (salMap.has(oid)) {
        const rebuilt = buildAeatProductoFromSalida(
          salMap.get(oid)!,
          embotellados,
          row.numeroAsiento
        );
        return { ...rebuilt, id: row.id, fechaRegistro: row.fechaRegistro };
      }
      return row;
    });
  }

  if (addMissing) {
    const presentIds = new Set(rows.map((r) => r.origenMovimientoId).filter(Boolean));
    const additions: AeatProductoElaboradoRegistro[] = [];

    entradasUva.forEach((ent) => {
      if (!presentIds.has(ent.id)) {
        additions.push(buildAeatProductoFromEntrada(ent, depositos, config));
      }
    });

    elaboraciones.filter(shouldElaboracionBeInAeat).forEach((el) => {
      if (!presentIds.has(el.id)) {
        additions.push(buildAeatProductoFromElaboracion(el, depositos, config));
      }
    });

    embotellados.forEach((emb) => {
      if (!presentIds.has(emb.id)) {
        additions.push(buildAeatProductoFromEmbotellado(emb, config));
      }
    });

    salidas.forEach((sal) => {
      if (!presentIds.has(sal.id)) {
        additions.push(buildAeatProductoFromSalida(sal, embotellados));
      }
    });

    rows = [...rows, ...additions];
  }

  return recalculateProductoElaboradoBalances(rows);
};

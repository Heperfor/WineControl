import {
  BodegaConfig,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  MedioRuralEmbotelladoEntradaRegistro,
  MedioRuralEmbotelladoSalidaRegistro,
  MedioRuralEntradaRegistro,
  MedioRuralMovimientoProductoRegistro,
  MedioRuralPracticaEnologicaRegistro,
  MedioRuralProcesoElaboracionRegistro,
  MedioRuralSalidaRegistro,
  SalidaRegistro,
  TipoVino,
} from '../types/winery';
import { inferTipoVinoFromMarca, inferTipoVinoFromVarieties } from './wineType';

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const toGalegoColor = (tipo: TipoVino): 'Branco' | 'Tinto' | 'Rosado' => {
  if (tipo === 'Blanco') return 'Branco';
  if (tipo === 'Rosado') return 'Rosado';
  return 'Tinto';
};

const isBlancoColumn = (tipo: TipoVino) => tipo === 'Blanco';

const parseDoseGlAndKg = (
  rawText: string | undefined,
  litros: number,
  defaultDoseGl: number
): { doseGl: number; kg: number; rawLabel: string } => {
  const txt = (rawText || '').trim();
  const match = txt.match(/(\d+(?:[.,]\d+)?)\s*(g\/hl|g\/l|mg\/l|kg|g)?/i);
  let doseGl = defaultDoseGl;
  if (match) {
    const val = Number(match[1].replace(',', '.'));
    const unit = (match[2] || '').toLowerCase();
    if (Number.isFinite(val) && val > 0) {
      if (unit === 'g/hl') {
        doseGl = round3(val / 100);
      } else if (unit === 'mg/l') {
        doseGl = round3(val / 1000);
      } else if (unit === 'kg') {
        const kgDirect = round3(val);
        return {
          doseGl: litros > 0 ? round3((kgDirect * 1000) / litros) : defaultDoseGl,
          kg: kgDirect,
          rawLabel: txt,
        };
      } else if (unit === 'g') {
        const kgDirect = round3(val / 1000);
        return {
          doseGl: litros > 0 ? round3((val) / litros) : defaultDoseGl,
          kg: kgDirect,
          rawLabel: txt,
        };
      } else {
        doseGl = val;
      }
    }
  }
  const kg = round3((doseGl * litros) / 1000);
  return { doseGl, kg, rawLabel: txt || `${doseGl} g/l` };
};

// ============================================================================
// LIBRO 1: REXISTRO DE ENTRADAS E SAÍDAS
// ============================================================================

export const buildMedioRuralL1EntradaFromVendimia = (
  ent: EntradaUva
): MedioRuralEntradaRegistro => {
  const tipo: TipoVino =
    ent.tipoVino || inferTipoVinoFromVarieties(ent.desgloseVariedades, ent.parcelaNombre);
  const litros = ent.litrosMosto || Math.round(ent.kgTotales * 0.68);
  const vars = ent.desgloseVariedades.map((v) => v.variedad).join(', ');
  const year = ent.anada || Number(ent.fecha.slice(0, 4));
  const blanco = isBlancoColumn(tipo);

  return {
    id: `MR-L1-ENT-${ent.id}`,
    data: ent.fecha,
    docClase: '',
    docNumero: ent.id,
    procedencia: 'Colleita propia',
    zonaViticola: 'C II',
    mostoBrancos: blanco ? litros : undefined,
    mostoTintos: !blanco ? litros : undefined,
    graduacionTotal: ent.gradoBaboBaume ?? 12.5,
    observacions: `Colleita ${year} · ${ent.parcelaNombre}${vars ? ` (${vars})` : ''}${
      tipo === 'Rosado' ? ' [Rosado]' : ''
    }`,
    origenMovimientoId: ent.id,
    origenAutomatico: 'Vendimia',
    fechaRegistro: new Date().toISOString(),
  };
};

export const shouldElaboracionGenerateL1Entrada = (el: ElaboracionRegistro): boolean => {
  return el.operacionRealizada === 'Fermentación maloláctica';
};

export const buildMedioRuralL1EntradaFromElab = (
  el: ElaboracionRegistro,
  depositos: Deposito[]
): MedioRuralEntradaRegistro => {
  const dep = depositos.find((d) => d.id === el.depositoOrigenId);
  const tipo: TipoVino =
    el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades, dep?.vinoNombre);
  const blanco = isBlancoColumn(tipo);
  const anada = el.anada || dep?.anoCosecha || Number(el.fecha.slice(0, 4));

  return {
    id: `MR-L1-ENT-${el.id}`,
    data: el.fecha,
    docClase: '',
    docNumero: el.id,
    procedencia: 'Fermentación',
    zonaViticola: 'C II',
    vinoBrancos: blanco ? el.cantidadLitros : undefined,
    vinoTintos: !blanco ? el.cantidadLitros : undefined,
    graduacionAdquirida: el.gradoAlcoholico ?? 12.8,
    observacions: `${dep?.vinoNombre || `Dep. ${el.depositoOrigenId}`} · Añada ${anada} · ${el.operacionRealizada}`,
    origenMovimientoId: el.id,
    origenAutomatico: 'Elaboración',
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildMedioRuralL1SalidaFromEmbotellado = (
  emb: EmbotelladoRegistro
): MedioRuralSalidaRegistro => {
  const tipo: TipoVino = emb.tipoVino || inferTipoVinoFromMarca(emb.marca);
  const blanco = isBlancoColumn(tipo);
  const anada = emb.anada || Number(emb.fecha.slice(0, 4));

  return {
    id: `MR-L1-SAL-${emb.id}`,
    data: emb.fecha,
    docClase: '',
    docNumeroReferencia: emb.id,
    destino: 'Embotellado',
    zonaViticola: 'C II',
    vinoBrancos: blanco ? emb.cantidadLitros : undefined,
    vinoTintos: !blanco ? emb.cantidadLitros : undefined,
    graduacionAdquirida: emb.graduacionAlcoholicaVol ?? 12.5,
    observacions: `${emb.marca} · Añada ${anada} · Lote ${emb.lote}`,
    origenMovimientoId: emb.id,
    origenAutomatico: 'Embotellado',
    fechaRegistro: new Date().toISOString(),
  };
};

export const shouldElaboracionGenerateL1Salida = (el: ElaboracionRegistro): boolean => {
  return el.destinoTipo === 'merma_limpieza';
};

export const buildMedioRuralL1SalidaFromElab = (
  el: ElaboracionRegistro,
  depositos: Deposito[]
): MedioRuralSalidaRegistro => {
  const dep = depositos.find((d) => d.id === el.depositoOrigenId);
  const tipo: TipoVino =
    el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades, dep?.vinoNombre);
  const blanco = isBlancoColumn(tipo);
  const anada = el.anada || dep?.anoCosecha || Number(el.fecha.slice(0, 4));

  return {
    id: `MR-L1-SAL-${el.id}`,
    data: el.fecha,
    docClase: '',
    docNumeroReferencia: el.id,
    destino: 'Fin FA / Merma e lías',
    zonaViticola: 'C II',
    vinoBrancos: blanco ? el.cantidadLitros : undefined,
    vinoTintos: !blanco ? el.cantidadLitros : undefined,
    outrosDesignacion: 'Lías',
    outrosCantidade: `${el.cantidadLitros} l`,
    graduacionTotal: el.gradoAlcoholico ?? 12.5,
    observacions: `Dep. ${el.depositoOrigenId} · Añada ${anada} · ${el.operacionRealizada}`,
    origenMovimientoId: el.id,
    origenAutomatico: 'Elaboración',
    fechaRegistro: new Date().toISOString(),
  };
};

export const syncMedioRuralLibro1 = (
  existingEntradas: MedioRuralEntradaRegistro[],
  existingSalidas: MedioRuralSalidaRegistro[],
  params: {
    entradasUva: EntradaUva[];
    elaboraciones: ElaboracionRegistro[];
    embotellados: EmbotelladoRegistro[];
    depositos: Deposito[];
  },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): { entradas: MedioRuralEntradaRegistro[]; salidas: MedioRuralSalidaRegistro[] } => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const { entradasUva, elaboraciones, embotellados, depositos } = params;

  const entMap = new Map(entradasUva.map((e) => [e.id, e]));
  const elabEntMap = new Map(
    elaboraciones.filter(shouldElaboracionGenerateL1Entrada).map((el) => [el.id, el])
  );
  const embMap = new Map(embotellados.map((em) => [em.id, em]));
  const elabSalMap = new Map(
    elaboraciones.filter(shouldElaboracionGenerateL1Salida).map((el) => [el.id, el])
  );

  // Sync Entradas
  let nextEntradas = existingEntradas.filter((r) => {
    if (!pruneDeleted || !r.origenMovimientoId || r.editadoManualmente) return true;
    return entMap.has(r.origenMovimientoId) || elabEntMap.has(r.origenMovimientoId);
  });

  if (updateExisting) {
    nextEntradas = nextEntradas.map((r) => {
      if (!r.origenMovimientoId || r.editadoManualmente) return r;
      if (entMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL1EntradaFromVendimia(entMap.get(r.origenMovimientoId)!);
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      if (elabEntMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL1EntradaFromElab(
          elabEntMap.get(r.origenMovimientoId)!,
          depositos
        );
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      return r;
    });
  }

  if (addMissing) {
    const presentEntIds = new Set(nextEntradas.map((r) => r.origenMovimientoId).filter(Boolean));
    entradasUva.forEach((ent) => {
      if (!presentEntIds.has(ent.id)) {
        nextEntradas.push(buildMedioRuralL1EntradaFromVendimia(ent));
      }
    });
    elaboraciones.filter(shouldElaboracionGenerateL1Entrada).forEach((el) => {
      if (!presentEntIds.has(el.id)) {
        nextEntradas.push(buildMedioRuralL1EntradaFromElab(el, depositos));
      }
    });
  }

  // Sync Salidas
  let nextSalidas = existingSalidas.filter((r) => {
    if (!pruneDeleted || !r.origenMovimientoId || r.editadoManualmente) return true;
    return embMap.has(r.origenMovimientoId) || elabSalMap.has(r.origenMovimientoId);
  });

  if (updateExisting) {
    nextSalidas = nextSalidas.map((r) => {
      if (!r.origenMovimientoId || r.editadoManualmente) return r;
      if (embMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL1SalidaFromEmbotellado(embMap.get(r.origenMovimientoId)!);
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      if (elabSalMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL1SalidaFromElab(
          elabSalMap.get(r.origenMovimientoId)!,
          depositos
        );
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      return r;
    });
  }

  if (addMissing) {
    const presentSalIds = new Set(nextSalidas.map((r) => r.origenMovimientoId).filter(Boolean));
    embotellados.forEach((emb) => {
      if (!presentSalIds.has(emb.id)) {
        nextSalidas.push(buildMedioRuralL1SalidaFromEmbotellado(emb));
      }
    });
    elaboraciones.filter(shouldElaboracionGenerateL1Salida).forEach((el) => {
      if (!presentSalIds.has(el.id)) {
        nextSalidas.push(buildMedioRuralL1SalidaFromElab(el, depositos));
      }
    });
  }

  return {
    entradas: [...nextEntradas].sort((a, b) => a.data.localeCompare(b.data)),
    salidas: [...nextSalidas].sort((a, b) => a.data.localeCompare(b.data)),
  };
};

// ============================================================================
// LIBRO 2: LIBRO DE EMBOTELLADOS (PÁG. 1 ENTRADAS + PÁG. 2 SAÍDAS)
// ============================================================================

export const buildMedioRuralL2EntradaFromEmbotellado = (
  emb: EmbotelladoRegistro
): MedioRuralEmbotelladoEntradaRegistro => {
  const tipo: TipoVino = emb.tipoVino || inferTipoVinoFromMarca(emb.marca);
  const colorGal = toGalegoColor(tipo);
  const ano = emb.anada ? String(emb.anada) : emb.fecha.slice(0, 4);
  const gradStr = emb.graduacionAlcoholicaVol ? `${emb.graduacionAlcoholicaVol}%` : '';

  return {
    id: `MR-L2-ENT-${emb.id}`,
    data: emb.fecha,
    designacionProduto: `${colorGal}. ${emb.marca} ${ano}${gradStr ? ` (${gradStr})` : ''}`,
    litros: emb.cantidadLitros,
    numBotellas: emb.cantidadBotellas075,
    referenciaPrecintas: '/',
    lote: emb.lote,
    encargoNomeEmbotellador: '',
    encargoEnderezo: '',
    origenEmbotelladoId: emb.id,
    origenAutomatico: 'Embotellado',
    fechaRegistro: new Date().toISOString(),
  };
};

export const buildMedioRuralL2SalidaFromSalida = (
  sal: SalidaRegistro
): MedioRuralEmbotelladoSalidaRegistro => {
  const anadaStr = sal.anada ? ` · Añada ${sal.anada}` : '';
  const gradStr = sal.gradoAlcoholico !== undefined ? ` · ${sal.gradoAlcoholico}% vol` : '';
  return {
    id: `MR-L2-SAL-${sal.id}`,
    data: sal.fecha,
    documentoComercial: `${sal.numeroAlbaranFactura} (${sal.tipoSalida})`,
    litros: round2(sal.cantidadBotellas * 0.75),
    observacions: `${sal.marca}${anadaStr}${gradStr} · Lote ${sal.lote} (${sal.cantidadBotellas} bot.) · ${sal.destino}`,
    origenSalidaId: sal.id,
    origenAutomatico: 'Salida',
    fechaRegistro: new Date().toISOString(),
  };
};

export const syncMedioRuralLibro2 = (
  existingEntradas: MedioRuralEmbotelladoEntradaRegistro[],
  existingSalidas: MedioRuralEmbotelladoSalidaRegistro[],
  params: {
    embotellados: EmbotelladoRegistro[];
    salidas: SalidaRegistro[];
  },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): {
  entradas: MedioRuralEmbotelladoEntradaRegistro[];
  salidas: MedioRuralEmbotelladoSalidaRegistro[];
} => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const embMap = new Map(params.embotellados.map((e) => [e.id, e]));
  const salMap = new Map(params.salidas.map((s) => [s.id, s]));

  let nextEntradas = existingEntradas.filter((r) => {
    if (!pruneDeleted || !r.origenEmbotelladoId || r.editadoManualmente) return true;
    return embMap.has(r.origenEmbotelladoId);
  });

  if (updateExisting) {
    nextEntradas = nextEntradas.map((r) => {
      if (!r.origenEmbotelladoId || r.editadoManualmente) return r;
      const emb = embMap.get(r.origenEmbotelladoId);
      if (!emb) return r;
      const rebuilt = buildMedioRuralL2EntradaFromEmbotellado(emb);
      return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
    });
  }

  if (addMissing) {
    const presentIds = new Set(nextEntradas.map((r) => r.origenEmbotelladoId).filter(Boolean));
    params.embotellados.forEach((emb) => {
      if (!presentIds.has(emb.id)) {
        nextEntradas.push(buildMedioRuralL2EntradaFromEmbotellado(emb));
      }
    });
  }

  let nextSalidas = existingSalidas.filter((r) => {
    if (!pruneDeleted || !r.origenSalidaId || r.editadoManualmente) return true;
    return salMap.has(r.origenSalidaId);
  });

  if (updateExisting) {
    nextSalidas = nextSalidas.map((r) => {
      if (!r.origenSalidaId || r.editadoManualmente) return r;
      const sal = salMap.get(r.origenSalidaId);
      if (!sal) return r;
      const rebuilt = buildMedioRuralL2SalidaFromSalida(sal);
      return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
    });
  }

  if (addMissing) {
    const presentIds = new Set(nextSalidas.map((r) => r.origenSalidaId).filter(Boolean));
    params.salidas.forEach((sal) => {
      if (!presentIds.has(sal.id)) {
        nextSalidas.push(buildMedioRuralL2SalidaFromSalida(sal));
      }
    });
  }

  return {
    entradas: [...nextEntradas].sort((a, b) => a.data.localeCompare(b.data)),
    salidas: [...nextSalidas].sort((a, b) => a.data.localeCompare(b.data)),
  };
};

// ============================================================================
// LIBRO 3: MOVEMENTOS DE PRODUTOS PARA ELABORACIÓN E PRÁCTICAS ENOLÓXICAS
// ============================================================================

export const shouldElaboracionBeInLibro3 = (el: ElaboracionRegistro): boolean => {
  return (
    el.operacionRealizada === 'Sulfitado' ||
    el.operacionRealizada === 'Correcciones' ||
    el.operacionRealizada === 'Clarificación'
  );
};

export const buildMedioRuralL3FromElaboracion = (
  el: ElaboracionRegistro,
  config: BodegaConfig
): MedioRuralMovimientoProductoRegistro => {
  const localidade = config.localidad?.trim() || '';
  const nomeBodega = config.nombreBodega?.trim() || 'Bodega';
  const base: MedioRuralMovimientoProductoRegistro = {
    id: `MR-L3-${el.id}`,
    data: el.fecha,
    procedenciaRazonSocial: 'Almacén Enolóxico Bodega',
    procedenciaEnderezo: localidade,
    destinoRazonSocial: `${nomeBodega} (Dep. ${el.depositoOrigenId})`,
    destinoEnderezo: `${localidade ? `${localidade} ` : ''}(${round2(el.cantidadLitros)} L)`,
    documentoFactura: el.id,
    mostoConcConcentracion: '',
    alcoholTipoGrao: '',
    outrosProduto: '',
    outrosGradConcentracion: '',
    origenMovimientoId: el.id,
    origenAutomatico: 'Elaboración',
    fechaRegistro: new Date().toISOString(),
  };

  if (el.operacionRealizada === 'Sulfitado') {
    const { kg, rawLabel } = parseDoseGlAndKg(el.cantidadSulfitado, el.cantidadLitros, 0.3);
    return {
      ...base,
      outrosProduto: 'Metabisulfito potásico (SO2)',
      outrosGradConcentracion: rawLabel || 'E-224 · 57% SO2',
      outrosSaidaLitroKg: kg,
    };
  }

  if (el.operacionRealizada === 'Correcciones') {
    const det = (el.detalleCorreccion || '').toLowerCase();
    const { kg, rawLabel } = parseDoseGlAndKg(el.detalleCorreccion, el.cantidadLitros, 0.5);
    if (det.includes('tartárico') || det.includes('tartarico')) {
      return { ...base, acidoTartaricoSaidaKg: kg };
    }
    if (det.includes('sacarosa') || det.includes('azúcar') || det.includes('azucar')) {
      return { ...base, sacarosaSaidaKg: kg };
    }
    if (det.includes('mosto')) {
      return {
        ...base,
        mostoConcConcentracion: rawLabel,
        mostoConcSaidaLitros: round2(kg),
      };
    }
    if (det.includes('alcohol')) {
      return {
        ...base,
        alcoholTipoGrao: rawLabel || 'Alcohol vínico',
        alcoholSaidaLitros: round2(kg),
      };
    }
    return {
      ...base,
      outrosProduto: el.detalleCorreccion || 'Producto corrector enológico',
      outrosGradConcentracion: rawLabel || 'Uso enológico',
      outrosSaidaLitroKg: kg,
    };
  }

  // Clarificación
  const bentonitaKg = round3((0.4 * el.cantidadLitros) / 1000);
  return {
    ...base,
    outrosProduto: 'Clarificante (Bentonita sódica)',
    outrosGradConcentracion: '0,4 g/l',
    outrosSaidaLitroKg: bentonitaKg,
  };
};

export const syncMedioRuralLibro3 = (
  existing: MedioRuralMovimientoProductoRegistro[],
  params: { elaboraciones: ElaboracionRegistro[]; config: BodegaConfig },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): MedioRuralMovimientoProductoRegistro[] => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const elabMap = new Map(
    params.elaboraciones.filter(shouldElaboracionBeInLibro3).map((e) => [e.id, e])
  );

  let rows = existing.filter((r) => {
    if (!pruneDeleted || !r.origenMovimientoId || r.editadoManualmente) return true;
    return elabMap.has(r.origenMovimientoId);
  });

  if (updateExisting) {
    rows = rows.map((r) => {
      if (!r.origenMovimientoId || r.editadoManualmente) return r;
      const el = elabMap.get(r.origenMovimientoId);
      if (!el) return r;
      const rebuilt = buildMedioRuralL3FromElaboracion(el, params.config);
      return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
    });
  }

  if (addMissing) {
    const present = new Set(rows.map((r) => r.origenMovimientoId).filter(Boolean));
    params.elaboraciones.filter(shouldElaboracionBeInLibro3).forEach((el) => {
      if (!present.has(el.id)) {
        rows.push(buildMedioRuralL3FromElaboracion(el, params.config));
      }
    });
  }

  return [...rows].sort((a, b) => a.data.localeCompare(b.data));
};

// ============================================================================
// LIBRO 4: LIBRO DE PRÁCTICAS ENOLÓXICAS
// ============================================================================

export const shouldElaboracionBeInLibro4 = (el: ElaboracionRegistro): boolean => {
  return (
    el.operacionRealizada === 'Sulfitado' ||
    el.operacionRealizada === 'Correcciones' ||
    el.operacionRealizada === 'Clarificación' ||
    el.operacionRealizada === 'Estabilización por frío' ||
    el.operacionRealizada === 'Filtración' ||
    el.operacionRealizada === 'Battonage sobre lías finas'
  );
};

export const buildMedioRuralL4FromElaboracion = (
  el: ElaboracionRegistro,
  depositos: Deposito[]
): MedioRuralPracticaEnologicaRegistro => {
  const dep = depositos.find((d) => d.id === el.depositoOrigenId);
  const tipo: TipoVino =
    el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades, dep?.vinoNombre);
  const colorGal = toGalegoColor(tipo);
  const anada = el.anada || dep?.anoCosecha || Number(el.fecha.slice(0, 4));
  const produtoLabel = `Viño ${colorGal} ${anada} (${dep?.vinoNombre || `Dep. ${el.depositoOrigenId}`})`;
  const envaseOri = `Dep. ${el.depositoOrigenId}`;
  const envaseDest = `Dep. ${el.depositoDestinoId || el.depositoOrigenId}`;
  const gradAdq = el.gradoAlcoholico ?? 12.6;
  const gradTot = el.gradoAlcoholico ?? 12.6;
  const acidez = 6.2;

  const base: MedioRuralPracticaEnologicaRegistro = {
    id: `MR-L4-${el.id}`,
    data: el.fecha,
    partidaIdenEnvases: envaseOri,
    partidaProduto: produtoLabel,
    partidaLitrosUtilizados: round2(el.cantidadLitros),
    partidaGraduacionAdq: round2(gradAdq),
    partidaGraduacionTotal: round2(gradTot),
    partidaAcidezTotalGl: acidez,
    sulfitadoProduto: '',
    acidProduto: '',
    outrasProduto: '',
    outrasGradDensidade: '',
    outrasCantidadeKgOL: '',
    finalIdenEnvases: envaseDest,
    finalProduto: produtoLabel,
    finalLitrosObtidos: round2(el.cantidadLitros),
    finalGraduacionAdq: round2(gradAdq),
    finalGraduacionTotal: round2(gradTot),
    finalAcidezGl: acidez,
    observacions: `${el.operacionRealizada} · Parte ${el.id}`,
    origenMovimientoId: el.id,
    origenAutomatico: 'Elaboración',
    fechaRegistro: new Date().toISOString(),
  };

  if (el.operacionRealizada === 'Sulfitado') {
    const { doseGl, kg } = parseDoseGlAndKg(el.cantidadSulfitado, el.cantidadLitros, 0.3);
    return {
      ...base,
      sulfitadoProduto: 'Metabisulfito potásico (SO2)',
      sulfitadoDoseGl: doseGl,
      sulfitadoCantidadeKg: kg,
    };
  }

  if (el.operacionRealizada === 'Correcciones') {
    const { doseGl, kg } = parseDoseGlAndKg(el.detalleCorreccion, el.cantidadLitros, 0.5);
    return {
      ...base,
      acidProduto: el.detalleCorreccion || 'Ácido Tartárico',
      acidDosesGl: doseGl,
      acidCantidadeKg: kg,
    };
  }

  return {
    ...base,
    outrasProduto: el.operacionRealizada,
    outrasGradDensidade: '0,992',
    outrasCantidadeKgOL:
      el.operacionRealizada === 'Clarificación'
        ? `${round3((0.4 * el.cantidadLitros) / 1000)} kg`
        : `${el.cantidadLitros} l`,
  };
};

export const syncMedioRuralLibro4 = (
  existing: MedioRuralPracticaEnologicaRegistro[],
  params: { elaboraciones: ElaboracionRegistro[]; depositos: Deposito[] },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): MedioRuralPracticaEnologicaRegistro[] => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const elabMap = new Map(
    params.elaboraciones.filter(shouldElaboracionBeInLibro4).map((e) => [e.id, e])
  );

  let rows = existing.filter((r) => {
    if (!pruneDeleted || !r.origenMovimientoId || r.editadoManualmente) return true;
    return elabMap.has(r.origenMovimientoId);
  });

  if (updateExisting) {
    rows = rows.map((r) => {
      if (!r.origenMovimientoId || r.editadoManualmente) return r;
      const el = elabMap.get(r.origenMovimientoId);
      if (!el) return r;
      const rebuilt = buildMedioRuralL4FromElaboracion(el, params.depositos);
      return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
    });
  }

  if (addMissing) {
    const present = new Set(rows.map((r) => r.origenMovimientoId).filter(Boolean));
    params.elaboraciones.filter(shouldElaboracionBeInLibro4).forEach((el) => {
      if (!present.has(el.id)) {
        rows.push(buildMedioRuralL4FromElaboracion(el, params.depositos));
      }
    });
  }

  return [...rows].sort((a, b) => a.data.localeCompare(b.data));
};

// ============================================================================
// LIBRO 5: LIBRO DE PROCESOS DE ELABORACIÓN
// ============================================================================

export const shouldElaboracionBeInLibro5 = (el: ElaboracionRegistro): boolean => {
  return (
    el.operacionRealizada === 'Desfangado estático en frío' ||
    el.operacionRealizada === 'Remontado / Bazuqueo' ||
    el.operacionRealizada === 'Fermentación maloláctica' ||
    el.operacionRealizada === 'Trasiego y desborre' ||
    el.operacionRealizada === 'Ensamblaje / Coupage'
  );
};

export const buildMedioRuralL5FromEntrada = (
  ent: EntradaUva,
  num = 1
): MedioRuralProcesoElaboracionRegistro => {
  const tipo: TipoVino =
    ent.tipoVino || inferTipoVinoFromVarieties(ent.desgloseVariedades, ent.parcelaNombre);
  const colorGal = toGalegoColor(tipo);
  const litros = ent.litrosMosto || Math.round(ent.kgTotales * 0.68);
  const anada = ent.anada || Number(ent.fecha.slice(0, 4));
  const grad = ent.gradoBaboBaume ?? 12.5;

  return {
    id: `MR-L5-${ent.id}`,
    num,
    dataInicio: ent.fecha,
    procesoCodigo: 'FA · Fermentación alcohólica',
    partidaIdenEnvases: `Dep. ${ent.depositoDestinoId}`,
    partidaProduto: `Mosto ${colorGal} ${anada} (${ent.parcelaNombre})`,
    partidaLitrosUtilizados: round2(litros),
    partidaGradDensidade: `${round2(grad)}% / 1,090`,
    incorporadoProduto: '',
    incorporadoGradDensidade: '',
    incorporadoCantidadeLKg: '',
    finalIdenEnvases: `Dep. ${ent.depositoDestinoId}`,
    finalProduto: `Viño ${colorGal} ${anada} en fermentación`,
    finalLitrosObtidos: round2(litros),
    finalGradAdq: round2(grad),
    finalGradTotal: round2(grad),
    observacions: `Vendimia ${ent.id} · Añada ${anada} (${ent.kgTotales} kg uva)`,
    origenMovimientoId: ent.id,
    origenAutomatico: 'Vendimia',
    fechaRegistro: new Date().toISOString(),
  };
};

const getProcesoCodigoArt10 = (op: string): string => {
  if (op === 'Desfangado estático en frío') return 'DESF · Desfangado en frío';
  if (op === 'Remontado / Bazuqueo') return 'MAC · Remontado / Bazuqueo';
  if (op === 'Fermentación maloláctica') return 'FML · Fermentación maloláctica';
  if (op === 'Trasiego y desborre') return 'TRAS · Trasiego e desborre';
  if (op === 'Ensamblaje / Coupage') return 'COUP · Ensamblaxe / Coupage';
  return op;
};

export const buildMedioRuralL5FromElaboracion = (
  el: ElaboracionRegistro,
  depositos: Deposito[],
  num = 1
): MedioRuralProcesoElaboracionRegistro => {
  const depOri = depositos.find((d) => d.id === el.depositoOrigenId);
  const depDest = el.depositoDestinoId
    ? depositos.find((d) => d.id === el.depositoDestinoId)
    : undefined;
  const tipo: TipoVino =
    el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades, depOri?.vinoNombre);
  const colorGal = toGalegoColor(tipo);
  const anada = el.anada || depOri?.anoCosecha || Number(el.fecha.slice(0, 4));
  const grad = el.gradoAlcoholico ?? 12.6;
  const gradFmt = String(grad).replace('.', ',');
  const isCoupage =
    el.operacionRealizada === 'Ensamblaje / Coupage' &&
    el.depositoDestinoId &&
    el.depositoDestinoId !== el.depositoOrigenId;

  return {
    id: `MR-L5-${el.id}`,
    num,
    dataInicio: el.fecha,
    procesoCodigo: getProcesoCodigoArt10(el.operacionRealizada),
    partidaIdenEnvases: `Dep. ${el.depositoOrigenId}`,
    partidaProduto: `Viño ${colorGal} ${anada} (${depOri?.vinoNombre || `Dep. ${el.depositoOrigenId}`})`,
    partidaLitrosUtilizados: round2(el.cantidadLitros),
    partidaGradDensidade: `${gradFmt}% / 0,992`,
    incorporadoProduto: isCoupage
      ? `Viño ${depDest?.vinoNombre || `Dep. ${el.depositoDestinoId}`}`
      : '',
    incorporadoGradDensidade: isCoupage ? `${gradFmt}%` : '',
    incorporadoCantidadeLKg: isCoupage ? `${round2(el.cantidadLitros)} l` : '',
    finalIdenEnvases: `Dep. ${el.depositoDestinoId || el.depositoOrigenId}`,
    finalProduto: `Viño ${colorGal} ${anada} (${depDest?.vinoNombre || depOri?.vinoNombre || `Dep. ${el.depositoDestinoId || el.depositoOrigenId}`})`,
    finalLitrosObtidos: round2(el.cantidadLitros),
    finalGradAdq: round2(grad),
    finalGradTotal: round2(grad),
    observacions: `Parte ${el.id} · Añada ${anada} · ${el.destinoTipo === 'deposito' ? 'Trasiego' : 'Proceso en depósito'}`,
    origenMovimientoId: el.id,
    origenAutomatico: 'Elaboración',
    fechaRegistro: new Date().toISOString(),
  };
};

export const reindexLibro5Procesos = (
  rows: MedioRuralProcesoElaboracionRegistro[]
): MedioRuralProcesoElaboracionRegistro[] => {
  return [...rows]
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .map((row, idx) => ({ ...row, num: idx + 1 }));
};

export const syncMedioRuralLibro5 = (
  existing: MedioRuralProcesoElaboracionRegistro[],
  params: {
    entradasUva: EntradaUva[];
    elaboraciones: ElaboracionRegistro[];
    depositos: Deposito[];
  },
  options: { addMissing?: boolean; updateExisting?: boolean; pruneDeleted?: boolean } = {}
): MedioRuralProcesoElaboracionRegistro[] => {
  const { addMissing = true, updateExisting = true, pruneDeleted = false } = options;
  const entMap = new Map(params.entradasUva.map((e) => [e.id, e]));
  const elabMap = new Map(
    params.elaboraciones.filter(shouldElaboracionBeInLibro5).map((e) => [e.id, e])
  );

  let rows = existing.filter((r) => {
    if (!pruneDeleted || !r.origenMovimientoId || r.editadoManualmente) return true;
    return entMap.has(r.origenMovimientoId) || elabMap.has(r.origenMovimientoId);
  });

  if (updateExisting) {
    rows = rows.map((r) => {
      if (!r.origenMovimientoId || r.editadoManualmente) return r;
      if (entMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL5FromEntrada(entMap.get(r.origenMovimientoId)!, r.num);
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      if (elabMap.has(r.origenMovimientoId)) {
        const rebuilt = buildMedioRuralL5FromElaboracion(
          elabMap.get(r.origenMovimientoId)!,
          params.depositos,
          r.num
        );
        return { ...rebuilt, id: r.id, fechaRegistro: r.fechaRegistro };
      }
      return r;
    });
  }

  if (addMissing) {
    const present = new Set(rows.map((r) => r.origenMovimientoId).filter(Boolean));
    params.entradasUva.forEach((ent) => {
      if (!present.has(ent.id)) {
        rows.push(buildMedioRuralL5FromEntrada(ent));
      }
    });
    params.elaboraciones.filter(shouldElaboracionBeInLibro5).forEach((el) => {
      if (!present.has(el.id)) {
        rows.push(buildMedioRuralL5FromElaboracion(el, params.depositos));
      }
    });
  }

  return reindexLibro5Procesos(rows);
};

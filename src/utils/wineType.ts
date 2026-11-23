import {
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  MarcaVino,
  TipoEtiqueta,
  TipoVino,
} from '../types/winery';

const RED_VARIETY_HINTS = [
  'tinto',
  'tinta',
  'espadeiro',
  'souson',
  'sousón',
  'brancellao',
  'mencia',
  'mencía',
  'pedral',
  'ferron',
  'ferrón',
  'caíño tinto',
  'caiño tinto',
  'caíño longo',
  'caiño longo',
  'caíño bravo',
  'caiño bravo',
  'carabuñeira',
  'carabuneira',
  'loureira tinta',
  'gran negro',
  'tinta da zorra',
  'garnacha',
  'tintas varias',
];

export const isRedVariety = (name: string): boolean => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('branco') || lower.includes('blanco')) return false;
  return RED_VARIETY_HINTS.some((hint) => lower.includes(hint));
};

export const inferTipoVinoFromVarieties = (
  varieties: Array<{ variedad: string; kg?: number; porcentaje?: number; litros?: number }>,
  hintName?: string
): TipoVino => {
  const hint = (hintName || '').toLowerCase();
  if (hint.includes('rosado')) return 'Rosado';

  if (!varieties || varieties.length === 0) {
    const normHint = hint.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (
      normHint.includes('tinto') ||
      normHint.includes('fontan') ||
      normHint.includes('palleiros') ||
      normHint.includes('seixo')
    ) {
      return 'Tinto';
    }
    return 'Blanco';
  }

  let hasRed = false;
  let hasWhite = false;
  varieties.forEach((v) => {
    const qty = v.kg ?? v.porcentaje ?? v.litros ?? 1;
    if (qty <= 0) return;
    if (isRedVariety(v.variedad)) hasRed = true;
    else hasWhite = true;
  });

  if (hasRed && hasWhite) return 'Rosado';
  if (hasRed) return 'Tinto';
  return 'Blanco';
};

export const inferTipoVinoFromMarca = (marca: MarcaVino | string): TipoVino => {
  const norm = (marca || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('rosado')) return 'Rosado';
  // Tintos: Fontán, Os Palleiros, O Seixo
  if (norm.includes('fontan') || norm.includes('palleiros') || norm.includes('seixo')) {
    return 'Tinto';
  }
  // Blancos: Congostras, O Roucon, Xouba
  return 'Blanco';
};

export const inferTipoEtiquetaFromMarca = (marca: string): TipoEtiqueta => {
  const norm = (marca || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (norm.includes('congostras')) return 'congostras';
  if (norm.includes('fontan')) return 'fontan';
  if (norm.includes('roucon')) return 'roucon';
  if (norm.includes('seixo')) return 'seixo';
  if (norm.includes('palleiros')) return 'palleiros';
  if (norm.includes('rosado')) return 'rosado';
  return 'xouba';
};

export const resolveEmbotelladoTipoVino = (
  emb: EmbotelladoRegistro,
  ctx: {
    entradasUva: EntradaUva[];
    elaboraciones: ElaboracionRegistro[];
    depositos: Deposito[];
  }
): TipoVino => {
  if (emb.tipoVino) return emb.tipoVino;

  // 1. Check previous elaboration records for the origin tank
  const matchingElab = ctx.elaboraciones.find(
    (el) =>
      (el.depositoDestinoId === emb.depositoProcedenciaId ||
        el.depositoOrigenId === emb.depositoProcedenciaId) &&
      el.tipoVino
  );
  if (matchingElab?.tipoVino) return matchingElab.tipoVino;

  // 2. Check previous grape intake records for the origin tank
  const matchingEntrada = ctx.entradasUva.find(
    (ent) => ent.depositoDestinoId === emb.depositoProcedenciaId
  );
  if (matchingEntrada?.tipoVino) return matchingEntrada.tipoVino;

  // 3. Check current tank composition / wine name
  const dep = ctx.depositos.find((d) => d.id === emb.depositoProcedenciaId);
  if (dep && (dep.variedades.length > 0 || dep.vinoNombre)) {
    return inferTipoVinoFromVarieties(dep.variedades, dep.vinoNombre);
  }

  // 4. Fallback to brand
  return inferTipoVinoFromMarca(emb.marca);
};

export const TIPO_VINO_THEME: Record<
  TipoVino,
  {
    card: string;
    inner: string;
    footer: string;
    badge: string;
    dot: string;
  }
> = {
  Blanco: {
    card: 'bg-emerald-50/85 border-emerald-200',
    inner: 'bg-white/85 border border-emerald-100',
    footer: 'bg-emerald-100/50 border-t border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-500',
  },
  Rosado: {
    card: 'bg-pink-50/85 border-pink-200',
    inner: 'bg-white/85 border border-pink-100',
    footer: 'bg-pink-100/50 border-t border-pink-200',
    badge: 'bg-pink-100 text-pink-900 border-pink-300',
    dot: 'bg-pink-500',
  },
  Tinto: {
    card: 'bg-red-50/85 border-red-200',
    inner: 'bg-white/85 border border-red-100',
    footer: 'bg-red-100/50 border-t border-red-200',
    badge: 'bg-red-100 text-red-900 border-red-300',
    dot: 'bg-red-500',
  },
};

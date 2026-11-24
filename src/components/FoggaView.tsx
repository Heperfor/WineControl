import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  FileDown,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  emptyFoggaCadroARow,
  emptyFoggaCadroBRow,
} from '../data/initialData';
import {
  FoggaCadroCDestinatario,
  FoggaCategoriaVinoKey,
  FoggaMr441bDeclaracion,
} from '../types/winery';
import {
  FOGGA_CATEGORIAS,
  generateFoggaDraftFromVendimia,
  getCurrentCampaign,
  sumFoggaCadroA,
  sumFoggaCadroB,
} from '../utils/foggaInfoviAutomation';
import { exportFoggaMr441bPDF } from '../utils/foggaInfoviExportUtils';
import { getLocalIsoDate } from '../utils/dateUtils';

interface FoggaViewProps {
  initialCampanaInicio?: number;
}

export const SUPABASE_SQL_FOGGA_INFOVI = `-- Tablas opcionales para sincronizar FOGGA (MR441B) e INFOVI (AICA) en Supabase
CREATE TABLE IF NOT EXISTS public.fogga_declaraciones (
  id TEXT PRIMARY KEY,
  campana_inicio INTEGER NOT NULL,
  campana_fin INTEGER NOT NULL,
  tipo_declaracion TEXT NOT NULL,
  codev TEXT DEFAULT '',
  vinedo_sito_en TEXT DEFAULT '',
  concellos TEXT DEFAULT '',
  declarante JSONB NOT NULL DEFAULT '{}'::jsonb,
  cadro_a JSONB NOT NULL DEFAULT '{}'::jsonb,
  cadro_b JSONB NOT NULL DEFAULT '{}'::jsonb,
  cadro_c JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'borrador',
  confirmada_presentada BOOLEAN NOT NULL DEFAULT false,
  fecha_presentacion DATE,
  hora_presentacion TEXT,
  numero_entrada TEXT,
  metodo_firma TEXT,
  lugar_firma TEXT,
  xefatura_territorial TEXT,
  observaciones TEXT,
  origen_datos TEXT,
  fecha_registro TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.infovi_declaraciones (
  id TEXT PRIMARY KEY,
  campana TEXT NOT NULL,
  campana_inicio INTEGER NOT NULL,
  mes TEXT NOT NULL,
  operador JSONB NOT NULL DEFAULT '{}'::jsonb,
  produccion_media_hl NUMERIC NOT NULL DEFAULT 0,
  estado_infovi TEXT NOT NULL DEFAULT 'BORRADOR',
  cerrado_por TEXT DEFAULT '',
  fecha_ult_grabacion DATE,
  fecha_recepcion DATE,
  fecha_impresion DATE,
  entrada_uva_kg JSONB NOT NULL DEFAULT '{"tinta":0,"blanca":0}'::jsonb,
  cuadro_h JSONB NOT NULL DEFAULT '{}'::jsonb,
  cuadro_i JSONB NOT NULL DEFAULT '{}'::jsonb,
  cuadro_j JSONB NOT NULL DEFAULT '{}'::jsonb,
  cuadro_k JSONB NOT NULL DEFAULT '{}'::jsonb,
  mosto JSONB NOT NULL DEFAULT '{}'::jsonb,
  observaciones TEXT DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'borrador',
  confirmada_presentada BOOLEAN NOT NULL DEFAULT false,
  origen_datos TEXT,
  fecha_registro TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fogga_declaraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infovi_declaraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_fogga" ON public.fogga_declaraciones;
CREATE POLICY "anon_all_fogga" ON public.fogga_declaraciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_infovi" ON public.infovi_declaraciones;
CREATE POLICY "anon_all_infovi" ON public.infovi_declaraciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

const formatFechaEs = (iso?: string) => {
  if (!iso) return '-';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

const parseNum = (v: string): number => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
};

export const FoggaView: React.FC<FoggaViewProps> = ({ initialCampanaInicio }) => {
  const {
    foggaDeclaraciones,
    upsertFoggaDeclaracion,
    deleteFoggaDeclaracion,
    entradasUva,
    parcelas,
    bodegaConfig,
  } = useWinery();

  const currentCamp = getCurrentCampaign();
  const [selectedCampana, setSelectedCampana] = useState<number>(
    initialCampanaInicio || currentCamp.inicio
  );
  const [catCadroA, setCatCadroA] = useState<FoggaCategoriaVinoKey>('dop');
  const [catCadroB, setCatCadroB] = useState<FoggaCategoriaVinoKey>('outros');
  const [notice, setNotice] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialCampanaInicio) {
      setSelectedCampana(initialCampanaInicio);
    }
  }, [initialCampanaInicio]);

  const sortedDeclaraciones = useMemo(
    () => [...foggaDeclaraciones].sort((a, b) => b.campanaInicio - a.campanaInicio),
    [foggaDeclaraciones]
  );

  const buildInitialForm = (camp: number): FoggaMr441bDeclaracion => {
    const existing = foggaDeclaraciones.find((d) => d.campanaInicio === camp);
    if (existing) return existing;
    return generateFoggaDraftFromVendimia(camp, {
      entradasUva,
      parcelas,
      bodegaConfig,
      existingFogga: foggaDeclaraciones,
      categoriaCadroA: catCadroA,
      categoriaCadroB: catCadroB,
    }).declaracion;
  };

  const [draft, setDraft] = useState<FoggaMr441bDeclaracion>(() =>
    buildInitialForm(initialCampanaInicio || currentCamp.inicio)
  );

  // Sincronizar draft cuando cambia la campaña seleccionada o llegan datos remotos
  useEffect(() => {
    const existing = foggaDeclaraciones.find((d) => d.campanaInicio === selectedCampana);
    if (existing) {
      setDraft(existing);
    } else {
      const { declaracion } = generateFoggaDraftFromVendimia(selectedCampana, {
        entradasUva,
        parcelas,
        bodegaConfig,
        existingFogga: foggaDeclaraciones,
        categoriaCadroA: catCadroA,
        categoriaCadroB: catCadroB,
      });
      setDraft(declaracion);
    }
  }, [selectedCampana, foggaDeclaraciones]);

  const autoPreview = useMemo(
    () =>
      generateFoggaDraftFromVendimia(selectedCampana, {
        entradasUva,
        parcelas,
        bodegaConfig,
        existingFogga: foggaDeclaraciones,
        categoriaCadroA: catCadroA,
        categoriaCadroB: catCadroB,
      }),
    [selectedCampana, entradasUva, parcelas, bodegaConfig, foggaDeclaraciones, catCadroA, catCadroB]
  );

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((c) => (c === msg ? null : c)), 4500);
  };

  const handleRecalcularDesdeVendimia = () => {
    const { declaracion, detalle } = generateFoggaDraftFromVendimia(selectedCampana, {
      entradasUva,
      parcelas,
      bodegaConfig,
      existingFogga: foggaDeclaraciones,
      categoriaCadroA: catCadroA,
      categoriaCadroB: catCadroB,
    });
    setDraft(declaracion);
    upsertFoggaDeclaracion(declaracion);
    showNotice(
      `Datos recalculados desde ${detalle.entradasCount} entradas de uva (${detalle.kgTotal.toLocaleString('es-ES')} kg totales) y guardados.`
    );
  };

  const handleGuardar = (markAsPresented?: boolean) => {
    const today = getLocalIsoDate();
    const nowTime = new Date().toTimeString().slice(0, 5);
    const next: FoggaMr441bDeclaracion = {
      ...draft,
      estado:
        markAsPresented === true
          ? 'presentada'
          : markAsPresented === false
          ? 'borrador'
          : draft.estado,
      confirmadaPresentada:
        markAsPresented === true
          ? true
          : markAsPresented === false
          ? false
          : draft.confirmadaPresentada,
      fechaPresentacion:
        markAsPresented === true ? draft.fechaPresentacion || today : draft.fechaPresentacion,
      horaPresentacion:
        markAsPresented === true ? draft.horaPresentacion || nowTime : draft.horaPresentacion,
      fechaRegistro: new Date().toISOString(),
    };
    setDraft(next);
    upsertFoggaDeclaracion(next);
    if (markAsPresented === true) {
      showNotice(
        `Declaración MR441B ${next.campanaInicio}/${next.campanaFin} confirmada como presentada. Aviso desactivado.`
      );
    } else if (markAsPresented === false) {
      showNotice(`Declaración ${next.campanaInicio}/${next.campanaFin} marcada como borrador.`);
    } else {
      showNotice(`Declaración MR441B ${next.campanaInicio}/${next.campanaFin} guardada.`);
    }
  };

  const handleAddCadroCRow = () => {
    const newRow: FoggaCadroCDestinatario = {
      id: `cadroc-${Date.now()}`,
      nomeRazonSocial: '',
      nif: '',
      provincia: 'Ourense',
      concello: '',
      dopTinta: 0,
      dopBranca: 0,
      ixpTinta: 0,
      ixpBranca: 0,
      varietaisTinta: 0,
      varietaisBranca: 0,
      senDopIxpTinta: 0,
      senDopIxpBranca: 0,
      outrosTinta: 0,
      outrosBranca: 0,
    };
    setDraft((prev) => ({ ...prev, cadroC: [...prev.cadroC, newRow] }));
  };

  const updateCadroA = (
    cat: FoggaCategoriaVinoKey,
    field: keyof ReturnType<typeof emptyFoggaCadroARow>,
    value: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      cadroA: {
        ...prev.cadroA,
        [cat]: { ...prev.cadroA[cat], [field]: value },
      },
    }));
  };

  const updateCadroB = (
    cat: FoggaCategoriaVinoKey,
    field: keyof ReturnType<typeof emptyFoggaCadroBRow>,
    value: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      cadroB: {
        ...prev.cadroB,
        [cat]: { ...prev.cadroB[cat], [field]: value },
      },
    }));
  };

  const totA = sumFoggaCadroA(draft.cadroA);
  const totB = sumFoggaCadroB(draft.cadroB);
  const campaignOptions = Array.from(
    new Set([
      2024,
      2025,
      currentCamp.inicio - 1,
      currentCamp.inicio,
      currentCamp.inicio + 1,
      ...foggaDeclaraciones.map((d) => d.campanaInicio),
    ])
  ).sort((a, b) => b - a);

  const copySql = () => {
    void navigator.clipboard?.writeText(SUPABASE_SQL_FOGGA_INFOVI);
    showNotice('Código SQL copiado al portapapeles.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabecera módulo */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
            <span>Xunta de Galicia · Consellería do Medio Rural · Anexo D: I a</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Declaración de Vendimia FOGGA (MR441B)
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            Automatizada desde tus entradas de uva y parcelas. Incluye el histórico oficial presentado de 2024 y 2025.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSql((v) => !v)}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>SQL Supabase</span>
          </button>

          <button
            type="button"
            onClick={() => exportFoggaMr441bPDF(draft)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF MR441B</span>
          </button>

          <button
            type="button"
            onClick={() => handleGuardar()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {showSql && (
        <div className="bg-stone-900 text-stone-100 rounded-2xl p-4 sm:p-5 border border-stone-700 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
                SQL opcional para sincronizar FOGGA e INFOVI en Supabase
              </h3>
              <p className="text-xs text-stone-400">
                Si quieres que tus declaraciones FOGGA e INFOVI se sincronicen entre Vercel y Android, ejecuta este bloque en el SQL Editor de Supabase.
              </p>
            </div>
            <button
              type="button"
              onClick={copySql}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar SQL</span>
            </button>
          </div>
          <pre className="text-[11px] font-mono bg-stone-950 p-3 rounded-xl overflow-x-auto max-h-56 text-stone-300 border border-stone-800">
            {SUPABASE_SQL_FOGGA_INFOVI}
          </pre>
        </div>
      )}

      {/* Selector de campañas e historial guardado */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-stone-600">Campaña:</label>
            <select
              value={selectedCampana}
              onChange={(e) => setSelectedCampana(Number(e.target.value))}
              className="px-3 py-2 text-sm font-semibold border border-stone-300 rounded-xl bg-white text-stone-900"
            >
              {campaignOptions.map((yr) => {
                const exists = foggaDeclaraciones.find((d) => d.campanaInicio === yr);
                return (
                  <option key={yr} value={yr}>
                    {yr}/{yr + 1}{' '}
                    {exists?.confirmadaPresentada
                      ? '· Presentada'
                      : exists
                      ? '· Borrador'
                      : '· Nueva'}
                  </option>
                );
              })}
            </select>

            <span className="text-xs text-stone-500">·</span>
            <span className="text-xs font-medium text-stone-600 tabular-nums">
              Límite presentación: 10/12/{selectedCampana}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {draft.confirmadaPresentada ? (
              <button
                type="button"
                onClick={() => handleGuardar(false)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Reabrir como borrador
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleGuardar(true)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Confirmar como Presentada</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de declaraciones guardadas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedDeclaraciones.map((dec) => {
            const totals = sumFoggaCadroA(dec.cadroA);
            const selected = dec.campanaInicio === selectedCampana;
            return (
              <div
                key={dec.id}
                onClick={() => setSelectedCampana(dec.campanaInicio)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  selected
                    ? 'border-sky-700 bg-sky-50/60 ring-1 ring-sky-700/20'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-stone-900 tabular-nums">
                      Campaña {dec.campanaInicio}/{dec.campanaFin}
                    </div>
                    <div className="text-[11px] text-stone-500 tabular-nums">
                      {dec.tipoDeclaracion} · Entrada: {dec.numeroEntrada || 'Sin registro'}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      dec.confirmadaPresentada ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {dec.confirmadaPresentada ? 'Presentada' : 'Borrador'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-700 pt-1 border-t border-stone-200/70 tabular-nums">
                  <span>{totals.superficieHa.toFixed(2)} ha</span>
                  <span>Tinta: {totals.tinta100Kg.toFixed(2)} (100kg)</span>
                  <span>Branca: {totals.branca100Kg.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel de automatización desde Entradas de Uva */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>
              Datos detectados en la bodega para {selectedCampana}/{selectedCampana + 1}
            </span>
          </div>
          <p className="text-xs text-amber-950/90 tabular-nums">
            {autoPreview.detalle.entradasCount} entradas de uva ·{' '}
            <strong>{autoPreview.detalle.kgTinta.toLocaleString('es-ES')} kg</strong> Tinta (
            {(autoPreview.detalle.kgTinta / 100).toFixed(2)} qm) ·{' '}
            <strong>{autoPreview.detalle.kgBranca.toLocaleString('es-ES')} kg</strong> Branca (
            {(autoPreview.detalle.kgBranca / 100).toFixed(2)} qm) ·{' '}
            <strong>{autoPreview.detalle.superficieUsadaHa.toFixed(2)} ha</strong> superficie
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={catCadroA}
            onChange={(e) => setCatCadroA(e.target.value as FoggaCategoriaVinoKey)}
            className="px-2.5 py-2 text-xs border border-amber-300 rounded-xl bg-white text-stone-800"
            title="Categoría para Cadro A"
          >
            {FOGGA_CATEGORIAS.map((c) => (
              <option key={c.key} value={c.key}>
                Cadro A: {c.label}
              </option>
            ))}
          </select>

          <select
            value={catCadroB}
            onChange={(e) => setCatCadroB(e.target.value as FoggaCategoriaVinoKey)}
            className="px-2.5 py-2 text-xs border border-amber-300 rounded-xl bg-white text-stone-800"
            title="Categoría para Cadro B"
          >
            {FOGGA_CATEGORIAS.map((c) => (
              <option key={c.key} value={c.key}>
                Cadro B: {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRecalcularDesdeVendimia}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Calcular y rellenar desde Vendimia</span>
          </button>
        </div>
      </div>

      {/* Formulario Oficial Editable MR441B */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs space-y-6">
        {/* Estado y registro de presentación */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pb-5 border-b border-stone-200">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Estado Declaración
            </label>
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                draft.confirmadaPresentada
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              {draft.confirmadaPresentada ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-700" />
              )}
              <span>
                {draft.confirmadaPresentada
                  ? `Presentada (${formatFechaEs(draft.fechaPresentacion)})`
                  : 'Borrador · Pendiente de presentar'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Tipo Declaración
            </label>
            <select
              value={draft.tipoDeclaracion}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  tipoDeclaracion: e.target.value as FoggaMr441bDeclaracion['tipoDeclaracion'],
                })
              }
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white"
            >
              <option value="Alta">Alta</option>
              <option value="Baixa">Baixa</option>
              <option value="Modificación">Modificación</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">CODEV</label>
            <input
              type="text"
              value={draft.codev}
              onChange={(e) => setDraft({ ...draft, codev: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Nº Rexistro Entrada Xunta
            </label>
            <input
              type="text"
              placeholder="ej. 2026/..."
              value={draft.numeroEntrada || ''}
              onChange={(e) => setDraft({ ...draft, numeroEntrada: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Fecha Presentación
            </label>
            <input
              type="date"
              value={draft.fechaPresentacion || ''}
              onChange={(e) => setDraft({ ...draft, fechaPresentacion: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
            />
          </div>
        </div>

        {/* Datos da persoa declarante */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-900">
            Datos da Persoa Declarante e Viñedo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nome / Razón Social</label>
              <input
                type="text"
                value={draft.declarante.nome}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, nome: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Primeiro Apelido</label>
              <input
                type="text"
                value={draft.declarante.primeiroApelido}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, primeiroApelido: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Segundo Apelido</label>
              <input
                type="text"
                value={draft.declarante.segundoApelido}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, segundoApelido: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">NIF</label>
              <input
                type="text"
                value={draft.declarante.nif}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, nif: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Concello</label>
              <input
                type="text"
                value={draft.declarante.concello}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, concello: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Teléfono Móbil</label>
              <input
                type="text"
                value={draft.declarante.telefonoMobil}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, telefonoMobil: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={draft.declarante.correoElectronico}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    declarante: { ...draft.declarante, correoElectronico: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Concellos do viñedo</label>
              <input
                type="text"
                value={draft.concellos}
                onChange={(e) => setDraft({ ...draft, concellos: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">
                Método e Lugar de Sinatura
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Certificado dixital / Chave365"
                  value={draft.metodoFirma || ''}
                  onChange={(e) => setDraft({ ...draft, metodoFirma: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                />
                <input
                  type="text"
                  placeholder="Lugar (ej. Ribadavia)"
                  value={draft.lugarFirma || ''}
                  onChange={(e) => setDraft({ ...draft, lugarFirma: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CADRO A */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">
              Cadro A · Superficie en produción (ha) e Uva Colleitada (100 kg)
            </h3>
            <span className="text-xs text-stone-500 tabular-nums">
              Equivalencia total: {Math.round((totA.tinta100Kg + totA.branca100Kg) * 100).toLocaleString('es-ES')} kg
            </span>
          </div>
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-sky-50 text-sky-950 border-b border-sky-200">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Viñedos para a produción de:</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-32">Superficie (ha)</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-32">Tinta (100 kg)</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-32">Branca (100 kg)</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-28">Rendemento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {FOGGA_CATEGORIAS.map((cat) => {
                  const row = draft.cadroA[cat.key];
                  return (
                    <tr key={cat.key} className="hover:bg-stone-50/70">
                      <td className="px-3 py-2 font-medium text-stone-800">{cat.label}</td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.superficieHa}
                          onChange={(e) => updateCadroA(cat.key, 'superficieHa', parseNum(e.target.value))}
                          className="w-full text-right px-2 py-1.5 border border-stone-200 rounded-lg tabular-nums font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.tinta100Kg}
                          onChange={(e) => updateCadroA(cat.key, 'tinta100Kg', parseNum(e.target.value))}
                          className="w-full text-right px-2 py-1.5 border border-stone-200 rounded-lg tabular-nums font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.branca100Kg}
                          onChange={(e) => updateCadroA(cat.key, 'branca100Kg', parseNum(e.target.value))}
                          className="w-full text-right px-2 py-1.5 border border-stone-200 rounded-lg tabular-nums font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.rendemento}
                          onChange={(e) => updateCadroA(cat.key, 'rendemento', parseNum(e.target.value))}
                          className="w-full text-right px-2 py-1.5 border border-stone-200 rounded-lg tabular-nums font-mono"
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-stone-100 font-bold text-stone-900 tabular-nums">
                  <td className="px-3 py-2.5">TOTAL CADRO A</td>
                  <td className="px-3 py-2.5 text-right font-mono">{totA.superficieHa.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{totA.tinta100Kg.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{totA.branca100Kg.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{totA.rendemento.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CADRO B */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-stone-900">
            Cadro B · Uva en 100 kg destinada ás distintas utilizacións
          </h3>
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-[11px] sm:text-xs">
              <thead className="bg-sky-50 text-sky-950 border-b border-sky-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold min-w-[210px]">Viñedos para a produción de:</th>
                  <th className="text-right px-2 py-2 font-semibold">Vinif. propia Tinta</th>
                  <th className="text-right px-2 py-2 font-semibold">Vinif. propia Branca</th>
                  <th className="text-right px-2 py-2 font-semibold">Coop. Tinta</th>
                  <th className="text-right px-2 py-2 font-semibold">Coop. Branca</th>
                  <th className="text-right px-2 py-2 font-semibold">Vendida Tinta</th>
                  <th className="text-right px-2 py-2 font-semibold">Vendida Branca</th>
                  <th className="text-right px-2 py-2 font-semibold">Cons. fresco</th>
                  <th className="text-right px-2 py-2 font-semibold">Pasificado</th>
                  <th className="text-right px-2 py-2 font-semibold">Zume</th>
                  <th className="text-right px-2 py-2 font-semibold">Mosto conc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {FOGGA_CATEGORIAS.map((cat) => {
                  const row = draft.cadroB[cat.key];
                  const fields: Array<keyof typeof row> = [
                    'vinifPropiaTinta',
                    'vinifPropiaBranca',
                    'coopTinta',
                    'coopBranca',
                    'vendidaTinta',
                    'vendidaBranca',
                    'consumoFresco',
                    'pasificado',
                    'zume',
                    'mostoConc',
                  ];
                  return (
                    <tr key={cat.key} className="hover:bg-stone-50/70">
                      <td className="px-3 py-2 font-medium text-stone-800">{cat.label}</td>
                      {fields.map((f) => (
                        <td key={f} className="px-1.5 py-1.5 min-w-[82px]">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row[f]}
                            onChange={(e) => updateCadroB(cat.key, f, parseNum(e.target.value))}
                            className="w-full text-right px-1.5 py-1 border border-stone-200 rounded-lg tabular-nums font-mono"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="bg-stone-100 font-bold text-stone-900 tabular-nums font-mono">
                  <td className="px-3 py-2.5 font-sans">TOTAL CADRO B</td>
                  <td className="px-2 py-2.5 text-right">{totB.vinifPropiaTinta.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.vinifPropiaBranca.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.coopTinta.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.coopBranca.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.vendidaTinta.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.vendidaBranca.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.consumoFresco.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.pasificado.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.zume.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right">{totB.mostoConc.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CADRO C */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-stone-900">
              Cadro C · Entregas a terceiros / persoas destinatarias (opcional)
            </h3>
            <button
              type="button"
              onClick={handleAddCadroCRow}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Engadir destinataria</span>
            </button>
          </div>

          {draft.cadroC.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              Sen entregas a terceiros nesta campaña (toda a uva foi vinificada pola persoa declarante).
            </p>
          ) : (
            <div className="space-y-2">
              {draft.cadroC.map((row, idx) => (
                <div
                  key={row.id}
                  className="p-3 rounded-xl border border-stone-200 bg-stone-50 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end"
                >
                  <div className="col-span-2">
                    <label className="block text-[11px] text-stone-500 mb-1">Nome / Razón social</label>
                    <input
                      type="text"
                      value={row.nomeRazonSocial}
                      onChange={(e) => {
                        const copy = [...draft.cadroC];
                        copy[idx] = { ...row, nomeRazonSocial: e.target.value };
                        setDraft({ ...draft, cadroC: copy });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">NIF</label>
                    <input
                      type="text"
                      value={row.nif}
                      onChange={(e) => {
                        const copy = [...draft.cadroC];
                        copy[idx] = { ...row, nif: e.target.value };
                        setDraft({ ...draft, cadroC: copy });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Concello</label>
                    <input
                      type="text"
                      value={row.concello}
                      onChange={(e) => {
                        const copy = [...draft.cadroC];
                        copy[idx] = { ...row, concello: e.target.value };
                        setDraft({ ...draft, cadroC: copy });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">DOP Tinta (100kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.dopTinta}
                      onChange={(e) => {
                        const copy = [...draft.cadroC];
                        copy[idx] = { ...row, dopTinta: parseNum(e.target.value) };
                        setDraft({ ...draft, cadroC: copy });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white text-right font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <label className="block text-[11px] text-stone-500 mb-1">DOP Branca</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.dopBranca}
                        onChange={(e) => {
                          const copy = [...draft.cadroC];
                          copy[idx] = { ...row, dopBranca: parseNum(e.target.value) };
                          setDraft({ ...draft, cadroC: copy });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white text-right font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          cadroC: draft.cadroC.filter((c) => c.id !== row.id),
                        })
                      }
                      className="p-2 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observaciones y borrado seguro */}
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-stone-600 mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={draft.observaciones || ''}
              onChange={(e) => setDraft({ ...draft, observaciones: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl"
            />
          </div>

          {foggaDeclaraciones.some((d) => d.id === draft.id) && (
            <div className="shrink-0">
              {confirmDeleteId === draft.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      deleteFoggaDeclaracion(draft.id);
                      setConfirmDeleteId(null);
                      showNotice('Declaración eliminada.');
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirmar borrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(draft.id)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar campaña</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  FileDown,
  Info,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
  InfoviCategoriaKey,
  InfoviCuadroHRow,
  InfoviCuadroIRow,
  InfoviCuadroJRow,
  InfoviDeclaracion,
  InfoviMesPeriodo,
} from '../types/winery';
import {
  generateInfoviDraftFromWinery,
  getCurrentCampaign,
  getInfoviPeriodBounds,
  INFOVI_CATEGORIAS,
  sumInfoviCuadroH,
  sumInfoviCuadroI,
  sumInfoviCuadroJ,
  sumInfoviCuadroK,
  sumInfoviJRow,
  sumInfoviSalidaDestinos,
} from '../utils/foggaInfoviAutomation';
import { exportInfoviPDF } from '../utils/foggaInfoviExportUtils';
import { SUPABASE_SQL_FOGGA_INFOVI } from './FoggaView';
import { getLocalIsoDate } from '../utils/dateUtils';

interface InfoviViewProps {
  initialPeriod?: { campanaInicio: number; mes: InfoviMesPeriodo };
}

const parseIntNum = (v: string): number => {
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const formatFechaEs = (iso?: string) => {
  if (!iso) return '-';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

export const InfoviView: React.FC<InfoviViewProps> = ({ initialPeriod }) => {
  const {
    infoviDeclaraciones,
    upsertInfoviDeclaracion,
    deleteInfoviDeclaracion,
    entradasUva,
    elaboraciones,
    embotellados,
    salidas,
    depositos,
    parcelas,
    bodegaConfig,
  } = useWinery();

  const currentCamp = getCurrentCampaign();
  const [selectedCampana, setSelectedCampana] = useState<number>(
    initialPeriod?.campanaInicio || currentCamp.inicio
  );
  const [selectedMes, setSelectedMes] = useState<InfoviMesPeriodo>(
    initialPeriod?.mes || (new Date().getMonth() + 1 >= 6 && new Date().getMonth() + 1 <= 10 ? 'JULIO' : 'NOVIEMBRE')
  );
  const [categoriaPrincipal, setCategoriaPrincipal] = useState<InfoviCategoriaKey>('sinIg');
  const [modoExistencias, setModoExistencias] = useState<'balance_arrastrado' | 'stock_vivo'>(
    'balance_arrastrado'
  );
  const [sectionTab, setSectionTab] = useState<'vino' | 'mosto'>('vino');
  const [notice, setNotice] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialPeriod) {
      setSelectedCampana(initialPeriod.campanaInicio);
      setSelectedMes(initialPeriod.mes);
    }
  }, [initialPeriod]);

  const sortedHistorial = useMemo(() => {
    return [...infoviDeclaraciones].sort((a, b) => {
      if (b.campanaInicio !== a.campanaInicio) return b.campanaInicio - a.campanaInicio;
      return a.mes === 'JULIO' ? -1 : 1;
    });
  }, [infoviDeclaraciones]);

  const [draft, setDraft] = useState<InfoviDeclaracion>(() => {
    const existing = infoviDeclaraciones.find(
      (d) =>
        d.campanaInicio === (initialPeriod?.campanaInicio || currentCamp.inicio) &&
        d.mes === (initialPeriod?.mes || 'NOVIEMBRE')
    );
    if (existing) return existing;
    return generateInfoviDraftFromWinery(
      initialPeriod?.campanaInicio || currentCamp.inicio,
      initialPeriod?.mes || 'NOVIEMBRE',
      {
        entradasUva,
        elaboraciones,
        embotellados,
        salidas,
        depositos,
        parcelas,
        bodegaConfig,
        existingInfovi: infoviDeclaraciones,
        categoriaPrincipal: 'sinIg',
        modoExistencias: 'balance_arrastrado',
      }
    ).declaracion;
  });

  const autoCalc = useMemo(
    () =>
      generateInfoviDraftFromWinery(selectedCampana, selectedMes, {
        entradasUva,
        elaboraciones,
        embotellados,
        salidas,
        depositos,
        parcelas,
        bodegaConfig,
        existingInfovi: infoviDeclaraciones,
        categoriaPrincipal,
        modoExistencias,
      }),
    [
      selectedCampana,
      selectedMes,
      entradasUva,
      elaboraciones,
      embotellados,
      salidas,
      depositos,
      parcelas,
      bodegaConfig,
      infoviDeclaraciones,
      categoriaPrincipal,
      modoExistencias,
    ]
  );

  useEffect(() => {
    const existing = infoviDeclaraciones.find(
      (d) => d.campanaInicio === selectedCampana && d.mes === selectedMes
    );
    if (existing && (existing.confirmadaPresentada || existing.origenDatos !== 'automatica_bodega')) {
      setDraft(existing);
    } else {
      setDraft(autoCalc.declaracion);
    }
  }, [selectedCampana, selectedMes, infoviDeclaraciones, autoCalc]);

  const bounds = getInfoviPeriodBounds(selectedCampana, selectedMes);
  const todayIso = getLocalIsoDate();
  const isAntesDeAperturaPlazo = todayIso < bounds.filingOpen;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((c) => (c === msg ? null : c)), 4500);
  };

  const handleRecalcular = () => {
    setDraft(autoCalc.declaracion);
    upsertInfoviDeclaracion(autoCalc.declaracion);
    showNotice(
      `Declaración INFOVI ${selectedMes} ${bounds.campana} calculada y guardada con datos acumulados desde el 1 de agosto.`
    );
  };

  const handleGuardar = (markAsPresented?: boolean) => {
    if (markAsPresented === true && isAntesDeAperturaPlazo) {
      showNotice(
        `Aún no se puede confirmar como presentada: el plazo oficial (${bounds.labelPlazo}) comienza el ${formatFechaEs(bounds.filingOpen)}.`
      );
      return;
    }
    const today = getLocalIsoDate();
    const next: InfoviDeclaracion = {
      ...draft,
      estado:
        markAsPresented === true
          ? 'presentada'
          : markAsPresented === false
          ? 'borrador'
          : draft.estado,
      estadoInfovi:
        markAsPresented === true
          ? 'CERRADA'
          : markAsPresented === false
          ? 'BORRADOR'
          : draft.estadoInfovi,
      cerradoPor:
        markAsPresented === true ? draft.cerradoPor || 'INSTALACIÓN' : draft.cerradoPor,
      confirmadaPresentada:
        markAsPresented === true
          ? true
          : markAsPresented === false
          ? false
          : draft.confirmadaPresentada,
      fechaUltGrabacion:
        markAsPresented === true ? draft.fechaUltGrabacion || today : draft.fechaUltGrabacion,
      fechaRecepcion:
        markAsPresented === true ? draft.fechaRecepcion || today : draft.fechaRecepcion,
      fechaRegistro: new Date().toISOString(),
    };
    setDraft(next);
    upsertInfoviDeclaracion(next);
    if (markAsPresented === true) {
      showNotice(
        `Declaración INFOVI ${next.mes} ${next.campana} confirmada como presentada. Aviso desactivado.`
      );
    } else if (markAsPresented === false) {
      showNotice(`Declaración ${next.mes} ${next.campana} reabierta como borrador.`);
    } else {
      showNotice(`Declaración INFOVI ${next.mes} ${next.campana} guardada.`);
    }
  };

  const updateCuadroH = (cat: InfoviCategoriaKey, field: keyof InfoviCuadroHRow, val: number) => {
    setDraft((prev) => ({
      ...prev,
      cuadroH: {
        ...prev.cuadroH,
        [cat]: { ...prev.cuadroH[cat], [field]: val },
      },
    }));
  };

  const updateCuadroI = (cat: InfoviCategoriaKey, field: keyof InfoviCuadroIRow, val: number) => {
    setDraft((prev) => ({
      ...prev,
      cuadroI: {
        ...prev.cuadroI,
        [cat]: { ...prev.cuadroI[cat], [field]: val },
      },
    }));
  };

  const updateCuadroJ = (cat: InfoviCategoriaKey, field: keyof InfoviCuadroJRow, val: number) => {
    setDraft((prev) => ({
      ...prev,
      cuadroJ: {
        ...prev.cuadroJ,
        [cat]: { ...prev.cuadroJ[cat], [field]: val },
      },
    }));
  };

  const updateCuadroK = (
    cat: InfoviCategoriaKey,
    dest: 'interiores' | 'mercadoUe' | 'paisesTerceros',
    field: keyof InfoviCuadroJRow,
    val: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      cuadroK: {
        ...prev.cuadroK,
        [cat]: {
          ...prev.cuadroK[cat],
          [dest]: {
            ...prev.cuadroK[cat][dest],
            [field]: val,
          },
        },
      },
    }));
  };

  const totH = sumInfoviCuadroH(draft.cuadroH);
  const totI = sumInfoviCuadroI(draft.cuadroI);
  const totJ = sumInfoviCuadroJ(draft.cuadroJ);
  const totK = sumInfoviCuadroK(draft.cuadroK);

  const campaignOptions = Array.from(
    new Set([
      2024,
      2025,
      currentCamp.inicio - 1,
      currentCamp.inicio,
      currentCamp.inicio + 1,
      ...infoviDeclaraciones.map((d) => d.campanaInicio),
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
          <div className="text-xs font-semibold text-purple-900">
            AICA · Pequeños Productores &lt; 1.000 hl · 2 declaraciones por campaña (Noviembre y Julio)
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
            Declaración CAU INFOVI (Vino y Mosto)
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            Plazos a periodo vencido: 1–20 de diciembre (Noviembre) y 1–20 de agosto (Julio). Histórico retroactivo desde 2024 incluido.
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
            onClick={() => exportInfoviPDF(draft)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF INFOVI</span>
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
                Ejecútalo en el SQL Editor de Supabase para sincronizar las declaraciones entre Vercel y Android.
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

      {/* Selector de periodo e histórico */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-stone-600">Campaña:</label>
            <select
              value={selectedCampana}
              onChange={(e) => setSelectedCampana(Number(e.target.value))}
              className="px-3 py-2 text-sm font-semibold border border-stone-300 rounded-xl bg-white"
            >
              {campaignOptions.map((y) => (
                <option key={y} value={y}>
                  {y}/{y + 1}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
              {(['NOVIEMBRE', 'JULIO'] as InfoviMesPeriodo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMes(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    selectedMes === m
                      ? 'bg-purple-900 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {m === 'NOVIEMBRE' ? 'Noviembre (1–20 dic)' : 'Julio (1–20 ago)'}
                </button>
              ))}
            </div>

            <span className="text-xs text-stone-500 tabular-nums">
              Plazo: {bounds.labelPlazo}
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
            ) : isAntesDeAperturaPlazo ? (
              <button
                type="button"
                disabled
                title={`El plazo oficial de presentación (${bounds.labelPlazo}) todavía no ha comenzado.`}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-200 text-stone-500 border border-stone-300 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Plazo abre el {formatFechaEs(bounds.filingOpen)}</span>
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

        {/* Tarjetas históricas y campaña en curso */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {!infoviDeclaraciones.some(
            (d) => d.campanaInicio === currentCamp.inicio && d.mes === 'NOVIEMBRE'
          ) && (
            <div
              onClick={() => {
                setSelectedCampana(currentCamp.inicio);
                setSelectedMes('NOVIEMBRE');
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                selectedCampana === currentCamp.inicio && selectedMes === 'NOVIEMBRE'
                  ? 'border-purple-800 bg-purple-50/70 ring-1 ring-purple-700/20'
                  : 'border-amber-200 bg-amber-50/50 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900 tabular-nums">
                  NOVIEMBRE · {currentCamp.label}
                </span>
                <span className="text-[11px] font-bold text-amber-700">
                  Pendiente
                </span>
              </div>
              <div className="text-[11px] text-stone-600">
                Borrador automático en curso
              </div>
              <div className="text-[10px] text-amber-800 font-medium tabular-nums">
                Plazo: 01/12/{currentCamp.inicio} – 20/12/{currentCamp.inicio}
              </div>
            </div>
          )}
          {sortedHistorial.map((dec) => {
            const h = sumInfoviCuadroH(dec.cuadroH).total;
            const j = sumInfoviCuadroJ(dec.cuadroJ).total;
            const isSel =
              dec.campanaInicio === selectedCampana && dec.mes === selectedMes;
            return (
              <div
                key={dec.id}
                onClick={() => {
                  setSelectedCampana(dec.campanaInicio);
                  setSelectedMes(dec.mes);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSel
                    ? 'border-purple-800 bg-purple-50/70 ring-1 ring-purple-700/20'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 tabular-nums">
                    {dec.mes} · {dec.campana}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      dec.confirmadaPresentada ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {dec.confirmadaPresentada ? 'Cerrada' : 'Pendiente'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 flex items-center justify-between tabular-nums">
                  <span>Prod: {h} hl</span>
                  <span>Exist.: {j} hl</span>
                  <span>Media: {dec.produccionMediaHl} hl</span>
                </div>
                <div className="text-[10px] text-stone-400 tabular-nums">
                  {dec.cerradoPor || 'Sin cierre'} · {formatFechaEs(dec.fechaUltGrabacion)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Asistente automático de cálculo retroactivo + bodega */}
      <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-800" />
              <span>
                Cálculo automático acumulado ({formatFechaEs(bounds.periodStart)} al{' '}
                {formatFechaEs(bounds.periodEnd)})
              </span>
            </div>
            <p className="text-xs text-purple-900/90 tabular-nums">
              Base arrastrada:{' '}
              <strong>{autoCalc.breakdown.prevInfoviLabel || 'Sin declaración previa'}</strong> (
              {autoCalc.breakdown.prevStockTotalHl} hl iniciales) · Mosto campaña:{' '}
              {autoCalc.breakdown.litrosMostoTintoRosado.toLocaleString('es-ES')} L tinto /{' '}
              {autoCalc.breakdown.litrosMostoBlanco.toLocaleString('es-ES')} L blanco · Balance
              arrastrado: <strong>{sumInfoviJRow(autoCalc.breakdown.balanceArrastrado)} hl</strong> ·
              Stock vivo bodega:{' '}
              <strong>{sumInfoviJRow(autoCalc.breakdown.stockVivoBodega)} hl</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoriaPrincipal}
              onChange={(e) => setCategoriaPrincipal(e.target.value as InfoviCategoriaKey)}
              className="px-2.5 py-2 text-xs border border-purple-300 rounded-xl bg-white text-stone-800"
              title="Categoría vino"
            >
              {INFOVI_CATEGORIAS.map((c) => (
                <option key={c.key} value={c.key}>
                  Categoría: {c.label}
                </option>
              ))}
            </select>

            <select
              value={modoExistencias}
              onChange={(e) =>
                setModoExistencias(
                  e.target.value as 'balance_arrastrado' | 'stock_vivo'
                )
              }
              className="px-2.5 py-2 text-xs border border-purple-300 rounded-xl bg-white text-stone-800"
            >
              <option value="balance_arrastrado">
                Cuadro J: Arrastrado (INFOVI anterior + H − K)
              </option>
              <option value="stock_vivo">
                Cuadro J: Stock vivo en depósitos y botellas
              </option>
            </select>

            <button
              type="button"
              onClick={handleRecalcular}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Calcular y rellenar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Formulario Oficial Editable INFOVI */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs space-y-6">
        {/* Cabecera Operador y Estado */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 pb-5 border-b border-stone-200">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1">Estado</label>
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
                  ? `CERRADA (${draft.cerradoPor || 'INSTALACIÓN'})`
                  : isAntesDeAperturaPlazo
                  ? `NO PRESENTADA · Plazo abre el ${formatFechaEs(bounds.filingOpen)}`
                  : 'BORRADOR · Pendiente de presentar'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">REOVI</label>
            <input
              type="text"
              value={draft.operador.reovi}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  operador: { ...draft.operador, reovi: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">N.I.D.P.B.</label>
            <input
              type="text"
              value={draft.operador.nidpb}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  operador: { ...draft.operador, nidpb: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Producción media (hl)
            </label>
            <input
              type="number"
              min="0"
              value={draft.produccionMediaHl}
              onChange={(e) =>
                setDraft({ ...draft, produccionMediaHl: parseIntNum(e.target.value) })
              }
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-mono text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Fec. Recepción
            </label>
            <input
              type="date"
              value={draft.fechaRecepcion || ''}
              onChange={(e) => setDraft({ ...draft, fechaRecepcion: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
            />
          </div>
        </div>

        {/* Entrada de uva (Kg) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 items-center">
          <div className="text-xs font-bold text-stone-800">
            Entrada de uva campaña (kg)
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-stone-600 w-16">Tinta:</label>
            <input
              type="number"
              min="0"
              value={draft.entradaUvaKg.tinta}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  entradaUvaKg: {
                    ...draft.entradaUvaKg,
                    tinta: parseIntNum(e.target.value),
                  },
                })
              }
              className="flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white text-right font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-stone-600 w-16">Blanca:</label>
            <input
              type="number"
              min="0"
              value={draft.entradaUvaKg.blanca}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  entradaUvaKg: {
                    ...draft.entradaUvaKg,
                    blanca: parseIntNum(e.target.value),
                  },
                })
              }
              className="flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white text-right font-mono"
            />
          </div>
        </div>

        {/* Sub-pestañas VINO vs MOSTO */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSectionTab('vino')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              sectionTab === 'vino'
                ? 'bg-purple-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            VINO (Cuadros H, I, J, K)
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('mosto')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              sectionTab === 'mosto'
                ? 'bg-purple-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            MOSTO (Cuadros G, H)
          </button>
        </div>

        {sectionTab === 'vino' ? (
          <div className="space-y-6">
            {/* Cuadro H */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                H. Declaración de producción de vino respecto a la cosecha de la campaña en curso (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                      <th className="text-right px-3 py-2 font-semibold w-32">Tinto / Rosado (hl)</th>
                      <th className="text-right px-3 py-2 font-semibold w-32">Blanco (hl)</th>
                      <th className="text-right px-3 py-2 font-semibold w-32">Superficie (has.)</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">TOTALES (hl)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {INFOVI_CATEGORIAS.map((cat) => {
                      const r = draft.cuadroH[cat.key];
                      return (
                        <tr key={cat.key}>
                          <td className="px-3 py-2 font-medium text-stone-800">{cat.label}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={r.tintoRosado}
                              onChange={(e) =>
                                updateCuadroH(cat.key, 'tintoRosado', parseIntNum(e.target.value))
                              }
                              className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={r.blanco}
                              onChange={(e) =>
                                updateCuadroH(cat.key, 'blanco', parseIntNum(e.target.value))
                              }
                              className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={r.superficieHa}
                              onChange={(e) =>
                                updateCuadroH(cat.key, 'superficieHa', parseIntNum(e.target.value))
                              }
                              className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800 tabular-nums">
                            {r.tintoRosado + r.blanco}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-purple-50/70 font-bold text-purple-950 font-mono tabular-nums">
                      <td className="px-3 py-2 font-sans">TOTALES</td>
                      <td className="px-3 py-2 text-right">{totH.tintoRosado}</td>
                      <td className="px-3 py-2 text-right">{totH.blanco}</td>
                      <td className="px-3 py-2 text-right">{totH.superficieHa}</td>
                      <td className="px-3 py-2 text-right">{totH.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cuadro I */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                I. Declaración de producción de vino elaborado a partir de mosto de otras campañas (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                      <th className="text-right px-3 py-2 font-semibold w-36">Tinto / Rosado (hl)</th>
                      <th className="text-right px-3 py-2 font-semibold w-36">Blanco (hl)</th>
                      <th className="text-right px-3 py-2 font-semibold w-32">TOTALES (hl)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {INFOVI_CATEGORIAS.map((cat) => {
                      const r = draft.cuadroI[cat.key];
                      return (
                        <tr key={cat.key}>
                          <td className="px-3 py-1.5 font-medium text-stone-800">{cat.label}</td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={r.tintoRosado}
                              onChange={(e) =>
                                updateCuadroI(cat.key, 'tintoRosado', parseIntNum(e.target.value))
                              }
                              className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={r.blanco}
                              onChange={(e) =>
                                updateCuadroI(cat.key, 'blanco', parseIntNum(e.target.value))
                              }
                              className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                            {r.tintoRosado + r.blanco}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-purple-50/70 font-bold text-purple-950 font-mono tabular-nums">
                      <td className="px-3 py-2 font-sans">TOTALES</td>
                      <td className="px-3 py-2 text-right">{totI.tintoRosado}</td>
                      <td className="px-3 py-2 text-right">{totI.blanco}</td>
                      <td className="px-3 py-2 text-right">{totI.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cuadro J */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                J. Declaración de existencias de vino al cierre del mes (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Tinto/Ros. Granel</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Tinto/Ros. Env.</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Blanco Granel</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Blanco Env.</th>
                      <th className="text-right px-3 py-2 font-semibold w-24">TOTALES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {INFOVI_CATEGORIAS.map((cat) => {
                      const r = draft.cuadroJ[cat.key];
                      return (
                        <tr key={cat.key}>
                          <td className="px-3 py-2 font-medium text-stone-800">{cat.label}</td>
                          {(
                            [
                              'tintoGranel',
                              'tintoEnvasado',
                              'blancoGranel',
                              'blancoEnvasado',
                            ] as Array<keyof InfoviCuadroJRow>
                          ).map((f) => (
                            <td key={f} className="px-1.5 py-1">
                              <input
                                type="number"
                                min="0"
                                value={r[f]}
                                onChange={(e) =>
                                  updateCuadroJ(cat.key, f, parseIntNum(e.target.value))
                                }
                                className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                            {sumInfoviJRow(r)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-purple-50/70 font-bold text-purple-950 font-mono tabular-nums">
                      <td className="px-3 py-2 font-sans">TOTALES</td>
                      <td className="px-3 py-2 text-right">{totJ.tintoGranel}</td>
                      <td className="px-3 py-2 text-right">{totJ.tintoEnvasado}</td>
                      <td className="px-3 py-2 text-right">{totJ.blancoGranel}</td>
                      <td className="px-3 py-2 text-right">{totJ.blancoEnvasado}</td>
                      <td className="px-3 py-2 text-right">{totJ.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cuadro K */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                K. Declaración de salidas acumuladas desde el 1 de agosto desglosadas por categorías (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Categoría / Destino</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Tinto/Ros. Granel</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Tinto/Ros. Env.</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Blanco Granel</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Blanco Env.</th>
                      <th className="text-right px-3 py-2 font-semibold w-24">TOTALES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {INFOVI_CATEGORIAS.map((cat) => {
                      const d = draft.cuadroK[cat.key];
                      const sub = sumInfoviSalidaDestinos(d);
                      const destList: Array<{
                        key: 'interiores' | 'mercadoUe' | 'paisesTerceros';
                        label: string;
                      }> = [
                        { key: 'interiores', label: 'Interiores' },
                        { key: 'mercadoUe', label: 'Mercado UE' },
                        { key: 'paisesTerceros', label: 'Países terceros' },
                      ];
                      return (
                        <React.Fragment key={cat.key}>
                          {destList.map((dest) => {
                            const row = d[dest.key];
                            return (
                              <tr key={`${cat.key}-${dest.key}`} className="hover:bg-stone-50/60">
                                <td className="px-3 py-1.5 text-stone-700">
                                  <span className="font-semibold">{cat.label}</span> · {dest.label}
                                </td>
                                {(
                                  [
                                    'tintoGranel',
                                    'tintoEnvasado',
                                    'blancoGranel',
                                    'blancoEnvasado',
                                  ] as Array<keyof InfoviCuadroJRow>
                                ).map((f) => (
                                  <td key={f} className="px-1.5 py-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row[f]}
                                      onChange={(e) =>
                                        updateCuadroK(
                                          cat.key,
                                          dest.key,
                                          f,
                                          parseIntNum(e.target.value)
                                        )
                                      }
                                      className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                                    />
                                  </td>
                                ))}
                                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                                  {sumInfoviJRow(row)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-stone-100/80 font-semibold text-stone-800 font-mono tabular-nums">
                            <td className="px-3 py-1.5 font-sans">TOTALES {cat.label.toUpperCase()}</td>
                            <td className="px-3 py-1.5 text-right">{sub.tintoGranel}</td>
                            <td className="px-3 py-1.5 text-right">{sub.tintoEnvasado}</td>
                            <td className="px-3 py-1.5 text-right">{sub.blancoGranel}</td>
                            <td className="px-3 py-1.5 text-right">{sub.blancoEnvasado}</td>
                            <td className="px-3 py-1.5 text-right">{sub.total}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    <tr className="bg-purple-50/70 font-bold text-purple-950 font-mono tabular-nums">
                      <td className="px-3 py-2 font-sans">TOTALES SALIDAS</td>
                      <td className="px-3 py-2 text-right">{totK.tintoGranel}</td>
                      <td className="px-3 py-2 text-right">{totK.tintoEnvasado}</td>
                      <td className="px-3 py-2 text-right">{totK.blancoGranel}</td>
                      <td className="px-3 py-2 text-right">{totK.blancoEnvasado}</td>
                      <td className="px-3 py-2 text-right">{totK.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* MOSTO: Cuadro G + Cuadro H */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                G. Declaración de producción de mosto sin concentrar (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">Tinto / Rosado</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">Blanco</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">Superficie (has)</th>
                      <th className="text-right px-3 py-2 font-semibold w-28">Rend. (hl/ha)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {INFOVI_CATEGORIAS.map((cat) => {
                      const r = draft.mosto.cuadroG[cat.key];
                      return (
                        <tr key={cat.key}>
                          <td className="px-3 py-1.5 font-medium text-stone-800">{cat.label}</td>
                          {(
                            ['tintoRosado', 'blanco', 'superficieHa', 'rendimiento'] as const
                          ).map((f) => (
                            <td key={f} className="px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                value={r[f]}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    mosto: {
                                      ...prev.mosto,
                                      cuadroG: {
                                        ...prev.mosto.cuadroG,
                                        [cat.key]: {
                                          ...prev.mosto.cuadroG[cat.key],
                                          [f]: parseIntNum(e.target.value),
                                        },
                                      },
                                    },
                                  }))
                                }
                                className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-purple-950">
                H. Declaración de existencias de mosto (hl)
              </h3>
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50 text-purple-950 border-b border-purple-200">
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold">Sin conc. Tinto</th>
                      <th className="text-right px-3 py-2 font-semibold">Sin conc. Blanco</th>
                      <th className="text-right px-3 py-2 font-semibold">Mosto Concentrado</th>
                      <th className="text-right px-3 py-2 font-semibold">Concentrado Rectif.</th>
                      <th className="text-right px-3 py-2 font-semibold">Parcialm. Fermentado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(
                        [
                          'sinConcentrarTinto',
                          'sinConcentrarBlanco',
                          'concentrado',
                          'rectificado',
                          'parcialFermentado',
                        ] as const
                      ).map((f) => (
                        <td key={f} className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            value={draft.mosto.cuadroHExistencias[f]}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                mosto: {
                                  ...prev.mosto,
                                  cuadroHExistencias: {
                                    ...prev.mosto.cuadroHExistencias,
                                    [f]: parseIntNum(e.target.value),
                                  },
                                },
                              }))
                            }
                            className="w-full text-right px-2 py-1 border border-stone-200 rounded-lg font-mono tabular-nums"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Observaciones y borrado seguro */}
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Observaciones (AICA / INFOVI)
            </label>
            <textarea
              rows={2}
              value={draft.observaciones}
              onChange={(e) => setDraft({ ...draft, observaciones: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl"
            />
          </div>

          {infoviDeclaraciones.some((d) => d.id === draft.id) && (
            <div className="shrink-0">
              {confirmDeleteId === draft.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      deleteInfoviDeclaracion(draft.id);
                      setConfirmDeleteId(null);
                      showNotice('Declaración INFOVI eliminada.');
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
                  <span>Eliminar periodo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

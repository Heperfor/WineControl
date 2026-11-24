import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Download,
  Edit3,
  FileSpreadsheet,
  FlaskConical,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import { AnaliticaRegistro, MARCAS_COMERCIALES, ParametroAnalitica } from '../types/winery';
import {
  downloadSampleAnaliticaExcel,
  parseAnaliticaExcelBuffer,
  ParsedAnaliticaRow,
} from '../utils/analiticaExcelParser';
import { getLocalIsoDate } from '../utils/dateUtils';

interface AnaliticasViewProps {
  preselectedDepositoId?: string;
}

const DEFAULT_PARAM_NAMES = [
  'GF',
  'A.T',
  'pH',
  'Alc.',
  'VA',
  'Malic',
  'Lactic',
  'Sugar',
  'Density',
  'Glyc.',
  'TPI',
  'SO2 L',
];

export const AnaliticasView: React.FC<AnaliticasViewProps> = ({
  preselectedDepositoId,
}) => {
  const {
    analiticas,
    depositos,
    addAnalitica,
    addAnaliticasBatch,
    updateAnalitica,
    deleteAnalitica,
  } = useWinery();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterDepId, setFilterDepId] = useState<string>(preselectedDepositoId || 'todos');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Pending Excel import state (before user confirms)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    sheetName: string;
    headers: string[];
    rows: ParsedAnaliticaRow[];
  } | null>(null);

  // Manual Add / Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    fecha: string;
    muestra: string;
    depositoId: string;
    vinoNombre: string;
    observaciones: string;
    parametros: ParametroAnalitica[];
  }>({
    fecha: getLocalIsoDate(),
    muestra: '',
    depositoId: preselectedDepositoId || '',
    vinoNombre: '',
    observaciones: '',
    parametros: DEFAULT_PARAM_NAMES.map((nombre) => ({ nombre, valor: '' })),
  });

  const [newParamName, setNewParamName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredAnaliticas = useMemo(() => {
    const sorted = [...analiticas].sort((a, b) => {
      const dateCmp = b.fecha.localeCompare(a.fecha);
      if (dateCmp !== 0) return dateCmp;
      return (b.fechaRegistro || '').localeCompare(a.fechaRegistro || '');
    });
    if (filterDepId === 'todos') return sorted;
    return sorted.filter((a) => a.depositoId === filterDepId);
  }, [analiticas, filterDepId]);

  const uniqueWineNames = useMemo(() => {
    const names = new Set<string>(MARCAS_COMERCIALES);
    analiticas.forEach((a) => {
      if (a.vinoNombre?.trim()) names.add(a.vinoNombre.trim());
    });
    depositos.forEach((d) => {
      if (d.vinoNombre?.trim()) names.add(d.vinoNombre.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [analiticas, depositos]);

  const groupedAnaliticas = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        wineLabel: string;
        items: AnaliticaRegistro[];
      }
    >();

    filteredAnaliticas.forEach((ana) => {
      const linkedDep = depositos.find((d) => d.id === ana.depositoId);
      const rawLabel =
        (ana.vinoNombre && ana.vinoNombre.trim()) ||
        (linkedDep?.vinoNombre && linkedDep.vinoNombre.trim()) ||
        ana.muestra.trim() ||
        'Vino sin especificar';
      const normalizedKey = rawLabel
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const existing = groups.get(normalizedKey);
      if (existing) {
        existing.items.push(ana);
      } else {
        groups.set(normalizedKey, {
          key: normalizedKey,
          wineLabel: rawLabel,
          items: [ana],
        });
      }
    });

    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => {
          const dateCmp = b.fecha.localeCompare(a.fecha);
          if (dateCmp !== 0) return dateCmp;
          return (b.fechaRegistro || '').localeCompare(a.fechaRegistro || '');
        }),
      }))
      .sort((a, b) => (b.items[0]?.fecha || '').localeCompare(a.items[0]?.fecha || ''));
  }, [filteredAnaliticas, depositos]);

  const formatFechaDisplay = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  const processExcelFile = async (file: File) => {
    setUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseAnaliticaExcelBuffer(buffer, file.name, depositos);
      setPendingImport({
        fileName: file.name,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        rows: parsed.rows,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo Excel. Comprueba el formato (.xlsx, .xls o .csv).'
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processExcelFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processExcelFile(file);
    }
  };

  const updatePendingRow = (idx: number, patch: Partial<ParsedAnaliticaRow>) => {
    if (!pendingImport) return;
    const nextRows = pendingImport.rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, ...patch };
      if (patch.depositoId !== undefined) {
        const dep = depositos.find((d) => d.id === patch.depositoId);
        updated.vinoNombre = dep?.vinoNombre || updated.vinoNombre;
      }
      return updated;
    });
    setPendingImport({ ...pendingImport, rows: nextRows });
  };

  const handleConfirmImport = () => {
    if (!pendingImport || pendingImport.rows.length === 0) return;
    const items = pendingImport.rows.map((r) => ({
      fecha: r.fecha,
      muestra: r.muestra,
      depositoId: r.depositoId || undefined,
      vinoNombre:
        r.vinoNombre ||
        depositos.find((d) => d.id === r.depositoId)?.vinoNombre ||
        r.muestra,
      archivoOrigen: pendingImport.fileName,
      parametros: r.parametros,
    }));
    addAnaliticasBatch(items);
    const count = items.length;
    setPendingImport(null);
    showToast(
      `Se ${count === 1 ? 'integró 1 analítica' : `integraron ${count} analíticas`} desde Excel.`
    );
  };

  const openNewManual = (presetWineName?: string, presetDepositoId?: string) => {
    const targetDepId = presetDepositoId || (filterDepId !== 'todos' ? filterDepId : '');
    const baseDep = depositos.find((d) => d.id === targetDepId);
    setEditingId(null);
    setFormState({
      fecha: getLocalIsoDate(),
      muestra: '',
      depositoId: baseDep?.id || '',
      vinoNombre: presetWineName || baseDep?.vinoNombre || '',
      observaciones: '',
      parametros: DEFAULT_PARAM_NAMES.map((nombre) => ({ nombre, valor: '' })),
    });
    setNewParamName('');
    setIsFormOpen(true);
  };

  const openEditModal = (item: AnaliticaRegistro) => {
    setEditingId(item.id);
    setFormState({
      fecha: item.fecha,
      muestra: item.muestra,
      depositoId: item.depositoId || '',
      vinoNombre: item.vinoNombre || '',
      observaciones: item.observaciones || '',
      parametros: item.parametros.map((p) => ({ ...p })),
    });
    setNewParamName('');
    setIsFormOpen(true);
  };

  const handleAddParamField = () => {
    const trimmed = newParamName.trim();
    if (!trimmed) return;
    setFormState((prev) => ({
      ...prev,
      parametros: [...prev.parametros, { nombre: trimmed, valor: '' }],
    }));
    setNewParamName('');
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.muestra.trim()) return;
    const cleanedParams = formState.parametros.filter(
      (p) => p.nombre.trim() !== '' && p.valor.trim() !== ''
    );
    const linkedDep = depositos.find((d) => d.id === formState.depositoId);
    const payload = {
      fecha: formState.fecha,
      muestra: formState.muestra.trim(),
      depositoId: formState.depositoId || undefined,
      vinoNombre: formState.vinoNombre.trim() || linkedDep?.vinoNombre || undefined,
      observaciones: formState.observaciones.trim() || undefined,
      parametros: cleanedParams.length > 0 ? cleanedParams : formState.parametros,
    };

    if (editingId) {
      updateAnalitica(editingId, payload);
      showToast(`Analítica "${payload.muestra}" actualizada.`);
    } else {
      addAnalitica(payload);
      showToast(`Analítica "${payload.muestra}" registrada.`);
    }
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold font-serif-wine text-stone-900">
              Analíticas de Vino
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-600 border border-stone-200">
              Uso interno
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Sube documentos Excel del laboratorio para integrar los parámetros de cada vino o depósito.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadSampleAnaliticaExcel}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Modelo Excel</span>
          </button>

          <button
            type="button"
            onClick={() => openNewManual()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Manual</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-300" />
            <span>Subir Excel Analítica</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Feedback & Errors */}
      {feedbackMsg && (
        <div className="bg-stone-900 text-amber-200 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-stone-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Drag & Drop Excel Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-rose-700 bg-rose-50/70'
            : 'border-stone-300 bg-white/80 hover:border-rose-400 hover:bg-stone-50/80'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-stone-700">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm font-bold text-stone-900">
              Arrastra aquí tu archivo Excel (.xlsx, .xls o .csv) o pulsa para seleccionarlo
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Detecta automáticamente fecha, nombre de muestra y todas las columnas del documento (GF, A.T, pH, Alc., VA, Malic, Lactic, Sugar, Density, Glyc., TPI, SO2 L, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Pending Excel Import Preview & Deposit Assignment */}
      {pendingImport && (
        <div className="bg-white rounded-2xl border-2 border-emerald-600/40 shadow-md overflow-hidden">
          <div className="p-4 sm:p-5 bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300 shrink-0" />
              <div>
                <h3 className="font-serif-wine font-bold text-base">
                  Vista previa: {pendingImport.fileName}
                </h3>
                <p className="text-xs text-emerald-200">
                  {pendingImport.rows.length} {pendingImport.rows.length === 1 ? 'muestra detectada' : 'muestras detectadas'} · {pendingImport.headers.length} parámetros leídos del Excel
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="text-emerald-200 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 cursor-pointer self-start sm:self-auto"
            >
              Cancelar importación
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {pendingImport.rows.map((row, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Muestra / Código Excel
                    </label>
                    <input
                      type="text"
                      value={row.muestra}
                      onChange={(e) => updatePendingRow(idx, { muestra: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-bold border border-stone-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Vino (Agrupación)
                    </label>
                    <input
                      type="text"
                      list="analiticas-wines-list"
                      placeholder="Ej. Xouba 2024"
                      value={row.vinoNombre || ''}
                      onChange={(e) => updatePendingRow(idx, { vinoNombre: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-semibold border border-stone-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Fecha Analítica
                    </label>
                    <input
                      type="date"
                      value={row.fecha}
                      onChange={(e) => updatePendingRow(idx, { fecha: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-semibold border border-stone-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Vincular a Depósito en Bodega
                    </label>
                    <select
                      value={row.depositoId || ''}
                      onChange={(e) => updatePendingRow(idx, { depositoId: e.target.value || undefined })}
                      className="w-full px-3 py-2 text-sm font-semibold border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="">-- Sin depósito asignado --</option>
                      {[...depositos]
                        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            Dep. Nº {d.codigo} ({d.tipoRecipiente})
                            {d.vinoNombre ? ` · ${d.vinoNombre}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {row.parametros.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2 rounded-xl bg-white border border-stone-200 text-center"
                    >
                      <div className="text-[10px] font-bold text-stone-500 truncate">{p.nombre}</div>
                      <div className="text-xs font-extrabold text-stone-900 tabular-nums mt-0.5">
                        {p.valor || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium cursor-pointer"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar en Analíticas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter by Deposit Dropdown + Records List */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-rose-800" />
            <div>
              <h3 className="font-serif-wine font-bold text-base sm:text-lg text-stone-900">
                Historial de Analíticas por Vino ({groupedAnaliticas.length}{' '}
                {groupedAnaliticas.length === 1 ? 'vino' : 'vinos'} · {filteredAnaliticas.length}{' '}
                {filteredAnaliticas.length === 1 ? 'análisis' : 'análisis'})
              </h3>
              <p className="text-xs text-stone-500">
                Agrupadas por vino en el mismo recuadro y ordenadas de más reciente a más antigua.
              </p>
            </div>
          </div>

          <select
            value={filterDepId}
            onChange={(e) => setFilterDepId(e.target.value)}
            className="w-full sm:w-72 min-h-[40px] px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white font-semibold text-stone-800"
          >
            <option value="todos">Todos los depósitos y vinos ({analiticas.length})</option>
            {[...depositos]
              .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  Dep. Nº {d.codigo}
                  {d.vinoNombre ? ` · ${d.vinoNombre}` : ''}
                </option>
              ))}
          </select>
        </div>

        {groupedAnaliticas.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-500">
            No hay analíticas registradas para esta selección. Sube un archivo Excel para empezar.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedAnaliticas.map((group) => {
              const latestDepId = group.items[0]?.depositoId;
              const uniqueDeps = Array.from(
                new Set(
                  group.items
                    .map((item) => depositos.find((d) => d.id === item.depositoId))
                    .filter((d): d is NonNullable<typeof d> => Boolean(d))
                    .map((d) => `Dep. Nº ${d.codigo}`)
                )
              );

              return (
                <div
                  key={group.key}
                  className="rounded-2xl border border-stone-200 bg-[#faf8f5] overflow-hidden shadow-2xs"
                >
                  {/* Wine Group Header */}
                  <div className="px-4 sm:px-5 py-3.5 bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-serif-wine font-bold text-base sm:text-lg text-amber-200">
                          {group.wineLabel}
                        </h4>
                        <span className="text-xs font-semibold text-stone-300 tabular-nums">
                          · {group.items.length} {group.items.length === 1 ? 'analítica' : 'analíticas'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-300 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                        <span>Último análisis: {formatFechaDisplay(group.items[0].fecha)}</span>
                        {uniqueDeps.length > 0 && (
                          <span>Depósitos: {uniqueDeps.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openNewManual(group.wineLabel, latestDepId)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir analítica a este vino</span>
                    </button>
                  </div>

                  {/* Chronological Analytics Stack (Most Recent -> Oldest) */}
                  <div className="divide-y divide-stone-200/90">
                    {group.items.map((ana, idx) => {
                      const linkedDep = depositos.find((d) => d.id === ana.depositoId);
                      const isLatest = idx === 0 && group.items.length > 1;

                      return (
                        <div
                          key={ana.id}
                          className={`p-4 sm:p-5 space-y-3 ${
                            isLatest ? 'bg-white' : 'bg-[#faf8f5]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 text-amber-200 text-xs font-bold tabular-nums">
                                  <Calendar className="w-3.5 h-3.5 text-amber-300" />
                                  <span>{formatFechaDisplay(ana.fecha)}</span>
                                </span>
                                {isLatest && (
                                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                                    Más reciente
                                  </span>
                                )}
                                <span className="font-semibold text-sm text-stone-900">
                                  Muestra: {ana.muestra}
                                </span>
                                {linkedDep ? (
                                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-900 text-amber-200 text-xs font-bold">
                                    Dep. Nº {linkedDep.codigo}
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold">
                                    Sin depósito vinculado
                                  </span>
                                )}
                              </div>
                              {(ana.archivoOrigen || ana.observaciones) && (
                                <div className="text-xs text-stone-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {ana.archivoOrigen && <span>Excel: {ana.archivoOrigen}</span>}
                                  {ana.observaciones && <span>· {ana.observaciones}</span>}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                value={ana.depositoId || ''}
                                onChange={(e) => {
                                  const depId = e.target.value || undefined;
                                  const depObj = depositos.find((d) => d.id === depId);
                                  updateAnalitica(ana.id, {
                                    depositoId: depId,
                                    vinoNombre: ana.vinoNombre || depObj?.vinoNombre,
                                  });
                                  showToast(
                                    depObj
                                      ? `Analítica vinculada al Depósito Nº ${depObj.codigo}.`
                                      : 'Depósito desvinculado.'
                                  );
                                }}
                                className="min-h-[38px] px-2.5 py-1 text-xs font-semibold border border-stone-300 rounded-xl bg-white text-stone-700"
                                title="Asignar a depósito"
                              >
                                <option value="">Asignar depósito...</option>
                                {[...depositos]
                                  .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                                  .map((d) => (
                                    <option key={d.id} value={d.id}>
                                      Dep. Nº {d.codigo}
                                      {d.vinoNombre ? ` (${d.vinoNombre})` : ''}
                                    </option>
                                  ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => openEditModal(ana)}
                                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                                title="Modificar analítica"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(ana.id)}
                                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white border border-stone-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                                title="Eliminar analítica"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Parameters Determined by the Excel Sheet */}
                          <div className="grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                            {ana.parametros.map((param, pIdx) => (
                              <div
                                key={pIdx}
                                className="p-2.5 rounded-xl bg-white border border-stone-200 text-center shadow-2xs"
                              >
                                <div className="text-[11px] font-bold text-stone-500 truncate" title={param.nombre}>
                                  {param.nombre}
                                </div>
                                <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                                  {param.valor || '-'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Datalist for wine names autocomplete */}
      <datalist id="analiticas-wines-list">
        {uniqueWineNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-amber-300" />
                <h3 className="font-serif-wine font-semibold text-base">
                  {editingId ? `Editar Analítica: ${formState.muestra}` : 'Nueva Analítica Manual'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-stone-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="p-5 space-y-4 text-sm overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Muestra / Código *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. HECTOR-FE"
                    value={formState.muestra}
                    onChange={(e) => setFormState({ ...formState, muestra: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formState.fecha}
                    onChange={(e) => setFormState({ ...formState, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Depósito Asociado
                  </label>
                  <select
                    value={formState.depositoId}
                    onChange={(e) => {
                      const depId = e.target.value;
                      const dep = depositos.find((d) => d.id === depId);
                      setFormState({
                        ...formState,
                        depositoId: depId,
                        vinoNombre: dep?.vinoNombre || formState.vinoNombre,
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="">-- Ninguno --</option>
                    {[...depositos]
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          Dep. Nº {d.codigo}
                          {d.vinoNombre ? ` · ${d.vinoNombre}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Nombre del Vino (Agrupación)
                  </label>
                  <input
                    type="text"
                    list="analiticas-wines-list"
                    placeholder="Ej. Xouba 2024"
                    value={formState.vinoNombre}
                    onChange={(e) => setFormState({ ...formState, vinoNombre: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Observaciones
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={formState.observaciones}
                    onChange={(e) => setFormState({ ...formState, observaciones: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Parámetros de la Analítica
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {formState.parametros.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <input
                          type="text"
                          value={p.nombre}
                          onChange={(e) => {
                            const next = [...formState.parametros];
                            next[idx] = { ...next[idx], nombre: e.target.value };
                            setFormState({ ...formState, parametros: next });
                          }}
                          className="w-full text-[11px] font-bold text-stone-600 bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormState({
                              ...formState,
                              parametros: formState.parametros.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-stone-400 hover:text-rose-700 text-xs cursor-pointer"
                          title="Quitar parámetro"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Valor"
                        value={p.valor}
                        onChange={(e) => {
                          const next = [...formState.parametros];
                          next[idx] = { ...next[idx], valor: e.target.value };
                          setFormState({ ...formState, parametros: next });
                        }}
                        className="w-full px-2 py-1 text-sm font-bold text-stone-900 bg-white border border-stone-300 rounded-lg tabular-nums"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Añadir columna/parámetro (ej. SO2 T, Ac. Cítrico)"
                    value={newParamName}
                    onChange={(e) => setNewParamName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleAddParamField}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    + Añadir parámetro
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Analítica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-serif-wine font-bold text-lg text-rose-950">
              ¿Eliminar esta analítica?
            </h3>
            <p className="text-sm text-stone-600">
              Se eliminará del historial interno de bodega. Esta acción no afecta a la trazabilidad ni al volumen del depósito.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="min-h-[44px] px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAnalitica(deleteConfirmId);
                  setDeleteConfirmId(null);
                  showToast('Analítica eliminada.');
                }}
                className="min-h-[44px] px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

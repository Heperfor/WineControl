import React, { useMemo, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  Edit3,
  FileDown,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useWinery } from '../context/WineryContext';
import {
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
} from '../types/winery';
import {
  exportMedioRuralL1Excel,
  exportMedioRuralL1PDF,
  exportMedioRuralL2Excel,
  exportMedioRuralL2PDF,
  exportMedioRuralL3Excel,
  exportMedioRuralL3PDF,
  exportMedioRuralL4Excel,
  exportMedioRuralL4PDF,
  exportMedioRuralL5Excel,
  exportMedioRuralL5PDF,
} from '../utils/medioRuralExportUtils';

type BookId = 1 | 2 | 3 | 4 | 5;
type SpreadView = 'completo' | 'pag1' | 'pag2';

const formatFechaEs = (isoDate: string) => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

const fmtNum = (val?: number, decimals = 0) => {
  if (val === undefined || val === null || Number.isNaN(val) || val === 0) return '';
  return val.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 0 ? decimals : 3,
  });
};

const fmtSum = (val: number, decimals = 0) =>
  val.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 0 ? decimals : 2,
  });

const parseOptNum = (v: string): number | undefined => {
  const cleaned = v.trim().replace(',', '.');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

export const LibrosMedioRuralView: React.FC = () => {
  const {
    bodegaConfig,
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
  } = useWinery();

  const [activeBook, setActiveBook] = useState<BookId>(1);
  const [spreadView, setSpreadView] = useState<SpreadView>('completo');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => {
      setBannerMsg((cur) => (cur === msg ? null : cur));
    }, 5000);
  };

  // ============================================================================
  // MODAL STATES
  // ============================================================================
  // L1 Suma Anterior modal
  const [l1SumaTarget, setL1SumaTarget] = useState<'entradas' | 'salidas' | null>(null);
  const [l1SumaForm, setL1SumaForm] = useState<MedioRuralEntradaSalidaSuma>({
    mostoBrancos: 0,
    mostoTintos: 0,
    vinoBrancos: 0,
    vinoTintos: 0,
  });

  // L1 Entrada modal
  const [isL1EntModalOpen, setIsL1EntModalOpen] = useState(false);
  const [editingL1EntId, setEditingL1EntId] = useState<string | null>(null);
  const [l1EntForm, setL1EntForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    docClase: '',
    docNumero: '',
    procedencia: 'Colleita propia',
    zonaViticola: 'C II',
    mostoBrancos: '',
    mostoTintos: '',
    vinoBrancos: '',
    vinoTintos: '',
    outrosDesignacion: '',
    outrosCantidade: '',
    graduacionAdquirida: '',
    graduacionTotal: '',
    observacions: '',
  });

  // L1 Salida modal
  const [isL1SalModalOpen, setIsL1SalModalOpen] = useState(false);
  const [editingL1SalId, setEditingL1SalId] = useState<string | null>(null);
  const [l1SalForm, setL1SalForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    docClase: '',
    docNumeroReferencia: '',
    destino: 'Embotellado',
    zonaViticola: 'C II',
    mostoBrancos: '',
    mostoTintos: '',
    vinoBrancos: '',
    vinoTintos: '',
    outrosDesignacion: '',
    outrosCantidade: '',
    graduacionAdquirida: '',
    graduacionTotal: '',
    observacions: '',
  });

  // L2 Suma & Entrada/Salida modals
  const [isL2SumaOpen, setIsL2SumaOpen] = useState(false);
  const [l2SumaForm, setL2SumaForm] = useState<MedioRuralEmbotelladoSumaAnterior>(mrL2SumaAnterior);

  const [isL2EntModalOpen, setIsL2EntModalOpen] = useState(false);
  const [editingL2EntId, setEditingL2EntId] = useState<string | null>(null);
  const [l2EntForm, setL2EntForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    designacionProduto: '',
    litros: '',
    numBotellas: '',
    referenciaPrecintas: '/',
    lote: '',
    encargoNomeEmbotellador: '',
    encargoEnderezo: '',
  });

  const [isL2SalModalOpen, setIsL2SalModalOpen] = useState(false);
  const [editingL2SalId, setEditingL2SalId] = useState<string | null>(null);
  const [l2SalForm, setL2SalForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    documentoComercial: '',
    litros: '',
    observacions: '',
  });

  // L3 Suma & Movimiento modal
  const [isL3SumaOpen, setIsL3SumaOpen] = useState(false);
  const [l3SumaForm, setL3SumaForm] = useState<MedioRuralMovProductoSumaAnterior>(mrL3SumaAnterior);

  const [isL3ModalOpen, setIsL3ModalOpen] = useState(false);
  const [editingL3Id, setEditingL3Id] = useState<string | null>(null);
  const [l3Form, setL3Form] = useState({
    data: new Date().toISOString().slice(0, 10),
    procedenciaRazonSocial: '',
    procedenciaEnderezo: '',
    destinoRazonSocial: bodegaConfig.nombreBodega,
    destinoEnderezo: bodegaConfig.localidad || 'Cambados',
    documentoFactura: '',
    acidoTartaricoEntradaKg: '',
    acidoTartaricoSaidaKg: '',
    mostoConcConcentracion: '',
    mostoConcEntradaLitros: '',
    mostoConcSaidaLitros: '',
    alcoholTipoGrao: '',
    alcoholEntradaLitros: '',
    alcoholSaidaLitros: '',
    sacarosaEntradaKg: '',
    sacarosaSaidaKg: '',
    outrosProduto: '',
    outrosGradConcentracion: '',
    outrosEntradaLitroKg: '',
    outrosSaidaLitroKg: '',
  });

  // L4 Practica modal
  const [isL4ModalOpen, setIsL4ModalOpen] = useState(false);
  const [editingL4Id, setEditingL4Id] = useState<string | null>(null);
  const [l4Form, setL4Form] = useState({
    data: new Date().toISOString().slice(0, 10),
    partidaIdenEnvases: '',
    partidaProduto: '',
    partidaLitrosUtilizados: '',
    partidaGraduacionAdq: '',
    partidaGraduacionTotal: '',
    partidaAcidezTotalGl: '',
    sulfitadoProduto: '',
    sulfitadoDoseGl: '',
    sulfitadoCantidadeKg: '',
    acidProduto: '',
    acidDosesGl: '',
    acidCantidadeKg: '',
    outrasProduto: '',
    outrasGradDensidade: '',
    outrasCantidadeKgOL: '',
    finalIdenEnvases: '',
    finalProduto: '',
    finalLitrosObtidos: '',
    finalGraduacionAdq: '',
    finalGraduacionTotal: '',
    finalAcidezGl: '',
    observacions: '',
  });

  // L5 Proceso modal
  const [isL5ModalOpen, setIsL5ModalOpen] = useState(false);
  const [editingL5Id, setEditingL5Id] = useState<string | null>(null);
  const [l5Form, setL5Form] = useState({
    num: 1,
    dataInicio: new Date().toISOString().slice(0, 10),
    procesoCodigo: 'FA · Fermentación alcohólica',
    partidaIdenEnvases: '',
    partidaProduto: '',
    partidaLitrosUtilizados: '',
    partidaGradDensidade: '',
    incorporadoProduto: '',
    incorporadoGradDensidade: '',
    incorporadoCantidadeLKg: '',
    finalIdenEnvases: '',
    finalProduto: '',
    finalLitrosObtidos: '',
    finalGradAdq: '',
    finalGradTotal: '',
    observacions: '',
  });

  // ============================================================================
  // FILTERED ROWS & TOTALS
  // ============================================================================
  const q = searchQuery.trim().toLowerCase();

  const filteredL1Entradas = useMemo(() => {
    if (!q) return mrL1Entradas;
    return mrL1Entradas.filter((r) =>
      `${r.data} ${r.procedencia} ${r.observacions} ${r.docNumero}`.toLowerCase().includes(q)
    );
  }, [mrL1Entradas, q]);

  const filteredL1Salidas = useMemo(() => {
    if (!q) return mrL1Salidas;
    return mrL1Salidas.filter((r) =>
      `${r.data} ${r.destino} ${r.observacions} ${r.outrosDesignacion || ''}`.toLowerCase().includes(q)
    );
  }, [mrL1Salidas, q]);

  const l1EntTotals = useMemo(
    () => ({
      mostoBrancos:
        (mrL1SumaEntradas.mostoBrancos || 0) +
        mrL1Entradas.reduce((s, r) => s + (r.mostoBrancos || 0), 0),
      mostoTintos:
        (mrL1SumaEntradas.mostoTintos || 0) +
        mrL1Entradas.reduce((s, r) => s + (r.mostoTintos || 0), 0),
      vinoBrancos:
        (mrL1SumaEntradas.vinoBrancos || 0) +
        mrL1Entradas.reduce((s, r) => s + (r.vinoBrancos || 0), 0),
      vinoTintos:
        (mrL1SumaEntradas.vinoTintos || 0) +
        mrL1Entradas.reduce((s, r) => s + (r.vinoTintos || 0), 0),
    }),
    [mrL1Entradas, mrL1SumaEntradas]
  );

  const l1SalTotals = useMemo(
    () => ({
      mostoBrancos:
        (mrL1SumaSalidas.mostoBrancos || 0) +
        mrL1Salidas.reduce((s, r) => s + (r.mostoBrancos || 0), 0),
      mostoTintos:
        (mrL1SumaSalidas.mostoTintos || 0) +
        mrL1Salidas.reduce((s, r) => s + (r.mostoTintos || 0), 0),
      vinoBrancos:
        (mrL1SumaSalidas.vinoBrancos || 0) +
        mrL1Salidas.reduce((s, r) => s + (r.vinoBrancos || 0), 0),
      vinoTintos:
        (mrL1SumaSalidas.vinoTintos || 0) +
        mrL1Salidas.reduce((s, r) => s + (r.vinoTintos || 0), 0),
    }),
    [mrL1Salidas, mrL1SumaSalidas]
  );

  const filteredL2Entradas = useMemo(() => {
    if (!q) return mrL2Entradas;
    return mrL2Entradas.filter((r) =>
      `${r.data} ${r.designacionProduto} ${r.lote}`.toLowerCase().includes(q)
    );
  }, [mrL2Entradas, q]);

  const filteredL2Salidas = useMemo(() => {
    if (!q) return mrL2Salidas;
    return mrL2Salidas.filter((r) =>
      `${r.data} ${r.documentoComercial} ${r.observacions}`.toLowerCase().includes(q)
    );
  }, [mrL2Salidas, q]);

  const l2Totals = useMemo(
    () => ({
      entradasLitros:
        (mrL2SumaAnterior.entradasLitros || 0) +
        mrL2Entradas.reduce((s, r) => s + (r.litros || 0), 0),
      entradasBotellas:
        (mrL2SumaAnterior.entradasBotellas || 0) +
        mrL2Entradas.reduce((s, r) => s + (r.numBotellas || 0), 0),
      saidasLitros:
        (mrL2SumaAnterior.saidasLitros || 0) +
        mrL2Salidas.reduce((s, r) => s + (r.litros || 0), 0),
    }),
    [mrL2Entradas, mrL2Salidas, mrL2SumaAnterior]
  );

  const filteredL3 = useMemo(() => {
    if (!q) return mrL3Movimientos;
    return mrL3Movimientos.filter((r) =>
      `${r.data} ${r.procedenciaRazonSocial} ${r.destinoRazonSocial} ${r.documentoFactura} ${r.outrosProduto}`
        .toLowerCase()
        .includes(q)
    );
  }, [mrL3Movimientos, q]);

  const l3Totals = useMemo(
    () => ({
      tartEnt:
        (mrL3SumaAnterior.acidoTartaricoEntradaKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.acidoTartaricoEntradaKg || 0), 0),
      tartSal:
        (mrL3SumaAnterior.acidoTartaricoSaidaKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.acidoTartaricoSaidaKg || 0), 0),
      mostoEnt:
        (mrL3SumaAnterior.mostoConcEntradaLitros || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.mostoConcEntradaLitros || 0), 0),
      mostoSal:
        (mrL3SumaAnterior.mostoConcSaidaLitros || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.mostoConcSaidaLitros || 0), 0),
      alcEnt:
        (mrL3SumaAnterior.alcoholEntradaLitros || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.alcoholEntradaLitros || 0), 0),
      alcSal:
        (mrL3SumaAnterior.alcoholSaidaLitros || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.alcoholSaidaLitros || 0), 0),
      sacEnt:
        (mrL3SumaAnterior.sacarosaEntradaKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.sacarosaEntradaKg || 0), 0),
      sacSal:
        (mrL3SumaAnterior.sacarosaSaidaKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.sacarosaSaidaKg || 0), 0),
      outEnt:
        (mrL3SumaAnterior.outrosEntradaLitroKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.outrosEntradaLitroKg || 0), 0),
      outSal:
        (mrL3SumaAnterior.outrosSaidaLitroKg || 0) +
        mrL3Movimientos.reduce((s, r) => s + (r.outrosSaidaLitroKg || 0), 0),
    }),
    [mrL3Movimientos, mrL3SumaAnterior]
  );

  const filteredL4 = useMemo(() => {
    if (!q) return mrL4Practicas;
    return mrL4Practicas.filter((r) =>
      `${r.data} ${r.partidaIdenEnvases} ${r.partidaProduto} ${r.sulfitadoProduto} ${r.acidProduto} ${r.outrasProduto} ${r.observacions}`
        .toLowerCase()
        .includes(q)
    );
  }, [mrL4Practicas, q]);

  const filteredL5 = useMemo(() => {
    if (!q) return mrL5Procesos;
    return mrL5Procesos.filter((r) =>
      `${r.num} ${r.dataInicio} ${r.procesoCodigo} ${r.partidaIdenEnvases} ${r.partidaProduto} ${r.finalProduto} ${r.observacions}`
        .toLowerCase()
        .includes(q)
    );
  }, [mrL5Procesos, q]);

  // ============================================================================
  // HANDLERS: SYNC & EXPORTS
  // ============================================================================
  const handleSync = () => {
    const added = syncMedioRuralLibro(activeBook);
    const names: Record<BookId, string> = {
      1: 'Libro 1 (Entradas e Saídas)',
      2: 'Libro 2 (Embotellados)',
      3: 'Libro 3 (Mov. Produtos Enolóxicos)',
      4: 'Libro 4 (Prácticas Enolóxicas)',
      5: 'Libro 5 (Procesos de Elaboración)',
    };
    showNotice(
      added > 0
        ? `${names[activeBook]} actualizado: +${added} novo(s) asento(s) desde bodega.`
        : `${names[activeBook]} sincronizado e ao día cos rexistros de bodega.`
    );
  };

  const handleExportExcel = () => {
    if (activeBook === 1) {
      exportMedioRuralL1Excel(mrL1Entradas, mrL1Salidas, mrL1SumaEntradas, mrL1SumaSalidas, bodegaConfig);
    } else if (activeBook === 2) {
      exportMedioRuralL2Excel(mrL2Entradas, mrL2Salidas, mrL2SumaAnterior, bodegaConfig);
    } else if (activeBook === 3) {
      exportMedioRuralL3Excel(mrL3Movimientos, mrL3SumaAnterior, bodegaConfig);
    } else if (activeBook === 4) {
      exportMedioRuralL4Excel(mrL4Practicas, bodegaConfig);
    } else {
      exportMedioRuralL5Excel(mrL5Procesos, bodegaConfig);
    }
  };

  const handleExportPDF = () => {
    if (activeBook === 1) {
      exportMedioRuralL1PDF(mrL1Entradas, mrL1Salidas, mrL1SumaEntradas, mrL1SumaSalidas, bodegaConfig);
    } else if (activeBook === 2) {
      exportMedioRuralL2PDF(mrL2Entradas, mrL2Salidas, mrL2SumaAnterior, bodegaConfig);
    } else if (activeBook === 3) {
      exportMedioRuralL3PDF(mrL3Movimientos, mrL3SumaAnterior, bodegaConfig);
    } else if (activeBook === 4) {
      exportMedioRuralL4PDF(mrL4Practicas, bodegaConfig);
    } else {
      exportMedioRuralL5PDF(mrL5Procesos, bodegaConfig);
    }
  };

  // ============================================================================
  // OPEN/SAVE MODALS
  // ============================================================================
  const openCreateL1Entrada = () => {
    setEditingL1EntId(null);
    setL1EntForm({
      data: new Date().toISOString().slice(0, 10),
      docClase: '',
      docNumero: '',
      procedencia: 'Colleita propia',
      zonaViticola: 'C II',
      mostoBrancos: '',
      mostoTintos: '',
      vinoBrancos: '',
      vinoTintos: '',
      outrosDesignacion: '',
      outrosCantidade: '',
      graduacionAdquirida: '',
      graduacionTotal: '',
      observacions: '',
    });
    setIsL1EntModalOpen(true);
  };

  const openEditL1Entrada = (row: MedioRuralEntradaRegistro) => {
    setEditingL1EntId(row.id);
    setL1EntForm({
      data: row.data,
      docClase: row.docClase || '',
      docNumero: row.docNumero || '',
      procedencia: row.procedencia || '',
      zonaViticola: row.zonaViticola || 'C II',
      mostoBrancos: row.mostoBrancos !== undefined ? String(row.mostoBrancos) : '',
      mostoTintos: row.mostoTintos !== undefined ? String(row.mostoTintos) : '',
      vinoBrancos: row.vinoBrancos !== undefined ? String(row.vinoBrancos) : '',
      vinoTintos: row.vinoTintos !== undefined ? String(row.vinoTintos) : '',
      outrosDesignacion: row.outrosDesignacion || '',
      outrosCantidade: row.outrosCantidade || '',
      graduacionAdquirida: row.graduacionAdquirida !== undefined ? String(row.graduacionAdquirida) : '',
      graduacionTotal: row.graduacionTotal !== undefined ? String(row.graduacionTotal) : '',
      observacions: row.observacions || '',
    });
    setIsL1EntModalOpen(true);
  };

  const handleSaveL1Entrada = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l1EntForm.data,
      docClase: l1EntForm.docClase.trim(),
      docNumero: l1EntForm.docNumero.trim(),
      procedencia: l1EntForm.procedencia.trim(),
      zonaViticola: l1EntForm.zonaViticola.trim() || 'C II',
      mostoBrancos: parseOptNum(l1EntForm.mostoBrancos),
      mostoTintos: parseOptNum(l1EntForm.mostoTintos),
      vinoBrancos: parseOptNum(l1EntForm.vinoBrancos),
      vinoTintos: parseOptNum(l1EntForm.vinoTintos),
      outrosDesignacion: l1EntForm.outrosDesignacion.trim() || undefined,
      outrosCantidade: l1EntForm.outrosCantidade.trim() || undefined,
      graduacionAdquirida: parseOptNum(l1EntForm.graduacionAdquirida),
      graduacionTotal: parseOptNum(l1EntForm.graduacionTotal),
      observacions: l1EntForm.observacions.trim(),
    };
    if (editingL1EntId) {
      updateMrL1Entrada(editingL1EntId, payload);
      showNotice('Asento de Entrada actualizado.');
    } else {
      addMrL1Entrada(payload);
      showNotice('Novo asento engadido ao Libro de Entradas.');
    }
    setIsL1EntModalOpen(false);
  };

  const openCreateL1Salida = () => {
    setEditingL1SalId(null);
    setL1SalForm({
      data: new Date().toISOString().slice(0, 10),
      docClase: '',
      docNumeroReferencia: '',
      destino: 'Embotellado',
      zonaViticola: 'C II',
      mostoBrancos: '',
      mostoTintos: '',
      vinoBrancos: '',
      vinoTintos: '',
      outrosDesignacion: '',
      outrosCantidade: '',
      graduacionAdquirida: '',
      graduacionTotal: '',
      observacions: '',
    });
    setIsL1SalModalOpen(true);
  };

  const openEditL1Salida = (row: MedioRuralSalidaRegistro) => {
    setEditingL1SalId(row.id);
    setL1SalForm({
      data: row.data,
      docClase: row.docClase || '',
      docNumeroReferencia: row.docNumeroReferencia || '',
      destino: row.destino || '',
      zonaViticola: row.zonaViticola || 'C II',
      mostoBrancos: row.mostoBrancos !== undefined ? String(row.mostoBrancos) : '',
      mostoTintos: row.mostoTintos !== undefined ? String(row.mostoTintos) : '',
      vinoBrancos: row.vinoBrancos !== undefined ? String(row.vinoBrancos) : '',
      vinoTintos: row.vinoTintos !== undefined ? String(row.vinoTintos) : '',
      outrosDesignacion: row.outrosDesignacion || '',
      outrosCantidade: row.outrosCantidade || '',
      graduacionAdquirida: row.graduacionAdquirida !== undefined ? String(row.graduacionAdquirida) : '',
      graduacionTotal: row.graduacionTotal !== undefined ? String(row.graduacionTotal) : '',
      observacions: row.observacions || '',
    });
    setIsL1SalModalOpen(true);
  };

  const handleSaveL1Salida = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l1SalForm.data,
      docClase: l1SalForm.docClase.trim(),
      docNumeroReferencia: l1SalForm.docNumeroReferencia.trim(),
      destino: l1SalForm.destino.trim(),
      zonaViticola: l1SalForm.zonaViticola.trim() || 'C II',
      mostoBrancos: parseOptNum(l1SalForm.mostoBrancos),
      mostoTintos: parseOptNum(l1SalForm.mostoTintos),
      vinoBrancos: parseOptNum(l1SalForm.vinoBrancos),
      vinoTintos: parseOptNum(l1SalForm.vinoTintos),
      outrosDesignacion: l1SalForm.outrosDesignacion.trim() || undefined,
      outrosCantidade: l1SalForm.outrosCantidade.trim() || undefined,
      graduacionAdquirida: parseOptNum(l1SalForm.graduacionAdquirida),
      graduacionTotal: parseOptNum(l1SalForm.graduacionTotal),
      observacions: l1SalForm.observacions.trim(),
    };
    if (editingL1SalId) {
      updateMrL1Salida(editingL1SalId, payload);
      showNotice('Asento de Saída actualizado.');
    } else {
      addMrL1Salida(payload);
      showNotice('Novo asento engadido ao Libro de Saídas.');
    }
    setIsL1SalModalOpen(false);
  };

  const openCreateL2Entrada = () => {
    setEditingL2EntId(null);
    setL2EntForm({
      data: new Date().toISOString().slice(0, 10),
      designacionProduto: 'Branco. ',
      litros: '',
      numBotellas: '',
      referenciaPrecintas: '/',
      lote: '',
      encargoNomeEmbotellador: '',
      encargoEnderezo: '',
    });
    setIsL2EntModalOpen(true);
  };

  const openEditL2Entrada = (row: MedioRuralEmbotelladoEntradaRegistro) => {
    setEditingL2EntId(row.id);
    setL2EntForm({
      data: row.data,
      designacionProduto: row.designacionProduto,
      litros: String(row.litros),
      numBotellas: String(row.numBotellas),
      referenciaPrecintas: row.referenciaPrecintas || '/',
      lote: row.lote,
      encargoNomeEmbotellador: row.encargoNomeEmbotellador || '',
      encargoEnderezo: row.encargoEnderezo || '',
    });
    setIsL2EntModalOpen(true);
  };

  const handleSaveL2Entrada = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l2EntForm.data,
      designacionProduto: l2EntForm.designacionProduto.trim(),
      litros: parseOptNum(l2EntForm.litros) || 0,
      numBotellas: parseOptNum(l2EntForm.numBotellas) || 0,
      referenciaPrecintas: l2EntForm.referenciaPrecintas.trim() || '/',
      lote: l2EntForm.lote.trim(),
      encargoNomeEmbotellador: l2EntForm.encargoNomeEmbotellador.trim(),
      encargoEnderezo: l2EntForm.encargoEnderezo.trim(),
    };
    if (editingL2EntId) {
      updateMrL2Entrada(editingL2EntId, payload);
      showNotice('Entrada de embotellado actualizada.');
    } else {
      addMrL2Entrada(payload);
      showNotice('Nova entrada de embotellado rexistrada.');
    }
    setIsL2EntModalOpen(false);
  };

  const openCreateL2Salida = () => {
    setEditingL2SalId(null);
    setL2SalForm({
      data: new Date().toISOString().slice(0, 10),
      documentoComercial: '',
      litros: '',
      observacions: '',
    });
    setIsL2SalModalOpen(true);
  };

  const openEditL2Salida = (row: MedioRuralEmbotelladoSalidaRegistro) => {
    setEditingL2SalId(row.id);
    setL2SalForm({
      data: row.data,
      documentoComercial: row.documentoComercial,
      litros: String(row.litros),
      observacions: row.observacions || '',
    });
    setIsL2SalModalOpen(true);
  };

  const handleSaveL2Salida = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l2SalForm.data,
      documentoComercial: l2SalForm.documentoComercial.trim(),
      litros: parseOptNum(l2SalForm.litros) || 0,
      observacions: l2SalForm.observacions.trim(),
    };
    if (editingL2SalId) {
      updateMrL2Salida(editingL2SalId, payload);
      showNotice('Saída embotellada actualizada.');
    } else {
      addMrL2Salida(payload);
      showNotice('Nova saída embotellada rexistrada.');
    }
    setIsL2SalModalOpen(false);
  };

  const openCreateL3 = () => {
    setEditingL3Id(null);
    setL3Form({
      data: new Date().toISOString().slice(0, 10),
      procedenciaRazonSocial: 'Almacén Enolóxico Bodega',
      procedenciaEnderezo: bodegaConfig.localidad || 'Cambados',
      destinoRazonSocial: bodegaConfig.nombreBodega,
      destinoEnderezo: bodegaConfig.localidad || 'Cambados',
      documentoFactura: '',
      acidoTartaricoEntradaKg: '',
      acidoTartaricoSaidaKg: '',
      mostoConcConcentracion: '',
      mostoConcEntradaLitros: '',
      mostoConcSaidaLitros: '',
      alcoholTipoGrao: '',
      alcoholEntradaLitros: '',
      alcoholSaidaLitros: '',
      sacarosaEntradaKg: '',
      sacarosaSaidaKg: '',
      outrosProduto: '',
      outrosGradConcentracion: '',
      outrosEntradaLitroKg: '',
      outrosSaidaLitroKg: '',
    });
    setIsL3ModalOpen(true);
  };

  const openEditL3 = (row: MedioRuralMovimientoProductoRegistro) => {
    setEditingL3Id(row.id);
    setL3Form({
      data: row.data,
      procedenciaRazonSocial: row.procedenciaRazonSocial,
      procedenciaEnderezo: row.procedenciaEnderezo,
      destinoRazonSocial: row.destinoRazonSocial,
      destinoEnderezo: row.destinoEnderezo,
      documentoFactura: row.documentoFactura,
      acidoTartaricoEntradaKg: row.acidoTartaricoEntradaKg !== undefined ? String(row.acidoTartaricoEntradaKg) : '',
      acidoTartaricoSaidaKg: row.acidoTartaricoSaidaKg !== undefined ? String(row.acidoTartaricoSaidaKg) : '',
      mostoConcConcentracion: row.mostoConcConcentracion,
      mostoConcEntradaLitros: row.mostoConcEntradaLitros !== undefined ? String(row.mostoConcEntradaLitros) : '',
      mostoConcSaidaLitros: row.mostoConcSaidaLitros !== undefined ? String(row.mostoConcSaidaLitros) : '',
      alcoholTipoGrao: row.alcoholTipoGrao,
      alcoholEntradaLitros: row.alcoholEntradaLitros !== undefined ? String(row.alcoholEntradaLitros) : '',
      alcoholSaidaLitros: row.alcoholSaidaLitros !== undefined ? String(row.alcoholSaidaLitros) : '',
      sacarosaEntradaKg: row.sacarosaEntradaKg !== undefined ? String(row.sacarosaEntradaKg) : '',
      sacarosaSaidaKg: row.sacarosaSaidaKg !== undefined ? String(row.sacarosaSaidaKg) : '',
      outrosProduto: row.outrosProduto,
      outrosGradConcentracion: row.outrosGradConcentracion,
      outrosEntradaLitroKg: row.outrosEntradaLitroKg !== undefined ? String(row.outrosEntradaLitroKg) : '',
      outrosSaidaLitroKg: row.outrosSaidaLitroKg !== undefined ? String(row.outrosSaidaLitroKg) : '',
    });
    setIsL3ModalOpen(true);
  };

  const handleSaveL3 = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l3Form.data,
      procedenciaRazonSocial: l3Form.procedenciaRazonSocial.trim(),
      procedenciaEnderezo: l3Form.procedenciaEnderezo.trim(),
      destinoRazonSocial: l3Form.destinoRazonSocial.trim(),
      destinoEnderezo: l3Form.destinoEnderezo.trim(),
      documentoFactura: l3Form.documentoFactura.trim(),
      acidoTartaricoEntradaKg: parseOptNum(l3Form.acidoTartaricoEntradaKg),
      acidoTartaricoSaidaKg: parseOptNum(l3Form.acidoTartaricoSaidaKg),
      mostoConcConcentracion: l3Form.mostoConcConcentracion.trim(),
      mostoConcEntradaLitros: parseOptNum(l3Form.mostoConcEntradaLitros),
      mostoConcSaidaLitros: parseOptNum(l3Form.mostoConcSaidaLitros),
      alcoholTipoGrao: l3Form.alcoholTipoGrao.trim(),
      alcoholEntradaLitros: parseOptNum(l3Form.alcoholEntradaLitros),
      alcoholSaidaLitros: parseOptNum(l3Form.alcoholSaidaLitros),
      sacarosaEntradaKg: parseOptNum(l3Form.sacarosaEntradaKg),
      sacarosaSaidaKg: parseOptNum(l3Form.sacarosaSaidaKg),
      outrosProduto: l3Form.outrosProduto.trim(),
      outrosGradConcentracion: l3Form.outrosGradConcentracion.trim(),
      outrosEntradaLitroKg: parseOptNum(l3Form.outrosEntradaLitroKg),
      outrosSaidaLitroKg: parseOptNum(l3Form.outrosSaidaLitroKg),
    };
    if (editingL3Id) {
      updateMrL3Movimiento(editingL3Id, payload);
      showNotice('Movemento de produto actualizado.');
    } else {
      addMrL3Movimiento(payload);
      showNotice('Novo movemento engadido ao Libro 3.');
    }
    setIsL3ModalOpen(false);
  };

  const openCreateL4 = () => {
    setEditingL4Id(null);
    setL4Form({
      data: new Date().toISOString().slice(0, 10),
      partidaIdenEnvases: 'Dep. 3',
      partidaProduto: 'Viño Branco',
      partidaLitrosUtilizados: '',
      partidaGraduacionAdq: '12.5',
      partidaGraduacionTotal: '12.5',
      partidaAcidezTotalGl: '6.2',
      sulfitadoProduto: '',
      sulfitadoDoseGl: '',
      sulfitadoCantidadeKg: '',
      acidProduto: '',
      acidDosesGl: '',
      acidCantidadeKg: '',
      outrasProduto: '',
      outrasGradDensidade: '',
      outrasCantidadeKgOL: '',
      finalIdenEnvases: 'Dep. 3',
      finalProduto: 'Viño Branco',
      finalLitrosObtidos: '',
      finalGraduacionAdq: '12.5',
      finalGraduacionTotal: '12.5',
      finalAcidezGl: '6.2',
      observacions: '',
    });
    setIsL4ModalOpen(true);
  };

  const openEditL4 = (row: MedioRuralPracticaEnologicaRegistro) => {
    setEditingL4Id(row.id);
    setL4Form({
      data: row.data,
      partidaIdenEnvases: row.partidaIdenEnvases,
      partidaProduto: row.partidaProduto,
      partidaLitrosUtilizados: String(row.partidaLitrosUtilizados),
      partidaGraduacionAdq: row.partidaGraduacionAdq !== undefined ? String(row.partidaGraduacionAdq) : '',
      partidaGraduacionTotal: row.partidaGraduacionTotal !== undefined ? String(row.partidaGraduacionTotal) : '',
      partidaAcidezTotalGl: row.partidaAcidezTotalGl !== undefined ? String(row.partidaAcidezTotalGl) : '',
      sulfitadoProduto: row.sulfitadoProduto,
      sulfitadoDoseGl: row.sulfitadoDoseGl !== undefined ? String(row.sulfitadoDoseGl) : '',
      sulfitadoCantidadeKg: row.sulfitadoCantidadeKg !== undefined ? String(row.sulfitadoCantidadeKg) : '',
      acidProduto: row.acidProduto,
      acidDosesGl: row.acidDosesGl !== undefined ? String(row.acidDosesGl) : '',
      acidCantidadeKg: row.acidCantidadeKg !== undefined ? String(row.acidCantidadeKg) : '',
      outrasProduto: row.outrasProduto,
      outrasGradDensidade: row.outrasGradDensidade,
      outrasCantidadeKgOL: row.outrasCantidadeKgOL,
      finalIdenEnvases: row.finalIdenEnvases,
      finalProduto: row.finalProduto,
      finalLitrosObtidos: String(row.finalLitrosObtidos),
      finalGraduacionAdq: row.finalGraduacionAdq !== undefined ? String(row.finalGraduacionAdq) : '',
      finalGraduacionTotal: row.finalGraduacionTotal !== undefined ? String(row.finalGraduacionTotal) : '',
      finalAcidezGl: row.finalAcidezGl !== undefined ? String(row.finalAcidezGl) : '',
      observacions: row.observacions,
    });
    setIsL4ModalOpen(true);
  };

  const handleSaveL4 = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      data: l4Form.data,
      partidaIdenEnvases: l4Form.partidaIdenEnvases.trim(),
      partidaProduto: l4Form.partidaProduto.trim(),
      partidaLitrosUtilizados: parseOptNum(l4Form.partidaLitrosUtilizados) || 0,
      partidaGraduacionAdq: parseOptNum(l4Form.partidaGraduacionAdq),
      partidaGraduacionTotal: parseOptNum(l4Form.partidaGraduacionTotal),
      partidaAcidezTotalGl: parseOptNum(l4Form.partidaAcidezTotalGl),
      sulfitadoProduto: l4Form.sulfitadoProduto.trim(),
      sulfitadoDoseGl: parseOptNum(l4Form.sulfitadoDoseGl),
      sulfitadoCantidadeKg: parseOptNum(l4Form.sulfitadoCantidadeKg),
      acidProduto: l4Form.acidProduto.trim(),
      acidDosesGl: parseOptNum(l4Form.acidDosesGl),
      acidCantidadeKg: parseOptNum(l4Form.acidCantidadeKg),
      outrasProduto: l4Form.outrasProduto.trim(),
      outrasGradDensidade: l4Form.outrasGradDensidade.trim(),
      outrasCantidadeKgOL: l4Form.outrasCantidadeKgOL.trim(),
      finalIdenEnvases: l4Form.finalIdenEnvases.trim(),
      finalProduto: l4Form.finalProduto.trim(),
      finalLitrosObtidos: parseOptNum(l4Form.finalLitrosObtidos) || 0,
      finalGraduacionAdq: parseOptNum(l4Form.finalGraduacionAdq),
      finalGraduacionTotal: parseOptNum(l4Form.finalGraduacionTotal),
      finalAcidezGl: parseOptNum(l4Form.finalAcidezGl),
      observacions: l4Form.observacions.trim(),
    };
    if (editingL4Id) {
      updateMrL4Practica(editingL4Id, payload);
      showNotice('Práctica enolóxica actualizada.');
    } else {
      addMrL4Practica(payload);
      showNotice('Nova práctica engadida ao Libro 4.');
    }
    setIsL4ModalOpen(false);
  };

  const openCreateL5 = () => {
    setEditingL5Id(null);
    setL5Form({
      num: mrL5Procesos.length + 1,
      dataInicio: new Date().toISOString().slice(0, 10),
      procesoCodigo: 'FA · Fermentación alcohólica',
      partidaIdenEnvases: 'Dep. 3',
      partidaProduto: 'Mosto Branco',
      partidaLitrosUtilizados: '',
      partidaGradDensidade: '12,5% / 1,090',
      incorporadoProduto: '',
      incorporadoGradDensidade: '',
      incorporadoCantidadeLKg: '',
      finalIdenEnvases: 'Dep. 3',
      finalProduto: 'Viño Branco',
      finalLitrosObtidos: '',
      finalGradAdq: '12.5',
      finalGradTotal: '12.5',
      observacions: '',
    });
    setIsL5ModalOpen(true);
  };

  const openEditL5 = (row: MedioRuralProcesoElaboracionRegistro) => {
    setEditingL5Id(row.id);
    setL5Form({
      num: row.num,
      dataInicio: row.dataInicio,
      procesoCodigo: row.procesoCodigo,
      partidaIdenEnvases: row.partidaIdenEnvases,
      partidaProduto: row.partidaProduto,
      partidaLitrosUtilizados: String(row.partidaLitrosUtilizados),
      partidaGradDensidade: row.partidaGradDensidade,
      incorporadoProduto: row.incorporadoProduto,
      incorporadoGradDensidade: row.incorporadoGradDensidade,
      incorporadoCantidadeLKg: row.incorporadoCantidadeLKg,
      finalIdenEnvases: row.finalIdenEnvases,
      finalProduto: row.finalProduto,
      finalLitrosObtidos: String(row.finalLitrosObtidos),
      finalGradAdq: row.finalGradAdq !== undefined ? String(row.finalGradAdq) : '',
      finalGradTotal: row.finalGradTotal !== undefined ? String(row.finalGradTotal) : '',
      observacions: row.observacions,
    });
    setIsL5ModalOpen(true);
  };

  const handleSaveL5 = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      num: Number(l5Form.num) || mrL5Procesos.length + 1,
      dataInicio: l5Form.dataInicio,
      procesoCodigo: l5Form.procesoCodigo.trim(),
      partidaIdenEnvases: l5Form.partidaIdenEnvases.trim(),
      partidaProduto: l5Form.partidaProduto.trim(),
      partidaLitrosUtilizados: parseOptNum(l5Form.partidaLitrosUtilizados) || 0,
      partidaGradDensidade: l5Form.partidaGradDensidade.trim(),
      incorporadoProduto: l5Form.incorporadoProduto.trim(),
      incorporadoGradDensidade: l5Form.incorporadoGradDensidade.trim(),
      incorporadoCantidadeLKg: l5Form.incorporadoCantidadeLKg.trim(),
      finalIdenEnvases: l5Form.finalIdenEnvases.trim(),
      finalProduto: l5Form.finalProduto.trim(),
      finalLitrosObtidos: parseOptNum(l5Form.finalLitrosObtidos) || 0,
      finalGradAdq: parseOptNum(l5Form.finalGradAdq),
      finalGradTotal: parseOptNum(l5Form.finalGradTotal),
      observacions: l5Form.observacions.trim(),
    };
    if (editingL5Id) {
      updateMrL5Proceso(editingL5Id, payload);
      showNotice('Proceso de elaboración actualizado.');
    } else {
      addMrL5Proceso(payload);
      showNotice('Novo proceso engadido ao Libro 5.');
    }
    setIsL5ModalOpen(false);
  };

  const handlePrimaryNewAsiento = () => {
    if (activeBook === 1) {
      if (spreadView === 'pag2') openCreateL1Salida();
      else openCreateL1Entrada();
    } else if (activeBook === 2) {
      if (spreadView === 'pag2') openCreateL2Salida();
      else openCreateL2Entrada();
    } else if (activeBook === 3) {
      openCreateL3();
    } else if (activeBook === 4) {
      openCreateL4();
    } else {
      openCreateL5();
    }
  };

  const showP1 = spreadView === 'completo' || spreadView === 'pag1';
  const showP2 = spreadView === 'completo' || spreadView === 'pag2';

  const bookTabs: Array<{ id: BookId; short: string; title: string; count: number }> = [
    {
      id: 1,
      short: '1. Entradas e Saídas',
      title: 'Libro de Rexistro de Entradas e Saídas',
      count: mrL1Entradas.length + mrL1Salidas.length,
    },
    {
      id: 2,
      short: '2. Embotellados',
      title: 'Libro de Embotellados',
      count: mrL2Entradas.length + mrL2Salidas.length,
    },
    {
      id: 3,
      short: '3. Mov. Produtos',
      title: 'Movementos de Produtos para Elaboración e Prácticas Enolóxicas',
      count: mrL3Movimientos.length,
    },
    {
      id: 4,
      short: '4. Prácticas Enolóxicas',
      title: 'Libro de Prácticas Enolóxicas',
      count: mrL4Practicas.length,
    },
    {
      id: 5,
      short: '5. Procesos Elaboración',
      title: 'Libro de Procesos de Elaboración',
      count: mrL5Procesos.length,
    },
  ];

  const activeBookMeta = bookTabs.find((b) => b.id === activeBook)!;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-900 text-amber-200 flex items-center justify-center shrink-0">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif-wine text-stone-900">
                Libros Oficiais · Consellería do Medio Rural
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {bodegaConfig.nombreBodega} · NIF {bodegaConfig.cifNif} · RE {bodegaConfig.numeroRegistroVitivinicola} · D.O. {bodegaConfig.denominacionOrigen}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSync}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              <span>Re-sincronizar Bodega</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-800" />
              <span>PDF Xunta</span>
            </button>
            <button
              onClick={handlePrimaryNewAsiento}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Asiento</span>
            </button>
          </div>
        </div>

        {/* 5 Books Navigation Tabs */}
        <div className="mt-4 pt-3 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto pb-1">
          {bookTabs.map((tab) => {
            const isActive = activeBook === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveBook(tab.id);
                  setSpreadView('completo');
                  setSearchQuery('');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
                }`}
              >
                <span>{tab.short}</span>
                <span className={`tabular-nums ${isActive ? 'text-amber-200' : 'text-stone-400'}`}>
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {bannerMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-toolbar: Page Toggle + Search + Book Subtitle */}
      <div className="bg-white rounded-2xl border border-stone-200 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-900">{activeBookMeta.title}</h3>
          <p className="text-[11px] text-stone-500">
            {activeBook === 1 &&
              'Automatizado con vendimia (Colleita propia), fin fermentación e saídas por embotellado ou merma/lías.'}
            {activeBook === 2 &&
              'Páxina 1 automatizada con cada embotellado (cor, marca, ano, lote) e Páxina 2 coas saídas comerciais.'}
            {activeBook === 3 &&
              'Rexistro automático de doses empregadas en sulfitado, correccións e clarificación en bodega.'}
            {activeBook === 4 &&
              'Prácticas enolóxicas automatizadas dende as operacións de bodega (sulfitado, correccións, estabilización, filtración).'}
            {activeBook === 5 &&
              'Procesos de transformación numerados cronoloxicamente (Art. 10.4) dende vendimia ata trasiegos e coupages.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por data, produto, lote..."
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700 min-w-[200px]"
          />

          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setSpreadView('completo')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                spreadView === 'completo'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Libro Completo (2 Págs.)
            </button>
            <button
              onClick={() => setSpreadView('pag1')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                spreadView === 'pag1'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {activeBook === 1 || activeBook === 2 ? 'Página 1 (Entradas)' : 'Página 1'}
            </button>
            <button
              onClick={() => setSpreadView('pag2')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                spreadView === 'pag2'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {activeBook === 1 || activeBook === 2 ? 'Página 2 (Saídas)' : 'Página 2'}
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LIBRO 1: REXISTRO DE ENTRADAS E SAÍDAS (2 INDEPENDENT PAGES)         */}
      {/* ==================================================================== */}
      {activeBook === 1 && (
        <div className="space-y-6">
          {showP1 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-stone-900 text-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
                    Páxina 1 · ENTRADAS
                  </span>
                  <span className="text-xs text-stone-400">
                    Mosto fresco, viños e existencias iniciais
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setL1SumaForm(mrL1SumaEntradas);
                      setL1SumaTarget('entradas');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Editar Suma Anterior
                  </button>
                  <button
                    onClick={openCreateL1Entrada}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Entrada</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        DATA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        DOCUMENTO DE ACOMPAÑAMENTO
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        PROCEDENCIA
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center">
                        ZONA VITÍCOLA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        MOSTO DE UVA FRESCA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        VIÑOS DE (1)
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        OUTROS PRODUCTOS
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        GRADUACIÓN ALCOHÓLICA
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        OBSERVACIÓNS (6)
                      </th>
                      <th rowSpan={2} className="px-2 py-2 text-center w-16 no-print">
                        Accións
                      </th>
                    </tr>
                    <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                      <th className="border-r border-stone-200 px-2 py-1 text-center">Clase (2)</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-center">Número (3)</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Brancos</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Tintos</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Brancos</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Tintos</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Design.</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">Cantidade</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">A (4)</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">T (5)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {/* Suma anterior */}
                    <tr className="bg-amber-50/70 font-semibold text-stone-800 border-b border-stone-300">
                      <td colSpan={5} className="border-r border-stone-300 px-2.5 py-1.5 text-right text-[11px] uppercase tracking-wider">
                        Suma anterior
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaEntradas.mostoBrancos)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaEntradas.mostoTintos)}
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaEntradas.vinoBrancos)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaEntradas.vinoTintos)}
                      </td>
                      <td colSpan={6} className="px-2 py-1.5" />
                    </tr>

                    {filteredL1Entradas.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="border-r border-stone-200 px-2.5 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                          <div>{formatFechaEs(r.data)}</div>
                          <div className="text-[10px] text-stone-400 font-normal">
                            {r.origenAutomatico || 'Manual'}
                          </div>
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-center text-stone-700">
                          {r.docClase}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-center text-stone-700 tabular-nums">
                          {r.docNumero}
                        </td>
                        <td className="border-r border-stone-200 px-2.5 py-2 font-medium text-stone-800">
                          {r.procedencia}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-center text-stone-600">
                          {r.zonaViticola}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.mostoBrancos)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.mostoTintos)}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.vinoBrancos)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.vinoTintos)}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                          {r.outrosDesignacion || ''}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-stone-700 tabular-nums">
                          {r.outrosCantidade || ''}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums text-stone-800">
                          {fmtNum(r.graduacionAdquirida, 1)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums text-stone-800">
                          {fmtNum(r.graduacionTotal, 1)}
                        </td>
                        <td className="border-r border-stone-200 px-2.5 py-2 text-stone-700 max-w-[220px]">
                          {r.observacions}
                        </td>
                        <td className="px-2 py-2 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditL1Entrada(r)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMrL1Entrada(r.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Suma e segue */}
                    <tr className="bg-stone-900 text-white font-bold">
                      <td colSpan={5} className="border-r border-stone-700 px-2.5 py-2 text-right text-[11px] uppercase tracking-wider text-amber-200">
                        Suma e segue
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1EntTotals.mostoBrancos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1EntTotals.mostoTintos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1EntTotals.vinoBrancos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1EntTotals.vinoTintos)}
                      </td>
                      <td colSpan={6} className="px-2 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showP2 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-stone-800 text-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
                    Páxina 2 · SAÍDAS
                  </span>
                  <span className="text-[11px] text-stone-300 font-semibold">FOLIO Nº 001</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setL1SumaForm(mrL1SumaSalidas);
                      setL1SumaTarget('salidas');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Editar Suma Anterior
                  </button>
                  <button
                    onClick={openCreateL1Salida}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Saída</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        DATA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        DOCUMENTO DE ACOMPAÑAMENTO
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        DESTINO
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-center">
                        ZONA VITÍCOLA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        MOSTO DE UVA FRESCA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        VIÑOS DE (1)
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        OUTROS PRODUCTOS
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center">
                        GRADUACIÓN ALCOHÓLICA
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                        OBSERVACIÓNS (6)
                      </th>
                      <th rowSpan={2} className="px-2 py-2 text-center w-16 no-print">
                        Accións
                      </th>
                    </tr>
                    <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                      <th className="border-r border-stone-200 px-2 py-1 text-center">Clase (2)</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-center">
                        Nº oficial de Referencia (3)
                      </th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Brancos</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Tintos</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Brancos</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Tintos</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Design.</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">Cantidade</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">A (4)</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">T (5)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr className="bg-amber-50/70 font-semibold text-stone-800 border-b border-stone-300">
                      <td colSpan={5} className="border-r border-stone-300 px-2.5 py-1.5 text-right text-[11px] uppercase tracking-wider">
                        Suma anterior
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaSalidas.mostoBrancos)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaSalidas.mostoTintos)}
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaSalidas.vinoBrancos)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL1SumaSalidas.vinoTintos)}
                      </td>
                      <td colSpan={6} className="px-2 py-1.5" />
                    </tr>

                    {filteredL1Salidas.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="border-r border-stone-200 px-2.5 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                          <div>{formatFechaEs(r.data)}</div>
                          <div className="text-[10px] text-stone-400 font-normal">
                            {r.origenAutomatico || 'Manual'}
                          </div>
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-center text-stone-700">
                          {r.docClase}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-center text-stone-700 tabular-nums">
                          {r.docNumeroReferencia}
                        </td>
                        <td className="border-r border-stone-200 px-2.5 py-2 font-medium text-stone-800">
                          {r.destino}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-center text-stone-600">
                          {r.zonaViticola}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.mostoBrancos)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.mostoTintos)}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.vinoBrancos)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtNum(r.vinoTintos)}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                          {r.outrosDesignacion || ''}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-stone-700 tabular-nums">
                          {r.outrosCantidade || ''}
                        </td>
                        <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums text-stone-800">
                          {fmtNum(r.graduacionAdquirida, 1)}
                        </td>
                        <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums text-stone-800">
                          {fmtNum(r.graduacionTotal, 1)}
                        </td>
                        <td className="border-r border-stone-200 px-2.5 py-2 text-stone-700 max-w-[220px]">
                          {r.observacions}
                        </td>
                        <td className="px-2 py-2 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditL1Salida(r)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMrL1Salida(r.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-stone-900 text-white font-bold">
                      <td colSpan={5} className="border-r border-stone-700 px-2.5 py-2 text-right text-[11px] uppercase tracking-wider text-amber-200">
                        Suma e segue
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1SalTotals.mostoBrancos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1SalTotals.mostoTintos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1SalTotals.vinoBrancos)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l1SalTotals.vinoTintos)}
                      </td>
                      <td colSpan={6} className="px-2 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIBRO 2: EMBOTELLADOS (2 INDEPENDENT PAGES)                          */}
      {/* ==================================================================== */}
      {activeBook === 2 && (
        <div className="space-y-6">
          {showP1 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-stone-900 text-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
                    Páxina 1 · ENTRADAS EMBOTELLADOS
                  </span>
                  <span className="text-xs text-stone-400">
                    Embotellados efectuados e lotes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setL2SumaForm(mrL2SumaAnterior);
                      setIsL2SumaOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Editar Suma Anterior
                  </button>
                  <button
                    onClick={openCreateL2Entrada}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Entrada</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-left">
                        DATA
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-left">
                        DESIGNACIÓN PRODUTO (cor, grao, variedade, ano colleita)
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-right">
                        LITROS
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-right">
                        Nº BOTELLAS
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-center">
                        Referencia numeración precintas
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-3 py-2 text-center">
                        Lote
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-3 py-1.5 text-center">
                        Embotellado por encargo
                      </th>
                      <th rowSpan={2} className="px-2 py-2 text-center w-16 no-print">
                        Accións
                      </th>
                    </tr>
                    <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                      <th className="border-r border-stone-200 px-3 py-1 text-left">Nome Embotellador</th>
                      <th className="border-r border-stone-300 px-3 py-1 text-left">Enderezo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr className="bg-amber-50/70 font-semibold text-stone-800 border-b border-stone-300">
                      <td colSpan={2} className="border-r border-stone-300 px-3 py-1.5 text-right text-[11px] uppercase tracking-wider">
                        Suma anterior
                      </td>
                      <td className="border-r border-stone-300 px-3 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL2SumaAnterior.entradasLitros)}
                      </td>
                      <td className="border-r border-stone-300 px-3 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL2SumaAnterior.entradasBotellas)}
                      </td>
                      <td colSpan={5} className="px-3 py-1.5" />
                    </tr>

                    {filteredL2Entradas.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="border-r border-stone-200 px-3 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                          <div>{formatFechaEs(r.data)}</div>
                          <div className="text-[10px] text-stone-400 font-normal">
                            {r.origenAutomatico || 'Manual'}
                          </div>
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 font-medium text-stone-800">
                          {r.designacionProduto}
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtSum(r.litros)}
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                          {fmtSum(r.numBotellas)}
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 text-center text-stone-700">
                          {r.referenciaPrecintas || '/'}
                        </td>
                        <td className="border-r border-stone-300 px-3 py-2 text-center font-mono font-semibold text-stone-800">
                          {r.lote}
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 text-stone-700">
                          {r.encargoNomeEmbotellador}
                        </td>
                        <td className="border-r border-stone-200 px-3 py-2 text-stone-700">
                          {r.encargoEnderezo}
                        </td>
                        <td className="px-2 py-2 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditL2Entrada(r)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMrL2Entrada(r.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-stone-900 text-white font-bold">
                      <td colSpan={2} className="border-r border-stone-700 px-3 py-2 text-right text-[11px] uppercase tracking-wider text-amber-200">
                        Suma e segue
                      </td>
                      <td className="border-r border-stone-700 px-3 py-2 text-right tabular-nums">
                        {fmtSum(l2Totals.entradasLitros)}
                      </td>
                      <td className="border-r border-stone-700 px-3 py-2 text-right tabular-nums">
                        {fmtSum(l2Totals.entradasBotellas)}
                      </td>
                      <td colSpan={5} className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showP2 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-stone-800 text-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
                    Páxina 2 · SAÍDAS EMBOTELLADOS
                  </span>
                  <span className="text-[11px] text-stone-300 font-semibold">FOLIO Nº 001</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setL2SumaForm(mrL2SumaAnterior);
                      setIsL2SumaOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Editar Suma Anterior
                  </button>
                  <button
                    onClick={openCreateL2Salida}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Saída</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                      <th className="border-r border-stone-300 px-3 py-2.5 text-left w-32">DATA</th>
                      <th className="border-r border-stone-300 px-3 py-2.5 text-left">
                        DOCUMENTO ACOMPAÑAMENTO OU COMERCIAL
                      </th>
                      <th className="border-r border-stone-300 px-3 py-2.5 text-right w-28">
                        LITROS
                      </th>
                      <th className="border-r border-stone-300 px-3 py-2.5 text-left">
                        OBSERVACIÓNS
                      </th>
                      <th className="px-2 py-2.5 text-center w-16 no-print">Accións</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr className="bg-amber-50/70 font-semibold text-stone-800 border-b border-stone-300">
                      <td colSpan={2} className="border-r border-stone-300 px-3 py-1.5 text-right text-[11px] uppercase tracking-wider">
                        Suma anterior
                      </td>
                      <td className="border-r border-stone-300 px-3 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL2SumaAnterior.saidasLitros, 2)}
                      </td>
                      <td colSpan={2} className="px-3 py-1.5" />
                    </tr>

                    {filteredL2Salidas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                          Aínda non hai saídas embotelladas rexistradas. Rexistra unha saída en Bodega ou engádea manualmente.
                        </td>
                      </tr>
                    ) : (
                      filteredL2Salidas.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="border-r border-stone-200 px-3 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                            <div>{formatFechaEs(r.data)}</div>
                            <div className="text-[10px] text-stone-400 font-normal">
                              {r.origenAutomatico || 'Manual'}
                            </div>
                          </td>
                          <td className="border-r border-stone-200 px-3 py-2 font-medium text-stone-800">
                            {r.documentoComercial}
                          </td>
                          <td className="border-r border-stone-200 px-3 py-2 text-right tabular-nums font-semibold text-stone-900">
                            {fmtSum(r.litros, 2)}
                          </td>
                          <td className="border-r border-stone-200 px-3 py-2 text-stone-700">
                            {r.observacions}
                          </td>
                          <td className="px-2 py-2 text-center no-print">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditL2Salida(r)}
                                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteMrL2Salida(r.id)}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}

                    <tr className="bg-stone-900 text-white font-bold">
                      <td colSpan={2} className="border-r border-stone-700 px-3 py-2 text-right text-[11px] uppercase tracking-wider text-amber-200">
                        Suma e segue
                      </td>
                      <td className="border-r border-stone-700 px-3 py-2 text-right tabular-nums">
                        {fmtSum(l2Totals.saidasLitros, 2)}
                      </td>
                      <td colSpan={2} className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIBRO 3: MOVEMENTOS PRODUTOS ELABORACIÓN E PRÁCTICAS ENOLÓXICAS     */}
      {/* ==================================================================== */}
      {activeBook === 3 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-stone-900 text-stone-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
                Libro 3 · Movementos de Produtos Enolóxicos
              </span>
              {showP2 && <span className="text-[11px] text-stone-300 font-semibold">FOLIO Nº 001</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setL3SumaForm(mrL3SumaAnterior);
                  setIsL3SumaOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Editar Suma Anterior
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                  <th rowSpan={2} className="border-r border-stone-300 px-2.5 py-2 text-left">
                    DATA
                  </th>
                  {showP1 && (
                    <>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-stone-100">
                        PROCEDENCIA
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-stone-100">
                        DESTINO
                      </th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2 py-2 text-left bg-stone-100">
                        DOCUMENTO OU FACTURA
                      </th>
                      <th colSpan={2} className="border-r border-stone-400 px-2 py-1.5 text-center bg-stone-200/70">
                        ÁCIDO TARTÁRICO
                      </th>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <th colSpan={3} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        MOSTO CONCENTRADO
                      </th>
                      <th colSpan={3} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        ALCOHOL
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        SACAROSA
                      </th>
                      <th colSpan={4} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        OUTROS PRODUTOS (2)
                      </th>
                    </>
                  )}
                  <th rowSpan={2} className="px-2 py-2 text-center w-16 no-print">
                    Accións
                  </th>
                </tr>
                <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                  {showP1 && (
                    <>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Razón Social</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">Enderezo</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Razón Social</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">Enderezo</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Entrada Kg.</th>
                      <th className="border-r border-stone-400 px-2 py-1 text-right">
                        Cantidade Utilizada (Saída) Kg.
                      </th>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Concentración</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Vol. Entradas L</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Vol. Util. (Saída) L</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Tipo e Grao (1)</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Vol. Entradas L</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Vol. Util. (Saída) L</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Entrada Kg.</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Utilizada (Saída) Kg.</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">
                        Grad. Alcohólica / Conc.
                      </th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Entradas L-Kg</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Utilizada (Saída) L/Kg</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                <tr className="bg-amber-50/70 font-semibold text-stone-800 border-b border-stone-300">
                  <td
                    colSpan={showP1 ? 6 : 1}
                    className="border-r border-stone-300 px-2.5 py-1.5 text-right text-[11px] uppercase tracking-wider"
                  >
                    Suma anterior
                  </td>
                  {showP1 && (
                    <>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.acidoTartaricoEntradaKg, 3)}
                      </td>
                      <td className="border-r border-stone-400 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.acidoTartaricoSaidaKg, 3)}
                      </td>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <td className="border-r border-stone-200 px-2 py-1.5" />
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.mostoConcEntradaLitros, 2)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.mostoConcSaidaLitros, 2)}
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5" />
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.alcoholEntradaLitros, 2)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.alcoholSaidaLitros, 2)}
                      </td>
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.sacarosaEntradaKg, 3)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.sacarosaSaidaKg, 3)}
                      </td>
                      <td colSpan={2} className="border-r border-stone-200 px-2 py-1.5" />
                      <td className="border-r border-stone-200 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.outrosEntradaLitroKg, 3)}
                      </td>
                      <td className="border-r border-stone-300 px-2 py-1.5 text-right tabular-nums">
                        {fmtNum(mrL3SumaAnterior.outrosSaidaLitroKg, 3)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5 no-print" />
                </tr>

                {filteredL3.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(showP1 ? 7 : 0) + (showP2 ? 12 : 0) + 2}
                      className="px-4 py-8 text-center text-stone-500"
                    >
                      Non hai movementos de produtos enolóxicos rexistrados.
                    </td>
                  </tr>
                ) : (
                  filteredL3.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="border-r border-stone-200 px-2.5 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                        <div>{formatFechaEs(r.data)}</div>
                        <div className="text-[10px] text-stone-400 font-normal">
                          {r.origenAutomatico || 'Manual'}
                        </div>
                      </td>
                      {showP1 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.procedenciaRazonSocial}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-600">
                            {r.procedenciaEnderezo}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.destinoRazonSocial}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-600">
                            {r.destinoEnderezo}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-700 tabular-nums">
                            {r.documentoFactura}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.acidoTartaricoEntradaKg, 3)}
                          </td>
                          <td className="border-r border-stone-400 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.acidoTartaricoSaidaKg, 3)}
                          </td>
                        </>
                      )}
                      {showP2 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                            {r.mostoConcConcentracion}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.mostoConcEntradaLitros, 2)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.mostoConcSaidaLitros, 2)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                            {r.alcoholTipoGrao}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.alcoholEntradaLitros, 2)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.alcoholSaidaLitros, 2)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.sacarosaEntradaKg, 3)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.sacarosaSaidaKg, 3)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 font-medium text-stone-800">
                            {r.outrosProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-600">
                            {r.outrosGradConcentracion}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.outrosEntradaLitroKg, 3)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.outrosSaidaLitroKg, 3)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditL3(r)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMrL3Movimiento(r.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                <tr className="bg-stone-900 text-white font-bold">
                  <td
                    colSpan={showP1 ? 6 : 1}
                    className="border-r border-stone-700 px-2.5 py-2 text-right text-[11px] uppercase tracking-wider text-amber-200"
                  >
                    Suma e segue
                  </td>
                  {showP1 && (
                    <>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.tartEnt, 3)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.tartSal, 3)}
                      </td>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <td className="border-r border-stone-700 px-2 py-2" />
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.mostoEnt, 2)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.mostoSal, 2)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2" />
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.alcEnt, 2)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.alcSal, 2)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.sacEnt, 3)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.sacSal, 3)}
                      </td>
                      <td colSpan={2} className="border-r border-stone-700 px-2 py-2" />
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.outEnt, 3)}
                      </td>
                      <td className="border-r border-stone-700 px-2 py-2 text-right tabular-nums">
                        {fmtSum(l3Totals.outSal, 3)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 no-print" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex flex-wrap gap-4">
            <span>(1) Alcohol vínico, destilado orixe agrícola.</span>
            <span>(2) Mostos concentrados rectificados, outros produtos para acidificación e desacidificación.</span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIBRO 4: PRÁCTICAS ENOLÓXICAS                                        */}
      {/* ==================================================================== */}
      {activeBook === 4 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-stone-900 text-stone-100 flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
              Libro 4 · Rexistro de Prácticas Enolóxicas
            </span>
            {showP2 && <span className="text-[11px] text-stone-300 font-semibold">FOLIO Nº 001</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                  {showP1 ? (
                    <th colSpan={7} className="border-r border-stone-300 px-2 py-1.5 text-center bg-stone-100">
                      PRODUTO DE PARTIDA
                    </th>
                  ) : (
                    <th rowSpan={3} className="border-r border-stone-300 px-2.5 py-2 text-left">
                      DATA
                    </th>
                  )}
                  {showP1 && (
                    <th colSpan={6} className="border-r border-stone-400 px-2 py-1.5 text-center bg-stone-200/70">
                      PRÁCTICA ENOLÓXICA
                    </th>
                  )}
                  {showP2 && (
                    <>
                      <th colSpan={3} rowSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        OUTRAS PRÁCTICAS ENOLÓXICAS
                      </th>
                      <th colSpan={6} rowSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        PRODUTO FINAL
                      </th>
                      <th rowSpan={3} className="border-r border-stone-300 px-2.5 py-2 text-left bg-emerald-50/70">
                        OBSERVACIÓNS (Data de saída cara a lib. Rexistro)
                      </th>
                    </>
                  )}
                  <th rowSpan={3} className="px-2 py-2 text-center w-16 no-print">
                    Accións
                  </th>
                </tr>

                <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                  {showP1 && (
                    <>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-left">DATA</th>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-left">Iden. Envases</th>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-right">Litros Utilizados</th>
                      <th colSpan={2} className="border-r border-stone-200 px-2 py-1 text-center">Graduación</th>
                      <th rowSpan={2} className="border-r border-stone-300 px-2 py-1 text-right">
                        Acidez Total en Tartárico g/l
                      </th>
                      <th colSpan={3} className="border-r border-stone-300 px-2 py-1 text-center font-semibold">
                        SULFITADO
                      </th>
                      <th colSpan={3} className="border-r border-stone-400 px-2 py-1 text-center font-semibold">
                        ACIDIFICACIÓN / DESACIDIFICACIÓN
                      </th>
                    </>
                  )}
                </tr>

                <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                  {showP1 && (
                    <>
                      <th className="border-r border-stone-200 px-1.5 py-1 text-right">(1)</th>
                      <th className="border-r border-stone-200 px-1.5 py-1 text-right">(2)</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Dose g/l</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Cantidade Engadida Kg.</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Doses g/l</th>
                      <th className="border-r border-stone-400 px-2 py-1 text-right">Cantidade Engadida Kg.</th>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Grad. ou Densidade</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">Cantidade Kg. o l.</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Iden. Envases</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Litros Obtidos</th>
                      <th className="border-r border-stone-200 px-1.5 py-1 text-right">(1)</th>
                      <th className="border-r border-stone-200 px-1.5 py-1 text-right">(2)</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-right">Acidez g/l</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredL4.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(showP1 ? 13 : 1) + (showP2 ? 10 : 0) + 1}
                      className="px-4 py-8 text-center text-stone-500"
                    >
                      Non hai prácticas enolóxicas rexistradas.
                    </td>
                  </tr>
                ) : (
                  filteredL4.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="border-r border-stone-200 px-2 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                        <div>{formatFechaEs(r.data)}</div>
                        <div className="text-[10px] text-stone-400 font-normal">
                          {r.origenAutomatico || 'Manual'}
                        </div>
                      </td>
                      {showP1 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 font-medium text-stone-800">
                            {r.partidaIdenEnvases}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.partidaProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtSum(r.partidaLitrosUtilizados)}
                          </td>
                          <td className="border-r border-stone-200 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.partidaGraduacionAdq, 1)}
                          </td>
                          <td className="border-r border-stone-200 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.partidaGraduacionTotal, 1)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.partidaAcidezTotalGl, 1)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.sulfitadoProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.sulfitadoDoseGl, 2)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.sulfitadoCantidadeKg, 3)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.acidProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.acidDosesGl, 2)}
                          </td>
                          <td className="border-r border-stone-400 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtNum(r.acidCantidadeKg, 3)}
                          </td>
                        </>
                      )}
                      {showP2 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.outrasProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-600 tabular-nums">
                            {r.outrasGradDensidade}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-800 tabular-nums font-semibold">
                            {r.outrasCantidadeKgOL}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 font-medium text-stone-800">
                            {r.finalIdenEnvases}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.finalProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtSum(r.finalLitrosObtidos)}
                          </td>
                          <td className="border-r border-stone-200 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.finalGraduacionAdq, 1)}
                          </td>
                          <td className="border-r border-stone-200 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.finalGraduacionTotal, 1)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-right tabular-nums">
                            {fmtNum(r.finalAcidezGl, 1)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                            {r.observacions}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditL4(r)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMrL4Practica(r.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex flex-wrap gap-4">
            <span>(1) Graduación Alcohólica adquirida.</span>
            <span>(2) Graduación Alcohólica total.</span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIBRO 5: PROCESOS DE ELABORACIÓN                                     */}
      {/* ==================================================================== */}
      {activeBook === 5 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-stone-900 text-stone-100 flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-amber-200">
              Libro 5 · Procesos de Elaboración
            </span>
            {showP2 && <span className="text-[11px] text-stone-300 font-semibold">FOLIO Nº 001</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-300 text-[10px] uppercase tracking-wider">
                  <th rowSpan={3} className="border-r border-stone-300 px-2.5 py-2 text-center w-14">
                    NUM.
                  </th>
                  {showP1 && (
                    <>
                      <th colSpan={2} rowSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-stone-100">
                        PROCESO TRANSFORMACIÓN
                      </th>
                      <th colSpan={4} rowSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-stone-100">
                        PRODUTO DE PARTIDA
                      </th>
                      <th rowSpan={2} className="border-r border-stone-400 px-2 py-1.5 text-center bg-stone-200/70">
                        PRODUTO INCORPORADO
                      </th>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <th colSpan={2} rowSpan={2} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        PRODUTO INCORPORADO
                      </th>
                      <th colSpan={5} className="border-r border-stone-300 px-2 py-1.5 text-center bg-emerald-50/70">
                        PRODUTO FINAL
                      </th>
                      <th rowSpan={3} className="border-r border-stone-300 px-2.5 py-2 text-left bg-emerald-50/70">
                        OBSERVACIÓNS (Data de saída cara o libro de Rexistro)
                      </th>
                    </>
                  )}
                  <th rowSpan={3} className="px-2 py-2 text-center w-16 no-print">
                    Accións
                  </th>
                </tr>

                <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                  {showP2 && (
                    <>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-left">
                        Identificación dos envases
                      </th>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th rowSpan={2} className="border-r border-stone-200 px-2 py-1 text-right">
                        Litros obtidos
                      </th>
                      <th colSpan={2} className="border-r border-stone-300 px-2 py-1 text-center">
                        Graduacións Alcohólicas
                      </th>
                    </>
                  )}
                </tr>

                <tr className="bg-stone-50 text-stone-600 border-b border-stone-300 text-[10px]">
                  {showP1 && (
                    <>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">DATA INICIO</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">PROCESO (1)</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Identificación envases</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">PRODUTO</th>
                      <th className="border-r border-stone-200 px-2 py-1 text-right">Litros utilizados</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">grad. Alc./densidade</th>
                      <th className="border-r border-stone-400 px-2 py-1 text-left">PRODUTO</th>
                    </>
                  )}
                  {showP2 && (
                    <>
                      <th className="border-r border-stone-200 px-2 py-1 text-left">Grad. Alc./densidade</th>
                      <th className="border-r border-stone-300 px-2 py-1 text-left">
                        Cantidade engadida L/Kg
                      </th>
                      <th className="border-r border-stone-200 px-1.5 py-1 text-right">Adq</th>
                      <th className="border-r border-stone-300 px-1.5 py-1 text-right">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredL5.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(showP1 ? 7 : 0) + (showP2 ? 8 : 0) + 2}
                      className="px-4 py-8 text-center text-stone-500"
                    >
                      Non hai procesos de elaboración rexistrados.
                    </td>
                  </tr>
                ) : (
                  filteredL5.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="border-r border-stone-300 px-2.5 py-2 text-center font-bold tabular-nums text-stone-900">
                        <div>{r.num}</div>
                        <div className="text-[10px] text-stone-400 font-normal">
                          {r.origenAutomatico || 'Manual'}
                        </div>
                      </td>
                      {showP1 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 whitespace-nowrap tabular-nums font-medium text-stone-900">
                            {formatFechaEs(r.dataInicio)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 font-medium text-stone-800">
                            {r.procesoCodigo}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 font-medium text-stone-800">
                            {r.partidaIdenEnvases}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.partidaProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtSum(r.partidaLitrosUtilizados)}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-700 tabular-nums">
                            {r.partidaGradDensidade}
                          </td>
                          <td className="border-r border-stone-400 px-2 py-2 text-stone-700">
                            {r.incorporadoProduto}
                          </td>
                        </>
                      )}
                      {showP2 && (
                        <>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-700 tabular-nums">
                            {r.incorporadoGradDensidade}
                          </td>
                          <td className="border-r border-stone-300 px-2 py-2 text-stone-700 tabular-nums">
                            {r.incorporadoCantidadeLKg}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 font-medium text-stone-800">
                            {r.finalIdenEnvases}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-800">
                            {r.finalProduto}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-right tabular-nums font-semibold">
                            {fmtSum(r.finalLitrosObtidos)}
                          </td>
                          <td className="border-r border-stone-200 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.finalGradAdq, 1)}
                          </td>
                          <td className="border-r border-stone-300 px-1.5 py-2 text-right tabular-nums">
                            {fmtNum(r.finalGradTotal, 1)}
                          </td>
                          <td className="border-r border-stone-200 px-2 py-2 text-stone-700">
                            {r.observacions}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditL5(r)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMrL5Proceso(r.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500">
            (1) Códigos segundo Art. 10.4. do presente Decreto.
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODALS FOR SUMA ANTERIOR & CRUD                                      */}
      {/* ==================================================================== */}

      {/* Modal: L1 Suma Anterior */}
      {l1SumaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Suma Anterior · {l1SumaTarget === 'entradas' ? 'Entradas' : 'Saídas'} (Libro 1)
              </h3>
              <button onClick={() => setL1SumaTarget(null)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (l1SumaTarget === 'entradas') updateMrL1SumaEntradas(l1SumaForm);
                else updateMrL1SumaSalidas(l1SumaForm);
                setL1SumaTarget(null);
                showNotice('Suma anterior do Libro 1 actualizada.');
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Brancos (L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={l1SumaForm.mostoBrancos}
                    onChange={(e) => setL1SumaForm({ ...l1SumaForm, mostoBrancos: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Tintos (L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={l1SumaForm.mostoTintos}
                    onChange={(e) => setL1SumaForm({ ...l1SumaForm, mostoTintos: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Brancos (L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={l1SumaForm.vinoBrancos}
                    onChange={(e) => setL1SumaForm({ ...l1SumaForm, vinoBrancos: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Tintos (L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={l1SumaForm.vinoTintos}
                    onChange={(e) => setL1SumaForm({ ...l1SumaForm, vinoTintos: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setL1SumaTarget(null)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer"
                >
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L1 Entrada */}
      {isL1EntModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingL1EntId ? 'Editar Entrada (Libro 1)' : 'Nova Entrada (Libro 1)'}
              </h3>
              <button onClick={() => setIsL1EntModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL1Entrada} className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={l1EntForm.data}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, data: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Doc. Clase (2)</label>
                  <input
                    type="text"
                    value={l1EntForm.docClase}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, docClase: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Doc. Número (3)</label>
                  <input
                    type="text"
                    value={l1EntForm.docNumero}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, docNumero: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Zona Vitícola</label>
                  <input
                    type="text"
                    value={l1EntForm.zonaViticola}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, zonaViticola: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Procedencia</label>
                <input
                  type="text"
                  required
                  value={l1EntForm.procedencia}
                  onChange={(e) => setL1EntForm({ ...l1EntForm, procedencia: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Brancos (L)</label>
                  <input
                    type="text"
                    value={l1EntForm.mostoBrancos}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, mostoBrancos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Tintos (L)</label>
                  <input
                    type="text"
                    value={l1EntForm.mostoTintos}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, mostoTintos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Brancos (L)</label>
                  <input
                    type="text"
                    value={l1EntForm.vinoBrancos}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, vinoBrancos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Tintos (L)</label>
                  <input
                    type="text"
                    value={l1EntForm.vinoTintos}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, vinoTintos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Design.</label>
                  <input
                    type="text"
                    value={l1EntForm.outrosDesignacion}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, outrosDesignacion: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Cantidade</label>
                  <input
                    type="text"
                    value={l1EntForm.outrosCantidade}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, outrosCantidade: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Graduación A (4)</label>
                  <input
                    type="text"
                    value={l1EntForm.graduacionAdquirida}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, graduacionAdquirida: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Graduación T (5)</label>
                  <input
                    type="text"
                    value={l1EntForm.graduacionTotal}
                    onChange={(e) => setL1EntForm({ ...l1EntForm, graduacionTotal: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Observacións (6)</label>
                <input
                  type="text"
                  value={l1EntForm.observacions}
                  onChange={(e) => setL1EntForm({ ...l1EntForm, observacions: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsL1EntModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer"
                >
                  Gardar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L1 Salida */}
      {isL1SalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingL1SalId ? 'Editar Saída (Libro 1)' : 'Nova Saída (Libro 1)'}
              </h3>
              <button onClick={() => setIsL1SalModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL1Salida} className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={l1SalForm.data}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, data: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Doc. Clase (2)</label>
                  <input
                    type="text"
                    value={l1SalForm.docClase}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, docClase: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Oficial Ref. (3)</label>
                  <input
                    type="text"
                    value={l1SalForm.docNumeroReferencia}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, docNumeroReferencia: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Zona Vitícola</label>
                  <input
                    type="text"
                    value={l1SalForm.zonaViticola}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, zonaViticola: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Destino</label>
                <input
                  type="text"
                  required
                  value={l1SalForm.destino}
                  onChange={(e) => setL1SalForm({ ...l1SalForm, destino: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Brancos (L)</label>
                  <input
                    type="text"
                    value={l1SalForm.mostoBrancos}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, mostoBrancos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Tintos (L)</label>
                  <input
                    type="text"
                    value={l1SalForm.mostoTintos}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, mostoTintos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Brancos (L)</label>
                  <input
                    type="text"
                    value={l1SalForm.vinoBrancos}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, vinoBrancos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Viños Tintos (L)</label>
                  <input
                    type="text"
                    value={l1SalForm.vinoTintos}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, vinoTintos: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Design.</label>
                  <input
                    type="text"
                    value={l1SalForm.outrosDesignacion}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, outrosDesignacion: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Cantidade</label>
                  <input
                    type="text"
                    value={l1SalForm.outrosCantidade}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, outrosCantidade: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Graduación A (4)</label>
                  <input
                    type="text"
                    value={l1SalForm.graduacionAdquirida}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, graduacionAdquirida: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Graduación T (5)</label>
                  <input
                    type="text"
                    value={l1SalForm.graduacionTotal}
                    onChange={(e) => setL1SalForm({ ...l1SalForm, graduacionTotal: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Observacións (6)</label>
                <input
                  type="text"
                  value={l1SalForm.observacions}
                  onChange={(e) => setL1SalForm({ ...l1SalForm, observacions: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsL1SalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer"
                >
                  Gardar Saída
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L2 Suma Anterior */}
      {isL2SumaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Suma Anterior · Embotellados (Libro 2)</h3>
              <button onClick={() => setIsL2SumaOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMrL2SumaAnterior(l2SumaForm);
                setIsL2SumaOpen(false);
                showNotice('Suma anterior do Libro 2 actualizada.');
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-stone-700 mb-1">Entradas · Litros</label>
                <input
                  type="number"
                  step="0.01"
                  value={l2SumaForm.entradasLitros}
                  onChange={(e) => setL2SumaForm({ ...l2SumaForm, entradasLitros: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Entradas · Nº Botellas</label>
                <input
                  type="number"
                  value={l2SumaForm.entradasBotellas}
                  onChange={(e) => setL2SumaForm({ ...l2SumaForm, entradasBotellas: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Saídas · Litros</label>
                <input
                  type="number"
                  step="0.01"
                  value={l2SumaForm.saidasLitros}
                  onChange={(e) => setL2SumaForm({ ...l2SumaForm, saidasLitros: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL2SumaOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L2 Entrada */}
      {isL2EntModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingL2EntId ? 'Editar Entrada Embotellado' : 'Nova Entrada Embotellado'}
              </h3>
              <button onClick={() => setIsL2EntModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL2Entrada} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={l2EntForm.data}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, data: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Lote</label>
                  <input
                    type="text"
                    required
                    value={l2EntForm.lote}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, lote: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Designación Produto (cor, grao, variedade, ano colleita)
                </label>
                <input
                  type="text"
                  required
                  value={l2EntForm.designacionProduto}
                  onChange={(e) => setL2EntForm({ ...l2EntForm, designacionProduto: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={l2EntForm.litros}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, litros: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Nº Botellas</label>
                  <input
                    type="number"
                    required
                    value={l2EntForm.numBotellas}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, numBotellas: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ref. Precintas</label>
                  <input
                    type="text"
                    value={l2EntForm.referenciaPrecintas}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, referenciaPrecintas: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Encargo: Nome Embotellador</label>
                  <input
                    type="text"
                    value={l2EntForm.encargoNomeEmbotellador}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, encargoNomeEmbotellador: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Encargo: Enderezo</label>
                  <input
                    type="text"
                    value={l2EntForm.encargoEnderezo}
                    onChange={(e) => setL2EntForm({ ...l2EntForm, encargoEnderezo: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL2EntModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L2 Salida */}
      {isL2SalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingL2SalId ? 'Editar Saída Embotellada' : 'Nova Saída Embotellada'}
              </h3>
              <button onClick={() => setIsL2SalModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL2Salida} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={l2SalForm.data}
                    onChange={(e) => setL2SalForm({ ...l2SalForm, data: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={l2SalForm.litros}
                    onChange={(e) => setL2SalForm({ ...l2SalForm, litros: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Documento Acompañamento ou Comercial
                </label>
                <input
                  type="text"
                  required
                  value={l2SalForm.documentoComercial}
                  onChange={(e) => setL2SalForm({ ...l2SalForm, documentoComercial: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Observacións</label>
                <input
                  type="text"
                  value={l2SalForm.observacions}
                  onChange={(e) => setL2SalForm({ ...l2SalForm, observacions: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL2SalModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L3 Suma Anterior */}
      {isL3SumaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Suma Anterior · Mov. Produtos Enolóxicos (Libro 3)</h3>
              <button onClick={() => setIsL3SumaOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMrL3SumaAnterior(l3SumaForm);
                setIsL3SumaOpen(false);
                showNotice('Suma anterior do Libro 3 actualizada.');
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ácido Tartárico Ent. (Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.acidoTartaricoEntradaKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, acidoTartaricoEntradaKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ácido Tartárico Saída (Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.acidoTartaricoSaidaKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, acidoTartaricoSaidaKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Conc. Ent. (L)</label>
                  <input type="number" step="0.01" value={l3SumaForm.mostoConcEntradaLitros} onChange={(e) => setL3SumaForm({ ...l3SumaForm, mostoConcEntradaLitros: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mosto Conc. Saída (L)</label>
                  <input type="number" step="0.01" value={l3SumaForm.mostoConcSaidaLitros} onChange={(e) => setL3SumaForm({ ...l3SumaForm, mostoConcSaidaLitros: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Alcohol Ent. (L)</label>
                  <input type="number" step="0.01" value={l3SumaForm.alcoholEntradaLitros} onChange={(e) => setL3SumaForm({ ...l3SumaForm, alcoholEntradaLitros: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Alcohol Saída (L)</label>
                  <input type="number" step="0.01" value={l3SumaForm.alcoholSaidaLitros} onChange={(e) => setL3SumaForm({ ...l3SumaForm, alcoholSaidaLitros: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Sacarosa Ent. (Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.sacarosaEntradaKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, sacarosaEntradaKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Sacarosa Saída (Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.sacarosaSaidaKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, sacarosaSaidaKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Ent. (L/Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.outrosEntradaLitroKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, outrosEntradaLitroKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Saída (L/Kg)</label>
                  <input type="number" step="0.001" value={l3SumaForm.outrosSaidaLitroKg} onChange={(e) => setL3SumaForm({ ...l3SumaForm, outrosSaidaLitroKg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL3SumaOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L3 Movimiento */}
      {isL3ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingL3Id ? 'Editar Movemento Produto (Libro 3)' : 'Novo Movemento Produto (Libro 3)'}
              </h3>
              <button onClick={() => setIsL3ModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL3} className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input type="date" required value={l3Form.data} onChange={(e) => setL3Form({ ...l3Form, data: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700 mb-1">Documento ou Factura</label>
                  <input type="text" value={l3Form.documentoFactura} onChange={(e) => setL3Form({ ...l3Form, documentoFactura: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Procedencia · Razón Social</label>
                  <input type="text" value={l3Form.procedenciaRazonSocial} onChange={(e) => setL3Form({ ...l3Form, procedenciaRazonSocial: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Procedencia · Enderezo</label>
                  <input type="text" value={l3Form.procedenciaEnderezo} onChange={(e) => setL3Form({ ...l3Form, procedenciaEnderezo: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Destino · Razón Social</label>
                  <input type="text" value={l3Form.destinoRazonSocial} onChange={(e) => setL3Form({ ...l3Form, destinoRazonSocial: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Destino · Enderezo</label>
                  <input type="text" value={l3Form.destinoEnderezo} onChange={(e) => setL3Form({ ...l3Form, destinoEnderezo: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-200">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ác. Tartárico Ent. Kg</label>
                  <input type="text" value={l3Form.acidoTartaricoEntradaKg} onChange={(e) => setL3Form({ ...l3Form, acidoTartaricoEntradaKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Ác. Tartárico Saída Kg</label>
                  <input type="text" value={l3Form.acidoTartaricoSaidaKg} onChange={(e) => setL3Form({ ...l3Form, acidoTartaricoSaidaKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Sacarosa Ent. Kg</label>
                  <input type="text" value={l3Form.sacarosaEntradaKg} onChange={(e) => setL3Form({ ...l3Form, sacarosaEntradaKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Sacarosa Saída Kg</label>
                  <input type="text" value={l3Form.sacarosaSaidaKg} onChange={(e) => setL3Form({ ...l3Form, sacarosaSaidaKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Produto</label>
                  <input type="text" value={l3Form.outrosProduto} onChange={(e) => setL3Form({ ...l3Form, outrosProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grad. / Conc.</label>
                  <input type="text" value={l3Form.outrosGradConcentracion} onChange={(e) => setL3Form({ ...l3Form, outrosGradConcentracion: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Ent. L/Kg</label>
                  <input type="text" value={l3Form.outrosEntradaLitroKg} onChange={(e) => setL3Form({ ...l3Form, outrosEntradaLitroKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outros Saída L/Kg</label>
                  <input type="text" value={l3Form.outrosSaidaLitroKg} onChange={(e) => setL3Form({ ...l3Form, outrosSaidaLitroKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL3ModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L4 Práctica Enolóxica */}
      {isL4ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingL4Id ? 'Editar Práctica Enolóxica (Libro 4)' : 'Nova Práctica Enolóxica (Libro 4)'}
              </h3>
              <button onClick={() => setIsL4ModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL4} className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data</label>
                  <input type="date" required value={l4Form.data} onChange={(e) => setL4Form({ ...l4Form, data: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Partida · Envases</label>
                  <input type="text" required value={l4Form.partidaIdenEnvases} onChange={(e) => setL4Form({ ...l4Form, partidaIdenEnvases: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Partida · Produto</label>
                  <input type="text" required value={l4Form.partidaProduto} onChange={(e) => setL4Form({ ...l4Form, partidaProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros Utilizados</label>
                  <input type="number" step="0.01" required value={l4Form.partidaLitrosUtilizados} onChange={(e) => setL4Form({ ...l4Form, partidaLitrosUtilizados: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-stone-200">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Sulfitado · Produto</label>
                  <input type="text" value={l4Form.sulfitadoProduto} onChange={(e) => setL4Form({ ...l4Form, sulfitadoProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Dose (g/l)</label>
                  <input type="text" value={l4Form.sulfitadoDoseGl} onChange={(e) => setL4Form({ ...l4Form, sulfitadoDoseGl: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidade (Kg)</label>
                  <input type="text" value={l4Form.sulfitadoCantidadeKg} onChange={(e) => setL4Form({ ...l4Form, sulfitadoCantidadeKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Acidificación · Produto</label>
                  <input type="text" value={l4Form.acidProduto} onChange={(e) => setL4Form({ ...l4Form, acidProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Doses (g/l)</label>
                  <input type="text" value={l4Form.acidDosesGl} onChange={(e) => setL4Form({ ...l4Form, acidDosesGl: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidade (Kg)</label>
                  <input type="text" value={l4Form.acidCantidadeKg} onChange={(e) => setL4Form({ ...l4Form, acidCantidadeKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Outras Prácticas · Produto</label>
                  <input type="text" value={l4Form.outrasProduto} onChange={(e) => setL4Form({ ...l4Form, outrasProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grad. ou Densidade</label>
                  <input type="text" value={l4Form.outrasGradDensidade} onChange={(e) => setL4Form({ ...l4Form, outrasGradDensidade: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Cantidade (Kg ou l)</label>
                  <input type="text" value={l4Form.outrasCantidadeKgOL} onChange={(e) => setL4Form({ ...l4Form, outrasCantidadeKgOL: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-200">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Final · Envases</label>
                  <input type="text" required value={l4Form.finalIdenEnvases} onChange={(e) => setL4Form({ ...l4Form, finalIdenEnvases: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Final · Produto</label>
                  <input type="text" required value={l4Form.finalProduto} onChange={(e) => setL4Form({ ...l4Form, finalProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros Obtidos</label>
                  <input type="number" step="0.01" required value={l4Form.finalLitrosObtidos} onChange={(e) => setL4Form({ ...l4Form, finalLitrosObtidos: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Observacións</label>
                  <input type="text" value={l4Form.observacions} onChange={(e) => setL4Form({ ...l4Form, observacions: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL4ModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: L5 Proceso Elaboración */}
      {isL5ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingL5Id ? 'Editar Proceso Elaboración (Libro 5)' : 'Novo Proceso Elaboración (Libro 5)'}
              </h3>
              <button onClick={() => setIsL5ModalOpen(false)} className="text-stone-300 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveL5} className="p-5 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Num.</label>
                  <input type="number" required value={l5Form.num} onChange={(e) => setL5Form({ ...l5Form, num: Number(e.target.value) || 1 })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Data Inicio</label>
                  <input type="date" required value={l5Form.dataInicio} onChange={(e) => setL5Form({ ...l5Form, dataInicio: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700 mb-1">Proceso (Art. 10.4)</label>
                  <input type="text" required value={l5Form.procesoCodigo} onChange={(e) => setL5Form({ ...l5Form, procesoCodigo: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Partida · Envases</label>
                  <input type="text" required value={l5Form.partidaIdenEnvases} onChange={(e) => setL5Form({ ...l5Form, partidaIdenEnvases: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Partida · Produto</label>
                  <input type="text" required value={l5Form.partidaProduto} onChange={(e) => setL5Form({ ...l5Form, partidaProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros Utilizados</label>
                  <input type="number" step="0.01" required value={l5Form.partidaLitrosUtilizados} onChange={(e) => setL5Form({ ...l5Form, partidaLitrosUtilizados: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grad / Densidade</label>
                  <input type="text" value={l5Form.partidaGradDensidade} onChange={(e) => setL5Form({ ...l5Form, partidaGradDensidade: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Incorporado · Produto</label>
                  <input type="text" value={l5Form.incorporadoProduto} onChange={(e) => setL5Form({ ...l5Form, incorporadoProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Incorp. Grad / Dens.</label>
                  <input type="text" value={l5Form.incorporadoGradDensidade} onChange={(e) => setL5Form({ ...l5Form, incorporadoGradDensidade: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Incorp. Cant. (L/Kg)</label>
                  <input type="text" value={l5Form.incorporadoCantidadeLKg} onChange={(e) => setL5Form({ ...l5Form, incorporadoCantidadeLKg: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Final · Envases</label>
                  <input type="text" required value={l5Form.finalIdenEnvases} onChange={(e) => setL5Form({ ...l5Form, finalIdenEnvases: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Final · Produto</label>
                  <input type="text" required value={l5Form.finalProduto} onChange={(e) => setL5Form({ ...l5Form, finalProduto: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Litros Obtidos</label>
                  <input type="number" step="0.01" required value={l5Form.finalLitrosObtidos} onChange={(e) => setL5Form({ ...l5Form, finalLitrosObtidos: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grad. Adq</label>
                  <input type="text" value={l5Form.finalGradAdq} onChange={(e) => setL5Form({ ...l5Form, finalGradAdq: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grad. Total</label>
                  <input type="text" value={l5Form.finalGradTotal} onChange={(e) => setL5Form({ ...l5Form, finalGradTotal: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl tabular-nums" />
                </div>
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Observacións</label>
                <input type="text" value={l5Form.observacions} onChange={(e) => setL5Form({ ...l5Form, observacions: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-xl" />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200">
                <button type="button" onClick={() => setIsL5ModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-900 text-white font-semibold cursor-pointer">
                  Gardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

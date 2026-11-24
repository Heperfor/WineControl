import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BodegaConfig,
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
import { getLocalIsoDate } from './dateUtils';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const formatFechaEs = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

const fmtOpt = (n?: number) => (n !== undefined && n !== null && n !== 0 ? String(n) : '');

// ============================================================================
// LIBRO 1: REXISTRO DE ENTRADAS E SAÍDAS
// ============================================================================
export const exportMedioRuralL1Excel = (
  entradas: MedioRuralEntradaRegistro[],
  salidas: MedioRuralSalidaRegistro[],
  sumaEnt: MedioRuralEntradaSalidaSuma,
  sumaSal: MedioRuralEntradaSalidaSuma,
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();

  const entSheet = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE REXISTRO DE ENTRADAS · MEDIO RURAL · ${config.nombreBodega} (${config.cifNif})`],
    [
      'DATA',
      'DOCUMENTO DE ACOMPAÑAMENTO',
      '',
      'PROCEDENCIA',
      'ZONA VITÍCOLA',
      'MOSTO DE UVA FRESCA',
      '',
      'VIÑOS DE (1)',
      '',
      'OUTROS PRODUCTOS',
      '',
      'GRADUACIÓN ALCOHÓLICA',
      '',
      'OBSERVACIÓNS (6)',
    ],
    [
      '',
      'Clase (2)',
      'Número (3)',
      '',
      '',
      'Brancos',
      'Tintos',
      'Brancos',
      'Tintos',
      'Design.',
      'Cantidade',
      'A (4)',
      'T (5)',
      '',
    ],
    [
      'SUMA ANTERIOR',
      '',
      '',
      '',
      '',
      sumaEnt.mostoBrancos || 0,
      sumaEnt.mostoTintos || 0,
      sumaEnt.vinoBrancos || 0,
      sumaEnt.vinoTintos || 0,
      '',
      '',
      '',
      '',
      '',
    ],
    ...entradas.map((r) => [
      formatFechaEs(r.data),
      r.docClase,
      r.docNumero,
      r.procedencia,
      r.zonaViticola,
      r.mostoBrancos ?? '',
      r.mostoTintos ?? '',
      r.vinoBrancos ?? '',
      r.vinoTintos ?? '',
      r.outrosDesignacion || '',
      r.outrosCantidade || '',
      r.graduacionAdquirida ?? '',
      r.graduacionTotal ?? '',
      r.observacions,
    ]),
    [
      'SUMA E SEGUE',
      '',
      '',
      '',
      '',
      (sumaEnt.mostoBrancos || 0) + entradas.reduce((s, r) => s + (r.mostoBrancos || 0), 0),
      (sumaEnt.mostoTintos || 0) + entradas.reduce((s, r) => s + (r.mostoTintos || 0), 0),
      (sumaEnt.vinoBrancos || 0) + entradas.reduce((s, r) => s + (r.vinoBrancos || 0), 0),
      (sumaEnt.vinoTintos || 0) + entradas.reduce((s, r) => s + (r.vinoTintos || 0), 0),
      '',
      '',
      '',
      '',
      '',
    ],
  ]);

  const salSheet = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE REXISTRO DE SAÍDAS · MEDIO RURAL · ${config.nombreBodega} (${config.cifNif})`],
    [
      'DATA',
      'DOCUMENTO DE ACOMPAÑAMENTO',
      '',
      'DESTINO',
      'ZONA VITÍCOLA',
      'MOSTO DE UVA FRESCA',
      '',
      'VIÑOS DE (1)',
      '',
      'OUTROS PRODUCTOS',
      '',
      'GRADUACIÓN ALCOHÓLICA',
      '',
      'OBSERVACIÓNS (6)',
    ],
    [
      '',
      'Clase (2)',
      'Nº oficial de Referencia (3)',
      '',
      '',
      'Brancos',
      'Tintos',
      'Brancos',
      'Tintos',
      'Design.',
      'Cantidade',
      'A (4)',
      'T (5)',
      '',
    ],
    [
      'SUMA ANTERIOR',
      '',
      '',
      '',
      '',
      sumaSal.mostoBrancos || 0,
      sumaSal.mostoTintos || 0,
      sumaSal.vinoBrancos || 0,
      sumaSal.vinoTintos || 0,
      '',
      '',
      '',
      '',
      '',
    ],
    ...salidas.map((r) => [
      formatFechaEs(r.data),
      r.docClase,
      r.docNumeroReferencia,
      r.destino,
      r.zonaViticola,
      r.mostoBrancos ?? '',
      r.mostoTintos ?? '',
      r.vinoBrancos ?? '',
      r.vinoTintos ?? '',
      r.outrosDesignacion || '',
      r.outrosCantidade || '',
      r.graduacionAdquirida ?? '',
      r.graduacionTotal ?? '',
      r.observacions,
    ]),
    [
      'SUMA E SEGUE',
      '',
      '',
      '',
      '',
      (sumaSal.mostoBrancos || 0) + salidas.reduce((s, r) => s + (r.mostoBrancos || 0), 0),
      (sumaSal.mostoTintos || 0) + salidas.reduce((s, r) => s + (r.mostoTintos || 0), 0),
      (sumaSal.vinoBrancos || 0) + salidas.reduce((s, r) => s + (r.vinoBrancos || 0), 0),
      (sumaSal.vinoTintos || 0) + salidas.reduce((s, r) => s + (r.vinoTintos || 0), 0),
      '',
      '',
      '',
      '',
      '',
    ],
  ]);

  XLSX.utils.book_append_sheet(wb, entSheet, 'Pág 1 - Entradas');
  XLSX.utils.book_append_sheet(wb, salSheet, 'Pág 2 - Saídas');
  XLSX.writeFile(wb, `MedioRural_Libro1_Entradas_Saidas_${getLocalIsoDate()}.xlsx`);
};

export const exportMedioRuralL1PDF = (
  entradas: MedioRuralEntradaRegistro[],
  salidas: MedioRuralSalidaRegistro[],
  sumaEnt: MedioRuralEntradaSalidaSuma,
  sumaSal: MedioRuralEntradaSalidaSuma,
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE REXISTRO DE ENTRADAS · MEDIO RURAL (XUNTA DE GALICIA)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif} · RE: ${config.numeroRegistroVitivinicola}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'DOC. ACOMPAÑAMENTO', colSpan: 2 },
        { content: 'PROCEDENCIA', rowSpan: 2 },
        { content: 'ZONA\nVITÍCOLA', rowSpan: 2 },
        { content: 'MOSTO DE UVA FRESCA', colSpan: 2 },
        { content: 'VIÑOS DE (1)', colSpan: 2 },
        { content: 'OUTROS PROD.', colSpan: 2 },
        { content: 'GRADUACIÓN', colSpan: 2 },
        { content: 'OBSERVACIÓNS (6)', rowSpan: 2 },
      ],
      ['Clase (2)', 'Número (3)', 'Brancos', 'Tintos', 'Brancos', 'Tintos', 'Design.', 'Cant.', 'A (4)', 'T (5)'],
    ],
    body: [
      ['SUMA ANTERIOR', '', '', '', '', fmtOpt(sumaEnt.mostoBrancos), fmtOpt(sumaEnt.mostoTintos), fmtOpt(sumaEnt.vinoBrancos), fmtOpt(sumaEnt.vinoTintos), '', '', '', '', ''],
      ...entradas.map((r) => [
        formatFechaEs(r.data),
        r.docClase,
        r.docNumero,
        r.procedencia,
        r.zonaViticola,
        fmtOpt(r.mostoBrancos),
        fmtOpt(r.mostoTintos),
        fmtOpt(r.vinoBrancos),
        fmtOpt(r.vinoTintos),
        r.outrosDesignacion || '',
        r.outrosCantidade || '',
        r.graduacionAdquirida !== undefined ? String(r.graduacionAdquirida).replace('.', ',') : '',
        r.graduacionTotal !== undefined ? String(r.graduacionTotal).replace('.', ',') : '',
        r.observacions,
      ]),
      [
        'SUMA E SEGUE',
        '',
        '',
        '',
        '',
        String((sumaEnt.mostoBrancos || 0) + entradas.reduce((s, r) => s + (r.mostoBrancos || 0), 0)),
        String((sumaEnt.mostoTintos || 0) + entradas.reduce((s, r) => s + (r.mostoTintos || 0), 0)),
        String((sumaEnt.vinoBrancos || 0) + entradas.reduce((s, r) => s + (r.vinoBrancos || 0), 0)),
        String((sumaEnt.vinoTintos || 0) + entradas.reduce((s, r) => s + (r.vinoTintos || 0), 0)),
        '',
        '',
        '',
        '',
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE REXISTRO DE SAÍDAS · FOLIO Nº 001 (MEDIO RURAL)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif} · RE: ${config.numeroRegistroVitivinicola}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'DOC. ACOMPAÑAMENTO', colSpan: 2 },
        { content: 'DESTINO', rowSpan: 2 },
        { content: 'ZONA\nVITÍCOLA', rowSpan: 2 },
        { content: 'MOSTO DE UVA FRESCA', colSpan: 2 },
        { content: 'VIÑOS DE (1)', colSpan: 2 },
        { content: 'OUTROS PROD.', colSpan: 2 },
        { content: 'GRADUACIÓN', colSpan: 2 },
        { content: 'OBSERVACIÓNS (6)', rowSpan: 2 },
      ],
      ['Clase (2)', 'Nº Ref. (3)', 'Brancos', 'Tintos', 'Brancos', 'Tintos', 'Design.', 'Cant.', 'A (4)', 'T (5)'],
    ],
    body: [
      ['SUMA ANTERIOR', '', '', '', '', fmtOpt(sumaSal.mostoBrancos), fmtOpt(sumaSal.mostoTintos), fmtOpt(sumaSal.vinoBrancos), fmtOpt(sumaSal.vinoTintos), '', '', '', '', ''],
      ...salidas.map((r) => [
        formatFechaEs(r.data),
        r.docClase,
        r.docNumeroReferencia,
        r.destino,
        r.zonaViticola,
        fmtOpt(r.mostoBrancos),
        fmtOpt(r.mostoTintos),
        fmtOpt(r.vinoBrancos),
        fmtOpt(r.vinoTintos),
        r.outrosDesignacion || '',
        r.outrosCantidade || '',
        r.graduacionAdquirida !== undefined ? String(r.graduacionAdquirida).replace('.', ',') : '',
        r.graduacionTotal !== undefined ? String(r.graduacionTotal).replace('.', ',') : '',
        r.observacions,
      ]),
      [
        'SUMA E SEGUE',
        '',
        '',
        '',
        '',
        String((sumaSal.mostoBrancos || 0) + salidas.reduce((s, r) => s + (r.mostoBrancos || 0), 0)),
        String((sumaSal.mostoTintos || 0) + salidas.reduce((s, r) => s + (r.mostoTintos || 0), 0)),
        String((sumaSal.vinoBrancos || 0) + salidas.reduce((s, r) => s + (r.vinoBrancos || 0), 0)),
        String((sumaSal.vinoTintos || 0) + salidas.reduce((s, r) => s + (r.vinoTintos || 0), 0)),
        '',
        '',
        '',
        '',
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.save(`MedioRural_Libro1_Entradas_Saidas_${getLocalIsoDate()}.pdf`);
};

// ============================================================================
// LIBRO 2: EMBOTELLADOS
// ============================================================================
export const exportMedioRuralL2Excel = (
  entradas: MedioRuralEmbotelladoEntradaRegistro[],
  salidas: MedioRuralEmbotelladoSalidaRegistro[],
  sumaAnt: MedioRuralEmbotelladoSumaAnterior,
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();

  const entSheet = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE EMBOTELLADOS - ENTRADAS · MEDIO RURAL · ${config.nombreBodega}`],
    ['DATA', 'DESIGNACIÓN PRODUTO (cor, grao, variedade, ano colleita)', 'LITROS', 'Nº BOTELLAS', 'Referencia numeración precintas', 'Lote', 'Embotellado por encargo (Nome)', 'Embotellado por encargo (Enderezo)'],
    ['SUMA ANTERIOR', '', sumaAnt.entradasLitros || 0, sumaAnt.entradasBotellas || 0, '', '', '', ''],
    ...entradas.map((r) => [
      formatFechaEs(r.data),
      r.designacionProduto,
      r.litros,
      r.numBotellas,
      r.referenciaPrecintas,
      r.lote,
      r.encargoNomeEmbotellador,
      r.encargoEnderezo,
    ]),
    [
      'SUMA E SEGUE',
      '',
      (sumaAnt.entradasLitros || 0) + entradas.reduce((s, r) => s + (r.litros || 0), 0),
      (sumaAnt.entradasBotellas || 0) + entradas.reduce((s, r) => s + (r.numBotellas || 0), 0),
      '',
      '',
      '',
      '',
    ],
  ]);

  const salSheet = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE EMBOTELLADOS - SAÍDAS · MEDIO RURAL · ${config.nombreBodega}`],
    ['DATA', 'DOCUMENTO ACOMPAÑAMENTO OU COMERCIAL', 'LITROS', 'OBSERVACIÓNS'],
    ['SUMA ANTERIOR', '', sumaAnt.saidasLitros || 0, ''],
    ...salidas.map((r) => [formatFechaEs(r.data), r.documentoComercial, r.litros, r.observacions]),
    ['SUMA E SEGUE', '', (sumaAnt.saidasLitros || 0) + salidas.reduce((s, r) => s + (r.litros || 0), 0), ''],
  ]);

  XLSX.utils.book_append_sheet(wb, entSheet, 'Pág 1 - Entradas');
  XLSX.utils.book_append_sheet(wb, salSheet, 'Pág 2 - Saídas');
  XLSX.writeFile(wb, `MedioRural_Libro2_Embotellados_${getLocalIsoDate()}.xlsx`);
};

export const exportMedioRuralL2PDF = (
  entradas: MedioRuralEmbotelladoEntradaRegistro[],
  salidas: MedioRuralEmbotelladoSalidaRegistro[],
  sumaAnt: MedioRuralEmbotelladoSumaAnterior,
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE EMBOTELLADOS · PÁGINA 1: ENTRADAS (MEDIO RURAL)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'DESIGNACIÓN PRODUTO\n(cor, grao, variedade, ano colleita)', rowSpan: 2 },
        { content: 'LITROS', rowSpan: 2 },
        { content: 'Nº BOTELLAS', rowSpan: 2 },
        { content: 'Ref. numeración\nprecintas', rowSpan: 2 },
        { content: 'Lote', rowSpan: 2 },
        { content: 'Embotellado por encargo', colSpan: 2 },
      ],
      ['Nome Embotellador', 'Enderezo'],
    ],
    body: [
      ['SUMA ANTERIOR', '', fmtOpt(sumaAnt.entradasLitros), fmtOpt(sumaAnt.entradasBotellas), '', '', '', ''],
      ...entradas.map((r) => [
        formatFechaEs(r.data),
        r.designacionProduto,
        String(r.litros),
        String(r.numBotellas),
        r.referenciaPrecintas,
        r.lote,
        r.encargoNomeEmbotellador,
        r.encargoEnderezo,
      ]),
      [
        'SUMA E SEGUE',
        '',
        String((sumaAnt.entradasLitros || 0) + entradas.reduce((s, r) => s + (r.litros || 0), 0)),
        String((sumaAnt.entradasBotellas || 0) + entradas.reduce((s, r) => s + (r.numBotellas || 0), 0)),
        '',
        '',
        '',
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 7, halign: 'center', valign: 'middle' },
    styles: { fontSize: 7, cellPadding: 1.6 },
  });

  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE EMBOTELLADOS · PÁGINA 2: SAÍDAS EMBOTELLADOS · FOLIO Nº 001', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [['DATA', 'DOCUMENTO ACOMPAÑAMENTO OU COMERCIAL', 'LITROS', 'OBSERVACIÓNS']],
    body: [
      ['SUMA ANTERIOR', '', fmtOpt(sumaAnt.saidasLitros), ''],
      ...(salidas.length > 0
        ? salidas.map((r) => [formatFechaEs(r.data), r.documentoComercial, String(r.litros), r.observacions])
        : [['-', 'Sin saídas embotelladas rexistradas', '', '']]),
      ['SUMA E SEGUE', '', String((sumaAnt.saidasLitros || 0) + salidas.reduce((s, r) => s + (r.litros || 0), 0)), ''],
    ],
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 7, halign: 'center', valign: 'middle' },
    styles: { fontSize: 7, cellPadding: 1.6 },
  });

  doc.save(`MedioRural_Libro2_Embotellados_${getLocalIsoDate()}.pdf`);
};

// ============================================================================
// LIBRO 3: MOVEMENTOS DE PRODUTOS PARA ELABORACIÓN E PRÁCTICAS ENOLÓXICAS
// ============================================================================
export const exportMedioRuralL3Excel = (
  rows: MedioRuralMovimientoProductoRegistro[],
  sumaAnt: MedioRuralMovProductoSumaAnterior,
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`LIBRO MOVEMENTOS PRODUTOS ELABORACIÓN E PRÁCTICAS ENOLÓXICAS · ${config.nombreBodega}`],
    [
      'DATA',
      'PROCEDENCIA (Razón Social)',
      'PROCEDENCIA (Enderezo)',
      'DESTINO (Razón Social)',
      'DESTINO (Enderezo)',
      'DOCUMENTO OU FACTURA',
      'ÁCIDO TARTÁRICO (Entrada Kg)',
      'ÁCIDO TARTÁRICO (Saída Kg)',
      'MOSTO CONC. (Concentración)',
      'MOSTO CONC. (Entrada L)',
      'MOSTO CONC. (Saída L)',
      'ALCOHOL (Tipo e Grao)',
      'ALCOHOL (Entrada L)',
      'ALCOHOL (Saída L)',
      'SACAROSA (Entrada Kg)',
      'SACAROSA (Saída Kg)',
      'OUTROS (Produto)',
      'OUTROS (Grad./Conc.)',
      'OUTROS (Entrada L/Kg)',
      'OUTROS (Saída L/Kg)',
    ],
    [
      'SUMA ANTERIOR',
      '',
      '',
      '',
      '',
      '',
      sumaAnt.acidoTartaricoEntradaKg || 0,
      sumaAnt.acidoTartaricoSaidaKg || 0,
      '',
      sumaAnt.mostoConcEntradaLitros || 0,
      sumaAnt.mostoConcSaidaLitros || 0,
      '',
      sumaAnt.alcoholEntradaLitros || 0,
      sumaAnt.alcoholSaidaLitros || 0,
      sumaAnt.sacarosaEntradaKg || 0,
      sumaAnt.sacarosaSaidaKg || 0,
      '',
      '',
      sumaAnt.outrosEntradaLitroKg || 0,
      sumaAnt.outrosSaidaLitroKg || 0,
    ],
    ...rows.map((r) => [
      formatFechaEs(r.data),
      r.procedenciaRazonSocial,
      r.procedenciaEnderezo,
      r.destinoRazonSocial,
      r.destinoEnderezo,
      r.documentoFactura,
      r.acidoTartaricoEntradaKg ?? '',
      r.acidoTartaricoSaidaKg ?? '',
      r.mostoConcConcentracion,
      r.mostoConcEntradaLitros ?? '',
      r.mostoConcSaidaLitros ?? '',
      r.alcoholTipoGrao,
      r.alcoholEntradaLitros ?? '',
      r.alcoholSaidaLitros ?? '',
      r.sacarosaEntradaKg ?? '',
      r.sacarosaSaidaKg ?? '',
      r.outrosProduto,
      r.outrosGradConcentracion,
      r.outrosEntradaLitroKg ?? '',
      r.outrosSaidaLitroKg ?? '',
    ]),
    [
      'SUMA E SEGUE',
      '',
      '',
      '',
      '',
      '',
      round3((sumaAnt.acidoTartaricoEntradaKg || 0) + rows.reduce((s, r) => s + (r.acidoTartaricoEntradaKg || 0), 0)),
      round3((sumaAnt.acidoTartaricoSaidaKg || 0) + rows.reduce((s, r) => s + (r.acidoTartaricoSaidaKg || 0), 0)),
      '',
      round2((sumaAnt.mostoConcEntradaLitros || 0) + rows.reduce((s, r) => s + (r.mostoConcEntradaLitros || 0), 0)),
      round2((sumaAnt.mostoConcSaidaLitros || 0) + rows.reduce((s, r) => s + (r.mostoConcSaidaLitros || 0), 0)),
      '',
      round2((sumaAnt.alcoholEntradaLitros || 0) + rows.reduce((s, r) => s + (r.alcoholEntradaLitros || 0), 0)),
      round2((sumaAnt.alcoholSaidaLitros || 0) + rows.reduce((s, r) => s + (r.alcoholSaidaLitros || 0), 0)),
      round3((sumaAnt.sacarosaEntradaKg || 0) + rows.reduce((s, r) => s + (r.sacarosaEntradaKg || 0), 0)),
      round3((sumaAnt.sacarosaSaidaKg || 0) + rows.reduce((s, r) => s + (r.sacarosaSaidaKg || 0), 0)),
      '',
      '',
      round3((sumaAnt.outrosEntradaLitroKg || 0) + rows.reduce((s, r) => s + (r.outrosEntradaLitroKg || 0), 0)),
      round3((sumaAnt.outrosSaidaLitroKg || 0) + rows.reduce((s, r) => s + (r.outrosSaidaLitroKg || 0), 0)),
    ],
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Mov. Produtos Enol.');
  XLSX.writeFile(wb, `MedioRural_Libro3_Mov_Produtos_${getLocalIsoDate()}.xlsx`);
};

export const exportMedioRuralL3PDF = (
  rows: MedioRuralMovimientoProductoRegistro[],
  sumaAnt: MedioRuralMovProductoSumaAnterior,
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO MOVEMENTOS DE PRODUTOS · PÁGINA 1 (MEDIO RURAL)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'PROCEDENCIA', colSpan: 2 },
        { content: 'DESTINO', colSpan: 2 },
        { content: 'DOCUMENTO OU\nFACTURA', rowSpan: 2 },
        { content: 'ÁCIDO TARTÁRICO', colSpan: 2 },
      ],
      ['Razón Social', 'Enderezo', 'Razón Social', 'Enderezo', 'Entrada Kg.', 'Saída Kg.'],
    ],
    body: [
      ['SUMA ANTERIOR', '', '', '', '', '', fmtOpt(sumaAnt.acidoTartaricoEntradaKg), fmtOpt(sumaAnt.acidoTartaricoSaidaKg)],
      ...rows.map((r) => [
        formatFechaEs(r.data),
        r.procedenciaRazonSocial,
        r.procedenciaEnderezo,
        r.destinoRazonSocial,
        r.destinoEnderezo,
        r.documentoFactura,
        fmtOpt(r.acidoTartaricoEntradaKg),
        fmtOpt(r.acidoTartaricoSaidaKg),
      ]),
    ],
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO MOVEMENTOS DE PRODUTOS · PÁGINA 2 · FOLIO Nº 001', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'MOSTO CONCENTRADO', colSpan: 3 },
        { content: 'ALCOHOL', colSpan: 3 },
        { content: 'SACAROSA', colSpan: 2 },
        { content: 'OUTROS PRODUTOS (2)', colSpan: 4 },
      ],
      ['Conc.', 'Ent. L', 'Saída L', 'Tipo/Grao', 'Ent. L', 'Saída L', 'Ent. Kg', 'Saída Kg', 'PRODUTO', 'Grad/Conc.', 'Ent. L/Kg', 'Saída L/Kg'],
    ],
    body: rows.map((r) => [
      formatFechaEs(r.data),
      r.mostoConcConcentracion,
      fmtOpt(r.mostoConcEntradaLitros),
      fmtOpt(r.mostoConcSaidaLitros),
      r.alcoholTipoGrao,
      fmtOpt(r.alcoholEntradaLitros),
      fmtOpt(r.alcoholSaidaLitros),
      fmtOpt(r.sacarosaEntradaKg),
      fmtOpt(r.sacarosaSaidaKg),
      r.outrosProduto,
      r.outrosGradConcentracion,
      fmtOpt(r.outrosEntradaLitroKg),
      fmtOpt(r.outrosSaidaLitroKg),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6, cellPadding: 1.3 },
  });

  doc.save(`MedioRural_Libro3_Mov_Produtos_${getLocalIsoDate()}.pdf`);
};

// ============================================================================
// LIBRO 4: PRÁCTICAS ENOLÓXICAS
// ============================================================================
export const exportMedioRuralL4Excel = (
  rows: MedioRuralPracticaEnologicaRegistro[],
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE PRÁCTICAS ENOLÓXICAS · MEDIO RURAL · ${config.nombreBodega}`],
    [
      'DATA',
      'PARTIDA - Iden. Envases',
      'PARTIDA - PRODUTO',
      'PARTIDA - Litros Utilizados',
      'PARTIDA - Grad (1)',
      'PARTIDA - Grad (2)',
      'PARTIDA - Acidez Tartárico g/l',
      'SULFITADO - PRODUTO',
      'SULFITADO - Dose g/l',
      'SULFITADO - Cantidade Kg',
      'ACID/DESACID - PRODUTO',
      'ACID/DESACID - Doses g/l',
      'ACID/DESACID - Cantidade Kg',
      'OUTRAS PRÁCTICAS - PRODUTO',
      'OUTRAS PRÁCTICAS - Grad/Densidade',
      'OUTRAS PRÁCTICAS - Cantidade Kg o l',
      'FINAL - Iden. Envases',
      'FINAL - PRODUTO',
      'FINAL - Litros Obtidos',
      'FINAL - Grad (1)',
      'FINAL - Grad (2)',
      'FINAL - Acidez g/l',
      'OBSERVACIÓNS',
    ],
    ...rows.map((r) => [
      formatFechaEs(r.data),
      r.partidaIdenEnvases,
      r.partidaProduto,
      r.partidaLitrosUtilizados,
      r.partidaGraduacionAdq ?? '',
      r.partidaGraduacionTotal ?? '',
      r.partidaAcidezTotalGl ?? '',
      r.sulfitadoProduto,
      r.sulfitadoDoseGl ?? '',
      r.sulfitadoCantidadeKg ?? '',
      r.acidProduto,
      r.acidDosesGl ?? '',
      r.acidCantidadeKg ?? '',
      r.outrasProduto,
      r.outrasGradDensidade,
      r.outrasCantidadeKgOL,
      r.finalIdenEnvases,
      r.finalProduto,
      r.finalLitrosObtidos,
      r.finalGraduacionAdq ?? '',
      r.finalGraduacionTotal ?? '',
      r.finalAcidezGl ?? '',
      r.observacions,
    ]),
    [
      'SUMA E SEGUE',
      '',
      '',
      round2(rows.reduce((s, r) => s + (r.partidaLitrosUtilizados || 0), 0)),
      '',
      '',
      '',
      '',
      '',
      round3(rows.reduce((s, r) => s + (r.sulfitadoCantidadeKg || 0), 0)),
      '',
      '',
      round3(rows.reduce((s, r) => s + (r.acidCantidadeKg || 0), 0)),
      '',
      '',
      '',
      '',
      '',
      round2(rows.reduce((s, r) => s + (r.finalLitrosObtidos || 0), 0)),
      '',
      '',
      '',
      '',
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Prácticas Enolóxicas');
  XLSX.writeFile(wb, `MedioRural_Libro4_Practicas_Enoloxicas_${getLocalIsoDate()}.xlsx`);
};

export const exportMedioRuralL4PDF = (
  rows: MedioRuralPracticaEnologicaRegistro[],
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PRÁCTICAS ENOLÓXICAS · PÁGINA 1 (MEDIO RURAL)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'PRODUTO DE PARTIDA', colSpan: 7 },
        { content: 'PRÁCTICA ENOLÓXICA: SULFITADO', colSpan: 3 },
        { content: 'ACIDIFICACIÓN / DESACIDIFICACIÓN', colSpan: 3 },
      ],
      ['DATA', 'Iden. Env.', 'PRODUTO', 'Litros', 'Grad(1)', 'Grad(2)', 'Acidez g/l', 'PRODUTO', 'Dose g/l', 'Cant. Kg', 'PRODUTO', 'Doses g/l', 'Cant. Kg'],
    ],
    body: rows.map((r) => [
      formatFechaEs(r.data),
      r.partidaIdenEnvases,
      r.partidaProduto,
      String(r.partidaLitrosUtilizados),
      fmtOpt(r.partidaGraduacionAdq),
      fmtOpt(r.partidaGraduacionTotal),
      fmtOpt(r.partidaAcidezTotalGl),
      r.sulfitadoProduto,
      fmtOpt(r.sulfitadoDoseGl),
      fmtOpt(r.sulfitadoCantidadeKg),
      r.acidProduto,
      fmtOpt(r.acidDosesGl),
      fmtOpt(r.acidCantidadeKg),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6, cellPadding: 1.3 },
  });

  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PRÁCTICAS ENOLÓXICAS · PÁGINA 2 · FOLIO Nº 001', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATA', rowSpan: 2 },
        { content: 'OUTRAS PRÁCTICAS ENOLÓXICAS', colSpan: 3 },
        { content: 'PRODUTO FINAL', colSpan: 6 },
        { content: 'OBSERVACIÓNS\n(Data saída lib. Rexistro)', rowSpan: 2 },
      ],
      ['PRODUTO', 'Grad/Dens.', 'Cant. Kg/l', 'Iden. Env.', 'PRODUTO', 'Litros', 'Grad(1)', 'Grad(2)', 'Acidez g/l'],
    ],
    body: rows.map((r) => [
      formatFechaEs(r.data),
      r.outrasProduto,
      r.outrasGradDensidade,
      r.outrasCantidadeKgOL,
      r.finalIdenEnvases,
      r.finalProduto,
      String(r.finalLitrosObtidos),
      fmtOpt(r.finalGraduacionAdq),
      fmtOpt(r.finalGraduacionTotal),
      fmtOpt(r.finalAcidezGl),
      r.observacions,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6, cellPadding: 1.3 },
  });

  doc.save(`MedioRural_Libro4_Practicas_Enoloxicas_${getLocalIsoDate()}.pdf`);
};

// ============================================================================
// LIBRO 5: PROCESOS DE ELABORACIÓN
// ============================================================================
export const exportMedioRuralL5Excel = (
  rows: MedioRuralProcesoElaboracionRegistro[],
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE PROCESOS DE ELABORACIÓN · MEDIO RURAL · ${config.nombreBodega}`],
    [
      'NUM.',
      'DATA INICIO',
      'PROCESO (1)',
      'PARTIDA - Iden. Envases',
      'PARTIDA - PRODUTO',
      'PARTIDA - Litros utilizados',
      'PARTIDA - Grad/Densidade',
      'INCORPORADO - PRODUTO',
      'INCORPORADO - Grad/Densidade',
      'INCORPORADO - Cantidade L/Kg',
      'FINAL - Iden. Envases',
      'FINAL - PRODUTO',
      'FINAL - Litros obtidos',
      'FINAL - Grad. Adq',
      'FINAL - Grad. Total',
      'OBSERVACIÓNS',
    ],
    ...rows.map((r) => [
      r.num,
      formatFechaEs(r.dataInicio),
      r.procesoCodigo,
      r.partidaIdenEnvases,
      r.partidaProduto,
      r.partidaLitrosUtilizados,
      r.partidaGradDensidade,
      r.incorporadoProduto,
      r.incorporadoGradDensidade,
      r.incorporadoCantidadeLKg,
      r.finalIdenEnvases,
      r.finalProduto,
      r.finalLitrosObtidos,
      r.finalGradAdq ?? '',
      r.finalGradTotal ?? '',
      r.observacions,
    ]),
    [
      'SUMA E SEGUE',
      '',
      '',
      '',
      '',
      round2(rows.reduce((s, r) => s + (r.partidaLitrosUtilizados || 0), 0)),
      '',
      '',
      '',
      '',
      '',
      '',
      round2(rows.reduce((s, r) => s + (r.finalLitrosObtidos || 0), 0)),
      '',
      '',
      '',
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Procesos Elaboración');
  XLSX.writeFile(wb, `MedioRural_Libro5_Procesos_Elaboracion_${getLocalIsoDate()}.xlsx`);
};

export const exportMedioRuralL5PDF = (
  rows: MedioRuralProcesoElaboracionRegistro[],
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PROCESOS DE ELABORACIÓN · PÁGINA 1 (MEDIO RURAL)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'NUM.', rowSpan: 2 },
        { content: 'PROCESO TRANSFORMACIÓN', colSpan: 2 },
        { content: 'PRODUTO DE PARTIDA', colSpan: 4 },
        { content: 'PRODUTO INCORPORADO', rowSpan: 2 },
      ],
      ['DATA INICIO', 'PROCESO (1)', 'Iden. envases', 'PRODUTO', 'Litros util.', 'Grad/Dens.'],
    ],
    body: rows.map((r) => [
      String(r.num),
      formatFechaEs(r.dataInicio),
      r.procesoCodigo,
      r.partidaIdenEnvases,
      r.partidaProduto,
      String(r.partidaLitrosUtilizados),
      r.partidaGradDensidade,
      r.incorporadoProduto,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PROCESOS DE ELABORACIÓN · PÁGINA 2 · FOLIO Nº 001', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF: ${config.cifNif}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'NUM.', rowSpan: 2 },
        { content: 'PRODUTO INCORPORADO', colSpan: 2 },
        { content: 'PRODUTO FINAL', colSpan: 5 },
        { content: 'OBSERVACIÓNS\n(Data saída lib. Rexistro)', rowSpan: 2 },
      ],
      ['Grad/Dens.', 'Cant. L/Kg', 'Iden. envases', 'PRODUTO', 'Litros obt.', 'Grad. Adq', 'Grad. Total'],
    ],
    body: rows.map((r) => [
      String(r.num),
      r.incorporadoGradDensidade,
      r.incorporadoCantidadeLKg,
      r.finalIdenEnvases,
      r.finalProduto,
      String(r.finalLitrosObtidos),
      fmtOpt(r.finalGradAdq),
      fmtOpt(r.finalGradTotal),
      r.observacions,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.save(`MedioRural_Libro5_Procesos_Elaboracion_${getLocalIsoDate()}.pdf`);
};

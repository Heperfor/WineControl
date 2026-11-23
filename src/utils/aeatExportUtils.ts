import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  AeatMateriaPrimaRegistro,
  AeatMateriaPrimaSumaAnterior,
  AeatProductoElaboradoRegistro,
  BodegaConfig,
} from '../types/winery';

const formatFechaEs = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

export const exportAeatMateriasPrimasExcel = (
  rows: AeatMateriaPrimaRegistro[],
  sumaAnterior: AeatMateriaPrimaSumaAnterior,
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();

  const headerRow1 = [
    'Nº DE ORDEN',
    'OBSERVACIONES',
    'FECHA',
    'DOC. Nº',
    'NIF O CAE',
    'GRADO',
    'ENTRADAS',
    '',
    '',
    'SALIDAS',
    '',
    '',
    'EXISTENCIAS',
    '',
    '',
  ];
  const headerRow2 = [
    '',
    '',
    '',
    '',
    '',
    '',
    'UVAS (KG)',
    'BAGAZOS (KG)',
    'MOSTO (LITROS)',
    'UVAS (KG)',
    'BAGAZOS (KG)',
    'MOSTO (LITROS)',
    'UVAS (KG)',
    'BAGAZOS (KG)',
    'MOSTO (LITROS)',
  ];

  const sumaAntRow = [
    'SUMA ANTERIOR',
    '',
    '',
    '',
    '',
    '',
    sumaAnterior.entradasUvasKg || 0,
    sumaAnterior.entradasBagazosKg || 0,
    sumaAnterior.entradasMostoLitros || 0,
    sumaAnterior.salidasUvasKg || 0,
    sumaAnterior.salidasBagazosKg || 0,
    sumaAnterior.salidasMostoLitros || 0,
    sumaAnterior.existenciasUvasKg || 0,
    sumaAnterior.existenciasBagazosKg || 0,
    sumaAnterior.existenciasMostoLitros || 0,
  ];

  const dataRows = rows.map((r) => [
    r.numeroOrden,
    r.observaciones,
    formatFechaEs(r.fecha),
    r.docNumero,
    r.nifOCae,
    r.grado ?? '',
    r.entradasUvasKg ?? '',
    r.entradasBagazosKg ?? '',
    r.entradasMostoLitros ?? '',
    r.salidasUvasKg ?? '',
    r.salidasBagazosKg ?? '',
    r.salidasMostoLitros ?? '',
    r.existenciasUvasKg ?? '',
    r.existenciasBagazosKg ?? '',
    r.existenciasMostoLitros ?? '',
  ]);

  const sumField = (fn: (r: AeatMateriaPrimaRegistro) => number | undefined) =>
    rows.reduce((acc, r) => acc + (fn(r) || 0), 0);

  const sumaSigueRow = [
    'SUMA Y SIGUE',
    '',
    '',
    '',
    '',
    '',
    (sumaAnterior.entradasUvasKg || 0) + sumField((r) => r.entradasUvasKg),
    (sumaAnterior.entradasBagazosKg || 0) + sumField((r) => r.entradasBagazosKg),
    (sumaAnterior.entradasMostoLitros || 0) + sumField((r) => r.entradasMostoLitros),
    (sumaAnterior.salidasUvasKg || 0) + sumField((r) => r.salidasUvasKg),
    (sumaAnterior.salidasBagazosKg || 0) + sumField((r) => r.salidasBagazosKg),
    (sumaAnterior.salidasMostoLitros || 0) + sumField((r) => r.salidasMostoLitros),
    (sumaAnterior.existenciasUvasKg || 0) + sumField((r) => r.existenciasUvasKg),
    (sumaAnterior.existenciasBagazosKg || 0) + sumField((r) => r.existenciasBagazosKg),
    (sumaAnterior.existenciasMostoLitros || 0) + sumField((r) => r.existenciasMostoLitros),
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE MATERIAS PRIMAS · AGENCIA TRIBUTARIA (II.EE.) · ${config.nombreBodega} (${config.cifNif})`],
    headerRow1,
    headerRow2,
    sumaAntRow,
    ...dataRows,
    sumaSigueRow,
  ]);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 6 }, e: { r: 1, c: 8 } },
    { s: { r: 1, c: 9 }, e: { r: 1, c: 11 } },
    { s: { r: 1, c: 12 }, e: { r: 1, c: 14 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Libro Materias Primas');
  XLSX.writeFile(wb, `AEAT_Libro_Materias_Primas_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportAeatMateriasPrimasPDF = (
  rows: AeatMateriaPrimaRegistro[],
  sumaAnterior: AeatMateriaPrimaSumaAnterior,
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LIBRO DE MATERIAS PRIMAS · AGENCIA TRIBUTARIA (II.EE.)', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `${config.nombreBodega} · NIF/CIF: ${config.cifNif} · Fecha emisión: ${new Date().toLocaleDateString('es-ES')}`,
    14,
    19.5
  );

  const sumField = (fn: (r: AeatMateriaPrimaRegistro) => number | undefined) =>
    rows.reduce((acc, r) => acc + (fn(r) || 0), 0);

  const fmtOpt = (n?: number) => (n !== undefined && n !== null && n !== 0 ? String(n) : '');

  const body: Array<Array<string>> = [
    [
      'SUMA ANTERIOR',
      '',
      '',
      '',
      '',
      '',
      fmtOpt(sumaAnterior.entradasUvasKg),
      fmtOpt(sumaAnterior.entradasBagazosKg),
      fmtOpt(sumaAnterior.entradasMostoLitros),
      fmtOpt(sumaAnterior.salidasUvasKg),
      fmtOpt(sumaAnterior.salidasBagazosKg),
      fmtOpt(sumaAnterior.salidasMostoLitros),
      fmtOpt(sumaAnterior.existenciasUvasKg),
      fmtOpt(sumaAnterior.existenciasBagazosKg),
      fmtOpt(sumaAnterior.existenciasMostoLitros),
    ],
    ...rows.map((r) => [
      String(r.numeroOrden),
      r.observaciones || '',
      formatFechaEs(r.fecha),
      r.docNumero || '',
      r.nifOCae || '',
      r.grado !== undefined ? String(r.grado).replace('.', ',') : '',
      fmtOpt(r.entradasUvasKg),
      fmtOpt(r.entradasBagazosKg),
      fmtOpt(r.entradasMostoLitros),
      fmtOpt(r.salidasUvasKg),
      fmtOpt(r.salidasBagazosKg),
      fmtOpt(r.salidasMostoLitros),
      fmtOpt(r.existenciasUvasKg),
      fmtOpt(r.existenciasBagazosKg),
      fmtOpt(r.existenciasMostoLitros),
    ]),
    [
      'SUMA Y SIGUE',
      '',
      '',
      '',
      '',
      '',
      String((sumaAnterior.entradasUvasKg || 0) + sumField((r) => r.entradasUvasKg)),
      String((sumaAnterior.entradasBagazosKg || 0) + sumField((r) => r.entradasBagazosKg)),
      String((sumaAnterior.entradasMostoLitros || 0) + sumField((r) => r.entradasMostoLitros)),
      String((sumaAnterior.salidasUvasKg || 0) + sumField((r) => r.salidasUvasKg)),
      String((sumaAnterior.salidasBagazosKg || 0) + sumField((r) => r.salidasBagazosKg)),
      String((sumaAnterior.salidasMostoLitros || 0) + sumField((r) => r.salidasMostoLitros)),
      String((sumaAnterior.existenciasUvasKg || 0) + sumField((r) => r.existenciasUvasKg)),
      String((sumaAnterior.existenciasBagazosKg || 0) + sumField((r) => r.existenciasBagazosKg)),
      String((sumaAnterior.existenciasMostoLitros || 0) + sumField((r) => r.existenciasMostoLitros)),
    ],
  ];

  autoTable(doc, {
    startY: 23,
    head: [
      [
        { content: 'Nº DE\nORDEN', rowSpan: 2 },
        { content: 'OBSERVACIONES', rowSpan: 2 },
        { content: 'FECHA', rowSpan: 2 },
        { content: 'DOC. Nº', rowSpan: 2 },
        { content: 'NIF O CAE', rowSpan: 2 },
        { content: 'GRADO', rowSpan: 2 },
        { content: 'ENTRADAS', colSpan: 3 },
        { content: 'SALIDAS', colSpan: 3 },
        { content: 'EXISTENCIAS', colSpan: 3 },
      ],
      [
        'UVAS\n(KG)',
        'BAGAZOS\n(KG)',
        'MOSTO\n(LITROS)',
        'UVAS\n(KG)',
        'BAGAZOS\n(KG)',
        'MOSTO\n(LITROS)',
        'UVAS\n(KG)',
        'BAGAZOS\n(KG)',
        'MOSTO\n(LITROS)',
      ],
    ],
    body,
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    columnStyles: {
      1: { halign: 'left', cellWidth: 34 },
    },
  });

  doc.save(`AEAT_Libro_Materias_Primas_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportAeatProductoElaboradoExcel = (
  rows: AeatProductoElaboradoRegistro[],
  config: BodegaConfig
) => {
  const wb = XLSX.utils.book_new();

  const headerRow1 = [
    'DATOS MOVIMIENTO',
    '',
    '',
    '',
    'PRODUCTO',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'JUSTIFICANTE',
    '',
    'ENVASES',
    '',
    '',
    'ORIGEN/DESTINO (MOVIMIENTOS EXTERNOS)',
    '',
    '',
    'SALDOS EXISTENCIAS GRANEL',
    '',
    'SALDOS EXISTENCIAS EMBOTELLADO',
    '',
  ];

  const headerRow2 = [
    'Nº ASIENTO',
    'FECHA MOVIMIENTO',
    'TIPO MOVIMIENTO',
    'REGIMEN FISCAL',
    'EPÍGRAFE (3)',
    'CÓDIGO NC',
    'DENOMINACIÓN / DESCRIPCIÓN PRODUCTO',
    'REFERENCIA INTERNA PRODUCTO',
    'VARIEDAD (4)',
    'CANTIDAD DE PRODUCTO',
    'GRADO ALCOHÓLICO',
    'ALCOHOL PURO',
    'TIPO JUSTIF.',
    'NÚMERO JUSTIFICANTE',
    'TIPO ENVASE',
    'CAPACIDAD',
    'Nº ENVASES',
    'NIF',
    'RAZÓN SOCIAL',
    'CAE',
    'BLANCO',
    'TINTO',
    'BLANCO',
    'TINTO',
  ];

  const dataRows = rows.map((r) => [
    r.numeroAsiento,
    formatFechaEs(r.fechaMovimiento),
    r.tipoMovimiento,
    r.regimenFiscal,
    r.epigrafe,
    r.codigoNc,
    r.denominacionProducto,
    r.referenciaInterna,
    r.variedad,
    r.cantidadProducto,
    r.gradoAlcoholico ?? '',
    r.alcoholPuro ?? '',
    r.tipoJustificante,
    r.numeroJustificante,
    r.tipoEnvase,
    r.capacidadEnvase,
    r.numeroEnvases ?? '',
    r.origenDestinoNif,
    r.origenDestinoRazonSocial,
    r.origenDestinoCae,
    r.saldoGranelBlanco ?? '',
    r.saldoGranelTinto ?? '',
    r.saldoEmbotelladoBlanco ?? '',
    r.saldoEmbotelladoTinto ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`LIBRO DE PRODUCTO ELABORADO · AGENCIA TRIBUTARIA (II.EE.) · ${config.nombreBodega} (${config.cifNif})`],
    headerRow1,
    headerRow2,
    ...dataRows,
  ]);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 23 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 11 } },
    { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } },
    { s: { r: 1, c: 14 }, e: { r: 1, c: 16 } },
    { s: { r: 1, c: 17 }, e: { r: 1, c: 19 } },
    { s: { r: 1, c: 20 }, e: { r: 1, c: 21 } },
    { s: { r: 1, c: 22 }, e: { r: 1, c: 23 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Libro Producto Elaborado');
  XLSX.writeFile(wb, `AEAT_Libro_Producto_Elaborado_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportAeatProductoElaboradoPDF = (
  rows: AeatProductoElaboradoRegistro[],
  config: BodegaConfig
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Página 1 del libro (DATOS MOVIMIENTO + PRODUCTO)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PRODUCTO ELABORADO · PÁGINA 1 (DATOS MOVIMIENTO Y PRODUCTO)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF/CIF: ${config.cifNif} · Emisión: ${new Date().toLocaleDateString('es-ES')}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'DATOS MOVIMIENTO', colSpan: 4 },
        { content: 'PRODUCTO', colSpan: 8 },
      ],
      [
        'Nº ASIENTO',
        'FECHA MOV.',
        'TIPO MOVIMIENTO',
        'RÉGIMEN FISCAL',
        'EPÍGRAFE (3)',
        'CÓDIGO NC',
        'DENOMINACIÓN / DESCRIPCIÓN',
        'REF. INTERNA',
        'VARIEDAD (4)',
        'CANTIDAD',
        'GRADO ALC.',
        'ALCOHOL PURO',
      ],
    ],
    body:
      rows.length > 0
        ? rows.map((r) => [
            String(r.numeroAsiento),
            formatFechaEs(r.fechaMovimiento),
            r.tipoMovimiento,
            r.regimenFiscal,
            r.epigrafe,
            r.codigoNc,
            r.denominacionProducto,
            r.referenciaInterna,
            r.variedad,
            String(r.cantidadProducto),
            r.gradoAlcoholico !== undefined ? String(r.gradoAlcoholico).replace('.', ',') : '',
            r.alcoholPuro !== undefined ? String(r.alcoholPuro).replace('.', ',') : '',
          ])
        : [['-', '-', 'Sin asientos registrados', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  // Página 2 del libro (JUSTIFICANTE + ENVASES + ORIGEN/DESTINO + SALDOS EXISTENCIAS)
  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIBRO DE PRODUCTO ELABORADO · PÁGINA 2 (JUSTIFICANTE, ENVASES Y SALDOS EXISTENCIAS)', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.nombreBodega} · NIF/CIF: ${config.cifNif} · Emisión: ${new Date().toLocaleDateString('es-ES')}`, 14, 18);

  autoTable(doc, {
    startY: 22,
    head: [
      [
        { content: 'ASIENTO', rowSpan: 2 },
        { content: 'JUSTIFICANTE', colSpan: 2 },
        { content: 'ENVASES', colSpan: 3 },
        { content: 'ORIGEN/DESTINO (MOVIMIENTOS EXTERNOS)', colSpan: 3 },
        { content: 'SALDOS EXISTENCIAS GRANEL', colSpan: 2 },
        { content: 'SALDOS EXISTENCIAS EMBOTELLADO', colSpan: 2 },
      ],
      [
        'TIPO JUSTIF.',
        'Nº JUSTIF.',
        'TIPO ENVASE',
        'CAPACIDAD',
        'Nº ENVASES',
        'NIF',
        'RAZÓN SOCIAL',
        'CAE',
        'BLANCO',
        'TINTO',
        'BLANCO',
        'TINTO',
      ],
    ],
    body:
      rows.length > 0
        ? rows.map((r) => [
            String(r.numeroAsiento),
            r.tipoJustificante,
            r.numeroJustificante,
            r.tipoEnvase,
            r.capacidadEnvase,
            r.numeroEnvases !== undefined ? String(r.numeroEnvases) : '',
            r.origenDestinoNif,
            r.origenDestinoRazonSocial,
            r.origenDestinoCae,
            r.saldoGranelBlanco !== undefined ? String(r.saldoGranelBlanco) : '',
            r.saldoGranelTinto !== undefined ? String(r.saldoGranelTinto) : '',
            r.saldoEmbotelladoBlanco !== undefined ? String(r.saldoEmbotelladoBlanco) : '',
            r.saldoEmbotelladoTinto !== undefined ? String(r.saldoEmbotelladoTinto) : '',
          ])
        : [['-', '-', 'Sin asientos registrados', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 6.5, halign: 'center', valign: 'middle' },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
  });

  doc.save(`AEAT_Libro_Producto_Elaborado_${new Date().toISOString().slice(0, 10)}.pdf`);
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FoggaMr441bDeclaracion,
  InfoviDeclaracion,
} from '../types/winery';
import {
  FOGGA_CATEGORIAS,
  INFOVI_CATEGORIAS,
  sumFoggaCadroA,
  sumFoggaCadroB,
  sumInfoviCuadroH,
  sumInfoviCuadroI,
  sumInfoviCuadroJ,
  sumInfoviCuadroK,
  sumInfoviJRow,
  sumInfoviSalidaDestinos,
} from './foggaInfoviAutomation';

const formatFechaEs = (iso?: string) => {
  if (!iso) return '-';
  const p = iso.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return iso;
};

const fmt2 = (n?: number) =>
  n !== undefined && n !== null
    ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';

const fmtBlankOr2 = (n?: number) =>
  n !== undefined && n !== null && n !== 0
    ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

// ============================================================================
// PDF OFICIAL: FOGGA MR441B (XUNTA DE GALICIA - ANEXO D: I a)
// ============================================================================

export const exportFoggaMr441bPDF = (dec: FoggaMr441bDeclaracion) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const d = dec.declarante;

  // Cabecera Xunta estilo oficial
  doc.setFillColor(0, 102, 161);
  doc.rect(14, 10, 182, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('XUNTA DE GALICIA · CONSELLERÍA DO MEDIO RURAL', 18, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ANEXO D: I a · DECLARACIÓN DE COLLEITA DE UVA', 18, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MR441B', 173, 18.5);

  // Datos persoa declarante
  doc.setTextColor(30, 41, 59);
  autoTable(doc, {
    startY: 28,
    head: [['DATOS DA PERSOA DECLARANTE', 'NIF', 'TELÉFONO MÓBIL', 'CORREO ELECTRÓNICO']],
    body: [
      [
        `${d.nome} ${d.primeiroApelido} ${d.segundoApelido}`.trim(),
        d.nif,
        d.telefonoMobil || d.telefono || '-',
        d.correoElectronico || '-',
      ],
      [
        `Enderezo: ${[d.tipoVia, d.nomeVia, d.numero ? `nº ${d.numero}` : '', d.andar, d.porta].filter(Boolean).join(' ')}`,
        `CP: ${d.codigoPostal}`,
        `Parroquia/Lugar: ${[d.parroquia, d.lugar].filter(Boolean).join(' · ')}`,
        `${d.concello} (${d.provincia})`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.2 },
  });

  // Campaña y viñedo
  const yAfterDecl = (doc as any).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: yAfterDecl,
    head: [['CAMPAÑA', 'TIPO DECLARACIÓN', 'CODEV', 'CONCELLOS DO VIÑEDO']],
    body: [
      [
        `${dec.campanaInicio} / ${dec.campanaFin}`,
        dec.tipoDeclaracion,
        dec.codev,
        dec.concellos || dec.vinedoSitoEn || '-',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.2 },
  });

  // CADRO A
  const yCadroA = (doc as any).lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CADRO A · SUPERFICIE E UVA COLLEITADA (Cantidades en 100 kg)', 14, yCadroA);

  const totA = sumFoggaCadroA(dec.cadroA);
  autoTable(doc, {
    startY: yCadroA + 2,
    head: [['VIÑEDOS PARA A PRODUCIÓN DE:', 'Superficie (ha)', 'Tinta (100 kg)', 'Branca (100 kg)', 'Rendemento']],
    body: [
      ...FOGGA_CATEGORIAS.map((c) => {
        const r = dec.cadroA[c.key];
        return [
          c.label,
          fmtBlankOr2(r.superficieHa),
          fmtBlankOr2(r.tinta100Kg),
          fmtBlankOr2(r.branca100Kg),
          fmtBlankOr2(r.rendemento),
        ];
      }),
      ['TOTAL', fmt2(totA.superficieHa), fmt2(totA.tinta100Kg), fmt2(totA.branca100Kg), fmt2(totA.rendemento)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 85 } },
    didParseCell: (data) => {
      if (data.row.index === FOGGA_CATEGORIAS.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  // CADRO B
  const yCadroB = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CADRO B · DESTINO DA UVA OU MOSTO (en 100 kg)', 14, yCadroB);

  const totB = sumFoggaCadroB(dec.cadroB);
  autoTable(doc, {
    startY: yCadroB + 2,
    head: [
      [
        'VIÑEDOS PARA A PRODUCIÓN DE:',
        'Vinif. propia Tinta',
        'Vinif. propia Branca',
        'Coop. Tinta',
        'Coop. Branca',
        'Vend. Tinta',
        'Vend. Branca',
        'Cons. fresco',
        'Pasif.',
        'Zume',
        'Mosto conc.',
      ],
    ],
    body: [
      ...FOGGA_CATEGORIAS.map((c) => {
        const r = dec.cadroB[c.key];
        return [
          c.label,
          fmtBlankOr2(r.vinifPropiaTinta),
          fmtBlankOr2(r.vinifPropiaBranca),
          fmtBlankOr2(r.coopTinta),
          fmtBlankOr2(r.coopBranca),
          fmtBlankOr2(r.vendidaTinta),
          fmtBlankOr2(r.vendidaBranca),
          fmtBlankOr2(r.consumoFresco),
          fmtBlankOr2(r.pasificado),
          fmtBlankOr2(r.zume),
          fmtBlankOr2(r.mostoConc),
        ];
      }),
      [
        'TOTAL',
        fmt2(totB.vinifPropiaTinta),
        fmt2(totB.vinifPropiaBranca),
        fmt2(totB.coopTinta),
        fmt2(totB.coopBranca),
        fmt2(totB.vendidaTinta),
        fmt2(totB.vendidaBranca),
        fmt2(totB.consumoFresco),
        fmt2(totB.pasificado),
        fmt2(totB.zume),
        fmt2(totB.mostoConc),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 6.5 },
    styles: { fontSize: 7, cellPadding: 1.6, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 48 } },
    didParseCell: (data) => {
      if (data.row.index === FOGGA_CATEGORIAS.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  // CADRO C (si hay filas)
  if (dec.cadroC && dec.cadroC.length > 0) {
    const yCadroC = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CADRO C · PERSOAS DESTINATARIAS DE UVA OU MOSTO (en 100 kg)', 14, yCadroC);
    autoTable(doc, {
      startY: yCadroC + 2,
      head: [['Nome / Razón social', 'NIF', 'Concello', 'DOP T', 'DOP B', 'IXP T', 'IXP B', 'Outros T', 'Outros B']],
      body: dec.cadroC.map((row) => [
        row.nomeRazonSocial,
        row.nif,
        `${row.concello} (${row.provincia})`,
        fmtBlankOr2(row.dopTinta),
        fmtBlankOr2(row.dopBranca),
        fmtBlankOr2(row.ixpTinta),
        fmtBlankOr2(row.ixpBranca),
        fmtBlankOr2(row.outrosTinta),
        fmtBlankOr2(row.outrosBranca),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.8 },
    });
  }

  // Registro y firma
  const yFooter = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const estadoTexto =
    dec.estado === 'presentada'
      ? `PRESENTADA · Rexistro entrada: ${dec.numeroEntrada || '-'} · Data: ${formatFechaEs(dec.fechaPresentacion)} ${dec.horaPresentacion || ''}`
      : 'BORRADOR PREPARADO PARA PRESENTACIÓN NA SEDE ELECTRÓNICA DA XUNTA DE GALICIA (MR441B)';
  doc.text(`Estado: ${estadoTexto}`, 14, yFooter);
  doc.text(
    `Lugar e sinatura: ${dec.lugarFirma || d.concello || 'Ribadavia'} · Método: ${dec.metodoFirma || 'Certificado dixital'} · Xefatura Territorial: ${dec.xefaturaTerritorial || 'Ourense'}`,
    14,
    yFooter + 5
  );

  doc.save(`FOGGA_MR441B_${dec.campanaInicio}_${dec.campanaFin}.pdf`);
};

// ============================================================================
// PDF OFICIAL: CAU INFOVI (AICA - DECLARACIÓN DE VINO Y MOSTO)
// ============================================================================

export const exportInfoviPDF = (dec: InfoviDeclaracion) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const op = dec.operador;

  // Cabecera AICA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(76, 29, 149);
  doc.text('DECLARACION DE VINO Y MOSTO · CAU INFOVI (AICA)', 14, 14);
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Campaña: ${dec.campana}   |   Mes: ${dec.mes}   |   REOVI: ${op.reovi}   |   N.I.D.P.B.: ${op.nidpb}`,
    14,
    20
  );
  doc.text(
    `Estado: ${dec.estadoInfovi}   |   Cerrado por: ${dec.cerradoPor || '-'}   |   Producción media: ${dec.produccionMediaHl} hl   |   Últ. Grabación: ${formatFechaEs(dec.fechaUltGrabacion)}`,
    14,
    25
  );

  // Datos operador + Entrada de uva
  autoTable(doc, {
    startY: 28,
    head: [['Bodega / Instalación', 'Productor / Propietario', 'Entrada de Uva (kg)']],
    body: [
      [
        `${op.nombreOperador} (${op.cifNif})\n${op.domicilioBodega}\n${op.poblacion} (${op.provincia}) · Tel. ${op.telefono}`,
        `Tipo: ${op.tipoOperador}\n${op.domicilioProductor}\nEmail: ${op.email}`,
        `Tinta: ${dec.entradaUvaKg.tinta.toLocaleString('es-ES')} kg\nBlanca: ${dec.entradaUvaKg.blanca.toLocaleString('es-ES')} kg\nTotal: ${(dec.entradaUvaKg.tinta + dec.entradaUvaKg.blanca).toLocaleString('es-ES')} kg`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2 },
  });

  // Cuadro H
  const totH = sumInfoviCuadroH(dec.cuadroH);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [
      [
        'H. Declaración producción cosecha campaña en curso (hl)',
        'Tinto/Rosado',
        'Blanco',
        'Superficie (has.)',
        'TOTALES (hl)',
      ],
    ],
    body: [
      ...INFOVI_CATEGORIAS.map((c) => {
        const r = dec.cuadroH[c.key];
        return [c.label, r.tintoRosado, r.blanco, r.superficieHa, r.tintoRosado + r.blanco];
      }),
      ['TOTALES', totH.tintoRosado, totH.blanco, totH.superficieHa, totH.total],
    ],
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 82 } },
    didParseCell: (data) => {
      if (data.row.index === INFOVI_CATEGORIAS.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [250, 245, 255];
      }
    },
  });

  // Cuadro I
  const totI = sumInfoviCuadroI(dec.cuadroI);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    head: [['I. Producción vino a partir de mosto de otras campañas (hl)', 'Tinto/Rosado', 'Blanco', 'TOTALES (hl)']],
    body: [
      ...INFOVI_CATEGORIAS.map((c) => {
        const r = dec.cuadroI[c.key];
        return [c.label, r.tintoRosado, r.blanco, r.tintoRosado + r.blanco];
      }),
      ['TOTALES', totI.tintoRosado, totI.blanco, totI.total],
    ],
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.6, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 98 } },
    didParseCell: (data) => {
      if (data.row.index === INFOVI_CATEGORIAS.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [250, 245, 255];
      }
    },
  });

  // Cuadro J
  const totJ = sumInfoviCuadroJ(dec.cuadroJ);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    head: [
      [
        'J. Declaración de existencias de vino (hl)',
        'Tinto/Rosado Granel',
        'Tinto/Rosado Envasado',
        'Blanco Granel',
        'Blanco Envasado',
        'TOTALES (hl)',
      ],
    ],
    body: [
      ...INFOVI_CATEGORIAS.map((c) => {
        const r = dec.cuadroJ[c.key];
        return [c.label, r.tintoGranel, r.tintoEnvasado, r.blancoGranel, r.blancoEnvasado, sumInfoviJRow(r)];
      }),
      ['TOTALES', totJ.tintoGranel, totJ.tintoEnvasado, totJ.blancoGranel, totJ.blancoEnvasado, totJ.total],
    ],
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 66 } },
    didParseCell: (data) => {
      if (data.row.index === INFOVI_CATEGORIAS.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [250, 245, 255];
      }
    },
  });

  // Cuadro K
  const kRows: Array<any[]> = [];
  INFOVI_CATEGORIAS.forEach((c) => {
    const d = dec.cuadroK[c.key];
    const sub = sumInfoviSalidaDestinos(d);
    kRows.push([`${c.label} · Interiores`, d.interiores.tintoGranel, d.interiores.tintoEnvasado, d.interiores.blancoGranel, d.interiores.blancoEnvasado, sumInfoviJRow(d.interiores)]);
    kRows.push([`${c.label} · Mercado UE`, d.mercadoUe.tintoGranel, d.mercadoUe.tintoEnvasado, d.mercadoUe.blancoGranel, d.mercadoUe.blancoEnvasado, sumInfoviJRow(d.mercadoUe)]);
    kRows.push([`${c.label} · Países terceros`, d.paisesTerceros.tintoGranel, d.paisesTerceros.tintoEnvasado, d.paisesTerceros.blancoGranel, d.paisesTerceros.blancoEnvasado, sumInfoviJRow(d.paisesTerceros)]);
    kRows.push([`TOTALES ${c.label.toUpperCase()}`, sub.tintoGranel, sub.tintoEnvasado, sub.blancoGranel, sub.blancoEnvasado, sub.total]);
  });
  const totK = sumInfoviCuadroK(dec.cuadroK);
  kRows.push(['TOTALES SALIDAS', totK.tintoGranel, totK.tintoEnvasado, totK.blancoGranel, totK.blancoEnvasado, totK.total]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    head: [
      [
        'K. Salidas de vino desglosadas (hl)',
        'Tinto Granel',
        'Tinto Env.',
        'Blanco Granel',
        'Blanco Env.',
        'TOTAL',
      ],
    ],
    body: kRows,
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 7 },
    styles: { fontSize: 6.8, cellPadding: 1.3, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 66 } },
    didParseCell: (data) => {
      const firstCell = Array.isArray(data.row.raw) ? data.row.raw[0] : '';
      if (String(firstCell || '').startsWith('TOTALES')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [250, 245, 255];
      }
    },
  });

  // Página 2: MOSTO + Observaciones
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(76, 29, 149);
  doc.text(`SECCIÓN MOSTO · INFOVI ${dec.campana} · ${dec.mes}`, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [['G. Producción mosto sin concentrar (hl)', 'Tinto/Rosado', 'Blanco', 'Total (hl)', 'Sup. (ha)', 'Rend. (hl/ha)']],
    body: INFOVI_CATEGORIAS.map((c) => {
      const r = dec.mosto.cuadroG[c.key];
      return [c.label, r.tintoRosado, r.blanco, r.tintoRosado + r.blanco, r.superficieHa, r.rendimiento];
    }),
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' },
    columnStyles: { 0: { halign: 'left', cellWidth: 70 } },
  });

  const exM = dec.mosto.cuadroHExistencias;
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    head: [['H. Existencias de mosto (hl)', 'Sin conc. Tinto', 'Sin conc. Blanco', 'Concentrado', 'Rectificado', 'Parc. Ferm.', 'TOTAL']],
    body: [
      [
        'Existencias (hl)',
        exM.sinConcentrarTinto,
        exM.sinConcentrarBlanco,
        exM.concentrado,
        exM.rectificado,
        exM.parcialFermentado,
        exM.sinConcentrarTinto + exM.sinConcentrarBlanco + exM.concentrado + exM.rectificado + exM.parcialFermentado,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [243, 232, 255], textColor: [88, 28, 135], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' },
    columnStyles: { 0: { halign: 'left' } },
  });

  const obsY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(88, 28, 135);
  doc.text('Observaciones:', 14, obsY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const splitObs = doc.splitTextToSize(dec.observaciones || 'Sin observaciones.', 182);
  doc.text(splitObs, 14, obsY + 5);

  doc.save(`INFOVI_${dec.campana.replace('/', '-')}_${dec.mes}.pdf`);
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  APPCC_BODEGA_INFO,
  APPCC_CUADRO_GESTION,
  FLUJO_VINO_BLANCO_APPCC,
  FLUJO_VINO_TINTO_APPCC,
} from '../data/appccManualData';
import {
  AppccAguaRegistro,
  AppccIncidenciaRegistro,
  AppccLimpiezaRegistro,
  AppccPlagaMantenimientoRegistro,
  AppccProveedorRegistro,
  AppccResiduoRegistro,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  MovimientoInsumo,
  SalidaRegistro,
} from '../types/winery';
import { APPCC_LD_FILAS_BASE, getDaysInMonth } from './appccAutomation';
import { inferTipoVinoFromVarieties } from './wineType';

interface AppccPdfPayload {
  mesReferencia: string; // YYYY-MM
  entradasUva: EntradaUva[];
  depositos: Deposito[];
  elaboraciones: ElaboracionRegistro[];
  embotellados: EmbotelladoRegistro[];
  salidas: SalidaRegistro[];
  insumosMovimientos: MovimientoInsumo[];
  agua: AppccAguaRegistro[];
  limpieza: AppccLimpiezaRegistro[];
  residuos: AppccResiduoRegistro[];
  plagasMant: AppccPlagaMantenimientoRegistro[];
  proveedores: AppccProveedorRegistro[];
  incidencias: AppccIncidenciaRegistro[];
}

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const exportAppccManualSanidadPDF = (payload: AppccPdfPayload) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const drawHeader = (title: string, subtitle?: string) => {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(87, 83, 78);
    doc.text('Edición - 01', 14, 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(`REGISTROS APPCC  |  Adega ${APPCC_BODEGA_INFO.nombreComercial}`, pageW - 14, 12, {
      align: 'right',
    });
    doc.setDrawColor(136, 19, 55);
    doc.setLineWidth(0.4);
    doc.line(14, 14.5, pageW - 14, 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 25, 23);
    doc.text(title, pageW / 2, 22, { align: 'center' });
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(87, 83, 78);
      doc.text(subtitle, pageW / 2, 26.5, { align: 'center' });
    }
  };

  // Helper: find bottle & cork lot from insumos
  const findLoteInsumo = (tipo: 'botellas' | 'corchos', embLote: string, embFecha?: string) => {
    const out = payload.insumosMovimientos.find(
      (m) => m.tipoInsumo === tipo && m.embotelladoLoteAsociado === embLote && m.loteProveedor
    );
    if (out?.loteProveedor) return out.loteProveedor;

    const entries = payload.insumosMovimientos
      .filter((m) => m.tipoInsumo === tipo && m.movimiento === 'entrada' && m.loteProveedor)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (embFecha) {
      const priorEntry = entries.find((m) => m.fecha <= embFecha);
      if (priorEntry?.loteProveedor) return priorEntry.loteProveedor;
    }

    return entries[0]?.loteProveedor || '-';
  };

  // 1. REGISTRO ENTRADA DE UVA
  drawHeader(
    'REGISTRO ENTRADA DE UVA',
    `${APPCC_BODEGA_INFO.razonSocial} · CIF ${APPCC_BODEGA_INFO.cif} · RGE ${APPCC_BODEGA_INFO.numeroRge}`
  );
  autoTable(doc, {
    startY: 30,
    head: [['FECHA', 'PARCELA/ZONA', 'VARIEDADE', 'KG', 'DEPOSITO', 'OBSERVACIONES']],
    body:
      payload.entradasUva.length > 0
        ? payload.entradasUva.map((e) => [
            e.fecha,
            e.parcelaNombre,
            e.desgloseVariedades.map((v) => v.variedad).join(', '),
            String(e.kgTotales),
            e.depositoDestinoId,
            `${e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre)} · ${e.litrosMosto} L mosto`,
          ])
        : [['-', 'Sin entradas de uva registradas', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // 2. REGISTRO PRACTICAS ENOLOGICAS / MOVIMIENTOS DEPOSITOS
  doc.addPage('a4', 'landscape');
  drawHeader('REGISTRO PRACTICAS ENOLOGICAS / MOVIMIENTOS DEPOSITOS');
  autoTable(doc, {
    startY: 28,
    head: [
      [
        'FECHA',
        'DEPOSITO',
        'VARIEDAD',
        'CANTIDAD',
        'PRACTICA ENOLOGICA',
        'Q AÑADIDA - RESULTANTE/LOTE',
        'PASA A DEPOSITO Nº',
      ],
    ],
    body:
      payload.elaboraciones.length > 0
        ? payload.elaboraciones.map((el) => {
            const dep = payload.depositos.find((d) => d.id === el.depositoOrigenId);
            const qLote = [el.cantidadSulfitado, el.detalleCorreccion, dep?.vinoNombre]
              .filter(Boolean)
              .join(' · ');
            return [
              el.fecha,
              el.depositoOrigenId,
              el.porcentajesVariedades.map((v) => v.variedad).join(', ') || '-',
              `${el.cantidadLitros} L`,
              el.operacionRealizada,
              qLote || '-',
              el.depositoDestinoId || '-',
            ];
          })
        : [['-', '-', '-', '-', 'Sin movimientos registrados', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  // 3. REGISTRO EMBOTELLADOS & 4. TRAZABILIDAD HACIA DELANTE
  doc.addPage('a4', 'landscape');
  drawHeader('REGISTRO EMBOTELLADOS Y TRAZABILIDAD HACIA DELANTE');
  autoTable(doc, {
    startY: 28,
    head: [
      [
        'FECHA',
        'DEPOSITO Nº',
        'TIPO VINO',
        'CANTIDAD / BOTELLAS',
        'LOTE VINO',
        'LOTE BOTELLAS',
        'LOTE CORCHOS',
        'OTROS LOTES DE AÑADIDOS',
      ],
    ],
    body:
      payload.embotellados.length > 0
        ? payload.embotellados.map((emb) => [
            emb.fecha,
            emb.depositoProcedenciaId,
            emb.marca,
            `${emb.cantidadLitros} L / ${emb.cantidadBotellas075} bot`,
            emb.lote,
            findLoteInsumo('botellas', emb.lote, emb.fecha),
            findLoteInsumo('corchos', emb.lote, emb.fecha),
            emb.insumos.lacre ? `Lacre ${emb.insumos.colorLacre || 'OK'}` : '-',
          ])
        : [['-', '-', '-', '-', 'Sin embotellados registrados', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [136, 19, 55], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  const yAfterEmb = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TRAZABILIDAD HACIA DELANTE', 14, yAfterEmb);
  autoTable(doc, {
    startY: yAfterEmb + 3,
    head: [['FECHA', 'DOCUMENTO', 'PRODUCTO', 'CANTIDAD', 'LOTE', 'OBSERVACIONES']],
    body:
      payload.salidas.length > 0
        ? payload.salidas.map((s) => [
            s.fecha,
            s.numeroAlbaranFactura,
            `${s.marca} (${s.destino})`,
            `${s.cantidadBotellas} bot`,
            s.lote,
            s.observaciones || s.tipoSalida,
          ])
        : [['-', '-', 'Sin salidas registradas', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [68, 64, 60], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  // 5. CONTROL DE AGUA POTABLE (RD 3/2023 · MENSUAL) & RESIDUOS
  doc.addPage('a4', 'landscape');
  drawHeader(
    'CONTROL DE AGUA POTABLE (RD 3/2023 · MENSUAL) Y RESIDUOS',
    'Frecuencia mensual · Límites cloro libre 0,2 - 1,0 mg/l · Bagazo y raspón a finca para compostar'
  );
  autoTable(doc, {
    startY: 30,
    head: [['FECHA', 'LUGAR DE TOMA DE MUESTRA', 'CLORO', 'PH', 'ASPECTO', 'ESTADO', 'OBSERVACIONES']],
    body: payload.agua.map((a) => {
      const ok =
        a.organolepticoConforme &&
        !a.anomaliaSuministro &&
        a.cloroResidualMgL >= 0.2 &&
        a.cloroResidualMgL <= 1.0;
      return [
        a.fecha,
        a.lugarTomaMuestra || 'Grifo zona elaboración',
        `${a.cloroResidualMgL.toFixed(2)} mg/l`,
        String(a.ph ?? 7.2),
        a.aspecto || (a.organolepticoConforme ? 'Limpio, incoloro, inodoro' : 'Anomalía'),
        ok ? 'OK' : 'INCIDENCIA',
        a.observaciones || '-',
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [3, 105, 161], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  const yAfterAgua = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REGISTRO ELIMINACIÓN DE RESIDUOS Y SUBPRODUCTOS (BAGAZO / RASPÓN A FINCA)', 14, yAfterAgua);
  autoTable(doc, {
    startY: yAfterAgua + 3,
    head: [['FECHA', 'TIPO RESIDUO / SUBPRODUCTO', 'CANTIDAD', 'DESTINO', 'FINCA / PARCELA', 'ESTADO']],
    body: payload.residuos.map((r) => [
      r.fecha,
      r.tipoResiduo,
      r.cantidadEstimada,
      r.destino,
      r.parcelaDestino || '-',
      r.conforme === false ? 'INCIDENCIA' : 'OK',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  // 6. PLAN DE LIMPIEZA Y DESINFECCION (MATRIZ MENSUAL 1..31)
  doc.addPage('a4', 'landscape');
  const [yStr, mStr] = payload.mesReferencia.split('-');
  const yearNum = Number(yStr) || new Date().getFullYear();
  const monthNum = Number(mStr) || new Date().getMonth() + 1;
  const monthName = MESES_ES[monthNum - 1] || payload.mesReferencia;
  const daysCount = getDaysInMonth(yearNum, monthNum);

  drawHeader(
    `PLAN DE LIMPIEZA Y DESINFECCION · MES: ${monthName.toUpperCase()}  AÑO: ${yearNum}`,
    'Registro automático por vendimia, trasiegos/movimientos, embotellado y frecuencia APPCC (OK = Conforme · INC = Incidencia)'
  );

  const dayHeaders = Array.from({ length: daysCount }, (_, i) => String(i + 1));
  const matrixRows = APPCC_LD_FILAS_BASE.map((fila) => {
    const cells = dayHeaders.map((dayStr) => {
      const fecha = `${payload.mesReferencia}-${dayStr.padStart(2, '0')}`;
      const matches = payload.limpieza.filter(
        (l) => l.fecha === fecha && l.zonaEquipo.toUpperCase() === fila.zona.toUpperCase()
      );
      if (matches.length === 0) return '';
      const hasIncidence = matches.some((l) => !l.conforme);
      return hasIncidence ? 'INC' : 'OK';
    });
    return [fila.categoria, fila.zona, ...cells];
  });

  autoTable(doc, {
    startY: 30,
    head: [['ÁREA', 'ZONA', ...dayHeaders]],
    body: matrixRows,
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 6.5, halign: 'center' },
    styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'left', fontStyle: 'bold' },
    },
  });

  // 7. PLAN CONTROL PROVEEDORES, PLAN MANTENIMIENTO Y REGISTRO INCIDENCIAS
  doc.addPage('a4', 'landscape');
  drawHeader('PLAN CONTROL PROVEEDORES, MANTENIMIENTO E INCIDENCIAS (R4)');

  autoTable(doc, {
    startY: 28,
    head: [['PROVEEDOR', 'PRODUCTOS', 'LOCALIZACION', 'ESTADO', 'OBSERVACIONES']],
    body: payload.proveedores.map((p) => [
      p.proveedor,
      p.productos,
      p.localizacion,
      p.conforme ? 'OK' : 'INCIDENCIA',
      p.observaciones || '-',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  const yAfterProv = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: yAfterProv,
    head: [['FECHA', 'OPERACIÓN / CONTROL (DDD / RM)', 'LOCAL E INSTALACIONES', 'MAQUINARIA / UTENSILIOS', 'RESULTADO']],
    body: payload.plagasMant.map((pm) => [
      pm.fecha,
      pm.elementoZona,
      pm.localInstalaciones || pm.tipoControl,
      pm.maquinariaUtensilios || pm.observaciones || '-',
      pm.resultado === 'Sin anomalías / Conforme' ? 'OK' : 'INCIDENCIA',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  const yAfterPm = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: yAfterPm,
    head: [['FECHA', 'INCIDENCIA (PLAN AFECTADO)', 'ACCION CORRECTORA', 'RESPONSABLE DE ACTUACION', 'ESTADO']],
    body:
      payload.incidencias.length > 0
        ? payload.incidencias.map((inc) => [
            inc.fecha,
            `${inc.planAfectado}: ${inc.descripcion}`,
            inc.medidaCorrectora,
            inc.responsable,
            inc.estado,
          ])
        : [['-', 'Sin incidencias detectadas', '-', APPCC_BODEGA_INFO.responsablePlan, 'OK']],
    theme: 'grid',
    headStyles: { fillColor: [136, 19, 55], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  // 8. ANEXO: DIAGRAMAS DE FLUJO Y CUADRO PCC ACTUALIZADOS
  doc.addPage('a4', 'landscape');
  drawHeader(
    'ANEXO PLAN APPCC · DIAGRAMAS DE FLUJO Y CUADRO DE GESTIÓN PCC ACTUALIZADO',
    'Incluye SO₂ en despalillado/estrujado, fin FML y pre-embotellado; salida de raspón y bagazo a compostaje; sin ácido ascórbico'
  );

  autoTable(doc, {
    startY: 30,
    head: [['Fase', 'Peligros', 'Medidas Preventivas', 'PCC', 'Límites Críticos', 'Vigilancia', 'Medidas Correctoras', 'Registros']],
    body: APPCC_CUADRO_GESTION.map((r) => [
      r.fase,
      r.peligros,
      r.medidasPreventivas,
      r.pcc,
      r.limitesCriticos,
      r.vigilancia,
      r.medidasCorrectoras,
      r.registros,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [28, 25, 23], textColor: [253, 230, 138], fontSize: 7.5 },
    styles: { fontSize: 6.8, cellPadding: 1.6 },
  });

  const yAfterPcc = (doc as any).lastAutoTable.finalY + 6;
  let flowStartY = yAfterPcc;
  if (yAfterPcc >= 150) {
    doc.addPage('a4', 'landscape');
    drawHeader(
      'ANEXO PLAN APPCC · DIAGRAMAS DE FLUJO (ELABORACIÓN TINTO Y BLANCO)',
      'Incluye SO₂ en despalillado/estrujado, fin FML y pre-embotellado; salida de raspón y bagazo a compostaje; sin ácido ascórbico'
    );
    flowStartY = 30;
  }

  autoTable(doc, {
    startY: flowStartY,
    head: [['Elaboración Tinto (Fases)', 'Elaboración Blanco (Fases)']],
    body: Array.from(
      { length: Math.max(FLUJO_VINO_TINTO_APPCC.length, FLUJO_VINO_BLANCO_APPCC.length) },
      (_, i) => [
        FLUJO_VINO_TINTO_APPCC[i]
          ? `${i + 1}. ${FLUJO_VINO_TINTO_APPCC[i].titulo}${
              FLUJO_VINO_TINTO_APPCC[i].adicionSO2 ? ` [${FLUJO_VINO_TINTO_APPCC[i].adicionSO2}]` : ''
            }`
          : '',
        FLUJO_VINO_BLANCO_APPCC[i]
          ? `${i + 1}. ${FLUJO_VINO_BLANCO_APPCC[i].titulo}${
              FLUJO_VINO_BLANCO_APPCC[i].adicionSO2 ? ` [${FLUJO_VINO_BLANCO_APPCC[i].adicionSO2}]` : ''
            }`
          : '',
      ]
    ),
    theme: 'grid',
    headStyles: { fillColor: [68, 64, 60], textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 6.8, cellPadding: 1.5 },
  });

  // Footer page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setDrawColor(214, 211, 209);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `Registros APPCC · Adega ${APPCC_BODEGA_INFO.nombreComercial} · Responsable: ${APPCC_BODEGA_INFO.responsablePlan} · Pág. ${i}/${pageCount}`,
      14,
      pageH - 7
    );
    doc.text(
      `Firma Responsable: _________________________ (${new Date().toLocaleDateString('es-ES')})`,
      pageW - 85,
      pageH - 7
    );
  }

  doc.save(`Registros_APPCC_Microparaxes_${payload.mesReferencia}.pdf`);
};

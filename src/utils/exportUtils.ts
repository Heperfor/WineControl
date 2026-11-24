import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BodegaConfig,
  Deposito,
  ElaboracionRegistro,
  EmbotelladoRegistro,
  EntradaUva,
  Parcela,
  SalidaRegistro,
} from '../types/winery';
import { inferTipoVinoFromVarieties } from './wineType';
import { getLocalIsoDate } from './dateUtils';

interface ExportContextData {
  config: BodegaConfig;
  parcelas: Parcela[];
  depositos: Deposito[];
  entradas: EntradaUva[];
  elaboraciones: ElaboracionRegistro[];
  embotellados: EmbotelladoRegistro[];
  salidas: SalidaRegistro[];
}

/**
 * Generates an Excel workbook with multiple official registry sheets
 */
export const exportWineryRegistryToExcel = (data: ExportContextData, filename?: string) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Entradas de Uva
  const entradasRows = data.entradas.map((e, index) => {
    const parcel = data.parcelas.find((p) => p.id === e.parcelaId);
    const desgloseStr = e.desgloseVariedades.map((v) => `${v.variedad}: ${v.kg} kg`).join(', ');
    const litros = e.litrosMosto || e.litrosEstimadosMosto || 0;
    const rendimiento = e.rendimientoRealPorcentaje || (e.kgTotales > 0 ? Number(((litros / e.kgTotales) * 100).toFixed(1)) : 0);

    return {
      'Nº Orden': index + 1,
      'Fecha Entrada': e.fecha,
      Parcela: e.parcelaNombre,
      Paraje: parcel ? parcel.paraje : '-',
      'Desglose Variedades': desgloseStr,
      'Kg Totales': e.kgTotales,
      'Depósito Destino': e.depositoDestinoId,
      'Litros Mosto': litros,
      '% Rendimiento Real': `${rendimiento}%`,
      'Tipo Recipiente': e.tipoRecipiente,
      'Tipo de Vino': e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre),
    };
  });
  const wsEntradas = XLSX.utils.json_to_sheet(entradasRows);
  XLSX.utils.book_append_sheet(wb, wsEntradas, '1. Entradas Uva');

  // Sheet 2: Elaboraciones y Operaciones
  const elabRows = data.elaboraciones.map((el, index) => {
    const varStr = el.porcentajesVariedades.map((v) => `${v.variedad} (${v.porcentaje}%)`).join(', ');
    const detalleExtra = el.operacionRealizada === 'Sulfitado'
      ? el.cantidadSulfitado || ''
      : el.operacionRealizada === 'Correcciones'
      ? el.detalleCorreccion || ''
      : '';

    return {
      'Nº Asiento': index + 1,
      Fecha: el.fecha,
      'Depósito Origen': el.depositoOrigenId,
      'Tipo de Vino': el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades),
      'Operación Realizada': el.operacionRealizada,
      'Dosis Aplicada': detalleExtra || '-',
      'Litros Intervenidos': el.cantidadLitros,
      'Destino / Trasiego': el.depositoDestinoId || (el.destinoTipo === 'mismo_deposito' ? 'Mismo depósito' : el.destinoTipo),
      'Composición Varietal': varStr,
    };
  });
  const wsElab = XLSX.utils.json_to_sheet(elabRows);
  XLSX.utils.book_append_sheet(wb, wsElab, '2. Elaboración');

  // Sheet 3: Embotellados y Lotes
  const embRows = data.embotellados.map((emb, index) => {
    return {
      'Nº Registro': index + 1,
      Fecha: emb.fecha,
      Marca: emb.marca,
      'Lote Oficial': emb.lote,
      'Depósito Procedencia': emb.depositoProcedenciaId,
      'Litros Vino': emb.cantidadLitros,
      'Botellas 0,75L (Cálculo)': emb.cantidadBotellas075,
      'Stock Actual Disponible': emb.botellasDisponibles,
      Etiquetado: emb.etiquetado ? 'SÍ' : 'NO (En rima)',
      'Tipo Corcho': emb.insumos.tipoCorcho,
      'Tipo Botella': emb.insumos.tipoBotella,
      Lacre: emb.insumos.lacre ? `SÍ (${emb.insumos.colorLacre || 'Rojo'})` : 'NO',
      'Etiqueta Aplicada': emb.insumos.tipoEtiqueta,
      'Tipo Caja': emb.insumos.tipoCaja,
      'Cajas Embaladas': emb.insumos.cajasUtilizadas || 0,
      'Graduación (% vol)': emb.graduacionAlcoholicaVol ? `${emb.graduacionAlcoholicaVol}%` : '-',
      Observaciones: emb.observaciones || '',
    };
  });
  const wsEmb = XLSX.utils.json_to_sheet(embRows);
  XLSX.utils.book_append_sheet(wb, wsEmb, '3. Embotellados');

  // Sheet 4: Salidas y Expedición
  const salidasRows = data.salidas.map((s, index) => {
    return {
      'Nº Albarán': s.numeroAlbaranFactura,
      Fecha: s.fecha,
      Marca: s.marca,
      'Lote Trazabilidad': s.lote,
      'Cantidad Botellas': s.cantidadBotellas,
      'Nº Cajas': s.numeroCajas || Math.ceil(s.cantidadBotellas / 6),
      'Destino / Cliente': s.destino,
      'Tipo Salida': s.tipoSalida,
      'Precio Unitario (€)': s.pvpUnitario ? `${s.pvpUnitario} €` : '-',
      'Total Facturado (€)': s.pvpUnitario ? `${(s.pvpUnitario * s.cantidadBotellas).toFixed(2)} €` : '-',
      Observaciones: s.observaciones || '',
    };
  });
  const wsSalidas = XLSX.utils.json_to_sheet(salidasRows);
  XLSX.utils.book_append_sheet(wb, wsSalidas, '4. Salidas y Ventas');

  // Sheet 5: Almacén y Graneles Actuales
  const depRows = data.depositos.map((d) => {
    const varBreakdown = d.variedades.map((v) => `${v.variedad}: ${v.litros}L (${v.porcentaje}%)`).join(' | ');
    return {
      Código: d.codigo,
      Nombre: d.nombre,
      Tipo: d.tipoRecipiente,
      'Capacidad (L)': d.capacidadLitros,
      'Litros Actuales (L)': d.litrosActuales,
      '% Ocupación': `${d.capacidadLitros > 0 ? Math.round((d.litrosActuales / d.capacidadLitros) * 100) : 0}%`,
      Estado: d.estado,
      'Vino / Partida': d.vinoNombre || '-',
      'Variedades a Granel': varBreakdown || 'Vacío',
      'Última Operación': d.ultimaOperacion || '-',
      'Fecha Última Op': d.fechaUltimaOperacion || '-',
    };
  });
  const wsDepositos = XLSX.utils.json_to_sheet(depRows);
  XLSX.utils.book_append_sheet(wb, wsDepositos, '5. Graneles y Embotellado');

  // Sheet 6: Parcelas y Viñedos
  const parcelasRows = data.parcelas.map((p) => {
    const vars = p.variedadesPlantadas.map((v) => `${v.variedad} (${v.porcentajeEstimado}%)`).join(', ');
    const supM2 = p.superficieM2 || (p.superficieHa ? p.superficieHa * 10000 : 0);

    return {
      Código: p.id,
      Nombre: p.nombre,
      Paraje: p.paraje,
      'Superficie (m²)': supM2,
      'Marco de Plantación': p.marcoPlantacion || '-',
      'Altitud (m)': p.altitudM,
      Suelo: p.tipoSuelo,
      'Año Plantación': p.anoPlantacion,
      'Variedades Plantadas': vars,
      'Rendimiento Máx Estimado (kg)': p.rendimientoMaxKg || '-',
      Notas: p.observaciones || '',
    };
  });
  const wsParcelas = XLSX.utils.json_to_sheet(parcelasRows);
  XLSX.utils.book_append_sheet(wb, wsParcelas, '6. Parcelas y Variedades');

  // Write file
  const actualFilename = filename || `Libro_Registro_Bodega_${data.config.anoCampana}_${getLocalIsoDate()}.xlsx`;
  XLSX.writeFile(wb, actualFilename);
};

/**
 * Generates an official regulatory PDF report with header, metadata and signature lines
 */
export const exportOfficialRegistryPDF = (
  reportType: 'entradas' | 'elaboraciones' | 'embotellados' | 'salidas' | 'completo',
  data: ExportContextData
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const { config } = data;
  const wineBurgundy = [114, 22, 36];
  const darkGranite = [30, 41, 59];

  const addHeader = (title: string, subtitle: string) => {
    // Header banner
    doc.setFillColor(wineBurgundy[0], wineBurgundy[1], wineBurgundy[2]);
    doc.rect(14, 10, 269, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(config.nombreBodega.toUpperCase(), 20, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${config.denominacionOrigen || 'Registro Vitivinícola'} | RE: ${config.numeroRegistroVitivinicola} | NIF: ${config.cifNif}`, 20, 25);

    // Title & subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(darkGranite[0], darkGranite[1], darkGranite[2]);
    doc.text(title, 14, 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${subtitle} • Campaña: ${config.anoCampana} • Emisión: ${new Date().toLocaleDateString('es-ES')}`, 14, 40);
  };

  const addSignatureFooter = () => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, 190, 283, 190);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Documento de Control Vitivinícola • ${config.nombreBodega} • Pág. ${i} de ${pageCount}`,
        14,
        195
      );

      doc.text(
        `Firma del Responsable de Bodega: _______________________________ (${config.responsableTecnico})`,
        155,
        195
      );
    }
  };

  let hasSection = false;

  if (reportType === 'entradas' || reportType === 'completo') {
    hasSection = true;
    addHeader('LIBRO DE ENTRADAS DE UVA', 'Registro de pesajes y rendimientos obtenidos');

    const bodyData = data.entradas.map((e) => {
      const litros = e.litrosMosto || e.litrosEstimadosMosto || 0;
      const rendimiento = e.rendimientoRealPorcentaje || (e.kgTotales > 0 ? Number(((litros / e.kgTotales) * 100).toFixed(1)) : 0);

      return [
        e.fecha,
        e.parcelaNombre,
        e.desgloseVariedades.map((v) => `${v.variedad} (${v.kg} kg)`).join(', '),
        `${e.kgTotales.toLocaleString('es-ES')} kg`,
        e.depositoDestinoId,
        `${litros.toLocaleString('es-ES')} L`,
        `${rendimiento}%`,
        e.tipoRecipiente,
        e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre),
      ];
    });

    autoTable(doc, {
      startY: 44,
      head: [
        [
          'Fecha',
          'Parcela Origen',
          'Variedades Cosechadas',
          'Total Kg',
          'Depósito',
          'Litros Mosto',
          '% Rendimiento',
          'Tipo Recipiente',
          'Tipo Vino',
        ],
      ],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [114, 22, 36],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      columnStyles: {
        2: { cellWidth: 70 },
      },
    });
  }

  if (reportType === 'elaboraciones' || reportType === 'completo') {
    if (hasSection) doc.addPage('a4', 'landscape');
    hasSection = true;
    addHeader('LIBRO DE ELABORACIÓN Y PRÁCTICAS ENOLÓGICAS', 'Control de operaciones, trasiegos, sulfitado y correcciones');

    const bodyData = data.elaboraciones.map((el) => {
      const detalle = el.operacionRealizada === 'Sulfitado'
        ? el.cantidadSulfitado || '-'
        : el.operacionRealizada === 'Correcciones'
        ? el.detalleCorreccion || '-'
        : '-';

      return [
        el.fecha,
        el.depositoOrigenId,
        el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades),
        el.operacionRealizada,
        detalle,
        `${el.cantidadLitros.toLocaleString('es-ES')} L`,
        el.depositoDestinoId || (el.destinoTipo === 'mismo_deposito' ? 'Mismo Depósito' : el.destinoTipo),
        el.porcentajesVariedades.map((v) => `${v.variedad} ${v.porcentaje}%`).join(', '),
      ];
    });

    autoTable(doc, {
      startY: 44,
      head: [
        [
          'Fecha',
          'Dep. Origen',
          'Tipo Vino',
          'Práctica Realizada',
          'Dosis',
          'Litros',
          'Destino',
          'Variedades %',
        ],
      ],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [114, 22, 36],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
    });
  }

  if (reportType === 'embotellados' || reportType === 'completo') {
    if (hasSection) doc.addPage('a4', 'landscape');
    hasSection = true;
    addHeader('LIBRO DE EMBOTELLADOS Y DECLARACIÓN DE LOTES', 'Trazabilidad de envasado, volúmenes e insumos utilizados');

    const bodyData = data.embotellados.map((emb) => [
      emb.fecha,
      emb.lote,
      emb.marca,
      emb.depositoProcedenciaId,
      `${emb.cantidadLitros.toLocaleString('es-ES')} L`,
      `${emb.cantidadBotellas075.toLocaleString('es-ES')} bot.`,
      emb.etiquetado ? 'SÍ' : 'NO (Rima)',
      emb.insumos.tipoCorcho,
      emb.insumos.tipoBotella,
      emb.insumos.lacre ? 'Sí' : 'No',
      `${emb.botellasDisponibles.toLocaleString('es-ES')} bot.`,
      emb.observaciones || '-',
    ]);

    autoTable(doc, {
      startY: 44,
      head: [
        [
          'Fecha',
          'Lote',
          'Marca',
          'Depósito',
          'Litros Vino',
          'Botellas 0.75L',
          'Etiquetado',
          'Corcho',
          'Botella',
          'Lacre',
          'Stock Disp.',
          'Notas',
        ],
      ],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [114, 22, 36],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
    });
  }

  if (reportType === 'salidas' || reportType === 'completo') {
    if (hasSection) doc.addPage('a4', 'landscape');
    hasSection = true;
    addHeader('LIBRO DE SALIDAS Y CIRCULACIÓN DE VINOS', 'Documentación de expedición y entrega a clientes / distribuidores');

    const bodyData = data.salidas.map((s) => [
      s.fecha,
      s.numeroAlbaranFactura,
      s.marca,
      s.lote,
      `${s.cantidadBotellas.toLocaleString('es-ES')} bot.`,
      s.numeroCajas ? `${s.numeroCajas} cajas` : '-',
      s.destino,
      s.tipoSalida,
      s.pvpUnitario ? `${s.pvpUnitario} €` : '-',
      s.observaciones || '-',
    ]);

    autoTable(doc, {
      startY: 44,
      head: [
        [
          'Fecha',
          'Nº Albarán',
          'Marca',
          'Lote Vino',
          'Botellas',
          'Cajas',
          'Destino / Cliente',
          'Régimen',
          'PVP Unit.',
          'Observaciones',
        ],
      ],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [114, 22, 36],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
    });
  }

  addSignatureFooter();
  doc.save(`Registro_Oficial_${reportType.toUpperCase()}_${config.anoCampana}.pdf`);
};

/**
 * Generates an Audit Dossier for a specific wine lot
 */
export const exportLotAuditDossierPDF = (
  lotNumber: string,
  data: ExportContextData
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const embotellado = data.embotellados.find((e) => e.lote.toUpperCase() === lotNumber.toUpperCase());
  if (!embotellado) return;

  const deposito = data.depositos.find((d) => d.id === embotellado.depositoProcedenciaId);
  const entradasRelacionadas = data.entradas.filter((e) => e.depositoDestinoId === embotellado.depositoProcedenciaId);
  const elaboracionesRelacionadas = data.elaboraciones.filter(
    (el) => el.depositoOrigenId === embotellado.depositoProcedenciaId || el.depositoDestinoId === embotellado.depositoProcedenciaId
  );
  const salidasDelLote = data.salidas.filter((s) => s.lote.toUpperCase() === lotNumber.toUpperCase());

  // Top banner
  doc.setFillColor(114, 22, 36);
  doc.rect(14, 12, 182, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(data.config.nombreBodega.toUpperCase(), 20, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`EXPEDIENTE DE AUDITORÍA Y TRAZABILIDAD • RE: ${data.config.numeroRegistroVitivinicola}`, 20, 29);

  // Title box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`FICHA DE TRAZABILIDAD DEL LOTE: ${embotellado.lote}`, 14, 44);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Vino / Marca: ${embotellado.marca} | Fecha Embotellado: ${embotellado.fecha} | Graduación: ${embotellado.graduacionAlcoholicaVol || '12.5'}% vol`, 14, 50);

  // Section 1: Bottling Details Table
  autoTable(doc, {
    startY: 54,
    head: [['Parámetro de Embotellado', 'Dato Registrado', 'Insumos Utilizados', 'Especificación']],
    body: [
      ['Litros Embotellados', `${embotellado.cantidadLitros} Litros`, 'Tipo de Corcho', embotellado.insumos.tipoCorcho === 'natural' ? 'Corcho Natural Extra' : 'Corcho 1+1 Colmatado'],
      ['Total Botellas 0.75L', `${embotellado.cantidadBotellas075} botellas`, 'Tipo de Botella', embotellado.insumos.tipoBotella === 'verde' ? 'Borgoña Canela / Verde' : 'Transparente Flint'],
      ['Depósito Procedencia', `${embotellado.depositoProcedenciaId} (${deposito?.tipoRecipiente || 'Inox'})`, 'Sellado Lacre', embotellado.insumos.lacre ? `SÍ (${embotellado.insumos.colorLacre || 'Rojo'})` : 'No'],
      ['Estado Etiquetado', embotellado.etiquetado ? 'Etiquetado Completo' : 'En Rima / Crianza Botella', 'Etiqueta Aplicada', `Marca ${embotellado.insumos.tipoEtiqueta.toUpperCase()}`],
      ['Stock Actual Disponible', `${embotellado.botellasDisponibles} botellas`, 'Embalaje', `${embotellado.insumos.tipoCaja} (${embotellado.insumos.cajasUtilizadas || 0} cajas)`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [114, 22, 36], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Section 2: Origin of Grapes (Parcelas y Vendimia)
  const currentY1 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('1. ORIGEN DE LA UVA Y VENDIMIA (Trazabilidad hacia el Viñedo)', 14, currentY1);

  const grapeBody = entradasRelacionadas.map((e) => {
    const parcel = data.parcelas.find((p) => p.id === e.parcelaId);
    const litros = e.litrosMosto || e.litrosEstimadosMosto || 0;
    const rend = e.rendimientoRealPorcentaje || (e.kgTotales > 0 ? Number(((litros / e.kgTotales) * 100).toFixed(1)) : 0);

    return [
      e.fecha,
      e.parcelaNombre,
      parcel?.marcoPlantacion || '-',
      e.desgloseVariedades.map((v) => `${v.variedad}: ${v.kg}kg`).join(', '),
      `${e.kgTotales} kg`,
      `${litros} L`,
      `${rend}%`,
      e.tipoVino || inferTipoVinoFromVarieties(e.desgloseVariedades, e.parcelaNombre),
    ];
  });

  autoTable(doc, {
    startY: currentY1 + 3,
    head: [['Fecha Vendimia', 'Parcela', 'Marco', 'Variedades de Uva', 'Kg Uva', 'Litros Mosto', '% Rend.', 'Tipo Vino']],
    body: grapeBody.length > 0 ? grapeBody : [['N/D', 'Uva procedente de depósitos de bodega', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Section 3: Winemaking Operations in Cellar
  const currentY2 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('2. OPERACIONES Y TRATAMIENTOS ENOLÓGICOS EN BODEGA', 14, currentY2);

  const elabBody = elaboracionesRelacionadas.map((el) => {
    const detalle = el.operacionRealizada === 'Sulfitado'
      ? el.cantidadSulfitado || '-'
      : el.operacionRealizada === 'Correcciones'
      ? el.detalleCorreccion || '-'
      : '-';

    return [
      el.fecha,
      el.tipoVino || inferTipoVinoFromVarieties(el.porcentajesVariedades),
      el.operacionRealizada,
      detalle,
      `${el.cantidadLitros} L`,
      el.porcentajesVariedades.map((v) => `${v.variedad} ${v.porcentaje}%`).join(', '),
    ];
  });

  autoTable(doc, {
    startY: currentY2 + 3,
    head: [['Fecha', 'Tipo Vino', 'Operación', 'Dosis', 'Litros', 'Composición Varietal']],
    body: elabBody.length > 0 ? elabBody : [['-', '-', 'Vinificación estándar en depósito', '-', `${embotellado.cantidadLitros} L`, '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Section 4: Dispatches / Sales
  const currentY3 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('3. EXPEDICIONES Y DESTINOS DEL PRODUCTO TERMINADO', 14, currentY3);

  const salesBody = salidasDelLote.map((s) => [
    s.fecha,
    s.numeroAlbaranFactura,
    `${s.cantidadBotellas} botellas`,
    s.numeroCajas ? `${s.numeroCajas} cajas` : '-',
    s.destino,
    s.tipoSalida,
  ]);

  autoTable(doc, {
    startY: currentY3 + 3,
    head: [['Fecha Salida', 'Albarán/Factura', 'Botellas', 'Cajas', 'Destino / Cliente', 'Régimen']],
    body: salesBody.length > 0 ? salesBody : [['-', '-', '0 botellas expedidas (Partida íntegra en bodega)', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Regulatory Certification text
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (finalY < 255) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Certifico que todos los datos contenidos en esta ficha técnica de trazabilidad son copia fiel de los libros de bodega y registros de vendimia.',
      14,
      finalY,
      { maxWidth: 182 }
    );

    doc.text(`En ${data.config.localidad}, a ${new Date().toLocaleDateString('es-ES')}`, 14, finalY + 12);
    doc.text(`Firma y Sello de Bodega: __________________________________`, 95, finalY + 12);
  }

  doc.save(`Ficha_Trazabilidad_Lote_${lotNumber}.pdf`);
};

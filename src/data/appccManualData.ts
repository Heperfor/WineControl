// Datos estructurados del Manual APPCC de Adega Microparaxes (Edición 02 actualizada para Sanidad)
// Incorpora las modificaciones de proceso, RD 3/2023 (Agua mensual), compostaje de bagazo/raspón y loteado L-X01/2024.

export interface AppccDatosBodega {
  nombreComercial: string;
  razonSocial: string;
  cif: string;
  direccion: string;
  localidad: string;
  codigoPostal: string;
  provincia: string;
  actividad: string;
  numeroRge: string;
  numeroRgseaa: string;
  responsablePlan: string;
  cualificacionResponsable: string;
  edicion: string;
}

export const APPCC_BODEGA_INFO: AppccDatosBodega = {
  nombreComercial: 'Microparaxes',
  razonSocial: 'Héctor Pérez Formoso',
  cif: '76721750Y',
  direccion: 'Ctra. Nacional Vella, 69, San Paio',
  localidad: 'Ribadavia',
  codigoPostal: '32418',
  provincia: 'Ourense',
  actividad: 'Fabricación o Elaboración o Transformación · Vino',
  numeroRge: '42.650/OU',
  numeroRgseaa: 'En tramitación / Registro autonómico 42.650/OU',
  responsablePlan: 'Héctor Pérez Formoso',
  cualificacionResponsable: 'Responsable del Plan APPCC · Formación específica en Industrias Alimentarias (Axema 2016)',
  edicion: 'Edición 02 (Actualizada Sanidad)',
};

export const APPCC_VINEDOS_PARCELAS: Array<{ parcela: string; emplazamiento: string }> = [
  { parcela: 'O Seixo', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'Portela', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'Palleiros', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'Fontán', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'Pontillón', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'Frontón', emplazamiento: 'Ventosela (Ribadavia)' },
  { parcela: 'As Sibarras', emplazamiento: 'Francelos (Ribadavia)' },
  { parcela: 'Travesas', emplazamiento: 'Francelos (Ribadavia)' },
  { parcela: 'Roucón', emplazamiento: 'A Groba (Ribadavia)' },
  { parcela: 'Moras', emplazamiento: 'Pazos Ermos (Cenlle)' },
  { parcela: 'Atravesada', emplazamiento: 'Pazos Ermos (Cenlle)' },
  { parcela: 'Cortiñal', emplazamiento: 'Pazos Ermos (Cenlle)' },
  { parcela: 'Pereiras', emplazamiento: 'Saa (Carballeda de Avia)' },
];

export const APPCC_ZONAS_INSTALACIONES = [
  {
    zona: 'Zona de Vinificación',
    materiales: 'Suelo cemento pintado epoxi · Paredes cemento pintado · Techo madera tratada y pladur',
    equipos: 'Depósitos (inox, barricas, ánfora), bomba, mangueras, despalilladora-estrujadora, prensa',
    extra: 'Puntos de luz estancos · Válvulas anti-múridos en desagües',
  },
  {
    zona: 'Zona de Almacén',
    materiales: 'Suelo cemento pintado epoxi · Paredes cemento pintado · Techo madera tratada',
    equipos: 'Jaulones metálicos, palés de botellas terminadas identificadas por lote',
    extra: 'Puntos de luz estancos',
  },
  {
    zona: 'Zona de Embotellado',
    materiales: 'Suelo cemento pintado epoxi · Paredes cemento pintado · Techo pladur',
    equipos: 'Embotelladora semiautomática, corchadora manual',
    extra: 'Puntos de luz estancos · Zona Limpia',
  },
  {
    zona: 'Servicio Higiénico',
    materiales: 'Suelo cemento pintado epoxi · Paredes cemento pintado · Techo madera tratada',
    equipos: 'Lavamanos de accionamiento por pedal con agua caliente, jabón y papel de un solo uso',
    extra: 'Zona Sucia (obligatorio lavado doble al volver a Zona Limpia)',
  },
];

export interface PasoFlujoAppcc {
  id: string;
  titulo: string;
  detalle: string;
  adicionSO2?: string;
  subproductoSalida?: string;
  esPcc?: boolean;
}

export const FLUJO_VINO_TINTO_APPCC: PasoFlujoAppcc[] = [
  {
    id: 't1',
    titulo: 'Recepción y Selección de Uva Vendimiada',
    detalle: 'Recolección manual en cajas alimentarias ≤16 kg. Rechazo de racimos dañados y verificación plazo fitosanitarios.',
    esPcc: true,
  },
  {
    id: 't2',
    titulo: 'Despalillado y Estrujado',
    detalle: 'Retirada manual de hojas/restos vegetales en tolva, separación de raspón y suave estrujado.',
    adicionSO2: 'Adición de SO₂ (control antioxidante/antimicrobiano)',
    subproductoSalida: 'Salida de Raspón → A finca para compostar',
    esPcc: true,
  },
  {
    id: 't3',
    titulo: 'Encubado y Fermentación Alcohólica / Maceración',
    detalle: 'Control diario de temperatura (24–30 °C, <33 °C) y densidad, remontados periódicos.',
    esPcc: true,
  },
  {
    id: 't4',
    titulo: 'Descube y Prensado',
    detalle: 'Separación de vino yema y prensado de hollejos en cestos alimentarios.',
    subproductoSalida: 'Salida de Bagazo → A finca para compostar',
  },
  {
    id: 't5',
    titulo: 'Fermentación Maloláctica (Fin FML)',
    detalle: 'Transformación natural de ácido málico en ácido láctico en depósito/barrica.',
    adicionSO2: 'Adición de SO₂ al finalizar la maloláctica',
    esPcc: true,
  },
  {
    id: 't6',
    titulo: 'Crianza sobre Lías / Almacenamiento',
    detalle: 'Removidos periódicos, estabilización natural por frío de bodega y control analítico de SO₂ libre (sin ácido ascórbico).',
    esPcc: true,
  },
  {
    id: 't7',
    titulo: 'Decantación, Trasiegos y Preparación',
    detalle: 'Limpieza natural o filtración excepcional previa al embotellado.',
    adicionSO2: 'Adición de SO₂ y analítica final antes de embotellar (límite Tinto ≤150 mg/l)',
    esPcc: true,
  },
  {
    id: 't8',
    titulo: 'Embotellado, Taponado y Etiquetado',
    detalle: 'Llenado semiautomático por gravedad, corchado manual, asignación de lote comercial (ej. L-X01/2024).',
    esPcc: true,
  },
  {
    id: 't9',
    titulo: 'Crianza en Botella y Almacenaje',
    detalle: 'Estiba en jaulones metálicos con temperatura estable hasta etiquetado y expedición.',
  },
];

export const FLUJO_VINO_BLANCO_APPCC: PasoFlujoAppcc[] = [
  {
    id: 'b1',
    titulo: 'Recepción y Selección de Uva Vendimiada',
    detalle: 'Cajas alimentarias ≤16 kg, traslado inmediato a bodega y selección visual en viña y mesa.',
    esPcc: true,
  },
  {
    id: 'b2',
    titulo: 'Despalillado y Estrujado',
    detalle: 'Separación de raspón y suave estrujado de bayas previniendo rotura de semillas.',
    adicionSO2: 'Adición de SO₂ en pasta/mosto para protección frente a oxidación',
    subproductoSalida: 'Salida de Raspón → A finca para compostar',
    esPcc: true,
  },
  {
    id: 'b3',
    titulo: 'Prensado',
    detalle: 'Apriete suave en prensa para extracción de mosto limpio sin restos sólidos excesivos.',
    subproductoSalida: 'Salida de Bagazo → A finca para compostar',
  },
  {
    id: 'b4',
    titulo: 'Desfangado y Fermentación Alcohólica',
    detalle: 'Fermentación controlada en depósitos de acero inox / barricas / ánfora con control diario de Tª y densidad.',
    esPcc: true,
  },
  {
    id: 'b5',
    titulo: 'Descube, Crianza sobre Lías y Decantación',
    detalle: 'Battonage y reposo invernal para limpieza natural y control de sulfuroso libre (sin ácido ascórbico).',
    esPcc: true,
  },
  {
    id: 'b6',
    titulo: 'Trasiego de Limpieza y Ajuste Pre-Embotellado',
    detalle: 'Verificación microbiológica, limpieza y comprobación analítica final de SO₂ total.',
    adicionSO2: 'Adición de SO₂ antes de embotellar (límite Blanco/Rosado ≤185 mg/l)',
    esPcc: true,
  },
  {
    id: 'b7',
    titulo: 'Embotellado, Taponado y Etiquetado',
    detalle: 'Llenadora higienizada (agua abundante 30 min), inspección de bocas de vidrio, loteado (ej. L-X01/2024).',
    esPcc: true,
  },
  {
    id: 'b8',
    titulo: 'Crianza en Botella y Almacenaje',
    detalle: 'Almacenaje en jaulones con trazabilidad completa por lote y fecha de embotellado.',
  },
];

export interface PccCuadroFila {
  fase: string;
  peligros: string;
  medidasPreventivas: string;
  pcc: string;
  limitesCriticos: string;
  vigilancia: string;
  medidasCorrectoras: string;
  registros: string;
}

// Cuadro de Gestión APPCC actualizado (eliminado ácido ascórbico; añadido SO₂ despalillado/FML/pre-embotellado)
export const APPCC_CUADRO_GESTION: PccCuadroFila[] = [
  {
    fase: 'Vendimia y recepción de uva',
    peligros: 'Restos de fungicidas; uva podrida; inicio prematuro de fermentación; contaminación del transporte.',
    medidasPreventivas: 'Respetar plazo de seguridad; cajas ≤16 kg limpias; separar partidas por estado sanitario.',
    pcc: 'PCC 2',
    limitesCriticos: 'Plazo aplicación ≥21 días antes de vendimia; ausencia de podredumbre grave; transporte higiénico.',
    vigilancia: 'Control visual/olfativo de cada partida y limpieza del vehículo.',
    medidasCorrectoras: 'Rechazo o vinificación separada de partidas no aptas; restablecer limpieza.',
    registros: 'Libro Entradas Uva · Fitosanitarios · Incidencias (R4)',
  },
  {
    fase: 'Despalillado, estrujado y salida de raspón',
    peligros: 'Restos sólidos/metálicos en tolva; contaminación microbiológica; oxidación inicial del mosto.',
    medidasPreventivas: 'Limpieza/revisión previa de despalilladora; adición dosificada de SO₂ en estrujado; retirada separada del raspón.',
    pcc: 'PCC 2',
    limitesCriticos: 'Ausencia de raspones/cuerpos extraños en pasta; dosificación exacta de SO₂ autorizada.',
    vigilancia: 'Control continuo del despalillado, salida de raspón y cálculo de dosis SO₂.',
    medidasCorrectoras: 'Puesta a punto de despalilladora; retirada de impurezas; ajuste de sulfitado y limpieza.',
    registros: 'RADIT (SO₂) · Residuos (Raspón) · R1 (L+D) · R4',
  },
  {
    fase: 'Prensado, encubado y fermentación alcohólica',
    peligros: 'Parada fermentativa; exceso de temperatura; contaminación microbiana en prensa (bagazo).',
    medidasPreventivas: 'Control diario Tª/densidad; remontados; limpieza prensa antes/después; retirada de bagazo a finca.',
    pcc: 'PCC 1',
    limitesCriticos: 'Mantener Tª 24–30 °C (tinto <33 °C); prensa limpia libre de restos fermentados.',
    vigilancia: 'Seguimiento diario de Tª, densidad, cata organoléptica y limpieza de prensa.',
    medidasCorrectoras: 'Refrigeración rápida, reinoculación si procede, retirada inmediata de bagazo y limpieza.',
    registros: 'Elaboración · Residuos (Bagazo) · Incidencias (R4)',
  },
  {
    fase: 'Fermentación maloláctica (Fin FML) y trasiegos',
    peligros: 'Picado acético/láctico; producción de H₂S; quiebra oxidásica tras finalizar FML.',
    medidasPreventivas: 'Seguimiento fin de FML; trasiego limpio evitando aireación; adición obligatoria de SO₂ al fin de FML.',
    pcc: 'PCC 2',
    limitesCriticos: 'Trasegar tras finalizar fermentación; añadir dosis de SO₂ protectora tras fin FML.',
    vigilancia: 'Control analítico de málico/láctico y dosis de SO₂ libre tras el trasiego.',
    medidasCorrectoras: 'Trasegar sin aireación, ajustar dosis de SO₂ y registrar corrección.',
    registros: 'Elaboración · RADIT (SO₂) · Analíticas internas',
  },
  {
    fase: 'Almacenamiento y crianza sobre lías',
    peligros: 'Alteraciones aerobias (flores, picado acético) o anaerobias (amargor, grasa); caída de sulfuroso libre.',
    medidasPreventivas: 'Mantener dosis adecuada de SO₂ libre; depósitos llenos/herméticos; higiene y control analítico periódico.',
    pcc: 'PCC 2',
    limitesCriticos: 'Dosis de SO₂ libre en rango protector; ausencia de velos o defectos organolépticos.',
    vigilancia: 'Control visual, nivel de llenado y análisis periódico de SO₂ libre.',
    medidasCorrectoras: 'Restablecer dosis de SO₂ (sin adición de ácido ascórbico), rellenado de depósito o rechazo de partida no apta.',
    registros: 'RADIT (SO₂) · Analíticas · R4 (Incidencias)',
  },
  {
    fase: 'Ajuste pre-embotellado y filtración (si procede)',
    peligros: 'Superación del límite legal de SO₂ total; filtración defectuosa; contaminación microbiológica.',
    medidasPreventivas: 'Analítica obligatoria antes de embotellar; adición controlada de SO₂ pre-embotellado; filtro apto alimentario.',
    pcc: 'PCC 2',
    limitesCriticos: 'SO₂ total ≤185 mg/l (blancos/rosados) y ≤150 mg/l (tintos) según Reg. (UE) 2019/934; vino limpio.',
    vigilancia: 'Analítica de SO₂ previa a cada partida de embotellado y revisión de placas/filtros.',
    medidasCorrectoras: 'No embotellar si supera límite o falta analítica; refiltrado o ajuste; cambio de placas.',
    registros: 'RADIT (SO₂) · Analítica pre-embotellado · R4',
  },
  {
    fase: 'Embotellado, taponado, loteado y etiquetado',
    peligros: 'Residuos de limpieza; astillas de vidrio; corcho defectuoso; error o ausencia de número de lote.',
    medidasPreventivas: 'Limpieza llenadora con agua 30 min; inspección visual bocas de botella; corchos homologados; lote comercial obligatorio.',
    pcc: 'PCC 2',
    limitesCriticos: 'Ausencia de residuos/vidrio; enrase correcto de tapón; lote formato L-[Marca][Nº]/[Cosecha] (ej. L-X01/2024).',
    vigilancia: 'Inspección visual de llenado, bocas, taponado y comprobación de lote/etiqueta en cada partida.',
    medidasCorrectoras: 'Retirada de botellas defectuosas, parada ante rotura de vidrio, limpieza total de línea y registro R4.',
    registros: 'Libro Embotellados (REMB) · Lote · Incidencias (R4)',
  },
];

export const APPCC_LD_TABLA = [
  { zona: 'Aseo', elemento: 'Suelo y papeleras', producto: 'Detergente / Agua a presión', modo: 'Barrido, vaciado y fregado con agua a presión. Secar al aire.', frecuencia: 'Semanal' },
  { zona: 'Aseo', elemento: 'Lavabo de pedal e inodoro', producto: 'Desinfectante (100 ml / 5 L o directo 5 min)', modo: 'Aplicar desinfectante, esperar 5 min y aclarar. Reponer jabón y papel.', frecuencia: 'Semanal' },
  { zona: 'Aseo', elemento: 'Paredes y Techo', producto: 'Agua a presión / limpiador', modo: 'Eliminación de suciedad visible y secado al aire.', frecuencia: 'Mensual / Anual' },
  { zona: 'Bodega Elaboración', elemento: 'Despalilladora-estrujadora y Prensa', producto: 'Agua potable a presión', modo: 'Eliminación total de restos vegetales y secado al aire.', frecuencia: 'Antes y después de su uso' },
  { zona: 'Bodega Elaboración', elemento: 'Depósitos', producto: 'Sosa cáustica diluida (2–10%)', modo: 'Agua a presión, recirculación/lavado con sosa para destartarización y aclarado abundante.', frecuencia: 'Después de vaciado y antes de uso' },
  { zona: 'Bodega Elaboración', elemento: 'Bombas y Mangueras', producto: 'Agua limpia / solución alcalina', modo: 'Circulación abundante de agua hasta eliminación de restos.', frecuencia: 'Antes y después de su uso' },
  { zona: 'Zona Embotellado', elemento: 'Llenadora semiautomática', producto: 'Agua caliente abundante (30 min)', modo: 'Circulación prolongada de agua caliente (sin químicos en botellas). Secar al aire.', frecuencia: 'Antes y después de su uso' },
  { zona: 'Zona Embotellado', elemento: 'Corchadora manual', producto: 'Paño seco / desinfección de mordazas', modo: 'Eliminación de restos de corcho y polvo con paño seco limpio.', frecuencia: 'Antes y después de su uso' },
  { zona: 'Residuos / Útiles', elemento: 'Contenedores y útiles de limpieza', producto: 'Desinfectante alimentario', modo: 'Limpiar siempre fuera de la zona de elaboración, 5 min de contacto y aclarar.', frecuencia: 'Tras vaciado / uso' },
];

export const APPCC_PREFIJOS_LOTE: Array<{ marca: string; prefijo: string; ejemplo: string }> = [
  { marca: 'Congostras', prefijo: 'C', ejemplo: 'L-C01/2024' },
  { marca: 'Fontán', prefijo: 'F', ejemplo: 'L-F01/2024' },
  { marca: 'O Roucon', prefijo: 'R', ejemplo: 'L-R01/2024' },
  { marca: 'O Seixo', prefijo: 'S', ejemplo: 'L-S01/2024' },
  { marca: 'Os Palleiros', prefijo: 'P', ejemplo: 'L-P01/2024' },
  { marca: 'Rosado', prefijo: 'RO', ejemplo: 'L-RO01/2024' },
  { marca: 'Xouba', prefijo: 'X', ejemplo: 'L-X01/2024' },
];

export const getMarcaPrefijoLote = (marca: string): string => {
  const normalize = (val: string) =>
    (val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const target = normalize(marca);
  const found = APPCC_PREFIJOS_LOTE.find((m) => normalize(m.marca) === target);
  if (found) return found.prefijo;
  if (target.includes('roucon')) return 'R';
  if (target.includes('seixo')) return 'S';
  if (target.includes('palleiros')) return 'P';
  if (target.includes('edicion')) return 'E';
  return marca.slice(0, 1).toUpperCase() || 'M';
};

export const formatLoteComercialAppcc = (
  marca: string,
  numeroEmbotellado: number,
  anoCosecha: number
): string => {
  const prefijo = getMarcaPrefijoLote(marca);
  const numStr = String(Math.max(1, numeroEmbotellado)).padStart(2, '0');
  return `L-${prefijo}${numStr}/${anoCosecha}`;
};

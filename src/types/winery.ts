export type TipoRecipiente =
  | 'Inox cerrado'
  | 'Barrica roble francés'
  | 'Barrica castaño'
  | 'Ánfora'
  | 'Inox'
  | 'Siempre lleno abierto';

export const TIPOS_RECIPIENTE_BODEGA: TipoRecipiente[] = [
  'Ánfora',
  'Barrica castaño',
  'Barrica roble francés',
  'Inox',
  'Inox cerrado',
  'Siempre lleno abierto',
];

export type EstadoDeposito =
  | 'Vacío'
  | 'Maceración / Vendimia'
  | 'Fermentación Alcohólica'
  | 'Fermentación Maloláctica'
  | 'Crianza sobre lías'
  | 'Crianza en madera'
  | 'Estabilización / Reposo'
  | 'Listo para embotellar';

export type OperacionElaboracion =
  | 'Desfangado estático en frío'
  | 'Remontado / Bazuqueo'
  | 'Fermentación maloláctica'
  | 'Trasiego y desborre'
  | 'Battonage sobre lías finas'
  | 'Clarificación'
  | 'Estabilización por frío'
  | 'Filtración'
  | 'Ensamblaje / Coupage'
  | 'Sulfitado'
  | 'Correcciones';

export type MarcaVino =
  | 'Congostras'
  | 'Fontán'
  | 'O Roucon'
  | 'O Seixo'
  | 'Os Palleiros'
  | 'Rosado'
  | 'Xouba'
  | 'Roucón'
  | 'Seixo'
  | 'Palleiros'
  | 'Edición Especial';

export const MARCAS_COMERCIALES: MarcaVino[] = [
  'Congostras',
  'Fontán',
  'O Roucon',
  'O Seixo',
  'Os Palleiros',
  'Rosado',
  'Xouba',
];

export type TipoCorcho = 'natural' | '1+1';
export type TipoBotella = 'verde' | 'transparente';
export type TipoLacre = 'Rojo Burdeos' | 'Negro Grafito' | 'Verde Musgo' | 'Blanco Natural';
export type TipoEtiqueta =
  | 'xouba'
  | 'congostras'
  | 'roucon'
  | 'fontan'
  | 'seixo'
  | 'palleiros'
  | 'rosado';
export type TipoCaja = '2 botellas' | '3 botellas' | '6 botellas';

export interface VariedadPlantada {
  variedad: string;
  porcentajeEstimado: number;
  cepasAprox?: number;
}

export interface Parcela {
  id: string;
  nombre: string;
  paraje: string;
  superficieM2: number;
  superficieHa?: number;
  totalCepas?: number;
  marcoPlantacion?: string; // ej: "1x1.8m"
  altitudM: number;
  tipoSuelo: string;
  anoPlantacion: number;
  variedadesPlantadas: VariedadPlantada[];
  rendimientoMaxKg?: number;
  observaciones?: string;
}

export interface DesgloseVariedadKg {
  variedad: string;
  kg: number;
}

export type TipoVino = 'Blanco' | 'Tinto' | 'Rosado';

export const TIPOS_VINO: TipoVino[] = ['Blanco', 'Rosado', 'Tinto'];

export const VARIEDADES_PREDEFINIDAS: string[] = [
  'Albariño',
  'Albilla',
  'Blancas varias',
  'Brancellao',
  'Caíño Branco',
  'Caíño Bravo',
  'Caíño Longo',
  'Carabuñeira',
  'Espadeiro',
  'Ferrón',
  'Garnacha Tintorera',
  'Godello',
  'Gran Negro',
  'Lado',
  'Loureiro',
  'Mencía',
  'Palomino',
  'Sousón',
  'Tinta da Zorra',
  'Tintas Varias',
  'Treixadura',
];

export interface EntradaUva {
  id: string;
  fecha: string; // YYYY-MM-DD
  parcelaId: string;
  parcelaNombre: string;
  desgloseVariedades: DesgloseVariedadKg[];
  kgTotales: number;
  depositoDestinoId: string;
  litrosMosto: number; // Añadido a mano
  litrosEstimadosMosto?: number;
  rendimientoRealPorcentaje?: number; // Cálculo automático: (litrosMosto / kgTotales) * 100
  tipoRecipiente: TipoRecipiente;
  tipoVino: TipoVino;
  anada?: number;
  gradoBaboBaume?: number;
  fechaRegistro: string;
}

export interface ElaboracionRegistro {
  id: string;
  fecha: string;
  depositoOrigenId: string;
  depositoDestinoId?: string; // Opcional si la operación no trasiega
  destinoTipo: 'mismo_deposito' | 'deposito' | 'embotellado' | 'merma_limpieza';
  cantidadLitros: number;
  operacionRealizada: OperacionElaboracion;
  tipoVino: TipoVino;
  anada?: number;
  gradoAlcoholico?: number;
  cantidadSulfitado?: string; // ej: "35 g/hL" o "40 g metabisulfito"
  detalleCorreccion?: string; // ej: "Ácido tartárico 1.2 g/L"
  porcentajesVariedades: Array<{ variedad: string; porcentaje: number }>;
  temperaturaC?: number;
  densidad?: number;
  sulfurosoLibre?: number; // mg/L
  observaciones?: string;
  fechaRegistro: string;
}

export interface InsumosUtilizadosEmbotellado {
  tipoCorcho: TipoCorcho;
  tipoBotella: TipoBotella;
  lacre: boolean;
  colorLacre?: TipoLacre;
  tipoEtiqueta: TipoEtiqueta;
  tipoCaja: TipoCaja;
  cajasUtilizadas?: number;
}

export interface EmbotelladoRegistro {
  id: string;
  fecha: string;
  marca: MarcaVino;
  tipoVino?: TipoVino;
  anada?: number;
  depositoProcedenciaId: string;
  cantidadLitros: number;
  cantidadBotellas075: number; // Calculado: cantidadLitros / 0.75
  etiquetado: boolean; // Sí o No
  lote: string; // ej. L-24-XOU-01
  graduacionAlcoholicaVol?: number;
  insumos: InsumosUtilizadosEmbotellado;
  botellasDisponibles: number; // Disminuye con las salidas
  observaciones?: string;
  fechaRegistro: string;
}

export interface PlanoPosicion {
  x: number;
  y: number;
  zona: 'nave' | 'anexo';
  forma?: 'cilindro' | 'barrica' | 'anfora';
}

export interface Deposito {
  id: string; // ej: 1, 4F, AN, B1
  codigo: string;
  nombre: string;
  tipoRecipiente: TipoRecipiente;
  capacidadLitros: number;
  litrosActuales: number;
  estado: EstadoDeposito;
  anoCosecha: number;
  vinoNombre?: string;
  variedades: Array<{ variedad: string; litros: number; porcentaje: number }>;
  ultimaOperacion?: string;
  fechaUltimaOperacion?: string;
  ubicacion?: string; // Nave Principal, Anexo Superior, etc.
  plano?: PlanoPosicion;
}

export interface SalidaRegistro {
  id: string;
  fecha: string;
  marca: MarcaVino;
  lote: string;
  anada?: number;
  gradoAlcoholico?: number;
  embotelladoId?: string;
  cantidadBotellas: number;
  numeroCajas?: number;
  destino: string; // Cliente, Distribuidor, Restaurante, Exportación
  numeroAlbaranFactura: string;
  tipoSalida: 'Venta Nacional' | 'Exportación' | 'Muestra / Degustación' | 'Autoconsumo' | 'Merma / Rotura';
  pvpUnitario?: number;
  observaciones?: string;
  fechaRegistro: string;
}

export interface MovimientoInsumo {
  id: string;
  fecha: string;
  tipoInsumo: 'corchos' | 'botellas' | 'lacre' | 'etiquetas' | 'cajas';
  subtipo: string; // ej: 'natural', '1+1', 'verde', 'transparente', 'xouba', '6 botellas'
  movimiento: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  proveedor?: string;
  loteProveedor?: string;
  costeUnitario?: number;
  observaciones?: string;
  embotelladoLoteAsociado?: string;
  fechaRegistro: string;
}

export interface InsumoStockSummary {
  corchos: {
    natural: number;
    '1+1': number;
  };
  botellas: {
    verde: number;
    transparente: number;
  };
  lacreKg: number;
  etiquetas: Record<TipoEtiqueta, number>;
  cajas: {
    '2 botellas': number;
    '3 botellas': number;
    '6 botellas': number;
  };
}

export interface BodegaConfig {
  nombreBodega: string;
  denominacionOrigen?: string;
  cifNif: string;
  numeroRegistroVitivinicola: string; // NIF/RE
  direccion: string;
  localidad: string;
  provincia: string;
  responsableTecnico: string;
  anoCampana: number;
}

export interface ParametroAnalitica {
  nombre: string;
  valor: string;
}

export interface AnaliticaRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  muestra: string; // Nombre de muestra / vino / referencia del Excel
  vinoNombre?: string;
  depositoId?: string;
  archivoOrigen?: string;
  parametros: ParametroAnalitica[];
  observaciones?: string;
  fechaRegistro: string;
}

// Módulo Sanidad / APPCC (Registros y Plan APPCC Adega Microparaxes)
export interface AppccAguaRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD (Frecuencia Mensual · RD 3/2023)
  mesReferencia: string; // YYYY-MM
  lugarTomaMuestra: string; // ej. "Grifo zona elaboración"
  organolepticoConforme: boolean; // Color normal, sin olor, sin sabor, transparente
  cloroResidualMgL: number; // Rango RD 3/2023: 0,2 - 1,0 mg/l
  ph: number; // Rango habitual 6,5 - 9,5
  aspecto: string; // ej. "Limpio, incoloro, inodoro"
  anomaliaSuministro: boolean;
  responsable: string;
  observaciones?: string;
  origenAutomatico?: 'Frecuencia Mensual' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

export type CategoriaLimpiezaAppcc = 'INSTALACIONES' | 'MAQUINARIA' | 'DEPOSITOS';

export interface AppccLimpiezaRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  categoria?: CategoriaLimpiezaAppcc;
  zonaEquipo: string; // SUELO, PAREDES, DESPALILLADORA, BOMBAS, MANGUERAS, Nº1..Nº20, BARRICAS...
  productoUsado: string; // Sosa cáustica 5-10%, Desinfectante alimentario, Agua a presión...
  conforme: boolean; // true = OK, false = Incidencia
  responsable: string;
  origenAutomatico?:
    | 'Vendimia'
    | 'Elaboración / Trasiego'
    | 'Embotellado'
    | 'Frecuencia Semanal'
    | 'Frecuencia Mensual'
    | 'Manual';
  referenciaOperacionId?: string;
  editadoManualmente?: boolean;
  observaciones?: string;
  fechaRegistro: string;
}

export type TipoResiduoAppcc =
  | 'Bagazo de prensado'
  | 'Raspón de despalillado'
  | 'Residuos reciclables (vidrio/cartón/plástico)'
  | 'Residuos urbanos / desperdicios'
  | 'Residuos peligrosos (gestor autorizado)'
  | 'Efluentes / Aguas residuales';

export interface AppccResiduoRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipoResiduo: TipoResiduoAppcc;
  cantidadEstimada: string; // ej. "620 kg", "180 kg", "2 bolsas"
  destino: string; // ej. "A finca para compostar", "Contenedor reciclaje", "Gestor autorizado"
  parcelaDestino?: string;
  conforme?: boolean;
  responsable: string;
  origenAutomatico?: 'Vendimia' | 'Elaboración' | 'Embotellado' | 'Manual';
  referenciaOperacionId?: string;
  editadoManualmente?: boolean;
  observaciones?: string;
  fechaRegistro: string;
}

export interface AppccPlagaMantenimientoRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipoControl:
    | 'Vigilancia DDD (Plagas · Mensual)'
    | 'Tratamiento DDD Empresa Autorizada'
    | 'Mantenimiento Preventivo Equipos'
    | 'Mantenimiento Instalaciones';
  elementoZona: string; // OPERACIÓN / Zona
  localInstalaciones?: string; // Columna PDF Plan Mantenimiento: LOCAL E INSTALACIONES
  maquinariaUtensilios?: string; // Columna PDF Plan Mantenimiento: MAQUINARIA/UTENSILIOS
  resultado: 'Sin anomalías / Conforme' | 'Incidencia detectada';
  responsable: string;
  origenAutomatico?: 'Frecuencia Mensual' | 'Frecuencia Anual' | 'Manual';
  editadoManualmente?: boolean;
  observaciones?: string;
  fechaRegistro: string;
}

export interface AppccProveedorRegistro {
  id: string;
  proveedor: string;
  productos: string;
  localizacion: string;
  conforme: boolean;
  observaciones?: string;
  origenAutomatico?: 'Insumos / Bodega' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

export interface AppccIncidenciaRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  planAfectado: string;
  descripcion: string;
  medidaCorrectora: string;
  estado: 'Resuelta' | 'En seguimiento';
  responsable: string;
  fechaRegistro: string;
}

// Módulo Libros Agencia Tributaria (Impuestos Especiales - II.EE.)
export interface AeatMateriaPrimaSumaAnterior {
  entradasUvasKg: number;
  entradasBagazosKg: number;
  entradasMostoLitros: number;
  salidasUvasKg: number;
  salidasBagazosKg: number;
  salidasMostoLitros: number;
  existenciasUvasKg: number;
  existenciasBagazosKg: number;
  existenciasMostoLitros: number;
}

export interface AeatMateriaPrimaRegistro {
  id: string;
  numeroOrden: number;
  observaciones: string; // ej. "Colleita propia"
  fecha: string; // YYYY-MM-DD (visualizado DD/MM/YYYY)
  docNumero: string;
  nifOCae: string; // ej. "76721750Y"
  grado?: number; // ej. 12.2
  // Página 2 - ENTRADAS
  entradasUvasKg?: number;
  entradasBagazosKg?: number;
  entradasMostoLitros?: number;
  // Página 2 - SALIDAS
  salidasUvasKg?: number;
  salidasBagazosKg?: number;
  salidasMostoLitros?: number;
  // Página 2 - EXISTENCIAS
  existenciasUvasKg?: number;
  existenciasBagazosKg?: number;
  existenciasMostoLitros?: number;
  origenEntradaId?: string;
  origenAutomatico?: 'Vendimia' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

export interface AeatProductoElaboradoRegistro {
  id: string;
  // Página 1 - DATOS MOVIMIENTO
  numeroAsiento: number;
  fechaMovimiento: string; // YYYY-MM-DD (visualizado DD/MM/YYYY)
  tipoMovimiento: string; // Entrada, Obtención / Elaboración, Embotellado, Salida / Expedición, Trasiego, etc.
  regimenFiscal: string; // Suspensivo, Impuesto Devengado, Exento, etc.
  // Página 1 - PRODUCTO
  epigrafe: string; // EPÍGRAFE (3)
  codigoNc: string; // CÓDIGO NC (ej. 220421 / 220429)
  denominacionProducto: string; // DENOMINACIÓN / DESCRIPCIÓN PRODUCTO
  referenciaInterna: string; // REFERENCIA INTERNA PRODUCTO
  variedad: string; // VARIEDAD (4)
  cantidadProducto: number; // CANTIDAD DE PRODUCTO (Litros)
  gradoAlcoholico?: number; // GRADO ALCOHÓLICO (% vol)
  alcoholPuro?: number; // ALCOHOL PURO (Litros alcohol puro)
  // Página 2 - JUSTIFICANTE
  tipoJustificante: string; // TIPO JUSTIF.
  numeroJustificante: string; // NÚMERO JUSTIFICANTE
  // Página 2 - ENVASES
  tipoEnvase: string; // TIPO ENVASE
  capacidadEnvase: string; // CAPACIDAD
  numeroEnvases?: number; // Nº ENVASES
  // Página 2 - ORIGEN/DESTINO (MOVIMIENTOS EXTERNOS)
  origenDestinoNif: string; // NIF
  origenDestinoRazonSocial: string; // RAZÓN SOCIAL
  origenDestinoCae: string; // CAE
  // Página 2 - SALDOS EXISTENCIAS GRANEL
  saldoGranelBlanco?: number; // BLANCO
  saldoGranelTinto?: number; // TINTO
  // Página 2 - SALDOS EXISTENCIAS EMBOTELLADO
  saldoEmbotelladoBlanco?: number; // BLANCO
  saldoEmbotelladoTinto?: number; // TINTO
  origenMovimientoId?: string;
  origenTipo?: 'entrada' | 'elaboracion' | 'embotellado' | 'salida' | 'manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// Módulo Libros Medio Rural (Consellería do Medio Rural - Xunta de Galicia)

// Libro 1: Libro de Rexistro de Entradas e Saídas
export interface MedioRuralEntradaSalidaSuma {
  mostoBrancos: number;
  mostoTintos: number;
  vinoBrancos: number;
  vinoTintos: number;
}

export interface MedioRuralEntradaRegistro {
  id: string;
  data: string; // YYYY-MM-DD
  docClase: string; // Clase (2)
  docNumero: string; // Número (3)
  procedencia: string; // Existencias iniciais, Colleita propia, Fermentación, etc.
  zonaViticola: string; // ej. C II
  mostoBrancos?: number;
  mostoTintos?: number;
  vinoBrancos?: number;
  vinoTintos?: number;
  outrosDesignacion?: string;
  outrosCantidade?: string;
  graduacionAdquirida?: number; // A (4)
  graduacionTotal?: number; // T (5)
  observacions: string;
  origenMovimientoId?: string;
  origenAutomatico?: 'Vendimia' | 'Elaboración' | 'Histórico Libro' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

export interface MedioRuralSalidaRegistro {
  id: string;
  data: string; // YYYY-MM-DD
  docClase: string; // Clase (2)
  docNumeroReferencia: string; // Nº oficial de Referencia (3)
  destino: string; // Embotellado, Fin FA. pasa a ser viño, Venda, etc.
  zonaViticola: string; // ej. C II
  mostoBrancos?: number;
  mostoTintos?: number;
  vinoBrancos?: number;
  vinoTintos?: number;
  outrosDesignacion?: string;
  outrosCantidade?: string;
  graduacionAdquirida?: number; // A (4)
  graduacionTotal?: number; // T (5)
  observacions: string;
  origenMovimientoId?: string;
  origenAutomatico?: 'Embotellado' | 'Elaboración' | 'Salida' | 'Histórico Libro' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// Libro 2: Libro de Embotellados (Pág. 1 Entradas + Pág. 2 Saídas Embotellados)
export interface MedioRuralEmbotelladoSumaAnterior {
  entradasLitros: number;
  entradasBotellas: number;
  saidasLitros: number;
}

export interface MedioRuralEmbotelladoEntradaRegistro {
  id: string;
  data: string; // YYYY-MM-DD
  designacionProduto: string; // cor, grao, variedade, ano colleita
  litros: number;
  numBotellas: number;
  referenciaPrecintas: string; // ej. "/"
  lote: string;
  encargoNomeEmbotellador: string;
  encargoEnderezo: string;
  origenEmbotelladoId?: string;
  origenAutomatico?: 'Embotellado' | 'Histórico Libro' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

export interface MedioRuralEmbotelladoSalidaRegistro {
  id: string;
  data: string; // YYYY-MM-DD
  documentoComercial: string; // DOCUMENTO ACOMPAÑAMENTO OU COMERCIAL
  litros: number;
  observacions: string;
  origenSalidaId?: string;
  origenAutomatico?: 'Salida' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// Libro 3: Movementos de Produtos para Procesos de Elaboración e Prácticas Enolóxicas
export interface MedioRuralMovProductoSumaAnterior {
  acidoTartaricoEntradaKg: number;
  acidoTartaricoSaidaKg: number;
  mostoConcEntradaLitros: number;
  mostoConcSaidaLitros: number;
  alcoholEntradaLitros: number;
  alcoholSaidaLitros: number;
  sacarosaEntradaKg: number;
  sacarosaSaidaKg: number;
  outrosEntradaLitroKg: number;
  outrosSaidaLitroKg: number;
}

export interface MedioRuralMovimientoProductoRegistro {
  id: string;
  // Pág. 1
  data: string; // YYYY-MM-DD
  procedenciaRazonSocial: string;
  procedenciaEnderezo: string;
  destinoRazonSocial: string;
  destinoEnderezo: string;
  documentoFactura: string;
  acidoTartaricoEntradaKg?: number;
  acidoTartaricoSaidaKg?: number;
  // Pág. 2
  mostoConcConcentracion: string;
  mostoConcEntradaLitros?: number;
  mostoConcSaidaLitros?: number;
  alcoholTipoGrao: string;
  alcoholEntradaLitros?: number;
  alcoholSaidaLitros?: number;
  sacarosaEntradaKg?: number;
  sacarosaSaidaKg?: number;
  outrosProduto: string;
  outrosGradConcentracion: string;
  outrosEntradaLitroKg?: number;
  outrosSaidaLitroKg?: number;
  origenMovimientoId?: string;
  origenAutomatico?: 'Elaboración' | 'Insumos' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// Libro 4: Prácticas Enolóxicas
export interface MedioRuralPracticaEnologicaRegistro {
  id: string;
  // Pág. 1 - PRODUTO DE PARTIDA
  data: string; // YYYY-MM-DD
  partidaIdenEnvases: string;
  partidaProduto: string;
  partidaLitrosUtilizados: number;
  partidaGraduacionAdq?: number; // (1)
  partidaGraduacionTotal?: number; // (2)
  partidaAcidezTotalGl?: number; // Acidez Total en Tartárico g/l
  // Pág. 1 - PRÁCTICA ENOLÓXICA: SULFITADO
  sulfitadoProduto: string;
  sulfitadoDoseGl?: number;
  sulfitadoCantidadeKg?: number;
  // Pág. 1 - PRÁCTICA ENOLÓXICA: ACIDIFICACIÓN / DESACIDIFICACIÓN
  acidProduto: string;
  acidDosesGl?: number;
  acidCantidadeKg?: number;
  // Pág. 2 - OUTRAS PRÁCTICAS ENOLÓXICAS
  outrasProduto: string;
  outrasGradDensidade: string;
  outrasCantidadeKgOL: string;
  // Pág. 2 - PRODUTO FINAL
  finalIdenEnvases: string;
  finalProduto: string;
  finalLitrosObtidos: number;
  finalGraduacionAdq?: number; // (1)
  finalGraduacionTotal?: number; // (2)
  finalAcidezGl?: number;
  observacions: string; // Data de saída cara a lib. Rexistro
  origenMovimientoId?: string;
  origenAutomatico?: 'Elaboración' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// Libro 5: Procesos de Elaboración
export interface MedioRuralProcesoElaboracionRegistro {
  id: string;
  // Pág. 1
  num: number;
  dataInicio: string; // YYYY-MM-DD
  procesoCodigo: string; // (1) Códigos segundo Art. 10.4
  partidaIdenEnvases: string;
  partidaProduto: string;
  partidaLitrosUtilizados: number;
  partidaGradDensidade: string;
  incorporadoProduto: string;
  // Pág. 2
  incorporadoGradDensidade: string;
  incorporadoCantidadeLKg: string;
  finalIdenEnvases: string;
  finalProduto: string;
  finalLitrosObtidos: number;
  finalGradAdq?: number;
  finalGradTotal?: number;
  observacions: string; // Data de saída cara o libro de Rexistro
  origenMovimientoId?: string;
  origenAutomatico?: 'Vendimia' | 'Elaboración' | 'Manual';
  editadoManualmente?: boolean;
  fechaRegistro: string;
}

// ============================================================================
// MÓDULO 1: DECLARACIÓN DE VENDIMIA FOGGA (PROCEDEMENTO MR441B - XUNTA DE GALICIA)
// ============================================================================

export type FoggaCategoriaVinoKey =
  | 'dop'
  | 'ixp'
  | 'varietais'
  | 'senIx'
  | 'outros';

export interface FoggaCadroARow {
  superficieHa: number;
  tinta100Kg: number;
  branca100Kg: number;
  rendemento: number;
}

export interface FoggaCadroBRow {
  vinifPropiaTinta: number;
  vinifPropiaBranca: number;
  coopTinta: number;
  coopBranca: number;
  vendidaTinta: number;
  vendidaBranca: number;
  consumoFresco: number;
  pasificado: number;
  zume: number;
  mostoConc: number;
}

export interface FoggaCadroCDestinatario {
  id: string;
  nomeRazonSocial: string;
  nif: string;
  provincia: string;
  concello: string;
  dopTinta: number;
  dopBranca: number;
  ixpTinta: number;
  ixpBranca: number;
  varietaisTinta: number;
  varietaisBranca: number;
  senDopIxpTinta: number;
  senDopIxpBranca: number;
  outrosTinta: number;
  outrosBranca: number;
}

export interface FoggaPersoaDeclarante {
  nome: string;
  primeiroApelido: string;
  segundoApelido: string;
  nif: string;
  tipoVia: string;
  nomeVia: string;
  numero: string;
  bloq: string;
  andar: string;
  porta: string;
  parroquia: string;
  lugar: string;
  codigoPostal: string;
  provincia: string;
  concello: string;
  localidade: string;
  telefono: string;
  telefonoMobil: string;
  correoElectronico: string;
}

export interface FoggaMr441bDeclaracion {
  id: string;
  campanaInicio: number; // ej. 2024 -> Campaña 2024 / 2025
  campanaFin: number; // ej. 2025
  tipoDeclaracion: 'Alta' | 'Baixa' | 'Modificación';
  codev: string;
  vinedoSitoEn: string;
  concellos: string;
  declarante: FoggaPersoaDeclarante;
  cadroA: Record<FoggaCategoriaVinoKey, FoggaCadroARow>;
  cadroB: Record<FoggaCategoriaVinoKey, FoggaCadroBRow>;
  cadroC: FoggaCadroCDestinatario[];
  estado: 'borrador' | 'presentada';
  confirmadaPresentada: boolean; // Desactiva el aviso automático flotante
  fechaPresentacion?: string; // YYYY-MM-DD
  horaPresentacion?: string; // HH:mm
  numeroEntrada?: string; // ej. "2024/3466045"
  metodoFirma?: string; // "Chave365" | "Certificado dixital"
  lugarFirma?: string;
  xefaturaTerritorial?: string;
  observaciones?: string;
  origenDatos?: 'importada_pdf' | 'automatica_vendimia' | 'manual';
  fechaRegistro: string;
}

// ============================================================================
// MÓDULO 2: DECLARACIÓN CAU INFOVI (AICA - PRODUCTORES < 1.000 HL)
// ============================================================================

export type InfoviMesPeriodo = 'NOVIEMBRE' | 'JULIO';
export type InfoviCategoriaKey = 'dop' | 'igp' | 'varietalesSinIg' | 'sinIg';

export interface InfoviCuadroHRow {
  tintoRosado: number;
  blanco: number;
  superficieHa: number;
}

export interface InfoviCuadroIRow {
  tintoRosado: number;
  blanco: number;
}

export interface InfoviCuadroJRow {
  tintoGranel: number;
  tintoEnvasado: number;
  blancoGranel: number;
  blancoEnvasado: number;
}

export interface InfoviSalidaDestinos {
  interiores: InfoviCuadroJRow;
  mercadoUe: InfoviCuadroJRow;
  paisesTerceros: InfoviCuadroJRow;
}

export interface InfoviMostoDatos {
  cuadroG: Record<InfoviCategoriaKey, { tintoRosado: number; blanco: number; superficieHa: number; rendimiento: number }>;
  mostoConcentrado: { produccion: number; superficieHa: number; rendimiento: number };
  mostoRectificado: { produccion: number; superficieHa: number; rendimiento: number };
  mostoParcialFermentado: { produccion: number; superficieHa: number; rendimiento: number };
  cuadroHExistencias: {
    sinConcentrarTinto: number;
    sinConcentrarBlanco: number;
    concentrado: number;
    rectificado: number;
    parcialFermentado: number;
  };
}

export interface InfoviOperadorDatos {
  cifNif: string;
  nombreOperador: string;
  telefono: string;
  ria: string;
  email: string;
  domicilioBodega: string;
  domicilioProductor: string;
  poblacion: string;
  provincia: string;
  reovi: string;
  nidpb: string;
  tipoOperador: string;
}

export interface InfoviDeclaracion {
  id: string;
  campana: string; // ej. "2024/2025"
  campanaInicio: number; // ej. 2024
  mes: InfoviMesPeriodo; // 'NOVIEMBRE' (presentar 1-20 dic) | 'JULIO' (presentar 1-20 ago)
  operador: InfoviOperadorDatos;
  produccionMediaHl: number;
  estadoInfovi: 'BORRADOR' | 'CERRADA';
  cerradoPor: string; // "INSTALACIÓN" | "PROC. AUTOMÁTICO" | ""
  fechaUltGrabacion?: string; // YYYY-MM-DD
  fechaRecepcion?: string; // YYYY-MM-DD
  fechaImpresion?: string; // YYYY-MM-DD
  entradaUvaKg: {
    tinta: number;
    blanca: number;
  };
  cuadroH: Record<InfoviCategoriaKey, InfoviCuadroHRow>;
  cuadroI: Record<InfoviCategoriaKey, InfoviCuadroIRow>;
  cuadroJ: Record<InfoviCategoriaKey, InfoviCuadroJRow>;
  cuadroK: Record<InfoviCategoriaKey, InfoviSalidaDestinos>;
  mosto: InfoviMostoDatos;
  observaciones: string;
  estado: 'borrador' | 'presentada';
  confirmadaPresentada: boolean; // Desactiva el aviso automático flotante
  origenDatos?: 'importada_pdf' | 'automatica_bodega' | 'manual';
  fechaRegistro: string;
}

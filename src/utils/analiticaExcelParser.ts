import * as XLSX from 'xlsx';
import { Deposito, ParametroAnalitica } from '../types/winery';
import { getLocalIsoDate } from './dateUtils';

export interface ParsedAnaliticaRow {
  fecha: string;
  muestra: string;
  depositoId?: string;
  vinoNombre?: string;
  parametros: ParametroAnalitica[];
}

export interface ParsedExcelResult {
  sheetName: string;
  headers: string[];
  rows: ParsedAnaliticaRow[];
}

const normalizeStr = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const parseFlexibleDate = (raw: string): string | null => {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyFull = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyFull) {
    const [, d, m, y] = dmyFull;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY or DD-MM-YY or MM/DD/YY (common in Excel raw:false short dates)
  const dmyShort = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (dmyShort) {
    const first = Number(dmyShort[1]);
    const second = Number(dmyShort[2]);
    const y = `20${dmyShort[3]}`;
    // If second > 12, it was formatted M/D/YY by SheetJS default US locale -> swap
    if (second > 12 && first <= 12) {
      return `${y}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
    }
    return `${y}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
  }

  // Excel serial number (e.g. 46314)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const code = XLSX.SSF.parse_date_code(Number(s));
    if (code && code.y > 1990 && code.y < 2100) {
      return `${code.y}-${String(code.m).padStart(2, '0')}-${String(code.d).padStart(2, '0')}`;
    }
  }

  return null;
};

const extractDateFromFilename = (fileName: string): string | null => {
  const matchFull = fileName.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/);
  if (matchFull) {
    return `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
  }
  const matchShort = fileName.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{2})(?!\d)/);
  if (matchShort) {
    return `20${matchShort[3]}-${matchShort[2].padStart(2, '0')}-${matchShort[1].padStart(2, '0')}`;
  }
  return null;
};

export const matchDepositoForSample = (
  muestra: string,
  depositos: Deposito[],
  explicitDepText?: string
): { depositoId?: string; vinoNombre?: string } => {
  const candidates = [explicitDepText, muestra].filter(Boolean) as string[];

  for (const raw of candidates) {
    const norm = normalizeStr(raw);
    if (!norm) continue;

    // 1. Direct code match ("14", "4F", "B1", "Dep 14", "Depósito Nº 1")
    const strippedCode = norm.replace(/^(dep(osito)?|n[ºo°.]?|tanque|barrica|anfora)\s*/gi, '').trim();
    const byCode = depositos.find(
      (d) =>
        normalizeStr(d.codigo) === norm ||
        normalizeStr(d.codigo) === strippedCode
    );
    if (byCode) {
      return { depositoId: byCode.id, vinoNombre: byCode.vinoNombre || muestra };
    }

    // 2. Wine name match ("Xouba", "Congostras", etc.)
    const byWine = depositos.find((d) => {
      if (!d.vinoNombre) return false;
      const vn = normalizeStr(d.vinoNombre);
      return vn.includes(norm) || norm.includes(vn);
    });
    if (byWine) {
      return { depositoId: byWine.id, vinoNombre: byWine.vinoNombre };
    }
  }

  return {};
};

export const parseAnaliticaExcelBuffer = (
  buffer: ArrayBuffer,
  fileName: string,
  depositos: Deposito[]
): ParsedExcelResult => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas válidas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawGrid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  // Clean grid keeping only non-empty rows
  const nonEmptyRows = rawGrid
    .map((r) => r.map((cell) => String(cell ?? '').trim()))
    .filter((r) => r.some((cell) => cell !== ''));

  if (nonEmptyRows.length < 2) {
    throw new Error('El documento Excel necesita al menos una fila de cabecera y una fila de datos.');
  }

  // Find header row (first row with at least 2 populated cells)
  const headerIdx = nonEmptyRows.findIndex(
    (r) => r.filter((c) => c !== '').length >= 2
  );
  if (headerIdx === -1 || headerIdx === nonEmptyRows.length - 1) {
    throw new Error('No se detectó una tabla de analítica con cabeceras y valores.');
  }

  const headerRow = nonEmptyRows[headerIdx];
  const dataRows = nonEmptyRows.slice(headerIdx + 1);
  const todayIso = getLocalIsoDate();
  const fileDate = extractDateFromFilename(fileName);

  // Check if the sheet is transposed (2 columns, >= 4 rows, Col A = labels, Col B = numeric values)
  const activeColCount = headerRow.filter((c) => c !== '').length;
  const isTwoColVertical =
    activeColCount === 2 &&
    dataRows.length >= 3 &&
    dataRows.every((r) => r.filter((c) => c !== '').length <= 2);

  if (isTwoColVertical && parseFlexibleDate(headerRow[0]) === null && !/^(muestra|fecha|vino)/i.test(headerRow[0])) {
    // Check if headerRow itself is actually a key-value pair like ["GF", "0,36"]
    const valIsNumeric = /^[-+]?\d+([.,]\d+)?$/.test(headerRow[1]);
    if (valIsNumeric) {
      const allKvRows = [headerRow, ...dataRows];
      let fecha = fileDate || todayIso;
      let muestra = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
      const parametros: ParametroAnalitica[] = [];

      allKvRows.forEach(([k, v]) => {
        if (!k) return;
        const kn = normalizeStr(k);
        if (kn === 'fecha' || kn === 'date') {
          fecha = parseFlexibleDate(v) || fecha;
        } else if (kn === 'muestra' || kn === 'vino' || kn === 'referencia' || kn === 'sample') {
          muestra = v || muestra;
        } else {
          parametros.push({ nombre: k, valor: v });
        }
      });

      const match = matchDepositoForSample(muestra, depositos);
      return {
        sheetName: firstSheetName,
        headers: parametros.map((p) => p.nombre),
        rows: [
          {
            fecha,
            muestra,
            depositoId: match.depositoId,
            vinoNombre: match.vinoNombre,
            parametros,
          },
        ],
      };
    }
  }

  // Standard horizontal table (matches user's HECTOR_19-10-26 example and general lab Excels)
  // Trim trailing empty columns based on header & data usage
  let maxCol = 0;
  [headerRow, ...dataRows].forEach((r) => {
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] !== '') {
        maxCol = Math.max(maxCol, i);
        break;
      }
    }
  });

  const headers = headerRow.slice(0, maxCol + 1);

  // Determine metadata column indices
  let headerEmbeddedDate: string | null = null;
  let fechaColIdx = -1;
  let muestraColIdx = -1;
  let depositoColIdx = -1;

  headers.forEach((h, idx) => {
    const hn = normalizeStr(h);
    if (idx === 0) {
      const maybeDate = parseFlexibleDate(h);
      if (maybeDate) {
        headerEmbeddedDate = maybeDate;
        muestraColIdx = 0; // First column holds sample names like "HECTOR-FE"
        return;
      }
    }
    if (fechaColIdx === -1 && (hn === 'fecha' || hn === 'date' || hn === 'dia')) {
      fechaColIdx = idx;
    } else if (
      muestraColIdx === -1 &&
      (hn === 'muestra' || hn === 'referencia' || hn === 'vino' || hn === 'codigo' || hn === 'sample' || hn === 'nombre')
    ) {
      muestraColIdx = idx;
    } else if (
      depositoColIdx === -1 &&
      (hn === 'deposito' || hn === 'dep' || hn === 'tanque' || hn === 'recipiente')
    ) {
      depositoColIdx = idx;
    }
  });

  // Fallback: if no explicit muestra column, check if col 0 has text labels (not pure parameter numbers)
  if (muestraColIdx === -1 && dataRows.length > 0) {
    const col0Sample = dataRows[0][0] || '';
    if (col0Sample && !/^[-+]?\d+([.,]\d+)?$/.test(col0Sample) && headers[0] === '') {
      muestraColIdx = 0;
    } else if (col0Sample && !/^[-+]?\d+([.,]\d+)?$/.test(col0Sample) && fechaColIdx !== 0) {
      muestraColIdx = 0;
    }
  }

  const paramColIndices = headers
    .map((h, idx) => ({ h, idx }))
    .filter(
      ({ h, idx }) =>
        h !== '' &&
        idx !== fechaColIdx &&
        idx !== muestraColIdx &&
        idx !== depositoColIdx
    );

  const parsedRows: ParsedAnaliticaRow[] = [];

  dataRows.forEach((row, rIdx) => {
    const rowHasValues = row.some((c) => c !== '');
    if (!rowHasValues) return;

    const rawMuestra =
      muestraColIdx >= 0 && row[muestraColIdx]
        ? row[muestraColIdx]
        : `${fileName.replace(/\.(xlsx|xls|csv)$/i, '')}${dataRows.length > 1 ? ` #${rIdx + 1}` : ''}`;

    const rawFecha =
      fechaColIdx >= 0 && row[fechaColIdx]
        ? parseFlexibleDate(row[fechaColIdx])
        : null;

    const fecha = rawFecha || headerEmbeddedDate || fileDate || todayIso;
    const explicitDep = depositoColIdx >= 0 ? row[depositoColIdx] : undefined;
    const match = matchDepositoForSample(rawMuestra, depositos, explicitDep);

    const parametros: ParametroAnalitica[] = paramColIndices.map(({ h, idx }) => ({
      nombre: h,
      valor: row[idx] ?? '',
    }));

    // Skip rows where all parameter values are empty
    if (parametros.some((p) => p.valor !== '')) {
      parsedRows.push({
        fecha,
        muestra: rawMuestra,
        depositoId: match.depositoId,
        vinoNombre: match.vinoNombre,
        parametros,
      });
    }
  });

  if (parsedRows.length === 0) {
    throw new Error('No se encontraron filas con valores analíticos en el archivo Excel.');
  }

  return {
    sheetName: firstSheetName,
    headers: paramColIndices.map((c) => c.h),
    rows: parsedRows,
  };
};

export const downloadSampleAnaliticaExcel = () => {
  const aoa = [
    ['19/10/2026', 'GF', 'A.T', 'pH', 'Alc.', 'VA', 'Malic', 'Lactic', 'Sugar', 'Density', 'Glyc.', 'TPI', 'SO2 L'],
    ['HECTOR-FE', '0,36', '6,43', '3,54', '11,81', '0,66', '0,11', '1,38', '2,38', '0,99374', '8,06', '63', '9'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analitica');
  XLSX.writeFile(wb, 'Modelo_Analitica_Bodega.xlsx');
};

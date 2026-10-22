import * as XLSX from 'xlsx-js-style';

// Construye el texto de la columna "Entrada": el payload que se envió a SAP.
export function construirEntrada(row) {
  if (!row.entrada) return '';
  return JSON.stringify(row.entrada, null, 4);
}

// Construye el texto de la columna "Respuesta" (mensaje + bloque Info).
export function construirRespuesta(row) {
  if (!row.info) return row.mensaje || '';
  const info = {
    createdAt: row.info.createdAt,
    data: row.info.data,
    entity: row.info.entity,
    id: row.info.id,
  };
  return `${row.mensaje}\n\nInfo:\n${JSON.stringify(info, null, 4)}`;
}

const BORDE = { style: 'thin', color: { rgb: 'FFD0D5DD' } };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

// Estilo de encabezado: verde, texto blanco en negrita, centrado.
const ESTILO_CABECERA = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: 'FF16A34A' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDES,
};

/**
 * Exporta las filas de resultados a un archivo .xlsx, centrado y con formato legible.
 */
export function exportarExcel(rows) {
  const encabezados = ['Consolidado transferencia', 'Número de planilla', 'Estado migración', 'Estado HTTP', 'Entrada', 'Respuesta'];
  const matriz = [
    encabezados,
    ...rows.map((r) => [
      r.consolidado || '-',
      r.planilla || '-',
      r.estadoMigracion,
      r.httpStatus ?? '-',
      construirEntrada(r),
      construirRespuesta(r),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(matriz);
  ws['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 60 }, { wch: 82 }];
  // Alto de filas: encabezado compacto, filas de datos amplias (la Respuesta trae varias líneas).
  ws['!rows'] = matriz.map((_, i) => ({ hpt: i === 0 ? 24 : 92 }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }; // fija el encabezado al desplazar

  const rango = XLSX.utils.decode_range(ws['!ref']);
  for (let r = rango.s.r; r <= rango.e.r; r += 1) {
    for (let c = rango.s.c; c <= rango.e.c; c += 1) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })];
      if (!celda) continue;
      if (r === 0) {
        celda.s = ESTILO_CABECERA;
        continue;
      }
      const esTextoLargo = c === 4 || c === 5; // Entrada y Respuesta
      const estilo = {
        alignment: {
          horizontal: esTextoLargo ? 'left' : 'center',
          vertical: esTextoLargo ? 'top' : 'center',
          wrapText: true,
        },
        border: BORDES,
        font: { sz: 10 },
      };
      // "Estado migración" en color segun resultado.
      if (c === 2) {
        const exito = String(celda.v).toLowerCase() === 'exitoso';
        estilo.font = { sz: 10, bold: true, color: { rgb: exito ? 'FF15803D' : 'FFB91C1C' } };
      }
      celda.s = estilo;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Migración');

  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `migracion-anticipos-${fecha}.xlsx`);
}

import * as XLSX from 'xlsx';

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

/**
 * Exporta las filas de resultados a un archivo .xlsx.
 */
export function exportarExcel(rows) {
  const data = rows.map((r) => ({
    'Consolidado transferencia': r.consolidado || '-',
    'Número de planilla': r.planilla || '-',
    'Estado migración': r.estadoMigracion,
    'Estado HTTP': r.httpStatus ?? '-',
    Respuesta: construirRespuesta(r),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 70 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Migración');

  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `migracion-anticipos-${fecha}.xlsx`);
}

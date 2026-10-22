// Envio del anticipo al API de AWS y confirmacion por el log de la transaccion.
// La x-api-key es secreta y solo vive en el servidor (variable de entorno).

const AWS_API_BASE = process.env.AWS_API_BASE || 'https://uss5a626ei.execute-api.sa-east-1.amazonaws.com/prod';
const X_API_KEY = process.env.X_API_KEY || '';

// Simula el POST de creacion cuando aun no hay key real (confirma via GET /logs, que es publico).
export function simulaCreacion() {
  return (
    String(process.env.SIMULATE_CREATE || '').toLowerCase() === 'true' ||
    !X_API_KEY ||
    X_API_KEY === 'coloca_aqui_tu_api_key'
  );
}

export async function crearAnticipo(payload) {
  if (simulaCreacion()) {
    return { httpStatus: 201, simulated: true, id: payload.id, body: null };
  }
  const resp = await fetch(`${AWS_API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': X_API_KEY },
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text().catch(() => null);
  }
  const id = (body && (body.id || body.Id || body.transactionId)) || payload.id || null;
  return { httpStatus: resp.status, simulated: false, id, body };
}

// El procesamiento en SAP es asincrono: tras el POST, el log existe pero el status/message
// (exito o error final) aparece ~1-2 s despues. Por eso se consulta con reintentos cortos en vez
// de una sola lectura inmediata, que marcaba falsos "Error / (sin mensaje)".
export async function confirmarLog(id, { intentos = 6, esperaMs = 1500 } = {}) {
  let ultimo = { httpStatus: null, body: null };
  for (let i = 0; i < intentos; i++) {
    const resp = await fetch(`${AWS_API_BASE}/logs/${encodeURIComponent(id)}`);
    let body = null;
    try {
      body = await resp.json();
    } catch {
      body = null;
    }
    ultimo = { httpStatus: resp.status, body };
    // Listo cuando SAP ya dejo un estado final (success, o un message de error)
    if (resp.status === 200 && body && (body.status === 'success' || body.message)) return ultimo;
    if (i < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs));
  }
  return ultimo;
}

// Toma una lista de payloads (de Silogtran) y para cada uno crea + confirma. Devuelve filas de tabla.
export async function procesarPayloads(payloads) {
  const rows = [];
  for (const item of payloads) {
    const row = {
      consolidado: item.consolidado,
      planilla: item.planilla,
      estadoMigracion: 'Error',
      httpStatus: null,
      mensaje: '',
      info: null,
      entrada: item.payload, // lo que se envia a SAP (para la columna "Entrada" del reporte)
    };
    try {
      const creado = await crearAnticipo(item.payload);
      row.httpStatus = creado.httpStatus;
      row.simulated = creado.simulated;
      if (creado.httpStatus === 201 && creado.id) {
        const log = await confirmarLog(creado.id);
        if (log.httpStatus === 200 && log.body) {
          const b = log.body;
          row.estadoMigracion = b.status === 'success' ? 'Exitoso' : 'Error';
          row.mensaje = b.message || '(sin mensaje)';
          row.info = { createdAt: b.createdAt, data: b.data, entity: b.entity, id: b.id };
        } else {
          row.mensaje = `Creado (${creado.httpStatus}) pero la confirmacion fallo (log ${log.httpStatus}).`;
        }
      } else {
        row.mensaje =
          (creado.body && (creado.body.message || JSON.stringify(creado.body))) ||
          `La creacion no devolvio 201 (http ${creado.httpStatus}).`;
      }
    } catch (e) {
      row.mensaje = 'Error de red/proceso: ' + e.message;
    }
    rows.push(row);
  }
  return rows;
}

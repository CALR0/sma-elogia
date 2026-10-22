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

export async function confirmarLog(id) {
  const resp = await fetch(`${AWS_API_BASE}/logs/${encodeURIComponent(id)}`);
  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  return { httpStatus: resp.status, body };
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

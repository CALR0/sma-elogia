// Cliente del backend. El frontend nunca ve la x-api-key ni las credenciales de Silogtran:
// la sesion viaja en una cookie HttpOnly cifrada que pone el servidor.

const headersJSON = { 'Content-Type': 'application/json', 'x-app': '1' };

async function post(path, body) {
  const resp = await fetch(path, {
    method: 'POST',
    headers: headersJSON,
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try {
    data = await resp.json();
  } catch {
    /* sin cuerpo */
  }
  if (!resp.ok) throw new Error((data && data.error) || `Error ${resp.status}`);
  return data;
}

export async function obtenerSesion() {
  const resp = await fetch('/api/sesion', { credentials: 'same-origin' });
  if (!resp.ok) return { activa: false };
  return resp.json();
}

export function iniciarSesion(usuario, clave) {
  return post('/api/login', { usuario, clave });
}

export function cerrarSesion() {
  return post('/api/logout', {});
}

export async function procesarValor(tipo, valor) {
  const data = await post('/api/procesar', { tipo, valor });
  return data.rows || [];
}

// Separa el texto pegado en una lista de valores (coma, espacio o salto de linea).
export function parseEntradas(texto) {
  return String(texto || '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

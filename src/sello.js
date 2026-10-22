// Sellos cifrados (AES-256-GCM): guardan datos del servidor en manos del navegador sin que se
// puedan leer ni alterar. Se usan para la sesion (cookies de Silogtran), de modo que el servidor
// no necesita memoria compartida ni base de datos (apto para Vercel / varias instancias).
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const EN_PRODUCCION = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';

function obtenerClave() {
  const secreto = process.env.SESSION_SECRET || '';
  if (secreto.length >= 32) return crypto.createHash('sha256').update(`anticipos:${secreto}`).digest();
  if (EN_PRODUCCION) {
    throw new Error('SESSION_SECRET es obligatorio en produccion (minimo 32 caracteres aleatorios).');
  }
  // Desarrollo local: clave aleatoria por proceso (las sesiones se pierden al reiniciar).
  console.warn('[seguridad] SESSION_SECRET no definido: se usa una clave temporal (solo desarrollo).');
  return crypto.randomBytes(32);
}

const CLAVE = obtenerClave();

// tipo: distingue usos ('sesion') para que un sello no sirva en otro contexto.
export function sellar(tipo, datos, ttlMs) {
  const cuerpo = zlib.deflateRawSync(Buffer.from(JSON.stringify({ t: tipo, exp: Date.now() + ttlMs, d: datos })));
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', CLAVE, iv);
  cifrador.setAAD(Buffer.from(tipo));
  const cifrado = Buffer.concat([cifrador.update(cuerpo), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]).toString('base64url');
}

// Devuelve los datos o null si el sello es invalido, de otro tipo o expiro.
export function abrir(tipo, sello) {
  try {
    if (typeof sello !== 'string' || sello.length < 40 || sello.length > 200_000) return null;
    const bruto = Buffer.from(sello, 'base64url');
    const descifrador = crypto.createDecipheriv('aes-256-gcm', CLAVE, bruto.subarray(0, 12));
    descifrador.setAAD(Buffer.from(tipo));
    descifrador.setAuthTag(bruto.subarray(12, 28));
    const cuerpo = Buffer.concat([descifrador.update(bruto.subarray(28)), descifrador.final()]);
    const { t, exp, d } = JSON.parse(zlib.inflateRawSync(cuerpo, { maxOutputLength: 2_000_000 }).toString());
    if (t !== tipo || typeof exp !== 'number' || Date.now() > exp) return null;
    return d;
  } catch {
    return null;
  }
}

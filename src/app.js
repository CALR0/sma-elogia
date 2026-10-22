// App Express: autenticacion por usuario contra Silogtran, sesion cifrada en cookie (sin BD) y
// procesamiento de anticipos. Reutilizable en Vercel (api/index.js) y local (server.js).
import express from 'express';
import * as cookieLib from 'cookie';
import { sellar, abrir } from './sello.js';
import { Silogtran, SilogtranError, normalizarPlanilla } from './silogtran.js';
import { procesarPayloads, simulaCreacion } from './anticipos.js';

const SILOG_BASE_URL = process.env.SILOG_BASE_URL || 'https://construproyec.colombiasoftware.net';
const EN_PROD =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1';
const COOKIE = EN_PROD ? '__Host-anticipos' : 'anticipos_sesion';
const INACTIVIDAD_MS = 30 * 60 * 1000; // la cookie vive 30 min; se renueva en cada peticion
const SESION_MAX_MS = 12 * 60 * 60 * 1000; // tope absoluto de la sesion

// --- Sesion (cookie sellada) ---------------------------------------------
function guardarSesion(res, datos) {
  res.setHeader(
    'Set-Cookie',
    cookieLib.serialize(COOKIE, sellar('sesion', datos, INACTIVIDAD_MS), {
      httpOnly: true,
      sameSite: 'strict',
      secure: EN_PROD,
      path: '/',
      maxAge: Math.floor(INACTIVIDAD_MS / 1000),
    })
  );
}
function borrarSesion(res) {
  res.setHeader(
    'Set-Cookie',
    cookieLib.serialize(COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: EN_PROD, path: '/', maxAge: 0 })
  );
}
function leerSesion(req) {
  const raw = cookieLib.parse(req.headers.cookie || '')[COOKIE];
  const d = raw ? abrir('sesion', raw) : null;
  if (!d || typeof d.iat !== 'number' || Date.now() - d.iat > SESION_MAX_MS) return null;
  return d;
}

// --- App -----------------------------------------------------------------
export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', EN_PROD ? 1 : false);
  app.use(express.json({ limit: '1mb' }));

  // Cabeceras de seguridad basicas.
  app.use('/api', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // CSRF-lite para mutaciones: solo JSON, cabecera propia y Origin del mismo host.
  app.use('/api', (req, res, next) => {
    if (req.method === 'POST') {
      if (req.get('x-app') !== '1') return res.status(400).json({ error: 'Peticion no valida.' });
      // En produccion (mismo origen) se exige que Origin coincida con el host. En desarrollo el
      // proxy de Vite hace que Origin (:5173) y host (:3001) difieran, asi que no se aplica.
      const origin = req.get('origin');
      if (EN_PROD && origin) {
        try {
          if (new URL(origin).host !== req.get('host')) return res.status(400).json({ error: 'Origen no permitido.' });
        } catch {
          return res.status(400).json({ error: 'Origen no valido.' });
        }
      }
    }
    next();
  });

  // Estado de sesion.
  app.get('/api/sesion', (req, res) => {
    const s = leerSesion(req);
    res.json({ activa: Boolean(s), usuario: s?.u || null, simulado: simulaCreacion() });
  });

  // Login con credenciales de Silogtran.
  app.post('/api/login', async (req, res) => {
    const usuario = String(req.body?.usuario ?? '').trim().slice(0, 64);
    const clave = String(req.body?.clave ?? '').slice(0, 128);
    if (!usuario || !clave) return res.status(400).json({ error: 'Usuario y contrasena son obligatorios.' });
    try {
      const cli = new Silogtran(SILOG_BASE_URL);
      await cli.login(usuario, clave);
      guardarSesion(res, { u: usuario, iat: Date.now(), c: cli.exportarCookies() });
      res.json({ ok: true, usuario });
    } catch (e) {
      const msg = e instanceof SilogtranError ? e.message : 'No se pudo iniciar sesion en Silogtran.';
      res.status(401).json({ error: msg });
    }
  });

  app.post('/api/logout', (req, res) => {
    borrarSesion(res);
    res.json({ ok: true });
  });

  // Procesa un valor (planilla o consolidado): Silogtran -> AWS. Protegida por sesion.
  app.post('/api/procesar', async (req, res) => {
    const s = leerSesion(req);
    if (!s) return res.status(401).json({ error: 'Sesion no valida o expirada. Inicia sesion de nuevo.' });

    const tipo = req.body?.tipo;
    const valor = String(req.body?.valor ?? '').trim();
    if (!['planilla', 'consolidado'].includes(tipo) || !valor) {
      return res.status(400).json({ error: 'Parametros invalidos (tipo/valor).' });
    }

    try {
      const cli = new Silogtran(SILOG_BASE_URL, s.c);
      const payloads = await cli.buscarLog(tipo, valor);
      // Renueva la sesion con las cookies actualizadas por Silogtran.
      guardarSesion(res, { u: s.u, iat: s.iat, c: cli.exportarCookies() });

      if (!payloads.length) {
        return res.json({
          rows: [
            {
              consolidado: tipo === 'consolidado' ? valor : null,
              planilla: tipo === 'planilla' ? normalizarPlanilla(valor) : '-',
              estadoMigracion: 'Error',
              httpStatus: null,
              mensaje: 'Registro no encontrado para este documento.',
              info: null,
            },
          ],
        });
      }
      const rows = await procesarPayloads(payloads);
      res.json({ rows });
    } catch (e) {
      if (e instanceof SilogtranError && e.sesionExpirada) {
        borrarSesion(res);
        return res.status(401).json({ error: 'La sesion de Silogtran expiro. Inicia sesion de nuevo.' });
      }
      const msg = e instanceof SilogtranError ? e.message : 'Error procesando la solicitud.';
      res.status(502).json({ error: msg });
    }
  });

  // Manejo de errores generico.
  app.use((err, _req, res, _next) => {
    console.error('[app] error:', err);
    res.status(500).json({ error: 'Error interno.' });
  });

  return app;
}

// Cliente HTTP para Silogtran (PRADO/PHP, renderizado en servidor; no hay API JSON).
// Reproduce lo que hace el navegador: login por postback (con panel de centro de costo) y la
// busqueda en el Log de la Interfaz (Maestros.Interfaz.BuscarLogInterfaz) para extraer el payload
// del metodo "Anticipo Flota Tercero Create". Basado en el patron de CALR0/fvec-elogia.
import * as cheerio from 'cheerio';

const LOGIN_PAGE = 'index.php?page=LoginPage';
const LOG_PAGE = 'index.php?page=Maestros.Interfaz.BuscarLogInterfaz';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const INTERFAZ_ID = process.env.SILOGTRAN_INTERFAZ_ID || '139';
const INTERFAZ_TEXT = process.env.SILOGTRAN_INTERFAZ_TEXT || 'QAS DAABON OC SAP';
const FECHA_INI = process.env.SILOGTRAN_FECHA_INI || '2026-01-01';
const FECHA_FIN = process.env.SILOGTRAN_FECHA_FIN || '2030-01-01';

export class SilogtranError extends Error {
  constructor(msg, { sesionExpirada = false } = {}) {
    super(msg);
    this.sesionExpirada = sesionExpirada;
  }
}

const esLogin = (html) => html.includes('ctl0$MainModule$BtnIngresar');

function decodificar(buf, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() || 'utf-8';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

// Campos que el navegador enviaria en un postback PRADO (sin botones).
function camposFormulario(html) {
  const $ = cheerio.load(html);
  const form = $('form').first();
  if (!form.length) throw new SilogtranError('No se encontro el formulario en la pagina.');
  const datos = {};
  form.find('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const nombre = $el.attr('name');
    if (!nombre || $el.is('[disabled]')) return;
    const tipo = ($el.attr('type') || '').toLowerCase();
    if (el.tagName === 'input' && ['submit', 'button', 'image', 'reset'].includes(tipo)) return;
    if (['checkbox', 'radio'].includes(tipo) && !$el.is('[checked]')) return;
    if (el.tagName === 'select') {
      const op = $el.find('option[selected]').first().length ? $el.find('option[selected]').first() : $el.find('option').first();
      datos[nombre] = op.attr('value') ?? op.text();
    } else if (el.tagName === 'textarea') {
      datos[nombre] = $el.text();
    } else {
      datos[nombre] = $el.attr('value') ?? '';
    }
  });
  return { $, form, datos };
}

// Extrae los payloads del metodo de creacion del HTML de resultados del Log de la Interfaz.
// Para MOSTRAR: las planillas son como "0101222750"; si las consultan sin el 0 inicial ("101222750")
// se antepone un 0 para la tabla/reporte. Si ya trae 0 o no es numérica, queda igual. No afecta la
// creación (que usa el payload de Silogtran tal cual).
export function normalizarPlanilla(v) {
  const s = String(v ?? '').trim();
  return /^[1-9]\d*$/.test(s) ? '0' + s : s;
}

// En cada fila del grid, el "Documento" (consolidado de transferencia) viene en un input hl_documento
// cuyo value trae un <a ...contra_codigo=NNN>NNN</a> (HTML escapado). Devuelve el número o null.
function extraerConsolidado($, idTextarea) {
  const idDoc = idTextarea.replace('_hl_parametrosentrada', '_hl_documento');
  const v = $(`#${idDoc}`).attr('value') || '';
  const m = v.match(/contra_codigo=(\d+)/) || v.replace(/<[^>]*>/g, ' ').match(/(\d+)/);
  return m ? m[1] : null;
}

function parsearPayloads(html, tipo, valor) {
  const $ = cheerio.load(html);
  const resultados = [];
  $('textarea').each((_, el) => {
    const id = $(el).attr('id') || '';
    if (!id.includes('hl_parametrosentrada')) return;
    const raw = $(el).text();
    if (!raw.includes('"type":"AnticipoContabSet.create"')) return; // descarta GET LogById
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    // Siempre mostramos ambos: planilla (del payload) y consolidado (del grid). Por consolidado ya
    // conocemos el valor; por planilla lo sacamos de la fila. Una planilla puede traer varias
    // transferencias de consolidados distintos (una fila por cada una).
    resultados.push({
      planilla: normalizarPlanilla(payload?.data?.Zplanilla || (tipo === 'planilla' ? valor : '?')),
      consolidado: tipo === 'consolidado' ? valor : extraerConsolidado($, id),
      payload,
    });
  });
  return resultados;
}

export class Silogtran {
  // cookies: sesion de Silogtran previa (de exportarCookies), para continuar sin volver a iniciar sesion.
  constructor(baseUrl, cookies = null) {
    this.base = baseUrl.replace(/\/?$/, '/');
    this.origen = new URL(this.base).origin;
    this.jar = new Map(
      Array.isArray(cookies) ? cookies.filter((c) => Array.isArray(c) && c.length === 2).map(([k, v]) => [String(k), String(v)]) : []
    );
    this.ocupado = Promise.resolve(); // serializa peticiones: PRADO guarda estado por sesion
  }

  exportarCookies() {
    return [...this.jar];
  }

  _guardarCookies(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [par, ...attrs] = c.split(';');
      const i = par.indexOf('=');
      const nombre = par.slice(0, i).trim();
      const valor = par.slice(i + 1).trim();
      const borrar = valor === 'deleted' || attrs.some((a) => /max-age=0\b/i.test(a.trim()));
      if (borrar) this.jar.delete(nombre);
      else this.jar.set(nombre, valor);
    }
  }

  async _request(path, { method = 'GET', form = null } = {}) {
    let url = new URL(path, this.base);
    let wafIntentos = 0;
    for (let saltos = 0; saltos < 10; saltos++) {
      // Nunca enviar las cookies de Silogtran a otro dominio (redirecciones incluidas).
      if (url.origin !== this.origen) throw new SilogtranError('Redireccion fuera de Silogtran bloqueada.');
      const headers = { 'user-agent': UA, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') };
      if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
      const res = await fetch(url, {
        method,
        headers,
        body: form ? new URLSearchParams(form).toString() : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
      });
      this._guardarCookies(res);
      // Silogtran esta detras de AWS WAF: un desafio llega sin el HTML de Silogtran. Un navegador
      // headless lo resuelve y aporta la cookie aws-waf-token, que se guarda en el jar y se reintenta.
      if (res.headers.get('x-amzn-waf-action') === 'challenge') {
        if (wafIntentos >= 1) {
          throw new SilogtranError(
            'El firewall de Silogtran (AWS WAF) sigue bloqueando tras el navegador. Reintente en unos minutos o pida a Colombia Software que autorice la IP del servidor.'
          );
        }
        wafIntentos += 1;
        await this._resolverWaf();
        continue; // reintenta la MISMA url, ya con el token en el jar
      }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        url = new URL(res.headers.get('location'), url);
        if (res.status !== 307 && res.status !== 308) {
          method = 'GET';
          form = null;
        }
        continue;
      }
      const body = Buffer.from(await res.arrayBuffer());
      return { status: res.status, url: url.href, body, type: res.headers.get('content-type') || '', headers: res.headers };
    }
    throw new SilogtranError('Demasiadas redirecciones.');
  }

  // Resuelve el desafio de AWS WAF con un navegador real y copia la cookie aws-waf-token al jar.
  async _resolverWaf() {
    if (process.env.WAF_NAVEGADOR === '0') {
      throw new SilogtranError('AWS WAF esta bloqueando y la resolucion esta desactivada (WAF_NAVEGADOR=0).');
    }
    const cookies = process.env.WAF_WORKER_URL
      ? await this._tokenDesdeWorker(process.env.WAF_WORKER_URL)
      : await this.obtenerCookiesWaf();
    for (const c of cookies) {
      if (String(c.name).toLowerCase().startsWith('aws-waf')) this.jar.set(c.name, String(c.value));
    }
    if (![...this.jar.keys()].some((k) => k.toLowerCase().startsWith('aws-waf'))) {
      throw new SilogtranError('No se obtuvo el token de AWS WAF.');
    }
  }

  async _tokenDesdeWorker(workerUrl) {
    const esperaMs = (Number(process.env.WAF_ESPERA_SEG) || 30) * 1000;
    let r;
    try {
      r = await fetch(new URL('/api/waf-token', workerUrl).href, {
        method: 'POST',
        headers: { 'x-waf-secret': process.env.WAF_WORKER_SECRET || '' },
        signal: AbortSignal.timeout(esperaMs + 15000),
      });
    } catch (e) {
      throw new SilogtranError(`No se pudo contactar el worker de AWS WAF: ${e?.message || e}`);
    }
    if (!r.ok) throw new SilogtranError(`El worker de AWS WAF respondio HTTP ${r.status}.`);
    const data = await r.json().catch(() => null);
    if (!Array.isArray(data?.cookies) || !data.cookies.length) {
      throw new SilogtranError('El worker de AWS WAF no devolvio el token.');
    }
    return data.cookies;
  }

  // Abre un Chromium headless que resuelve el challenge y devuelve las cookies aws-waf.
  // En Vercel/serverless usa @sparticuz/chromium; en local/VM usa el Chrome del sistema (WAF_CHROME_PATH).
  async obtenerCookiesWaf() {
    const esperaMs = (Number(process.env.WAF_ESPERA_SEG) || 30) * 1000;
    let puppeteer;
    try {
      puppeteer = (await import('puppeteer-core')).default;
    } catch {
      throw new SilogtranError('Falta puppeteer-core para pasar el desafio de AWS WAF.');
    }

    let launchOpts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], defaultViewport: { width: 1280, height: 800 } };
    if (process.env.WAF_CHROME_PATH) {
      launchOpts.executablePath = process.env.WAF_CHROME_PATH;
    } else {
      // @sparticuz/chromium solo trae binario Linux (Vercel/Lambda). En otros SO sin
      // WAF_CHROME_PATH no se puede lanzar: se avisa claro en vez de crashear el proceso.
      if (process.platform !== 'linux') {
        throw new SilogtranError(
          'Para pasar AWS WAF en local (no-Linux) define WAF_CHROME_PATH con la ruta de tu Chrome. En Vercel no hace falta.'
        );
      }
      // Serverless (Vercel/Linux): Chromium empaquetado para Lambda.
      let chromium;
      try {
        chromium = (await import('@sparticuz/chromium')).default;
      } catch {
        throw new SilogtranError('Falta WAF_CHROME_PATH (Chrome local) o @sparticuz/chromium (serverless) para pasar AWS WAF.');
      }
      launchOpts = {
        args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport,
      };
    }

    let navegador;
    try {
      navegador = await puppeteer.launch(launchOpts);
      const pagina = await navegador.newPage();
      await pagina.setUserAgent(UA);
      try {
        await pagina.goto(new URL(LOGIN_PAGE, this.base).href, { waitUntil: 'domcontentloaded', timeout: esperaMs });
      } catch {
        /* aunque la navegacion no "termine", el token puede quedar fijado; se revisa abajo */
      }
      const limite = Date.now() + esperaMs;
      let cookies = [];
      while (Date.now() < limite) {
        cookies = await pagina.cookies();
        if (cookies.some((c) => c.name === 'aws-waf-token')) break;
        await new Promise((res) => setTimeout(res, 500));
      }
      cookies = cookies.filter((c) => c.name.toLowerCase().startsWith('aws-waf')).map((c) => ({ name: c.name, value: c.value }));
      if (!cookies.length) {
        throw new SilogtranError(`El navegador no obtuvo el token de AWS WAF en ${esperaMs / 1000}s.`);
      }
      return cookies;
    } catch (e) {
      if (e instanceof SilogtranError) throw e;
      throw new SilogtranError(`No se pudo abrir el navegador para AWS WAF: ${e?.message || e}`);
    } finally {
      if (navegador) await navegador.close().catch(() => {});
    }
  }

  async _html(path, opts) {
    const r = await this._request(path, opts);
    if (r.status >= 400) throw new SilogtranError(`Silogtran respondio HTTP ${r.status}.`);
    return { ...r, text: decodificar(r.body, r.type) };
  }

  _enCola(fn) {
    const p = this.ocupado.then(fn, fn);
    this.ocupado = p.catch(() => {});
    return p;
  }

  // Login en pasos: usuario/clave -> (panel centro de costo: primero + Continuar) -> inicio.
  login(usuario, clave) {
    return this._enCola(async () => {
      const pag = await this._html(LOGIN_PAGE);
      const { form, datos } = camposFormulario(pag.text);
      Object.assign(datos, {
        'ctl0$MainModule$Usuario': usuario,
        'ctl0$MainModule$Clave': clave,
        PRADO_POSTBACK_TARGET: 'ctl0$MainModule$BtnIngresar',
        'ctl0$MainModule$BtnIngresar': 'Iniciar Sesion',
      });
      let r = await this._html(new URL(form.attr('action') || LOGIN_PAGE, pag.url).href, { method: 'POST', form: datos });

      for (let paso = 0; paso < 3; paso++) {
        if (r.text.includes('ctl0$MainModule$centrocosto')) {
          r = await this._continuarCentroCosto(r);
          continue;
        }
        if (r.text.includes('ctl0$MainModule$verification_code')) {
          throw new SilogtranError('El usuario tiene verificacion en dos pasos (2FA); esta herramienta aun no la soporta.');
        }
        if (r.text.includes('ctl0$MainModule$NuevaClave')) {
          throw new SilogtranError('Silogtran exige cambiar la contrasena. Cambiela primero en Silogtran.');
        }
        if (esLogin(r.text)) {
          const $ = cheerio.load(r.text);
          const msg = $('#ctl0_MainModule_ErrorPanel').text().replace(/\s+/g, ' ').trim();
          throw new SilogtranError(msg || 'Usuario o contrasena incorrectos.');
        }
        break;
      }

      const prueba = await this._html(LOG_PAGE);
      if (esLogin(prueba.text)) throw new SilogtranError('Silogtran no acepto el inicio de sesion.');
    });
  }

  async _continuarCentroCosto(r) {
    const { $, form, datos } = camposFormulario(r.text);
    const nombre = 'ctl0$MainModule$centrocosto';
    const campo = $(`[name="${nombre}"]`).first();
    if (campo.is('select')) {
      const opcion = campo
        .find('option')
        .toArray()
        .map((o) => ({ valor: $(o).attr('value') ?? $(o).text(), texto: $(o).text().trim() }))
        .find((o) => o.valor !== '' && !/seleccione/i.test(o.texto));
      if (!opcion) throw new SilogtranError('El usuario no tiene centros de costo disponibles.');
      datos[nombre] = opcion.valor;
    } else if (!datos[nombre]) {
      throw new SilogtranError('No se pudo seleccionar el centro de costo automaticamente.');
    }

    const boton = 'ctl0$MainModule$BtnContinuar';
    const url = new URL(form.attr('action') || LOGIN_PAGE, r.url).href;
    const esCallback = /TActive\w*Button\(\{'ID':'ctl0_MainModule_BtnContinuar'/.test(r.text);
    if (!esCallback) {
      datos.PRADO_POSTBACK_TARGET = boton;
      datos[boton] = $('#ctl0_MainModule_BtnContinuar').attr('value') || 'Continuar';
      return this._html(url, { method: 'POST', form: datos });
    }
    datos.PRADO_CALLBACK_TARGET = boton;
    datos.PRADO_CALLBACK_PARAMETER = 'null';
    const cb = await this._html(url, { method: 'POST', form: datos });
    const destino =
      cb.headers.get('x-prado-redirect') || /<!--X-PRADO-REDIRECT-->\s*"?([^"<]+)"?\s*<!--/.exec(cb.text)?.[1] || 'index.php';
    return this._html(new URL(destino.replace(/\\\//g, '/'), url).href);
  }

  // Busca en el Log de la Interfaz por planilla (Datos de Entrada) o consolidado (Documento) y
  // devuelve los payloads del metodo "Anticipo Flota Tercero Create". Consultar de a uno.
  buscarLog(tipo, valor) {
    return this._enCola(async () => {
      const pag = await this._html(LOG_PAGE);
      if (esLogin(pag.text)) throw new SilogtranError('La sesion de Silogtran expiro.', { sesionExpirada: true });
      const { form, datos } = camposFormulario(pag.text);
      Object.assign(datos, {
        'ctl0$MainModule$interfaz_codigo': INTERFAZ_TEXT,
        'ctl0$MainModule$interfaz_codigo$IDHidden': INTERFAZ_ID,
        'ctl0$MainModule$iteint_parametros_entrada': tipo === 'planilla' ? valor : '',
        'ctl0$MainModule$iteint_documento': tipo === 'consolidado' ? valor : '',
        'ctl0$MainModule$iteint_fechainicial': FECHA_INI,
        'ctl0$MainModule$iteint_fechafinal': FECHA_FIN,
        PRADO_POSTBACK_TARGET: 'ctl0$MainModule$ctl3',
        'ctl0$MainModule$ctl3': 'Buscar',
      });
      const r = await this._html(new URL(form.attr('action') || LOG_PAGE, pag.url).href, { method: 'POST', form: datos });
      if (esLogin(r.text)) throw new SilogtranError('La sesion de Silogtran expiro.', { sesionExpirada: true });
      return parsearPayloads(r.text, tipo, valor);
    });
  }
}

# Contexto del proyecto — Migración de anticipos a SAP

> Para retomar en otra sesión. Qué hace, cómo funciona, qué está implementado y qué falta.
> Última actualización: 2026‑10‑22. Patrón de integración basado en
> [CALR0/fvec-elogia](https://github.com/CALR0/fvec-elogia).

---

## 1. Objetivo

App web interna donde un operador reenvía a SAP anticipos de **flota de terceros** que no se
migraron bien. **Inicia sesión con sus credenciales de Silogtran**, pega un listado de
**planillas** (Datos de Entrada) o **consolidados de transferencia** (Documento), y por cada uno:

1. El backend extrae de Silogtran el **payload** del método "Anticipo Flota Tercero Create".
2. Lo reenvía al API de AWS: `POST /events` con header `x-api-key`.
3. Confirma con `GET /logs/{id}` y muestra el `message`.
4. Tabla con paginación de 5, exportable a Excel. **No se almacena nada.**

---

## 2. Arquitectura (replica de fvec-elogia)

- **Un solo servicio en Vercel**: frontend estático (`client/dist`) + API serverless
  (`api/index.js` → `src/app.js`, Express). Mismo código corre en local (`server.js`) o en una VM.
- **Sin base de datos, sin estado en el servidor**: la sesión = cookies de Silogtran **selladas
  con AES‑256‑GCM** (`src/sello.js`) dentro de una cookie `HttpOnly __Host-anticipos`. En cada
  petición protegida se abre el sello, se reconstruye `new Silogtran(base, cookies)`, se trabaja y
  se vuelve a sellar (renueva cookies e inactividad). Inactividad 30 min, tope 12 h.
- **x-api-key** (AWS) secreta: solo en variables de entorno del backend, nunca en el navegador.

### Login por usuario (PRADO) — `src/silogtran.js`
`login(usuario, clave)`:
1. GET `index.php?page=LoginPage` → `camposFormulario` (incluye `PRADO_PAGESTATE`).
2. POST con `ctl0$MainModule$Usuario`, `$Clave`, `PRADO_POSTBACK_TARGET=…$BtnIngresar`,
   `$BtnIngresar`.
3. **Panel de centro de costo**: elige la primera opción válida y pulsa *Continuar*
   (`BtnContinuar`), sea **postback** normal o **callback AJAX** de PRADO (`X-PRADO-REDIRECT`).
4. Reporta credenciales inválidas, **2FA** (no soportado) y cambio de clave obligatorio.
5. Verifica con un GET a la página del log.

> **Sin hashing en el cliente** (verificado): la clave viaja en texto plano sobre HTTPS; el
> backend la postea tal cual.

### AWS WAF — lo más delicado
Silogtran está detrás de **AWS WAF**. Un `fetch` de Node recibe un *challenge*
(`x-amzn-waf-action: challenge`). Se resuelve con un navegador headless que obtiene la cookie
`aws-waf-token`, **se guarda en el jar** (y por tanto en la cookie de sesión sellada), y se
reintenta. Así el navegador solo se lanza al **iniciar sesión / renovar el token**, no en cada
consulta.
- **Vercel**: `@sparticuz/chromium` + `puppeteer-core` (incluidos). Node **20.x** (el 22 tiene bug
  `libnspr4`). `maxDuration` 60 s en `vercel.json`.
- **Local/VM**: `WAF_CHROME_PATH` apunta al Chrome del sistema.
- **Opcional**: `WAF_WORKER_URL` para delegar el token a otra instancia con navegador.
- **Alternativa sin navegador**: que Colombia Software **autorice la IP** del servidor (VM con IP
  fija, p.ej. Oracle Cloud Always Free) → el WAF deja de retar.

### Búsqueda del log — `buscarLog(tipo, valor)`
GET del formulario `Maestros.Interfaz.BuscarLogInterfaz` → POST con
`interfaz_codigo$IDHidden=139` (interfaz "QAS DAABON OC SAP"),
`iteint_parametros_entrada=<planilla>` **o** `iteint_documento=<consolidado>`, fechas
`2026-01-01`/`2030-01-01`, `ctl3=Buscar` → parsea los `textarea …hl_parametrosentrada` que
contienen `"type":"AnticipoContabSet.create"` (descarta los GET LogById). **Filtro literal: se
consulta de a uno** (no admite varias planillas/consolidados juntos).

---

## 3. Datos de Silogtran verificados

- Interfaz "QAS DAABON OC SAP" = **ID interno 139**.
- Campos: Datos de Entrada=`iteint_parametros_entrada` (planilla), Documento=`iteint_documento`
  (consolidado), Fecha=`iteint_fechainicial/fechafinal`, botón Buscar=`ctl3`.
- Consolidado 20126 → 2 planillas (0101224688, 0101224681); por consolidado también salen GET
  `LogById` que se filtran.
- AWS: `POST /events` (x-api-key) → 201 + id; `GET /logs/{id}` **público** → `status:"success"`,
  `message:"Anticipo creado con numero de documento …"`; 404 si no existe.

---

## 4. API interna

Rutas POST: `Content-Type: application/json` + cabecera `x-app: 1` (CSRF‑lite) + Origin del host.

| Ruta | Entrada | Respuesta |
|---|---|---|
| `GET /api/sesion` | — | `{ activa, usuario, simulado }` |
| `POST /api/login` | `{ usuario, clave }` | `{ ok, usuario }` + cookie · 400/401 |
| `POST /api/logout` | — | `{ ok }` + borra cookie |
| `POST /api/procesar` (protegida) | `{ tipo, valor }` | `{ rows: [...] }` · 400/401/502 |

`SIMULATE_CREATE=true` (o `X_API_KEY` placeholder) → no crea anticipos; confirma con `/logs`.

---

## 5. Estructura

```
api/index.js        # Vercel (reexporta la app)
server.js           # local (carga .env)
src/app.js          # Express: rutas, sesión cifrada, CSRF-lite, seguridad
src/sello.js        # sellar/abrir AES-256-GCM
src/silogtran.js    # clase Silogtran: login PRADO + WAF + buscarLog
src/anticipos.js    # crearAnticipo (/events) + confirmarLog (/logs) + procesarPayloads
client/             # React + Vite + Tailwind (login real, tabla, Excel, tema)
vercel.json · package.json · .env(.example)
```

---

## 6. Variables de entorno

`SESSION_SECRET` (obligatoria en prod, ≥32), `X_API_KEY` (secreta), `SILOG_BASE_URL`,
`SILOGTRAN_INTERFAZ_ID/TEXT`, `SILOGTRAN_FECHA_INI/FIN`, `AWS_API_BASE`, `SIMULATE_CREATE`,
`WAF_CHROME_PATH` (local), `WAF_WORKER_URL/SECRET`, `WAF_NAVEGADOR`, `WAF_ESPERA_SEG`, `PORT/HOST`.

---

## 7. Estado y pendientes

- ✅ Login por‑usuario (PRADO + centro de costo), sesión cifrada sin BD, rutas protegidas.
- ✅ Extracción real del log + reenvío AWS + confirmación; frontend con login real.
- ✅ Resolución de AWS WAF con `@sparticuz/chromium` (Vercel) / Chrome local.
- ✅ Verificado que backend y frontend **cargan/compilan**; `/api/sesion` y validación de login OK.
- ⏳ **Probar con credenciales reales de Silogtran** (login + WAF) en local (`WAF_CHROME_PATH`) o
  tras desplegar en Vercel. No se pudo probar aquí (requiere la contraseña del usuario).
- ⏳ Poner `X_API_KEY` real y `SIMULATE_CREATE=false` para crear de verdad.
- ⏳ Afinar versiones `@sparticuz/chromium`/`puppeteer-core` si Vercel reporta incompatibilidad
  (fijar Node 20.x en Vercel).

### Notas de implementación
- `camposFormulario` excluye botones; por eso se añade `ctl3=Buscar`/`BtnIngresar` a mano.
- El cliente Silogtran serializa peticiones (`_enCola`) porque PRADO guarda estado por sesión.
- Carpeta `server/` antigua quedó vacía (migrada a `src/`); git no rastrea carpetas vacías.

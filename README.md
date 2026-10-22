# SMA · Sistema de Migración de Anticipos

Aplicación web interna de **ELOGIA SOLUCIONES LOGISTICAS S.A.S** para reenviar a SAP los anticipos
de flota de terceros que no se migraron correctamente. El usuario entra con su cuenta de Silogtran,
pega las planillas (o los consolidados de transferencia) que quedaron pendientes, y la app se encarga
de volver a enviarlos y de confirmar, uno por uno, si quedaron creados en SAP.

---

## El problema que resuelve

Cuando un anticipo de flota de tercero no alcanza a migrar bien a SAP, toca volver a enviarlo a mano:
buscar la planilla en el log de la interfaz de Silogtran, copiar el contenido que se mandó, pegarlo en
el API que crea el anticipo y después revisar si de verdad se creó. Para una planilla es tedioso; para
una lista larga, inviable.

SMA hace ese recorrido completo por cada planilla y muestra el resultado en una tabla.

---

## Cómo funciona

1. El usuario inicia sesión con **su mismo usuario y contraseña de Silogtran**.
2. Elige si va a trabajar **por planilla** o **por consolidado de transferencia** y pega la lista
   (separada por comas, espacios o saltos de línea).
3. Por cada entrada, el servidor:
   - Busca en el **Log de la Interfaz** de Silogtran (interfaz "QAS DAABON OC SAP") y saca el
     contenido del método *Anticipo Flota Tercero Create* — el JSON que originalmente se envió.
   - Lo reenvía al API de AWS con un `POST /events` (la clave `x-api-key` vive solo en el servidor).
   - Confirma el resultado con `GET /logs/{id}` y lee el mensaje que devuelve SAP.
4. La tabla se va llenando a medida que avanza, con una fila por planilla: consolidado, número de
   planilla, estado de la migración (Exitoso / Error), código HTTP y el mensaje de respuesta con su
   detalle. Tiene paginación y se puede **exportar a Excel**.

Un consolidado puede contener varias planillas, así que genera varias filas; una planilla genera una
sola. Importante: el filtro de Silogtran es una coincidencia literal, por eso se consulta **de a uno**
(no admite varias planillas o consolidados en la misma búsqueda).

**Nada se guarda.** No hay base de datos: los resultados viven solo en la pantalla del usuario hasta
que recarga o exporta.

---

## Autenticación

El diseño de autenticación es el mismo que usa [fvec-elogia](https://github.com/CALR0/fvec-elogia):
cada usuario entra con sus credenciales de Silogtran y el servidor no guarda ninguna sesión en
memoria ni en una base de datos.

- **Login contra Silogtran.** Silogtran está hecho en PRADO (PHP), así que el inicio de sesión es un
  formulario que se reenvía ("postback"): usuario y clave → pantalla de **centro de costo** (se elige
  el primero y se pulsa *Continuar*, sea postback normal o callback AJAX) → inicio. El servidor hace
  esos pasos tal como lo haría un navegador y conserva las cookies que devuelve Silogtran. La clave se
  usa una sola vez para entrar y no se almacena en ninguna parte.
- **Sesión sin estado.** Esas cookies de Silogtran se meten dentro de una **cookie cifrada y firmada**
  (AES-256-GCM) que solo el servidor puede abrir. En cada consulta se abre esa cookie, se reconstruye
  el cliente de Silogtran con las cookies de adentro, se hace el trabajo y se vuelve a sellar (lo que
  renueva la inactividad y guarda las cookies actualizadas). Esto permite correr en Vercel —donde cada
  petición es una función nueva, sin memoria compartida— sin necesidad de base de datos.
- **AWS WAF.** Silogtran está detrás de AWS WAF, que a una petición normal de servidor le responde con
  un *challenge* en lugar del HTML. Para pasarlo, el servidor abre un **Chromium headless** que resuelve
  el desafío y obtiene la cookie `aws-waf-token`; ese token queda guardado dentro de la cookie de
  sesión, así que el navegador solo se abre al **iniciar sesión** (o cuando el token caduca), no en cada
  consulta. En Vercel el Chromium lo provee `@sparticuz/chromium`; en local se usa el Chrome del sistema
  (variable `WAF_CHROME_PATH`).

La cookie es `HttpOnly`, `SameSite=Strict` y, en HTTPS, `Secure` con prefijo `__Host-`. Vence a los
30 minutos sin uso y a las 12 horas como máximo. La API solo acepta peticiones de la propia página
(cabecera propia + verificación de origen).

---

## Estructura

```
├── api/index.js          Entrada para Vercel (expone la app Express)
├── server.js             Arranque local (carga .env)
├── src/
│   ├── app.js            Rutas, sesión, seguridad
│   ├── sello.js          Cifrado de la sesión (AES-256-GCM)
│   ├── silogtran.js      Cliente de Silogtran (login, AWS WAF, búsqueda en el log)
│   └── anticipos.js      Envío al API de AWS (crear) y confirmación (log)
├── client/               Frontend: React + Vite + Tailwind
│   └── src/              App.jsx, pages/ (Login, Migracion), components/, lib/
├── vercel.json           Configuración de Vercel (build, función, rutas)
├── .env.example          Variables de entorno
├── README.md             Este documento
└── PROJECT_CONTEXT.md    Documentación técnica detallada
```

El backend es la misma app de Express corriendo de dos formas: como función serverless en Vercel
(`api/index.js`) o como proceso local (`server.js`). El frontend se construye aparte (`client/`) y se
publica como estático.

---

## Uso local

Requisito: Node.js 20.12 o superior (en Vercel corre con Node 24, ver despliegue).

```bash
npm run install:all        # instala backend (raíz) y client/
copy .env.example .env      # y completa SESSION_SECRET
npm run dev                 # API en :3001 + frontend en :5173
```

En local, para pasar el AWS WAF hay que apuntar `WAF_CHROME_PATH` al Chrome del sistema, por ejemplo:

```
WAF_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

---

## Despliegue en Vercel

Todo va en un solo proyecto de Vercel (frontend estático + API como función serverless), sin Render ni
base de datos. `vercel.json` ya define el build y la función; no hay que elegir framework.

1. En **Project Settings → Node.js Version** elige **24.x** (ya va fijado en `engines` del
   `package.json`).
2. En **Environment Variables** crea:

   | Variable | Uso |
   |---|---|
   | `SESSION_SECRET` | **Obligatoria.** Cadena aleatoria de 32+ caracteres; cifra la sesión. |
   | `X_API_KEY` | Clave del header `x-api-key` del `POST /events` (para crear de verdad). |
   | `SIMULATE_CREATE` | `true` para no crear anticipos reales y solo confirmar por `/logs` (demo). |
   | `SILOG_BASE_URL` | Opcional. Instancia de Silogtran. |

3. Despliega. Si falta `SESSION_SECRET`, la función se niega a arrancar (es intencional). El Chromium
   para el WAF lo trae `@sparticuz/chromium`, no hay que configurar nada más.

Cambiar `SESSION_SECRET` cierra todas las sesiones abiertas.

---

## Qué se puede modificar

- Colores y diseño: `client/tailwind.config.js` y los componentes de `client/src/`.
- Interfaz y columnas de la tabla: `client/src/pages/` y `components/`.
- Interfaz de Silogtran, fechas del filtro, etc.: variables `SILOGTRAN_*` del `.env`.
- Lo que depende de la estructura de Silogtran (nombres de campos PRADO, el login): `src/silogtran.js`.
  Tocar solo si Silogtran cambia.

Señales de que Silogtran cambió: el login falla con credenciales correctas, o todas las búsquedas
salen vacías.

---

© ELOGIA SOLUCIONES LOGISTICAS S.A.S · Todos los derechos reservados.

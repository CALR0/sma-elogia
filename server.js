// Arranque local del backend (para desarrollo). Carga .env antes de importar la app, porque
// algunos modulos leen variables de entorno al cargarse. En Vercel se usa api/index.js.
import 'dotenv/config';

const { crearApp } = await import('./src/app.js');

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const app = crearApp();
app.listen(PORT, HOST, () => {
  console.log(`[migracion-anticipos] backend en http://${HOST}:${PORT}`);
});

// Entrada de Vercel (funcion serverless). Reexporta la app Express; Vercel la invoca por peticion.
// Las variables de entorno (SESSION_SECRET, X_API_KEY, etc.) se configuran en el panel de Vercel.
import { crearApp } from '../src/app.js';

const app = crearApp();
export default app;

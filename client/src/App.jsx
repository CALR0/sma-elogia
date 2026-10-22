import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import Migracion from './pages/Migracion.jsx';
import { obtenerSesion, cerrarSesion } from './lib/api.js';

export default function App() {
  const [sesion, setSesion] = useState(null); // { usuario }
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    obtenerSesion()
      .then((s) => {
        if (s.activa) setSesion({ usuario: s.usuario });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  async function salir() {
    setCerrando(true);
    try {
      // Minimo visible para que el "Cerrando sesion..." no parpadee si el cierre es instantaneo.
      await Promise.all([cerrarSesion().catch(() => {}), new Promise((r) => setTimeout(r, 500))]);
    } finally {
      setSesion(null);
      setCerrando(false);
    }
  }

  if (cargando) {
    return (
      <div className="grid min-h-full place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
      </div>
    );
  }

  return (
    <>
      {!sesion ? <Login onLogin={(usuario) => setSesion({ usuario })} /> : <Migracion sesion={sesion} onLogout={salir} />}

      {cerrando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/75 backdrop-blur-sm dark:bg-slate-950/75">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Cerrando sesión…</p>
          </div>
        </div>
      )}
    </>
  );
}

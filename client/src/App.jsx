import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import Migracion from './pages/Migracion.jsx';
import { obtenerSesion, cerrarSesion } from './lib/api.js';

export default function App() {
  const [sesion, setSesion] = useState(null); // { usuario }
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerSesion()
      .then((s) => {
        if (s.activa) setSesion({ usuario: s.usuario });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  async function salir() {
    try {
      await cerrarSesion();
    } catch {
      /* ignorar */
    }
    setSesion(null);
  }

  if (cargando) {
    return (
      <div className="grid min-h-full place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
      </div>
    );
  }

  if (!sesion) {
    return <Login onLogin={(usuario) => setSesion({ usuario })} />;
  }
  return <Migracion sesion={sesion} onLogout={salir} />;
}

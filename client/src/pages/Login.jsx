import { useState } from 'react';
import { LogIn, User, Lock, Leaf, Loader2, AlertCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { iniciarSesion } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const usuario = user.trim();
    if (!usuario || !pass) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setCargando(true);
    try {
      const r = await iniciarSesion(usuario, pass);
      onLogin(r.usuario || usuario);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-brand-50 dark:bg-slate-950"
        style={{
          backgroundImage:
            'radial-gradient(42rem 30rem at 15% 0%, rgba(51,153,90,0.28), transparent 60%),' +
            'radial-gradient(38rem 28rem at 100% 100%, rgba(29,98,58,0.30), transparent 55%)',
        }}
      />
      <svg className="absolute -bottom-10 -left-10 -z-10 h-72 w-72 text-brand-300/40 dark:text-brand-800/40" viewBox="0 0 200 200" fill="currentColor">
        <path d="M100 0C60 40 40 70 40 110a60 60 0 1 0 120 0c0-40-20-70-60-110Z" />
      </svg>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="flex min-h-full items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-600 text-white shadow-soft ring-1 ring-brand-700/20">
              <Leaf className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-brand-800 dark:text-brand-200">
              Elogia Soluciones Logísticas S.A.S
            </h1>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-600/80 dark:text-brand-400/80">
              Sistema de Migración de Anticipos
            </p>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-soft backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Migración de anticipos a SAP</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Ingresa con tus credenciales de Silogtran.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuario</span>
                <div className="mt-1.5 relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="Usuario"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-brand-900"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</span>
                <div className="mt-1.5 relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-brand-900"
                  />
                </div>
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {cargando ? 'Verificando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            © 2026 Elogia Soluciones Logísticas S.A.S · Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

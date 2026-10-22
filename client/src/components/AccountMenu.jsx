import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { iniciales } from '../lib/user.js';

// Menú de cuenta al estilo fvec-elogia: avatar que despliega un panel con el nombre,
// un switch sol/luna para el modo oscuro y la opción de cerrar sesión.
export default function AccountMenu({ usuario, onLogout }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );
  const ref = useRef(null);

  // Aplica y persiste el tema.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    try {
      localStorage.setItem('tema', dark ? 'dark' : 'light');
    } catch (e) {
      /* noop */
    }
  }, [dark]);

  // Cerrar al hacer clic fuera o con Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const nombre = String(usuario || '').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      {/* Avatar */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menú de la cuenta"
        className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-emerald-200 text-sm font-extrabold text-brand-800 shadow-sm ring-2 transition hover:-translate-y-px ${
          open ? 'ring-brand-400' : 'ring-white/60 dark:ring-slate-700'
        }`}
      >
        {iniciales(usuario)}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 max-w-[calc(100vw-24px)] origin-top-right animate-fade-in rounded-2xl border border-brand-100 bg-white p-2 shadow-soft dark:border-slate-700 dark:bg-slate-900">
          {/* Flecha */}
          <span className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-brand-100 bg-white dark:border-slate-700 dark:bg-slate-900" />

          {/* Usuario */}
          <div className="mb-1.5 flex items-center gap-2.5 border-b border-brand-100 px-2 pb-3 pt-2 dark:border-slate-700">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-emerald-200 text-sm font-extrabold text-brand-800">
              {iniciales(usuario)}
            </span>
            <div className="min-w-0">
              <b className="block truncate text-sm tracking-wide text-slate-800 dark:text-slate-100">{nombre}</b>
              <small className="text-xs text-slate-500 dark:text-slate-400">Sesión de Silogtran</small>
            </div>
          </div>

          {/* Modo oscuro */}
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
              </svg>
            </span>
            <span className="flex-1">Modo oscuro</span>
            <SolLunaSwitch dark={dark} onToggle={() => setDark((d) => !d)} />
          </div>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="flex-1">Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Interruptor sol/luna animado (réplica del de fvec).
function SolLunaSwitch({ dark, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo oscuro"
      onClick={onToggle}
      className="relative h-[30px] w-14 flex-none rounded-full shadow-inner transition-colors"
      style={{
        background: dark
          ? 'linear-gradient(135deg, #1e293b, #312e81)'
          : 'linear-gradient(135deg, #7dd3fc, #fde68a)',
      }}
    >
      <span
        className="absolute top-[3px] grid h-6 w-6 place-items-center rounded-full bg-white shadow-md transition-transform duration-300"
        style={{ left: '3px', transform: dark ? 'translateX(26px)' : 'none', color: dark ? '#fde68a' : '#f59e0b' }}
      >
        {dark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}

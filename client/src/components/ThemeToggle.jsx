import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Toggle de modo oscuro. Persiste en localStorage y alterna la clase 'dark'
// en <html> (Tailwind darkMode: 'class').
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(() => {
    if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('tema', dark ? 'dark' : 'light');
    } catch (e) {
      /* noop */
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      aria-label="Cambiar tema"
      className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

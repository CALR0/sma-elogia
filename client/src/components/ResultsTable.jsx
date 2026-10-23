import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { construirRespuesta } from '../lib/export.js';

const PAGE_SIZE = 5;

function EstadoBadge({ estado }) {
  const estilos = {
    Exitoso: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
    Duplicado: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
    Error: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900',
  };
  const Icono = estado === 'Exitoso' ? CheckCircle2 : estado === 'Duplicado' ? AlertTriangle : XCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        estilos[estado] || estilos.Error
      }`}
    >
      <Icono className="h-3.5 w-3.5" />
      {estado}
    </span>
  );
}

function HttpBadge({ code }) {
  if (code == null) return <span className="text-slate-400">—</span>;
  const cls =
    code >= 200 && code < 300
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900'
      : code >= 400
      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900'
      : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-mono font-medium ring-1 ${cls}`}>{code}</span>
  );
}

export default function ResultsTable({ rows }) {
  const [page, setPage] = useState(0);
  const [openRow, setOpenRow] = useState(null);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const slice = useMemo(
    () => rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    [rows, current]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-brand-50/60 dark:bg-slate-800/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Consolidado</th>
              <th className="px-4 py-3">Planilla</th>
              <th className="px-4 py-3">Estado migración</th>
              <th className="px-4 py-3">HTTP</th>
              <th className="px-4 py-3">Respuesta</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {slice.map((row, i) => {
              const idx = current * PAGE_SIZE + i;
              const isOpen = openRow === idx;
              return (
                <tr key={idx} className="align-top hover:bg-brand-50/40 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{row.consolidado || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">{row.planilla}</td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={row.estadoMigracion} />
                    {row.simulated && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        simulado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <HttpBadge code={row.httpStatus} />
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{row.mensaje}</div>
                    {isOpen && row.info && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
                        {construirRespuesta(row)}
                      </pre>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.info && (
                      <button
                        onClick={() => setOpenRow(isOpen ? null : idx)}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        title="Ver detalle"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-brand-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
        <span className="text-slate-500 dark:text-slate-400">
          {rows.length} resultado{rows.length !== 1 ? 's' : ''} · página {current + 1} de {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <button
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages - 1}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

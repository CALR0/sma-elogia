import { useMemo, useState } from 'react';
import {
  Leaf,
  Play,
  FileSpreadsheet,
  Trash2,
  Loader2,
  FileText,
  Layers,
  CheckCircle2,
  XCircle,
  ListChecks,
  AlertTriangle,
} from 'lucide-react';
import ResultsTable from '../components/ResultsTable.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import { procesarValor, parseEntradas, dedupeEntradas } from '../lib/api.js';
import { exportarExcel } from '../lib/export.js';

export default function Migracion({ sesion, onLogout }) {
  const [tipo, setTipo] = useState('planilla'); // 'planilla' | 'consolidado'
  const [texto, setTexto] = useState('');
  const [rows, setRows] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [error, setError] = useState('');

  const entradas = useMemo(() => parseEntradas(texto), [texto]);
  const unicas = useMemo(() => dedupeEntradas(entradas, tipo), [entradas, tipo]);
  const duplicados = entradas.length - unicas.length;
  const resumen = useMemo(() => {
    const ok = rows.filter((r) => r.estadoMigracion === 'Exitoso').length;
    return { total: rows.length, ok, err: rows.length - ok };
  }, [rows]);

  async function procesar() {
    setError('');
    const lista = dedupeEntradas(parseEntradas(texto), tipo); // no se procesan duplicados
    if (!lista.length) {
      setError('Ingresa al menos una ' + (tipo === 'planilla' ? 'planilla' : 'consolidado') + '.');
      return;
    }
    setProcesando(true);
    setRows([]);
    setProgreso({ hecho: 0, total: lista.length });

    const acc = [];
    for (let i = 0; i < lista.length; i++) {
      try {
        const nuevas = await procesarValor(tipo, lista[i]);
        acc.push(...nuevas);
      } catch (e) {
        acc.push({
          consolidado: tipo === 'consolidado' ? lista[i] : null,
          planilla: tipo === 'planilla' ? lista[i] : '-',
          estadoMigracion: 'Error',
          httpStatus: null,
          mensaje: e.message,
          info: null,
        });
      }
      setRows([...acc]);
      setProgreso({ hecho: i + 1, total: lista.length });
    }
    setProcesando(false);
  }

  function limpiar() {
    setRows([]);
    setTexto('');
    setError('');
    setProgreso({ hecho: 0, total: 0 });
  }

  const pct = progreso.total ? Math.round((progreso.hecho / progreso.total) * 100) : 0;

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-600 text-white">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-brand-800 dark:text-brand-200">SMA</span>
          </div>

          <AccountMenu usuario={sesion?.usuario} onLogout={onLogout} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reenvío de anticipos no migrados
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Pega un listado de planillas o de consolidados de transferencias. Se consultará cada uno,
            se reenviará el anticipo y se confirmará el resultado.
          </p>
        </div>

        {/* Layout de dos columnas: controles | resultados */}
        <div className="grid gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
          {/* Columna de controles */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-xl border border-brand-100 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                <TabBtn active={tipo === 'planilla'} onClick={() => setTipo('planilla')} icon={FileText}>
                  Por planilla
                </TabBtn>
                <TabBtn active={tipo === 'consolidado'} onClick={() => setTipo('consolidado')} icon={Layers}>
                  Por consolidado
                </TabBtn>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {tipo === 'planilla' ? 'Listado de planillas' : 'Listado de consolidados'}
                </span>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={6}
                  placeholder={
                    tipo === 'planilla' ? 'Ej: 0101224688, 0101224681\n0101219923' : 'Ej: 20126, 20127'
                  }
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-brand-900"
                />
              </label>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Separador: coma, espacio o salto de línea.{' '}
                <span className="font-medium text-slate-600 dark:text-slate-300">{unicas.length}</span>{' '}
                {tipo === 'planilla' ? 'planilla(s)' : 'consolidado(s)'}
                {duplicados > 0 ? ' únicas.' : '.'}
              </p>

              {duplicados > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
                  <AlertTriangle className="mt-px h-4 w-4 flex-none" />
                  <span>
                    Se ignorará{duplicados === 1 ? '' : 'n'} <b>{duplicados}</b> entrada{duplicados === 1 ? '' : 's'} duplicada
                    {duplicados === 1 ? '' : 's'}: solo se procesa una vez cada {tipo === 'planilla' ? 'planilla' : 'consolidado'}.
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={procesar}
                  disabled={procesando || !unicas.length}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {procesando ? 'Procesando…' : 'Procesar'}
                </button>
                <button
                  onClick={limpiar}
                  disabled={procesando}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
                  {error}
                </div>
              )}

              {procesando && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Procesando {progreso.hecho} de {progreso.total}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </section>

            {rows.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={ListChecks} label="Total" value={resumen.total} tone="brand" />
                <StatCard icon={CheckCircle2} label="Exitosos" value={resumen.ok} tone="emerald" />
                <StatCard icon={XCircle} label="Errores" value={resumen.err} tone="rose" />
              </div>
            )}
          </div>

          {/* Columna de resultados */}
          <div>
            {rows.length > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resultados</h2>
                  <button
                    onClick={() => exportarExcel(rows)}
                    disabled={procesando}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-40 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
                  </button>
                </div>
                <ResultsTable rows={rows} />
              </>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: 'text-brand-600 bg-brand-100 dark:text-brand-300 dark:bg-brand-950/50',
    emerald: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50',
    rose: 'text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/50',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-3 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className={`grid place-items-center h-9 w-9 rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full min-h-[300px] place-items-center rounded-xl border border-dashed border-brand-200 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Leaf className="h-6 w-6" />
        </div>
        <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">Aún no hay resultados</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ingresa planillas o consolidados y presiona <span className="font-medium">Procesar</span>.
        </p>
      </div>
    </div>
  );
}

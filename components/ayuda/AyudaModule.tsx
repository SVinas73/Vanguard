'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, BookOpen, PlayCircle, Tag } from 'lucide-react';
import { docs, buscarDocs, type DocSection } from '@/lib/help/docs-content';

const CATEGORIA_LABEL: Record<DocSection['categoria'], string> = {
  inicio: 'Empezar',
  core: 'Núcleo',
  operaciones: 'Operaciones',
  analisis: 'Análisis e IA',
  postventa: 'Post-venta',
  sistema: 'Sistema',
};

const CATEGORIA_ORDER: DocSection['categoria'][] = [
  'inicio', 'core', 'operaciones', 'analisis', 'postventa', 'sistema',
];

interface AyudaModuleProps {
  onStartTour?: () => void;
}

export default function AyudaModule({ onStartTour }: AyudaModuleProps) {
  const [query, setQuery] = useState('');
  const [slugActivo, setSlugActivo] = useState<string>('getting-started');

  const filtrados = useMemo(() => buscarDocs(query), [query]);

  const porCategoria = useMemo(() => {
    const mapa: Record<string, DocSection[]> = {};
    for (const d of filtrados) {
      mapa[d.categoria] = mapa[d.categoria] || [];
      mapa[d.categoria].push(d);
    }
    return mapa;
  }, [filtrados]);

  const docActivo = docs.find(d => d.slug === slugActivo) || docs[0];

  return (
    <div className="flex h-full bg-slate-950 text-slate-200">
      <aside className="w-72 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Centro de Ayuda</h2>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition"
            >
              <PlayCircle className="w-4 h-4" />
              Hacer el tour guiado
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {CATEGORIA_ORDER.map(cat => {
            const items = porCategoria[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {CATEGORIA_LABEL[cat]}
                </div>
                {items.map(d => (
                  <button
                    key={d.slug}
                    onClick={() => setSlugActivo(d.slug)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                      slugActivo === d.slug
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-medium">{d.titulo}</div>
                    <div className="text-xs text-slate-500 truncate">{d.resumen}</div>
                  </button>
                ))}
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div className="text-center text-sm text-slate-500 mt-8 px-4">
              No se encontró nada con "{query}".
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <article className="max-w-3xl mx-auto px-8 py-10 prose prose-invert prose-slate prose-headings:text-white prose-strong:text-white prose-a:text-blue-400 prose-code:text-amber-300 prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:text-sm prose-th:text-slate-300 prose-td:text-slate-400 prose-th:border-slate-800 prose-td:border-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {docActivo.contenido}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}

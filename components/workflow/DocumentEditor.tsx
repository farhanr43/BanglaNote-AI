import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlignmentType, LayoutBlock, LayoutResult } from '../../types';
import { MathBlock, MixedMathText } from '../MathRenderer';
import 'katex/dist/katex.min.css';

interface DocumentEditorProps {
  layout: LayoutResult;
  onChange: (next: LayoutResult) => void;
  documentTitle: string;
  onTitleChange: (t: string) => void;
}

type EditableBlock = LayoutBlock & { id: string };

const uid = () => Math.random().toString(36).slice(2, 9);

const clean = (s: string) =>
  s
    .replace(/<\/?Text[^>]*>?/gi, '')
    .replace(/\s*<\/?Text\s*\/?\s*$/gi, '')
    .replace(/\s*affirmative\s+JSON.*$/is, '')
    .replace(/\s*No other comments.*$/is, '')
    .replace(/\s*Let's make sure.*$/is, '')
    .replace(/\s*Let's carefully construct.*$/is, '')
    .replace(/\s*Let's combine them.*$/is, '')
    .replace(/\s*Let's write out.*$/is, '')
    .replace(/\s*Wait,.*End of thought.*$/is, '')
    .replace(/\s*Wait,.*$/is, '')
    .replace(/\s*I will output just the JSON.*$/is, '')
    .replace(/\s*End of thought\.?\s*$/is, '')
    .replace(/_and_\s*/g, ' ')
    .replace(/_at_any_places_*/g, ' ')
    .replace(/Do not generate any control token.*$/is, '')
    .replace(/Do not include any extra text.*$/is, '')
    .replace(/Only generate a valid.*$/is, '')
    .replace(/Wait, the prompt.*$/is, '')
    .replace(/Usually it means.*$/is, '')
    .replace(/safe_execution.*$/is, '')
    .replace(/safe_JSON.*$/is, '')
    .replace(/<\/?[^>]+>/g, (m) => (m.includes('$') || m.includes('\\') ? m : ''))
    .replace(/\s+/g, ' ')
    .trim();

const isHallucinatedText = (s: string): boolean => {
  const t = s.toLowerCase();
  if (s.includes('"type"') && s.includes('"blocks"')) return true;
  if (s.includes('"type":') && s.length > 80) return true;
  if (t.includes('affirmative json') || t.includes('no other comments') || t.includes('end of thought') || t.includes('i will output just the json') || t.includes('i will provide') || t.includes("let's make sure") || t.includes("let's carefully") || t.includes("let's combine") || t.includes("let's write") || t.includes('do not include any extra text') || t.includes('only generate a valid')) return true;
  if (t.includes('do not generate') || t.includes('control token')) return true;
  if (t.includes('_and_') || t.includes('_at_any_places_') || t.includes('wait_the_rule')) return true;
  if (t.includes('block 1') || t.includes('block 2') || (t.includes('block ') && (t.includes('(paragraph)') || t.includes('(equation)')))) return true;
  if (t.startsWith('{') && s.includes('"blocks"')) return true;
  if (/^["\s]*\{?\s*"?(text|blocks|type)"?\s*:/.test(s.trim())) return true;
  if (/^[\{\}\[\]":,\s]+$/.test(s.trim())) return true;
  if (t.includes('wait,') && t.length > 60) return true;
  if (t.includes('wait the prompt') || t.includes('usually it means') || t.includes('escaped_') || t.includes('_or_no_literal')) return true;
  if (t.includes('safe_execution') || t.includes('safe_json')) return true;
  return false;
};

const looksLikeJsonFragment = (s: string): boolean => {
  const t = s.trim();
  if (/^[\{\}\[\]":,\s]+$/.test(t) && t.includes('"')) return true;
  if (/^"\w+"\s*:\s*[\[\{"]/.test(t)) return true;
  if (t === '{' || t === '}' || t === '},' || t === '],' || t === '[' || t === ']' || t === '"text":' || t === '"blocks":' || t === '"blocks": [' ) return true;
  if (t.startsWith('"type"') || t.startsWith('"text"') || t.startsWith('"blocks"')) return true;
  if (t.startsWith('{') && t.includes('"type"')) return true;
  return false;
};

function toEditable(layout: LayoutResult): EditableBlock[] {
  const src = layout.blocks.length
    ? layout.blocks
        .map((b) => {
          const nb: any = { ...b };
          if (typeof nb.text === 'string') nb.text = clean(nb.text);
          if (Array.isArray(nb.items)) nb.items = nb.items.map((it: string) => clean(String(it)));
          if (Array.isArray(nb.rows)) nb.rows = nb.rows.map((r: any) => r.map((c: string) => clean(String(c))));
          return nb;
        })
        .filter((b: any) => {
          const check = `${b.text ?? ''} ${(b.items ?? []).join(' ')} ${(b.rows ?? []).flat().join(' ')}`.trim();
          if (!check) return false;
          if (isHallucinatedText(check)) return false;
          if (looksLikeJsonFragment(check)) return false;
          if (check.includes('"type":') || check.includes('"blocks"')) return false;
          if (check.length < 5 && /^[\{\}\[\]:",\s]+$/.test(check)) return false;
          return true;
        })
    : layout.text
        .split(/\n+/)
        .filter((t) => t.trim())
        .filter((t) => !isHallucinatedText(t))
        .map((t) => ({ type: 'paragraph' as const, text: clean(t) }));
  return src.map((b) => ({ ...b, id: uid() }));
}

const alignClass = (a?: AlignmentType) => {
  switch (a) {
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    case 'justify': return 'text-justify';
    default: return 'text-left';
  }
};

const DocumentEditor: React.FC<DocumentEditorProps> = ({ layout, onChange, documentTitle, onTitleChange }) => {
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => toEditable(layout));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<EditableBlock[][]>([]);
  const [future, setFuture] = useState<EditableBlock[][]>([]);
  const pageRef = useRef<HTMLDivElement>(null);

  const blocksToText = (bs: EditableBlock[]) =>
    bs
      .map((b) => {
        if (b.type === 'bullet' || b.type === 'numbered') return (b.items ?? []).join('\n');
        if (b.type === 'table') return (b.rows ?? []).map((r) => r.join('\t')).join('\n');
        return b.text ?? '';
      })
      .join('\n\n');

  const layoutKeyRef = useRef<string>('');
  useEffect(() => {
    const incomingKey = JSON.stringify({ text: layout.text, blocks: layout.blocks });
    const currentKey = JSON.stringify({ text: blocksToText(blocks), blocks: blocks.map(({ id: _id, ...rest }) => rest) });
    if (incomingKey !== layoutKeyRef.current && incomingKey !== currentKey) {
      layoutKeyRef.current = incomingKey;
      setBlocks(toEditable(layout));
      setHistory([]);
      setFuture([]);
    }
  }, [layout]);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const pushHistory = (prev: EditableBlock[]) => {
    setHistory((h) => [...h.slice(-19), prev.map((b) => ({ ...b, rows: b.rows ? b.rows.map((r) => [...r]) : undefined, items: b.items ? [...b.items] : undefined }))]);
    setFuture([]);
  };

  const commit = (next: EditableBlock[]) => {
    pushHistory(blocks);
    setBlocks(next);
    const nextKey = JSON.stringify({ text: blocksToText(next), blocks: next.map(({ id: _id, ...rest }) => rest) });
    layoutKeyRef.current = nextKey;
    onChange({ text: blocksToText(next), blocks: next });
  };

  const updateBlock = (id: string, patch: Partial<EditableBlock>) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
    commit(next);
  };

  const toggleStyle = (key: 'bold' | 'italic' | 'underline') => {
    if (!selected) return;
    updateBlock(selected.id, { [key]: !selected[key] } as any);
  };

  const setAlignment = (a: AlignmentType) => {
    if (!selected) return;
    updateBlock(selected.id, { alignment: a });
  };

  const setHeadingLevel = (level: number) => {
    if (!selected) return;
    if (level === 0) updateBlock(selected.id, { type: 'paragraph', level: undefined });
    else updateBlock(selected.id, { type: 'heading', level });
  };

  const convertType = (type: LayoutBlock['type']) => {
    if (!selected) return;
    if (type === 'bullet' || type === 'numbered') {
      const text = selected.text ?? (selected.items ? selected.items.join(' ') : '');
      const items = text ? (text.includes('\n') ? text.split('\n').filter(Boolean) : [text]) : [''];
      updateBlock(selected.id, { type, items, text: undefined, rows: undefined });
    } else if (type === 'table') {
      const rows = selected.rows ?? [[selected.text ?? 'Cell 1', 'Cell 2'], ['', '']];
      updateBlock(selected.id, { type: 'table', rows, text: undefined, items: undefined });
    } else if (type === 'paragraph' || type === 'heading') {
      const text = selected.text ?? (selected.items ? selected.items.join(' ') : (selected.rows ? selected.rows.flat().join(' ') : ''));
      updateBlock(selected.id, { type, text: text || 'New paragraph', items: undefined, rows: undefined });
    } else {
      updateBlock(selected.id, { type, text: selected.text ?? 'y = x + \\frac{4}{x}' });
    }
  };

  const addBlock = (afterId?: string, type: LayoutBlock['type'] = 'paragraph') => {
    const fresh: EditableBlock =
      type === 'bullet' ? { id: uid(), type, items: ['New item'] } :
      type === 'numbered' ? { id: uid(), type, items: ['New item'] } :
      type === 'table' ? { id: uid(), type, rows: [['Cell 1', 'Cell 2'], ['Cell 3', 'Cell 4']] } :
      type === 'equation' ? { id: uid(), type, text: 'x^{2} + y^{2} = 1', alignment: 'center' } :
      type === 'heading' ? { id: uid(), type, text: 'New heading', level: 2, bold: true } :
      { id: uid(), type: 'paragraph', text: 'New paragraph' };
    const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
    const next = [...blocks];
    if (idx >= 0) next.splice(idx + 1, 0, fresh);
    else next.push(fresh);
    commit(next);
    setSelectedId(fresh.id);
  };

  const removeBlock = (id: string) => {
    if (blocks.length === 1) return;
    commit(blocks.filter((b) => b.id !== id));
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [blocks, ...f]);
    setHistory((h) => h.slice(0, -1));
    setBlocks(prev);
    const k = JSON.stringify({ text: blocksToText(prev), blocks: prev.map(({ id: _id, ...rest }) => rest) });
    layoutKeyRef.current = k;
    onChange({ text: blocksToText(prev), blocks: prev });
  };
  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, blocks]);
    setFuture((f) => f.slice(1));
    setBlocks(next);
    const k = JSON.stringify({ text: blocksToText(next), blocks: next.map(({ id: _id, ...rest }) => rest) });
    layoutKeyRef.current = k;
    onChange({ text: blocksToText(next), blocks: next });
  };

  const addRow = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b || b.type !== 'table' || !b.rows) return;
    const cols = b.rows[0]?.length ?? 2;
    updateBlock(id, { rows: [...b.rows, Array(cols).fill('')] });
  };
  const addCol = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b || b.type !== 'table' || !b.rows) return;
    updateBlock(id, { rows: b.rows.map((r) => [...r, '']) });
  };
  const removeRow = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b || !b.rows || b.rows.length <= 1) return;
    updateBlock(id, { rows: b.rows.slice(0, -1) });
  };
  const removeCol = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b || !b.rows || (b.rows[0]?.length ?? 0) <= 1) return;
    updateBlock(id, { rows: b.rows.map((r) => r.slice(0, -1)) });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="px-3 sm:px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-600 text-white">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Edit Mode
            </span>
            <input
              value={documentTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Document title"
              className="flex-1 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <button onClick={undo} disabled={history.length === 0} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" title="Undo">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v1M3 10l3-3m-3 3l3 3" /></svg>
              </button>
              <button onClick={redo} disabled={future.length === 0} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" title="Redo">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a4 4 0 00-4 4v1M21 10l-3-3m3 3l-3 3" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(70, z - 10))} className="px-2 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">−</button>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-12 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="px-2 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">+</button>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1.5 border-t border-gray-200 dark:border-gray-700">
          <select
            value={selected?.type === 'heading' ? String(selected.level ?? 2) : '0'}
            onChange={(e) => setHeadingLevel(parseInt(e.target.value))}
            disabled={!selected}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-40"
          >
            <option value="0">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => toggleStyle('bold')} disabled={!selected} className={`p-1.5 rounded border text-xs font-bold ${selected?.bold ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'} disabled:opacity-40`}>B</button>
          <button onClick={() => toggleStyle('italic')} disabled={!selected} className={`p-1.5 rounded border text-xs italic ${selected?.italic ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'} disabled:opacity-40`}>I</button>
          <button onClick={() => toggleStyle('underline')} disabled={!selected} className={`p-1.5 rounded border text-xs underline ${selected?.underline ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'} disabled:opacity-40`}>U</button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {(['left','center','right','justify'] as AlignmentType[]).map((a) => (
            <button key={a} onClick={() => setAlignment(a)} disabled={!selected} title={a} className={`p-1.5 rounded border ${selected?.alignment === a ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'} disabled:opacity-40`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {a === 'left' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h10M4 14h16M4 18h10" />}
                {a === 'center' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M4 14h16M7 18h10" />}
                {a === 'right' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 10h10M4 14h16M10 18h10" />}
                {a === 'justify' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
              </svg>
            </button>
          ))}

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => convertType('bullet')} disabled={!selected} title="Bullets" className={`p-1.5 rounded border ${selected?.type === 'bullet' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'} disabled:opacity-40`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
          </button>
          <button onClick={() => convertType('numbered')} disabled={!selected} title="Numbered" className={`p-1.5 rounded border ${selected?.type === 'numbered' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'} disabled:opacity-40`}>
            <span className="text-xs font-mono">1.</span>
          </button>
          <button onClick={() => convertType('table')} disabled={!selected} title="Table" className={`p-1.5 rounded border ${selected?.type === 'table' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'} disabled:opacity-40`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M9 3v18M15 3v18M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /></svg>
          </button>
          <button onClick={() => convertType('equation')} disabled={!selected} title="Equation" className={`px-2 py-1.5 rounded border text-xs font-mono ${selected?.type === 'equation' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'} disabled:opacity-40`}>ƒx</button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />

          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 w-28 sm:w-32 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <svg className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          <button onClick={() => addBlock(selectedId ?? undefined)} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add block
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div
          ref={pageRef}
          className="mx-auto bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-sm overflow-hidden"
          style={{ maxWidth: '800px', zoom: `${zoom}%` } as any}
        >
          <div className="min-h-[600px] p-8 sm:p-10 font-bengali">
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{documentTitle || 'Untitled Document'}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{blocks.length} blocks • Editable • Click any block to edit • Math rendered with LaTeX</p>
            </div>

            {blocks.map((block) => {
              const isSelected = block.id === selectedId;
              return (
                <div
                  key={block.id}
                  onClick={() => setSelectedId(block.id)}
                  className={`group relative rounded-lg border-2 p-2 -mx-2 mb-1 transition-colors ${
                    isSelected ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-900/10' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/20'
                  }`}
                >
                  <div className={`absolute -top-3 right-2 flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white capitalize">{block.type}{block.type === 'heading' ? ` ${block.level}` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); addBlock(block.id); }} className="w-6 h-6 bg-teal-600 text-white rounded flex items-center justify-center text-xs hover:bg-teal-700">+</button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center text-xs hover:bg-red-600">×</button>
                  </div>

                  {block.type === 'heading' && (
                    isSelected ? (
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateBlock(block.id, { text: e.currentTarget.textContent ?? '' })}
                        className={`outline-none font-bold ${alignClass(block.alignment)} ${block.level === 1 ? 'text-2xl' : block.level === 3 ? 'text-lg' : 'text-xl'} ${block.italic ? 'italic' : ''} ${block.underline ? 'underline' : ''} text-gray-900 dark:text-white min-h-[1.5em]`}
                        style={{ fontWeight: block.bold === false ? 400 : 700 }}
                      >
                        {block.text}
                      </div>
                    ) : (
                      <div className={`font-bold ${alignClass(block.alignment)} ${block.level === 1 ? 'text-2xl' : block.level === 3 ? 'text-lg' : 'text-xl'} text-gray-900 dark:text-white`}>
                        <MixedMathText text={block.text ?? ''} search={search} />
                      </div>
                    )
                  )}

                  {block.type === 'paragraph' && (
                    isSelected ? (
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateBlock(block.id, { text: e.currentTarget.textContent ?? '' })}
                        className={`outline-none whitespace-pre-wrap leading-relaxed min-h-[1.5em] ${alignClass(block.alignment)} ${block.bold ? 'font-bold' : ''} ${block.italic ? 'italic' : ''} ${block.underline ? 'underline' : ''} text-gray-800 dark:text-gray-200 border border-dashed border-teal-300 dark:border-teal-700 rounded px-1`}
                      >
                        {block.text}
                      </div>
                    ) : (
                      <div className={`leading-relaxed min-h-[1.5em] ${alignClass(block.alignment)} ${block.bold ? 'font-bold' : ''} ${block.italic ? 'italic' : ''} ${block.underline ? 'underline' : ''} text-gray-800 dark:text-gray-200`}>
                        <MixedMathText text={block.text ?? ''} search={search} />
                      </div>
                    )
                  )}

                  {block.type === 'bullet' && (
                    <ul className={`list-disc pl-6 space-y-1 ${alignClass(block.alignment)}`}>
                      {(block.items ?? []).map((item, idx) => (
                        <li key={idx} className={`text-gray-800 dark:text-gray-200 ${block.bold ? 'font-bold' : ''} ${block.italic ? 'italic' : ''}`}>
                          {isSelected ? (
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const nextItems = [...(block.items ?? [])];
                                nextItems[idx] = e.currentTarget.textContent ?? '';
                                updateBlock(block.id, { items: nextItems });
                              }}
                              className="outline-none border-b border-dashed border-gray-300 dark:border-gray-600 px-1"
                            >
                              {item}
                            </span>
                          ) : (
                            <MixedMathText text={item} search={search} />
                          )}
                        </li>
                      ))}
                      {isSelected && (
                        <li className="list-none">
                          <button onClick={() => updateBlock(block.id, { items: [...(block.items ?? []), 'New item'] })} className="text-xs text-teal-600 hover:text-teal-700">+ Add bullet</button>
                        </li>
                      )}
                    </ul>
                  )}

                  {block.type === 'numbered' && (
                    <ol className={`list-decimal pl-6 space-y-1 ${alignClass(block.alignment)}`}>
                      {(block.items ?? []).map((item, idx) => (
                        <li key={idx} className={`text-gray-800 dark:text-gray-200 ${block.bold ? 'font-bold' : ''} ${block.italic ? 'italic' : ''}`}>
                          {isSelected ? (
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const nextItems = [...(block.items ?? [])];
                                nextItems[idx] = e.currentTarget.textContent ?? '';
                                updateBlock(block.id, { items: nextItems });
                              }}
                              className="outline-none border-b border-dashed border-gray-300 px-1"
                            >
                              {item}
                            </span>
                          ) : (
                            <MixedMathText text={item} search={search} />
                          )}
                        </li>
                      ))}
                      {isSelected && (
                        <li className="list-none">
                          <button onClick={() => updateBlock(block.id, { items: [...(block.items ?? []), 'New item'] })} className="text-xs text-teal-600 hover:text-teal-700">+ Add item</button>
                        </li>
                      )}
                    </ol>
                  )}

                  {block.type === 'table' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <tbody>
                          {(block.rows ?? []).map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="border border-gray-300 dark:border-gray-600 p-0">
                                  {isSelected ? (
                                    <div
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => {
                                        const nextRows = (block.rows ?? []).map((r) => [...r]);
                                        nextRows[ri][ci] = e.currentTarget.textContent ?? '';
                                        updateBlock(block.id, { rows: nextRows });
                                      }}
                                      className="px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200 outline-none min-w-[80px] min-h-[1.5em] bg-yellow-50/50 dark:bg-yellow-900/10"
                                    >
                                      {cell}
                                    </div>
                                  ) : (
                                    <div className="px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200 min-w-[80px] text-center">
                                      <MixedMathText text={cell} />
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {isSelected && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button onClick={() => addRow(block.id)} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200">+ Row</button>
                          <button onClick={() => addCol(block.id)} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200">+ Column</button>
                          <button onClick={() => removeRow(block.id)} className="text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 rounded hover:bg-red-100">− Row</button>
                          <button onClick={() => removeCol(block.id)} className="text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 rounded hover:bg-red-100">− Col</button>
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === 'equation' && (
                    isSelected ? (
                      <div className="border border-dashed border-teal-300 dark:border-teal-700 rounded p-2 bg-teal-50/30 dark:bg-teal-900/10">
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => updateBlock(block.id, { text: e.currentTarget.textContent ?? '' })}
                          className="py-1 text-center font-mono text-sm text-gray-800 dark:text-gray-200 outline-none"
                        >
                          {block.text}
                        </div>
                        <div className="text-center mt-1">
                          <MathBlock latex={block.text ?? ''} display />
                        </div>
                        <p className="text-[10px] text-center text-gray-500 mt-1">Edit LaTeX source above — preview below</p>
                      </div>
                    ) : (
                      <div className="py-2 flex justify-center overflow-x-auto">
                        <MathBlock latex={block.text ?? ''} display />
                      </div>
                    )
                  )}
                </div>
              );
            })}

            <div className="mt-6 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600 text-center">
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => addBlock(undefined, 'paragraph')} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">+ Paragraph</button>
                <button onClick={() => addBlock(undefined, 'equation')} className="text-xs px-3 py-1.5 border border-teal-300 dark:border-teal-700 rounded-lg bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 text-teal-700 dark:text-teal-300">+ Equation</button>
                <button onClick={() => addBlock(undefined, 'table')} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">+ Table</button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-3 text-xs text-gray-500 dark:text-gray-400">
          Page 1 • {blocks.length} blocks • {blocksToText(blocks).length} characters • Zoom {zoom}% • Equations centered with LaTeX
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;

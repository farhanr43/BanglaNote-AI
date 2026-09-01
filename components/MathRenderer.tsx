import React, { useMemo } from 'react';
import katex from 'katex';

interface Props {
  latex: string;
  display?: boolean;
  className?: string;
}

// Render a single LaTeX string (no delimiters) via KaTeX. Falls back to <code> on error.
const stripTags = (s: string) => s.replace(/<\/?Text[^>]*>/gi, '').replace(/<\/?[^>]+>/g, (m) => m.includes('$') || m.includes('\\') ? m : '');

const normalizeLatex = (s: string): string => {
  let t = s.trim();
  if (!t) return t;
  t = t.replace(/=>/g, '\\Rightarrow').replace(/⇒/g, '\\Rightarrow').replace(/∴/g, '\\therefore');
  t = t.replace(/ρ/g, '\\rho').replace(/α/g, '\\alpha').replace(/β/g, '\\beta');
  t = t.replace(/([a-zA-Z0-9\)\]])\^(\d+)(?!\{)/g, '$1^{$2}');
  t = t.replace(/([a-zA-Z])_(\d+)(?!\{)/g, '$1_{$2}');
  if (t.includes('/') && !t.includes('\\frac')) {
    t = t.replace(/(\b\d+\b)\s*\/\s*(x(?:\^\{[^}]+\}|\^\d+|)(?![a-zA-Z0-9]))/g, '\\frac{$1}{$2}');
    t = t.replace(/(\b\d+\b)\s*\/\s*(\b\d+\b)/g, '\\frac{$1}{$2}');
  }
  return t;
};

export const MathBlock: React.FC<Props> = ({ latex, display = false, className }) => {
  const html = useMemo(() => {
    const clean = normalizeLatex(stripTags(latex).trim());
    if (!clean) return '';
    try {
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode: display,
        output: 'html',
        strict: false,
        trust: true,
      });
    } catch {
      return `<span style="font-family: monospace; color:#b45309;">${clean.replace(/</g,'&lt;')}</span>`;
    }
  }, [latex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

// Helper to wrap Bangla vs English with correct export fonts
const FontWrapped: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/([\u0980-\u09FF]+)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        const isBangla = /[\u0980-\u09FF]/.test(part);
        const style = isBangla
          ? { fontFamily: "'SutonnyMJ','Nirmala UI', sans-serif" }
          : { fontFamily: "'Times New Roman', Times, serif" };
        return (
          <span key={idx} style={style}>
            {part}
          </span>
        );
      })}
    </>
  );
};

// For mixed paragraph text that may contain $...$ inline and $$...$$ display.
export const MixedMathText: React.FC<{ text: string; search?: string }> = ({ text, search }) => {
  const segments = useMemo(() => splitMath(text), [text]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'math') {
          return <MathBlock key={i} latex={seg.value} display={seg.display} className={seg.display ? 'block my-1' : 'inline'} />;
        }
        // text segment — handle search highlight if needed
        if (search && search.trim()) {
          const parts = seg.value.split(new RegExp(`(${escapeReg(search)})`, 'gi'));
          return (
            <span key={i}>
              {parts.map((p, j) =>
                p.toLowerCase() === search.toLowerCase() ? (
                  <mark key={j} className="bg-yellow-200 dark:bg-yellow-500/30 px-0.5 rounded">{p}</mark>
                ) : (
                  <span key={j}>
                    <FontWrapped text={p} />
                  </span>
                )
              )}
            </span>
          );
        }
        return (
          <span key={i}>
            <FontWrapped text={seg.value} />
          </span>
        );
      })}
    </>
  );
};

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Seg = { type: 'text' | 'math'; value: string; display: boolean };

function splitMath(input: string): Seg[] {
  if (!input) return [{ type: 'text', value: '', display: false }];
  const out: Seg[] = [];
  // Regex: $$...$$ first, then $...$
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: input.slice(last, m.index), display: false });
    }
    const latex = m[1] ?? m[2] ?? '';
    const display = m[1] !== undefined;
    out.push({ type: 'math', value: latex, display });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ type: 'text', value: input.slice(last), display: false });

  // If no delimiters found, try heuristic: if the whole paragraph is equation-like and contains LaTeX commands without $, treat as math?
  // e.g. "=> y = x + \\frac{4}{x}" — but keep as text; MathBlock will be used for equation type separately.
  if (out.length === 1 && out[0].type === 'text') {
    // No math delimiters → return as single text segment (no auto-conversion to avoid breaking Bangla)
    return out;
  }
  return out;
}

// Heuristic helper: detect if a string looks like pure math without delimiters (for backward compat)
// Used to decide to render paragraph that is actually an equation but OCR returned plain text.
export function looksLikeMathPlain(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Contains = and ^ or _ or \frac or \rho
  if (/\\frac|\\rho|\\Rightarrow|\\alpha|\\beta/.test(t)) return true;
  if (/[a-zA-Z]\s*\^\s*2|[a-zA-Z]_\d/.test(t) && t.length < 80 && /^[=>\sxy0-9^_+\-*/().,\\{}]+$/.test(t)) return false;
  return false;
}

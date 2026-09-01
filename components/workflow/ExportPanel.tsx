import React, { useState } from 'react';
import { LayoutResult } from '../../types';
import { downloadDocx } from '../../services/docxService';
import katex from 'katex';

interface ExportPanelProps {
  layout: LayoutResult;
  title: string;
}

const renderMathHtml = (latex: string, display: boolean): string => {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: display, strict: false, trust: true });
  } catch {
    return `<code>${latex.replace(/</g,'&lt;')}</code>`;
  }
};

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const withFonts = (raw: string): string => {
  // Split raw text into Bangla vs non-Bangla and wrap with appropriate font
  const parts = raw.split(/([\u0980-\u09FF]+)/g);
  return parts.map((part) => {
    if (!part) return '';
    const isBangla = /[\u0980-\u09FF]/.test(part);
    const e = esc(part);
    if (isBangla) {
      return `<span style="font-family:'SutonnyMJ','Nirmala UI',sans-serif;">${e}</span>`;
    } else {
      // English / numbers / punctuation -> Times New Roman
      if (e.trim() === '') return e; // keep spaces as is
      return `<span style="font-family:'Times New Roman', Times, serif;">${e}</span>`;
    }
  }).join('');
};

const mixedToHtml = (text: string): string => {
  // Split by $$...$$ and $...$
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out += withFonts(text.slice(last, m.index));
    const latex = m[1] ?? m[2] ?? '';
    const display = m[1] !== undefined;
    out += renderMathHtml(latex, display);
    last = m.index + m[0].length;
  }
  if (last < text.length) out += withFonts(text.slice(last));
  if (!out) return withFonts(text);
  // If no math was found, mixedToHtml already returns font-wrapped text
  return out;
};

const ExportPanel: React.FC<ExportPanelProps> = ({ layout, title }) => {
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);

  const handleDocx = async () => {
    setIsExporting('docx');
    try {
      await downloadDocx(layout, `${title || 'BanglaNote_Export'}.docx`);
    } catch (err) {
      console.error(err);
      alert('Failed to export Word document.');
    } finally {
      setIsExporting(null);
    }
  };

  const handlePdf = () => {
    setIsExporting('pdf');
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to export PDF.');
        setIsExporting(null);
        return;
      }

      const blocksHtml = layout.blocks.length
        ? layout.blocks
            .map((block) => {
              const align = block.alignment ?? 'left';
              const alignStyle = `text-align:${align};`;
              const bold = block.bold ? 'font-weight:700;' : '';
              const italic = block.italic ? 'font-style:italic;' : '';
              const underline = block.underline ? 'text-decoration:underline;' : '';
              const style = `${alignStyle}${bold}${italic}${underline}`;

              if (block.type === 'heading') {
                const tag = block.level === 1 ? 'h1' : block.level === 3 ? 'h3' : 'h2';
                const size = block.level === 1 ? '22pt' : block.level === 3 ? '14pt' : '16pt';
                return `<${tag} style="${style} font-size:${size}; margin:12pt 0 6pt 0; color:#111827;">${mixedToHtml(block.text ?? '')}</${tag}>`;
              }
              if (block.type === 'bullet') {
                const items = (block.items ?? [block.text ?? '']).map((it) => `<li style="${style} margin-bottom:4pt;">${mixedToHtml(it)}</li>`).join('');
                return `<ul style="margin:6pt 0; padding-left:18pt;">${items}</ul>`;
              }
              if (block.type === 'numbered') {
                const items = (block.items ?? [block.text ?? '']).map((it) => `<li style="${style} margin-bottom:4pt;">${mixedToHtml(it)}</li>`).join('');
                return `<ol style="margin:6pt 0; padding-left:18pt;">${items}</ol>`;
              }
              if (block.type === 'table') {
                const rows = (block.rows ?? [])
                  .map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #d1d5db; padding:6pt 8pt; font-size:10pt;">${mixedToHtml(c)}</td>`).join('')}</tr>`)
                  .join('');
                return `<table style="width:100%; border-collapse:collapse; margin:10pt 0;"><tbody>${rows}</tbody></table>`;
              }
              if (block.type === 'equation') {
                const mathHtml = renderMathHtml(block.text ?? '', true);
                return `<div style="text-align:center; margin:10pt 0;">${mathHtml}</div>`;
              }
              return `<p style="${style} margin:6pt 0; line-height:1.7; font-size:11pt; white-space:pre-wrap;">${mixedToHtml(block.text ?? '')}</p>`;
            })
            .join('')
        : layout.text
            .split('\n')
            .map((t) => `<p style="margin:6pt 0; line-height:1.7; font-size:11pt; white-space:pre-wrap;">${mixedToHtml(t)}</p>`)
            .join('');

      const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<title>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</title>
<link href="https://db.onlinewebfonts.com/c/745d8457da8dec2e3477d0d4da431299?family=SutonnyMJ" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: 'Times New Roman', Times, serif; color:#111; margin:0; padding:1.5cm; line-height:1.6; }
  h1,h2,h3 { font-family: 'SutonnyMJ','Times New Roman', serif; }
  /* Ensure Bangla segments use SutonnyMJ via inline spans; fallback for any unwrapped Bangla */
  body, p, li, td { font-family: 'Times New Roman', Times, serif; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  .katex, .katex-display { font-family: 'KaTeX_Main', 'Times New Roman', serif !important; }
  .katex-display { margin: 0.6em 0; }
</style>
</head>
<body>
  <div style="text-align:center; border-bottom:2px solid #0d9488; padding-bottom:10pt; margin-bottom:12pt;">
    <div style="font-size:18pt; font-weight:700; color:#0f766e;">${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    <div style="font-size:8pt; color:#6b7280;">BanglaNote AI • Exported Document</div>
  </div>
  ${blocksHtml}
  <div style="margin-top:20pt; padding-top:8pt; border-top:1px solid #e5e7eb; text-align:center; font-size:7pt; color:#9ca3af;">Generated by BanglaNote AI — ${new Date().toLocaleString()}</div>
  <script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),400));</script>
</body>
</html>`;
      printWindow.document.write(html);
      printWindow.document.close();
    } finally {
      setTimeout(() => setIsExporting(null), 800);
    }
  };

  const handleTxt = () => {
    const text = layout.text || layout.blocks.map(b => b.text ?? (b.items ? b.items.join('\n') : (b.rows ? b.rows.map(r=>r.join('\t')).join('\n') : ''))).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'BanglaNote_Export'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document Ready for Export</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose your preferred format. DOCX preserves editability, PDF preserves layout & math.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={handleDocx}
          disabled={!!isExporting}
          className="group relative flex flex-col items-start p-4 rounded-xl border-2 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900/20 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">Export as DOCX</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Editable Word file — headings, lists, tables, math as readable text. Opens in Word/Google Docs.</div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
            {isExporting === 'docx' ? 'Generating…' : 'Download .docx →'}
          </div>
        </button>

        <button
          onClick={handlePdf}
          disabled={!!isExporting}
          className="group flex flex-col items-start p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">Export as PDF</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Print-ready A4 PDF — Bangla/English + LaTeX math rendered via KaTeX, tables intact.</div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            {isExporting === 'pdf' ? 'Preparing…' : 'Print / Save PDF →'}
          </div>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={handleTxt} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          Also download as .txt
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bangla, English, numbers, and symbols are preserved in all exports.
        </p>
      </div>
    </div>
  );
};

export default ExportPanel;

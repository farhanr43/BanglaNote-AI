import React from 'react';
import { AlignmentType, LayoutBlock, LayoutResult } from '../types';

interface StructuredPreviewProps {
  layout: LayoutResult | null;
}

const alignClass = (a?: AlignmentType): string => {
  switch (a) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'justify':
      return 'text-justify';
    default:
      return 'text-left';
  }
};

const Inline: React.FC<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }> = ({
  text,
  bold,
  italic,
  underline,
}) => (
  <span
    className={[
      bold ? 'font-bold' : '',
      italic ? 'italic' : '',
      underline ? 'underline' : '',
    ].join(' ')}
  >
    {text}
  </span>
);

const BlockView: React.FC<{ block: LayoutBlock }> = ({ block }) => {
  switch (block.type) {
    case 'heading': {
      const text = block.text ?? '';
      const cls = `font-bold ${alignClass(block.alignment)} ${
        block.level === 1 ? 'text-2xl' : block.level === 3 ? 'text-lg' : 'text-xl'
      } text-gray-900 dark:text-white`;
      if (block.level === 1) return <h1 className={`${cls} mb-2 mt-3`}><Inline text={text} bold /></h1>;
      if (block.level === 3) return <h3 className={`${cls} mb-2 mt-3`}><Inline text={text} bold /></h3>;
      return <h2 className={`${cls} mb-2 mt-3`}><Inline text={text} bold /></h2>;
    }

    case 'bullet':
      return (
        <ul className="list-disc pl-6 mb-2 space-y-1">
          {(block.items ?? [block.text ?? '']).map((item, i) => (
            <li key={i} className={`text-gray-800 dark:text-gray-200 ${alignClass(block.alignment)}`}>
              <Inline text={item} bold={block.bold} italic={block.italic} underline={block.underline} />
            </li>
          ))}
        </ul>
      );

    case 'numbered':
      return (
        <ol className="list-decimal pl-6 mb-2 space-y-1">
          {(block.items ?? [block.text ?? '']).map((item, i) => (
            <li key={i} className={`text-gray-800 dark:text-gray-200 ${alignClass(block.alignment)}`}>
              <Inline text={item} bold={block.bold} italic={block.italic} underline={block.underline} />
            </li>
          ))}
        </ol>
      );

    case 'table':
      return (
        <div className="mb-3 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <tbody>
              {(block.rows ?? []).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'equation':
      return (
        <div className="mb-2 py-1 text-center italic font-mono text-base text-gray-800 dark:text-gray-200">
          {block.text}
        </div>
      );

    default:
      return (
        <p className={`mb-2 whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200 ${alignClass(block.alignment)}`}>
          <Inline text={block.text ?? ''} bold={block.bold} italic={block.italic} underline={block.underline} />
        </p>
      );
  }
};

const StructuredPreview: React.FC<StructuredPreviewProps> = ({ layout }) => {
  const blocks = (() => {
    if (!layout) return [];
    if (layout.blocks && layout.blocks.length > 0) return layout.blocks;
    if (layout.text && layout.text.trim()) {
      return layout.text
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ type: 'paragraph' as const, text: t }));
    }
    return [];
  })();

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        Upload a note to preview its detected layout here.
      </p>
    );
  }

  return (
    <div className="font-bengali">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
};

export default StructuredPreview;

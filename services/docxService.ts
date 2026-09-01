import {
  AlignmentType,
  Document,
  HeadingLevel,
  NumberFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { AlignmentType as BnAlignment, LayoutBlock, LayoutResult } from '../types';
import { unicodeToBijoy as toBijoyRaw } from '@abdalgolabs/ansi-unicode-converter';

// Safe wrapper — falls back to original if conversion fails
const toBijoy = (s: string): string => {
  try {
    const out = toBijoyRaw(s);
    // toBijoyRaw may return undefined on empty; keep original if falsy
    return out ?? s;
  } catch {
    return s;
  }
};

const SUTONNY_FONT = {
  name: 'SutonnyMJ',
  ascii: 'SutonnyMJ',
  hAnsi: 'SutonnyMJ',
  eastAsia: 'SutonnyMJ',
  cs: 'SutonnyMJ',
};

const TIMES_FONT = {
  name: 'Times New Roman',
  ascii: 'Times New Roman',
  hAnsi: 'Times New Roman',
  eastAsia: 'Times New Roman',
  cs: 'Times New Roman',
};

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
type DocxHeading = (typeof HeadingLevel)[keyof typeof HeadingLevel];

const toDocxAlignment = (a?: BnAlignment): DocxAlignment | undefined => {
  switch (a) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    case 'left':
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
};

const stripMathDelimiters = (s: string): string =>
  s
    .replace(/\$\$([\s\S]+?)\$\$/g, '$1')
    .replace(/\$([^$]+?)\$/g, '$1')
    .replace(/<\/?Text[^>]*>?/gi, '')
    .replace(/\s*affirmative\s+JSON.*$/is, '')
    .replace(/\s*No other comments.*$/is, '')
    .replace(/\s*End of thought.*$/is, '')
    .replace(/<\/?[^>]+>/g, '');

const latexToReadable = (s: string): string => {
  let t = stripMathDelimiters(s);
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
  t = t.replace(/\\Rightarrow/g, '⇒');
  t = t.replace(/\\rho/g, 'ρ');
  t = t.replace(/\\alpha/g, 'α');
  t = t.replace(/\\beta/g, 'β');
  t = t.replace(/\^\{([^}]+)\}/g, '^$1');
  t = t.replace(/_\{([^}]+)\}/g, '_$1');
  return t;
};

// Split text into segments so Bangla uses SutonnyMJ (Bijoy-encoded) and English/numbers use Times New Roman
const runsForText = (text: string, block?: Partial<Pick<LayoutBlock, 'bold' | 'italic' | 'underline'>>): TextRun[] => {
  const readable = latexToReadable(text);
  if (!readable) return [];
  const parts = readable.split(/([\u0980-\u09FF]+)/g).filter((p) => p.length > 0);
  return parts.map((part) => {
    const bangla = /[\u0980-\u09FF]/.test(part);
    // Convert Unicode Bangla -> Bijoy (SutonnyMJ) ASCII
    const finalText = bangla ? toBijoy(part) : part;
    return new TextRun({
      text: finalText,
      font: bangla ? SUTONNY_FONT : TIMES_FONT,
      size: 24, // 12pt
      bold: block?.bold ?? false,
      italics: block?.italic ?? false,
      underline: block?.underline ? {} : undefined,
    });
  });
};

const headingSize = (level?: number): DocxHeading => {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 3:
      return HeadingLevel.HEADING_3;
    default:
      return HeadingLevel.HEADING_2;
  }
};

const headingRunSize = (level?: number): number => {
  switch (level) {
    case 1:
      return 32; // 16pt
    case 3:
      return 26; // 13pt
    default:
      return 28; // 14pt
  }
};

function headingRuns(text: string, level?: number): TextRun[] {
  const readable = latexToReadable(text);
  const size = headingRunSize(level);
  const parts = readable.split(/([\u0980-\u09FF]+)/g).filter((p) => p.length > 0);
  if (parts.length === 0) return [];
  return parts.map((part) => {
    const bangla = /[\u0980-\u09FF]/.test(part);
    const finalText = bangla ? toBijoy(part) : part;
    return new TextRun({
      text: finalText,
      font: bangla ? SUTONNY_FONT : TIMES_FONT,
      size,
      bold: true,
      color: '1F2937',
    });
  });
}

function blockToParagraphs(block: LayoutBlock): Array<Paragraph | Table> {
  const alignment = toDocxAlignment(block.alignment);

  if (block.type === 'heading') {
    return [
      new Paragraph({
        children: headingRuns(block.text ?? '', block.level),
        heading: headingSize(block.level),
        alignment,
        spacing: { before: 240, after: 120 },
      }),
    ];
  }

  if (block.type === 'bullet') {
    return (block.items ?? [block.text ?? '']).map(
      (item) =>
        new Paragraph({
          children: runsForText(item, block),
          bullet: { level: 0 },
          alignment,
          spacing: { after: 80 },
        }),
    );
  }

  if (block.type === 'numbered') {
    return (block.items ?? [block.text ?? '']).map(
      (item) =>
        new Paragraph({
          children: runsForText(item, block),
          numbering: { reference: 'bnList', level: 0 },
          alignment,
          spacing: { after: 80 },
        }),
    );
  }

  if (block.type === 'table') {
    const rows = (block.rows ?? []).map(
      (cells) =>
        new TableRow({
          children: cells.map(
            (cellText) =>
              new TableCell({
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [new Paragraph({ children: runsForText(cellText) })],
              }),
          ),
        }),
    );
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }),
    ];
  }

  if (block.type === 'equation') {
    return [
      new Paragraph({
        children: runsForText(block.text ?? '', { italic: true }),
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 },
      }),
    ];
  }

  // paragraph
  return [
    new Paragraph({
      children: runsForText(block.text ?? '', block),
      alignment,
      spacing: { after: 160, line: 360 },
    }),
  ];
}

const isHallucinatedDocx = (s: string): boolean => {
  const t = s.toLowerCase();
  if (s.includes('"type"') && s.includes('"blocks"')) return true;
  if (s.includes('"type":') && s.length > 80) return true;
  if (t.includes('affirmative json') || t.includes('end of thought') || t.includes('no other comments') || t.includes('i will provide') || t.includes("let's make sure") || t.includes("let's carefully") || t.includes('do not generate') || t.includes('control token') || t.includes('_and_') || t.includes('_at_any_places_')) return true;
  if (t.includes('block 1') || t.includes('block 2') || (t.includes('block ') && (t.includes('(paragraph)') || t.includes('(equation)')))) return true;
  if (/^["\s]*\{?\s*"?(text|blocks|type)"?\s*:/.test(s.trim())) return true;
  if (/^[\{\}\[\]":,\s]+$/.test(s.trim())) return true;
  if (t.includes('wait,') && t.length > 60) return true;
  return false;
};
const looksLikeJsonFragmentDocx = (s: string): boolean => {
  const t = s.trim();
  if (/^[\{\}\[\]":,\s]+$/.test(t) && t.includes('"')) return true;
  if (/^"\w+"\s*:\s*[\[\{"]/.test(t)) return true;
  if (t.startsWith('"type"') || t.startsWith('"text"') || t.startsWith('"blocks"')) return true;
  if (t.startsWith('{') && t.includes('"type"')) return true;
  return false;
};

/** Build an editable .docx preserving the detected layout as much as possible. */
export async function buildDocx(layout: LayoutResult, title = 'BanglaNote AI Export'): Promise<Blob> {
  const rawBlocks: LayoutBlock[] =
    layout.blocks.length > 0
      ? layout.blocks
      : layout.text
        ? layout.text
            .split(/\n+/)
            .filter((t) => t.trim())
            .map((t) => ({ type: 'paragraph' as const, text: t }))
        : [{ type: 'paragraph' as const, text: '' }];
  // Filter hallucinated blocks (JSON dumps, reasoning leakage)
  const blocks: LayoutBlock[] = rawBlocks.filter((b) => {
    const check = `${b.text ?? ''} ${(b.items ?? []).join(' ')} ${(b.rows ?? []).flat().join(' ')}`.trim();
    if (!check) return false;
    if (isHallucinatedDocx(check)) return false;
    if (looksLikeJsonFragmentDocx(check)) return false;
    if (check.includes('"type":') || check.includes('"blocks"')) return false;
    return true;
  });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: runsForText(title, { bold: true }),
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  ];

  for (const block of blocks) {
    children.push(...blockToParagraphs(block));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bnList',
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadDocx(
  layout: LayoutResult,
  filename = 'BanglaNote_Export.docx',
): Promise<void> {
  const blob = await buildDocx(layout);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

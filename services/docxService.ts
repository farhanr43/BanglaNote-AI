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

const BENGALI_FONT = {
  name: 'Noto Sans Bengali',
  ascii: 'Noto Sans Bengali',
  hAnsi: 'Noto Sans Bengali',
  eastAsia: 'Noto Sans Bengali',
  cs: 'Noto Sans Bengali',
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

const run = (text: string, block?: Partial<Pick<LayoutBlock, 'bold' | 'italic' | 'underline'>>): TextRun => {
  return new TextRun({
    text,
    font: BENGALI_FONT,
    size: 24, // 12pt
    bold: block?.bold ?? false,
    italics: block?.italic ?? false,
    underline: block?.underline ? {} : undefined,
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

function blockToParagraphs(block: LayoutBlock): Array<Paragraph | Table> {
  const alignment = toDocxAlignment(block.alignment);

  if (block.type === 'heading') {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: block.text ?? '',
            font: BENGALI_FONT,
            size: headingRunSize(block.level),
            bold: true,
            color: '1F2937',
          }),
        ],
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
          children: [run(item, block)],
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
          children: [run(item, block)],
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
                children: [new Paragraph({ children: [run(cellText)] })],
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
        children: [run(block.text ?? '', { italic: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      }),
    ];
  }

  // paragraph
  return [
    new Paragraph({
      children: [run(block.text ?? '', block)],
      alignment,
      spacing: { after: 160, line: 360 },
    }),
  ];
}

/** Build an editable .docx preserving the detected layout as much as possible. */
export async function buildDocx(layout: LayoutResult, title = 'BanglaNote AI Export'): Promise<Blob> {
  const blocks: LayoutBlock[] =
    layout.blocks.length > 0
      ? layout.blocks
      : layout.text
        ? layout.text
            .split(/\n+/)
            .filter((t) => t.trim())
            .map((t) => ({ type: 'paragraph' as const, text: t }))
        : [{ type: 'paragraph' as const, text: '' }];

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [run(title, { bold: true })],
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

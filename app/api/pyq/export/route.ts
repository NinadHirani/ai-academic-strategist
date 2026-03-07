import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const store = getPyqRuntimeStore();
    const job = store.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const answers = job.generatedAnswers;

    if (!answers.length) {
      return NextResponse.json({ error: "No answers to export" }, { status: 400 });
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]);
    let y = 810;

    const drawLine = (text: string, opts?: { bold?: boolean; size?: number; color?: { r: number; g: number; b: number } }) => {
      const size = opts?.size || 10;
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 810;
      }
      page.drawText(text, {
        x: 40,
        y,
        size,
        font: opts?.bold ? bold : font,
        color: opts?.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0, 0, 0),
      });
      y -= size + 4;
    };

    drawLine(`Subject: ${job.subject}`, { bold: true, size: 16 });
    drawLine("Past Paper Intelligence Report", {
      size: 10,
      color: { r: 0.25, g: 0.25, b: 0.25 },
    });
    y -= 6;

    answers.forEach((item, index) => {
      drawLine(`Question: ${item.question}`, { bold: true, size: 12 });
      drawLine(`Marks: ${item.marks}`, { size: 10 });
      drawLine(`Frequency: ${item.frequency} times`, { size: 10 });
      drawLine("Asked in:", { size: 10, bold: true });
      item.yearsAsked.forEach((year) => drawLine(year, { size: 10 }));
      drawLine("Answer:", { size: 10, bold: true });

      const answerLines = wrapText(item.answer, 92);
      answerLines.forEach((line) => drawLine(line, { size: 10 }));

      if (item.figure) {
        drawLine("Figure:", { size: 10, bold: true });
        wrapText(item.figure, 92).forEach((line) => drawLine(line, { size: 9 }));
      }

      if (item.table) {
        drawLine("Table:", { size: 10, bold: true });
        wrapText(item.table, 92).forEach((line) => drawLine(line, { size: 9 }));
      }

      y -= 8;
    });

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=pyq-answers-${Date.now()}.pdf`,
      },
    });
  } catch (error) {
    console.error("[PYQ Export API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

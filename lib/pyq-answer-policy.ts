export interface AnswerLengthGuidance {
  marks: number;
  targetPages: number;
  maxPages: number;
  targetWordRange: { min: number; max: number };
}

const WORDS_PER_PAGE = 320;
const MAX_PAGES = 3;

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Formula anchored to requirements:
 * 3 marks -> 0.75 page
 * 4 marks -> 1 page
 * 7 marks -> 3 pages (cap)
 */
export function calculateTargetPages(marks: number): number {
  const safeMarks = Number.isFinite(marks) && marks > 0 ? marks : 1;

  let pages: number;
  if (safeMarks <= 4) {
    pages = safeMarks * 0.25;
  } else {
    pages = 1 + (safeMarks - 4) * (2 / 3);
  }

  return Math.min(MAX_PAGES, roundToQuarter(Math.max(0.25, pages)));
}

export function getAnswerLengthGuidance(marks: number): AnswerLengthGuidance {
  const targetPages = calculateTargetPages(marks);
  const targetWords = Math.round(targetPages * WORDS_PER_PAGE);

  return {
    marks,
    targetPages,
    maxPages: MAX_PAGES,
    targetWordRange: {
      min: Math.max(40, Math.round(targetWords * 0.8)),
      max: Math.round(targetWords * 1.2),
    },
  };
}

export function getLengthGuideForMarks(marksList: number[]): AnswerLengthGuidance[] {
  return marksList.map((marks) => getAnswerLengthGuidance(marks));
}

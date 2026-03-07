export interface MarksAnswerPolicy {
  marks: number;
  minWords: number;
  maxWords: number;
  targetPages: number;
}

const BANDS: MarksAnswerPolicy[] = [
  { marks: 2, minWords: 120, maxWords: 150, targetPages: 0.5 },
  { marks: 3, minWords: 180, maxWords: 220, targetPages: 0.75 },
  { marks: 4, minWords: 250, maxWords: 320, targetPages: 1 },
  { marks: 7, minWords: 600, maxWords: 700, targetPages: 3 },
  { marks: 10, minWords: 900, maxWords: 1100, targetPages: 4 },
];

function interpolate(low: MarksAnswerPolicy, high: MarksAnswerPolicy, marks: number): MarksAnswerPolicy {
  const ratio = (marks - low.marks) / (high.marks - low.marks);
  return {
    marks,
    minWords: Math.round(low.minWords + ratio * (high.minWords - low.minWords)),
    maxWords: Math.round(low.maxWords + ratio * (high.maxWords - low.maxWords)),
    targetPages: Number((low.targetPages + ratio * (high.targetPages - low.targetPages)).toFixed(2)),
  };
}

export function getPolicyForMarks(inputMarks: number): MarksAnswerPolicy {
  const marks = Math.max(2, Math.min(10, Math.round(inputMarks)));

  const exact = BANDS.find((band) => band.marks === marks);
  if (exact) {
    return exact;
  }

  for (let i = 0; i < BANDS.length - 1; i += 1) {
    const current = BANDS[i];
    const next = BANDS[i + 1];
    if (marks > current.marks && marks < next.marks) {
      return interpolate(current, next, marks);
    }
  }

  return BANDS[BANDS.length - 1];
}

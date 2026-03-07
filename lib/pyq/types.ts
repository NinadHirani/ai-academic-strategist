export type PyqJobStatus = "queued" | "running" | "completed" | "failed";

export type PyqPipelineStage =
  | "idle"
  | "parsing_papers"
  | "extracting_questions"
  | "detecting_duplicates"
  | "analyzing_frequency"
  | "generating_answers"
  | "completed";

export interface UploadedPaper {
  id: string;
  subject: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  base64: string;
  yearHint?: number;
  seasonHint?: string;
}

export interface ExtractedQuestion {
  id: string;
  paperId: string;
  subject: string;
  paperYear: number;
  paperSeason?: string;
  questionNumber?: string;
  questionText: string;
  marks: number;
  rawLine: string;
}

export interface QuestionCluster {
  id: string;
  subject: string;
  canonicalQuestion: string;
  normalizedQuestion: string;
  frequency: number;
  yearsAsked: string[];
  marksValues: number[];
  averageMarks: number;
  questionIds: string[];
  sampleVariants: string[];
}

export interface QuestionAnalytics {
  clusterId: string;
  canonicalQuestion: string;
  frequency: number;
  yearsAsked: string[];
  averageMarks: number;
  probabilityScore: number;
  marksValues: number[];
}

export interface TopicInsight {
  topic: string;
  frequency: number;
  averageMarks: number;
}

export interface MarksDistributionItem {
  bucket: string;
  count: number;
  percentage: number;
}

export interface ClusterAnalysis {
  questionAnalytics: QuestionAnalytics[];
  mostImportantTopics: TopicInsight[];
  marksDistributionByTopic: Record<string, MarksDistributionItem[]>;
}

export interface GeneratedAnswer {
  id: string;
  clusterId: string;
  subject: string;
  question: string;
  marks: number;
  frequency: number;
  yearsAsked: string[];
  answer: string;
  figure: string | null;
  table: string | null;
  generatedAt: string;
}

export interface PipelineProgress {
  stage: PyqPipelineStage;
  status: PyqJobStatus;
  progressPercent: number;
  message: string;
  updatedAt: string;
}

export interface PyqJob {
  id: string;
  subject: string;
  paperIds: string[];
  status: PyqJobStatus;
  stage: PyqPipelineStage;
  progressPercent: number;
  stageMessage: string;
  extractedQuestions: ExtractedQuestion[];
  clusters: QuestionCluster[];
  analysis: ClusterAnalysis | null;
  generatedAnswers: GeneratedAnswer[];
  errors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  jobId: string;
  papers: UploadedPaper[];
  progress: PipelineProgress;
}

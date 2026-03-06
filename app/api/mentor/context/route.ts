import { NextRequest, NextResponse } from "next/server";
import {
  calculateRetentionScore,
  generateWeaknessHeatmap,
  getLearningVelocity,
} from "@/lib/analytics-engine";
import { resolveRequestUserId } from "@/lib/request-auth";

interface MentorContextResponse {
  success: boolean;
  performance: {
    retentionScore: number;
    topicsMastered: number;
    weeklyVelocity: number;
    velocityTrend: string;
    weakestTopics: string[];
  };
  tasks: string[];
  coachNote: string;
}

const DEFAULT_RETENTION_SCORE = 82;
const DEFAULT_VELOCITY = {
  currentWeek: 12,
  previousWeek: 10,
  percentageChange: 20,
};

function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RETENTION_SCORE;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveTasks(params: {
  retentionScore: number;
  percentageChange: number;
  weakestTopics: string[];
  currentTopic: string;
}): string[] {
  const tasks: string[] = [];

  if (params.retentionScore < 70) {
    tasks.push("Run a 20-minute spaced-revision block on recent weak concepts.");
  }

  if (params.percentageChange < 0) {
    tasks.push("Do one focused 30-minute deep work sprint to recover weekly momentum.");
  }

  if (params.weakestTopics.length > 0) {
    tasks.push(`Practice 3 targeted questions on ${params.weakestTopics[0]}.`);
  }

  if (params.currentTopic) {
    tasks.push(`Create a one-page summary for your current topic: ${params.currentTopic}.`);
  } else {
    tasks.push("Pick one active chat topic and explain it in your own words.");
  }

  tasks.push("End with a 5-minute self-quiz and log mistakes for tomorrow.");

  return tasks.slice(0, 5);
}

function deriveCoachNote(params: {
  retentionScore: number;
  percentageChange: number;
  currentTopic: string;
}): string {
  const trendText =
    params.percentageChange > 0
      ? "Your learning velocity is improving"
      : params.percentageChange < 0
        ? "Your pace dipped this week"
        : "Your pace is steady";

  const topicText = params.currentTopic
    ? `Keep your next block centered on ${params.currentTopic}.`
    : "Use your next block to lock in one concept from your latest chat.";

  if (params.retentionScore >= 80) {
    return `${trendText}, and retention is strong. ${topicText}`;
  }

  if (params.retentionScore >= 65) {
    return `${trendText}. Retention is decent but can improve with tighter review cycles. ${topicText}`;
  }

  return `${trendText}. Retention is currently low, so prioritize short revision loops before adding new material. ${topicText}`;
}

export async function GET(request: NextRequest) {
  const auth = await resolveRequestUserId(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const userId = auth.userId;
  const currentTopic = (searchParams.get("topic") || "").trim();

  let velocity = DEFAULT_VELOCITY;
  let retentionScore = DEFAULT_RETENTION_SCORE;
  let weakTopics: string[] = [];

  try {
    const velocityResult = await getLearningVelocity(userId);
    velocity = {
      currentWeek:
        typeof velocityResult?.currentWeek === "number"
          ? velocityResult.currentWeek
          : DEFAULT_VELOCITY.currentWeek,
      previousWeek:
        typeof velocityResult?.previousWeek === "number"
          ? velocityResult.previousWeek
          : DEFAULT_VELOCITY.previousWeek,
      percentageChange:
        typeof velocityResult?.percentageChange === "number"
          ? velocityResult.percentageChange
          : DEFAULT_VELOCITY.percentageChange,
    };
  } catch {
    velocity = DEFAULT_VELOCITY;
  }

  try {
    const retentionResult = await calculateRetentionScore(userId);
    retentionScore = clampRetention(retentionResult);
  } catch {
    retentionScore = DEFAULT_RETENTION_SCORE;
  }

  try {
    const heatmap = await generateWeaknessHeatmap(userId);
    weakTopics = (heatmap || [])
      .flatMap((cell: any) => (Array.isArray(cell?.topics) ? cell.topics : []))
      .filter((topic: unknown): topic is string => typeof topic === "string" && topic.length > 0)
      .slice(0, 5);
  } catch {
    weakTopics = [];
  }

  const topicsMastered = velocity.currentWeek * 2 + 15;
  const velocityTrend =
    velocity.percentageChange > 0
      ? "Increasing"
      : velocity.percentageChange < 0
        ? "Needs attention"
        : "Stable";

  const tasks = deriveTasks({
    retentionScore,
    percentageChange: velocity.percentageChange,
    weakestTopics: weakTopics,
    currentTopic,
  });

  const coachNote = deriveCoachNote({
    retentionScore,
    percentageChange: velocity.percentageChange,
    currentTopic,
  });

  const payload: MentorContextResponse = {
    success: true,
    performance: {
      retentionScore,
      topicsMastered,
      weeklyVelocity: velocity.currentWeek,
      velocityTrend,
      weakestTopics: weakTopics,
    },
    tasks,
    coachNote,
  };

  return NextResponse.json(payload);
}

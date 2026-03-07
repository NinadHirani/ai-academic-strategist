import { ClusterAnalysis, MarksDistributionItem, QuestionAnalytics, QuestionCluster, TopicInsight } from "@/lib/pyq/types";

function bucketForMarks(marks: number): string {
  if (marks <= 2) return "1-2";
  if (marks <= 4) return "3-4";
  if (marks <= 7) return "5-7";
  return "8+";
}

function inferTopic(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(" ")
    .filter((word) => word.length > 3);

  return words.slice(0, 2).join(" ") || "general";
}

function getProbabilityScore(frequency: number, maxFrequency: number, averageMarks: number): number {
  const frequencyScore = maxFrequency > 0 ? frequency / maxFrequency : 0;
  const marksScore = Math.min(averageMarks / 10, 1);
  return Number((frequencyScore * 0.7 + marksScore * 0.3).toFixed(3));
}

export function buildClusterAnalysis(clusters: QuestionCluster[]): ClusterAnalysis {
  const maxFrequency = Math.max(...clusters.map((cluster) => cluster.frequency), 1);

  const questionAnalytics: QuestionAnalytics[] = clusters.map((cluster) => ({
    clusterId: cluster.id,
    canonicalQuestion: cluster.canonicalQuestion,
    frequency: cluster.frequency,
    yearsAsked: cluster.yearsAsked,
    averageMarks: Number(cluster.averageMarks.toFixed(2)),
    probabilityScore: getProbabilityScore(cluster.frequency, maxFrequency, cluster.averageMarks),
    marksValues: cluster.marksValues,
  }));

  const topicMap = new Map<string, { frequency: number; totalMarks: number; count: number }>();
  for (const cluster of clusters) {
    const topic = inferTopic(cluster.canonicalQuestion);
    const entry = topicMap.get(topic) || { frequency: 0, totalMarks: 0, count: 0 };
    entry.frequency += cluster.frequency;
    entry.totalMarks += cluster.averageMarks;
    entry.count += 1;
    topicMap.set(topic, entry);
  }

  const mostImportantTopics: TopicInsight[] = Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      frequency: data.frequency,
      averageMarks: Number((data.totalMarks / data.count).toFixed(2)),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const marksDistributionByTopic: Record<string, MarksDistributionItem[]> = {};
  for (const [topic] of topicMap.entries()) {
    const topicClusters = clusters.filter((cluster) => inferTopic(cluster.canonicalQuestion) === topic);
    const bucketCounts = new Map<string, number>();

    for (const cluster of topicClusters) {
      const bucket = bucketForMarks(cluster.averageMarks);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + cluster.frequency);
    }

    const total = Array.from(bucketCounts.values()).reduce((sum, value) => sum + value, 0) || 1;

    marksDistributionByTopic[topic] = Array.from(bucketCounts.entries()).map(([bucket, count]) => ({
      bucket,
      count,
      percentage: Number(((count / total) * 100).toFixed(2)),
    }));
  }

  return {
    questionAnalytics: questionAnalytics.sort((a, b) => b.frequency - a.frequency),
    mostImportantTopics,
    marksDistributionByTopic,
  };
}

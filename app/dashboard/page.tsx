import { getLearningVelocity, calculateRetentionScore, generateWeaknessHeatmap } from '@/lib/analytics-engine';
import { Activity } from 'lucide-react';
import DashboardCharts from './DashboardCharts';

export default async function DashboardPage() {
    const userId = 'anonymous';

    const [velocityData, retentionScore, heatmapData] = await Promise.all([
        getLearningVelocity(userId),
        calculateRetentionScore(userId),
        generateWeaknessHeatmap(userId),
    ]);

    // All derived values computed once here, passed as plain props — no logic in the client
    const topicsMastered = velocityData.currentWeek * 2 + 15;
    const topicsDelta    = velocityData.currentWeek - velocityData.previousWeek;
    const velocityPct    = velocityData.percentageChange;
    const velocityTrend  = velocityData.percentageChange > 0 ? "Increasing" : "Stable";

    return (
        <main className="max-w-5xl mx-auto px-6 py-8 animate-in fade-in duration-500">

           

            {/* ── All charts + stat cards (client) ── */}
            <DashboardCharts
                weeklyData={velocityData.weeklyBreakdown}
                retentionScore={retentionScore}
                heatmapData={heatmapData}
                topicsMastered={topicsMastered}
                topicsDelta={topicsDelta}
                velocityPct={velocityPct}
                velocityTrend={velocityTrend}
            />
        </main>
    );
}
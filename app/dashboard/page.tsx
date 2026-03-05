import { getLearningVelocity, calculateRetentionScore, generateWeaknessHeatmap } from '@/lib/analytics-engine';
import DashboardCharts from './DashboardCharts';
import { BookOpen, BrainCircuit, Activity } from 'lucide-react';

export default async function DashboardPage() {
    // Using a stub user ID for the sake of the Phase 1 implementation.
    // In a real app, this comes from auth context/session.
    const userId = 'anonymous';

    const velocityData = await getLearningVelocity(userId);
    const retentionScore = await calculateRetentionScore(userId);
    const heatmapData = await generateWeaknessHeatmap(userId);

    return (
        <main className="main-content container-premium section-spacing animate-in fade-in duration-500">
            <div className="flex flex-col mb-10">
                <h1 className="hero-title" style={{ textAlign: 'left', marginBottom: '0.5rem' }}>Study Analytics Dashboard</h1>
                <p className="hero-subtitle" style={{ textAlign: 'left' }}>Track your learning velocity, memory retention, and knowledge gaps.</p>
            </div>

            {/* Top Row: Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card-premium p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All time</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-tight">Topics Mastered</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-bold tracking-tighter">{velocityData.currentWeek * 2 + 15}</p>
                            <span className="text-sm font-medium text-green-500 flex items-center">
                                +{(velocityData.currentWeek - velocityData.previousWeek > 0) ? '+' : ''}{velocityData.currentWeek - velocityData.previousWeek}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card-premium p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-tight">Knowledge Retention</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-bold tracking-tighter text-green-500">{retentionScore}%</p>
                            <span className="text-sm font-medium text-muted-foreground">Health</span>
                        </div>
                    </div>
                </div>

                <div className="card-premium p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">
                            {velocityData.percentageChange > 0 ? "Increasing" : "Stable"}
                        </span>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-tight">Learning Velocity</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-bold tracking-tighter text-blue-500">
                                {velocityData.percentageChange > 0 ? '+' : ''}{velocityData.percentageChange}%
                            </p>
                            <span className="text-sm font-medium text-muted-foreground">vs Last Week</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-premium p-1">
                <DashboardCharts
                    weeklyData={velocityData.weeklyData}
                    retentionScore={retentionScore}
                    heatmapData={heatmapData}
                />
            </div>
        </main>
    );
}

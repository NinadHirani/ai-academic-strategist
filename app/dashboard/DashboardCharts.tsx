'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

export default function DashboardCharts({
    weeklyData,
    retentionScore,
    heatmapData
}: {
    weeklyData: any[];
    retentionScore: number;
    heatmapData: any[];
}) {
    const router = useRouter();

    // Prepare Gauge Data for Retention Strategy
    const gaugeData = [
        { name: 'Score', value: retentionScore },
        { name: 'Remaining', value: Math.max(0, 100 - retentionScore) }
    ];
    const COLORS = [retentionScore > 80 ? '#22c55e' : retentionScore > 50 ? '#eab308' : '#ef4444', 'var(--muted, #e5e7eb)'];

    // Process Heatmap Data for Matrix Grid View
    const extractUnique = (key: string) => Array.from(new Set(heatmapData.map(d => d[key]))).sort();
    const subjects = extractUnique('subject');
    const units = extractUnique('unit');

    // Helper for matrix cell color
    const getCellColor = (intensity: number) => {
        if (intensity === 0) return 'bg-muted/50 dark:bg-muted/20';
        if (intensity === 1) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800/50 border';
        if (intensity === 2) return 'bg-orange-200 dark:bg-orange-800/50 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700/50 border';
        if (intensity >= 3) return 'bg-red-400 dark:bg-red-700 text-white border-red-500 dark:border-red-600 border';
        return 'bg-muted';
    };

    const handleHeatmapClick = (topics: string[]) => {
        if (topics.length > 0) {
            router.push(`/copilot?q=Review specific weakness topics: ${encodeURIComponent(topics.join(', '))}`);
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Learning Velocity Chart */}
                <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold tracking-tight">Learning Velocity</h3>
                        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">Weekly Trend</span>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border, #e5e7eb)" opacity={0.5} />
                                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground, #6b7280)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground, #6b7280)' }} />
                                <RechartsTooltip
                                    cursor={{ stroke: 'var(--muted, #e5e7eb)', strokeWidth: 2 }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="topicsLearned"
                                    name="Topics Learned"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
                                    activeDot={{ r: 6, fill: "#3b82f6" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Retention Score Gauge */}
                <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm flex flex-col relative">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold tracking-tight">Retention Score</h3>
                        <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-full">SM-2 Algorithm</span>
                    </div>

                    <div className="flex-1 w-full h-full relative min-h-[250px] flex items-center justify-center -mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={gaugeData}
                                    cx="50%"
                                    cy="75%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius="65%"
                                    outerRadius="85%"
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={4}
                                >
                                    {gaugeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-[10%] text-center flex flex-col items-center">
                            <span className="text-5xl font-bold tracking-tighter" style={{ color: COLORS[0] }}>{retentionScore}%</span>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">Average Memory Health</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Weakness Heatmap */}
            <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm mb-8 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">Weakness Heatmap</h3>
                        <p className="text-sm text-muted-foreground mt-1">Identified knowledge gaps based on chat interactions and quizzes.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted/50"></div> Good</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-100 dark:bg-yellow-900/30"></div> Review</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-700"></div> Critical</div>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[600px]">
                        {/* Header Row (Units) */}
                        <div className="grid gap-2" style={{ gridTemplateColumns: `140px repeat(${units.length}, 1fr)` }}>
                            <div className="p-2 font-medium"></div>
                            {units.map((u: any) => (
                                <div key={u} className="p-2 text-center font-medium text-xs text-muted-foreground uppercase tracking-wider">{u}</div>
                            ))}

                            {/* Data Rows (Subjects) */}
                            {subjects.map((subject: any) => (
                                <React.Fragment key={subject}>
                                    <div className="p-2 flex items-center font-medium text-sm text-foreground truncate">{subject}</div>

                                    {units.map((unit: any) => {
                                        const dataPoint = heatmapData.find((d: any) => d.subject === subject && d.unit === unit);
                                        const intensity = dataPoint ? dataPoint.weaknessIntensity : 0;
                                        const topics = dataPoint ? dataPoint.topics : [];

                                        return (
                                            <div key={`${subject}-${unit}`} className="aspect-square relative group p-0.5">
                                                <button
                                                    onClick={() => handleHeatmapClick(topics)}
                                                    disabled={intensity === 0}
                                                    className={`w-full h-full rounded-md transition-all duration-300 ${getCellColor(intensity)} ${intensity > 0 ? 'hover:scale-105 hover:shadow-md cursor-pointer' : 'cursor-default opacity-60'}`}
                                                    aria-label={`Weakness intensity ${intensity} for ${subject} ${unit}`}
                                                >
                                                    {intensity > 0 && (
                                                        <div className="flex items-center justify-center w-full h-full">
                                                            <span className="font-bold opacity-80">{intensity}</span>
                                                        </div>
                                                    )}
                                                </button>

                                                {/* Custom Tooltip on Hover */}
                                                {intensity > 0 && (
                                                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-[220px] p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
                                                        <p className="font-bold border-b border-border pb-1 mb-2">Needs Improvement</p>
                                                        <ul className="space-y-1">
                                                            {topics.map((t: string, i: number) => (
                                                                <li key={i} className="flex items-start gap-1.5">
                                                                    <span className="text-[10px] mt-0.5 opacity-60">▶</span>
                                                                    <span className="flex-1">{t}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <p className="mt-2 pt-1 border-t border-border text-[10px] text-muted-foreground italic text-center">Click to review with AI Copilot</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {subjects.length === 0 && (
                        <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
                            <p className="text-muted-foreground">No weakness data available yet.</p>
                            <p className="text-sm text-muted-foreground mt-1">Interact with the AI Copilot to generate insights.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

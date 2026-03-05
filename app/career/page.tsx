import { getCareerRoles, calculateCareerReadiness } from '@/lib/career-engine';
import { Briefcase, Target, ArrowRight, Zap, CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-card rounded-2xl border shadow-sm ${className}`}>
            {children}
        </div>
    );
}

export default async function CareerPage(props: { searchParams?: Promise<{ role?: string }> }) {
    const searchParams = await props.searchParams;
    const roles = getCareerRoles();
    const selectedRole = searchParams?.role || roles[0];

    const userId = 'anonymous'; // Or from session
    const readiness = await calculateCareerReadiness(userId, selectedRole);

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-5xl animate-in fade-in duration-500">
            <div className="flex flex-col mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Briefcase className="w-8 h-8 text-primary" /> Career Simulator
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                    See how your academic coursework aligns with industry job roles and auto-generate actionable bridging roadmaps to land your dream job.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Navigation for Roles */}
                <div className="md:col-span-1 flex flex-col gap-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Target Roles</h3>
                    {roles.map(role => {
                        const isActive = role === selectedRole;
                        return (
                            <Link
                                key={role}
                                href={`/career?role=${encodeURIComponent(role)}`}
                                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-card text-foreground hover:bg-muted border border-transparent'
                                    }`}
                            >
                                {role}
                            </Link>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-3 space-y-6">
                    <Card className="p-8 border shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                        {/* Background Glow */}
                        <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 ${readiness.percentage >= 80 ? 'bg-green-500' : readiness.percentage >= 40 ? 'bg-blue-500' : 'bg-orange-500'
                            }`} />

                        <h2 className="text-2xl font-bold mb-2">{selectedRole}</h2>
                        <p className="text-muted-foreground mb-8">Your Academic Readiness Score</p>

                        {/* Custom Circular Progress */}
                        <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                {/* Track */}
                                <circle
                                    cx="50" cy="50" r="45"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="10"
                                    className="text-muted opacity-20"
                                />
                                {/* Progress */}
                                <circle
                                    cx="50" cy="50" r="45"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="10"
                                    strokeDasharray={`${readiness.percentage * 2.83} 283`}
                                    className={`${readiness.percentage >= 80 ? 'text-green-500' : readiness.percentage >= 40 ? 'text-blue-500' : 'text-orange-500'
                                        } transition-all duration-1000 ease-out`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-5xl font-black">{readiness.percentage}%</span>
                                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">Ready</span>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full">
                            <div className="flex-1 bg-muted/40 p-4 rounded-xl text-left border">
                                <h4 className="font-bold flex items-center gap-2 mb-3 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Mastered Skills
                                </h4>
                                <ul className="space-y-1.5 list-none m-0 p-0 text-sm">
                                    {readiness.matchedSkills.length > 0 ? (
                                        readiness.matchedSkills.map(s => <li key={s} className="text-muted-foreground">• {s}</li>)
                                    ) : (
                                        <li className="text-muted-foreground italic">No mastered skills found.</li>
                                    )}
                                </ul>
                            </div>
                            <div className="flex-1 bg-muted/40 p-4 rounded-xl text-left border">
                                <h4 className="font-bold flex items-center gap-2 mb-3 text-sm">
                                    <Circle className="w-4 h-4 text-orange-500" /> Missing Skills
                                </h4>
                                <ul className="space-y-1.5 list-none m-0 p-0 text-sm">
                                    {readiness.missingSkills.length > 0 ? (
                                        readiness.missingSkills.map(s => <li key={s} className="text-muted-foreground">• {s}</li>)
                                    ) : (
                                        <li className="text-muted-foreground italic text-green-600 font-medium">None! Ready to apply.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </Card>

                    {/* Bridging Roadmap Generator */}
                    {readiness.missingSkills.length > 0 && (
                        <Card className="p-6 border-l-4 border-l-primary bg-primary/5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <Target className="w-5 h-5 text-primary" /> Bridging Roadmap
                                    </h3>
                                    <p className="text-sm text-balance text-muted-foreground mt-1 max-w-xl">
                                        Bridge the gap between your current knowledge and the requirements for <span className="font-semibold text-foreground">{selectedRole}</span>.
                                    </p>
                                </div>
                                <Link
                                    href={`/copilot?q=${encodeURIComponent(`Generate a study roadmap focusing entirely on learning: ${readiness.missingSkills.join(', ')}`)}`}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    Generate Plan <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

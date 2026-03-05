import { getDueReviews } from '@/lib/srs-engine';
import ChatPanel from '@/app/components/ChatPanel';
import { Target, Clock, Zap } from 'lucide-react';

export default async function MentorPage() {
    const userId = 'anonymous'; // Or get from session
    const dueReviews = await getDueReviews(userId);

    return (
        <main className="main-content container-premium section-spacing animate-in fade-in duration-500">
            <div className="flex flex-col mb-10">
                <h1 className="hero-title" style={{ textAlign: 'left', marginBottom: '0.5rem' }}>AI Study Mentor</h1>
                <p className="hero-subtitle" style={{ textAlign: 'left' }}>Your personalized daily focus session based on your learning patterns.</p>
                <div className="flex items-center gap-4 mt-6">
                    <span className="text-sm font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> Day 12 Streak
                    </span>
                    <span className="text-sm font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> Daily Energy: High
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[calc(100vh-320px)] min-h-[600px]">
                {/* Left Pane - Focus Session Generator */}
                <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto pr-4 scrollbar-thin">
                    <div className="card-premium p-8">
                        <div className="flex justify-between items-start mb-8">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <Target className="w-6 h-6 text-primary" /> Today's Focus Session
                            </h2>
                            <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded text-muted-foreground uppercase tracking-widest">90 MIN</span>
                        </div>

                        <p className="text-sm text-balance text-muted-foreground mb-10 leading-relaxed">
                            A structured session combining spaced-repetition review and new learning, intelligently optimized for your retention curve.
                        </p>

                        <div className="space-y-10">
                            {/* Part 1: Review */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-xs text-primary uppercase tracking-widest">1. Active Recall</h3>
                                    <span className="text-xs text-muted-foreground font-medium">20 Min</span>
                                </div>
                                {dueReviews && dueReviews.length > 0 ? (
                                    <ul className="space-y-3">
                                        {dueReviews.map((r: any) => (
                                            <li key={r.id} className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl group hover:bg-muted/40 transition-all border border-transparent hover:border-muted-foreground/10">
                                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-primary" />
                                                <span className="text-sm font-medium flex-1 truncate">{r.topic_name}</span>
                                                <span className="text-[10px] font-bold bg-red-500/10 text-red-500 px-2 py-0.5 rounded uppercase tracking-wider">Due</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-5 bg-green-500/5 text-green-500 rounded-xl text-sm flex items-center gap-3 border border-green-500/10">
                                        <Zap className="w-5 h-5" /> You're all caught up on reviews for today!
                                    </div>
                                )}
                            </div>

                            {/* Part 2: Learn */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-xs text-primary uppercase tracking-widest">2. Deep Learn</h3>
                                    <span className="text-xs text-muted-foreground font-medium">45 Min</span>
                                </div>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl hover:border-primary/30 transition-all cursor-pointer group">
                                        <div className="w-5 h-5 rounded-full border-2 border-primary/20 group-hover:border-primary/60 transition-all" />
                                        <div className="flex-1">
                                            <span className="text-sm font-bold block mb-0.5 text-foreground">Operating Systems: Unit 2</span>
                                            <span className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Process Synchronization & Mutexes</span>
                                        </div>
                                    </li>
                                    <li className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl hover:border-primary/30 transition-all cursor-pointer group">
                                        <div className="w-5 h-5 rounded-full border-2 border-primary/20 group-hover:border-primary/60 transition-all" />
                                        <div className="flex-1">
                                            <span className="text-sm font-bold block mb-0.5 text-foreground">Operating Systems: Unit 2</span>
                                            <span className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Deadlocks and Avoidance</span>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            {/* Part 3: Practice */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-xs text-primary uppercase tracking-widest">3. Assessment</h3>
                                    <span className="text-xs text-muted-foreground font-medium">25 Min</span>
                                </div>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl hover:bg-muted/40 transition-all border border-transparent hover:border-muted-foreground/10">
                                        <div className="w-5 h-5 rounded border-2 border-muted-foreground/20" />
                                        <span className="text-sm font-medium flex-1 text-foreground">Take 5-question Quiz on OS Unit 2</span>
                                        <button className="btn-premium" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                                            Start
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-muted">
                            <button className="btn-premium w-full py-4 text-base">
                                <Clock className="w-5 h-5" /> Start Focus Session Timer
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Pane - Mentor Chat */}
                <div className="lg:col-span-7 card-premium overflow-hidden flex flex-col relative min-h-[500px]">
                    <div className="absolute inset-0">
                        {/* 
              We reuse the ChatPanel component here. 
              Since its internal layout usually fills the parent, we constrain it with absolute inset-0.
            */}
                        <ChatPanel activeMode="study" documents={[]} />
                    </div>

                    {/* Overlay gradient to make it look embedded properly if needed */}
                    <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#171717]/80 to-transparent z-10" />
                </div>
            </div>
        </main>
    );
}

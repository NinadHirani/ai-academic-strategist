'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface Flashcard {
    front: string;
    back: string;
}

export function FlashcardModule({ flashcards, onClose }: { flashcards: Flashcard[], onClose?: () => void }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(currentIndex + 1), 150); // wait for flip back
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(currentIndex - 1), 150);
        }
    };

    const toggleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    if (!flashcards || flashcards.length === 0) {
        return <div>No flashcards available.</div>;
    }

    const currentCard = flashcards[currentIndex];

    return (
        <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
            <div className="flex justify-between items-center w-full mb-6">
                <span className="text-sm font-medium text-muted-foreground">
                    Card {currentIndex + 1} of {flashcards.length}
                </span>
                {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
            </div>

            {/* 3D Flip Card Container */}
            <div
                className="relative w-full h-[300px] perspective-[1000px] cursor-pointer mb-8 group"
                onClick={toggleFlip}
            >
                <div
                    className={`w-full h-full duration-500 preserve-3d relative transition-transform ${isFlipped ? 'rotate-y-180' : ''
                        }`}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front Face */}
                    <Card
                        className="absolute inset-0 w-full h-full backface-hidden flex flex-col items-center justify-center p-8 border-2 border-primary/20 bg-card hover:border-primary/50 transition-colors shadow-lg"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <span className="absolute top-4 left-4 text-xs font-bold uppercase text-primary/50 tracking-wider">Term</span>
                        <h3 className="text-3xl font-bold text-center text-foreground text-balance">
                            {currentCard.front}
                        </h3>
                        <span className="absolute bottom-4 text-xs text-muted-foreground flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <RotateCcw className="w-3 h-3" /> Click to flip
                        </span>
                    </Card>

                    {/* Back Face */}
                    <Card
                        className="absolute inset-0 w-full h-full backface-hidden flex flex-col items-center justify-center p-8 bg-primary/5 border-2 border-primary shadow-lg rotate-y-180"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <span className="absolute top-4 left-4 text-xs font-bold uppercase text-primary/50 tracking-wider">Definition</span>
                        <p className="text-xl text-center text-foreground text-balance leading-relaxed">
                            {currentCard.back}
                        </p>
                    </Card>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 w-full">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="rounded-full w-12 h-12"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>

                <Button
                    variant="secondary"
                    className="w-32"
                    onClick={toggleFlip}
                >
                    Flip Card
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNext}
                    disabled={currentIndex === flashcards.length - 1}
                    className="rounded-full w-12 h-12"
                >
                    <ChevronRight className="w-6 h-6" />
                </Button>
            </div>

            {/* Progress indicators */}
            <div className="flex justify-center gap-1.5 mt-8 w-full flex-wrap">
                {flashcards.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-primary/20'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export function QuizModule({ quizData, onClose }: { quizData: QuizQuestion[], onClose?: () => void }) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    const currentQuestion = quizData[currentQuestionIndex];

    const handleSelectOption = (index: number) => {
        if (isSubmitted) return;
        setSelectedAnswer(index);
    };

    const handleSubmit = () => {
        if (selectedAnswer === null) return;

        if (selectedAnswer === currentQuestion.correctIndex) {
            setScore(score + 1);
        }
        setIsSubmitted(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < quizData.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedAnswer(null);
            setIsSubmitted(false);
        } else {
            setIsCompleted(true);
        }
    };

    if (isCompleted) {
        return (
            <Card className="p-8 max-w-2xl w-full mx-auto flex flex-col items-center">
                <h2 className="text-3xl font-bold mb-4">Quiz Completed!</h2>
                <div className="text-6xl font-bold m-6 text-primary">
                    {score} / {quizData.length}
                </div>
                <p className="text-muted-foreground mb-8 text-center">
                    You scored {Math.round((score / quizData.length) * 100)}%. Great job reviewing the material!
                </p>
                <div className="flex gap-4">
                    <Button onClick={() => {
                        setCurrentQuestionIndex(0);
                        setSelectedAnswer(null);
                        setScore(0);
                        setIsSubmitted(false);
                        setIsCompleted(false);
                    }} variant="outline">
                        Retake Quiz
                    </Button>
                    {onClose && <Button onClick={onClose}>Close</Button>}
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6 max-w-2xl w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-muted-foreground border px-2 py-1 rounded-md">
                    Question {currentQuestionIndex + 1} of {quizData.length}
                </span>
                <span className="text-sm font-medium">Score: {score}</span>
            </div>

            <h3 className="text-xl font-semibold mb-6">{currentQuestion.question}</h3>

            <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, idx) => {
                    let buttonVariant: 'outline' | 'default' | 'destructive' | 'secondary' = 'outline';
                    let borderClassName = '';

                    if (isSubmitted) {
                        if (idx === currentQuestion.correctIndex) {
                            buttonVariant = 'default';
                            borderClassName = 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/20'; // Correct answer green
                        } else if (idx === selectedAnswer) {
                            buttonVariant = 'destructive'; // Highlight wrong selection
                        }
                    } else if (selectedAnswer === idx) {
                        buttonVariant = 'secondary';
                    }

                    return (
                        <Button
                            key={idx}
                            variant={buttonVariant}
                            className={`w-full justify-start text-left h-auto py-3 px-4 ${borderClassName}`}
                            onClick={() => handleSelectOption(idx)}
                        >
                            <div className="flex w-full items-center justify-between">
                                <span><span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {option}</span>
                                {isSubmitted && idx === currentQuestion.correctIndex && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
                                {isSubmitted && idx === selectedAnswer && idx !== currentQuestion.correctIndex && <XCircle className="w-5 h-5" />}
                            </div>
                        </Button>
                    );
                })}
            </div>

            {isSubmitted && (
                <div className="p-4 bg-muted/50 rounded-lg mb-6 animate-in fade-in">
                    <p className="font-semibold mb-1">Explanation:</p>
                    <p className="text-sm text-balance">{currentQuestion.explanation}</p>
                </div>
            )}

            <div className="flex justify-end gap-3">
                {!isSubmitted ? (
                    <Button onClick={handleSubmit} disabled={selectedAnswer === null}>
                        Submit Answer
                    </Button>
                ) : (
                    <Button onClick={handleNext}>
                        {currentQuestionIndex < quizData.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    </Button>
                )}
            </div>
        </Card>
    );
}

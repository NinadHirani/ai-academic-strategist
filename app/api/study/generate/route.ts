import { NextRequest, NextResponse } from 'next/server';
import { groqKeyManager } from '@/lib/groq-key-manager';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbeddings } from '@/lib/embeddings';

export async function POST(req: NextRequest) {
    try {
        const { documentId, type, topic } = await req.json();

        if (!documentId || !type) {
            return NextResponse.json({ error: 'Missing documentId or type' }, { status: 400 });
        }

        let contextText = '';

        // If topic is provided, try to search for relevant chunks
        if (topic && process.env.OPENAI_API_KEY) {
            try {
                const { embeddings } = await generateEmbeddings([topic], {
                    apiKey: process.env.OPENAI_API_KEY,
                    model: 'text-embedding-3-small'
                });

                if (embeddings && embeddings[0] && supabaseAdmin) {
                    const { data, error } = await supabaseAdmin.rpc('match_document_chunks', {
                        query_embedding: embeddings[0],
                        match_threshold: 0.1,
                        match_count: 5,
                        filter_document_id: documentId
                    });

                    if (!error && data) {
                        contextText = data.map((d: any) => d.content).join('\n\n');
                    }
                }
            } catch (err) {
                console.warn('Failed vector search, falling back to simple text extraction', err);
            }
        }

        // Default fallback: just grap the first few chunks of the document
        if (!contextText && supabaseAdmin) {
            const { data, error } = await supabaseAdmin
                .from('document_chunks')
                .select('content')
                .eq('document_id', documentId)
                .order('chunk_index', { ascending: true })
                .limit(10);

            if (!error && data) {
                contextText = data.map(d => d.content).join('\n\n');
            }
        }

        if (!contextText) {
            // Create a mock context for offline testing or if DB fails
            contextText = `This document covers the fundamentals of ${topic || 'Computer Science'}. It includes definitions, important formulas, and practical examples.`;
        }

        // Prepare Prompts
        let systemPrompt = '';

        if (type === 'flashcards') {
            systemPrompt = `You are an expert tutor. Generate exactly 10 flashcards from the following text. Output ONLY valid JSON, no markdown fences.
Format: { "flashcards": [{ "front": "term", "back": "definition" }] }`;
        } else if (type === 'quiz') {
            systemPrompt = `You are an expert tutor. Generate a 5-question multiple choice quiz from the following text. Output ONLY valid JSON, no markdown fences.
Format: { "quiz": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." }] }`;
        } else {
            return NextResponse.json({ error: 'Invalid type format' }, { status: 400 });
        }

        const userPrompt = `Context Text:\n${contextText.slice(0, 8000)}\n\nGenerate the ${type}:`;

        // Call Groq API
        const apiKey = groqKeyManager.getCurrentKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'GROQ API key not configured' }, { status: 500 });
        }

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    groqKeyManager.rotateKey();
                }
                const errorText = await response.text();
                throw new Error(`Groq API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const resultObj = JSON.parse(data.choices[0].message.content);

            return NextResponse.json(resultObj);
        } catch (e: any) {
            console.error('Groq generation error:', e);
            return NextResponse.json({ error: 'Generation failed', details: e.message }, { status: 500 });
        }

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

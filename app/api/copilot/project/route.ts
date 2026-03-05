import { NextRequest, NextResponse } from 'next/server';
import { generateProjectForTopic } from '@/lib/project-generator';

export async function POST(req: NextRequest) {
    try {
        const { topic, subject } = await req.json();

        if (!topic) {
            return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
        }

        const project = await generateProjectForTopic(topic, subject);

        if (!project) {
            return NextResponse.json({ success: false, error: 'Failed to generate project' }, { status: 500 });
        }

        return NextResponse.json({ success: true, project });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import { groqKeyManager } from './groq-key-manager';

export interface PracticalProject {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    estimatedHours: number;
    techStack: string[];
    learningObjectives: string[];
    steps: string[];
}

export async function generateProjectForTopic(topic: string, subject?: string): Promise<PracticalProject | null> {
    const apiKey = groqKeyManager.getCurrentKey();
    if (!apiKey) return null;

    const systemPrompt = `You are a curriculum designer. Generate a hands-on, practical project description for the given academic topic.
The project should help the student apply theoretical knowledge to a real-world scenario.
Output ONLY valid JSON.
Format: {
  "title": "Project Name",
  "description": "Short description",
  "difficulty": "beginner/intermediate/advanced",
  "estimatedHours": 10,
  "techStack": ["list", "of", "tools"],
  "learningObjectives": ["objective 1", "objective 2"],
  "steps": ["Step 1", "Step 2", "Step 3"]
}`;

    const userPrompt = `Topic: ${topic}${subject ? ` (Subject: ${subject})` : ''}
Generate a practical project:`;

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
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            if (response.status === 429) groqKeyManager.rotateKey();
            throw new Error(`Groq API Error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content) as PracticalProject;
    } catch (error) {
        console.error('Project generation error:', error);
        return null;
    }
}

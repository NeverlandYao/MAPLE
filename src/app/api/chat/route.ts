import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, DEFAULT_MODEL } from '@/lib/ai/client';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const client = getAIClient();

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.6,
      // @ts-ignore - ModelScope specific parameter
      extra_body: { enable_thinking: false },
    });

    const aiResponse = completion.choices[0].message.content;

    return NextResponse.json({
      response: aiResponse,
      timestamp: Date.now() / 1000,
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

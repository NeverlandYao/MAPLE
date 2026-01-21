import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/services/templateService';

export async function GET() {
  try {
    const templates = await templateService.getAll();
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, template_json } = body;

    if (!name || !template_json) {
      return NextResponse.json(
        { error: 'Missing required fields: name, template_json' },
        { status: 400 }
      );
    }

    const template = await templateService.create({
      name,
      description,
      template_json,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

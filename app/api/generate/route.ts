import { NextResponse } from 'next/server';

const GEMINI_BASE_URL_STUDIO = "https://generativelanguage.googleapis.com/v1beta/models";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { modelId, payload } = body;

        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API Key is missing on the server' },
                { status: 500 }
            );
        }

        const cleanModel = modelId.replace('models/', '');
        const url = `${GEMINI_BASE_URL_STUDIO}/${cleanModel}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errorBody = "";
            try { errorBody = await response.text(); } catch (e) { }

            return NextResponse.json(
                {
                    error: `Gemini API Error: ${errorBody}`,
                    is404: response.status === 404
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

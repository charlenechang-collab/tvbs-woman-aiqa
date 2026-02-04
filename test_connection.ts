
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

async function main() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

        // Attempt to list models if the SDK supports it, or just try a simple generation with a known base model
        console.log("Testing API Key connection...");

        // 1. Try gemini-1.5-flash
        try {
            console.log("Attempting gemini-1.5-flash...");
            const model = ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: 'Hello, are you there?',
            });
            const result = await model;
            console.log("Success with gemini-1.5-flash:", result.text ? "Yes" : "No text");
        } catch (e: any) {
            console.error("Failed gemini-1.5-flash:", e.message);
        }

        // 2. Try gemini-1.0-pro (older stable)
        try {
            console.log("Attempting gemini-1.0-pro...");
            const model = ai.models.generateContent({
                model: 'gemini-1.0-pro',
                contents: 'Hello?',
            });
            const result = await model;
            console.log("Success with gemini-1.0-pro:", result.text ? "Yes" : "No text");
        } catch (e: any) {
            console.error("Failed gemini-1.0-pro:", e.message);
        }

    } catch (err: any) {
        console.error("Fatal Error:", err);
    }
}

main();

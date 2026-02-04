
import { GoogleGenAI } from "@google/genai";

const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
console.log("Key length:", key ? key.length : 0);

const ai = new GoogleGenAI({ apiKey: key });

async function run() {
    try {
        console.log("--- Attempting to LIST models ---");
        // Some SDK versions use ai.models.list(), others might differ.
        // We try/catch around it.
        const listResp = await ai.models.list();
        if (listResp && listResp.models) {
            console.log("Available Models:");
            listResp.models.forEach(m => console.log(` - ${m.name}`));
        } else {
            console.log("List response empty/unknown format:", listResp);
        }
    } catch (e) {
        console.error("List Models FAILED:", e.message);
    }

    console.log("\n--- Attempting Generate with 'gemini-1.5-flash' ---");
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'Test'
        });
        console.log("Success:", res.text);
    } catch (e) {
        console.error("Gen 'gemini-1.5-flash' FAILED:", e.message);
    }

    console.log("\n--- Attempting Generate with 'models/gemini-1.5-flash' ---");
    try {
        const res = await ai.models.generateContent({
            model: 'models/gemini-1.5-flash',
            contents: 'Test'
        });
        console.log("Success:", res.text);
    } catch (e) {
        console.error("Gen 'models/gemini-1.5-flash' FAILED:", e.message);
    }
}

run();


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Manual .env parser (No dotenv needed) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed === '') continue;

            // basic parsing KEY=VALUE
            const parts = trimmed.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                let val = parts.slice(1).join('=').trim();
                // remove quotes if present
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }

                if (key === 'GEMINI_API_KEY' || key === 'API_KEY') {
                    apiKey = val;
                    break;
                }
            }
        }
    } catch (e) {
        console.error("Error reading .env:", e);
    }
}

if (!apiKey) {
    console.error("❌ No API Key found in .env or process.env");
    process.exit(1);
}

console.log(`🔑 Using API Key: ${apiKey.substring(0, 5)}...`);

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            // Check for specific error codes
            console.error("❌ API Error:", JSON.stringify(data.error, null, 2));
            if (data.error.code === 400 || data.error.status === 'INVALID_ARGUMENT') {
                console.log("👉 DIAGNOSIS: The API Key is INVALID.");
            }
            return;
        }

        if (!data.models) {
            console.log("⚠️ No models returned. Raw response:", data);
            return;
        }

        console.log("\n✅ Available Models for this Key:");
        console.log("---------------------------------");
        const workingModels = [];
        for (const m of data.models) {
            // Filter only generateContent supported models
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`- ${m.name}`);
                workingModels.push(m.name);
            }
        }
        console.log("---------------------------------");

        // Save to a file so the agent can read it
        fs.writeFileSync('available_models.json', JSON.stringify(workingModels, null, 2));
        console.log("💾 List saved to available_models.json");

    } catch (e) {
        console.error("❌ Network/Script Error:", e);
    }
}

listModels();

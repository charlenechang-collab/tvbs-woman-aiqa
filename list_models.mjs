
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env manually since we are in a script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    config({ path: envPath });
}

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}

console.log(`🔑 Using API Key: ${apiKey.substring(0, 5)}...`);

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", JSON.stringify(data.error, null, 2));
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
                console.log(`- ${m.name} (${m.displayName})`);
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

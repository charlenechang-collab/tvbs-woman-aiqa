import 'dotenv/config'; // Make sure to install dotenv if running this script manually

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
console.log(`🔑 Testing API Key: ${apiKey.substring(0, 10)}...`);

async function verifyKey() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("✅ API Key is Valid! Connection successful.");
            if (data.models) {
                console.log(`📦 Found ${data.models.length} models.`);
                const flash = data.models.find(m => m.name.includes('flash'));
                if (flash) console.log(`   - Includes: ${flash.name}`);
            }
        }
    } catch (e) {
        console.error("❌ Network Error:", e.message);
    }
}

verifyKey();

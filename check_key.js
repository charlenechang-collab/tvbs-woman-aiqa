
const fs = require('fs');
try {
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/GEMINI_API_KEY=(.*)/);
    if (match) {
        console.log("Key Start:", match[1].substring(0, 4));
    } else {
        console.log("Key not found in .env");
    }
} catch (e) {
    console.log("Read Error:", e.message);
}

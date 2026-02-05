# TVBS Woman AI-QA Generator

A React-based AI content generation tool designed for **TVBS 《女人我最大》**. This application leverages **Google Gemini API** and **RAG (Retrieval-Augmented Generation)** to produce high-quality, SEO-optimized Q&A content based on historical article data.

## 🚀 Features

- **RAG Architecture**: Client-side retrieval using vector-like context matching from `database.csv`.
- **Intelligent Model Strategy**:
  - Automatically prioritizes **Gemini 3.0 / 2.5 Flash** for maximum cost-efficiency and speed.
  - Implements robust **Fallback Logic** to `Gemini 3.0 Pro` (and older Pro versions) ensuring high availability.
- **Smart Caching**: LocalStorage-based persistence; remembers valid results even after page refreshes.
- **Structured Output**: Generates strict JSON formats suitable for CMS integration.
- **Strict Prompt Engineering**: Enforces rigid editorial rules (Strict **6 Items**, 18-char titles, Crossover trends) to maintain content quality.
- **Responsive UI**: Modern, clean interface built with React 19 and Tailwind-inspired CSS principles.

## 🛠 Tech Stack

- **Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **AI Integration**: Google Generative AI (Gemini 3.0 / 2.5 / 1.5)
- **Styling**: Vanilla CSS (Scoped & Modular)
- **Testing**: Playwright

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- A valid Google Gemini API Key

### 1. Clone the repository
```bash
git clone <repository-url>
cd tvbs-woman-aiqa
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
# Required for AI generation
API_KEY=your_google_gemini_api_key
```

### 4. Run Locally
```bash
npm run dev
```
The application will start at `http://127.0.0.1:5173`.

## 📂 Project Structure

```
├── App.tsx                 # Main application controller & state management
├── services/
│   └── geminiService.ts    # AI Model interaction, Fallback logic & Prompt engineering
├── components/             # Reusable UI components
├── prompts/                # System prompts and templates
├── database.csv            # Source data for RAG (Add your corpus here)
└── public/                 # Static assets
```

## 🧪 Scripts

- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm run test`: Run E2E tests with Playwright.

## 📝 License
Proprietary - TVBS internal use only.

# Frontend Specification

## Design System
- **Framework**: Tailwind CSS
- **Theme**: Pink/Rose gradient aesthetic (`from-pink-50 via-white to-purple-50`)
- **Key Components**:
    - `DatabaseUploader`: Handles CSV file ingest.
    - `ArticleInput`: Text area for target article content.
    - `QAOutput`: Renders generated Q&A pairs.

## UI Rules (STRICT)
- **Do NOT modify**:
    - `index.css`
    - Tailwind classes in any components.
    - Layout structure.
    - Color palette.
    - Animations (Loader2, Sparkles).

## State Flow
1. **Init**: Load `database.csv` automatically if present.
2. **Input**: User enters article text.
3. **Action**: User clicks "Generate".
4. **Process**:
    - Find relevant articles (Client-side RAG).
    - Call Gemini API (via `geminiService.ts`).
    - Post-process response (Clean markdown, map IDs).
5. **Result**: Display Q&A cards with "Regenerate" options.

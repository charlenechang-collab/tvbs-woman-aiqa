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
    - Layout structure.
    - Animations (Loader2, Sparkles).
    - **Color Palette (Strict Harmonization)**:
        - **Primary**: Pink/Rose Gradients.
        - **Success**: Teal (`teal-500`, `teal-50`) - *No generic green*.
        - **Action/Neutral**: Deep Purple (`purple-900`) - *No generic slate*.
        - **Warning/Error**: Rose (`rose-400`, `rose-600`) - *No generic orange/red*.

## State Flow
1. **Init**: Load `database.csv` automatically if present.
2. **Input**: User enters article text.
3. **Action**: User clicks "Generate".
4. **Process**:
    - Find relevant articles (Client-side RAG).
    - Call Gemini API (via `geminiService.ts`).
    - Post-process response (Clean markdown, map IDs).
5. **Result**: Display Q&A cards with "Regenerate" options.

## QA Output Formatting Rules (CRITICAL)
- **Header Rendering**:
    - **Visual Style**: H2 headers must be rendered with a **Pink Left Border** style (`border-l-4 border-pink-400`).
    - **Detection Logic**: The system must support **Robust Regex** detection for headers to handle AI variability.
        - Must match: `**Title**` (Bold only)
        - Must match: `## Title` (Markdown H2)
        - Must match: `## **Title**` (Mixed)
        - **Regex**: `/^\s*(?:##\s*(?:\*\*)?|(?:\*\*))(.+?)(?:\*\*)?\s*$/`
- **Content Sanitization**:
    - **Bold Cleanup**: To prevent "Pseudo-Headers" (H3), the system post-processes list items to remove bold formatting from the start of the line (e.g., `1. **Title**` -> `1. Title`).

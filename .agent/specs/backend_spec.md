# Backend & Service Specification

## AI Service (`services/geminiService.ts`)

### API Strategy
- **Protocol**: Raw REST API (`fetch`)
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Authentication**: API Key (Query param).

### Model Strategy (Fallback)
The system attempts models in this specific order to balance cost and performance:
1. `gemini-3.0-flash-preview` (Latest, efficient)
2. `gemini-2.5-flash`
3. `gemini-1.5-flash`
4. `gemini-3.0-pro-preview` (Fallback high-reasoning)
5. `gemini-2.5-pro`
6. `gemini-1.5-pro`

### RAG Logic
- **Context Window**: Top 5 most relevant articles from CSV based on simple keyword/content matching (client-side).
- **Prompt Structure**:
    - System Role: Defined in `prompts/v2_base_prompt.txt`.
    - User Prompt: Combines Target Article + RAG Context + Strict output JSON schema instructions.
    - **Formatting Constraints**:
        - **Structure**: Strictly enforced **3-Paragraph / 3-H2** structure.
        - **Prohibitions**: No H3/H4 headers. No "Pseudo-headers" (bold text at start of list items).
        - **Trend Injection**: DISABLED (Do not fetch or hallucinate 2026 trends).

### Error Handling
- **404/Model Not Found**: Automatically try next model in list.
- **Safety Filters**: Catch and report.
- **Output Validation**: JSON parsing with schema enforcement.

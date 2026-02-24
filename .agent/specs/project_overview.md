# Project Overview: TVBS Woman AI QA Generator

## Identity
- **Name**: TVBS 女人我最大 - 延伸問答產生器 (AI Extended Q&A Generator)
- **Version**: 0.0.0 (Pre-release)
- **Purpose**: Generates extended Q&A pairs for articles using a RAG (Retrieval-Augmented Generation) approach combined with Google's Gemini API.

## Core Architecture
- **Frontend**: React 19 + TypeScript + Next.js (App Router)
- **Styling**: Tailwind CSS (Utility-first) - **STRICT FREEZE ON UI/AI**
- **State Management**: React Context / Local State
- **AI Integration**: Backend Next.js API route proxy to Google Gemini (Multi-model fallback strategy) to secure the API Key.
- **Data Source**: Client-side CSV parsing (PapaParse) for RAG context.

## Key Constraints
- **UI/CX**: strict NO-CHANGE policy on current frontend design and CSS.
- **API**: Must use REST API for Gemini to avoid SDK version conflicts, accessed via internal Next.js API Route.
- **Auth**: Server-side API Key (`GEMINI_API_KEY`) accessed in Vercel environment.

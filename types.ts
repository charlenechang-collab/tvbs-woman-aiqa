export interface Article {
  id: string;
  title: string;
  content: string;
  [key: string]: string; // Allow loose CSV parsing
}

export interface QAPair {
  question: string;
  answer: string;
  sourceId: string;
  sourceTitle: string;
}

export interface RagContext {
  id: string;
  title: string;
  content: string;
}

export interface GenerateRequest {
  inputArticle: string;
  ragContext: RagContext[];
}

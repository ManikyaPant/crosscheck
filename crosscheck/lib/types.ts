export type Statement = { original: string; english: string; language: string; source?: string };
export type Conflict = {
  id: string; type: string; topic: string; severity: "high" | "medium" | "low";
  statement_a: { value: string; quote: string; normalized: string };
  statement_b: { value: string; quote: string; normalized: string };
  explanation: string; clarification_question: string; confidence: number;
};
export type Comparison = {
  conflicts: Conflict[]; unaddressed: { topic: string; statement: "A" | "B"; value: string }[];
  agreements: { topic: string; value: string }[]; summary: string;
  statements: { a: Statement; b: Statement }; demo?: boolean; degraded?: boolean;
};

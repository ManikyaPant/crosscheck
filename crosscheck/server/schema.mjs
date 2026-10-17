import { z } from 'zod';

const bounded = z.string().min(1).max(4000);
const claim = z.object({ value: bounded, quote: bounded, normalized: bounded }).strict();
export const resultSchema = z.object({
  conflicts: z.array(z.object({
    id: z.string().min(1).max(100),
    type: z.enum(['time', 'date', 'price', 'quantity', 'place', 'name', 'promise', 'other']),
    topic: bounded, severity: z.enum(['high', 'medium', 'low']),
    statement_a: claim, statement_b: claim, explanation: bounded,
    clarification_question: bounded, confidence: z.number().min(0).max(1),
  }).strict()).max(30),
  unaddressed: z.array(z.object({ topic: bounded, statement: z.enum(['A', 'B']), value: bounded }).strict()).max(50),
  agreements: z.array(z.object({ topic: bounded, value: bounded }).strict()).max(50),
  summary: bounded,
}).strict();

const str = { type: 'string' };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const claimJson = object({ value: str, quote: str, normalized: str });
export const jsonSchema = object({
  conflicts: { type: 'array', items: object({
    id: str, type: { type: 'string', enum: ['time','date','price','quantity','place','name','promise','other'] },
    topic: str, severity: { type: 'string', enum: ['high','medium','low'] },
    statement_a: claimJson, statement_b: claimJson, explanation: str, clarification_question: str,
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  }) },
  unaddressed: { type: 'array', items: object({ topic: str, statement: { type: 'string', enum: ['A','B'] }, value: str }) },
  agreements: { type: 'array', items: object({ topic: str, value: str }) }, summary: str,
});

export const statementSchema = z.object({
  original: z.string().trim().min(1).max(12000),
  english: z.string().trim().max(12000).default(''),
  language: z.enum(['unknown','hi-IN','bn-IN','kn-IN','ml-IN','mr-IN','od-IN','pa-IN','ta-IN','te-IN','en-IN','gu-IN','as-IN','ur-IN','ne-IN','kok-IN','ks-IN','sd-IN','sa-IN','sat-IN','mni-IN','brx-IN','mai-IN','doi-IN']).default('unknown'),
}).strict();

export const textInputSchema = z.object({
  a: statementSchema, b: statementSchema,
  topic: z.string().trim().max(500).default(''),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
    const date = new Date(s); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === s;
  }, 'Use a valid reference date.').optional(),
}).strict();

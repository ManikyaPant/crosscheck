import { resultSchema, jsonSchema } from './schema.mjs';
import { SYSTEM_PROMPT } from './prompts.mjs';

export class ApiError extends Error {
  constructor(message, status = 500, code = 'processing_failed') { super(message); this.status = status; this.code = code; }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function createSarvam(key, { fetchImpl = fetch, sleepImpl = sleep, timeoutMs = 30000 } = {}) {
  async function request(path, bodyFactory, isJson = false, signal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new ApiError('Comparison cancelled.', 499, 'cancelled');
      let response;
      try {
        response = await fetchImpl(`https://api.sarvam.ai${path}`, {
          method: 'POST', headers: { 'api-subscription-key': key, ...(isJson ? { 'Content-Type': 'application/json' } : {}) },
          body: bodyFactory(), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (signal?.aborted) throw new ApiError('Comparison cancelled.', 499, 'cancelled');
        if (attempt < 2) { await sleepImpl(500 * 2 ** attempt); continue; }
        throw new ApiError('Sarvam did not respond in time. Please try again.', 504, 'upstream_timeout');
      }
      if (response.ok) {
        try { return await response.json(); } catch { throw new ApiError('Sarvam returned an unreadable response. Please retry.', 502, 'invalid_upstream'); }
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.arrayBuffer().catch(() => {});
        const retry = Number(response.headers.get('retry-after'));
        await sleepImpl(Math.min(5000, retry > 0 ? retry * 1000 : 500 * 2 ** attempt)); continue;
      }
      if (response.status === 401 || response.status === 403) throw new ApiError('The server’s Sarvam API key was rejected. Check its access and balance.', 503, 'api_key_rejected');
      if (response.status === 422) throw new ApiError('Sarvam could not process this input. For audio, use a supported clip of 30 seconds or less; trim longer clips or use Sarvam Batch.', 422, 'unsupported_input');
      if (response.status === 429) throw new ApiError('Sarvam is busy. Wait a moment and try again.', 429, 'rate_limited');
      throw new ApiError('Sarvam could not complete this request. Please try again.', 502, 'upstream_error');
    }
  }
  async function transcribe(file, language, progress = () => {}, signal) {
    const call = mode => request('/speech-to-text', () => {
      const form = new FormData(); form.append('file', file, file.name);
      form.append('model', 'saaras:v4'); form.append('mode', mode); form.append('language_code', language || 'unknown');
      return form;
    }, false, signal);
    progress('transcribing');
    const native = await call('transcribe');
    if (typeof native.transcript !== 'string' || !native.transcript.trim()) throw new ApiError('No clear speech was detected. Please record again in a quiet place.', 422, 'empty_transcript');
    let english = native.transcript;
    if (!native.language_code?.toLowerCase().startsWith('en')) {
      progress('translating'); const translated = await call('translate');
      if (typeof translated.transcript !== 'string' || !translated.transcript.trim()) throw new ApiError('Translation was empty. Please try again or correct the transcript.', 422, 'empty_translation');
      english = translated.transcript;
    }
    progress('ready');
    return { original: native.transcript, english, language: native.language_code || 'unknown', source: 'audio' };
  }
  async function compare(a, b, topic, referenceDate, signal) {
    const payload = JSON.stringify({ reference_date: referenceDate, topic, statement_a: a, statement_b: b });
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await request('/v1/chat/completions', () => JSON.stringify({
        model: 'sarvam-105b', temperature: 0.2, reasoning_effort: 'medium', max_tokens: 6000,
        messages: [ { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: payload },
          ...(attempt ? [{ role: 'user', content: 'Your prior output failed validation. Return only complete JSON matching the schema. Quote exact spans from the original transcripts.' }] : []) ],
        response_format: { type: 'json_schema', json_schema: { name: 'crosscheck_result', strict: true, schema: jsonSchema } },
      }), true, signal);
      const content = result.choices?.[0]?.message?.content;
      try {
        if (result.choices?.[0]?.finish_reason === 'length') throw new Error('Truncated');
        const validated = resultSchema.parse(JSON.parse(content));
        if (new Set(validated.conflicts.map(c => c.id)).size !== validated.conflicts.length) throw new Error('Duplicate IDs');
        for (const conflict of validated.conflicts) {
          if (!a.original.includes(conflict.statement_a.quote) || !b.original.includes(conflict.statement_b.quote)) throw new Error('Ungrounded quote');
        }
        return validated;
      } catch {
        if (attempt === 1) return {
          conflicts: [], unaddressed: [], agreements: [], degraded: true,
          summary: 'The model could not produce a reliable structured comparison after two attempts. No conclusion was reached. Please review the transcripts and try again.',
        };
      }
    }
  }
  return { transcribe, compare };
}

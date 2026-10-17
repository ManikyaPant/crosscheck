import { z } from 'zod';
import { createSarvam, ApiError } from './sarvam.mjs';
import { textInputSchema, statementSchema } from './schema.mjs';

// Two files plus form fields stay below Vercel's 4.5 MB request limit.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const audioExtensions = /\.(wav|mp3|m4a|mp4|webm|ogg|oga|opus|flac|aac|aiff|aif|amr|wma)$/i;
export function validateAudio(file) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || !file.size) throw new ApiError('Add an audio file for both statements.', 400, 'missing_audio');
  if (file.size > MAX_FILE_BYTES) throw new ApiError('Each audio file must be 2 MB or smaller.', 413, 'file_too_large');
  if (!audioExtensions.test(file.name || '')) throw new ApiError('Use a WAV, MP3, M4A, WebM, OGG, OPUS, FLAC, AAC, AIFF, AMR or WMA audio file.', 415, 'invalid_audio_type');
}
export function todayIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
}
export function publicError(error) {
  if (error instanceof z.ZodError) return { status: 400, error: 'Check the statements, language selection, topic length and reference date.', code: 'invalid_input' };
  if (error instanceof ApiError) return { status: error.status, error: error.message, code: error.code };
  return { status: 500, error: 'Something went wrong while comparing. Please try again.', code: 'processing_failed' };
}

export async function handleCompare(request, key, options = {}) {
  const fail = error => { const {status, ...body} = publicError(error); return Response.json(body, {status, headers: {'Cache-Control':'no-store'}}); };
  if (!key) return fail(new ApiError('Live comparison needs a server-side SARVAM_API_KEY. You can explore the sample comparisons meanwhile.', 503, 'key_not_configured'));
  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > 2 * MAX_FILE_BYTES + 100000) return fail(new ApiError('Upload size exceeds the 4 MB total limit.', 413, 'file_too_large'));
  let input, files;
  try {
    const type = request.headers.get('content-type') || '';
    if (type.includes('application/json')) input = textInputSchema.parse(await request.json());
    else if (type.includes('multipart/form-data')) {
      const form = await request.formData();
      if (form.get('consent') !== 'true') throw new ApiError('Please confirm consent before processing audio.', 400, 'consent_required');
      files = { a: form.get('audio_a'), b: form.get('audio_b') };
      // Mixed audio/text input is supported; each side must provide exactly one source.
      const side = id => {
        const text = form.get(`text_${id}`);
        if (files[id] && text) throw new ApiError('Choose one source per statement.',400,'invalid_input');
        if (files[id]) { validateAudio(files[id]); return { original: '', english: '', language: form.get(`language_${id}`) || 'unknown' }; }
        if (!text || typeof text !== 'string') throw new ApiError('Add both statements before comparing.',400,'missing_statement');
        return statementSchema.parse(JSON.parse(text));
      };
      const a = side('a'), b = side('b');
      const meta = textInputSchema.pick({topic:true, referenceDate:true}).parse({ topic: form.get('topic') || '', referenceDate: form.get('referenceDate') || undefined });
      for (const s of [a,b]) if (!statementSchema.shape.language.safeParse(s.language).success) throw new ApiError('Choose a supported language.',400,'invalid_language');
      input = {a,b,...meta};
    } else throw new ApiError('Send JSON transcripts or multipart audio.', 415, 'invalid_content_type');
  } catch (error) {
    return fail(error instanceof SyntaxError ? new ApiError('The submitted data could not be read.',400,'invalid_input') : error);
  }
  const client = createSarvam(key, options);
  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort(), { once:true });
  const run = async emit => {
    const entries = await Promise.all(['a','b'].map(async id => {
      const statement = files?.[id] ? await client.transcribe(files[id], input[id].language, stage => emit({kind:'progress', statement:id,stage}), abort.signal) : {...input[id], source:'text'};
      emit({kind:'transcript',statement:id,data:statement});
      return [id,statement];
    }));
    const statements = Object.fromEntries(entries);
    files = undefined; // Release request-scoped audio references after STT.
    emit({kind:'progress',stage:'comparing'});
    const result = await client.compare(statements.a, statements.b, input.topic, input.referenceDate || todayIndia(), abort.signal);
    return {...result, statements};
  };
  if (request.headers.get('accept')?.includes('application/x-ndjson')) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const emit = value => { if (!closed && !abort.signal.aborted) { try {controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));} catch {closed = true; abort.abort();} } };
        try { emit({kind:'progress',stage:'starting'}); emit({kind:'result',data:await run(emit)}); }
        catch(error) { abort.abort(); const body = publicError(error); if (!closed) { try {controller.enqueue(encoder.encode(JSON.stringify({kind:'error',...body})+'\n'));} catch {} } }
        finally {closed = true; files = undefined; try {controller.close();} catch {}}
      },
      cancel() { abort.abort(); files = undefined; },
    });
    return new Response(stream, {headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  try { return Response.json(await run(() => {}), {headers:{'Cache-Control':'no-store'}}); }
  catch(error) {abort.abort(); return fail(error);}
  finally {files = undefined;}
}

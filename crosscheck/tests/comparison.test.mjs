import test from 'node:test';
import assert from 'node:assert/strict';
import { readComparisonStream } from '../lib/compare-stream.mjs';
import { createSarvam } from '../server/sarvam.mjs';

const encode = value => new TextEncoder().encode(JSON.stringify(value) + '\n');

test('a result finishes loading even if the connection remains open', { timeout: 500 }, async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(encode({ kind: 'result', data: { summary: 'One conflict' } })); },
    cancel() { cancelled = true; return new Promise(() => {}); },
  });
  assert.deepEqual(await readComparisonStream(body), { summary: 'One conflict' });
  assert.equal(cancelled, true);
});

test('split UTF-8 and NDJSON events preserve the result', async () => {
  const bytes = encode({ kind: 'result', data: { summary: 'मीटिंग' } });
  const split = bytes.indexOf(0xe0) + 1;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(encode({ kind: 'progress', stage: 'comparing' }));
    controller.enqueue(bytes.slice(0, split)); controller.enqueue(bytes.slice(split)); controller.close();
  } });
  const events = [];
  assert.equal((await readComparisonStream(body, { onEvent: e => events.push(e.kind) })).summary, 'मीटिंग');
  assert.deepEqual(events, ['progress', 'result']);
});

test('a deadline cancels a stalled stream and releases the reader', { timeout: 500 }, async () => {
  let cancelled = false;
  const controller = new AbortController();
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), 10);
  try { await assert.rejects(readComparisonStream(body, { signal: controller.signal }), { name: 'TimeoutError' }); }
  finally { clearTimeout(timer); }
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('server errors are surfaced rather than waiting for more events', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(encode({ kind: 'error', error: 'Please try again.' })); } });
  await assert.rejects(readComparisonStream(body), /Please try again/);
});

test('the generation prompt teaches the model every required schema field', async () => {
  const result = { conflicts: [], agreements: [{ topic: 'time', value: '14:00' }], unaddressed: [], summary: 'Both statements agree.' };
  const client = createSarvam('unit-test-only', { fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    const promptSchema = body.messages[0].content.split('Required output JSON Schema:\n')[1];
    assert.ok(promptSchema, 'Schema must be in the prompt, not just the constrained decoder.');
    const schema = JSON.parse(promptSchema);
    assert.ok(schema.properties.conflicts.items.properties.statement_a.required.includes('normalized'));
    assert.equal(body.reasoning_effort, null);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
  } });
  const statement = { original: '2 PM', english: '', language: 'en-IN' };
  assert.deepEqual(await client.compare(statement, statement, '', '2026-10-17'), result);
});

test('an upstream timeout does not start duplicate model generations', async () => {
  let requests = 0;
  const client = createSarvam('unit-test-only', {
    fetchImpl: async () => { requests++; throw new DOMException('Timed out', 'TimeoutError'); },
    sleepImpl: async () => assert.fail('A timeout must not be retried.'),
  });
  const statement = { original: '2 PM', english: '', language: 'en-IN' };
  await assert.rejects(client.compare(statement, statement, '', '2026-10-17'), error => error.code === 'upstream_timeout');
  assert.equal(requests, 1);
});

/**
 * @param {ReadableStream<Uint8Array>} body
 * @param {{signal?: AbortSignal, onEvent?: (event: any) => void}} options
 */
export async function readComparisonStream(body, { signal, onEvent = () => {} } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      if (done && buffer.trim()) { lines.push(buffer); buffer = ''; }
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); }
        catch { throw new Error('The comparison response was unreadable. Please try again.'); }
        if (event.kind === 'error') throw new Error(event.error || 'Comparison failed. Please try again.');
        onEvent(event);
        // A result is terminal. Do not leave the UI busy waiting for network EOF.
        if (event.kind === 'result') return event.data;
      }
      if (done) throw new Error('The comparison was interrupted. Please try again.');
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    // Transport teardown must not delay a terminal result or an error.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

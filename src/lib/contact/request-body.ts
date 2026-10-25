// Fits the permitted field/token lengths, including six-byte JSON character escapes.
export const MAX_CONTACT_BODY_BYTES = 64 * 1024;

export async function readContactBody(body: ReadableStream<Uint8Array> | null): Promise<unknown> {
  if (!body) {
    throw new Error('Invalid body');
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_CONTACT_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // Preserve the size error if the stream cannot be cancelled cleanly.
      }
      throw new Error('Body too large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

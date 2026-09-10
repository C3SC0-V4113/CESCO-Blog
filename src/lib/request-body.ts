const rejectedBodyLimit = 8 * 1024;
type Body = ReadableStream<Uint8Array> | null;

export async function drainBody(body: Body, declared: number) {
  if (!body) return;
  if (declared > rejectedBodyLimit) return body.cancel().catch(() => undefined);
  const reader = body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    size += value.byteLength;
    if (size > rejectedBodyLimit) return reader.cancel().catch(() => undefined);
  }
}

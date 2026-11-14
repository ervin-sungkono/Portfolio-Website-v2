import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Contact } from '../../src/lib/contact/validation.ts';

const valid = {
  name: 'Ervin',
  subject: 'Portfolio enquiry',
  email: 'visitor@example.com',
  message: 'Hello, let’s discuss a project.',
};

test('trims contact fields and accepts a complete message', () => {
  const result = Contact.validate({ ...valid, name: '  Ervin  ', message: ' Hello\nthere. ' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.data.name, 'Ervin');
  assert.equal(result.data.message, 'Hello\nthere.');
});

test('rejects missing fields, objects, and whitespace-only messages', () => {
  assert.equal(Object.keys(Contact.validate(null).errors).length, 4);
  assert.equal(
    Object.keys(Contact.validate({ name: {}, subject: [], email: 7, message: '   ' }).errors)
      .length,
    4,
  );
});

test('rejects malformed addresses and email header injection', () => {
  for (const email of [
    'bad-email',
    'visitor@example.com\r\nBcc: someone@example.com',
    'visitor @example.com',
  ]) {
    assert.ok(Contact.validate({ ...valid, email }).errors.email);
  }
  assert.ok(
    Contact.validate({ ...valid, subject: 'Hello\nBcc: someone@example.com' }).errors.subject,
  );
});

test('enforces length boundaries before sending mail', () => {
  assert.deepEqual(
    Contact.validate({
      ...valid,
      name: 'a'.repeat(100),
      subject: 's'.repeat(160),
      message: 'm'.repeat(5000),
    }).errors,
    {},
  );
  assert.ok(Contact.validate({ ...valid, name: 'a'.repeat(101) }).errors.name);
  assert.ok(Contact.validate({ ...valid, subject: 's'.repeat(161) }).errors.subject);
  assert.ok(Contact.validate({ ...valid, email: 'a'.repeat(245) + '@example.com' }).errors.email);
  assert.ok(Contact.validate({ ...valid, message: 'm'.repeat(5001) }).errors.message);
});

test('formats a text-only email without interpreting visitor HTML', () => {
  const text = Contact.formatEmail({ ...valid, message: '<script>alert(1)</script>' });
  assert.ok(text.includes('Email: visitor@example.com'));
  assert.ok(text.includes('<script>alert(1)</script>'));
});

test('reads a maximum-length Unicode contact request with a CAPTCHA token', async () => {
  const payload = {
    name: '名'.repeat(100),
    subject: '件名'.repeat(80),
    email: 'a'.repeat(242) + '@example.com',
    message: '日'.repeat(5000),
    recaptcha_token: 'x'.repeat(1500),
  };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  assert.ok(encoded.byteLength > 16384);
  assert.ok(encoded.byteLength < Contact.maxBodyBytes);

  const parsed = await Contact.readBody(new Response(encoded).body);
  assert.deepEqual(Contact.validate(parsed).errors, {});
  assert.equal((parsed as typeof payload).message, payload.message);
});

test('rejects oversized streamed request bodies and cancels the stream', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(Contact.maxBodyBytes + 1));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(Contact.readBody(body), /Body too large/);
  assert.equal(cancelled, true);
});

test('accepts request bodies at the byte limit', async () => {
  const encoded = new TextEncoder().encode(`"${'x'.repeat(Contact.maxBodyBytes - 2)}"`);
  assert.equal(encoded.byteLength, Contact.maxBodyBytes);
  assert.equal(
    ((await Contact.readBody(new Response(encoded).body)) as string).length,
    Contact.maxBodyBytes - 2,
  );
});

test('fits maximum permitted fields even with six-byte JSON character escapes', async () => {
  const payload = {
    name: '\u0000'.repeat(100),
    subject: '\u0000'.repeat(160),
    email: 'a'.repeat(242) + '@example.com',
    message: '\u0000'.repeat(5000),
    website: '',
    recaptcha_token: '\u0000'.repeat(Contact.captchaTokenMaxLength),
  };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  assert.deepEqual(Contact.validate(payload).errors, {});
  assert.ok(encoded.byteLength < Contact.maxBodyBytes);
  assert.deepEqual(await Contact.readBody(new Response(encoded).body), payload);
});

test('rejects missing or malformed JSON bodies', async () => {
  await assert.rejects(Contact.readBody(null), /Invalid body/);
  await assert.rejects(Contact.readBody(new Response('{broken').body), SyntaxError);
});

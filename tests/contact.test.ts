import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContact, emailText } from '../src/lib/contact/validation.ts';

const valid = {
  name: 'Ervin',
  subject: 'Portfolio enquiry',
  email: 'visitor@example.com',
  message: 'Hello, let’s discuss a project.',
};

test('trims contact fields and accepts a complete message', () => {
  const result = validateContact({ ...valid, name: '  Ervin  ', message: ' Hello\nthere. ' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.data.name, 'Ervin');
  assert.equal(result.data.message, 'Hello\nthere.');
});

test('rejects missing fields, objects, and whitespace-only messages', () => {
  assert.equal(Object.keys(validateContact(null).errors).length, 4);
  assert.equal(
    Object.keys(validateContact({ name: {}, subject: [], email: 7, message: '   ' }).errors).length,
    4,
  );
});

test('rejects malformed addresses and email header injection', () => {
  for (const email of [
    'bad-email',
    'visitor@example.com\r\nBcc: someone@example.com',
    'visitor @example.com',
  ]) {
    assert.ok(validateContact({ ...valid, email }).errors.email);
  }
  assert.ok(
    validateContact({ ...valid, subject: 'Hello\nBcc: someone@example.com' }).errors.subject,
  );
});

test('enforces length boundaries before sending mail', () => {
  assert.deepEqual(
    validateContact({
      ...valid,
      name: 'a'.repeat(100),
      subject: 's'.repeat(160),
      message: 'm'.repeat(5000),
    }).errors,
    {},
  );
  assert.ok(validateContact({ ...valid, name: 'a'.repeat(101) }).errors.name);
  assert.ok(validateContact({ ...valid, subject: 's'.repeat(161) }).errors.subject);
  assert.ok(validateContact({ ...valid, email: 'a'.repeat(245) + '@example.com' }).errors.email);
  assert.ok(validateContact({ ...valid, message: 'm'.repeat(5001) }).errors.message);
});

test('formats a text-only email without interpreting visitor HTML', () => {
  const text = emailText({ ...valid, message: '<script>alert(1)</script>' });
  assert.ok(text.includes('Email: visitor@example.com'));
  assert.ok(text.includes('<script>alert(1)</script>'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import { emailText } from '../src/lib/contact/validation.ts';

test('Nodemailer constructs the plain-text contact message without a network transport', async () => {
  const data = {
    name: 'Visitor',
    email: 'visitor@example.com',
    subject: 'A question',
    message: '<script>alert("literal text")</script>',
  };
  const sender = 'owner@example.com';
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const result = await transport.sendMail({
    from: sender,
    to: sender,
    replyTo: data.email,
    subject: `Portfolio: ${data.subject}`,
    text: emailText(data),
  });
  const message = JSON.parse(result.message);

  assert.ok(result.messageId);
  assert.deepEqual(result.envelope, { from: sender, to: [sender] });
  assert.equal(message.replyTo[0].address, data.email);
  assert.equal(message.subject, `Portfolio: ${data.subject}`);
  assert.equal(message.text, emailText(data));
  assert.equal(message.html, undefined);
});

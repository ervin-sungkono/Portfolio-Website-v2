import { validateContact } from '@/lib/contact/validation';
import {
  mailConfigured,
  captchaSecret,
  sendContactEmail,
  verifyCaptcha,
} from '@/lib/contact/service';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function readBody(request: Request) {
  if (!request.body) throw new Error('Invalid body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { success: false, message: 'Please submit the form from this website.' },
      { status: 403 },
    );
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ success: false, message: 'Send a JSON request.' }, { status: 415 });
  let input: Record<string, unknown>;
  try {
    input = await readBody(request);
  } catch {
    return Response.json(
      {
        success: false,
        message: 'The message is invalid or too large. Please shorten it and try again.',
      },
      { status: 400 },
    );
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return Response.json({ success: false, message: 'Enter a valid message.' }, { status: 400 });
  const { data, errors } = validateContact(input);
  if (Object.keys(errors).length)
    return Response.json(
      { success: false, message: 'Check the highlighted fields.', errors },
      { status: 400 },
    );
  if (input.website)
    return Response.json(
      { success: false, message: 'The submission could not be accepted.' },
      { status: 400 },
    );
  if (!mailConfigured() || !captchaSecret() || !process.env.NEXT_PUBLIC_RECAPTCHA_KEY)
    return Response.json(
      {
        success: false,
        message: 'Email delivery is temporarily unavailable. Please use LinkedIn to get in touch.',
      },
      { status: 503 },
    );
  try {
    if (
      !(await verifyCaptcha(typeof input.recaptcha_token === 'string' ? input.recaptcha_token : ''))
    )
      return Response.json(
        { success: false, message: 'Verification expired. Please submit the form again.' },
        { status: 400 },
      );
    await sendContactEmail(data);
    return Response.json({
      success: true,
      message: 'Your message has been sent. Thank you for getting in touch.',
    });
  } catch {
    console.error('Portfolio contact delivery failed');
    return Response.json(
      {
        success: false,
        message: 'Your message could not be sent. Please try again or contact me on LinkedIn.',
      },
      { status: 502 },
    );
  }
}

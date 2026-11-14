export type ContactMessage = { name: string; subject: string; email: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactMessage, string>>;
const limits = { name: 100, subject: 160, email: 254, message: 5000 };

export class Contact {
  static readonly fields = ['name', 'subject', 'email', 'message'] as const;
  static readonly captchaTokenMaxLength = 4096;
  // Allows the permitted field lengths even when JSON uses six-byte escapes.
  static readonly maxBodyBytes = 64 * 1024;

  static validate(input: unknown): { data: ContactMessage; errors: ContactErrors } {
    const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const data = Object.fromEntries(
      Contact.fields.map((field) => [
        field,
        typeof record[field] === 'string' ? record[field].trim() : '',
      ]),
    ) as ContactMessage;
    const errors: ContactErrors = {};
    for (const field of Contact.fields) {
      if (!data[field]) {
        errors[field] = `Enter your ${field === 'subject' ? 'subject' : field}.`;
      } else if (data[field].length > limits[field]) {
        errors[field] = `Use no more than ${limits[field]} characters.`;
      }
    }
    if (
      data.email &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(data.email))
    ) {
      errors.email = 'Enter a valid email address.';
    }
    if (/[\r\n]/.test(data.subject)) {
      errors.subject = 'Keep the subject on one line.';
    }
    return { data, errors };
  }

  static formatEmail(data: ContactMessage) {
    return `New portfolio contact\n\nName: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}`;
  }

  static async readBody(body: ReadableStream<Uint8Array> | null): Promise<unknown> {
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
      if (size > Contact.maxBodyBytes) {
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
}

export type ContactMessage = { name: string; subject: string; email: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactMessage, string>>;
export const contactFields = ['name', 'subject', 'email', 'message'] as const;
const limits = { name: 100, subject: 160, email: 254, message: 5000 };

export function validateContact(input: unknown): { data: ContactMessage; errors: ContactErrors } {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const data = Object.fromEntries(
    contactFields.map((field) => [
      field,
      typeof record[field] === 'string' ? record[field].trim() : '',
    ]),
  ) as ContactMessage;
  const errors: ContactErrors = {};
  for (const field of contactFields) {
    if (!data[field]) errors[field] = `Enter your ${field === 'subject' ? 'subject' : field}.`;
    else if (data[field].length > limits[field])
      errors[field] = `Use no more than ${limits[field]} characters.`;
  }
  if (data.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(data.email)))
    errors.email = 'Enter a valid email address.';
  if (/[\r\n]/.test(data.subject)) errors.subject = 'Keep the subject on one line.';
  return { data, errors };
}

export function emailText(data: ContactMessage) {
  return `New portfolio contact\n\nName: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}`;
}

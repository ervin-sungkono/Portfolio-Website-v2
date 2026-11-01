import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __completeCaptcha?: () => void;
    __captchaOptions?: { callback: (token: string) => void };
  }
}

const message = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Portfolio question',
  message: 'I would like to discuss a project.',
};

test.beforeEach(async ({ page }) => {
  await page.route('https://www.google.com/recaptcha/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.grecaptcha = {
          render: (_element, options) => { window.__captchaOptions = options; return 1; },
          execute: () => {},
          reset: () => {}
        };
        window.__completeCaptcha = () => window.__captchaOptions.callback('test-captcha-token');
      `,
    }),
  );
});

async function openAndFillForm(page: import('@playwright/test').Page) {
  await page.goto('/contact');
  await page.getByLabel('Name').fill(message.name);
  await page.getByLabel('Email').fill(message.email);
  await page.getByLabel('Subject').fill(message.subject);
  await page.getByLabel('Message').fill(message.message);
  await page.waitForFunction(() => typeof window.__captchaOptions?.callback === 'function');
}

async function completeCaptcha(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => typeof window.__captchaOptions?.callback === 'function');
  await page.evaluate(() => window.__completeCaptcha?.());
}

test('keeps fields read-only while CAPTCHA is pending and submits one snapshot', async ({
  page,
}) => {
  let postCount = 0;
  let submittedBody: Record<string, string> | undefined;
  await page.route('**/api/contact', async (route) => {
    postCount += 1;
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Your message has been sent.' }),
    });
  });
  await openAndFillForm(page);
  await page.getByRole('button', { name: 'Send Message' }).click();

  await expect(page.getByRole('button', { name: 'Sending' })).toBeDisabled();
  for (const field of ['Name', 'Email', 'Subject', 'Message']) {
    await expect(page.getByLabel(field)).toHaveJSProperty('readOnly', true);
  }
  await page.getByLabel('Message').focus();
  await page.keyboard.type('Changed while busy');
  await expect(page.getByLabel('Message')).toHaveValue(message.message);
  await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await completeCaptcha(page);

  await expect(page.getByText('Your message has been sent.')).toBeVisible();
  for (const field of ['Name', 'Email', 'Subject', 'Message']) {
    await expect(page.getByLabel(field)).toHaveJSProperty('readOnly', false);
  }
  expect(postCount).toBe(1);
  expect(submittedBody).toMatchObject({
    ...message,
    recaptcha_token: 'test-captcha-token',
  });
});

test('retains the draft after a failed contact request', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Please try again.' }),
    }),
  );
  await openAndFillForm(page);
  await page.getByRole('button', { name: 'Send Message' }).click();
  await completeCaptcha(page);

  await expect(page.getByText('Please try again.')).toBeVisible();
  for (const [field, value] of Object.entries(message)) {
    await expect(page.getByLabel(field[0].toUpperCase() + field.slice(1))).toHaveValue(value);
  }
  for (const field of ['Name', 'Email', 'Subject', 'Message']) {
    await expect(page.getByLabel(field)).toHaveJSProperty('readOnly', false);
  }
});

test('clears the draft after a successful contact request', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Your message has been sent.' }),
    }),
  );
  await openAndFillForm(page);
  await page.getByRole('button', { name: 'Send Message' }).click();
  await completeCaptcha(page);

  await expect(page.getByText('Your message has been sent.')).toBeVisible();
  for (const field of ['Name', 'Email', 'Subject', 'Message']) {
    await expect(page.getByLabel(field)).toHaveValue('');
    await expect(page.getByLabel(field)).toHaveJSProperty('readOnly', false);
  }
});

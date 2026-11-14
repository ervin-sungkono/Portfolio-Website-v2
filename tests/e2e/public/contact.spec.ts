import { expect, test } from '@playwright/test';
import type { Recaptcha } from '../../../src/components/contact/ContactForm/type';

declare global {
  interface Window {
    __completeCaptcha?: () => void;
    __captchaAction?: string;
    __captchaResolve?: (token: string) => void;
    grecaptcha?: Recaptcha;
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
          ready: callback => callback(),
          execute: (_siteKey, options) => new Promise(resolve => {
            window.__captchaAction = options.action;
            window.__captchaResolve = resolve;
          }),
        };
        document.body.insertAdjacentHTML('beforeend', '<div class="grecaptcha-badge"></div>');
        window.__completeCaptcha = () => window.__captchaResolve?.('test-captcha-token');
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
  await page.waitForFunction(() => typeof window.grecaptcha?.execute === 'function');
  await expect(page.locator('.grecaptcha-badge')).toHaveCSS('visibility', 'hidden');
  await expect(page.getByText(/This site is protected by reCAPTCHA/)).toBeVisible();
  await expect(page.locator('.captcha-container')).toHaveCount(0);
}

async function completeCaptcha(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__captchaAction === 'contact');
  await page.evaluate(() => window.__completeCaptcha?.());
}

test('keeps CAPTCHA usable after navigating away and back', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Your message has been sent.' }),
    }),
  );
  await page.goto('/contact');
  await page.waitForFunction(() => typeof window.grecaptcha?.execute === 'function');

  const navigation = page.getByRole('navigation', { name: 'Primary' });
  await navigation.getByRole('link', { name: 'About', exact: true }).click();
  await page.waitForURL('**/about');
  await navigation.getByRole('link', { name: 'Contact', exact: true }).click();
  await page.waitForURL('**/contact');
  for (const [field, value] of Object.entries(message)) {
    await page.getByLabel(field[0].toUpperCase() + field.slice(1)).fill(value);
  }
  await page.getByRole('button', { name: 'Send Message' }).click();
  await completeCaptcha(page);
  await expect(page.getByText('Your message has been sent.')).toBeVisible();
});

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

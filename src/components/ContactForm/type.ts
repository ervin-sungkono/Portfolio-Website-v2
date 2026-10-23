export type Captcha = {
  render: (element: HTMLElement, options: Record<string, unknown>) => number;
  execute: (id: number) => void;
  reset: (id: number) => void;
};

export type ContactFormProps = {
  siteKey?: string;
};

declare global {
  interface Window {
    grecaptcha?: Captcha;
    portfolioCaptchaReady?: () => void;
  }
}

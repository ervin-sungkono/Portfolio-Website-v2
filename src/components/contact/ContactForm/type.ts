export type Recaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

export type ContactFormProps = {
  siteKey?: string;
};

declare global {
  interface Window {
    grecaptcha?: Recaptcha;
  }
}

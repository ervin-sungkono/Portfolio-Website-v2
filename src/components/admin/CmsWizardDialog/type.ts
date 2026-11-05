import type { FormEventHandler, ReactNode } from 'react';

export type CmsWizardStep = {
  label: string;
  content: ReactNode;
};

export type CmsWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  steps: readonly CmsWizardStep[];
  activeStep: number;
  onStepChange: (index: number) => void;
  onNext?: () => boolean | Promise<boolean>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange?: () => void;
  pending?: boolean;
  submitLabel: string;
  focusFieldName?: string;
  feedback?: ReactNode;
};

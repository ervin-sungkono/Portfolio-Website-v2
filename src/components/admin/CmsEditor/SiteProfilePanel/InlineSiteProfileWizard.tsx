'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEventHandler, ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import type { CmsWizardStep } from '../../CmsWizardDialog/type';

type InlineSiteProfileWizardProps = {
  title: string;
  description: string;
  steps: readonly CmsWizardStep[];
  activeStep: number;
  onStepChange: (index: number) => void;
  onNext: () => boolean | Promise<boolean>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange: () => void;
  pending: boolean;
  submitLabel: string;
  focusFieldName?: string;
  feedback: ReactNode;
};

export function InlineSiteProfileWizard({
  title,
  description,
  steps,
  activeStep,
  onStepChange,
  onNext,
  onSubmit,
  onChange,
  pending,
  submitLabel,
  focusFieldName,
  feedback,
}: InlineSiteProfileWizardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [validating, setValidating] = useState(false);
  const currentStep = Math.max(0, Math.min(activeStep, steps.length - 1));

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [currentStep]);

  useEffect(() => {
    if (!focusFieldName) {
      return;
    }
    const field = Array.from(
      document.querySelectorAll<HTMLElement>('.cms-site-profile-inline-step [name]'),
    ).find(
      (element) =>
        (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name ===
        focusFieldName,
    );
    field?.focus({ preventScroll: false });
  }, [currentStep, focusFieldName]);

  async function continueToNextStep() {
    if (pending || validating || currentStep >= steps.length - 1) {
      return;
    }
    setValidating(true);
    try {
      if (await onNext()) {
        onStepChange(currentStep + 1);
      }
    } finally {
      setValidating(false);
    }
  }

  return (
    <form
      className="cms-site-profile-inline-wizard"
      onSubmit={(event) => {
        if (currentStep < steps.length - 1) {
          event.preventDefault();
          void continueToNextStep();
          return;
        }
        onSubmit(event);
      }}
      onChange={onChange}
      noValidate
    >
      <header>
        <h3 ref={heading} tabIndex={-1}>
          {title}
        </h3>
        <p>{description}</p>
      </header>
      <nav aria-label={`${title} progress`}>
        <ol>
          {steps.map((step, index) => (
            <li key={step.label} aria-current={index === currentStep ? 'step' : undefined}>
              <span aria-hidden="true">{index + 1}</span> {step.label}
            </li>
          ))}
        </ol>
      </nav>
      <p className="cms-wizard-step-status" role="status" aria-live="polite">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
      </p>
      <div className="cms-site-profile-inline-step">{steps[currentStep]?.content}</div>
      {feedback}
      <div className="cms-wizard-dialog-actions">
        {currentStep > 0 && (
          <Button
            kind="action"
            type="button"
            variant="outline"
            disabled={pending || validating}
            onClick={() => onStepChange(currentStep - 1)}
          >
            Back
          </Button>
        )}
        {currentStep < steps.length - 1 ? (
          <Button kind="action" type="submit" disabled={pending || validating}>
            Continue
          </Button>
        ) : (
          <Button kind="action" type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

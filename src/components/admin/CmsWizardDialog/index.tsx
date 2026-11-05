'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/common/Button';
import type { CmsWizardDialogProps } from './type';
import './style.css';

export function CmsWizardDialog({
  open,
  onClose,
  title,
  description,
  steps,
  activeStep,
  onStepChange,
  onNext,
  onSubmit,
  onChange,
  pending = false,
  submitLabel,
  focusFieldName,
  feedback,
}: CmsWizardDialogProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useRef<HTMLHeadingElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const previousStep = useRef(activeStep);
  const [validatingStep, setValidatingStep] = useState(false);
  const stepIndex = Math.max(0, Math.min(activeStep, steps.length - 1));
  const currentStep = steps[stepIndex];

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }

    if (open && !element.open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element.showModal();
      dialogTitle.current?.focus({ preventScroll: true });
    } else if (!open && element.open) {
      element.close();
      returnFocus.current?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open && previousStep.current !== stepIndex) {
      stepHeading.current?.focus({ preventScroll: true });
    }
    previousStep.current = stepIndex;
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open || !focusFieldName) {
      return;
    }

    const currentStepElement = dialog.current?.querySelector<HTMLElement>(
      `[data-cms-wizard-step="${stepIndex}"]`,
    );
    const field = Array.from(
      currentStepElement?.querySelectorAll<HTMLElement>('[name]') ?? [],
    ).find(
      (element) =>
        (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name ===
        focusFieldName,
    );
    field?.focus({ preventScroll: false });
  }, [focusFieldName, open, stepIndex]);

  useEffect(
    () => () => {
      if (dialog.current?.open) {
        dialog.current.close();
      }
      returnFocus.current?.focus({ preventScroll: true });
    },
    [],
  );

  async function continueToNextStep() {
    if (pending || validatingStep || stepIndex >= steps.length - 1) {
      return;
    }

    setValidatingStep(true);
    try {
      if ((await onNext?.()) !== false) {
        onStepChange(stepIndex + 1);
      }
    } finally {
      setValidatingStep(false);
    }
  }

  if (!currentStep) {
    return null;
  }

  return (
    <dialog
      ref={dialog}
      className="cms-wizard-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onClose();
        }
      }}
    >
      <form
        className="cms-wizard-dialog-form"
        onSubmit={(event) => {
          if (stepIndex < steps.length - 1) {
            event.preventDefault();
            void continueToNextStep();
            return;
          }
          onSubmit(event);
        }}
        onChange={onChange}
        noValidate
      >
        <header className="cms-wizard-dialog-header">
          <div>
            <h2 id={`${id}-title`} ref={dialogTitle} tabIndex={-1}>
              {title}
            </h2>
            {description && <p id={`${id}-description`}>{description}</p>}
          </div>
          <button
            className="cms-wizard-dialog-close"
            type="button"
            aria-label={`Close ${title} form`}
            onClick={onClose}
            disabled={pending}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="cms-wizard-progress">
          <p className="cms-wizard-step-status" role="status" aria-live="polite">
            Step {stepIndex + 1} of {steps.length}: {currentStep.label}
          </p>
          <ol aria-label="Form steps">
            {steps.map((step, index) => (
              <li
                key={`${step.label}-${index}`}
                aria-current={index === stepIndex ? 'step' : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {feedback}

        <div className="cms-wizard-step-content">
          {steps.map((step, index) => (
            <section
              key={`${step.label}-${index}`}
              data-cms-wizard-step={index}
              aria-labelledby={`${id}-step-${index}`}
              hidden={index !== stepIndex}
            >
              <h3
                id={`${id}-step-${index}`}
                ref={index === stepIndex ? stepHeading : undefined}
                tabIndex={-1}
              >
                {step.label}
              </h3>
              {step.content}
            </section>
          ))}
        </div>

        <footer className="cms-wizard-dialog-actions">
          {stepIndex > 0 && (
            <Button
              kind="action"
              type="button"
              variant="outline"
              onClick={() => onStepChange(stepIndex - 1)}
              disabled={pending || validatingStep}
            >
              Back
            </Button>
          )}
          {stepIndex < steps.length - 1 ? (
            <Button
              kind="action"
              type="button"
              className="cms-wizard-dialog-primary"
              onClick={(event) => {
                // The next render can reuse this button as a submit button before the click ends.
                event.preventDefault();
                void continueToNextStep();
              }}
              disabled={pending || validatingStep}
            >
              {validatingStep ? 'Checking…' : 'Continue'}
            </Button>
          ) : (
            <Button
              kind="action"
              type="submit"
              className="cms-wizard-dialog-primary"
              disabled={pending || validatingStep}
            >
              {submitLabel}
            </Button>
          )}
        </footer>
      </form>
    </dialog>
  );
}

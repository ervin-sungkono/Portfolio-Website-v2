'use client';

import {
  useCallback,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './style.module.css';
import type { SelectProps } from './type';

type Position = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function enabledIndex(options: SelectProps['options'], value: string) {
  const selected = options.findIndex((option) => option.value === value && !option.disabled);
  return selected >= 0 ? selected : options.findIndex((option) => !option.disabled);
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    id,
    name,
    value,
    options,
    placeholder = 'Select an option',
    disabled = false,
    className,
    onValueChange,
    onBlur,
    ...ariaProps
  },
  forwardedRef,
) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => enabledIndex(options, value));
  const [position, setPosition] = useState<Position | null>(null);
  const selected = options.find((option) => option.value === value);
  const portalTarget =
    typeof document === 'undefined'
      ? null
      : (rootRef.current?.closest('dialog[open]') ?? document.body);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const opensAbove = spaceBelow < Math.min(160, spaceAbove);
    setPosition({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(1, Math.min(256, opensAbove ? spaceAbove : spaceBelow)),
      ...(opensAbove ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        setOpen(false);
        setPosition(null);
      }
    }
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setPosition(null);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    listboxRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openAt(index = enabledIndex(options, value)) {
    setActiveIndex(index);
    updatePosition();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setPosition(null);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }
    onValueChange(option.value);
    close();
    triggerRef.current?.focus();
  }

  function moveActive(direction: 1 | -1, start = activeIndex) {
    if (!options.length) {
      return;
    }
    let index = start;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActiveIndex(index);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        const selectedIndex = options.findIndex(
          (option) => option.value === value && !option.disabled,
        );
        const initial = selectedIndex < 0 ? (direction === 1 ? -1 : 0) : selectedIndex;
        moveActive(direction, initial);
        setOpen(true);
      } else {
        moveActive(direction);
      }
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) {
        return;
      }
      event.preventDefault();
      const indexes = options
        .map((option, index) => (!option.disabled ? index : -1))
        .filter((index) => index >= 0);
      setActiveIndex(event.key === 'Home' ? (indexes[0] ?? -1) : (indexes.at(-1) ?? -1));
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openAt();
      } else {
        commit(activeIndex);
      }
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const now = Date.now();
      const withinSequence = now - typeahead.current.time <= 500;
      const repeatingCharacter =
        withinSequence && [...typeahead.current.text].every((character) => character === event.key);
      const query =
        !withinSequence || repeatingCharacter ? event.key : typeahead.current.text + event.key;
      typeahead.current = { text: query, time: now };
      const start = open ? activeIndex + 1 : enabledIndex(options, value) + 1;
      const ordered = [
        ...options.slice(Math.max(0, start)),
        ...options.slice(0, Math.max(0, start)),
      ];
      const match = ordered.find(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()),
      );
      const index = match ? options.indexOf(match) : -1;
      if (index >= 0) {
        setActiveIndex(index);
        setOpen(true);
      }
    }
  }

  const style: CSSProperties | undefined = position
    ? {
        left: position.left,
        top: position.top,
        bottom: position.bottom,
        width: position.width,
        maxHeight: position.maxHeight,
      }
    : undefined;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-activedescendant={
          open && position && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-controls={open && position ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="none"
        aria-disabled={disabled || undefined}
        aria-invalid={ariaProps['aria-invalid']}
        aria-required={ariaProps['aria-required']}
        aria-label={ariaProps['aria-label']}
        aria-labelledby={ariaProps['aria-labelledby']}
        aria-describedby={ariaProps['aria-describedby']}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        disabled={disabled}
        id={triggerId}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        onClick={() => (open ? close() : openAt())}
        onKeyDown={handleKeyDown}
        ref={(node) => {
          triggerRef.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        type="button"
        role="combobox"
      >
        <span className={!selected ? styles.placeholder : undefined}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden="true" className={styles.indicator}>
          ▾
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {open &&
        position &&
        portalTarget &&
        createPortal(
          <div
            aria-label={ariaProps['aria-label']}
            aria-labelledby={ariaProps['aria-labelledby']}
            className={styles.listbox}
            id={listboxId}
            ref={listboxRef}
            role="listbox"
            style={style}
          >
            {options.map((option, index) => (
              <div
                aria-disabled={option.disabled || undefined}
                aria-selected={option.value === value}
                className={[
                  styles.option,
                  index === activeIndex ? styles.active : '',
                  option.disabled ? styles.optionDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-option-index={index}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                onClick={() => commit(index)}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => !option.disabled && setActiveIndex(index)}
                role="option"
              >
                {option.label}
              </div>
            ))}
          </div>,
          portalTarget,
        )}
    </div>
  );
});

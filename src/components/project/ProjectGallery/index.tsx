'use client';

import Image from 'next/image';
import { useId, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';
import type { ProjectGalleryProps } from './type';

function subscribeToNothing() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ProjectGallery({ project }: ProjectGalleryProps) {
  const enhanced = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const images = [
    { src: project.image, alt: `${project.name} application interface` },
    ...(project.gallery ?? []).map((src, index) => ({
      src,
      alt: `${project.name} screenshot ${index + 2}`,
    })),
  ];

  function showSlide(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const boundedIndex = Math.min(images.length - 1, Math.max(0, index));
    viewport.scrollTo({ left: boundedIndex * viewport.clientWidth, behavior: 'auto' });
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth === 0) {
      return;
    }

    const index = Math.min(
      images.length - 1,
      Math.max(0, Math.round(viewport.scrollLeft / viewport.clientWidth)),
    );
    setActiveIndex((current) => (current === index ? current : index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = activeIndex - 1;
        break;
      case 'ArrowRight':
        nextIndex = activeIndex + 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = images.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    showSlide(nextIndex);
  }

  function renderImage(src: string, alt: string, index: number) {
    return (
      <div className={styles.mediaFrame}>
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          sizes={imageSizes.full}
          preload={index === 0}
          className={styles.mediaImage}
        />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <figure className={styles.singleImage}>{renderImage(images[0].src, images[0].alt, 0)}</figure>
    );
  }

  const galleryLabel = `${project.name} project screenshots`;
  const viewportId = `project-gallery-${id}`;
  const keyboardHintId = `project-gallery-hint-${id}`;

  return (
    <section
      className={styles.gallery}
      role="region"
      aria-label={galleryLabel}
      aria-roledescription={enhanced ? 'carousel' : undefined}
      data-enhanced={enhanced ? '' : undefined}
    >
      <div
        ref={viewportRef}
        id={viewportId}
        className={styles.viewport}
        tabIndex={enhanced ? 0 : undefined}
        aria-describedby={enhanced ? keyboardHintId : undefined}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.track}>
          {images.map(({ src, alt }, index) => (
            <figure
              key={`${src}-${index}`}
              className={styles.slide}
              role={enhanced ? 'group' : undefined}
              aria-roledescription={enhanced ? 'slide' : undefined}
              aria-label={enhanced ? `Slide ${index + 1} of ${images.length}` : undefined}
            >
              {renderImage(src, alt, index)}
            </figure>
          ))}
        </div>
      </div>

      <p id={keyboardHintId} className="sr-only" hidden={!enhanced}>
        Focus the image area and use the left and right arrow keys to browse screenshots. Home and
        End move to the first and last screenshot.
      </p>

      <div
        className={styles.controls}
        role="group"
        aria-label={`${project.name} screenshot controls`}
        hidden={!enhanced}
      >
        <button
          type="button"
          className={`icon-button ${styles.control}`}
          aria-label={`Previous screenshot for ${project.name}`}
          aria-controls={viewportId}
          onClick={() => showSlide(activeIndex - 1)}
          disabled={activeIndex === 0}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <span className={styles.position} aria-hidden="true">
          {activeIndex + 1} / {images.length}
        </span>

        <button
          type="button"
          className={`icon-button ${styles.control}`}
          aria-label={`Next screenshot for ${project.name}`}
          aria-controls={viewportId}
          onClick={() => showSlide(activeIndex + 1)}
          disabled={activeIndex === images.length - 1}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Image {activeIndex + 1} of {images.length}
        </span>
      </div>
    </section>
  );
}

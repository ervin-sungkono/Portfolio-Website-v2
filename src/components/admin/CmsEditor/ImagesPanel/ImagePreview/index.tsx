'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useCmsDraft } from '../../../CmsDraftProvider';
import type { ImagePreviewProps } from './type';

export function ImagePreview({ path, mime, url, active }: ImagePreviewProps) {
  const { readMedia } = useCmsDraft();
  const [local, setLocal] = useState<{ path: string; src: string } | null>(null);

  useEffect(() => {
    if (!active || url || !mime) {
      return;
    }
    let cancelled = false;
    void readMedia(path)
      .then((content) => {
        if (!cancelled && content) {
          setLocal({ path, src: `data:${mime};base64,${content}` });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, mime, path, readMedia, url]);

  const src = url || (local?.path === path ? local.src : undefined);
  return (
    <div className="cms-editor-image-preview" aria-hidden="true">
      {src ? <Image src={src} alt="" width={400} height={300} unoptimized /> : null}
    </div>
  );
}

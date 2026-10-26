import { FrameflowError, toFrameflowError } from '@/domain/errors';
import { traced } from '@/observability/logger';
import type { ImageHeader } from './image-header';
import { decodedSizeMatches, validateUploadBytes } from './validate';

export interface DecodedScreen {
  id: string;
  name: string;
  format: ImageHeader['format'];
  width: number;
  height: number;
  bytes: number;
  bitmap: ImageBitmap;
  /** The original, unmodified file. Saved scenes store this, never a re-encoded copy. */
  blob: Blob;
  /** Object URL for thumbnails; revoke when the screen is removed. */
  thumbnailUrl: string;
}

/**
 * Validates and decodes a screenshot entirely in the browser. Used for new
 * uploads and for screenshots restored from a saved scene, which are treated
 * as untrusted input and validated again. Nothing is sent over the network.
 */
export function decodeScreenshot(
  source: Blob,
  name: string,
  options: { id?: string; operation?: string } = {},
): Promise<DecodedScreen> {
  return traced(
    options.operation ?? 'upload.decode',
    { bytes: source.size },
    async () => {
      const bytes = new Uint8Array(await source.arrayBuffer());
      const validation = validateUploadBytes(bytes);
      if (!validation.ok) throw validation.error;
      const header = validation.value;
      const blob = new Blob([bytes], { type: `image/${header.format}` });

      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
          colorSpaceConversion: 'default',
        });
      } catch (error) {
        throw new FrameflowError(
          'IMAGE_DECODE_FAILED',
          'This image could not be decoded. It may be damaged; re-export it and try again.',
          { cause: error },
        );
      }
      if (!decodedSizeMatches(header, bitmap)) {
        bitmap.close();
        throw new FrameflowError(
          'IMAGE_DECODE_FAILED',
          'This image decoded at an unexpected size. Re-export it and try again.',
        );
      }

      return {
        id: options.id ?? `screen-${crypto.randomUUID()}`,
        name: name.slice(0, 120) || 'Screenshot',
        format: header.format,
        width: bitmap.width,
        height: bitmap.height,
        bytes: bytes.length,
        bitmap,
        blob,
        thumbnailUrl: URL.createObjectURL(blob),
      };
    },
    (error) => toFrameflowError(error).code,
  );
}

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
  /** Object URL for thumbnails; revoke when the screen is removed. */
  thumbnailUrl: string;
}

/**
 * Validates and decodes an uploaded screenshot entirely in the browser. The
 * file never leaves the device: there is no upload request in this milestone.
 */
export function decodeScreenshot(file: File): Promise<DecodedScreen> {
  return traced(
    'upload.decode',
    { bytes: file.size },
    async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validation = validateUploadBytes(bytes);
      if (!validation.ok) throw validation.error;
      const header = validation.value;

      let bitmap: ImageBitmap;
      try {
        const blob = new Blob([bytes], { type: `image/${header.format}` });
        bitmap = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
          colorSpaceConversion: 'default',
        });
      } catch (error) {
        throw new FrameflowError(
          'IMAGE_DECODE_FAILED',
          'This image could not be decoded. It may be damaged; re-export it and try again.',
          {
            cause: error,
          },
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
        id: `screen-${crypto.randomUUID()}`,
        name: file.name.slice(0, 120) || 'Screenshot',
        format: header.format,
        width: bitmap.width,
        height: bitmap.height,
        bytes: bytes.length,
        bitmap,
        thumbnailUrl: URL.createObjectURL(new Blob([bytes], { type: `image/${header.format}` })),
      };
    },
    (error) => toFrameflowError(error).code,
  );
}

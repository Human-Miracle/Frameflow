import { fail, ok, type Result } from '@/domain/errors';
import { UPLOAD_LIMITS } from '@/domain/limits';
import { readImageHeader, type ImageHeader } from './image-header';

export const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const MB = 1024 * 1024;

/**
 * Validates an upload from its bytes before decoding. The file signature,
 * not the extension or browser-reported MIME type, decides the format.
 */
export type UploadLimits = { readonly [K in keyof typeof UPLOAD_LIMITS]: number };

export function validateUploadBytes(
  bytes: Uint8Array,
  limits: UploadLimits = UPLOAD_LIMITS,
): Result<ImageHeader> {
  if (bytes.length === 0)
    return fail('INVALID_FILE', 'This file is empty. Choose a PNG, JPEG or WebP screenshot.');
  if (bytes.length > limits.maxBytes) {
    return fail(
      'FILE_TOO_LARGE',
      `This file is ${(bytes.length / MB).toFixed(1)} MB. The limit is ${limits.maxBytes / MB} MB; export a smaller screenshot and try again.`,
    );
  }

  const header = readImageHeader(bytes);
  if (header === 'unrecognised') {
    return fail(
      'INVALID_FILE',
      'This file is not a PNG, JPEG or WebP image. Other formats, including SVG, HEIC and GIF, are not supported.',
    );
  }
  if (header === 'truncated') {
    return fail('IMAGE_DECODE_FAILED', 'This image looks incomplete or damaged. Re-export it and try again.');
  }
  if (header.animated) {
    return fail('INVALID_FILE', 'Animated images are not supported. Upload a still screenshot.');
  }

  const { width, height } = header;
  if (width < limits.minSide || height < limits.minSide) {
    return fail(
      'INVALID_FILE',
      `This image is ${width}×${height} px. Screenshots must be at least ${limits.minSide} px on each side.`,
    );
  }
  if (width > limits.maxSide || height > limits.maxSide || width * height > limits.maxPixels) {
    return fail(
      'FILE_TOO_LARGE',
      `This image is ${width}×${height} px. The limit is ${limits.maxSide} px per side and ${limits.maxPixels / 1_000_000} megapixels.`,
    );
  }
  return ok(header);
}

/**
 * Decoded dimensions must match the header, allowing for JPEG EXIF rotation
 * which swaps width and height.
 */
export function decodedSizeMatches(header: ImageHeader, decoded: { width: number; height: number }): boolean {
  const same = decoded.width === header.width && decoded.height === header.height;
  const rotated =
    header.format === 'jpeg' && decoded.width === header.height && decoded.height === header.width;
  return same || rotated;
}

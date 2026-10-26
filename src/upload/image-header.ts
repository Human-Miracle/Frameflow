/**
 * Reads the format and pixel dimensions of PNG, JPEG and WebP files from
 * their headers alone. Used to reject unsupported or oversized files before
 * the browser is asked to decode them. Never trusts the filename or MIME type.
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageHeader {
  format: ImageFormat;
  width: number;
  height: number;
  animated: boolean;
}

export type HeaderProblem = 'unrecognised' | 'truncated';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const u16be = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u16le = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, o: number): number => u16le(b, o) | ((b[o + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, o: number): number => ((u16be(b, o) << 16) >>> 0) + u16be(b, o + 2);

function readPng(bytes: Uint8Array): ImageHeader | HeaderProblem {
  if (bytes.length < 33) return 'truncated';
  if (ascii(bytes, 12, 4) !== 'IHDR') return 'unrecognised';
  // An acTL chunk before IDAT marks an animated PNG; only the first frame is used.
  let animated = false;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    if (type === 'acTL') animated = true;
    if (type === 'IDAT') break;
    offset += 12 + length;
  }
  return { format: 'png', width: u32be(bytes, 16), height: u32be(bytes, 20), animated };
}

function readJpeg(bytes: Uint8Array): ImageHeader | HeaderProblem {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return 'unrecognised';
    let marker = bytes[offset + 1];
    // Skip fill bytes.
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    if (marker === undefined) return 'truncated';
    offset += 2;
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return 'truncated';
    const segmentLength = u16be(bytes, offset);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      if (offset + 7 > bytes.length) return 'truncated';
      return {
        format: 'jpeg',
        height: u16be(bytes, offset + 3),
        width: u16be(bytes, offset + 5),
        animated: false,
      };
    }
    if (marker === 0xd9 || marker === 0xda) return 'unrecognised';
    offset += segmentLength;
  }
  return 'truncated';
}

function readWebp(bytes: Uint8Array): ImageHeader | HeaderProblem {
  if (bytes.length < 30) return 'truncated';
  const chunk = ascii(bytes, 12, 4);
  const data = 20;
  if (chunk === 'VP8 ') {
    if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a)
      return 'unrecognised';
    return {
      format: 'webp',
      width: u16le(bytes, data + 6) & 0x3fff,
      height: u16le(bytes, data + 8) & 0x3fff,
      animated: false,
    };
  }
  if (chunk === 'VP8L') {
    if (bytes[data] !== 0x2f) return 'unrecognised';
    const bits =
      (bytes[data + 1] ?? 0) |
      ((bytes[data + 2] ?? 0) << 8) |
      ((bytes[data + 3] ?? 0) << 16) |
      ((bytes[data + 4] ?? 0) << 24);
    return {
      format: 'webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      animated: false,
    };
  }
  if (chunk === 'VP8X') {
    const flags = bytes[data] ?? 0;
    return {
      format: 'webp',
      width: u24le(bytes, data + 4) + 1,
      height: u24le(bytes, data + 7) + 1,
      animated: (flags & 0x02) !== 0,
    };
  }
  return 'unrecognised';
}

export function readImageHeader(bytes: Uint8Array): ImageHeader | HeaderProblem {
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return readPng(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return readJpeg(bytes);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return readWebp(bytes);
  return bytes.length < 12 ? 'truncated' : 'unrecognised';
}

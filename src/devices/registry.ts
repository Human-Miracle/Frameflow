import { FRAMEFLOW_PHONE } from './frameflow-phone';
import type { DeviceAsset } from './types';

const ASSETS: readonly DeviceAsset[] = [FRAMEFLOW_PHONE];

export const DEVICE_ASSETS: ReadonlyMap<string, DeviceAsset> = new Map(
  ASSETS.map((asset) => [asset.id, asset]),
);

export type DeviceRegistry = ReadonlyMap<string, DeviceAsset>;

export function getDeviceAsset(
  id: string,
  registry: DeviceRegistry = DEVICE_ASSETS,
): DeviceAsset | undefined {
  return registry.get(id);
}

import type { Metadata } from 'next';
import { DeviceSpike } from '@/spikes/device-3d/DeviceSpike';

export const metadata: Metadata = {
  title: 'Device rendering spike',
  robots: { index: false, follow: false },
};

export default function DeviceSpikePage() {
  return <DeviceSpike />;
}

import type { Metadata } from 'next';
import { MockupStudio } from '@/features/mockup-studio/MockupStudio';

export const metadata: Metadata = { title: 'Mockup Studio' };

export default function MockupStudioPage() {
  return <MockupStudio />;
}

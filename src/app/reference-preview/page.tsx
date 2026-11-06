import type { Metadata } from 'next';
import { ReferencePreview } from './ReferencePreview';
export const metadata: Metadata = { title: 'Local research references' };
export default function Page() {
  return <ReferencePreview />;
}

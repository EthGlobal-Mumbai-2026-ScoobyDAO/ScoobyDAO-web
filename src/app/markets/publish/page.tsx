import type { Metadata } from 'next';
import { PublishReportScreen } from '@/components/market/PublishReportScreen';

export const metadata: Metadata = { title: 'Publish report onchain' };
export const dynamic = 'force-dynamic';
export default function Page() { return <PublishReportScreen />; }

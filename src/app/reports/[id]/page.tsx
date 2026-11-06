import { Reports } from '@/components/reports/Reports';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Reports id={id} />;
}

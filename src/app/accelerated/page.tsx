import { redirect } from 'next/navigation';

/** Preserve the shared demo URL while keeping report selection in one market. */
export default function Page() {
  redirect('/markets?report=accelerated');
}

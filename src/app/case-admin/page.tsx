import { AdminSignIn } from '@/components/AdminSession';
import { AdminReviews } from '@/components/AdminReviews';
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-4xl">Case administrator</h1>
      <p className="text-muted mt-3">
        Sign in for case investigation controls and report review. This sign-in is separate from the
        review desk session. Report sign-off and publication are separate actions.
      </p>
      <AdminSignIn />
      <AdminReviews />
      <p className="text-muted mt-4 text-sm">
        Case continuation and report review require the configured, verified administrator service.
      </p>
    </main>
  );
}

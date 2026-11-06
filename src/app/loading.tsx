export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="sweep h-12 w-72" />
      <div className="sweep h-5 w-full max-w-xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="sweep h-64" />
        <div className="sweep h-64" />
      </div>
    </main>
  );
}

import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-foreground-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/dashboard" className="text-sm font-semibold text-primary underline">
        Go to the dashboard
      </Link>
    </main>
  );
}

function shouldIgnoreConsoleError(args: unknown[]) {
  const msg = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");

  if (!msg) return false;

  if (/Missing\s+or\s+insufficient\s+permissions/i.test(msg) && /FirebaseError/i.test(msg)) return true;

  if (!/net::ERR_ABORTED/i.test(msg)) return false;
  return /firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel/i.test(msg);
}

export function installConsoleFilters() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __lpConsolePatched?: boolean };
  if (w.__lpConsolePatched) return;
  w.__lpConsolePatched = true;

  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    if (shouldIgnoreConsoleError(args)) return;
    originalError(...args);
  };
}

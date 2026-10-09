import { Suspense, type ReactNode } from "react";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

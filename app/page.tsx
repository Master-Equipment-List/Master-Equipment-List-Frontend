"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (loading) return;
    router.replace(user ? "/projects" : "/login");
  }, [user, loading, router]);

  return (
    <div className="grid min-h-[60vh] place-items-center text-sm text-ink-500">
      Loading…
    </div>
  );
}

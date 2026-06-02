import type { Metadata } from "next";
import "./globals.css";

import { TopNav } from "@/components/TopNav";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "MEL Studio — Master Equipment List",
  description:
    "Manage Topside / Marine Master Equipment Lists for offshore FPSO projects."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-50 text-ink-900">
        <AuthProvider>
          <TopNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

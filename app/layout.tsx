import type { Metadata } from "next";
import "./globals.css";

import { TopNav } from "@/components/TopNav";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  // Browser-tab title — matches the in-app brand row (logo + "MEL").
  title: "MEL — Shapoorji Pallonji OIL & GAS",
  description:
    "Manage Topside / Marine Master Equipment Lists for offshore FPSO projects.",
  // Favicon / OG image — Next.js auto-serves any file at this public
  // path. Pointing at the SP-Oil-Gas logo keeps the browser tab icon
  // consistent with the in-app branding.
  icons: {
    icon: "/images/SP-Oil-Gas.png",
  },
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

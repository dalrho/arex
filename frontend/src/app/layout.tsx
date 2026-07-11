import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AREX — FDA 21 CFR Part 11 Compliance Platform",
  description: "AI-powered regulatory intelligence, document remediation, and compliance workflow tracking.",
  icons: {
    icon: "/brand/arex-logo-square.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-slate-50 text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}

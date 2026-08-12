import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAG CRM",
  description: "The Abadi Group — CRM & proposals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Raze AgroDash — Municipal Agriculture Dashboard",
  description: "Municipal Agriculture Office, Tubo, Abra · Region CAR – Production Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Raze AgroDash — Agricultural Production Monitoring",
  description: "Municipal Agriculture Production Monitoring System for LGU Tubo, Abra — Region CAR",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Raze AgroDash",
    description: "Agricultural Production Monitoring System — LGU Tubo, Abra",
    type: "website",
    url: "https://razeapp.site",
  },
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

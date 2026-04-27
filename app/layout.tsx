import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

/** Canonical origin for metadata / Open Graph. Local dev defaults here; production sets NEXT_PUBLIC_SITE_URL. */
function publicSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
  return raw.replace(/\/+$/, "") || "http://localhost:3000";
}

const site = publicSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Raze AgroDash — Agricultural Production Monitoring",
  description: "Municipal Agriculture Production Monitoring System for LGU Tubo, Abra — Region CAR",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Raze AgroDash",
    description: "Agricultural Production Monitoring System — LGU Tubo, Abra",
    type: "website",
    url: site,
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

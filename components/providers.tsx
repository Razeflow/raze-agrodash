"use client";
import { AuthProvider } from "@/lib/auth-context";
import { AgriDataProvider } from "@/lib/agri-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AgriDataProvider>{children}</AgriDataProvider>
    </AuthProvider>
  );
}

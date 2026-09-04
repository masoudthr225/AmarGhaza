import type { Metadata } from "next";
// فونت وزیرمتن به‌صورت محلی (بدون نیاز به اینترنت/گوگل‌فونت)
import "vazirmatn/Vazirmatn-Variable-font-face.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "سیستم ثبت ری‌گیری طلا",
  description: "سیستم جامع ثبت و پیگیری نمونه‌های ری‌گیری طلا - مدیریت وزن، عیار و وضعیت نمونه‌ها",
  keywords: ["ری‌گیری", "طلا", "عیار", "وزن", "ثبت", "النگو", "ریخته‌ای"],
  authors: [{ name: "Rey Giri System" }],
  openGraph: {
    title: "سیستم ثبت ری‌گیری طلا",
    description: "مدیریت و پیگیری نمونه‌های ری‌گیری طلا",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

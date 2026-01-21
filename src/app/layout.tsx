import type { Metadata } from "next";
import { Spline_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-spline",
});

export const metadata: Metadata = {
  title: "MAPLE | AI 素养评估",
  description: "基于 DeepSeek R1 的 AI 素养评估系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${splineSans.variable} font-sans bg-background-dark text-white h-screen w-full overflow-hidden flex flex-col md:flex-row antialiased selection:bg-primary selection:text-background-dark`}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-surface-border bg-background-dark">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">eco</span>
            <span className="font-bold text-lg">MAPLE</span>
          </div>
          <button className="text-white">
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        </div>

        <Sidebar />
        
        <main className="flex-1 flex flex-col h-full relative min-w-0">
          {children}
        </main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Spline_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Menu } from "lucide-react";

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
      <body
        className={`${splineSans.variable} font-sans bg-[#1c1917] text-white h-screen w-full overflow-hidden flex flex-col md:flex-row antialiased selection:bg-[#ffe066] selection:text-[#1c1917]`}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[#44403c] bg-[#1c1917]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffe066]">eco</span>
            <span className="font-bold text-lg">MAPLE</span>
          </div>
          <button className="text-white">
            <Menu size={24} />
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

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const halvar = localFont({
  src: "../../public/fonts/HalvarBreit-Bd.woff2",
  variable: "--font-halvar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "7CARS CRM",
  description: "Web CRM for car import, sales, and resale operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${halvar.variable} antialiased`}>{children}</body>
    </html>
  );
}

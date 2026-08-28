import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

import Providers from "./providers";

export const metadata: Metadata = {
  title: "GETDelivery | Enterprise Delivery & Inventory Management",
  description: "A secure, multi-tenant platform for seamless inventory handling and delivery dispatching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

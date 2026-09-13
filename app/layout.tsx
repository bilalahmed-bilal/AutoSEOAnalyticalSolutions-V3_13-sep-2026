import type { Metadata } from "next";
import { productBrand } from "@/lib/product/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${productBrand.productName} — ${productBrand.tagline}`,
  description: productBrand.description,
  icons: { icon: productBrand.favicon },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={productBrand.defaultLanguage} dir="ltr">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}

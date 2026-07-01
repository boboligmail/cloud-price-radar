import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cloud-price-radar.example.com"),
  title: {
    default: "云服务器与 GPU 租赁价格筛选器",
    template: "%s | cloud-price-radar",
  },
  description: "按配置、地区、计费方式和风险快速找到可核验的低价 VPS 与 GPU 租赁方案。",
  applicationName: "cloud-price-radar",
  openGraph: {
    title: "云服务器与 GPU 租赁价格筛选器",
    description: "按配置、地区、计费方式和风险快速找到可核验的低价方案。",
    siteName: "cloud-price-radar",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

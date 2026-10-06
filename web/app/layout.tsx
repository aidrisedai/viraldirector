import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Outfit } from "next/font/google";
import "./globals.css";

const baskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-baskerville",
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

const description = "Tell us your idea; we’ll direct you shot by shot, then hand you a platform-ready video.";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "ViralDirector", template: "%s · ViralDirector" },
  description,
  applicationName: "ViralDirector",
  openGraph: { title: "ViralDirector", description, type: "website", siteName: "ViralDirector" },
  twitter: { card: "summary", title: "ViralDirector", description },
  // Added to a phone's home screen, it opens full screen like an app.
  appleWebApp: { capable: true, title: "ViralDirector", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F4EEE3",
  width: "device-width",
  initialScale: 1,
  // Lets full-screen views (camera, editor) reach the edges; they pad for the notch and home bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baskerville.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}

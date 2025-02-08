import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Historikal Data SNBT",
  description: "Situs pencarian data historikal SNBT SNPMB Indonesia",
  authors: [{
    name: 'Aziz Ridhwan Pratama',
    url: 'https://github.com/ziprawan',
  }, {
    name: 'Hanif Dwy Putra S',
    url: 'https://github.com/hansputera',
  }],
  creator: 'Aziz Ridhwan Pratama (github.com/ziprawan) | Hanif Dwy Putra S (github.com/hansputera)',
  keywords: ['snbt', 'snpmb', 'pengumuman snbt', 'snbt 2024', 'cari snbt', 'pengumuman', 'snbp', 'snpmb snbt', 'portal snbt'],
  category: 'education',
  icons: {
    icon: '/snpmb-logo.png',
    apple: [{
      sizes: '180x180',
      url: '/images/apple-icon-180x180.png',
    }, {
      sizes: '152x152',
      url: '/images/apple-icon-152x152.png',
    }, {
      sizes: '144x144',
      url: '/images/apple-icon-144x144.png',
    }, {
      sizes: '120x120',
      url: '/images/apple-icon-120x120.png',
    }, {
      sizes: '114x114',
      url: '/images/apple-icon-114x114.png',
    }, {
      sizes: '76x76',
      url: '/images/apple-icon-76x76.png',
    }, {
      sizes: '60x60',
      url: '/images/apple-icon-60x60.png',
    }, {
      sizes: '57x57',
      url: '/images/apple-icon-57x57.png',
    }],
  },
  applicationName: 'SNBT Historic',
  openGraph: {
    title: 'SNBT Historic',
    description: 'Situs pencarian data historikal SNBT SNPMB Indonesia',
    emails: ['azizpratama@gnuweeb.org', 'hanifdwyputrasembiring@gmail.com'],
    countryName: 'Indonesia',
    type: 'website',
    siteName: 'SNBT Historic',
    locale: 'id-ID',
    determiner: 'auto',
    alternateLocale: 'en-US',
  },
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.className} font-poppins antialiased flex flex-col min-h-screen bg-[#FEFEFE]`}>
        <main className="flex-1">{children}</main>
        <div className="text-center bottom-0 text-gray-400 p-4">
          Situs ini tidak berafiliasi secara resmi dengan Pihak SNPMB.<br />
          Made with ❤️ by <Link href={'https://github.com/ziprawan'}>Aziz Ridhwan</Link> and <Link href={'https://github.com/hansputera'}>hansputera</Link>
        </div>
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "CricXii Admin | Player management",
  description: "A secure, responsive workspace for CricXii player support and administration.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

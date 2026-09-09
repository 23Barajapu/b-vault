import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'B-Vault Ops Desk: Fulfillment Console (Private)',
  description: 'Operations fulfillment & store management desk for B-Vault.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {children}
    </div>
  );
}

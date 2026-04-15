import { Metadata } from 'next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import './styles/animations.css';

export const metadata: Metadata = {
  title: 'Leaderboard | Balencia',
  description: 'Compete with the community and track your fitness progress on the leaderboard',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}


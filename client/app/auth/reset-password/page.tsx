import { SEO } from '@/lib/seo';
import ResetPasswordPageContent from './ResetPasswordPageContent';

export const metadata = SEO.resetPassword;

export default function ResetPasswordPage() {
  return <ResetPasswordPageContent />;
}

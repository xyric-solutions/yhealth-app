import { SEO } from '@/lib/seo';
import ForgotPasswordPageContent from './ForgotPasswordPageContent';

export const metadata = SEO.forgotPassword;

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />;
}

import { SEO } from '@/lib/seo';
import SignUpPageContent from './SignupPageContent';

export const metadata = SEO.signUp;

export default function SignUpPage() {
  return <SignUpPageContent />;
}

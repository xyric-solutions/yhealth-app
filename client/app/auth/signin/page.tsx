import { SEO } from '@/lib/seo';
import SignInPageContent from './SignInPageContent';

export const metadata = SEO.signIn;

export default function SignInPage() {
  return <SignInPageContent />;
}

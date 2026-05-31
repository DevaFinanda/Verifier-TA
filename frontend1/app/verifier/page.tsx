import { redirect } from 'next/navigation';

// /verifier sekarang redirect ke /dashboard
export default function VerifierPage() {
  redirect('/dashboard');
}

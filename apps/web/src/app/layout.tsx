import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Intake · Clinician workspace', description: 'Review patient intake, symptoms and longitudinal notes.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

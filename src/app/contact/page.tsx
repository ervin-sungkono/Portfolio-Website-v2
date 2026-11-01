import { ContactIntro } from '@/components/contact/ContactIntro';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { getPortfolio } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const { profile } = await getPortfolio();
  return pageMetadata({
    title: 'Contact — Software Engineering Opportunities',
    description: `Contact ${profile.name} about software engineering opportunities, React and Next.js projects, frontend development, or interface design collaborations.`,
    path: '/contact',
  });
}

export default function ContactPage() {
  return (
    <div className="container">
      <ContactIntro />
      <ContactDetails />
    </div>
  );
}

import { getDesigns, getPortfolio, type Design } from '@/lib/content';
import { DesignIntro } from '@/components/design/DesignIntro';
import { DesignCollection } from '@/components/design/DesignCollection';
import { pageMetadata } from '@/lib/metadata';

export const instant = false;

export async function generateMetadata() {
  const { profile } = await getPortfolio();
  return pageMetadata({
    title: 'Interface Design',
    description: `Browse selected interface design work by ${profile.name}.`,
    path: '/design',
  });
}

export default async function DesignPage() {
  let designs: readonly Design[] = [];
  let unavailable = false;
  try {
    designs = await getDesigns();
  } catch {
    designs = [];
    unavailable = true;
  }
  return (
    <div className="container">
      <DesignIntro />
      <DesignCollection designs={designs} unavailable={unavailable} />
    </div>
  );
}

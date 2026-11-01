import { getPortfolio } from '@/lib/content';
import { DesignIntro } from '@/components/design/DesignIntro';
import { DesignCollection } from '@/components/design/DesignCollection';
import { pageMetadata } from '@/lib/metadata';

export const instant = false;

export async function generateMetadata() {
  const { profile } = await getPortfolio();
  return pageMetadata({
    title: 'Web & Mobile Interface Design',
    description: `Browse web and mobile interface designs by ${profile.name}, including dashboards, healthcare websites, and application UI explorations.`,
    path: '/design',
  });
}

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category }, { designs }] = await Promise.all([searchParams, getPortfolio()]);
  const activeCategory = typeof category === 'string' ? category : '';
  const filtered = designs.filter(
    (design) => !activeCategory || design.category === activeCategory,
  );
  const categories = [...new Set(designs.map((design) => design.category))];

  return (
    <div className="container">
      <DesignIntro />
      <DesignCollection
        activeCategory={activeCategory}
        categories={categories}
        filtered={filtered}
      />
    </div>
  );
}

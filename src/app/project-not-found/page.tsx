import NotFound from '../not-found';

export const metadata = { title: 'Project Not Found', robots: { index: false, follow: false } };

export default function ProjectNotFoundPage() {
  return <NotFound />;
}

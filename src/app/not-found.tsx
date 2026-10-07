import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container empty-state">
      <p className="meta">404</p>
      <h1>This Page Isn’t Here.</h1>
      <p>Explore the projects or return to the homepage.</p>
      <Link href="/" className="button">
        Back to Home
      </Link>
    </div>
  );
}

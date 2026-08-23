import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-page">
      <p className="eyebrow">Page not found</p>
      <h1>Let&apos;s get your basket back on track.</h1>
      <p>The page you requested is not part of the SmartCart planner.</p>
      <Link className="button button--primary" href="/basket">Return to basket</Link>
    </section>
  );
}

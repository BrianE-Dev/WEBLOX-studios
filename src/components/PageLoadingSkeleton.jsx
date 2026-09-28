export default function PageLoadingSkeleton({ label = 'Loading page' }) {
  return <main className="screen-loading-skeleton" role="status" aria-label={label}>
    <div className="page-loading-skeleton" aria-hidden="true">
      <span className="page-loading-kicker" />
      <span className="page-loading-title" />
      <span className="page-loading-copy" />
      <span className="page-loading-copy short" />
      <div className="page-loading-grid"><span /><span /><span /></div>
    </div>
  </main>
}

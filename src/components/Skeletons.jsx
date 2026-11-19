export function LinkSkeleton() {
  return (
    <div className="link-item link-skeleton">
      <div className="skel skel-favicon" />
      <div className="link-info">
        <div className="skel skel-url" />
        <div className="skel skel-desc" />
      </div>
    </div>
  );
}

export function BoxSkeleton() {
  return (
    <article className="box box-skeleton">
      <header className="box-header">
        <div className="skel skel-box-name" />
        <div className="skel skel-count" />
      </header>
      <div className="add-link-form">
        <div className="skel skel-input" />
        <div className="skel skel-input" />
      </div>
      <div className="links-list">
        <LinkSkeleton />
        <LinkSkeleton />
        <LinkSkeleton />
      </div>
    </article>
  );
}

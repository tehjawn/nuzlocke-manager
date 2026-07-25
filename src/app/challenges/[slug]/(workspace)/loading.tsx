export default function SeasonWorkspaceLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-40 rounded-xl bg-frame/15" />
      <div className="h-4 w-2/3 max-w-md rounded-xl bg-frame/10" />
      <div className="space-y-3 pt-2">
        <div className="h-36 rounded-xl border border-frame/20 bg-surface" />
        <div className="h-36 rounded-xl border border-frame/20 bg-surface" />
        <div className="h-36 rounded-xl border border-frame/20 bg-surface" />
      </div>
    </div>
  );
}

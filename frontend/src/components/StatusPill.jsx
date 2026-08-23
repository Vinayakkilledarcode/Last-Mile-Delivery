export default function StatusPill({ status }) {
  const cls = `status-pill status-${status.replace(/\s+/g, '')}`;
  return <span className={cls}>{status}</span>;
}

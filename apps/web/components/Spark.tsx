export function Spark({ dir = 'up' }: { dir?: 'up' | 'down' }) {
  const d = dir === 'up'
    ? 'M2 18 L8 12 L14 14 L20 6'
    : 'M2 6 L8 12 L14 10 L20 18';
  return (
    <svg width="80" height="24" viewBox="0 0 22 20" fill="none" aria-hidden>
      <path d={d} stroke="#556B4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

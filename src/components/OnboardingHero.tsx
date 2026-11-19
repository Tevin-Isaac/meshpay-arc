/** The first-screen artwork: a USDC coin travelling from "You" to "Anyone" over a faint mesh. */
const ARC = 'M58 124 Q160 36 262 124'

export function OnboardingHero() {
  return (
    <div className="ob-hero">
      <svg viewBox="0 0 320 210" role="img" aria-label="A coin travelling from you to anyone">
        <defs>
          <radialGradient id="ob-recv" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--ob-accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--ob-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[
          [28, 54],
          [292, 48],
          [160, 188],
          [40, 168],
          [276, 150],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 2.6} fill="var(--ob-accent)" opacity="0.3" />
        ))}
        <path d={ARC} fill="none" stroke="var(--ob-line)" strokeWidth="1.5" strokeDasharray="5 6" opacity="0.6" />
        <path d={ARC} fill="none" stroke="var(--ob-accent)" strokeWidth="2" opacity="0.45" />
        <circle cx="262" cy="124" r="40" fill="url(#ob-recv)" opacity="0.5" />
        <circle cx="58" cy="124" r="27" fill="var(--ob-node)" stroke="var(--ob-accent)" strokeWidth="1.5" />
        <rect x="49.5" y="111" width="17" height="26" rx="3.5" fill="none" stroke="var(--ob-accent)" strokeWidth="1.6" />
        <circle cx="58" cy="132" r="1.8" fill="var(--ob-accent)" />
        <circle cx="160" cy="80" r="16" fill="var(--ob-node)" stroke="var(--ob-accent)" strokeWidth="1.3" strokeOpacity="0.75" />
        <circle cx="160" cy="80" r="3" fill="var(--ob-accent)" fillOpacity="0.85" />
        <circle cx="262" cy="124" r="27" fill="var(--ob-node)" stroke="var(--ob-accent)" strokeWidth="1.5" />
        <rect x="253.5" y="111" width="17" height="26" rx="3.5" fill="none" stroke="var(--ob-accent)" strokeWidth="1.6" />
        <circle cx="262" cy="132" r="1.8" fill="var(--ob-accent)" />
        <text x="58" y="172" textAnchor="middle" fill="var(--ob-label)" fontSize="11">You</text>
        <text x="262" y="172" textAnchor="middle" fill="var(--ob-label)" fontSize="11">Anyone</text>
      </svg>
      <span className="ob-coin" aria-hidden="true">$</span>
    </div>
  )
}

export function OnboardingMesh() {
  const pts = [[8, 14], [30, 6], [55, 20], [80, 8], [92, 26], [18, 44], [45, 52], [72, 46], [90, 62], [10, 78], [35, 88], [62, 80], [85, 92]]
  return (
    <svg className="ob-mesh" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {pts.map((p, i) => i > 0 && <line key={i} x1={pts[i - 1][0]} y1={pts[i - 1][1]} x2={p[0]} y2={p[1]} stroke="var(--ob-line)" strokeWidth="0.15" />)}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="0.5" fill="var(--ob-accent)" opacity="0.4" />)}
    </svg>
  )
}

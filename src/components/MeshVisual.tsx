/**
 * Decorative diagram: two phones hand a signed payment across a gap, a third
 * phone with a connection carries it up to Arc. Purely illustrative, no data.
 */
export function MeshVisual() {
  return (
    <svg viewBox="0 0 520 360" className="h-auto w-full" role="img" aria-label="Diagram: a signed payment passes phone to phone, then reaches Arc through the first phone with a connection">
      <defs>
        <linearGradient id="mv-line" x1="0" x2="1">
          <stop offset="0" stopColor="#85b1ed" />
          <stop offset="1" stopColor="#122d45" />
        </linearGradient>
        <radialGradient id="mv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#85b1ed" stopOpacity="0.45" />
          <stop offset="1" stopColor="#85b1ed" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="400" cy="70" r="90" fill="url(#mv-glow)" />

      {/* links */}
      <g fill="none" stroke="url(#mv-line)" strokeWidth="2" strokeLinecap="round">
        <path d="M110 270 C 190 270, 190 250, 250 240" className="mv-flow" />
        <path d="M250 240 C 310 200, 330 150, 380 100" className="mv-flow mv-delay" />
        <path d="M250 240 C 300 290, 360 300, 410 275" strokeDasharray="2 8" opacity="0.5" />
      </g>

      {/* phones */}
      {[
        { x: 70, y: 220, label: 'Alice', note: 'signs offline' },
        { x: 215, y: 190, label: 'Bob', note: 'holds the payment' },
        { x: 380, y: 232, label: 'Carol', note: 'no signal yet' },
      ].map((p) => (
        <g key={p.label} transform={`translate(${p.x} ${p.y})`}>
          <rect width="64" height="104" rx="14" fill="white" stroke="#122d45" strokeOpacity="0.18" />
          <rect x="24" y="8" width="16" height="3" rx="1.5" fill="#122d45" fillOpacity="0.15" />
          <rect x="10" y="26" width="44" height="44" rx="8" fill="#f5f5f8" />
          <g fill="#122d45">
            <rect x="16" y="32" width="8" height="8" rx="1.5" />
            <rect x="30" y="32" width="8" height="8" rx="1.5" opacity="0.7" />
            <rect x="16" y="46" width="8" height="8" rx="1.5" opacity="0.7" />
            <rect x="30" y="46" width="8" height="8" rx="1.5" />
            <rect x="42" y="58" width="6" height="6" rx="1" opacity="0.5" />
          </g>
          <rect x="10" y="78" width="44" height="14" rx="7" fill="#122d45" fillOpacity={p.label === 'Carol' ? 0.12 : 1} />
          <text x="32" y="123" textAnchor="middle" fontSize="12" fontWeight="700" fill="#122d45" fontFamily="DM Sans, sans-serif">
            {p.label}
          </text>
          <text x="32" y="138" textAnchor="middle" fontSize="9.5" fill="#6b6580" fontFamily="DM Sans, sans-serif">
            {p.note}
          </text>
        </g>
      ))}

      {/* Arc node */}
      <g transform="translate(380 40)">
        <circle cx="30" cy="30" r="30" fill="#122d45" />
        <path d="M14 38a20 20 0 0 1 32 0" stroke="#acc6e9" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M22 43a10 10 0 0 1 16 0" stroke="#acc6e9" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="48" r="3" fill="#acc6e9" />
        <text x="30" y="82" textAnchor="middle" fontSize="12" fontWeight="700" fill="#122d45" fontFamily="DM Sans, sans-serif">
          Arc
        </text>
      </g>
    </svg>
  )
}

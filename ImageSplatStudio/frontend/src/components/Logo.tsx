interface LogoProps {
  size?: number;
}

export function Logo({ size = 40 }: LogoProps) {
  const id = "luma-grad";
  return (
    <svg
      className="app-logo"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="45%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="24" cy="24" r="20" fill={`url(#${id})`} filter="url(#glow)" opacity="0.95" />
      <ellipse cx="18" cy="16" rx="6" ry="4" fill="white" opacity="0.35" />
      <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    </svg>
  );
}

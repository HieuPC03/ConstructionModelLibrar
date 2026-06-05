interface LogoProps {
  size?: number;
}

export function Logo({ size = 40 }: LogoProps) {
  return (
    <img
      className="app-logo"
      src="/icon.png"
      width={size}
      height={size}
      alt="ImageSplat Studio"
      draggable={false}
    />
  );
}

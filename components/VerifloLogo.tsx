interface VerifloLogoProps {
  className?: string;
  size?: number;
}

const VerifloLogo = ({ className = "", size = 40 }: VerifloLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Stylized V - two parallel blue strokes with white gap (thick blue stroke, thinner white on top reveals double-line) */}
    <path
      d="M8 6 L20 34 L32 6"
      stroke="#1e3a5f"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M8 6 L20 34 L32 6"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      style={{ color: "white" }}
    />
  </svg>
);

export default VerifloLogo;

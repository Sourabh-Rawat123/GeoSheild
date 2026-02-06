import { NavLink } from "react-router-dom";

const Logo = ({ compact = false }) => {
  return (
    <NavLink
      to="/"
      className="inline-flex hover:opacity-90 transition"
    >
      <div className="flex items-center gap-3 select-none">
        
        {/* === SHIELD + EARTH SVG === */}
        <svg
          width={compact ? 32 : 36}
          height={compact ? 32 : 36}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          {/* Shield outline */}
          <path
            d="M32 2L54 10V30C54 44 44 56 32 62C20 56 10 44 10 30V10L32 2Z"
            stroke="#38BDF8"
            strokeWidth="2.5"
            fill="rgba(56,189,248,0.08)"
          />

          {/* Earth circle */}
          <circle
            cx="32"
            cy="30"
            r="12"
            fill="#0EA5E9"
            opacity="0.9"
          />

          {/* Earth meridians */}
          <path
            d="M20 30H44"
            stroke="white"
            strokeOpacity="0.7"
            strokeWidth="1.2"
          />
          <path
            d="M32 18V42"
            stroke="white"
            strokeOpacity="0.5"
            strokeWidth="1.2"
          />

          {/* Curved latitude */}
          <path
            d="M22 26C26 24 38 24 42 26"
            stroke="white"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <path
            d="M22 34C26 36 38 36 42 34"
            stroke="white"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
        </svg>

        {/* === TEXT === */}
        {!compact && (
          <span className="text-xl font-semibold tracking-wide text-white">
            GeoShield <span className="text-sky-400">AI</span>
          </span>
        )}
      </div>
    </NavLink>
  );
};

export default Logo;

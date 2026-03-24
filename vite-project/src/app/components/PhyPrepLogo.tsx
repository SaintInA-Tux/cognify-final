// React is auto-imported by the JSX transform

export function PhyPrepLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background pulsing glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#3B82F6] to-[#9333EA] rounded-full blur-[10px] opacity-40 animate-pulse"></div>
      
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-md">
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />   {/* Blue */}
            <stop offset="50%" stopColor="#7C3AED" />  {/* Purple */}
            <stop offset="100%" stopColor="#D946EF" /> {/* Pink/Fuchsia Glow */}
          </linearGradient>
        </defs>

        <g stroke="url(#logo-gradient)" strokeLinecap="round" strokeLinejoin="round">
          {/* Left Brain Hemisphere */}
          <path d="M24 8 C12 8 6 15 6 24 C6 30.5 10 35.5 13 37.5 L13 41 C13 42.1 13.9 43 15 43 L22 43" strokeWidth="2.5" />
          
          {/* Right Brain Hemisphere */}
          <path d="M24 8 C36 8 42 15 42 24 C42 30.5 38 35.5 35 37.5 L35 41 C35 42.1 34.1 43 33 43 L26 43" strokeWidth="2.5" />

          {/* Brain Stem / Central AI Bus */}
          <path d="M24 12 V40" strokeWidth="2.5" strokeDasharray="5 5" opacity="0.85" />

          {/* Circuit Branch 1 - Top Left */}
          <path d="M24 16 L17 16 L12 21" strokeWidth="2" />
          <circle cx="12" cy="21" r="1.5" fill="url(#logo-gradient)" stroke="none" />

          {/* Circuit Branch 2 - Mid Left */}
          <path d="M19 25 L14 25 L10 29" strokeWidth="2" />
          <circle cx="10" cy="29" r="1.5" fill="url(#logo-gradient)" stroke="none" />

          {/* Circuit Branch 3 - Bot Left */}
          <path d="M24 33 L18 33 L16 37" strokeWidth="2" />
          <circle cx="16" cy="37" r="1.5" fill="url(#logo-gradient)" stroke="none" />

          {/* Circuit Branch 4 - Top Right */}
          <path d="M24 16 L31 16 L36 21" strokeWidth="2" />
          <circle cx="36" cy="21" r="1.5" fill="url(#logo-gradient)" stroke="none" />

          {/* Circuit Branch 5 - Mid Right */}
          <path d="M29 25 L34 25 L38 29" strokeWidth="2" />
          <circle cx="38" cy="29" r="1.5" fill="url(#logo-gradient)" stroke="none" />

          {/* Circuit Branch 6 - Bot Right */}
          <path d="M24 33 L30 33 L32 37" strokeWidth="2" />
          <circle cx="32" cy="37" r="1.5" fill="url(#logo-gradient)" stroke="none" />
        </g>

        {/* Central Processing Core */}
        <circle cx="24" cy="25" r="4" fill="url(#logo-gradient)" />
        <circle cx="24" cy="25" r="1.5" fill="#FFFFFF" />

        {/* Node Highlights */}
        <circle cx="24" cy="8" r="2" fill="#FFFFFF" />
        <circle cx="24" cy="43" r="2" fill="#FFFFFF" />
        <circle cx="15" cy="43" r="1.5" fill="url(#logo-gradient)" />
        <circle cx="33" cy="43" r="1.5" fill="url(#logo-gradient)" />
      </svg>
    </div>
  );
}

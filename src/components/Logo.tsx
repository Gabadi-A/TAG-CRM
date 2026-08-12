export default function Logo() {
  return (
    <div className="logo">
      <svg className="mark" viewBox="0 0 48 48" fill="none" aria-label="TAG">
        <rect x="2" y="2" width="44" height="44" rx="10" fill="#9e5023" />
        <g stroke="#f4efe6" strokeWidth="1.7" strokeLinecap="round">
          <line x1="27" y1="24" x2="39" y2="24" />
          <line x1="26.1" y1="26.1" x2="34.6" y2="34.6" />
          <line x1="24" y1="27" x2="24" y2="39" />
          <line x1="21.9" y1="26.1" x2="13.4" y2="34.6" />
          <line x1="21" y1="24" x2="9" y2="24" />
          <line x1="21.9" y1="21.9" x2="13.4" y2="13.4" />
          <line x1="24" y1="21" x2="24" y2="9" />
          <line x1="26.1" y1="21.9" x2="34.6" y2="13.4" />
        </g>
      </svg>
      <div>
        <div className="word">TAG</div>
        <div className="sub">THE ABADI GROUP</div>
      </div>
    </div>
  );
}

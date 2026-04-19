// Monoline icon set — hand-drawn feel, consistent 1.75px stroke.
// Each icon takes size + color props. Round linecaps to match the friendly-rounded tone.

function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.75 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    // Subject glyphs
    case 'pen':
      return (
        <svg {...common}>
          <path d="M4 20 L8 19 L19 8 L16 5 L5 16 Z" />
          <path d="M14 7 L17 10" />
          <path d="M4 20 L7 20" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8.5 V15.5 M8.5 12 H15.5" />
        </svg>
      );
    case 'brain':
      return (
        <svg {...common}>
          <path d="M9 6.5 C7 6.5 5.5 8 5.5 10 C5 11 5 12 6 13 C5 14 5.5 16 7.5 16.5 C8 18 10 18.5 11 17.5 L11 6.5 C10.5 6 9.8 6.5 9 6.5 Z" />
          <path d="M15 6.5 C17 6.5 18.5 8 18.5 10 C19 11 19 12 18 13 C19 14 18.5 16 16.5 16.5 C16 18 14 18.5 13 17.5 L13 6.5 C13.5 6 14.2 6.5 15 6.5 Z" />
          <path d="M8.5 10.5 H10 M14 10.5 H15.5 M8.5 13.5 H10 M14 13.5 H15.5" />
        </svg>
      );
    case 'speech':
      return (
        <svg {...common}>
          <path d="M4.5 6.5 H19.5 V15 H13 L9 18.5 V15 H4.5 Z" />
          <path d="M8 10 H16 M8 12.5 H13" />
        </svg>
      );
    case 'quote':
      return (
        <svg {...common}>
          <path d="M6 9 C6 7.5 7 6.5 8.5 6.5 M6 9 L6 12 L9 12 L9 9 Z" />
          <path d="M14 9 C14 7.5 15 6.5 16.5 6.5 M14 9 L14 12 L17 12 L17 9 Z" />
          <path d="M8 16 L8.5 17.5 M15 16 L15.5 17.5" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5.5 C6.5 5 9.5 5.5 12 7 C14.5 5.5 17.5 5 20 5.5 V18 C17.5 17.5 14.5 18 12 19 C9.5 18 6.5 17.5 4 18 Z" />
          <path d="M12 7 V19" />
        </svg>
      );

    // UI icons
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 11 L12 4.5 L20 11 V19 H14 V14 H10 V19 H4 Z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19 H20" />
          <path d="M7 15 V11 M11 15 V7 M15 15 V13 M19 15 V9" />
        </svg>
      );
    case 'people':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19 C4 15.5 6.5 14 9 14 C11.5 14 14 15.5 14.5 19" />
          <circle cx="17" cy="8" r="2.3" />
          <path d="M14.5 13 C16 12.5 17 12.5 18.5 13 C20 13.5 21 15 21 17" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4 V6 M12 18 V20 M4 12 H6 M18 12 H20 M6.3 6.3 L7.7 7.7 M16.3 16.3 L17.7 17.7 M6.3 17.7 L7.7 16.3 M16.3 7.7 L17.7 6.3" />
        </svg>
      );
    case 'method':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9.5 C9.5 8.2 10.5 7.5 12 7.5 C13.5 7.5 14.5 8.3 14.5 9.5 C14.5 11 12 11.2 12 13" />
          <circle cx="12" cy="16" r="0.5" fill={color}/>
        </svg>
      );
    case 'play':
      return (
        <svg {...common}>
          <path d="M8 6 L17 12 L8 18 Z" fill={color} />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common}>
          <rect x="7" y="6" width="3.5" height="12" rx="1" fill={color} />
          <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill={color} />
        </svg>
      );
    case 'next':
      return (
        <svg {...common}>
          <path d="M9 6 L15 12 L9 18" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <path d="M15 6 L9 12 L15 18" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12.5 L10 17.5 L19 7" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 4 L13.5 10.5 L20 12 L13.5 13.5 L12 20 L10.5 13.5 L4 12 L10.5 10.5 Z" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 3.5 C12 6 9 7 9 10.5 C9 12 10 13 11 13 C10 11 12 10 12 8 C13.5 10 15 11.5 15 14 C15 16.5 13.5 18.5 12 18.5 C9.5 18.5 7.5 16.5 7.5 14 C7.5 10 12 8 12 3.5 Z" />
        </svg>
      );
    case 'volume':
      return (
        <svg {...common}>
          <path d="M4 10 V14 H7 L11 17 V7 L7 10 Z" />
          <path d="M14 9 C15.5 10.5 15.5 13.5 14 15" />
          <path d="M16.5 7 C19 9.5 19 14.5 16.5 17" />
        </svg>
      );
    case 'hint':
      return (
        <svg {...common}>
          <path d="M12 4 C8.5 4 6.5 6.5 6.5 9.5 C6.5 11.5 7.5 12.5 8.5 14 V16 H15.5 V14 C16.5 12.5 17.5 11.5 17.5 9.5 C17.5 6.5 15.5 4 12 4 Z" />
          <path d="M9.5 19 H14.5 M10.5 21 H13.5" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1.2" fill={color}/>
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5 V12 L15 14" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
        </svg>
      );
    case 'tweak':
      return (
        <svg {...common}>
          <path d="M4 8 H14 M4 16 H10" />
          <circle cx="17" cy="8" r="2.5" />
          <circle cx="13" cy="16" r="2.5" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

window.Icon = Icon;

const PALETTE = {
  pepper: '#E1461D',
  ink: '#241512',
  sand: '#F6EEE0',
  paper: '#FFFFFF',
  jade: '#2F8F5B',
  gold: '#F2A93B',
  muted: '#E8DCC8',
};

const LABELS = {
  discovery: 'A plate ready for something delicious',
  cart: 'An empty shopping bag',
  orders: 'A receipt waiting for your first order',
  favorites: 'A heart above a favorite plate',
  kitchen: 'A covered serving plate',
  delivery: 'A delivery rider on the way',
  payment: 'A protected payment card',
  success: 'A completed order check',
  unavailable: 'A closed serving cloche',
};

export default function SceneIllustration({ scene = 'discovery', className = '' }) {
  const label = LABELS[scene] || LABELS.discovery;
  const common = { stroke: PALETTE.ink, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  return (
    <svg viewBox="0 0 200 144" className={className} role="img" aria-label={label} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="72" r="60" fill={PALETTE.sand}/>
      <circle cx="100" cy="72" r="48" fill={PALETTE.paper} opacity=".72"/>
      {scene === 'cart' && <>
        <path d="M57 52h14l10 51h54l11-39H76" stroke={PALETTE.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M87 64h50l-7 25H92z" fill="#FBE0D2" stroke={PALETTE.pepper} strokeWidth="3"/>
        <circle cx="91" cy="112" r="6" fill={PALETTE.pepper}/><circle cx="131" cy="112" r="6" fill={PALETTE.pepper}/>
        <path d="M107 70v15m-7.5-7.5h15" stroke={PALETTE.pepper} strokeWidth="3.5" strokeLinecap="round"/>
      </>}
      {(scene === 'discovery' || scene === 'favorites' || scene === 'orders') && <>
        <ellipse cx="100" cy="82" rx="49" ry="29" fill={PALETTE.paper} stroke={PALETTE.muted} strokeWidth="4"/>
        <ellipse cx="100" cy="80" rx="35" ry="18" fill="#FBE0D2"/>
        <path d="M75 79c8-14 20-15 26-4 7-10 20-9 25 3-7 13-17 17-27 10-8 7-18 4-24-9Z" fill={PALETTE.pepper} opacity=".9"/>
        <circle cx="93" cy="75" r="3" fill={PALETTE.gold}/><circle cx="111" cy="86" r="3" fill={PALETTE.jade}/>
        {scene === 'favorites' && <path d="M101 35c-9-11-25 2-16 14 6 8 16 14 16 14s10-6 16-14c9-12-7-25-16-14Z" fill={PALETTE.pepper} stroke={PALETTE.ink} strokeWidth="2.5"/>}
        {scene === 'orders' && <><path d="M133 39h17v43h-30V49z" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth="2.5"/><path d="M126 55h11m-11 8h11m-11 8h7" stroke={PALETTE.muted} strokeWidth="2.5" strokeLinecap="round"/></>}
      </>}
      {(scene === 'kitchen' || scene === 'unavailable') && <>
        <path d="M58 83h84l-8 20H66l-8-20Z" fill="#FBE0D2" stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M70 81c0-19 9-32 30-32s30 13 30 32H70Z" fill={scene === 'unavailable' ? PALETTE.muted : PALETTE.pepper} stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M80 79c2-11 9-18 20-18s18 7 20 18" stroke={PALETTE.paper} strokeWidth="3" strokeLinecap="round"/>
        <path d="M100 47v-9m-15 12-4-7m34 7 4-7" stroke={PALETTE.gold} strokeWidth="3" strokeLinecap="round"/>
      </>}
      {scene === 'delivery' && <>
        <path d="M68 86h60l-7 13H75l-7-13Z" fill={PALETTE.pepper} stroke={PALETTE.ink} strokeWidth="3"/>
        <circle cx="82" cy="105" r="10" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth="3"/>
        <circle cx="128" cy="105" r="10" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M89 84c0-21 9-34 22-34 12 0 19 11 19 25" stroke={PALETTE.ink} strokeWidth="4" strokeLinecap="round"/>
        <path d="M98 52h22l9 18H96z" fill={PALETTE.gold} stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M119 49h15l8 18h-14" fill={PALETTE.pepper} stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M73 83h-13m74 0h12" stroke={PALETTE.ink} strokeWidth="3" strokeLinecap="round"/>
      </>}
      {scene === 'payment' && <>
        <rect x="58" y="43" width="84" height="59" rx="9" fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth="3"/>
        <path d="M59 58h82" stroke={PALETTE.pepper} strokeWidth="8"/>
        <path d="M74 81h23m-23 9h14" stroke={PALETTE.muted} strokeWidth="4" strokeLinecap="round"/>
        <rect x="113" y="78" width="27" height="26" rx="6" fill={PALETTE.jade} stroke={PALETTE.ink} strokeWidth="2.5"/>
        <path d="M120 78v-5a6 6 0 0 1 12 0v5m-6 9v5" stroke={PALETTE.paper} strokeWidth="2.5" strokeLinecap="round"/>
      </>}
      {scene === 'success' && <>
        <circle cx="100" cy="74" r="36" fill="#E4F3EA" stroke={PALETTE.jade} strokeWidth="4"/>
        <path d="m81 74 13 13 26-28" stroke={PALETTE.jade} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="m48 53-5-7m111 4 6-7m-113 67-8 2m115 3 8 2" stroke={PALETTE.gold} strokeWidth="3" strokeLinecap="round"/>
      </>}
      <circle cx="48" cy="93" r="4" fill={PALETTE.gold}/>
      <circle cx="151" cy="42" r="4" fill={PALETTE.jade}/>
    </svg>
  );
}

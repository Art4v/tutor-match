/* MatchTutor — tutor card layouts, SHAPE pass.
   Fresh structures (no skyline-banner overlap): horizontal row, photo-split,
   photo-top, minimal, stat-band. Clean sans name for a professional read.
   Photos are <image-slot> (drop a real headshot; falls back to avatar.png).
   Exported to window. */

const I2 = {
  verified: (s = 15) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto' }}>
      <path d="M12 2.4l2.25 1.62 2.78-.18.9 2.64 2.3 1.56-.9 2.64.9 2.64-2.3 1.56-.9 2.64-2.78-.18L12 21.6l-2.25-1.62-2.78.18-.9-2.64-2.3-1.56.9-2.64-.9-2.64 2.3-1.56.9-2.64 2.78.18z" fill="#3E5C3A"/>
      <path d="M8.6 12.1l2.2 2.2 4.4-4.6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  pin: (s = 13, c = '#94998C') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" stroke={c} strokeWidth="1.9"/><circle cx="12" cy="10" r="2.3" stroke={c} strokeWidth="1.9"/></svg>
  ),
  cap: (s = 16, c = '#3E5C3A') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5l9 4-9 4-9-4 9-4z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/><path d="M7 11v4c0 1.2 2.2 2.4 5 2.4s5-1.2 5-2.4v-4" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/></svg>
  ),
  arrow: (s = 15, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  check: (s = 13, c = '#3E5C3A') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  star: (s = 13, c = '#C99A3F') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z"/></svg>
  ),
};

// circular avatar
function Av({ id, size = 64, ring = '#fff' }) {
  const inner = size - 6;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flex: '0 0 auto', background: ring, padding: 3,
      boxShadow: '0 1px 6px rgba(38,48,40,.16)' }}>
      <image-slot id={id} shape="circle" src="avatar.png" placeholder="Photo"
        style={{ width: inner + 'px', height: inner + 'px', display: 'block', borderRadius: '50%' }}></image-slot>
    </div>
  );
}
// rectangular / portrait photo (empty drop-slot — avatar crop has a baked ring, so don't prefill)
function Photo({ id, w, h, radius = 0 }) {
  return (
    <image-slot id={id} shape="rounded" radius={radius} placeholder="Drop your photo"
      style={{ width: typeof w === 'number' ? w + 'px' : w, height: typeof h === 'number' ? h + 'px' : h, display: 'block', flex: '0 0 auto',
        background: 'linear-gradient(150deg,#9BAE8C,#6E8068)' }}></image-slot>
  );
}

function NameS({ name, size = 19, center, verified = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', justifyContent: center ? 'center' : 'flex-start' }}>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: size, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{name}</span>
      {verified && I2.verified(size * 0.8)}
    </div>
  );
}

// Obvious verification badge — solid green pill with a bold tick.
function VerifiedPill() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--green)', color: '#fff',
      borderRadius: 999, padding: '5px 12px 5px 9px', alignSelf: 'flex-start',
      fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, letterSpacing: '0.01em',
      boxShadow: '0 1px 4px rgba(46,55,35,.25)' }}>
      <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: '#fff',
        alignItems: 'center', justifyContent: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="#3E5C3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      Verified tutor
    </div>
  );
}

// Obvious "not verified" badge — muted, clearly secondary.
function UnverifiedPill() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--muted)',
      border: '1px solid var(--line)', borderRadius: 999, padding: '4px 12px 4px 9px', alignSelf: 'flex-start',
      fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#A7A294" strokeWidth="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="#A7A294" strokeWidth="1.8" strokeLinecap="round"/></svg>
      Not verified
    </div>
  );
}

// Brand leaf / sprout mark — used on the coloured panel.
function LeafLogo({ size = 28, color = '#fff', opacity = 1, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" opacity={opacity} style={{ position: 'absolute', ...style }}>
      <path d="M32 60 C32 47 31 39 33 31" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M33 36 C18 35 9 25 10 11 C25 11 35 21 34 35 Z" fill={color} />
      <path d="M34 31 C48 28 56 16 54 3 C40 5 31 17 33 30 Z" fill={color} />
    </svg>
  );
}
function Role2({ children, center, clamp = 2 }) {
  return (
    <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.3, width: '100%',
      textAlign: center ? 'center' : 'left', display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
function Meta2({ icon, children, center, color = 'var(--muted)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: center ? 'center' : 'flex-start',
      fontFamily: 'var(--sans)', fontSize: 12, color, fontWeight: 500 }}>{icon}<span>{children}</span></div>
  );
}
function School2({ center, size = 13.5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: center ? 'center' : 'flex-start' }}>
      {I2.cap(15)}<span style={{ fontFamily: 'var(--sans)', fontSize: size, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>James Ruse Agricultural HS</span>
    </div>
  );
}
function Subjects2({ items, extra, center, max = 3 }) {
  const shown = items.slice(0, max), more = extra != null ? extra : items.length - shown.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: center ? 'center' : 'flex-start' }}>
      {shown.map((s) => (
        <span key={s} style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', background: '#fff', border: '1px solid var(--line)', borderRadius: 7, padding: '3px 9px' }}>{s}</span>
      ))}
      {more > 0 && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--green)', cursor: 'pointer', whiteSpace: 'nowrap' }}>+{more} more</span>}
    </div>
  );
}
function Quals2({ items, center }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: center ? 'center' : 'flex-start' }}>
      {items.map((q) => (
        <span key={q} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--green-2)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 9px' }}>{I2.check(12)}{q}</span>
      ))}
    </div>
  );
}
function Atar({ size = 20, label = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: size, color: 'var(--green)', letterSpacing: '-0.01em' }}>{D2.atar}</span>
      {label && <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: size * 0.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ATAR</span>}
    </div>
  );
}
function Price2({ size = 22 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: size, color: 'var(--ink)', letterSpacing: '-0.02em' }}>$60</span>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: size * 0.52, color: 'var(--muted)' }}>/hr</span>
    </div>
  );
}
function CTA2({ label = 'View profile', solid, full }) {
  return (
    <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: full ? '100%' : 'auto',
      border: solid ? 'none' : '1px solid var(--green)', background: solid ? 'var(--green)' : 'transparent', color: solid ? '#fff' : 'var(--green)',
      fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, padding: '9px 15px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}{I2.arrow(14, solid ? '#fff' : '#3E5C3A')}
    </button>
  );
}
function Rating() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {I2.star(13)}<span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>4.9</span>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500, color: 'var(--muted)' }}>(127)</span>
    </div>
  );
}

const D2 = {
  name: 'Aarav Bhatt',
  role: 'Founder of MatchTutor · HSC & Selective Tutor',
  loc: 'North Kellyville · NSW',
  subjects: ['Mathematics', 'English', 'Science', 'Physics', 'Chemistry'],
  extra: 7,
  atar: '98.05',
  quals: ['Selective entry', '5× HSC Band 6', 'B. Medicine, UNSW'],
};
const Card = ({ w, r = 16, children, style }) => (
  <div className="tcard" style={{ width: w, borderRadius: r, ...style }}>{children}</div>
);

// ================================================================ SHAPES ===

// 1 — ROW: coloured left panel with leaf logo + a circle that fills the segment.
function ShapeRow({ id = 's-row', leftBg = 'var(--green)', ring = 'var(--card)', verified = true, lightPanel = false }) {
  const leafColor = lightPanel ? 'rgba(46,55,35,0.55)' : '#ffffff';
  return (
    <Card w={520} style={{ flexDirection: 'row', alignItems: 'stretch', padding: 0, overflow: 'hidden', height: 214 }}>
      <div style={{ width: 214, flex: '0 0 auto', background: leftBg, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LeafLogo size={108} color={leafColor} opacity={lightPanel ? 0.18 : 0.16} style={{ right: -16, bottom: -18 }} />
        <LeafLogo size={26} color={leafColor} opacity={lightPanel ? 0.9 : 0.95} style={{ left: 12, top: 12 }} />
        <Av id={id} size={186} ring={ring} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', minWidth: 0, padding: '18px 0 18px 18px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <NameS name={D2.name} size={21} verified={false} />
          <Rating />
        </div>
        {verified ? <VerifiedPill /> : <UnverifiedPill />}
        <Role2>{D2.role}</Role2>
        <School2 />
        <Subjects2 items={D2.subjects} extra={D2.extra} max={3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 12,
        padding: '18px 18px', borderLeft: '1px solid var(--line)', flex: '0 0 auto', alignSelf: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 24, color: 'var(--green)' }}>{D2.atar}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ATAR</span>
        </div>
        <Price2 size={21} />
        <CTA2 label="View profile" solid />
      </div>
    </Card>
  );
}

// 2 — SPLIT: portrait photo on the left, details on the right.
function ShapeSplit() {
  return (
    <Card w={392} style={{ flexDirection: 'row', alignItems: 'stretch', padding: 0, overflow: 'hidden', height: 266 }}>
      <Photo id="s-split" w={142} h={'100%'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 16, flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NameS name={D2.name} size={19} />
          <Role2>{D2.role}</Role2>
          <Meta2 icon={I2.pin()}>{D2.loc}</Meta2>
        </div>
        <School2 />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Atar size={19} />
          <span style={{ color: 'var(--line)' }}>|</span>
          <Rating />
        </div>
        <Quals2 items={D2.quals.slice(0, 2)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <Price2 size={21} />
          <CTA2 label="See more" solid />
        </div>
      </div>
    </Card>
  );
}

// 3 — PHOTO-TOP: large photo header (no circle), details below.
function ShapePhotoTop() {
  return (
    <Card w={284} r={18} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Photo id="s-ptop" w={'100%'} h={196} />
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.94)', borderRadius: 8, padding: '4px 9px' }}>
          {I2.star(13)}<span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>4.9</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '15px 17px 17px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <NameS name={D2.name} size={19} />
            <Atar size={18} label={false} />
          </div>
          <Role2 clamp={1}>{D2.role}</Role2>
        </div>
        <School2 />
        <Subjects2 items={D2.subjects} extra={D2.extra} max={2} />
        <div style={{ height: 1, background: 'var(--line)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Price2 size={21} />
          <CTA2 label="View profile" solid />
        </div>
      </div>
    </Card>
  );
}

// 4 — MINIMAL: no photo header. Avatar inline, big ATAR, clean.
function ShapeMinimal() {
  return (
    <Card w={300} r={14} style={{ padding: 18, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Av id="s-min" size={56} ring="var(--panel)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <NameS name={D2.name} size={18} />
          <Role2 clamp={1}>{D2.role}</Role2>
        </div>
      </div>
      <School2 />
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '10px 6px' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, color: 'var(--green)' }}>{D2.atar}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>ATAR</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '10px 6px', borderLeft: '1px solid var(--line)' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, color: 'var(--green)' }}>5×</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Band 6</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '10px 6px', borderLeft: '1px solid var(--line)' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, color: 'var(--ink)' }}>$60</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>per hr</span>
        </div>
      </div>
      <Subjects2 items={D2.subjects} extra={D2.extra} max={3} />
      <CTA2 label="View full profile" solid full />
    </Card>
  );
}

// 5 — STAT-BAND: avatar + name on paper, a green band carries the awards.
function ShapeBand() {
  return (
    <Card w={300} r={16} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '17px 18px 14px' }}>
        <Av id="s-band" size={60} ring="var(--panel)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <NameS name={D2.name} size={18} />
          <Meta2 icon={I2.pin()}>{D2.loc}</Meta2>
          <School2 size={12.5} />
        </div>
      </div>
      <div style={{ background: 'var(--green)', padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: '#fff', lineHeight: 1 }}>{D2.atar}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>ATAR</span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.22)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: '#fff', lineHeight: 1 }}>5×</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Band 6</span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.22)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: '#fff', lineHeight: 1 }}>$60</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>per hr</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '14px 18px 17px' }}>
        <Subjects2 items={D2.subjects} extra={D2.extra} max={3} />
        <CTA2 label="View full profile" solid full />
      </div>
    </Card>
  );
}

Object.assign(window, {
  ShapeRow, ShapeSplit, ShapePhotoTop, ShapeMinimal, ShapeBand,
  // shared primitives for other card files
  I2, Av, Photo, NameS, VerifiedPill, UnverifiedPill, LeafLogo,
  Role2, Meta2, School2, Subjects2, Quals2, Atar, Price2, CTA2, Rating, Card, D2,
});

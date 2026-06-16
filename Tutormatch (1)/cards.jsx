/* MatchTutor — tutor card layouts (professional pass)
   Keeps: skyline header, name, role, location, school (enlarged), awards.
   Drops: bio. Adds: "View full profile" / "See more". Avatars are <image-slot>.
   Design language: hairline borders, restrained radii, a typographic stats
   bar instead of candy tiles. Exported to window. */

// ----------------------------------------------------------------- icons ---
const Ic = {
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
};

// --------------------------------------------------------------- pieces ---
function Banner({ h = 78, radius }) {
  return (
    <div style={{ height: h, width: '100%', overflow: 'hidden', borderTopLeftRadius: radius, borderTopRightRadius: radius, background: '#26304a' }}>
      <img src="banner.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%', display: 'block' }} />
    </div>
  );
}

function Avatar({ id, size = 92, ringColor = '#F4F1E8' }) {
  const inner = size - 7;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flex: '0 0 auto',
                  background: ringColor, padding: 3.5, boxShadow: '0 2px 10px rgba(38,48,40,.22)' }}>
      <image-slot id={id} shape="circle" src="avatar.png" placeholder="Drop photo"
        style={{ width: inner + 'px', height: inner + 'px', display: 'block', borderRadius: '50%' }}></image-slot>
    </div>
  );
}

function Name({ name, size = 27, center }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', width: '100%', justifyContent: center ? 'center' : 'flex-start' }}>
      <span style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: size, color: 'var(--ink)', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{name}</span>
      {Ic.verified(size * 0.56)}
    </div>
  );
}

// Role — kept from the original; two-line clamp, no harsh truncation.
function Role({ children, center }) {
  return (
    <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.32, width: '100%',
      textAlign: center ? 'center' : 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function MetaRow({ icon, children, center, size = 12.5, color = 'var(--muted)', weight = 500 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: center ? 'center' : 'flex-start',
                  fontFamily: 'var(--sans)', fontSize: size, color, fontWeight: weight }}>
      {icon}<span>{children}</span>
    </div>
  );
}

// School — enlarged & emphasised per feedback.
function School({ center, name = 'James Ruse Agricultural High School' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: center ? 'center' : 'flex-start' }}>
      {Ic.cap(16)}
      <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{name}</span>
    </div>
  );
}

// Typographic stats bar — professional alternative to rounded tiles.
function StatBar({ items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%',
      border: '1px solid var(--line)', borderRadius: 10, background: 'var(--panel)', overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '11px 6px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.01em' }}>{it.value}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// Qualification tags — flat, hairline, with a tick. Not pills.
function Quals({ items, center }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: center ? 'center' : 'flex-start' }}>
      {items.map((q) => (
        <span key={q} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--sans)',
          fontSize: 11.5, fontWeight: 600, color: 'var(--green-2)', background: 'var(--panel)',
          border: '1px solid var(--line)', borderRadius: 6, padding: '4px 9px' }}>
          {Ic.check(12)}{q}
        </span>
      ))}
    </div>
  );
}

// Subject chips + a real "See more" link.
function Subjects({ items, extra, center, max = 3, onMore = 'See more' }) {
  const shown = items.slice(0, max);
  const more = extra != null ? extra : items.length - shown.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: center ? 'center' : 'flex-start' }}>
      {shown.map((s) => (
        <span key={s} style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
          background: '#fff', border: '1px solid var(--line)', borderRadius: 7, padding: '4px 10px' }}>{s}</span>
      ))}
      {more > 0 && (
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}>
          +{more} {onMore}
        </span>
      )}
    </div>
  );
}

function Price({ amount = '$60', unit = '/hr', size = 24 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: size, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{amount}</span>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: size * 0.52, color: 'var(--muted)' }}>{unit}</span>
    </div>
  );
}

function CTA({ label = 'View full profile', solid, full = true }) {
  return (
    <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      width: full ? '100%' : 'auto', border: solid ? 'none' : '1px solid var(--green)',
      background: solid ? 'var(--green)' : 'transparent', color: solid ? '#fff' : 'var(--green)',
      fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, padding: '11px 16px', borderRadius: 10, cursor: 'pointer' }}>
      {label}{Ic.arrow(15, solid ? '#fff' : '#3E5C3A')}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', width: '100%' }} />;
}

// Shared data
const D = {
  name: 'Aarav Bhatt',
  role: 'Founder of MatchTutor · HSC & Selective Tutor',
  loc: 'North Kellyville · NSW',
  subjects: ['Mathematics', 'English', 'Science', 'Physics', 'Chemistry'],
  extra: 7,
  school: 'James Ruse Agricultural High School',
  atar: '98.05',
  quals: ['Selective entry', '5× HSC Band 6', 'B. Medicine, UNSW'],
};

const Shell = ({ w, children, style }) => (
  <div className="tcard" style={{ width: w, ...style }}>{children}</div>
);
const Body = ({ children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', ...style }}>{children}</div>
);

// ================================================================ CARDS ===

// A — CLASSIC: skyline header, centred avatar, full info, stats bar, CTA.
function CardClassic() {
  return (
    <Shell w={312} style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Banner h={76} />
        <div style={{ position: 'absolute', left: '50%', bottom: -34, transform: 'translateX(-50%)' }}>
          <Avatar id="av-classic" size={88} />
        </div>
      </div>
      <Body style={{ padding: '44px 20px 18px', gap: 12, alignItems: 'center' }}>
        <Body style={{ gap: 6, alignItems: 'center' }}>
          <Name name={D.name} center />
          <Role center>{D.role}</Role>
          <MetaRow icon={Ic.pin()} center>{D.loc}</MetaRow>
        </Body>
        <School center />
        <StatBar items={[{ value: D.atar, label: 'ATAR' }, { value: '5×', label: 'Band 6' }, { value: 'Top 0.5%', label: 'Selective' }]} />
        <Subjects items={D.subjects} extra={D.extra} center />
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Price />
          <CTA label="View profile" full={false} solid />
        </div>
      </Body>
    </Shell>
  );
}

// B — LEFT-ALIGNED: closest to the original layout, refined & professional.
function CardLeft() {
  return (
    <Shell w={336} style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Banner h={70} />
        <div style={{ position: 'absolute', left: 20, bottom: -30 }}>
          <Avatar id="av-left" size={84} />
        </div>
      </div>
      <Body style={{ padding: '40px 20px 18px', gap: 11 }}>
        <Body style={{ gap: 5 }}>
          <Name name={D.name} />
          <Role>{D.role}</Role>
          <MetaRow icon={Ic.pin()}>{D.loc}</MetaRow>
        </Body>
        <School />
        <Quals items={D.quals} />
        <Subjects items={D.subjects} extra={D.extra} />
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 17, color: 'var(--green)' }}>{D.atar}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ATAR</span>
            <span style={{ color: 'var(--line)' }}>|</span>
            <Price size={18} />
          </div>
          <CTA label="See more" full={false} solid />
        </div>
      </Body>
    </Shell>
  );
}

// C — COMPACT: smaller, centred, role + big school + single stat + CTA.
function CardCompact() {
  return (
    <Shell w={272} style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Banner h={64} />
        <div style={{ position: 'absolute', left: '50%', bottom: -32, transform: 'translateX(-50%)' }}>
          <Avatar id="av-compact" size={84} />
        </div>
      </div>
      <Body style={{ padding: '42px 18px 16px', gap: 10, alignItems: 'center' }}>
        <Body style={{ gap: 5, alignItems: 'center' }}>
          <Name name={D.name} center size={25} />
          <Role center>{D.role}</Role>
        </Body>
        <School center />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: 'var(--green)', lineHeight: 1 }}>{D.atar}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ATAR</span>
          </div>
          <div style={{ width: 1, height: 30, background: 'var(--line)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Price size={22} />
          </div>
        </div>
        <Subjects items={D.subjects} extra={D.extra} center max={2} />
        <CTA label="View full profile" solid />
      </Body>
    </Shell>
  );
}

// D — CREDENTIALS: centred, awards as the focus (stat bar + qual list), CTA.
function CardCredentials() {
  return (
    <Shell w={316} style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Banner h={72} />
        <div style={{ position: 'absolute', left: '50%', bottom: -34, transform: 'translateX(-50%)' }}>
          <Avatar id="av-cred" size={88} />
        </div>
      </div>
      <Body style={{ padding: '44px 20px 18px', gap: 12, alignItems: 'center' }}>
        <Body style={{ gap: 5, alignItems: 'center' }}>
          <Name name={D.name} center />
          <Role center>{D.role}</Role>
        </Body>
        <School center />
        <StatBar items={[{ value: D.atar, label: 'ATAR' }, { value: '$60', label: 'per hour' }]} />
        <Body style={{ gap: 7, width: '100%' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'flex-start' }}>Qualifications</span>
          <Quals items={D.quals} />
        </Body>
        <Subjects items={D.subjects} extra={D.extra} center />
        <CTA label="View full profile" solid />
      </Body>
    </Shell>
  );
}

Object.assign(window, {
  CardClassic, CardLeft, CardCompact, CardCredentials,
});

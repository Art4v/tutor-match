/* MatchTutor — VERTICAL (portrait) tutor cards.
   Profile photo big on top; tagline gets its own header band; everything
   else restacked compactly below. Reuses primitives exported from cards2.jsx
   (Av, Photo, VerifiedPill, School2, Subjects2, Rating, CTA2, LeafLogo, I2…).
   Exported to window. */

const D3 = {
  name: 'Aarav Bhatt',
  taglineMain: 'Founder of MatchTutor',
  taglineSub: 'HSC & Selective Tutor',
  atar: '98.05',
  subjects: ['Mathematics', 'English', 'Science', 'Physics', 'Chemistry'],
  extra: 7,
};

// little leaf that flows inline (LeafLogo is absolutely positioned)
function LeafInline({ size = 15, color = 'var(--green)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ flex: '0 0 auto' }}>
      <path d="M33 36 C18 35 9 25 10 11 C25 11 35 21 34 35 Z" fill={color} />
      <path d="M34 31 C48 28 56 16 54 3 C40 5 31 17 33 30 Z" fill={color} />
    </svg>
  );
}

// overlay rating chip for the top of a photo
function RatingChip({ full }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.95)',
      borderRadius: 9, padding: '5px 10px', boxShadow: '0 2px 8px rgba(20,28,18,.22)' }}>
      {I2.star(13)}
      <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>4.9</span>
      {full && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500, color: 'var(--muted)' }}>(127)</span>}
    </div>
  );
}

// The tagline as a real header. eyebrow = small uppercase label, lead = larger.
function TaglineHeader({ center, variant = 'banner' }) {
  if (variant === 'plain') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: center ? 'center' : 'flex-start',
        textAlign: center ? 'center' : 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: center ? 'center' : 'flex-start' }}>
          <LeafInline size={14} />
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, color: 'var(--green)', letterSpacing: '-0.01em' }}>{D3.taglineMain}</span>
        </div>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12.5, color: 'var(--ink-2)' }}>{D3.taglineSub}</span>
      </div>
    );
  }
  // banner: full-width tinted strip
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 18px', background: 'var(--panel)',
      borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <LeafInline size={18} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{D3.taglineMain}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{D3.taglineSub}</span>
      </div>
    </div>
  );
}

// shared green stat trio (ATAR / Band 6 / price)
function StatTrio({ light }) {
  const cell = (big, small, accent) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 20, lineHeight: 1,
        color: light ? 'var(--green)' : '#fff' }}>{big}</span>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em',
        whiteSpace: 'nowrap', color: light ? 'var(--muted)' : 'rgba(255,255,255,.78)' }}>{small}</span>
    </div>
  );
  const div = <div style={{ width: 1, alignSelf: 'stretch', background: light ? 'var(--line)' : 'rgba(255,255,255,.22)' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
      background: light ? 'transparent' : 'var(--green)', border: light ? '1px solid var(--line)' : 'none', borderRadius: light ? 12 : 0 }}>
      {cell(D3.atar, 'ATAR')}{div}{cell('5×', 'Band 6')}{div}{cell('$60', 'per hr')}
    </div>
  );
}

// ============================================================ VERTICAL V1 ===
// HERO — name sits on a scrim over the photo; tagline header band beneath.
function VHero({ id = 'v-hero' }) {
  return (
    <Card w={326} r={18} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Photo id={id} w={'100%'} h={278} />
        <LeafLogo size={24} color="#fff" opacity={0.96} style={{ left: 15, top: 15 }} />
        <div style={{ position: 'absolute', top: 14, right: 14 }}><RatingChip full /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130,
          background: 'linear-gradient(to top, rgba(18,26,16,0.92), rgba(18,26,16,0.0))' }} />
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 23, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{D3.name}</span>
          {I2.verified(18)}
        </div>
      </div>
      <TaglineHeader variant="banner" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '15px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <School2 size={13} />
          <VerifiedPill />
        </div>
        <Subjects2 items={D3.subjects} extra={D3.extra} max={3} />
        <div style={{ height: 1, background: 'var(--line)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: 'var(--green)', lineHeight: 1 }}>{D3.atar}</span>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ATAR</span>
            </div>
            <Price2 size={21} />
          </div>
          <CTA2 label="View profile" solid />
        </div>
      </div>
    </Card>
  );
}

// ============================================================ VERTICAL V2 ===
// STACK — clean photo top, everything stacked in the body, tagline header inline.
function VStack({ id = 'v-stack' }) {
  return (
    <Card w={318} r={18} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Photo id={id} w={'100%'} h={228} />
        <LeafLogo size={22} color="#fff" opacity={0.96} style={{ left: 14, top: 14 }} />
        <div style={{ position: 'absolute', top: 13, right: 13 }}><RatingChip full /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{D3.name}</span>
          <VerifiedPill />
        </div>
        <TaglineHeader variant="plain" />
        <School2 size={13} />
        <StatTrio light />
        <Subjects2 items={D3.subjects} extra={D3.extra} max={3} />
        <CTA2 label="View full profile" solid full />
      </div>
    </Card>
  );
}

// ============================================================ VERTICAL V3 ===
// CROWN — coloured top band, big circular avatar straddling it, centred stack.
function VCrown({ id = 'v-crown', topBg = '#3E5C3A' }) {
  return (
    <Card w={312} r={18} style={{ overflow: 'hidden', alignItems: 'stretch' }}>
      <div style={{ height: 104, background: topBg, position: 'relative', overflow: 'hidden' }}>
        <LeafLogo size={96} color="#fff" opacity={0.14} style={{ right: -14, bottom: -22 }} />
        <LeafLogo size={22} color="#fff" opacity={0.95} style={{ left: 14, top: 14 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, padding: '0 18px 18px' }}>
        <div style={{ marginTop: -76 }}><Av id={id} size={148} ring="var(--card)" /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{D3.name}</span>
          {I2.verified(18)}
        </div>
        <TaglineHeader variant="plain" center />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VerifiedPill />
          <RatingChip full />
        </div>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}><School2 size={13} /></div>
        <div style={{ width: '100%' }}><StatTrio light /></div>
        <Subjects2 items={D3.subjects} extra={D3.extra} max={3} center />
        <CTA2 label="View full profile" solid full />
      </div>
    </Card>
  );
}

// ============================================================ VERTICAL V4 ===
// BAND — photo top, header block, then a full-bleed green stat band, then chips.
function VBand({ id = 'v-band' }) {
  return (
    <Card w={320} r={18} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <Photo id={id} w={'100%'} h={216} />
        <LeafLogo size={22} color="#fff" opacity={0.96} style={{ left: 14, top: 14 }} />
        <div style={{ position: 'absolute', top: 13, right: 13 }}><RatingChip /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '16px 18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{D3.name}</span>
          {I2.verified(18)}
        </div>
        <TaglineHeader variant="plain" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <School2 size={13} />
          <VerifiedPill />
        </div>
      </div>
      <StatTrio />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '15px 18px 18px' }}>
        <Subjects2 items={D3.subjects} extra={D3.extra} max={3} />
        <CTA2 label="View full profile" solid full />
      </div>
    </Card>
  );
}

Object.assign(window, { VHero, VStack, VCrown, VBand, D3 });

/* ══════════════════════════════════════════════════
   ANUPAM YADAV — PORTFOLIO
   app.js  |  Phase 2 — Experience Shell
   Stack: Lenis + GSAP ScrollTrigger
══════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   1. LENIS SMOOTH SCROLL
   Physical, slightly cinematic — not floaty.
───────────────────────────────────────────── */
const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
  smoothTouch: false,
});

// Lenis ↔ GSAP ScrollTrigger sync
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Smooth anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  });
});

/* ─────────────────────────────────────────────
   2. NAVIGATION — Menu open / close
───────────────────────────────────────────── */
const menuBtn     = document.getElementById('menuBtn');
const menuOverlay = document.getElementById('menuOverlay');
const menuClose   = document.getElementById('menuClose');
const menuLinks   = document.querySelectorAll('[data-menu-link]');

function openMenu() {
  menuOverlay.classList.add('is-open');
  lenis.stop();
}
function closeMenu() {
  menuOverlay.classList.remove('is-open');
  lenis.start();
}

menuBtn.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
menuLinks.forEach(l => l.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ─────────────────────────────────────────────
   3. SCENE PROGRESS INDICATOR
───────────────────────────────────────────── */
const progressDots = document.querySelectorAll('.scene-progress__dot');
const scenes       = document.querySelectorAll('.scene[data-scene]');

function setActiveScene(num) {
  progressDots.forEach(d => {
    d.classList.toggle('is-active', d.dataset.scene === String(num));
  });
}

scenes.forEach(scene => {
  ScrollTrigger.create({
    trigger: scene,
    start: 'top 55%',
    end: 'bottom 55%',
    onEnter:     () => setActiveScene(scene.dataset.scene),
    onEnterBack: () => setActiveScene(scene.dataset.scene),
  });
});

/* ─────────────────────────────────────────────
   4. SCENE 01 — ENTRY
   Choreography: name lines, image, meta move
   at different rates as hero scrolls out.
───────────────────────────────────────────── */

// Initial load reveal
const tlEntry = gsap.timeline({ delay: 0.2 });
tlEntry
  .from('.s-entry__meta', {
    y: 12, opacity: 0, duration: 0.8,
    ease: 'power3.out'
  })
  .from('.s-entry__name-line:first-child', {
    y: 80, opacity: 0, duration: 1.2,
    ease: 'power4.out'
  }, '-=0.4')
  .from('.s-entry__name-line:last-child', {
    y: 80, opacity: 0, duration: 1.2,
    ease: 'power4.out'
  }, '-=1')
  .from('.s-entry__image-wrap', {
    y: 40, opacity: 0, duration: 1.2,
    ease: 'power4.out'
  }, '-=0.8')
  .from('.s-entry__scroll-cue', {
    opacity: 0, duration: 0.8
  }, '-=0.4');

// Scroll-out: lines move at different speeds (signature moment #1)
const entrySection = document.querySelector('#scene-01');

gsap.to('.s-entry__name-line:first-child', {
  y: -160, opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: entrySection,
    start: 'top top',
    end: 'bottom top',
    scrub: 1.2,
  }
});

gsap.to('.s-entry__name-line:last-child', {
  y: -90, opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: entrySection,
    start: 'top top',
    end: 'bottom top',
    scrub: 1.6,
  }
});

gsap.to('.s-entry__image-wrap', {
  y: 80,
  ease: 'none',
  scrollTrigger: {
    trigger: entrySection,
    start: 'top top',
    end: 'bottom top',
    scrub: 0.8,
  }
});

gsap.to('.s-entry__meta, .s-entry__scroll-cue', {
  y: -50, opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: entrySection,
    start: 'top top',
    end: '40% top',
    scrub: 1,
  }
});

// Subtle mouse parallax on hero layers
const heroParallaxLayers = document.querySelectorAll('[data-parallax]');
document.addEventListener('mousemove', (e) => {
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;
  const dx = (e.clientX - cx) / cx;  // –1 … 1
  const dy = (e.clientY - cy) / cy;

  heroParallaxLayers.forEach(layer => {
    const speed = parseFloat(layer.dataset.parallax);
    gsap.to(layer, {
      x: dx * speed * 40,
      y: dy * speed * 30,
      duration: 1.0,
      ease: 'power2.out',
    });
  });
});

/* ─────────────────────────────────────────────
   5. SCENE 02 — HORIZONTAL SCROLL (Signature Moment #1)
   Pin the section; scrub the track sideways.
   Inner images pan to escape their frames.
───────────────────────────────────────────── */
const workSection = document.querySelector('#scene-02');
const workTrack   = document.getElementById('workTrack');

function buildHorizontalScroll() {
  if (!workTrack) return;
  // Total distance to travel
  const getScrollAmount = () => -(workTrack.scrollWidth - window.innerWidth);

  const pinDuration = () => workTrack.scrollWidth;

  ScrollTrigger.create({
    trigger: workSection,
    pin: true,
    start: 'top top',
    end: () => '+=' + workTrack.scrollWidth,
    scrub: 1.1,
    anticipatePin: 1,
    animation: gsap.to(workTrack, {
      x: getScrollAmount,
      ease: 'none',
    }),
    invalidateOnRefresh: true,
  });

  // Inner image parallax — each image pans in the opposite direction to the track
  document.querySelectorAll('.project__image-inner').forEach(inner => {
    gsap.to(inner, {
      x: '15%',
      ease: 'none',
      scrollTrigger: {
        trigger: inner.closest('.project'),
        containerAnimation: ScrollTrigger.getAll().find(st => st.vars?.trigger === workSection),
        start: 'left right',
        end: 'right left',
        scrub: true,
        invalidateOnRefresh: true,
      }
    });
  });
}

// Build after a tick (Lenis + GSAP need DOM settled)
window.addEventListener('load', () => {
  ScrollTrigger.refresh();
  buildHorizontalScroll();
});

/* ─────────────────────────────────────────────
   6. SCENE 02 HEADER — fade up on scroll in
───────────────────────────────────────────── */
gsap.from('.s-work__header', {
  y: 40, opacity: 0, duration: 1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#scene-02',
    start: 'top 80%',
  }
});

/* ─────────────────────────────────────────────
   7. SCENE 03 — ENGINE
   Museum stillness. Items appear column by column.
───────────────────────────────────────────── */
gsap.from('.s-engine__left', {
  y: 40, opacity: 0, duration: 1,
  ease: 'power3.out',
  scrollTrigger: { trigger: '#scene-03', start: 'top 70%' }
});

gsap.from('.s-engine__col', {
  y: 30, opacity: 0, duration: 0.8,
  stagger: 0.12,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.s-engine__catalog', start: 'top 75%' }
});

gsap.from('.s-engine__statement', {
  y: 20, opacity: 0, duration: 0.8,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.s-engine__statement', start: 'top 80%' }
});

/* ─────────────────────────────────────────────
   8. SCENE 04 — EXPERIMENTS
   Signature moment #2: items slide in with
   scale from edge as user scrolls.
───────────────────────────────────────────── */
document.querySelectorAll('.exp-item').forEach((item, i) => {
  const dir = i % 2 === 0 ? 60 : -60;
  gsap.from(item, {
    x: dir, opacity: 0, duration: 1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: item,
      start: 'top 82%',
    }
  });
});

/* ─────────────────────────────────────────────
   9. SCENE 05 — ABOUT
   Subtle depth: portrait moves slightly
   different to text as you scroll.
───────────────────────────────────────────── */
gsap.from('.s-about__image-wrap', {
  y: 60, opacity: 0, duration: 1.2,
  ease: 'power3.out',
  scrollTrigger: { trigger: '#scene-05', start: 'top 70%' }
});

gsap.from('.s-about__right > *', {
  y: 30, opacity: 0, duration: 0.9,
  stagger: 0.15,
  ease: 'power3.out',
  scrollTrigger: { trigger: '#scene-05', start: 'top 65%' }
});

// Parallax scroll depth — portrait vs text
gsap.to('.s-about__image-wrap', {
  y: -50,
  ease: 'none',
  scrollTrigger: {
    trigger: '#scene-05',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1.5,
  }
});

gsap.to('.s-about__right', {
  y: -20,
  ease: 'none',
  scrollTrigger: {
    trigger: '#scene-05',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
  }
});

/* ─────────────────────────────────────────────
   10. SCENE 06 — CONTACT
   Signature moment #3: heading slides up
   in three independent lines.
───────────────────────────────────────────── */
gsap.from('.s-contact__heading', {
  y: 120, opacity: 0, duration: 1.4,
  ease: 'power4.out',
  scrollTrigger: { trigger: '#scene-06', start: 'top 75%' }
});

gsap.from('.s-contact__links', {
  y: 20, opacity: 0, duration: 0.8,
  ease: 'power3.out',
  scrollTrigger: { trigger: '#scene-06', start: 'top 65%' }
});

gsap.from('.s-contact__footer', {
  opacity: 0, duration: 0.6,
  scrollTrigger: { trigger: '#scene-06', start: 'top 60%' }
});

/* ─────────────────────────────────────────────
   11. MAGNETIC-ISH BUTTONS
   Subtle pull — not theatrical.
───────────────────────────────────────────── */
document.querySelectorAll('.project__link, .s-contact__link, .exp-item__link').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (e.clientX - cx) * 0.25;
    const dy = (e.clientY - cy) * 0.25;
    gsap.to(btn, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
  });
  btn.addEventListener('mouseleave', () => {
    gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
  });
});

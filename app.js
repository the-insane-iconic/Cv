/* ================================================================
   ROHAN RAJ — PORTFOLIO  (refactored for content-driven system)
   App Logic: Navbar, Typing Effect, Scroll Animations,
   Cert Filter/Search, Modal, Stats Counter, Canvas BG

   IMPORTANT: This file no longer runs on DOMContentLoaded.
   render.js populates the DOM first, then calls window.initApp().
   Roles for the typing effect come from window.PORTFOLIO_ROLES.
   ================================================================ */

window.initApp = function () {
  'use strict';

  /* ---------- Lenis Ultra-Smooth Inertia Engine ---------- */
  let lenisInstance = window.lenis;
  if (typeof Lenis !== 'undefined') {
    if (lenisInstance && typeof lenisInstance.destroy === 'function') {
      lenisInstance.destroy();
    }
    lenisInstance = new Lenis({
      lerp: 0.085,
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.05,
      infinite: false,
    });
    window.lenis = lenisInstance;

    function raf(time) {
      lenisInstance.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  /* ---------- Navbar Scroll ---------- */
  const navbar = document.getElementById('navbar');
  const sections = document.querySelectorAll('section[id]');

  function handleScroll(e) {
    const scrollY = (typeof e === 'object' && e && e.scroll !== undefined) ? e.scroll : window.scrollY;

    // Navbar background
    if (scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Active nav link
    sections.forEach((section) => {
      const top = section.offsetTop - 120;
      const bottom = top + section.offsetHeight;
      const id = section.getAttribute('id');
      const link = document.querySelector(`.nav-link[href="#${id}"]`);
      if (link) {
        if (scrollY >= top && scrollY < bottom) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    });
  }

  if (lenisInstance) {
    lenisInstance.on('scroll', handleScroll);
  } else {
    window.addEventListener('scroll', handleScroll, { passive: true });
  }
  handleScroll();

  /* ---------- Circular Ripple Theme Toggle (View Transitions API) ---------- */
  const themeBtn = document.getElementById('nav-theme-btn');
  const savedTheme = localStorage.getItem('portfolio_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Pre-decode opposite theme image into browser memory immediately
  try {
    const lightImg = new Image();
    lightImg.src = 'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/light%20gate.png';
    const darkImg = new Image();
    darkImg.src = 'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/darkgate.png';
  } catch (e) {}

  if (themeBtn) {
    themeBtn.addEventListener('click', (e) => {
      const isDark = document.body.classList.contains('dark-mode');
      const nextIsDark = !isDark;

      const applyTheme = () => {
        if (nextIsDark) {
          document.body.classList.add('dark-mode');
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('portfolio_theme', 'dark');
          themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
          document.body.classList.remove('dark-mode');
          document.documentElement.setAttribute('data-theme', 'light');
          localStorage.setItem('portfolio_theme', 'light');
          themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
      };

      // Circular ripple reveal originating from the theme button
      if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const rect = themeBtn.getBoundingClientRect();
        const x = e.clientX || (rect.left + rect.width / 2);
        const y = e.clientY || (rect.top + rect.height / 2);

        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          applyTheme();
        });

        transition.ready.then(() => {
          const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ];
          document.documentElement.animate(
            {
              clipPath: clipPath
            },
            {
              duration: 550,
              easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        });
      } else {
        applyTheme();
      }
    });
  }

  /* ---------- Profile Zoom Modal & Admin Auth Flow ---------- */
  const profileDropdown = document.getElementById('profile-avatar-wrapper') || document.getElementById('profile-dropdown-wrapper');
  const profileBtn = document.getElementById('nav-profile-btn');
  const profileZoomModal = document.getElementById('profile-zoom-modal');
  const profileZoomClose = document.getElementById('profile-zoom-close');
  const profileZoomOverlay = document.getElementById('profile-zoom-overlay');
  const profileZoomAdminBtn = document.getElementById('profile-zoom-admin-btn');
  const openAdminBtn = document.getElementById('open-admin-auth-btn');
  const authModal = document.getElementById('admin-auth-modal');
  const authClose = document.getElementById('admin-auth-close');
  const authOverlay = document.getElementById('admin-auth-overlay');
  const authForm = document.getElementById('admin-auth-form');
  const authUserInput = document.getElementById('admin-auth-user');
  const authPassInput = document.getElementById('admin-auth-pass');
  const authError = document.getElementById('admin-auth-error');

  function openProfileZoomModal() {
    if (!profileZoomModal) return;
    profileZoomModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeProfileZoomModal() {
    if (!profileZoomModal) return;
    profileZoomModal.classList.add('hidden');
    if (!authModal || authModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  function openAdminAuthModal() {
    closeProfileZoomModal();
    if (profileDropdown) profileDropdown.classList.remove('open');

    // If already authenticated in current session, jump straight to editor
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
      window.location.href = 'admin.html';
      return;
    }

    if (authModal) {
      authModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      if (authError) authError.style.display = 'none';
      if (authUserInput) {
        authUserInput.value = '';
        setTimeout(() => authUserInput.focus(), 150);
      }
      if (authPassInput) authPassInput.value = '';
    }
  }

  function closeAdminAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileZoomModal();
    });
  }

  if (profileZoomClose) profileZoomClose.addEventListener('click', closeProfileZoomModal);
  if (profileZoomOverlay) profileZoomOverlay.addEventListener('click', closeProfileZoomModal);

  if (profileZoomAdminBtn) {
    profileZoomAdminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminAuthModal();
    });
  }

  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminAuthModal();
    });
  }

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProfileZoomModal();
      closeAdminAuthModal();
    }
  });

  if (authClose) authClose.addEventListener('click', closeAdminAuthModal);
  if (authOverlay) authOverlay.addEventListener('click', closeAdminAuthModal);

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = (authUserInput ? authUserInput.value : '').trim();
      const pass = (authPassInput ? authPassInput.value : '').trim();

      if (user === 'admin' && pass === 'admin') {
        sessionStorage.setItem('admin_authenticated', 'true');
        const submitBtn = document.getElementById('admin-auth-submit');
        if (submitBtn) {
          submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Authorized...</span>`;
          submitBtn.style.background = '#2e7d32';
        }
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 350);
      } else {
        if (authError) {
          authError.style.display = 'flex';
          authError.style.animation = 'none';
          authError.offsetHeight; /* trigger reflow */
          authError.style.animation = 'shake 0.3s ease';
        }
        if (authPassInput) {
          authPassInput.value = '';
          authPassInput.focus();
        }
      }
    });
  }

  /* ---------- Hamburger Mobile Menu ---------- */
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      hamburger.classList.toggle('active', isOpen);
      const icon = hamburger.querySelector('i');
      if (icon) {
        if (isOpen) {
          icon.classList.remove('fa-bars');
          icon.classList.add('fa-xmark');
        } else {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });

    // Close on link click
    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        hamburger.classList.remove('active');
        const icon = hamburger.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        navMenu.classList.remove('open');
        hamburger.classList.remove('active');
        const icon = hamburger.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });
  }

  /* ---------- Typing Effect ---------- */
  // Roles come from render.js via window.PORTFOLIO_ROLES, with fallback
  const roles = (window.PORTFOLIO_ROLES && window.PORTFOLIO_ROLES.length)
    ? window.PORTFOLIO_ROLES
    : ['Developer', 'Designer', 'Creator'];

  const typingEl = document.querySelector('.typing-text');
  let roleIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  const typeSpeed = 55;
  const deleteSpeed = 30;
  const pauseEnd = 2200;
  const pauseStart = 400;

  function typeEffect() {
    if (!typingEl) return;

    const current = roles[roleIndex];

    if (!isDeleting) {
      typingEl.textContent = current.substring(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) {
        isDeleting = true;
        setTimeout(typeEffect, pauseEnd);
        return;
      }
      setTimeout(typeEffect, typeSpeed);
    } else {
      typingEl.textContent = current.substring(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        setTimeout(typeEffect, pauseStart);
        return;
      }
      setTimeout(typeEffect, deleteSpeed);
    }
  }

  setTimeout(typeEffect, 800);

  /* ---------- Intersection Observer – Scroll-Reveal Animations ---------- */
  const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px',
  };

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');

        // Restore progress bar widths when skill categories become visible
        if (entry.target.classList.contains('skill-category')) {
          entry.target.querySelectorAll('.progress-fill').forEach((bar) => {
            const w = bar.getAttribute('data-width') || bar.style.width;
            if (w) {
              bar.style.setProperty('width', w, 'important');
            }
          });
        }
      }
    });
  }, observerOptions);

  // Observe all animatable elements
  document
    .querySelectorAll(
      '.fade-in-section, .skill-category, .timeline-item, .project-card, .cert-card, .stat-card, .about-grid, .section-title, .contact-grid, .timeline'
    )
    .forEach((el) => {
      el.classList.remove('is-visible');
      fadeObserver.observe(el);
    });

  // Store original progress bar widths before animation system collapses them
  document.querySelectorAll('.progress-fill').forEach((bar) => {
    const inline = bar.style.width;
    if (inline) bar.setAttribute('data-width', inline);
  });

  /* ---------- Hero Parallax on Scroll ---------- */
  const heroBgArt = document.querySelector('.hero-bg-art');
  if (heroBgArt) {
    const handleParallax = (e) => {
      const scrollY = (typeof e === 'object' && e && e.scroll !== undefined) ? e.scroll : window.scrollY;
      const heroH = window.innerHeight;
      if (scrollY < heroH) {
        const progress = scrollY / heroH;
        heroBgArt.style.transform = `translate3d(0, ${(progress * 35).toFixed(1)}px, 0)`;
        heroBgArt.style.opacity = (1 - progress * 0.45).toFixed(3);
      }
    };
    if (lenisInstance) {
      lenisInstance.on('scroll', handleParallax);
    } else {
      window.addEventListener('scroll', handleParallax, { passive: true });
    }
  }

  /* ---------- Stats Counter Animation ---------- */
  const statNumbers = document.querySelectorAll('.stat-number span[data-target]');

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'), 10);
          animateCount(el, target);
          countObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach((el) => countObserver.observe(el));

  function animateCount(el, target) {
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Certification Filter & Search ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const certCards = document.querySelectorAll('.cert-card');
  const searchInput = document.getElementById('cert-search-input');
  let activeFilter = 'All';

  function applyFilters() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    certCards.forEach((card) => {
      const cat = card.querySelector('.cert-category');
      const catText = cat ? cat.getAttribute('data-cat') || cat.textContent : '';
      const title = (card.querySelector('.cert-content h3') || {}).textContent || '';
      const issuer = (card.querySelector('.cert-issuer') || {}).textContent || '';

      const matchesFilter =
        activeFilter === 'All' || catText.toLowerCase() === activeFilter.toLowerCase();
      const matchesSearch =
        !query ||
        title.toLowerCase().includes(query) ||
        issuer.toLowerCase().includes(query) ||
        catText.toLowerCase().includes(query);

      if (matchesFilter && matchesSearch) {
        card.classList.remove('filter-hidden');
      } else {
        card.classList.add('filter-hidden');
      }
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  /* ---------- Certificate Modal (Preview Only, No Download) ---------- */
  const certModal = document.getElementById('cert-modal');
  const certModalClose = document.getElementById('modal-close');
  const certModalOverlay = document.getElementById('cert-modal-overlay') || (certModal ? certModal.querySelector('.modal-overlay') : null);
  const certModalTitle = document.getElementById('modal-title');
  const certModalIssuerText = document.getElementById('modal-issuer-text');
  const certModalCatBadge = document.getElementById('modal-cat-badge');
  const certModalIframe = document.getElementById('modal-iframe');
  const certModalLoader = document.getElementById('modal-loader');
  const certPreviewTitle = document.getElementById('modal-preview-title');
  const certPreviewIssuer = document.getElementById('modal-preview-issuer');
  const certPreviewCategory = document.getElementById('modal-preview-category');
  const certPreviewName = document.getElementById('modal-preview-name');
  const certPreviewIcon = document.getElementById('modal-preview-icon');

  function openCertModal(card) {
    if (!certModal || !card) return;
    const title = card.getAttribute('data-cert-title') || card.querySelector('.cert-content h3')?.textContent || 'Certificate';
    const issuer = card.getAttribute('data-cert-issuer') || card.querySelector('.cert-issuer')?.textContent?.replace(/^.*?\s/, '') || 'Issuing Organization';
    const category = card.getAttribute('data-cert-category') || card.querySelector('.cert-category')?.textContent || 'Verified Credential';
    const icon = card.getAttribute('data-cert-icon') || 'fa-solid fa-certificate';
    const url = card.getAttribute('data-cert-url') || '';
    const candidateName = window.PORTFOLIO_DATA?.identity?.name || 'Ansh Yadav';

    if (certModalTitle) certModalTitle.textContent = title;
    if (certModalIssuerText) certModalIssuerText.textContent = issuer;
    if (certModalCatBadge) certModalCatBadge.textContent = category;
    if (certPreviewTitle) certPreviewTitle.textContent = title;
    if (certPreviewIssuer) certPreviewIssuer.textContent = issuer;
    if (certPreviewCategory) certPreviewCategory.textContent = category;
    if (certPreviewName) certPreviewName.textContent = candidateName;
    if (certPreviewIcon) certPreviewIcon.innerHTML = `<i class="${icon}"></i>`;

    if (url && (url.startsWith('http') || url.includes('.pdf') || url.includes('.jpg') || url.includes('.png'))) {
      if (certModalIframe) {
        certModalIframe.src = url;
        certModalIframe.style.display = 'block';
      }
      if (certModalLoader) certModalLoader.style.display = 'flex';
    } else {
      if (certModalIframe) {
        certModalIframe.src = '';
        certModalIframe.style.display = 'none';
      }
      if (certModalLoader) certModalLoader.style.display = 'none';
    }

    certModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeCertModal() {
    if (!certModal) return;
    certModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (certModalIframe) certModalIframe.src = '';
  }

  // Bind click anywhere on certificate card
  document.addEventListener('click', (e) => {
    const certCard = e.target.closest('.cert-card');
    if (certCard) {
      e.preventDefault();
      openCertModal(certCard);
    }
  });

  if (certModalClose) certModalClose.addEventListener('click', closeCertModal);
  if (certModalOverlay) certModalOverlay.addEventListener('click', closeCertModal);

  /* ---------- Resume PDF Preview & 1-Click Print Modal ---------- */
  const resumeModal = document.getElementById('resume-modal');
  const resumeModalClose = document.getElementById('resume-modal-close');
  const resumeModalOverlay = document.getElementById('resume-modal-overlay') || (resumeModal ? resumeModal.querySelector('.modal-overlay') : null);
  const resumePrintBtn = document.getElementById('resume-print-btn');

  function openResumeModal() {
    if (!resumeModal) return;
    resumeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeResumeModal() {
    if (!resumeModal) return;
    resumeModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Open resume on hero button & contact card
  const heroResumeBtn = document.getElementById('btn-hero-resume');
  if (heroResumeBtn) {
    heroResumeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openResumeModal();
    });
  }

  const contactResumeCard = document.getElementById('contact-card-resume');
  if (contactResumeCard) {
    contactResumeCard.addEventListener('click', (e) => {
      e.preventDefault();
      openResumeModal();
    });
  }

  document.querySelectorAll('.btn-hero-resume, [data-action="open-resume"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openResumeModal();
    });
  });

  // 1-Click Download / Open PDF CV
  if (resumePrintBtn) {
    resumePrintBtn.addEventListener('click', () => {
      const resumeUrl = window.PORTFOLIO_DATA?.identity?.resumeUrl || 'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/Anupam%20Yadav%20CV.pdf';
      if (resumeUrl && resumeUrl !== '#') {
        window.open(resumeUrl, '_blank');
      } else {
        window.print();
      }
    });
  }

  if (resumeModalClose) resumeModalClose.addEventListener('click', closeResumeModal);
  if (resumeModalOverlay) resumeModalOverlay.addEventListener('click', closeResumeModal);

  // Global escape key to close any active modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCertModal();
      closeResumeModal();
    }
  });

  /* ---------- Subtle Canvas Grain / Dot Grid ---------- */
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h;

    function resizeCanvas() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      drawGrid();
    }

    function drawGrid() {
      ctx.clearRect(0, 0, w, h);
      const spacing = 40;
      const dotSize = 0.8;
      ctx.fillStyle = '#C4B9A8';

      for (let x = spacing; x < w; x += spacing) {
        for (let y = spacing; y < h; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  /* ---------- Smooth scroll for anchor links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        if (window.lenis) {
          window.lenis.scrollTo(target, {
            offset: -80,
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
};

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
    if (!lenisInstance) {
      lenisInstance = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.5,
        infinite: false,
      });
      window.lenis = lenisInstance;

      function raf(time) {
        lenisInstance.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  /* ---------- Navbar Scroll ---------- */
  const navbar = document.getElementById('navbar');
  const sections = document.querySelectorAll('section[id]');

  function handleScroll() {
    const scrollY = window.scrollY;

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
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* ---------- Theme Toggle (Dark / Light) ---------- */
  const themeBtn = document.getElementById('nav-theme-btn');
  const savedTheme = localStorage.getItem('portfolio_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      localStorage.setItem('portfolio_theme', isDark ? 'dark' : 'light');
      themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
  }

  /* ---------- Profile Dropdown Menu & Admin Auth Popup ---------- */
  const profileDropdown = document.getElementById('profile-dropdown-wrapper');
  const profileBtn = document.getElementById('nav-profile-btn');
  const openAdminBtn = document.getElementById('open-admin-auth-btn');
  const authModal = document.getElementById('admin-auth-modal');
  const authClose = document.getElementById('admin-auth-close');
  const authOverlay = document.getElementById('admin-auth-overlay');
  const authForm = document.getElementById('admin-auth-form');
  const authUserInput = document.getElementById('admin-auth-user');
  const authPassInput = document.getElementById('admin-auth-pass');
  const authError = document.getElementById('admin-auth-error');

  function openAdminAuthModal() {
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

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove('open');
      }
    });
  }

  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminAuthModal();
    });
  }

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
    hamburger.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    // Close on link click
    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        navMenu.classList.remove('open');
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
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const heroH = window.innerHeight;
          if (scrollY < heroH) {
            const progress = scrollY / heroH;
            heroBgArt.style.transform = `translateY(${progress * 40}px)`;
            heroBgArt.style.opacity = 1 - progress * 0.5;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
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

  /* ---------- Certificate Modal ---------- */
  const modal = document.getElementById('cert-modal');
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = modal ? modal.querySelector('.modal-overlay') : null;
  const modalTitle = document.getElementById('modal-title');
  const modalIssuer = document.getElementById('modal-issuer');
  const modalIframe = document.getElementById('modal-iframe');
  const modalLink = document.getElementById('modal-link');
  const modalLoader = document.getElementById('modal-loader');

  document.querySelectorAll('.view-cert-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!modal) return;
      const card = btn.closest('.cert-card');
      const title = card.querySelector('.cert-content h3')?.textContent || '';
      const issuer =
        card.querySelector('.cert-issuer')?.textContent?.replace(/^.*?\s/, '') || '';
      const url = card.getAttribute('data-cert-url') || '';

      if (modalTitle) modalTitle.textContent = title;
      if (modalIssuer) modalIssuer.textContent = issuer;
      if (modalLoader) modalLoader.style.display = 'flex';
      if (modalIframe) modalIframe.src = url || '';
      if (modalLink) modalLink.href = url || '#';

      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (modalIframe) modalIframe.src = '';
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
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

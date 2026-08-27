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

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

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

  /* ---------- Intersection Observer – Fade-in Sections ---------- */
  const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px',
  };

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, observerOptions);

  document
    .querySelectorAll(
      '.fade-in-section, .skill-category, .timeline-item, .project-card, .cert-card'
    )
    .forEach((el) => {
      el.classList.remove('is-visible');
      fadeObserver.observe(el);
    });

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
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
};

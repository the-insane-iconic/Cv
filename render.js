/* ================================================================
   RENDER.JS — Portfolio Content Engine with Supabase Sync
   Reads data from Supabase (with instant localStorage cache fallback),
   populates every DOM section, dynamically handles dynamic item counts
   and section visibility without layout glitches.
   ================================================================ */

(async function () {
  'use strict';

  const STORAGE_KEY = 'portfolio_data';

  /* ---- 1. Load data from Supabase / localStorage / portfolio.json ---- */
  async function loadData() {
    let fileData = null;
    try {
      const res = await fetch('./portfolio.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        fileData = await res.json();
      }
    } catch (e) {
      console.warn('[File Fetch Warning]', e);
    }    function sanitizeLegacyData(target) {
      if (!target || !fileData) return;
      if (Array.isArray(target.skills)) {
        const hasLegacyCyber = target.skills.some(c => 
          (c.category && /cyber/i.test(c.category)) ||
          (c.items && c.items.some(it => /nmap|wireshark|burp|metasploit|hydra/i.test(it.name)))
        );
        if (hasLegacyCyber && fileData.skills) {
          target.skills = fileData.skills;
        }
      }
      if (Array.isArray(target.stats)) {
        const hasLegacyStats = target.stats.some(s => 
          /hackerrank|ctf/i.test(s.label || '') ||
          s.value === 110 || s.value === 200
        );
        if (hasLegacyStats && fileData.stats) {
          target.stats = fileData.stats;
        }
      }
    }

    let localData = null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { localData = JSON.parse(stored); } catch (e) { /* continue */ }
    }    // Attempt to fetch from Supabase if initialized
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb) {
      try {
        const { data, error } = await sb
          .from('portfolios')
          .select('content')
          .eq('id', 'default')
          .single();

        if (!error && data && data.content) {
          const dbData = data.content;
          // Merge missing top-level schema keys only
          if (fileData) {
            for (const key of Object.keys(fileData)) {
              if (dbData[key] === undefined) {
                dbData[key] = fileData[key];
              }
            }
          }
          sanitizeLegacyData(dbData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData));
          return dbData;
        }
      } catch (err) {
        console.warn('[Supabase Fetch Warning]', err.message);
      }
    }

    // Merge file updates with localStorage if local cache is missing new keys
    if (localData) {
      if (fileData) {
        for (const key of Object.keys(fileData)) {
          if (localData[key] === undefined) {
            localData[key] = fileData[key];
          }
        }
      }
      sanitizeLegacyData(localData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      return localData;
    }

    if (fileData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData));
      return fileData;
    }

    return {};
  }

  /* ---- 2. Helpers ---------------------------------------------- */
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text || '';
  }

  function toggleSectionVisibility(sectionId, isVisible) {
    const sec = document.getElementById(sectionId);
    const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
    if (sec) sec.style.display = isVisible ? '' : 'none';
    if (navLink) navLink.style.display = isVisible ? '' : 'none';
  }

  /* ---- 3. Section renderers ------------------------------------ */

  function renderMeta(d) {
    const name = d.identity?.name || 'Portfolio';
    document.title = `${esc(name)} | Portfolio`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && d.identity?.roles) {
      metaDesc.setAttribute('content', `${name} — ${d.identity.roles.join(', ')}`);
    }
  }

  function renderNav(d) {
    const logo = document.querySelector('.nav-logo');
    if (logo) {
      const brand = d.identity?.brand || d.identity?.name || 'Portfolio';
      const suffix = d.identity?.brandSuffix || '';
      const prefix = suffix ? brand.replace(suffix, '') : brand;
      logo.innerHTML = esc(prefix) + (suffix ? `<span>${esc(suffix)}</span>` : '');
      logo.href = '#hero';
    }

    // Dynamic Profile Avatar & Zoom Modal
    const profileImgSrc = d.identity?.profileImage || (d.identity?.profileImages && d.identity.profileImages[0]) || 'pfp.png';
    const navAvatar = document.getElementById('nav-profile-avatar');
    if (navAvatar && profileImgSrc) {
      navAvatar.src = profileImgSrc;
    }
    const zoomImg = document.getElementById('profile-zoom-img');
    if (zoomImg && profileImgSrc) {
      zoomImg.src = profileImgSrc;
    }
    const zoomName = document.getElementById('profile-zoom-name');
    if (zoomName && d.identity?.name) {
      zoomName.textContent = d.identity.name;
    }
    const zoomRole = document.getElementById('profile-zoom-role');
    if (zoomRole) {
      zoomRole.textContent = (d.identity?.roles && d.identity.roles[0]) ? d.identity.roles[0] : (d.identity?.tagline || 'AI/ML Engineer');
    }
    const zoomResume = document.getElementById('profile-zoom-resume-btn');
    if (zoomResume) {
      if (d.identity?.resumeUrl) {
        zoomResume.href = d.identity.resumeUrl;
        zoomResume.style.display = 'inline-flex';
      } else {
        zoomResume.style.display = 'none';
      }
    }
  }

  function renderHero(d) {
    const id = d.identity || {};
    toggleSectionVisibility('hero', d.sectionVisibility?.hero !== false);

    setText('.hero-greeting', id.greeting || "H I , &nbsp; I ' M");

    const rolePill = document.getElementById('hero-pill-role');
    if (rolePill) {
      rolePill.textContent = (id.roles && id.roles[0]) ? id.roles[0] : 'AI/ML Engineer · Computer Science Student';
    }

    const nameEl = document.querySelector('.hero-name');
    if (nameEl) {
      const full = (id.name || 'Ansh Yadav').trim();
      const parts = full.split(' ');
      const strokeSvg = `<svg class="hero-brush-stroke" viewBox="0 0 170 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 8C35 4 110 3 164 7C125 9 60 11 6 12" stroke="url(#brushGradient)" stroke-width="6" stroke-linecap="round"/><defs><linearGradient id="brushGradient" x1="4" y1="6" x2="164" y2="6" gradientUnits="userSpaceOnUse"><stop stop-color="#8C7AFF" stop-opacity="0.8"/><stop offset="0.5" stop-color="#C5BCFF" stop-opacity="0.9"/><stop offset="1" stop-color="#5A45FF" stop-opacity="0.3"/></linearGradient></defs></svg>`;
      if (parts.length > 1) {
        const first = parts.slice(0, -1).join(' ');
        const last = parts[parts.length - 1];
        nameEl.innerHTML = `<span class="hero-name-first">${esc(first)}${strokeSvg}</span> <span class="hero-name-last">${esc(last)}<span class="dot-accent">.</span></span>`;
      } else {
        nameEl.innerHTML = `<span class="hero-name-first">${esc(full)}${strokeSvg}</span><span class="dot-accent">.</span>`;
      }
    }

    const descEl = document.querySelector('.hero-description');
    if (descEl) {
      if (id.introParagraphs && Array.isArray(id.introParagraphs) && id.introParagraphs.length > 0) {
        descEl.innerHTML = id.introParagraphs.map(p => `<p class="hero-intro-p">${p}</p>`).join('');
      } else if (id.tagline) {
        descEl.innerHTML = `<p class="hero-intro-p">${id.tagline}</p>`;
      }
    }

    const resumeBtn = document.querySelector('.btn-hero-resume') || document.querySelector('.hero-cta .btn-outline');
    if (resumeBtn) {
      if (id.resumeUrl) {
        resumeBtn.href = id.resumeUrl;
        resumeBtn.style.display = '';
      } else {
        resumeBtn.style.display = 'none';
      }
    }

    const heroSocials = document.querySelector('.social-links-hero');
    if (heroSocials && d.socials) {
      heroSocials.innerHTML = buildSocialLinks(d.socials);
    }

    // Highlight active skills if present
    const badges = document.querySelectorAll('.hero-badge');
    badges.forEach((b, i) => {
      if (id.badges && id.badges[i]) {
        b.textContent = id.badges[i];
      }
    });

    window.PORTFOLIO_ROLES = id.roles || [];
  }

  function buildSocialLinks(socials) {
    const links = [
      { key: 'github', icon: 'fa-brands fa-github', label: 'GitHub', href: socials.github },
      { key: 'linkedin', icon: 'fa-brands fa-linkedin-in', label: 'LinkedIn', href: socials.linkedin },
      { key: 'email', icon: 'fa-solid fa-envelope', label: 'Email', href: socials.email ? `mailto:${socials.email}` : '' },
      { key: 'leetcode', icon: 'fa-solid fa-code', label: 'LeetCode', href: socials.leetcode },
    ];
    return links
      .filter(l => l.href && l.href.trim() !== '')
      .map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(l.label)}">
        <i class="${esc(l.icon)}"></i>
      </a>`).join('');
  }

  function renderAbout(d) {
    const ab = d.about || {};
    const textEl = document.querySelector('.about-text');
    if (!textEl) return;

    const hasContent = (ab.items && ab.items.length > 0) || (ab.paragraphs && ab.paragraphs.length > 0) || (ab.chips && ab.chips.length > 0);
    toggleSectionVisibility('about', d.sectionVisibility?.about !== false && hasContent);

    // Eyebrow update if configured
    const eyebrowEl = document.querySelector('.about-eyebrow');
    if (eyebrowEl && ab.eyebrow) {
      eyebrowEl.textContent = ab.eyebrow;
    }

    // Manifesto headline with vertical accent bar
    const defaultManifesto = `A curious <span class="text-accent">learner</span>.<br>A problem <span class="text-accent">solver</span>.<br>A <span class="text-accent">builder</span> of impactful solutions.`;
    const manifestoHtml = `
      <div class="about-manifesto">
        <div class="manifesto-bar"></div>
        <h3 class="manifesto-heading">${ab.manifesto || defaultManifesto}</h3>
      </div>`;

    // Narrative list items with circle icons
    const defaultIcons = ['fa-regular fa-user', 'fa-solid fa-bullseye', 'fa-solid fa-rocket'];
    let itemsList = [];
    if (Array.isArray(ab.items) && ab.items.length > 0) {
      itemsList = ab.items;
    } else if (Array.isArray(ab.paragraphs) && ab.paragraphs.length > 0) {
      itemsList = ab.paragraphs.map((p, idx) => ({
        icon: defaultIcons[idx % defaultIcons.length],
        text: p
      }));
    }

    const narrativeHtml = itemsList.length > 0 ? `
      <div class="about-narrative-list">
        ${itemsList.map(item => `
          <div class="about-narrative-item">
            <div class="about-item-icon">
              <i class="${esc(item.icon || 'fa-solid fa-circle-check')}"></i>
            </div>
            <div class="about-item-content">
              <p>${item.text}</p>
            </div>
          </div>
        `).join('')}
      </div>` : '';

    // Chips
    const chips = (ab.chips || []).map(c =>
      `<span class="chip"><i class="${esc(c.icon)}${c.class ? ' ' + c.class : ''}"></i> ${esc(c.label)}</span>`
    ).join('');

    textEl.innerHTML = manifestoHtml +
      narrativeHtml +
      (chips ? `<div class="about-stats-chips">${chips}</div>` : '');

    // Render Gamma-style vertical auto-scroll card carousel
    const mount = document.getElementById('about-image-mount');
    if (!mount) return;

    const SAMPLE_IMAGES = [
      'pfp.png',
      'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/2nd.png',
      'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/03.png',
      'https://eikxrpaakhhmpgtjrlhq.supabase.co/storage/v1/object/public/projeect%20images/4th.png'
    ];

    let rawImages = (d.identity?.profileImages && d.identity.profileImages.length > 0)
      ? d.identity.profileImages
      : (d.identity?.profileImage ? [d.identity.profileImage] : []);

    let images = rawImages.filter(img => img && (
      img.startsWith('http') || 
      img.startsWith('data:') || 
      img.includes('/') || 
      /\.(png|jpg|jpeg|webp)/i.test(img)
    ));
    if (images.length === 0) {
      images = SAMPLE_IMAGES;
    }

    // Vibrant gradient + icon cards
    const CARD_THEMES = [
      { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: 'fa-solid fa-brain', label: 'AI & LLMs' },
      { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: 'fa-solid fa-microchip', label: 'Deep Learning' },
      { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: 'fa-solid fa-code', label: 'Full-Stack Dev' },
      { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: 'fa-solid fa-database', label: 'RAG & Data' },
      { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: 'fa-solid fa-rocket', label: 'Innovation' },
    ];

    const baseCount = images.length;

    // Triple-duplicate for seamless infinite scroll
    const allCards = [...Array(baseCount), ...Array(baseCount), ...Array(baseCount)].map((_, idx) => {
      const srcIdx = idx % baseCount;
      const theme = CARD_THEMES[srcIdx % CARD_THEMES.length];
      const imgSrc = images.length > 0 ? images[srcIdx] : null;
      return { imgSrc, theme };
    });

    // Eagerly preload all images so every upcoming card is already waiting in memory
    images.forEach(src => {
      if (src) {
        const pre = new Image();
        pre.src = src;
      }
    });

    const cardsHtml = allCards.map(({ imgSrc, theme }, idx) => {
      const imgTag = imgSrc
        ? `<img src="${esc(imgSrc)}" alt="Portfolio Showcase" loading="eager" decoding="sync" onerror="this.remove();">` 
        : '';
      return `
        <div class="about-carousel-card" data-index="${idx}" style="background:${theme.gradient};">
          ${imgTag}
          <div class="about-card-bg-icon">
            <i class="${theme.icon}"></i>
            <span>${theme.label}</span>
          </div>
        </div>`;
    }).join('');

    // Clear old track content but keep the fade masks (already in HTML)
    const existingFades = Array.from(mount.querySelectorAll('.about-carousel-fade'));
    mount.innerHTML = '';
    existingFades.forEach(f => mount.appendChild(f));

    const track = document.createElement('div');
    track.className = 'about-carousel-track';
    track.id = 'about-carousel-track';
    track.innerHTML = cardsHtml;
    mount.appendChild(track);

    initAboutCarousel(baseCount);
  }

  function initAboutCarousel(baseCount) {
    if (window._aboutCarouselTimer) {
      clearInterval(window._aboutCarouselTimer);
      window._aboutCarouselTimer = null;
    }

    const track = document.getElementById('about-carousel-track');
    const wrapper = track ? track.closest('.about-carousel-track-wrapper') : null;
    if (!track || !wrapper) return;

    const cards = track.querySelectorAll('.about-carousel-card');
    if (!cards.length) return;

    const GAP = 24;
    function isHorizontal() {
      return window.innerWidth <= 900;
    }

    function getStep() {
      const card = track.querySelector('.about-carousel-card');
      if (isHorizontal()) {
        return (card ? card.offsetWidth : 260) + 14;
      }
      return (card ? card.offsetHeight : 420) + GAP;
    }

    let currentIndex = 0;

    function setFocused(idx) {
      cards.forEach((c, i) => {
        if (i === idx) {
          c.classList.add('is-focused');
        } else {
          c.classList.remove('is-focused');
        }
      });
    }

    // Initialize: Center card at step 0 is index 1
    setFocused(1);

    let isPaused = false;
    wrapper.addEventListener('mouseenter', () => { isPaused = true; });
    wrapper.addEventListener('mouseleave', () => { isPaused = false; });
    wrapper.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
    wrapper.addEventListener('touchend', () => { isPaused = false; }, { passive: true });

    function rollNext() {
      if (isPaused) return;

      currentIndex++;
      const step = getStep();
      const offset = currentIndex * step;

      track.style.transition = 'transform 0.85s cubic-bezier(0.33, 1, 0.68, 1)';
      if (isHorizontal()) {
        track.style.transform = `translateX(-${offset}px)`;
      } else {
        track.style.transform = `translateY(-${offset}px)`;
      }
      setFocused(currentIndex + 1);

      // When we reach the end of the second set (baseCount * 2), smoothly reset back to first set (baseCount) after animation finishes
      if (currentIndex >= baseCount * 2) {
        setTimeout(() => {
          track.style.transition = 'none';
          currentIndex = baseCount;
          if (isHorizontal()) {
            track.style.transform = `translateX(-${currentIndex * step}px)`;
          } else {
            track.style.transform = `translateY(-${currentIndex * step}px)`;
          }
          setFocused(currentIndex + 1);
          void track.offsetHeight; // force reflow
        }, 900);
      }
    }

    // Reset transform on resize if orientation changes
    let lastIsHoriz = isHorizontal();
    window.addEventListener('resize', () => {
      const currentIsHoriz = isHorizontal();
      if (currentIsHoriz !== lastIsHoriz) {
        lastIsHoriz = currentIsHoriz;
        track.style.transition = 'none';
        currentIndex = 0;
        track.style.transform = currentIsHoriz ? 'translateX(0)' : 'translateY(0)';
        setFocused(1);
      }
    });

    window._aboutCarouselTimer = setInterval(rollNext, 2400);
  }

  function renderSkills(d) {
    const floatWrap = document.querySelector('.floating-icons');
    if (floatWrap && d.floatingIcons) {
      floatWrap.innerHTML = d.floatingIcons.map(fi =>
        `<i class="${esc(fi.icon)} ${esc(fi.class)}"></i>`
      ).join('');
    }

    const grid = document.querySelector('.skills-grid');
    if (!grid) return;

    const skills = d.skills || [];
    toggleSectionVisibility('skills', d.sectionVisibility?.skills !== false && skills.length > 0);

    grid.setAttribute('data-count', skills.length);

    grid.innerHTML = skills.map((cat, ci) => {
      const delay = (ci % 3) * 0.15;
      const items = (cat.items || []).map(sk => `
        <div class="skill-item${sk.active ? ' active-glow' : ''}">
          <div class="skill-info">
            <span><i class="${esc(sk.icon)}"></i> ${esc(sk.name)}</span>
            <span>${esc(String(sk.level))}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" data-width="${esc(String(sk.level))}%" style="width:${esc(String(sk.level))}%;"></div>
          </div>
        </div>`).join('');

      return `<div class="skill-category" style="transition-delay:${delay}s;">
        <h3><i class="${esc(cat.icon)}"></i> ${esc(cat.category)}</h3>
        ${items}
      </div>`;
    }).join('');
  }

  function renderExperience(d) {
    const sec = document.getElementById('experience');
    if (!sec) return;

    const exps = d.experience || [];
    toggleSectionVisibility('experience', d.sectionVisibility?.experience !== false && exps.length > 0);

    const timeline = sec.querySelector('.experience-timeline');
    if (!timeline) return;

    const defaultNodeIcons = ['brain', 'cpu', 'sparkles', 'bot', 'layers', 'network'];

    function cleanLucideIcon(ic) {
      if (!ic) return 'brain';
      return String(ic)
        .replace(/^fa-(solid|brands|regular)\s+fa-/, '')
        .replace(/^fa-/, '')
        .replace(/^lucide-/, '')
        .trim();
    }

    const itemsHtml = exps.map((exp, index) => {
      const type = (exp.type || 'Freelance').toLowerCase().trim();
      const nodeIcon = cleanLucideIcon(exp.icon || defaultNodeIcons[index % defaultNodeIcons.length]);
      const jobIcon = cleanLucideIcon(exp.jobIcon || exp.icon || 'brain-circuit');
      const isCurrent = exp.current === true || exp.isCurrent === true || (exp.date && /present/i.test(exp.date));

      // Metrics normalization
      let metricsList = [];
      if (Array.isArray(exp.metrics) && exp.metrics.length > 0) {
        metricsList = exp.metrics.map((m, mIdx) => {
          if (typeof m === 'object' && m !== null) {
            return {
              num: m.val || m.number || m.num || m.value || '100+',
              lbl: m.lbl || m.label || 'Metric',
              icon: cleanLucideIcon(m.icon || (mIdx === 0 ? 'chart-no-axes-combined' : mIdx === 1 ? 'database' : 'badge-check'))
            };
          }
          return { num: String(m), lbl: '', icon: 'activity' };
        });
      } else if (Array.isArray(exp.bullets)) {
        metricsList = exp.bullets.slice(0, 3).map((b, bIdx) => {
          const numMatch = String(b).match(/class=["']highlight-number["']>([^<]+)</i) || String(b).match(/(\d+[\d\.,\+kK%]*)/);
          const num = numMatch ? numMatch[1] : (bIdx === 0 ? '1.2K+' : bIdx === 1 ? '1K+' : '300+');
          const cleanText = String(b).replace(/<[^>]*>/g, '').trim();
          const lbl = cleanText.length > 24 ? cleanText.substring(0, 22) + '...' : cleanText;
          return {
            num: num,
            lbl: lbl,
            icon: bIdx === 0 ? 'chart-no-axes-combined' : bIdx === 1 ? 'database' : 'badge-check'
          };
        });
      }

      const metricsHtml = metricsList.length > 0 ? `
        <div class="metrics">
          ${metricsList.map(m => `
            <div class="metric">
              <div class="metric-icon">
                <i data-lucide="${esc(m.icon)}"></i>
              </div>
              <div>
                <strong class="metric-number">${esc(m.num)}</strong>
                <span class="metric-label">${esc(m.lbl)}</span>
              </div>
            </div>
          `).join('')}
        </div>` : '';

      // Contributions / bullets normalization
      let contribsList = [];
      if (Array.isArray(exp.contributions) && exp.contributions.length > 0) {
        contribsList = exp.contributions.map(c => (typeof c === 'string' ? c : c.text || ''));
      } else if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
        contribsList = exp.bullets.map(b => String(b).replace(/<[^>]*>/g, ''));
      }

      const contribsHtml = contribsList.length > 0 ? `
        <div class="contributions">
          ${contribsList.map(c => `
            <div class="contribution">
              <i data-lucide="check"></i>
              <span>${esc(c)}</span>
            </div>
          `).join('')}
        </div>` : '';

      // 3D Visual graphics
      const visualType = exp.visual || (index % 2 === 0 ? 'ai-stack' : 'model-visual');
      let visualHtml = '';
      if (visualType === 'model-visual') {
        visualHtml = `
          <div class="experience-visual">
            <div class="visual-orbit"></div>
            <div class="visual-orbit visual-orbit-2"></div>
            <div class="model-platform-visual">
              <div class="model-cube">
                <div class="cube-face cube-front"><i data-lucide="cpu"></i></div>
                <div class="cube-face cube-top"><span>ML</span></div>
                <div class="cube-face cube-back"></div>
              </div>
            </div>
          </div>`;
      } else {
        visualHtml = `
          <div class="experience-visual">
            <div class="visual-orbit"></div>
            <div class="visual-orbit visual-orbit-2"></div>
            <div class="ai-stack">
              <div class="ai-layer"></div>
              <div class="ai-layer"></div>
              <div class="ai-layer"></div>
              <div class="ai-core">
                <span>AI</span>
              </div>
            </div>
          </div>`;
      }

      return `
        <article class="experience-item" data-type="${esc(type)}">
          <div class="timeline-node">
            <i data-lucide="${esc(nodeIcon)}"></i>
          </div>
          <div class="experience-card">
            <div class="experience-main">
              <div class="job-header">
                <div class="job-icon">
                  <i data-lucide="${esc(jobIcon)}"></i>
                </div>
                <div class="job-info">
                  <h3 class="job-title">${esc(exp.title || 'Role')}</h3>
                  <div class="job-meta">
                    <span class="company">${esc(exp.company || '')}</span>
                    <span class="separator">•</span>
                    <span class="employment">${esc(exp.type || 'Freelance')}</span>
                    ${exp.date ? `<span class="separator">•</span><span class="date">${esc(exp.date)}</span>` : ''}
                  </div>
                </div>
              </div>
              ${isCurrent ? '<div class="current-badge">Current</div>' : ''}
              ${metricsHtml}
              ${contribsHtml}
            </div>
            ${visualHtml}
          </div>
        </article>`;
    }).join('');

    timeline.innerHTML = `<div class="timeline-line" aria-hidden="true"></div>` + itemsHtml;

    // Filter clicks
    const filterButtons = sec.querySelectorAll('.experience-filters .filter-btn');
    const experienceItems = sec.querySelectorAll('.experience-item');

    filterButtons.forEach(button => {
      button.onclick = () => {
        const filter = (button.dataset.filter || 'all').toLowerCase();
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        experienceItems.forEach(item => {
          const type = (item.dataset.type || '').toLowerCase();
          if (filter === 'all' || type === filter || (filter === 'freelance' && type.includes('freelance')) || (filter === 'internship' && type.includes('intern')) || (filter === 'part-time' && (type.includes('part') || type.includes('contract')))) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      };
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function renderProjects(d) {
    const grid = document.getElementById('projectGrid');
    const noResults = document.getElementById('noResults');
    if (!grid) return;

    const projs = d.projects || [];
    toggleSectionVisibility('projects', d.sectionVisibility?.projects !== false && projs.length > 0);

    function typeIcon(type) {
      if (type === 'hardware') return 'cpu';
      if (type === 'tool') return 'wrench';
      return 'globe';
    }

    function defaultStatIcon(idx) {
      const icons = ['gauge', 'zap', 'activity', 'layers', 'book-open', 'bot', 'cloud', 'shield-check', 'wifi-off', 'radar', 'navigation', 'battery-charging', 'trending-up', 'wifi', 'bell', 'users', 'bar-chart-3', 'target'];
      return icons[idx % icons.length];
    }

    function renderFiltered(filter = 'all') {
      grid.innerHTML = '';
      const filtered = filter === 'all'
        ? projs
        : projs.filter(p => (p.type || '').toLowerCase() === filter.toLowerCase());

      if (!filtered.length) {
        if (noResults) noResults.style.display = 'block';
        return;
      }
      if (noResults) noResults.style.display = 'none';

      filtered.forEach((project, index) => {
        const card = document.createElement('article');
        card.className = 'project-card';
        card.style.animationDelay = `${index * 60}ms`;

        // Normalize stats
        let statsList = [];
        if (Array.isArray(project.stats)) {
          statsList = project.stats.map((s, sIdx) => {
            if (Array.isArray(s)) {
              return { val: s[0], lbl: s[1], icon: defaultStatIcon(sIdx) };
            } else if (typeof s === 'object' && s !== null) {
              return { val: s.value || s.val || '', lbl: s.label || s.lbl || '', icon: s.icon || defaultStatIcon(sIdx) };
            }
            return { val: String(s), lbl: '', icon: defaultStatIcon(sIdx) };
          });
        }

        const statsHtml = statsList.map(stat => `
          <div class="stat-item">
            <i data-lucide="${esc(stat.icon)}" class="stat-icon"></i>
            <div class="stat-item-text">
              <strong>${esc(stat.val)}</strong>
              <span>${esc(stat.lbl)}</span>
            </div>
          </div>
        `).join('');

        const techHtml = Array.isArray(project.tech) ? project.tech.map(tech => `
          <span class="tech">${esc(tech)}</span>
        `).join('') : '';

        const githubLink = project.github
          ? `<a class="action-icon-link" href="${esc(project.github)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i data-lucide="github"></i></a>`
          : '';

        const demoLink = project.demo
          ? `<a class="action-icon-link" href="${esc(project.demo)}" target="_blank" rel="noopener noreferrer" aria-label="Live Demo"><i data-lucide="external-link"></i></a>`
          : '';

        card.innerHTML = `
          <div class="project-image">
            <img src="${esc(project.image)}" alt="${esc(project.title)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80';">
            <div class="project-type">
              <i data-lucide="${typeIcon(project.type)}"></i>
              ${esc(project.typeLabel || (project.type ? project.type.toUpperCase() : 'WEB APP'))}
            </div>
          </div>

          <div class="project-body">
            <h3 class="project-title">${esc(project.title)}</h3>
            <p class="project-description">${esc(project.description)}</p>

            ${statsHtml ? `<div class="project-stats">${statsHtml}</div>` : ''}

            <div class="card-footer">
              <div class="tech-stack">
                ${techHtml}
              </div>
              <div class="project-actions">
                ${githubLink}
                ${demoLink}
              </div>
            </div>
          </div>
        `;

        grid.appendChild(card);
      });

      if (window.lucide) {
        lucide.createIcons();
      }
    }

    // Bind filter buttons
    const filterButtons = document.querySelectorAll('.filters .filter');
    filterButtons.forEach(button => {
      button.onclick = () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderFiltered(button.dataset.filter);
      };
    });

    renderFiltered('all');
  }

  function renderStats(d) {
    const grid = document.querySelector('.stats-grid');
    if (!grid) return;

    const stats = d.stats || [];
    grid.style.display = stats.length > 0 ? '' : 'none';

    grid.innerHTML = stats.map((s, i) => {
      const featured = i === 0 ? ' target-badge' : '';
      if (s.isText) {
        return `
        <div class="stat-card badge${featured}">
          <i class="${esc(s.icon)} badge-icon${s.iconClass ? ' ' + s.iconClass : ''}"></i>
          <h3 class="stat-number stat-text">${esc(s.suffix)}</h3>
          <p>${esc(s.label)}</p>
        </div>`;
      }
      return `
      <div class="stat-card badge${featured}">
        <i class="${esc(s.icon)} badge-icon${s.iconClass ? ' ' + s.iconClass : ''}"></i>
        <h3 class="stat-number"><span data-target="${s.value}">${s.value}</span>${esc(s.suffix || '')}</h3>
        <p>${esc(s.label)}</p>
      </div>`;
    }).join('');
  }

  function renderCertificates(d) {
    const certs = d.certificates || [];
    const hasCerts = certs.length > 0;
    const stats = d.stats || [];

    toggleSectionVisibility('achievements', d.sectionVisibility?.achievements !== false && (hasCerts || stats.length > 0));

    const filterWrap = document.getElementById('cert-filters');
    if (filterWrap) {
      filterWrap.innerHTML = (d.certCategories || ['All']).map((cat, i) =>
        `<button class="filter-btn${i === 0 ? ' active' : ''}" data-filter="${esc(cat)}">${esc(cat)}</button>`
      ).join('');
    }

    const certGrid = document.getElementById('cert-grid');
    if (!certGrid) return;

    certGrid.innerHTML = certs.map((cert, i) => {
      const delay = (i % 12) * 0.05;
      const featured = cert.featured ? ' featured' : '';
      return `
      <div class="cert-card fade-up${featured}" style="animation-delay:${delay}s;" data-cert-url="${esc(cert.url || '')}" data-cert-title="${esc(cert.title)}" data-cert-issuer="${esc(cert.issuer)}" data-cert-category="${esc(cert.category)}" data-cert-icon="${esc(cert.icon)}">
        <div class="cert-header">
          <div class="cert-icon-lg"><i class="${esc(cert.icon)}"></i></div>
          <span class="cert-category" data-cat="${esc(cert.category)}">${esc(cert.category)}</span>
        </div>
        <div class="cert-content">
          <h3>${esc(cert.title)}</h3>
          <p class="cert-issuer"><i class="fa-solid fa-certificate"></i> ${esc(cert.issuer)}</p>
        </div>
        <div class="cert-footer">
          <span class="view-cert-btn">Preview <i class="fa-solid fa-eye"></i></span>
        </div>
      </div>`;
    }).join('');
  }

  function renderResume(d) {
    const resumeEl = document.getElementById('resume-document');
    if (!resumeEl) return;

    const id = d.identity || {};
    const socials = d.socials || {};
    const contact = d.contact || {};
    const skills = d.skills || [];
    const exps = d.experience || [];
    const projs = d.projects || [];
    const certs = d.certificates || [];

    const name = id.name || 'Ansh Yadav';
    const roles = Array.isArray(id.roles) ? id.roles.join(' • ') : (id.roles || 'AI/ML Engineer & Full-Stack Developer');
    const email = socials.email || 'anupamyadav6477@gmail.com';
    const phone = contact.phone || '+91 8707726019';
    const linkedin = socials.linkedin || 'https://www.linkedin.com/in/ansh-ydv';
    const github = socials.github || 'https://github.com/the-insane-iconic';
    const leetcode = socials.leetcode || 'https://leetcode.com/u/ZSiFPFw1Gd/';

    // Skills breakdown
    const skillsHtml = skills.map(cat => {
      const names = (cat.items || []).map(it => it.name).join(', ');
      return `<div class="resume-skill-row">
        <strong class="resume-skill-cat">${esc(cat.category)}:</strong>
        <span class="resume-skill-list">${esc(names)}</span>
      </div>`;
    }).join('');

    // Experience breakdown
    const expHtml = exps.map(exp => {
      const contribs = (exp.contributions || exp.bullets || []).map(c => {
        const clean = typeof c === 'string' ? c.replace(/<[^>]*>/g, '') : (c.text || '');
        return `<li>${esc(clean)}</li>`;
      }).join('');

      return `
      <div class="resume-item">
        <div class="resume-item-header">
          <div>
            <strong class="resume-item-title">${esc(exp.title || 'Role')}</strong>
            <span class="resume-item-company"> — ${esc(exp.company || '')}</span>
          </div>
          <span class="resume-item-date">${esc(exp.date || exp.type || '')}</span>
        </div>
        ${contribs ? `<ul class="resume-item-bullets">${contribs}</ul>` : ''}
      </div>`;
    }).join('');

    // Projects breakdown
    const projHtml = projs.slice(0, 3).map(p => {
      const tech = Array.isArray(p.tech) ? p.tech.join(', ') : '';
      return `
      <div class="resume-item">
        <div class="resume-item-header">
          <div>
            <strong class="resume-item-title">${esc(p.title)}</strong>
            ${tech ? `<span class="resume-item-tech"> [${esc(tech)}]</span>` : ''}
          </div>
          ${p.typeLabel ? `<span class="resume-item-date">${esc(p.typeLabel)}</span>` : ''}
        </div>
        <p class="resume-item-desc">${esc(p.description)}</p>
      </div>`;
    }).join('');

    // Certifications breakdown
    const certHtml = certs.slice(0, 6).map(c => 
      `<div class="resume-cert-item"><strong>${esc(c.title)}</strong> <span class="resume-cert-issuer">(${esc(c.issuer)})</span></div>`
    ).join('');

    resumeEl.innerHTML = `
      <header class="resume-header">
        <h1 class="resume-name">${esc(name)}</h1>
        <div class="resume-headline">${esc(roles)}</div>
        <div class="resume-contacts">
          <a href="mailto:${esc(email)}"><i class="fa-regular fa-envelope"></i> ${esc(email)}</a>
          <span>•</span>
          <a href="tel:${esc(phone.replace(/\s/g, ''))}"><i class="fa-solid fa-phone"></i> ${esc(phone)}</a>
          <span>•</span>
          <a href="${esc(linkedin)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-linkedin"></i> LinkedIn</a>
          <span>•</span>
          <a href="${esc(github)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github"></i> GitHub</a>
          <span>•</span>
          <a href="${esc(leetcode)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-code"></i> LeetCode</a>
        </div>
      </header>

      <section class="resume-section">
        <h2 class="resume-section-title">Professional Summary</h2>
        <div class="resume-divider"></div>
        <p class="resume-summary-p">
          Passionate AI/ML and Computer Science Engineer specializing in Large Language Models (LLMs), deep learning, computer vision, and scalable intelligent web systems. Proven experience designing RAG architectures, model fine-tuning, latency optimization, and robust full-stack software development.
        </p>
      </section>

      <section class="resume-section">
        <h2 class="resume-section-title">Technical Expertise</h2>
        <div class="resume-divider"></div>
        <div class="resume-skills-grid">
          ${skillsHtml}
        </div>
      </section>

      <section class="resume-section">
        <h2 class="resume-section-title">Professional Experience</h2>
        <div class="resume-divider"></div>
        <div class="resume-experience-list">
          ${expHtml}
        </div>
      </section>

      <section class="resume-section">
        <h2 class="resume-section-title">Featured Projects</h2>
        <div class="resume-divider"></div>
        <div class="resume-projects-list">
          ${projHtml}
        </div>
      </section>

      <section class="resume-section">
        <h2 class="resume-section-title">Certifications &amp; Achievements</h2>
        <div class="resume-divider"></div>
        <div class="resume-certs-grid">
          ${certHtml}
        </div>
      </section>
    `;
  }

  function renderContact(d) {
    const ct = d.contact || {};
    const socials = d.socials || {};
    const id = d.identity || {};

    toggleSectionVisibility('contact', d.sectionVisibility?.contact !== false);

    // Email card
    const emailCard = document.getElementById('contact-card-email');
    const emailVal = document.getElementById('contact-val-email');
    if (emailCard && socials.email) {
      emailCard.href = `mailto:${socials.email}`;
      if (emailVal) emailVal.textContent = socials.email;
    }

    // Phone card
    const phoneCard = document.getElementById('contact-card-phone');
    const phoneVal = document.getElementById('contact-val-phone');
    if (phoneCard) {
      if (ct.phone) {
        phoneCard.href = `tel:${ct.phone.replace(/\s/g, '')}`;
        if (phoneVal) phoneVal.textContent = ct.phone;
        phoneCard.style.display = '';
      } else {
        phoneCard.style.display = 'none';
      }
    }

    // LinkedIn card
    const linkedinCard = document.getElementById('contact-card-linkedin');
    const linkedinVal = document.getElementById('contact-val-linkedin');
    if (linkedinCard) {
      if (socials.linkedin) {
        linkedinCard.href = socials.linkedin;
        const clean = socials.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '');
        if (linkedinVal) linkedinVal.textContent = clean || 'LinkedIn';
        linkedinCard.style.display = '';
      } else {
        linkedinCard.style.display = 'none';
      }
    }

    // GitHub card
    const githubCard = document.getElementById('contact-card-github');
    const githubVal = document.getElementById('contact-val-github');
    if (githubCard) {
      if (socials.github) {
        githubCard.href = socials.github;
        const clean = socials.github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
        if (githubVal) githubVal.textContent = clean || 'GitHub';
        githubCard.style.display = '';
      } else {
        githubCard.style.display = 'none';
      }
    }

    // LeetCode card
    const leetcodeCard = document.getElementById('contact-card-leetcode');
    const leetcodeVal = document.getElementById('contact-val-leetcode');
    if (leetcodeCard) {
      if (socials.leetcode) {
        leetcodeCard.href = socials.leetcode;
        const clean = socials.leetcode.replace(/^https?:\/\/(www\.)?leetcode\.com\/u\//, '').replace(/\/$/, '');
        if (leetcodeVal) leetcodeVal.textContent = clean ? `u/${clean}` : 'LeetCode';
        leetcodeCard.style.display = '';
      } else {
        leetcodeCard.style.display = 'none';
      }
    }

    // Resume card
    const resumeCard = document.getElementById('contact-card-resume');
    if (resumeCard) {
      if (id.resumeUrl) {
        resumeCard.href = id.resumeUrl;
        resumeCard.style.display = '';
      } else {
        resumeCard.style.display = 'none';
      }
    }

    // Form action & placeholder
    const form = document.querySelector('.contact-form');
    if (form && socials.email) {
      form.action = `mailto:${socials.email}`;
      const msgPlaceholder = form.querySelector('textarea');
      if (msgPlaceholder) {
        const firstName = (d.identity?.name || '').split(' ')[0];
        msgPlaceholder.placeholder = `Hello ${firstName}...`;
      }
    }
  }

  function renderFooter(d) {
    const footer = document.querySelector('.footer p');
    if (footer) {
      const name = d.identity?.name || 'Author';
      footer.innerHTML = `Built with <i class="fa-solid fa-bolt footer-icon"></i> by ${esc(name)}`;
    }
  }

  /* ---- 4. Orchestrate ----------------------------------------- */
  async function render() {
    let data;
    try {
      data = await loadData();
    } catch (err) {
      console.error('[render.js] Failed to load portfolio data:', err);
      return;
    }

    window.PORTFOLIO_DATA = data;
    window.PORTFOLIO_ROLES = data.identity?.roles || [];

    renderMeta(data);
    renderNav(data);
    renderHero(data);
    renderAbout(data);
    renderSkills(data);
    renderExperience(data);
    renderProjects(data);
    renderStats(data);
    renderCertificates(data);
    renderResume(data);
    renderContact(data);
    renderFooter(data);

    if (typeof window.initApp === 'function') {
      window.initApp();
    }
  }

  render();
})();

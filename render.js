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
    let localData = null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { localData = JSON.parse(stored); } catch (e) { /* continue */ }
    }

    // Attempt to fetch from Supabase if initialized
    const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (sb) {
      try {
        const { data, error } = await sb
          .from('portfolios')
          .select('content')
          .eq('id', 'default')
          .single();

        if (!error && data && data.content) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.content));
          return data.content;
        }
      } catch (err) {
        console.warn('[Supabase Fetch Warning]', err.message);
      }
    }

    if (localData) return localData;

    // Fallback to local portfolio.json file
    const res = await fetch('./portfolio.json');
    const data = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
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
      metaDesc.setAttribute('content', `${esc(name)} — ${d.identity.roles.join(', ')}.`);
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
  }

  function renderHero(d) {
    const id = d.identity || {};
    setText('.hero-greeting', id.greeting || "Hi, I'm");
    setText('.hero-name', id.name || '');
    setText('.hero-description', id.tagline || '');

    const resumeBtn = document.querySelector('.hero-cta .btn-outline');
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

    const hasContent = (ab.paragraphs && ab.paragraphs.length > 0) || (ab.chips && ab.chips.length > 0);
    toggleSectionVisibility('about', d.sectionVisibility?.about !== false && hasContent);

    const paras = (ab.paragraphs || []).map(p => `<p>${p}</p>`).join('');

    const chips = (ab.chips || []).map(c =>
      `<span class="chip"><i class="${esc(c.icon)}${c.class ? ' ' + c.class : ''}"></i> ${esc(c.label)}</span>`
    ).join('');

    const resumeUrl = d.identity?.resumeUrl || '';
    const resumeBtn = resumeUrl ? `<a href="${esc(resumeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary mt-4">
      <i class="fa-solid fa-file-pdf"></i> View/Download Resume
    </a>` : '';

    textEl.innerHTML = paras +
      (chips ? `<div class="about-stats-chips">${chips}</div>` : '') +
      resumeBtn;

    const img = document.querySelector('.profile-img');
    if (img) {
      img.src = d.identity?.profileImage || '/profile.png';
      img.alt = `${esc(d.identity?.name || 'Profile')} Profile`;
      img.onerror = function () {
        this.src = `https://via.placeholder.com/300?text=${encodeURIComponent((d.identity?.name || 'User').split(' ')[0])}`;
      };
    }
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
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    const exp = d.experience || [];
    toggleSectionVisibility('experience', d.sectionVisibility?.experience !== false && exp.length > 0);

    timeline.innerHTML = exp.map((e, i) => {
      const delay = i === 0 ? 0.3 : 0;
      const bullets = (e.bullets || []).map(b => `<li>${b}</li>`).join('');
      return `
      <div class="timeline-item premium-hover" style="transition-delay:${delay}s;">
        <div class="timeline-icon"><i class="${esc(e.icon)}"></i></div>
        <div class="timeline-content glass-card">
          <div class="timeline-header">
            <div>
              <h3>${esc(e.title)}</h3>
              <h4>${esc(e.company)} <span class="timeline-date badge-role">${esc(e.type)}</span></h4>
            </div>
          </div>
          <ul class="experience-list">${bullets}</ul>
          ${e.impact ? `<div class="impact-box">
            <i class="${esc(e.impactIcon || 'fa-solid fa-bolt')}"></i>
            <p><strong>Impact:</strong> ${esc(e.impact)}</p>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function renderProjects(d) {
    const grid = document.querySelector('.projects-grid');
    if (!grid) return;

    const projs = d.projects || [];
    toggleSectionVisibility('projects', d.sectionVisibility?.projects !== false && projs.length > 0);

    grid.setAttribute('data-count', projs.length);

    grid.innerHTML = projs.map((proj, i) => {
      const delay = (i + 1) * 0.15;
      const features = (proj.features || []).map(f => `<li>${f}</li>`).join('');
      const tech = (proj.tech || []).map(t => `<li>${esc(t)}</li>`).join('');
      const githubLink = proj.github
        ? `<a href="${esc(proj.github)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>` : '';
      const demoLink = proj.demo
        ? `<a href="${esc(proj.demo)}" target="_blank" rel="noopener noreferrer" aria-label="Live Demo"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : '';

      return `
      <div class="project-card" style="transition-delay:${delay}s;">
        <div class="project-content">
          <div class="folder-icon"><i class="${esc(proj.icon)}"></i></div>
          <h3 class="project-title">${esc(proj.title)}</h3>
          <div class="project-description">
            <p>${esc(proj.description)}</p>
            ${features ? `<ul class="project-features">${features}</ul>` : ''}
          </div>
          <div class="bottom-card">
            <ul class="project-tech">${tech}</ul>
            <div class="project-links">${githubLink}${demoLink}</div>
          </div>
        </div>
      </div>`;
    }).join('');
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
      <div class="cert-card fade-up${featured}" style="animation-delay:${delay}s;" data-cert-url="${esc(cert.url || '')}">
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

  function renderContact(d) {
    const ct = d.contact || {};
    const socials = d.socials || {};

    toggleSectionVisibility('contact', d.sectionVisibility?.contact !== false);

    const heading = document.querySelector('.contact-info-block h3');
    if (heading) heading.textContent = ct.heading || "Let's Connect";

    const body = document.querySelector('.contact-info-block > p');
    if (body) body.textContent = ct.body || '';

    const details = document.querySelector('.contact-details');
    if (details) {
      const links = [
        socials.email
          ? `<a href="mailto:${esc(socials.email)}" class="contact-line">
              <div class="contact-icon"><i class="fa-solid fa-envelope"></i></div>
              <span>${esc(socials.email)}</span>
            </a>` : '',
        ct.phone
          ? `<a href="tel:${esc(ct.phone.replace(/\s/g,''))}" class="contact-line">
              <div class="contact-icon"><i class="fa-solid fa-phone"></i></div>
              <span>${esc(ct.phone)}</span>
            </a>` : '',
        socials.linkedin
          ? `<a href="${esc(socials.linkedin)}" target="_blank" rel="noopener noreferrer" class="contact-line">
              <div class="contact-icon"><i class="fa-brands fa-linkedin"></i></div>
              <span>LinkedIn Profile</span>
            </a>` : '',
        socials.github
          ? `<a href="${esc(socials.github)}" target="_blank" rel="noopener noreferrer" class="contact-line">
              <div class="contact-icon"><i class="fa-brands fa-github"></i></div>
              <span>GitHub Portfolio</span>
            </a>` : '',
        socials.leetcode
          ? `<a href="${esc(socials.leetcode)}" target="_blank" rel="noopener noreferrer" class="contact-line">
              <div class="contact-icon"><i class="fa-solid fa-code"></i></div>
              <span>LeetCode Profile</span>
            </a>` : '',
      ].filter(Boolean).join('');
      details.innerHTML = links;
    }

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
    renderContact(data);
    renderFooter(data);

    if (typeof window.initApp === 'function') {
      window.initApp();
    }
  }

  render();
})();

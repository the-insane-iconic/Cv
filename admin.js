/* ================================================================
   ADMIN.JS — Portfolio Control Room Editor with Supabase Cloud Sync
   Reads portfolio data, supports section customization & toggling,
   syncs directly to Supabase cloud and local cache.
   ================================================================ */

'use strict';

const STORAGE_KEY = 'portfolio_data';
let DATA = null; // live working copy
let isDirty = false;

/* ================================================================
   1. DATA LOADING & SUPABASE SYNC
   ================================================================ */

async function loadData() {
  let localData = null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { localData = JSON.parse(stored); } catch (e) { /* fall through */ }
  }

  const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
  if (sb) {
    try {
      const { data, error } = await sb
        .from('portfolios')
        .select('content')
        .eq('id', 'default')
        .single();

      if (!error && data && data.content) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.content, null, 2));
        return data.content;
      }
    } catch (err) {
      console.warn('[Supabase Sync Warning]', err.message);
    }
  }

  if (localData) return localData;

  const res = await fetch('./portfolio.json');
  return res.json();
}

async function saveData() {
  // Always save to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA, null, 2));

  // Sync to Supabase if client exists
  const sb = window.getSupabaseClient ? window.getSupabaseClient() : null;
  let cloudSynced = false;

  if (sb) {
    try {
      const { error } = await sb
        .from('portfolios')
        .upsert({
          id: 'default',
          content: DATA,
          updated_at: new Date().toISOString()
        });

      if (!error) {
        cloudSynced = true;
      } else {
        console.error('[Supabase Save Error]', error);
        toast(`Supabase save error: ${error.message}`, 'error');
      }
    } catch (err) {
      console.error('[Supabase Exception]', err);
    }
  }

  setStatus('saved');
  if (cloudSynced) {
    toast('Saved to Supabase Cloud & Browser Storage!', 'success');
  } else {
    toast('Saved to Local Storage (Configure Supabase for cloud sync)', 'info');
  }
  isDirty = false;
}

function markDirty() {
  isDirty = true;
  setStatus('unsaved');
}

/* ================================================================
   2. STATUS & TOAST & MODAL
   ================================================================ */

function setStatus(state) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  dot.className = 'status-dot ' + state;
  text.textContent = state === 'saved'
    ? 'All changes saved'
    : 'Unsaved changes';
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}"></i> ${message}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

window.openSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  const keyInput = document.getElementById('sb-input-key');
  if (keyInput) {
    keyInput.value = localStorage.getItem('supabase_anon_key') || '';
  }
  if (modal) modal.style.display = 'flex';
};

window.closeSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  if (modal) modal.style.display = 'none';
};

window.saveSupabaseKey = function() {
  const keyInput = document.getElementById('sb-input-key');
  const key = keyInput ? keyInput.value.trim() : '';
  if (!key) {
    toast('Please enter your Supabase Anon API key', 'error');
    return;
  }
  localStorage.setItem('supabase_anon_key', key);
  window.SUPABASE_CONFIG.anonKey = key;
  window.supabaseClient = null; // reset client instance

  closeSupabaseModal();
  updateSupabaseStatusBadge();
  toast('Supabase Key Saved! Testing connection...', 'info');

  // Attempt sync
  saveData();
};

function updateSupabaseStatusBadge() {
  const btn = document.getElementById('supabase-status-btn');
  if (!btn) return;
  const key = localStorage.getItem('supabase_anon_key');
  if (key) {
    btn.innerHTML = `<i class="fa-solid fa-cloud-check" style="color:var(--green)"></i> Supabase Connected`;
    btn.className = "btn btn-success btn-sm";
  } else {
    btn.innerHTML = `<i class="fa-solid fa-database"></i> Setup Supabase`;
    btn.className = "btn btn-outline btn-sm";
  }
}

/* ================================================================
   3. ACCORDION HELPERS
   ================================================================ */

function makeSection(id, icon, title, subtitle, bodyHtml) {
  return `
  <div class="editor-section" id="section-${id}">
    <div class="section-header" onclick="toggleSection('${id}')">
      <div class="section-header-left">
        <div class="section-icon"><i class="${icon}"></i></div>
        <div>
          <div class="section-title-text">${title}</div>
          <div class="section-subtitle">${subtitle}</div>
        </div>
      </div>
      <i class="fa-solid fa-chevron-down section-toggle" id="toggle-${id}"></i>
    </div>
    <div class="section-body" id="body-${id}">
      ${bodyHtml}
    </div>
  </div>`;
}

const openSections = new Set(['site', 'sections', 'identity']);

window.toggleSection = function (id) {
  const body = document.getElementById('body-' + id);
  const icon = document.getElementById('toggle-' + id);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (icon) icon.classList.toggle('open', isOpen);
  if (isOpen) openSections.add(id); else openSections.delete(id);

  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const sideLink = document.querySelector(`.sidebar-link[data-section="${id}"]`);
  if (sideLink) sideLink.classList.add('active');
};

window.toggleListItem = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
};

/* ================================================================
   4. FIELD HELPERS
   ================================================================ */

function field(label, inputHtml, hint = '') {
  return `
  <div class="field-group">
    <label class="field-label">${label}</label>
    ${inputHtml}
    ${hint ? `<div class="field-hint">${hint}</div>` : ''}
  </div>`;
}

function textInput(id, value, placeholder = '') {
  return `<input type="text" class="field-input" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" oninput="setPath('${id}', this.value)">`;
}

function urlInput(id, value) {
  return `<input type="url" class="field-input" id="${id}" value="${esc(value)}" placeholder="https://..." oninput="setPath('${id}', this.value)">`;
}

function emailInput(id, value) {
  return `<input type="email" class="field-input" id="${id}" value="${esc(value)}" placeholder="you@example.com" oninput="setPath('${id}', this.value)">`;
}

function textArea(id, value, rows = 3) {
  return `<textarea class="field-textarea" id="${id}" rows="${rows}" oninput="setPath('${id}', this.value)">${esc(value)}</textarea>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.setPath = function (path, value) {
  const parts = path.split('.');
  let obj = DATA;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  markDirty();
};

/* ================================================================
   5. SECTION RENDERERS
   ================================================================ */

/* ---- SITE ---------------------------------------------------- */
function renderSiteSection() {
  const s = DATA.site || {};
  return makeSection('site',
    'fa-solid fa-globe',
    'Site Settings',
    'name · owner · theme',
    `<div class="field-row triple">
      ${field('Site Name', textInput('site.name', s.name, 'Cryo-Byte'))}
      ${field('Owner', textInput('site.owner', s.owner, 'Anupam Yadav'))}
      ${field('Theme', `<select class="field-select" id="site.theme" onchange="setPath('site.theme', this.value)">
        ${['Dark International','Fashion Modernism','Swiss Editorial'].map(t =>
          `<option value="${esc(t)}" ${s.theme === t ? 'selected' : ''}>${esc(t)}</option>`
        ).join('')}
      </select>`)}
    </div>`
  );
}

/* ---- SECTION MANAGER ----------------------------------------- */
function renderSectionManager() {
  DATA.sectionVisibility = DATA.sectionVisibility || {};
  const v = DATA.sectionVisibility;

  const sections = [
    { key: 'about', label: 'About Me' },
    { key: 'skills', label: 'Skills & Proficiency' },
    { key: 'experience', label: 'Experience' },
    { key: 'projects', label: 'Projects' },
    { key: 'achievements', label: 'Achievements & Certificates' },
    { key: 'contact', label: 'Contact & Connect' }
  ];

  const toggles = sections.map(sec => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:8px;">
      <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${sec.label}</span>
      <label class="toggle-row" style="margin:0;">
        <input type="checkbox" class="toggle" ${v[sec.key] !== false ? 'checked' : ''} onchange="DATA.sectionVisibility['${sec.key}']=this.checked; markDirty()">
        <span class="toggle-label">${v[sec.key] !== false ? 'Visible' : 'Hidden'}</span>
      </label>
    </div>`).join('');

  return makeSection('sections',
    'fa-solid fa-eye',
    'Section Visibility',
    'customize which sections show on public site',
    `<div class="field-hint" style="margin-bottom:12px;">Toggle on/off any section on your portfolio instantly.</div>
    <div>${toggles}</div>`
  );
}

/* ---- IDENTITY ------------------------------------------------ */
function renderIdentitySection() {
  const id = DATA.identity || {};
  const rolesHtml = (id.roles || []).map((r, i) => `
    <div class="array-item" id="role-row-${i}">
      <input type="text" class="field-input" value="${esc(r)}" placeholder="Role title..."
        oninput="DATA.identity.roles[${i}]=this.value; markDirty()">
      <button class="btn btn-danger btn-sm btn-icon" onclick="removeRole(${i})" title="Remove">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  return makeSection('identity',
    'fa-solid fa-id-card',
    'Identity',
    'name · brand · roles · tagline',
    `<div class="field-row">
      ${field('Full Name', textInput('identity.name', id.name, 'Anupam Yadav'))}
      ${field('Brand / Handle', textInput('identity.brand', id.brand, 'Cryo-Byte'))}
    </div>
    <div class="field-row">
      ${field('Brand Suffix (for logo color split)', textInput('identity.brandSuffix', id.brandSuffix, 'Byte'), 'The last part shown in accent color in navbar logo')}
      ${field('Location', textInput('identity.location', id.location, 'India'))}
    </div>
    <div class="field-row single">
      ${field('Greeting Text', textInput('identity.greeting', id.greeting, "Hi, I'm"))}
    </div>
    <div class="field-row single">
      ${field('Tagline / Hero Description', textArea('identity.tagline', id.tagline))}
    </div>
    <div class="field-divider"></div>
    <div class="field-label" style="margin-bottom:10px;">TYPING ROLES</div>
    <div class="array-list" id="roles-list">${rolesHtml}</div>
    <button class="add-item-btn" onclick="addRole()">
      <i class="fa-solid fa-plus"></i> Add Role
    </button>
    <div class="field-divider"></div>
    <div class="field-row">
      ${field('Profile Image URL', textInput('identity.profileImage', id.profileImage, '/profile.png'))}
      ${field('Resume URL', urlInput('identity.resumeUrl', id.resumeUrl))}
    </div>`
  );
}

window.addRole = function () {
  DATA.identity.roles = DATA.identity.roles || [];
  DATA.identity.roles.push('');
  markDirty();
  renderEditor();
  const body = document.getElementById('body-identity');
  if (body) body.classList.add('open');
};

window.removeRole = function (i) {
  DATA.identity.roles.splice(i, 1);
  markDirty();
  renderEditor();
};

/* ---- ABOUT --------------------------------------------------- */
function renderAboutSection() {
  const ab = DATA.about || {};
  const paras = (ab.paragraphs || []).map((p, i) => `
    <div class="array-item">
      <textarea class="field-textarea" rows="2" oninput="DATA.about.paragraphs[${i}]=this.value; markDirty()">${esc(p)}</textarea>
      <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.about.paragraphs.splice(${i},1); markDirty(); renderEditor()">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  const chips = (ab.chips || []).map((c, i) => `
    <div class="array-item">
      <input type="text" class="field-input" value="${esc(c.icon)}" placeholder="fa-solid fa-..." style="flex:0 0 180px"
        oninput="DATA.about.chips[${i}].icon=this.value; markDirty()">
      <input type="text" class="field-input" value="${esc(c.label)}" placeholder="Label..."
        oninput="DATA.about.chips[${i}].label=this.value; markDirty()">
      <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.about.chips.splice(${i},1); markDirty(); renderEditor()">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  return makeSection('about',
    'fa-solid fa-user',
    'About',
    'bio paragraphs · stat chips',
    `<div class="field-label" style="margin-bottom:10px;">BIO PARAGRAPHS <span style="font-size:10px;color:var(--text-muted);font-weight:400">(HTML is allowed)</span></div>
    <div class="array-list">${paras}</div>
    <button class="add-item-btn" onclick="DATA.about.paragraphs=DATA.about.paragraphs||[]; DATA.about.paragraphs.push(''); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Paragraph
    </button>
    <div class="field-divider"></div>
    <div class="field-label" style="margin-bottom:10px;">STAT CHIPS — <span style="font-weight:400;font-size:11px">icon · label</span></div>
    <div class="array-list">${chips}</div>
    <button class="add-item-btn" onclick="DATA.about.chips=DATA.about.chips||[]; DATA.about.chips.push({icon:'fa-solid fa-star',label:'New Stat'}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Chip
    </button>`
  );
}

/* ---- SKILLS -------------------------------------------------- */
function renderSkillsSection() {
  const cats = DATA.skills || [];

  const catsHtml = cats.map((cat, ci) => {
    const itemsHtml = (cat.items || []).map((sk, si) => `
      <div class="field-row" style="align-items:end; gap:8px; margin-bottom:8px;">
        <div class="field-group" style="flex:0 0 120px">
          <label class="field-label">Icon</label>
          <input type="text" class="field-input" value="${esc(sk.icon)}" placeholder="fa-brands fa-react"
            oninput="DATA.skills[${ci}].items[${si}].icon=this.value; markDirty()">
        </div>
        <div class="field-group" style="flex:1">
          <label class="field-label">Skill Name</label>
          <input type="text" class="field-input" value="${esc(sk.name)}"
            oninput="DATA.skills[${ci}].items[${si}].name=this.value; markDirty()">
        </div>
        <div class="field-group" style="flex:0 0 160px">
          <label class="field-label">Level %</label>
          <div class="skill-range-wrap">
            <input type="range" class="field-range" min="0" max="100" value="${sk.level}"
              oninput="DATA.skills[${ci}].items[${si}].level=parseInt(this.value); this.nextElementSibling.textContent=this.value+'%'; markDirty()">
            <span class="range-val">${sk.level}%</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.skills[${ci}].items.splice(${si},1); markDirty(); renderEditor()" title="Remove">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('skill-cat-${ci}')">
        <i class="${esc(cat.icon)}" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(cat.category)}</span>
        <span class="list-item-meta">${(cat.items||[]).length} skills</span>
        <div class="list-item-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); DATA.skills.splice(${ci},1); markDirty(); renderEditor()" title="Delete category">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="list-item-body" id="skill-cat-${ci}">
        <div class="field-row" style="margin-bottom:12px;">
          <div class="field-group">
            <label class="field-label">Category Name</label>
            <input type="text" class="field-input" value="${esc(cat.category)}"
              oninput="DATA.skills[${ci}].category=this.value; markDirty()">
          </div>
          <div class="field-group">
            <label class="field-label">Category Icon</label>
            <input type="text" class="field-input" value="${esc(cat.icon)}"
              oninput="DATA.skills[${ci}].icon=this.value; markDirty()">
          </div>
        </div>
        <div class="field-label" style="margin-bottom:8px;">SKILL ITEMS</div>
        ${itemsHtml}
        <button class="add-item-btn" style="margin-top:4px;" onclick="DATA.skills[${ci}].items.push({name:'New Skill',icon:'fa-solid fa-star',level:80}); markDirty(); renderEditor()">
          <i class="fa-solid fa-plus"></i> Add Skill
        </button>
      </div>
    </div>`;
  }).join('');

  return makeSection('skills',
    'fa-solid fa-layer-group',
    'Skills',
    'categories · proficiency levels',
    `<div class="list-items">${catsHtml}</div>
    <button class="add-item-btn" onclick="DATA.skills.push({category:'New Category',icon:'fa-solid fa-star',items:[]}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Category
    </button>`
  );
}

/* ---- EXPERIENCE --------------------------------------------- */
function renderExperienceSection() {
  const exps = DATA.experience || [];

  const html = exps.map((exp, i) => {
    const bullets = (exp.bullets || []).map((b, bi) => `
      <div class="array-item">
        <textarea class="field-textarea" rows="1" oninput="DATA.experience[${i}].bullets[${bi}]=this.value; markDirty()">${esc(b)}</textarea>
        <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.experience[${i}].bullets.splice(${bi},1); markDirty(); renderEditor()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('exp-${i}')">
        <i class="${esc(exp.icon)}" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(exp.title)}</span>
        <span class="list-item-meta">${esc(exp.company)}</span>
        <div class="list-item-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); DATA.experience.splice(${i},1); markDirty(); renderEditor()">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="list-item-body" id="exp-${i}">
        <div class="field-row triple">
          ${field('Job Title', `<input type="text" class="field-input" value="${esc(exp.title)}" oninput="DATA.experience[${i}].title=this.value; markDirty()">`)}
          ${field('Company', `<input type="text" class="field-input" value="${esc(exp.company)}" oninput="DATA.experience[${i}].company=this.value; markDirty()">`)}
          ${field('Type Badge', `<input type="text" class="field-input" value="${esc(exp.type)}" placeholder="Freelance / Full-time" oninput="DATA.experience[${i}].type=this.value; markDirty()">`)}
        </div>
        <div class="field-row">
          ${field('Icon', `<input type="text" class="field-input" value="${esc(exp.icon)}" placeholder="fa-solid fa-brain" oninput="DATA.experience[${i}].icon=this.value; markDirty()">`)}
          ${field('Impact Icon', `<input type="text" class="field-input" value="${esc(exp.impactIcon||'fa-solid fa-bolt')}" oninput="DATA.experience[${i}].impactIcon=this.value; markDirty()">`)}
        </div>
        <div class="field-row single">
          ${field('Impact Statement', `<textarea class="field-textarea" rows="2" oninput="DATA.experience[${i}].impact=this.value; markDirty()">${esc(exp.impact)}</textarea>`)}
        </div>
        <div class="field-label" style="margin-bottom:8px;">BULLET POINTS <span style="font-size:10px;font-weight:400">(HTML allowed)</span></div>
        <div class="array-list">${bullets}</div>
        <button class="add-item-btn" onclick="DATA.experience[${i}].bullets.push('New bullet point'); markDirty(); renderEditor()">
          <i class="fa-solid fa-plus"></i> Add Bullet
        </button>
      </div>
    </div>`;
  }).join('');

  return makeSection('experience',
    'fa-solid fa-briefcase',
    'Experience',
    'timeline entries',
    `<div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="DATA.experience.push({title:'New Role',company:'Company',type:'Full-time',icon:'fa-solid fa-star',bullets:[],impact:'',impactIcon:'fa-solid fa-bolt'}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Experience
    </button>`
  );
}

/* ---- PROJECTS ----------------------------------------------- */
function renderProjectsSection() {
  const projs = DATA.projects || [];

  const html = projs.map((proj, i) => {
    const features = (proj.features || []).map((f, fi) => `
      <div class="array-item">
        <textarea class="field-textarea" rows="1" oninput="DATA.projects[${i}].features[${fi}]=this.value; markDirty()">${esc(f)}</textarea>
        <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.projects[${i}].features.splice(${fi},1); markDirty(); renderEditor()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');

    const techTags = (proj.tech || []).map((t, ti) => `
      <span class="tag-item">
        ${esc(t)}
        <span class="tag-remove" onclick="DATA.projects[${i}].tech.splice(${ti},1); markDirty(); renderEditor()">✕</span>
      </span>`).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('proj-${i}')">
        <i class="${esc(proj.icon)}" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(proj.title)}</span>
        <span class="list-item-meta">${(proj.tech||[]).slice(0,3).join(', ')}</span>
        <div class="list-item-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); DATA.projects.splice(${i},1); markDirty(); renderEditor()">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="list-item-body" id="proj-${i}">
        <div class="field-row">
          ${field('Project Title', `<input type="text" class="field-input" value="${esc(proj.title)}" oninput="DATA.projects[${i}].title=this.value; markDirty()">`)}
          ${field('Icon', `<input type="text" class="field-input" value="${esc(proj.icon)}" placeholder="fa-solid fa-..." oninput="DATA.projects[${i}].icon=this.value; markDirty()">`)}
        </div>
        <div class="field-row single">
          ${field('Description', `<textarea class="field-textarea" rows="2" oninput="DATA.projects[${i}].description=this.value; markDirty()">${esc(proj.description)}</textarea>`)}
        </div>
        <div class="field-row">
          ${field('GitHub URL', `<input type="url" class="field-input" value="${esc(proj.github||'')}" oninput="DATA.projects[${i}].github=this.value; markDirty()">`)}
          ${field('Live Demo URL', `<input type="url" class="field-input" value="${esc(proj.demo||'')}" oninput="DATA.projects[${i}].demo=this.value; markDirty()">`)}
        </div>
        <div class="field-label" style="margin-bottom:8px;">FEATURE BULLETS <span style="font-size:10px;font-weight:400">(HTML allowed)</span></div>
        <div class="array-list">${features}</div>
        <button class="add-item-btn" onclick="DATA.projects[${i}].features.push('New feature'); markDirty(); renderEditor()">
          <i class="fa-solid fa-plus"></i> Add Feature
        </button>
        <div class="field-divider"></div>
        <div class="field-label" style="margin-bottom:8px;">TECH STACK</div>
        <div class="tag-list">${techTags}</div>
        <div class="tag-add-row">
          <input type="text" class="field-input" id="tech-add-${i}" placeholder="Add technology..." onkeydown="if(event.key==='Enter'){addTech(${i})}">
          <button class="btn btn-outline btn-sm" onclick="addTech(${i})"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  return makeSection('projects',
    'fa-solid fa-folder',
    'Projects',
    'portfolio project cards',
    `<div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="DATA.projects.push({title:'New Project',icon:'fa-solid fa-star',description:'',features:[],tech:[],github:'',demo:''}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Project
    </button>`
  );
}

window.addTech = function (pi) {
  const input = document.getElementById(`tech-add-${pi}`);
  if (!input || !input.value.trim()) return;
  DATA.projects[pi].tech = DATA.projects[pi].tech || [];
  DATA.projects[pi].tech.push(input.value.trim());
  markDirty();
  renderEditor();
};

/* ---- STATS --------------------------------------------------- */
function renderStatsSection() {
  const stats = DATA.stats || [];

  const html = stats.map((s, i) => `
    <div class="field-row" style="align-items:end; gap:8px; margin-bottom:10px;">
      <div class="field-group" style="flex:0 0 120px">
        <label class="field-label">Icon</label>
        <input type="text" class="field-input" value="${esc(s.icon)}" placeholder="fa-solid fa-..."
          oninput="DATA.stats[${i}].icon=this.value; markDirty()">
      </div>
      <div class="field-group" style="flex:1">
        <label class="field-label">Label</label>
        <input type="text" class="field-input" value="${esc(s.label)}"
          oninput="DATA.stats[${i}].label=this.value; markDirty()">
      </div>
      <div class="field-group" style="flex:0 0 80px">
        <label class="field-label">Value</label>
        <input type="text" class="field-input" value="${esc(String(s.value||s.suffix||''))}"
          oninput="DATA.stats[${i}].value=isNaN(+this.value)?null:+this.value; DATA.stats[${i}].suffix=isNaN(+this.value)?this.value:'+'; DATA.stats[${i}].isText=isNaN(+this.value); markDirty()">
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="DATA.stats.splice(${i},1); markDirty(); renderEditor()">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  return makeSection('stats',
    'fa-solid fa-trophy',
    'Stats / Achievements',
    'number badges shown in achievements section',
    `${html}
    <button class="add-item-btn" onclick="DATA.stats.push({value:0,suffix:'+',label:'New Stat',icon:'fa-solid fa-star'}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Stat
    </button>`
  );
}

/* ---- CERTIFICATES ------------------------------------------- */
function renderCertificatesSection() {
  const certs = DATA.certificates || [];

  const html = certs.map((cert, i) => {
    const cats = (DATA.certCategories || ['AI','Cybersecurity','Networking','Programming','Others']);
    const catOptions = cats.filter(c => c !== 'All').map(c =>
      `<option value="${esc(c)}" ${cert.category === c ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('cert-${i}')">
        <i class="${esc(cert.icon)}" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(cert.title)}</span>
        <span class="list-item-meta">${esc(cert.issuer)} · ${esc(cert.category)}</span>
        <div class="list-item-actions">
          ${cert.featured ? '<span style="font-size:10px;color:var(--amber);margin-right:4px;">★ Featured</span>' : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); DATA.certificates.splice(${i},1); markDirty(); renderEditor()">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="list-item-body" id="cert-${i}">
        <div class="field-row">
          ${field('Certificate Title', `<input type="text" class="field-input" value="${esc(cert.title)}" oninput="DATA.certificates[${i}].title=this.value; markDirty()">`)}
          ${field('Issuer', `<input type="text" class="field-input" value="${esc(cert.issuer)}" oninput="DATA.certificates[${i}].issuer=this.value; markDirty()">`)}
        </div>
        <div class="field-row">
          ${field('Category', `<select class="field-select" onchange="DATA.certificates[${i}].category=this.value; markDirty()">${catOptions}</select>`)}
          ${field('Icon', `<input type="text" class="field-input" value="${esc(cert.icon)}" placeholder="fa-solid fa-..." oninput="DATA.certificates[${i}].icon=this.value; markDirty()">`)}
        </div>
        <div class="field-row">
          ${field('Certificate URL / Embed Link', `<input type="url" class="field-input" value="${esc(cert.url||'')}" placeholder="https://..." oninput="DATA.certificates[${i}].url=this.value; markDirty()">`)}
          <div class="field-group" style="justify-content:flex-end;padding-top:20px;">
            <label class="toggle-row">
              <input type="checkbox" class="toggle" ${cert.featured ? 'checked' : ''} onchange="DATA.certificates[${i}].featured=this.checked; markDirty(); renderEditor()">
              <span class="toggle-label">Featured cert</span>
            </label>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const certCatTags = (DATA.certCategories || []).filter(c => c !== 'All').map((c, i) => `
    <span class="tag-item">
      ${esc(c)}
      <span class="tag-remove" onclick="DATA.certCategories.splice(DATA.certCategories.indexOf('${esc(c)}'),1); markDirty(); renderEditor()">✕</span>
    </span>`).join('');

  return makeSection('certificates',
    'fa-solid fa-certificate',
    'Certificates',
    'all certification cards',
    `<div class="field-label" style="margin-bottom:8px;">FILTER CATEGORIES</div>
    <div class="tag-list">${certCatTags}</div>
    <div class="tag-add-row" style="margin-bottom:20px;">
      <input type="text" class="field-input" id="cert-cat-add" placeholder="Add category..." onkeydown="if(event.key==='Enter'){addCertCat()}">
      <button class="btn btn-outline btn-sm" onclick="addCertCat()"><i class="fa-solid fa-plus"></i></button>
    </div>
    <div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="DATA.certificates.push({title:'New Certificate',issuer:'Issuer',category:'Others',icon:'fa-solid fa-certificate',featured:false,url:''}); markDirty(); renderEditor()">
      <i class="fa-solid fa-plus"></i> Add Certificate
    </button>`
  );
}

window.addCertCat = function () {
  const input = document.getElementById('cert-cat-add');
  if (!input || !input.value.trim()) return;
  DATA.certCategories = DATA.certCategories || ['All'];
  if (!DATA.certCategories.includes(input.value.trim())) {
    DATA.certCategories.push(input.value.trim());
  }
  markDirty();
  renderEditor();
};

/* ---- SOCIALS ------------------------------------------------- */
function renderSocialsSection() {
  const s = DATA.socials || {};
  return makeSection('socials',
    'fa-solid fa-share-nodes',
    'Social Links',
    'github · linkedin · email · leetcode',
    `<div class="field-row">
      ${field('GitHub URL', urlInput('socials.github', s.github))}
      ${field('LinkedIn URL', urlInput('socials.linkedin', s.linkedin))}
    </div>
    <div class="field-row">
      ${field('Email Address', emailInput('socials.email', s.email))}
      ${field('LeetCode URL', urlInput('socials.leetcode', s.leetcode))}
    </div>`
  );
}

/* ---- CONTACT ------------------------------------------------- */
function renderContactSection() {
  const ct = DATA.contact || {};
  return makeSection('contact',
    'fa-solid fa-envelope',
    'Contact',
    'section heading · body text · phone',
    `<div class="field-row">
      ${field('Section Heading', textInput('contact.heading', ct.heading, "Let's Connect"))}
      ${field('Phone Number', textInput('contact.phone', ct.phone, '+91 000-000-0000'))}
    </div>
    <div class="field-row single">
      ${field('Body Text', textArea('contact.body', ct.body))}
    </div>`
  );
}

/* ================================================================
   6. MAIN EDITOR RENDER
   ================================================================ */

function renderEditor() {
  const container = document.getElementById('editor-container');
  if (!container) return;

  container.innerHTML = [
    renderSiteSection(),
    renderSectionManager(),
    renderIdentitySection(),
    renderAboutSection(),
    renderSkillsSection(),
    renderExperienceSection(),
    renderProjectsSection(),
    renderStatsSection(),
    renderCertificatesSection(),
    renderSocialsSection(),
    renderContactSection(),
  ].join('');

  openSections.forEach(id => {
    const body = document.getElementById('body-' + id);
    const icon = document.getElementById('toggle-' + id);
    if (body) { body.classList.add('open'); }
    if (icon) { icon.classList.add('open'); }
  });
}

/* ================================================================
   7. EXPORT / IMPORT JSON
   ================================================================ */

window.exportJSON = function () {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('portfolio.json downloaded', 'success');
};

window.importJSON = function () {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        DATA = JSON.parse(ev.target.result);
        renderEditor();
        saveData();
        toast('JSON imported successfully', 'success');
      } catch (err) {
        toast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

window.resetToFile = async function () {
  if (!confirm('Reset to original portfolio.json? All unsaved changes will be lost.')) return;
  try {
    const res = await fetch('./portfolio.json');
    DATA = await res.json();
    renderEditor();
    saveData();
    toast('Reset to portfolio.json', 'info');
  } catch (err) {
    toast('Could not load portfolio.json', 'error');
  }
};

/* ================================================================
   8. SIDEBAR & NAV
   ================================================================ */

function buildSidebar() {
  const items = [
    { section: 'site', icon: 'fa-globe', label: 'Site' },
    { section: 'sections', icon: 'fa-eye', label: 'Visibility' },
    { section: 'identity', icon: 'fa-id-card', label: 'Identity' },
    { section: 'about', icon: 'fa-user', label: 'About' },
    { section: 'skills', icon: 'fa-layer-group', label: 'Skills' },
    { section: 'experience', icon: 'fa-briefcase', label: 'Experience' },
    { section: 'projects', icon: 'fa-folder', label: 'Projects' },
    { section: 'stats', icon: 'fa-trophy', label: 'Stats' },
    { section: 'certificates', icon: 'fa-certificate', label: 'Certificates' },
    { section: 'socials', icon: 'fa-share-nodes', label: 'Socials' },
    { section: 'contact', icon: 'fa-envelope', label: 'Contact' },
  ];

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = `
    <li><div class="sidebar-group-label">Content</div></li>
    ${items.map(item => `
    <li>
      <a class="sidebar-link" data-section="${item.section}"
        onclick="scrollToSection('${item.section}')">
        <i class="fa-solid ${item.icon}"></i>
        ${item.label}
      </a>
    </li>`).join('')}`;
}

window.scrollToSection = function (id) {
  const el = document.getElementById('section-' + id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const body = document.getElementById('body-' + id);
  const icon = document.getElementById('toggle-' + id);
  if (body && !body.classList.contains('open')) {
    body.classList.add('open');
    if (icon) icon.classList.add('open');
    openSections.add(id);
  }
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const sideLink = document.querySelector(`.sidebar-link[data-section="${id}"]`);
  if (sideLink) sideLink.classList.add('active');
};

/* ================================================================
   9. INIT
   ================================================================ */

async function init() {
  try {
    DATA = await loadData();
  } catch (err) {
    console.error('[admin.js] Failed to load data:', err);
    document.getElementById('editor-container').innerHTML =
      `<div style="padding:40px;color:var(--red);">
        <i class="fa-solid fa-circle-xmark"></i> Failed to load portfolio data.
      </div>`;
    return;
  }

  buildSidebar();
  renderEditor();
  updateSupabaseStatusBadge();

  const brandName = document.getElementById('admin-brand-name');
  if (brandName) brandName.textContent = DATA.site?.name || DATA.identity?.brand || 'Portfolio';

  setStatus('saved');

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

init();

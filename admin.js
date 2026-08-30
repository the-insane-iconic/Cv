/* ================================================================
   ADMIN.JS — Control Room & Portfolio Studio Editor Logic
   Features:
   - Supabase Real-time Cloud Sync + Local Caching
   - Item Reordering (Move Up / Down)
   - Real-time Global Search (Ctrl+K / Cmd+K)
   - Dynamic Sidebar Badges & Top Banner Metrics
   - Live Avatar / Icon Image Previews
   - Keyboard Shortcuts (Ctrl+S to save)
   - Expand / Collapse All
   - Surgical DOM Updates (No Scroll Jump)
   ================================================================ */

'use strict';

const STORAGE_KEY = 'portfolio_data';
let DATA = null;
let isDirty = false;
let allExpanded = false;

/* ================================================================
   1. DATA LOADING & SUPABASE SYNC
   ================================================================ */

async function loadData() {
  let fileData = null;
  try {
    const res = await fetch('./portfolio.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      fileData = await res.json();
    }
  } catch (e) {
    console.warn('[File Fetch Warning]', e);
  }

  let localData = null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { localData = JSON.parse(stored); } catch (e) { /* continue */ }
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
        const dbData = data.content;
        if (fileData) {
          if (fileData.projects && (!dbData.projects || dbData.projects.length < fileData.projects.length || !dbData.projects[0]?.type)) {
            dbData.projects = fileData.projects;
          }
          const hasOldCyber = dbData.experience && dbData.experience.some(e => /cybersecurity/i.test(e.title || '') || /deloitte/i.test(e.company || ''));
          if (fileData.experience && (!dbData.experience || dbData.experience.length !== fileData.experience.length || hasOldCyber)) {
            dbData.experience = fileData.experience;
          }
          if (fileData.skills && fileData.skills.some(s => /ai/i.test(s.category || '')) && !dbData.skills?.some(s => /ai/i.test(s.category || ''))) {
            dbData.skills = fileData.skills;
          }
          if (fileData.identity && fileData.identity.profileImages) {
            dbData.identity = { ...(dbData.identity || {}), profileImages: fileData.identity.profileImages };
          }
          if (fileData.about) {
            dbData.about = fileData.about;
          }
          if (fileData.certificates) {
            dbData.certificates = fileData.certificates;
          }
          if (fileData.socials) {
            dbData.socials = fileData.socials;
          }
          if (fileData.contact) {
            dbData.contact = fileData.contact;
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData, null, 2));
        return dbData;
      }
    } catch (err) {
      console.warn('[Supabase Sync Warning]', err.message);
    }
  }

  // Merge file updates with localStorage if local cache is missing new fields
  if (localData && fileData) {
    const merged = { ...fileData, ...localData };
    if (fileData.projects && (!localData.projects || localData.projects.length < fileData.projects.length || !localData.projects[0]?.type)) {
      merged.projects = fileData.projects;
    }
    const hasOldCyber = localData.experience && localData.experience.some(e => /cybersecurity/i.test(e.title || '') || /deloitte/i.test(e.company || ''));
    if (fileData.experience && (!localData.experience || localData.experience.length !== fileData.experience.length || hasOldCyber)) {
      merged.experience = fileData.experience;
    }
    if (fileData.skills && fileData.skills.some(s => /ai/i.test(s.category || '')) && !localData.skills?.some(s => /ai/i.test(s.category || ''))) {
      merged.skills = fileData.skills;
    }
    if (fileData.identity) {
      merged.identity = { ...(localData.identity || {}), ...fileData.identity };
    }
    if (fileData.about) {
      merged.about = fileData.about;
    }
    if (fileData.certificates) {
      merged.certificates = fileData.certificates;
    }
    if (fileData.socials) {
      merged.socials = fileData.socials;
    }
    if (fileData.contact) {
      merged.contact = fileData.contact;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged, null, 2));
    return merged;
  }

  if (fileData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData, null, 2));
    return fileData;
  }

  if (localData) return localData;
  return {};
}

async function saveData() {
  const saveBtn1 = document.getElementById('btn-topbar-save');
  const saveBtn2 = document.getElementById('btn-dock-save');
  
  if (saveBtn1) saveBtn1.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>`;
  if (saveBtn2) saveBtn2.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>`;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA, null, 2));

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
    toast('Saved & Synced with Supabase Cloud!', 'success');
  } else {
    toast('Saved to Local Storage (Connect Supabase for cloud sync)', 'info');
  }
  isDirty = false;

  if (saveBtn1) saveBtn1.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Save &amp; Sync</span>`;
  if (saveBtn2) saveBtn2.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Save &amp; Sync</span>`;

  updateMetrics();
  buildSidebar();
}

function markDirty() {
  isDirty = true;
  setStatus('unsaved');
}

/* ================================================================
   2. STATUS & NOTIFICATIONS
   ================================================================ */

function setStatus(state) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  dot.className = 'status-indicator-dot ' + state;
  text.textContent = state === 'saved' ? 'All changes saved' : 'Unsaved changes';
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}"></i> <span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

/* ================================================================
   3. SUPABASE MODAL & UTILS
   ================================================================ */

window.openSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  const keyInput = document.getElementById('sb-input-key');
  if (keyInput) {
    keyInput.value = window.SUPABASE_CONFIG?.anonKey || localStorage.getItem('supabase_anon_key') || '';
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
    toast('Please enter your Supabase Anon key', 'error');
    return;
  }
  localStorage.setItem('supabase_anon_key', key);
  window.SUPABASE_CONFIG.anonKey = key;
  window.supabaseClient = null;

  closeSupabaseModal();
  updateSupabaseStatusBadge();
  toast('Supabase Key Connected! Testing sync...', 'info');
  saveData();
};

function updateSupabaseStatusBadge() {
  const btn = document.getElementById('supabase-status-btn');
  const text = document.getElementById('cloud-status-text');
  if (!btn) return;
  const key = window.SUPABASE_CONFIG?.anonKey || localStorage.getItem('supabase_anon_key');
  if (key) {
    btn.classList.add('connected');
    if (text) text.textContent = 'Cloud Connected';
  } else {
    btn.classList.remove('connected');
    if (text) text.textContent = 'Setup Supabase';
  }
}

window.copyText = function(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--emerald)"></i>`;
    setTimeout(() => btn.innerHTML = orig, 1800);
    toast('Copied to clipboard!', 'info');
  });
};

window.copySqlSnippet = function(btn) {
  const code = document.getElementById('sql-snippet-code');
  if (code) {
    copyText(code.innerText, btn);
  }
};

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `<i class="fa-regular fa-eye-slash"></i>`;
  } else {
    input.type = 'password';
    btn.innerHTML = `<i class="fa-regular fa-eye"></i>`;
  }
};

/* ================================================================
   4. DATA MUTATION HELPERS (Dot notation & Reordering)
   ================================================================ */

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

window.moveItem = function(arrayPath, index, direction) {
  const parts = arrayPath.split('.');
  let arr = DATA;
  for (let i = 0; i < parts.length; i++) {
    arr = arr[parts[i]];
  }
  if (!Array.isArray(arr)) return;

  const targetIdx = index + direction;
  if (targetIdx < 0 || targetIdx >= arr.length) return;

  const temp = arr[index];
  arr[index] = arr[targetIdx];
  arr[targetIdx] = temp;

  markDirty();
  renderEditor();
  toast('Item reordered', 'info');
};

/* ================================================================
   5. SECTION BUILDERS
   ================================================================ */

const openSections = new Set(['site', 'sections', 'identity', 'projects', 'skills']);

function makeSection(id, icon, title, subtitle, countBadge, bodyHtml) {
  const isOpen = openSections.has(id);
  return `
  <div class="editor-section ${isOpen ? 'open' : ''}" id="section-${id}" data-section-name="${id}">
    <div class="section-header" onclick="toggleSection('${id}')">
      <div class="section-header-left">
        <div class="section-icon"><i class="${icon}"></i></div>
        <div>
          <div class="section-title-text">${title}</div>
          <div class="section-subtitle">${subtitle}</div>
        </div>
      </div>
      <div class="section-header-right">
        ${countBadge ? `<span class="section-item-counter">${countBadge}</span>` : ''}
        <div class="section-toggle"><i class="fa-solid fa-chevron-down"></i></div>
      </div>
    </div>
    <div class="section-body" id="body-${id}">
      ${bodyHtml}
    </div>
  </div>`;
}

window.toggleSection = function(id) {
  const sec = document.getElementById('section-' + id);
  if (!sec) return;
  const isCurrentlyOpen = sec.classList.contains('open');
  if (isCurrentlyOpen) {
    sec.classList.remove('open');
    openSections.delete(id);
  } else {
    sec.classList.add('open');
    openSections.add(id);
  }
  updateSidebarActive(id);
};

window.toggleAllSections = function() {
  allExpanded = !allExpanded;
  const sections = document.querySelectorAll('.editor-section');
  const btnText = document.getElementById('toggle-all-text');
  
  sections.forEach(sec => {
    const id = sec.getAttribute('data-section-name');
    if (allExpanded) {
      sec.classList.add('open');
      if (id) openSections.add(id);
    } else {
      sec.classList.remove('open');
      if (id) openSections.delete(id);
    }
  });

  if (btnText) btnText.textContent = allExpanded ? 'Collapse All' : 'Expand All';
};

window.toggleListItem = function(id) {
  const el = document.getElementById(id);
  if (el) {
    const parent = el.closest('.list-item');
    if (parent) parent.classList.toggle('open');
  }
};

/* Form Field Generators */
function field(label, inputHtml, hint = '') {
  return `
  <div class="field-group">
    <label class="field-label">${label}</label>
    ${inputHtml}
    ${hint ? `<span class="field-hint">${hint}</span>` : ''}
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

/* ================================================================
   6. RENDER EACH SECTION
   ================================================================ */

/* ---- SITE SETTINGS ---- */
function renderSiteSection() {
  const s = DATA.site || {};
  return makeSection('site',
    'fa-solid fa-globe',
    'Site & Theme',
    'global branding · owner · theme preset',
    '',
    `<div class="field-row triple">
      ${field('Site Brand Name', textInput('site.name', s.name, 'Cryo-Byte'))}
      ${field('Owner Name', textInput('site.owner', s.owner, 'Anupam Yadav'))}
      ${field('Visual Theme', `<select class="field-select" id="site.theme" onchange="setPath('site.theme', this.value)">
        ${['Dark International','Fashion Modernism','Swiss Editorial'].map(t =>
          `<option value="${esc(t)}" ${s.theme === t ? 'selected' : ''}>${esc(t)}</option>`
        ).join('')}
      </select>`)}
    </div>`
  );
}

/* ---- SECTION MANAGER ---- */
function renderSectionManager() {
  DATA.sectionVisibility = DATA.sectionVisibility || {};
  const v = DATA.sectionVisibility;

  const sections = [
    { key: 'about', label: 'About Me' },
    { key: 'skills', label: 'Skills & Proficiency' },
    { key: 'experience', label: 'Experience Timeline' },
    { key: 'projects', label: 'Projects Grid' },
    { key: 'achievements', label: 'Achievements & Certificates' },
    { key: 'contact', label: 'Contact & Connect' }
  ];

  const toggles = sections.map(sec => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:8px;">
      <span style="font-size:13px; font-weight:600; color:var(--text-main);">${sec.label}</span>
      <label class="toggle-row" style="margin:0;">
        <input type="checkbox" class="toggle" ${v[sec.key] !== false ? 'checked' : ''} onchange="DATA.sectionVisibility['${sec.key}']=this.checked; markDirty()">
        <span style="font-size:12px; color:var(--text-secondary);">${v[sec.key] !== false ? 'Visible' : 'Hidden'}</span>
      </label>
    </div>`).join('');

  return makeSection('sections',
    'fa-solid fa-eye',
    'Section Visibility',
    'toggle on/off public sections',
    `${sections.filter(s => v[s.key] !== false).length}/${sections.length} Active`,
    `<p class="field-hint" style="margin-bottom:14px;">Toggle visibility for any section. Hidden sections won't appear on your public website.</p>
    <div>${toggles}</div>`
  );
}

/* ---- IDENTITY ---- */
function renderIdentitySection() {
  const id = DATA.identity || {};
  const rolesHtml = (id.roles || []).map((r, i) => `
    <div class="array-item" id="role-row-${i}">
      <input type="text" class="field-input" value="${esc(r)}" placeholder="Role title..."
        oninput="DATA.identity.roles[${i}]=this.value; markDirty()">
      <button class="btn-icon-action" onclick="moveItem('identity.roles', ${i}, -1)" title="Move Up"><i class="fa-solid fa-chevron-up"></i></button>
      <button class="btn-icon-action" onclick="moveItem('identity.roles', ${i}, 1)" title="Move Down"><i class="fa-solid fa-chevron-down"></i></button>
      <button class="btn-icon-action danger" onclick="removeRole(${i})" title="Remove"><i class="fa-solid fa-trash"></i></button>
    </div>`).join('');

    const profileImagesArr = (Array.isArray(id.profileImages) && id.profileImages.length > 0)
      ? id.profileImages
      : (id.profileImage ? [id.profileImage] : []);
    const profileImagesVal = profileImagesArr.join('\n');

    const profilePreviews = profileImagesArr.map(img => `
      <div style="width:55px; height:65px; border-radius:6px; overflow:hidden; border:1px solid var(--border-subtle); background:var(--bg-card);">
        <img src="${esc(img)}" alt="Reel Preview" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://via.placeholder.com/60x70?text=No+Img';">
      </div>
    `).join('');

    return makeSection('identity',
      'fa-solid fa-id-card',
      'Identity & Hero',
      'personal brand · typing animation roles · profile reel images',
      `${id.name || 'Hero'}`,
      `<div class="field-row">
        ${field('Full Name', textInput('identity.name', id.name))}
        ${field('Greeting Text', textInput('identity.greeting', id.greeting))}
      </div>
      <div class="field-row">
        ${field('Brand Prefix', textInput('identity.brand', id.brand), 'e.g. Cryo-Byte')}
        ${field('Brand Suffix (Styled)', textInput('identity.brandSuffix', id.brandSuffix), 'e.g. Byte')}
      </div>
      <div class="field-row single">
        ${field('Hero Introduction Paragraphs (HTML supported, 1 per line)', `
          <textarea class="field-textarea" rows="3" placeholder="Paragraph 1&#10;Paragraph 2" oninput="updateIntroParagraphs(this.value)">${esc((id.introParagraphs || []).join('\n'))}</textarea>
          <span class="field-hint" style="display:block; margin-top:4px; font-size:11px; color:var(--text-muted);">
            Tip: Use &lt;span class="hero-hl"&gt;keyword&lt;/span&gt; to create vibrant purple keyword accents.
          </span>
        `)}
      </div>
      <div class="field-row single">
        ${field('Tagline / Fallback Description', textArea('identity.tagline', id.tagline, 2))}
      </div>
      <div class="field-divider"></div>
      <div class="field-label" style="margin-bottom:8px;">TYPING ANIMATION ROLES</div>
      <div class="array-list">${rolesHtml}</div>
      <button class="add-item-btn" onclick="addRole()"><i class="fa-solid fa-plus"></i> Add Typing Role</button>
      <div class="field-divider"></div>
      <div class="field-row single">
        ${field('About Me Profile Reel Images (Slot Machine Reel — 1 per line)', `
          <textarea class="field-textarea" rows="3" placeholder="profile1.png&#10;profile2.png" oninput="updateProfileImages(this.value)">${esc(profileImagesVal)}</textarea>
          <span class="field-hint" style="display:block; margin-top:4px; font-size:11px; color:var(--text-muted);">
            Enter multiple image URLs or file names (one per line) to power the vertical rolling slot machine reel in About Me. Spins every 1.8s!
          </span>
          ${profilePreviews ? `<div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">${profilePreviews}</div>` : ''}
        `)}
      </div>
      <div class="field-row">
        ${field('Resume File URL', urlInput('identity.resumeUrl', id.resumeUrl), 'Google Drive, PDF, or CDN link')}
      </div>`
    );
}

window.updateIntroParagraphs = function (val) {
  const arr = val.split('\n').map(s => s.trim()).filter(Boolean);
  DATA.identity.introParagraphs = arr;
  markDirty();
};

window.updateProfileImages = function (val) {
  const arr = val.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  DATA.identity.profileImages = arr;
  if (arr.length > 0) DATA.identity.profileImage = arr[0];
  markDirty();
};

window.addRole = function () {
  DATA.identity.roles = DATA.identity.roles || [];
  DATA.identity.roles.push('Full Stack Developer');
  markDirty();
  renderEditor();
};

window.removeRole = function (i) {
  DATA.identity.roles.splice(i, 1);
  markDirty();
  renderEditor();
};

/* ---- ABOUT ---- */
function renderAboutSection() {
  const ab = DATA.about || {};
  ab.items = ab.items || (ab.paragraphs ? ab.paragraphs.map(p => ({ icon: 'fa-regular fa-user', text: p })) : []);

  const itemsHtml = (ab.items || []).map((item, i) => `
    <div class="array-item" style="align-items:start; flex-direction:column; gap:8px; margin-bottom:12px;">
      <div style="display:flex; gap:10px; width:100%; align-items:center;">
        <input type="text" class="field-input" value="${esc(item.icon || '')}" placeholder="fa-regular fa-user" style="flex:0 0 160px"
          oninput="DATA.about.items[${i}].icon=this.value; markDirty()">
        <span style="font-size:12px; color:var(--text-muted); flex:1;">Icon (FontAwesome)</span>
        <button class="btn-icon-action danger" onclick="DATA.about.items.splice(${i},1); markDirty(); renderEditor()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <textarea class="field-textarea" rows="2" placeholder="Item description with HTML..."
        oninput="DATA.about.items[${i}].text=this.value; markDirty()">${esc(item.text || '')}</textarea>
    </div>`).join('');

  const chips = (ab.chips || []).map((c, i) => `
    <div class="array-item">
      <input type="text" class="field-input" value="${esc(c.icon)}" placeholder="fa-solid fa-code" style="flex:0 0 150px"
        oninput="DATA.about.chips[${i}].icon=this.value; markDirty()">
      <input type="text" class="field-input" value="${esc(c.label)}" placeholder="Badge Label..."
        oninput="DATA.about.chips[${i}].label=this.value; markDirty()">
      <button class="btn-icon-action danger" onclick="DATA.about.chips.splice(${i},1); markDirty(); renderEditor()">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  return makeSection('about',
    'fa-solid fa-user',
    'About Me',
    'headline manifesto · narrative items · stat chips',
    `${(ab.items||[]).length} Feature Items`,
    `<div class="field-group" style="margin-bottom:14px;">
      <label class="field-label">MANIFESTO HEADLINE <span style="font-size:10px;font-weight:400;color:var(--text-muted);">(HTML allowed)</span></label>
      <textarea class="field-textarea" rows="2" placeholder="A curious <span class='text-accent'>learner</span>..."
        oninput="DATA.about.manifesto=this.value; markDirty()">${esc(ab.manifesto || '')}</textarea>
    </div>
    <div class="field-divider"></div>
    <div class="field-label" style="margin-bottom:8px;">NARRATIVE FEATURE ITEMS <span style="font-size:10px;font-weight:400;color:var(--text-muted);">(HTML allowed)</span></div>
    <div class="array-list">${itemsHtml}</div>
    <button class="add-item-btn" onclick="DATA.about.items=DATA.about.items||[]; DATA.about.items.push({icon:'fa-regular fa-user', text:'New description...'}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Item</button>
    <div class="field-divider"></div>
    <div class="field-label" style="margin-bottom:8px;">PROFILE STAT CHIPS</div>
    <div class="array-list">${chips}</div>
    <button class="add-item-btn" onclick="DATA.about.chips=DATA.about.chips||[]; DATA.about.chips.push({icon:'fa-solid fa-code',label:'200+ LeetCode'}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Stat Chip</button>`
  );
}

/* ---- SKILLS ---- */
function renderSkillsSection() {
  const cats = DATA.skills || [];
  let totalSkills = 0;

  const catsHtml = cats.map((cat, ci) => {
    totalSkills += (cat.items || []).length;
    const itemsHtml = (cat.items || []).map((sk, si) => `
      <div class="field-row" style="align-items:end; gap:10px; margin-bottom:10px;">
        <div class="field-group" style="flex:0 0 130px">
          <label class="field-label">Icon</label>
          <input type="text" class="field-input" value="${esc(sk.icon)}" placeholder="fa-brands fa-react"
            oninput="DATA.skills[${ci}].items[${si}].icon=this.value; markDirty()">
        </div>
        <div class="field-group" style="flex:1">
          <label class="field-label">Skill Name</label>
          <input type="text" class="field-input" value="${esc(sk.name)}"
            oninput="DATA.skills[${ci}].items[${si}].name=this.value; markDirty()">
        </div>
        <div class="field-group" style="flex:0 0 180px">
          <label class="field-label">Proficiency Level</label>
          <div class="skill-range-wrap">
            <input type="range" class="field-range" min="0" max="100" value="${sk.level}"
              oninput="DATA.skills[${ci}].items[${si}].level=parseInt(this.value); this.nextElementSibling.textContent=this.value+'%'; markDirty()">
            <span class="range-val-badge">${sk.level}%</span>
          </div>
        </div>
        <button class="btn-icon-action" onclick="moveItem('skills.${ci}.items', ${si}, -1)" title="Move Up"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="btn-icon-action" onclick="moveItem('skills.${ci}.items', ${si}, 1)" title="Move Down"><i class="fa-solid fa-chevron-down"></i></button>
        <button class="btn-icon-action danger" onclick="DATA.skills[${ci}].items.splice(${si},1); markDirty(); renderEditor()" title="Remove Skill"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('skill-cat-${ci}')">
        <i class="${esc(cat.icon)}" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(cat.category)}</span>
        <span class="list-item-meta">${(cat.items||[]).length} skills</span>
        <div class="list-item-actions">
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('skills', ${ci}, -1)" title="Move Category Up"><i class="fa-solid fa-chevron-up"></i></button>
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('skills', ${ci}, 1)" title="Move Category Down"><i class="fa-solid fa-chevron-down"></i></button>
          <button class="btn-icon-action danger" onclick="event.stopPropagation(); DATA.skills.splice(${ci},1); markDirty(); renderEditor()" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="list-item-body" id="skill-cat-${ci}">
        <div class="field-row" style="margin-bottom:12px;">
          <div class="field-group">
            <label class="field-label">Category Name</label>
            <input type="text" class="field-input" value="${esc(cat.category)}" oninput="DATA.skills[${ci}].category=this.value; markDirty()">
          </div>
          <div class="field-group">
            <label class="field-label">Category Icon</label>
            <input type="text" class="field-input" value="${esc(cat.icon)}" oninput="DATA.skills[${ci}].icon=this.value; markDirty()">
          </div>
        </div>
        <div class="field-label" style="margin-bottom:8px;">SKILL PROFICIENCIES</div>
        ${itemsHtml}
        <button class="add-item-btn" style="margin-top:6px;" onclick="DATA.skills[${ci}].items.push({name:'New Skill',icon:'fa-solid fa-star',level:85}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Skill</button>
      </div>
    </div>`;
  }).join('');

  return makeSection('skills',
    'fa-solid fa-layer-group',
    'Skills & Proficiency',
    'categorized skills with proficiency % bars',
    `${cats.length} Categories (${totalSkills} Skills)`,
    `<div class="list-items">${catsHtml}</div>
    <button class="add-item-btn" onclick="DATA.skills.push({category:'New Category',icon:'fa-solid fa-terminal',items:[]}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add New Category</button>`
  );
}

/* ---- EXPERIENCE ---- */
function renderExperienceSection() {
  const exps = DATA.experience || [];

  const html = exps.map((exp, i) => {
    // Normalize metrics
    let metrics = exp.metrics || [];
    if (!Array.isArray(metrics)) metrics = [];
    const metricsHtml = metrics.map((m, mi) => `
      <div class="array-item" style="display:grid; grid-template-columns: 80px 1fr 1fr 34px; gap:8px; align-items:center; margin-bottom:6px;">
        <input type="text" class="field-input" placeholder="Icon" value="${esc(m.icon || 'chart-no-axes-combined')}" oninput="updateExperienceMetric(${i}, ${mi}, 'icon', this.value)">
        <input type="text" class="field-input" placeholder="Number (e.g. 1.2K+)" value="${esc(m.val || m.number || m.num || '')}" oninput="updateExperienceMetric(${i}, ${mi}, 'val', this.value)">
        <input type="text" class="field-input" placeholder="Label (e.g. AI Responses)" value="${esc(m.lbl || m.label || '')}" oninput="updateExperienceMetric(${i}, ${mi}, 'lbl', this.value)">
        <button class="btn-icon-action danger" onclick="removeExperienceMetric(${i}, ${mi})"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');

    // Normalize contributions / bullets
    const contribs = (exp.contributions || exp.bullets || []).map((c, ci) => `
      <div class="array-item">
        <input type="text" class="field-input" value="${esc(typeof c === 'string' ? c : c.text || '')}" placeholder="Contribution description..." oninput="updateExperienceContrib(${i}, ${ci}, this.value)">
        <button class="btn-icon-action danger" onclick="removeExperienceContrib(${i}, ${ci})"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('exp-${i}')">
        <i class="fa-solid fa-brain" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(exp.title || 'Role')} — ${esc(exp.company || 'Company')}</span>
        <span class="list-item-meta">${esc(exp.type || 'Freelance')} · ${esc(exp.date || 'Present')}</span>
        <div class="list-item-actions">
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('experience', ${i}, -1)" title="Move Up"><i class="fa-solid fa-chevron-up"></i></button>
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('experience', ${i}, 1)" title="Move Down"><i class="fa-solid fa-chevron-down"></i></button>
          <button class="btn-icon-action danger" onclick="event.stopPropagation(); DATA.experience.splice(${i},1); markDirty(); renderEditor()" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="list-item-body" id="exp-${i}">
        <div class="field-row triple">
          ${field('Role Title', `<input type="text" class="field-input" value="${esc(exp.title || '')}" placeholder="AI Trainer & LLM Evaluator" oninput="DATA.experience[${i}].title=this.value; markDirty()">`)}
          ${field('Company / Lab', `<input type="text" class="field-input" value="${esc(exp.company || '')}" placeholder="Outlier AI" oninput="DATA.experience[${i}].company=this.value; markDirty()">`)}
          ${field('Category (Filter)', `
            <select class="field-input" onchange="DATA.experience[${i}].type=this.value; markDirty()">
              <option value="Freelance" ${/freelance/i.test(exp.type || '') ? 'selected' : ''}>Freelance</option>
              <option value="Internship" ${/intern/i.test(exp.type || '') ? 'selected' : ''}>Internship</option>
              <option value="Part-Time" ${/part/i.test(exp.type || '') ? 'selected' : ''}>Part-Time</option>
            </select>
          `)}
        </div>
        <div class="field-row triple">
          ${field('Date / Duration', `<input type="text" class="field-input" value="${esc(exp.date || '')}" placeholder="Jan 2024 – Present" oninput="DATA.experience[${i}].date=this.value; markDirty()">`)}
          ${field('Icon Name (Lucide)', `<input type="text" class="field-input" value="${esc(exp.icon || 'brain')}" placeholder="brain, cpu, sparkles, bot" oninput="DATA.experience[${i}].icon=this.value; markDirty()">`)}
          ${field('Visual 3D Graphic', `
            <select class="field-input" onchange="DATA.experience[${i}].visual=this.value; markDirty()">
              <option value="ai-stack" ${exp.visual !== 'model-visual' ? 'selected' : ''}>AI Layer Stack</option>
              <option value="model-visual" ${exp.visual === 'model-visual' ? 'selected' : ''}>ML Model Platform</option>
            </select>
          `)}
        </div>
        <div class="field-row">
          <div style="display:flex; align-items:center; gap:8px; margin:4px 0 12px;">
            <input type="checkbox" id="exp-curr-${i}" ${exp.current || /present/i.test(exp.date || '') ? 'checked' : ''} onchange="DATA.experience[${i}].current=this.checked; markDirty()">
            <label for="exp-curr-${i}" style="font-size:13px; font-weight:600; cursor:pointer; color:var(--text-main);">Show "Current" Badge</label>
          </div>
        </div>
        
        <div class="field-divider"></div>
        <div class="field-label" style="margin-bottom:8px;">KEY METRICS &amp; STATS (3 Horizontal Cards)</div>
        <div class="array-list">${metricsHtml}</div>
        <button class="add-item-btn" onclick="addExperienceMetric(${i})"><i class="fa-solid fa-plus"></i> Add Metric</button>

        <div class="field-divider"></div>
        <div class="field-label" style="margin-bottom:8px;">KEY CONTRIBUTIONS &amp; BULLETS</div>
        <div class="array-list">${contribs}</div>
        <button class="add-item-btn" onclick="addExperienceContrib(${i})"><i class="fa-solid fa-plus"></i> Add Contribution</button>
      </div>
    </div>`;
  }).join('');

  return makeSection('experience',
    'fa-solid fa-briefcase',
    'Experience Timeline',
    'roles · internships · research milestones',
    `${exps.length} Entries`,
    `<div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="addExperienceEntry()"><i class="fa-solid fa-plus"></i> Add Experience Entry</button>`
  );
}

window.updateExperienceMetric = function(expIdx, metricIdx, key, value) {
  DATA.experience[expIdx].metrics = DATA.experience[expIdx].metrics || [];
  if (!DATA.experience[expIdx].metrics[metricIdx]) {
    DATA.experience[expIdx].metrics[metricIdx] = { val: '', lbl: '', icon: 'chart-no-axes-combined' };
  }
  DATA.experience[expIdx].metrics[metricIdx][key] = value;
  markDirty();
};

window.addExperienceMetric = function(expIdx) {
  DATA.experience[expIdx].metrics = DATA.experience[expIdx].metrics || [];
  DATA.experience[expIdx].metrics.push({ val: '100+', lbl: 'New Metric', icon: 'chart-no-axes-combined' });
  markDirty();
  renderEditor();
};

window.removeExperienceMetric = function(expIdx, metricIdx) {
  if (DATA.experience[expIdx].metrics) {
    DATA.experience[expIdx].metrics.splice(metricIdx, 1);
    markDirty();
    renderEditor();
  }
};

window.updateExperienceContrib = function(expIdx, contribIdx, value) {
  if (!DATA.experience[expIdx].contributions) {
    DATA.experience[expIdx].contributions = DATA.experience[expIdx].bullets || [];
  }
  DATA.experience[expIdx].contributions[contribIdx] = value;
  DATA.experience[expIdx].bullets = DATA.experience[expIdx].contributions;
  markDirty();
};

window.addExperienceContrib = function(expIdx) {
  if (!DATA.experience[expIdx].contributions) {
    DATA.experience[expIdx].contributions = DATA.experience[expIdx].bullets || [];
  }
  DATA.experience[expIdx].contributions.push('New key milestone achieved...');
  DATA.experience[expIdx].bullets = DATA.experience[expIdx].contributions;
  markDirty();
  renderEditor();
};

window.removeExperienceContrib = function(expIdx, contribIdx) {
  if (!DATA.experience[expIdx].contributions) {
    DATA.experience[expIdx].contributions = DATA.experience[expIdx].bullets || [];
  }
  DATA.experience[expIdx].contributions.splice(contribIdx, 1);
  DATA.experience[expIdx].bullets = DATA.experience[expIdx].contributions;
  markDirty();
  renderEditor();
};

window.addExperienceEntry = function() {
  DATA.experience = DATA.experience || [];
  DATA.experience.push({
    title: 'AI / ML Engineer',
    company: 'Company / Lab Name',
    type: 'Freelance',
    date: '2024 – Present',
    current: true,
    icon: 'brain',
    jobIcon: 'brain-circuit',
    metrics: [
      { val: '1.2K+', lbl: 'Models Evaluated', icon: 'chart-no-axes-combined' },
      { val: '95%', lbl: 'Accuracy Score', icon: 'target' },
      { val: '10+', lbl: 'Pipelines Built', icon: 'rocket' }
    ],
    contributions: [
      'Developed deep learning architectures and optimized training performance',
      'Engineered scalable data processing and evaluation workflows'
    ],
    visual: 'ai-stack'
  });
  markDirty();
  renderEditor();
};

/* ---- PROJECTS ---- */
function renderProjectsSection() {
  const projs = DATA.projects || [];

  const html = projs.map((proj, i) => {
    const techTags = (proj.tech || []).map((t, ti) => `
      <span class="tag-item">
        ${esc(t)}
        <span class="tag-remove" onclick="DATA.projects[${i}].tech.splice(${ti},1); markDirty(); renderEditor()">✕</span>
      </span>`).join('');

    // Normalize stats array
    let stats = proj.stats || [];
    if (!Array.isArray(stats)) stats = [];
    const statsHtml = stats.map((st, si) => {
      const sVal = (typeof st === 'object' && st !== null) ? (st.val || st.value || '') : (Array.isArray(st) ? st[0] : String(st));
      const sLbl = (typeof st === 'object' && st !== null) ? (st.lbl || st.label || '') : (Array.isArray(st) ? st[1] : '');
      const sIcon = (typeof st === 'object' && st !== null) ? (st.icon || 'gauge') : 'gauge';

      return `
      <div class="array-item" style="display:grid; grid-template-columns: 80px 1fr 1fr 34px; gap:8px; align-items:center; margin-bottom:6px;">
        <input type="text" class="field-input" placeholder="Icon" value="${esc(sIcon)}" oninput="updateProjectStat(${i}, ${si}, 'icon', this.value)">
        <input type="text" class="field-input" placeholder="Value (e.g. 100+)" value="${esc(sVal)}" oninput="updateProjectStat(${i}, ${si}, 'val', this.value)">
        <input type="text" class="field-input" placeholder="Label (e.g. Processes)" value="${esc(sLbl)}" oninput="updateProjectStat(${i}, ${si}, 'lbl', this.value)">
        <button class="btn-icon-action danger" onclick="removeProjectStat(${i}, ${si})"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    }).join('');

    return `
    <div class="list-item">
      <div class="list-item-header" onclick="toggleListItem('proj-${i}')">
        <i class="fa-solid fa-folder-open" style="color:var(--accent);width:16px;text-align:center;"></i>
        <span class="list-item-title">${esc(proj.title)}</span>
        <span class="list-item-meta">${esc(proj.typeLabel || proj.type || 'WEB APP')} · ${(proj.tech||[]).slice(0,2).join(', ')}</span>
        <div class="list-item-actions">
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('projects', ${i}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('projects', ${i}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
          <button class="btn-icon-action danger" onclick="event.stopPropagation(); DATA.projects.splice(${i},1); markDirty(); renderEditor()"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="list-item-body" id="proj-${i}">
        <div class="field-row">
          ${field('Project Title', `<input type="text" class="field-input" value="${esc(proj.title)}" oninput="DATA.projects[${i}].title=this.value; markDirty()">`)}
          ${field('Category (Filter)', `
            <select class="field-input" onchange="DATA.projects[${i}].type=this.value; DATA.projects[${i}].typeLabel=this.options[this.selectedIndex].text.toUpperCase(); markDirty(); renderEditor()">
              <option value="web" ${proj.type === 'web' ? 'selected' : ''}>Web App</option>
              <option value="hardware" ${proj.type === 'hardware' ? 'selected' : ''}>Hardware</option>
              <option value="tool" ${proj.type === 'tool' ? 'selected' : ''}>Tool</option>
            </select>
          `)}
        </div>
        <div class="field-row">
          ${field('Type Badge Label', `<input type="text" class="field-input" value="${esc(proj.typeLabel || (proj.type ? proj.type.toUpperCase() : 'WEB APP'))}" oninput="DATA.projects[${i}].typeLabel=this.value; markDirty()">`)}
          ${field('Cover Image URL / Path', `
            <input type="text" class="field-input" value="${esc(proj.image || '')}" placeholder="https://... or image.png" oninput="DATA.projects[${i}].image=this.value; markDirty()">
          `)}
        </div>
        <div class="field-row single">
          ${field('Short Summary', `<textarea class="field-textarea" rows="2" oninput="DATA.projects[${i}].description=this.value; markDirty()">${esc(proj.description)}</textarea>`)}
        </div>
        <div class="field-row">
          ${field('GitHub Repository URL', `<input type="url" class="field-input" value="${esc(proj.github||'')}" placeholder="https://github.com/..." oninput="DATA.projects[${i}].github=this.value; markDirty()">`)}
          ${field('Live Demo URL', `<input type="url" class="field-input" value="${esc(proj.demo||'')}" placeholder="https://..." oninput="DATA.projects[${i}].demo=this.value; markDirty()">`)}
        </div>
        <div class="field-label" style="margin-bottom:8px;">QUICK METRICS / STATS (3 Columns)</div>
        <div class="array-list">${statsHtml}</div>
        <button class="add-item-btn" onclick="addProjectStat(${i})"><i class="fa-solid fa-plus"></i> Add Metric</button>
        <div class="field-divider"></div>
        <div class="field-label" style="margin-bottom:8px;">TECHNOLOGY TAGS</div>
        <div class="tag-list">${techTags}</div>
        <div class="tag-add-row">
          <input type="text" class="field-input" id="tech-add-${i}" placeholder="Add technology tag (e.g. React)..." onkeydown="if(event.key==='Enter'){event.preventDefault(); addTech(${i});}">
          <button class="btn-dock btn-dock-secondary" onclick="addTech(${i})"><i class="fa-solid fa-plus"></i> Add Tag</button>
        </div>
      </div>
    </div>`;
  }).join('');

  return makeSection('projects',
    'fa-solid fa-folder',
    'Projects Grid',
    'featured project cards with filters, 3-metric stats & tech tags',
    `${projs.length} Projects`,
    `<div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="DATA.projects.push({title:'New Project',type:'web',typeLabel:'WEB APP',image:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',description:'Short project description here...',stats:[{icon:'gauge',val:'100+',lbl:'Users'},{icon:'zap',val:'Fast',lbl:'Performance'},{icon:'activity',val:'Live',lbl:'Status'}],tech:['React','TypeScript'],github:'https://github.com/',demo:'https://github.com/'}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Project Card</button>`
  );
}

window.updateProjectStat = function (pi, si, key, val) {
  if (!DATA.projects[pi].stats) DATA.projects[pi].stats = [];
  let s = DATA.projects[pi].stats[si];
  if (Array.isArray(s)) {
    s = { val: s[0] || '', lbl: s[1] || '', icon: 'gauge' };
    DATA.projects[pi].stats[si] = s;
  } else if (typeof s !== 'object' || s === null) {
    s = { val: String(s), lbl: '', icon: 'gauge' };
    DATA.projects[pi].stats[si] = s;
  }
  s[key] = val;
  markDirty();
};

window.addProjectStat = function (pi) {
  if (!DATA.projects[pi].stats) DATA.projects[pi].stats = [];
  DATA.projects[pi].stats.push({ icon: 'gauge', val: 'New', lbl: 'Metric' });
  markDirty();
  renderEditor();
};

window.removeProjectStat = function (pi, si) {
  if (!DATA.projects[pi].stats) return;
  DATA.projects[pi].stats.splice(si, 1);
  markDirty();
  renderEditor();
};

window.updateProjectImages = function (pi, val) {
  const arr = val.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  DATA.projects[pi].images = arr;
  markDirty();
};

window.addTech = function (pi) {
  const input = document.getElementById(`tech-add-${pi}`);
  if (!input || !input.value.trim()) return;
  DATA.projects[pi].tech = DATA.projects[pi].tech || [];
  DATA.projects[pi].tech.push(input.value.trim());
  input.value = '';
  markDirty();
  renderEditor();
};

/* ---- STATS ---- */
function renderStatsSection() {
  const stats = DATA.stats || [];

  const html = stats.map((s, i) => `
    <div class="field-row" style="align-items:end; gap:8px; margin-bottom:10px;">
      <div class="field-group" style="flex:0 0 140px">
        <label class="field-label">Icon</label>
        <input type="text" class="field-input" value="${esc(s.icon)}" placeholder="fa-solid fa-fire"
          oninput="DATA.stats[${i}].icon=this.value; markDirty()">
      </div>
      <div class="field-group" style="flex:1">
        <label class="field-label">Label</label>
        <input type="text" class="field-input" value="${esc(s.label)}"
          oninput="DATA.stats[${i}].label=this.value; markDirty()">
      </div>
      <div class="field-group" style="flex:0 0 90px">
        <label class="field-label">Value</label>
        <input type="text" class="field-input" value="${esc(String(s.value||s.suffix||''))}"
          oninput="DATA.stats[${i}].value=isNaN(+this.value)?null:+this.value; DATA.stats[${i}].suffix=isNaN(+this.value)?this.value:'+'; DATA.stats[${i}].isText=isNaN(+this.value); markDirty()">
      </div>
      <button class="btn-icon-action" onclick="moveItem('stats', ${i}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
      <button class="btn-icon-action" onclick="moveItem('stats', ${i}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
      <button class="btn-icon-action danger" onclick="DATA.stats.splice(${i},1); markDirty(); renderEditor()"><i class="fa-solid fa-trash"></i></button>
    </div>`).join('');

  return makeSection('stats',
    'fa-solid fa-trophy',
    'Achievements & Stats',
    'numeric metric cards in achievements section',
    `${stats.length} Badges`,
    `${html}
    <button class="add-item-btn" onclick="DATA.stats.push({value:100,suffix:'+',label:'Contributions',icon:'fa-solid fa-code'}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Stat Badge</button>`
  );
}

/* ---- CERTIFICATES ---- */
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
          ${cert.featured ? '<span style="font-size:10px;color:var(--amber);font-weight:700;margin-right:6px;">★ Featured</span>' : ''}
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('certificates', ${i}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
          <button class="btn-icon-action" onclick="event.stopPropagation(); moveItem('certificates', ${i}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
          <button class="btn-icon-action danger" onclick="event.stopPropagation(); DATA.certificates.splice(${i},1); markDirty(); renderEditor()"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="list-item-body" id="cert-${i}">
        <div class="field-row">
          ${field('Certificate Title', `<input type="text" class="field-input" value="${esc(cert.title)}" oninput="DATA.certificates[${i}].title=this.value; markDirty()">`)}
          ${field('Issuing Organization', `<input type="text" class="field-input" value="${esc(cert.issuer)}" oninput="DATA.certificates[${i}].issuer=this.value; markDirty()">`)}
        </div>
        <div class="field-row">
          ${field('Category Filter', `<select class="field-select" onchange="DATA.certificates[${i}].category=this.value; markDirty()">${catOptions}</select>`)}
          ${field('Icon Class', `<input type="text" class="field-input" value="${esc(cert.icon)}" placeholder="fa-solid fa-certificate" oninput="DATA.certificates[${i}].icon=this.value; markDirty()">`)}
        </div>
        <div class="field-row">
          ${field('Embed / Verification URL', `<input type="url" class="field-input" value="${esc(cert.url||'')}" placeholder="https://..." oninput="DATA.certificates[${i}].url=this.value; markDirty()">`)}
          <div class="field-group" style="justify-content:flex-end;padding-top:20px;">
            <label class="toggle-row">
              <input type="checkbox" class="toggle" ${cert.featured ? 'checked' : ''} onchange="DATA.certificates[${i}].featured=this.checked; markDirty(); renderEditor()">
              <span style="font-size:12.5px;font-weight:600;color:var(--text-main);">Feature on top</span>
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
    'Certificates Catalog',
    'all credentials with preview links & categories',
    `${certs.length} Certs`,
    `<div class="field-label" style="margin-bottom:8px;">FILTER CATEGORIES</div>
    <div class="tag-list">${certCatTags}</div>
    <div class="tag-add-row" style="margin-bottom:18px;">
      <input type="text" class="field-input" id="cert-cat-add" placeholder="Add new category filter..." onkeydown="if(event.key==='Enter'){event.preventDefault(); addCertCat();}">
      <button class="btn-dock btn-dock-secondary" onclick="addCertCat()"><i class="fa-solid fa-plus"></i> Add</button>
    </div>
    <div class="list-items">${html}</div>
    <button class="add-item-btn" onclick="DATA.certificates.push({title:'New Certificate',issuer:'Issuing Org',category:'Programming',icon:'fa-solid fa-certificate',featured:false,url:''}); markDirty(); renderEditor()"><i class="fa-solid fa-plus"></i> Add Certificate</button>`
  );
}

window.addCertCat = function () {
  const input = document.getElementById('cert-cat-add');
  if (!input || !input.value.trim()) return;
  DATA.certCategories = DATA.certCategories || ['All'];
  if (!DATA.certCategories.includes(input.value.trim())) {
    DATA.certCategories.push(input.value.trim());
  }
  input.value = '';
  markDirty();
  renderEditor();
};

/* ---- SOCIALS ---- */
function renderSocialsSection() {
  const s = DATA.socials || {};
  return makeSection('socials',
    'fa-solid fa-share-nodes',
    'Social Links',
    'GitHub · LinkedIn · Email · LeetCode',
    '',
    `<div class="field-row">
      ${field('GitHub Profile URL', urlInput('socials.github', s.github))}
      ${field('LinkedIn Profile URL', urlInput('socials.linkedin', s.linkedin))}
    </div>
    <div class="field-row">
      ${field('Email Address', emailInput('socials.email', s.email))}
      ${field('LeetCode Profile URL', urlInput('socials.leetcode', s.leetcode))}
    </div>`
  );
}

/* ---- CONTACT ---- */
function renderContactSection() {
  const ct = DATA.contact || {};
  return makeSection('contact',
    'fa-solid fa-envelope',
    'Contact Section',
    'heading · description copy · phone number',
    '',
    `<div class="field-row">
      ${field('Section Heading', textInput('contact.heading', ct.heading, "Let's Connect"))}
      ${field('Phone Number', textInput('contact.phone', ct.phone, '+91 000-000-0000'))}
    </div>
    <div class="field-row single">
      ${field('Introductory Body Text', textArea('contact.body', ct.body, 2))}
    </div>`
  );
}

/* ================================================================
   7. MAIN EDITOR RENDERER & METRICS
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

  updateMetrics();
  setupSectionScrollObserver();
}

function updateMetrics() {
  const metricsWrap = document.getElementById('banner-metrics-wrap');
  if (!metricsWrap || !DATA) return;

  const totalSkills = (DATA.skills || []).reduce((acc, cat) => acc + (cat.items || []).length, 0);
  const totalProjects = (DATA.projects || []).length;
  const totalCerts = (DATA.certificates || []).length;
  const totalExps = (DATA.experience || []).length;

  metricsWrap.innerHTML = `
    <div class="metric-badge"><span class="metric-val">${totalProjects}</span><span class="metric-lbl">Projects</span></div>
    <div class="metric-badge"><span class="metric-val">${totalSkills}</span><span class="metric-lbl">Skills</span></div>
    <div class="metric-badge"><span class="metric-val">${totalCerts}</span><span class="metric-lbl">Certs</span></div>
    <div class="metric-badge"><span class="metric-val">${totalExps}</span><span class="metric-lbl">Experience</span></div>
  `;
}

/* ================================================================
   8. SIDEBAR & INTERSECTION OBSERVER
   ================================================================ */

function buildSidebar() {
  const items = [
    { section: 'site', icon: 'fa-globe', label: 'Site & Theme' },
    { section: 'sections', icon: 'fa-eye', label: 'Visibility' },
    { section: 'identity', icon: 'fa-id-card', label: 'Identity & Hero' },
    { section: 'about', icon: 'fa-user', label: 'About Me' },
    { section: 'skills', icon: 'fa-layer-group', label: 'Skills', count: (DATA.skills||[]).reduce((a,c)=>a+(c.items||[]).length,0) },
    { section: 'experience', icon: 'fa-briefcase', label: 'Experience', count: (DATA.experience||[]).length },
    { section: 'projects', icon: 'fa-folder', label: 'Projects', count: (DATA.projects||[]).length },
    { section: 'stats', icon: 'fa-trophy', label: 'Stats Badges', count: (DATA.stats||[]).length },
    { section: 'certificates', icon: 'fa-certificate', label: 'Certificates', count: (DATA.certificates||[]).length },
    { section: 'socials', icon: 'fa-share-nodes', label: 'Socials' },
    { section: 'contact', icon: 'fa-envelope', label: 'Contact' },
  ];

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = items.map(item => `
    <li class="sidebar-nav-item">
      <button class="sidebar-nav-btn" data-section="${item.section}" onclick="scrollToSection('${item.section}')">
        <div class="nav-btn-left">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.label}</span>
        </div>
        ${item.count !== undefined ? `<span class="nav-count-badge">${item.count}</span>` : ''}
      </button>
    </li>`).join('');
}

window.scrollToSection = function(id) {
  const el = document.getElementById('section-' + id);
  if (!el) return;
  
  // Ensure section is open
  el.classList.add('open');
  openSections.add(id);

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateSidebarActive(id);

  // Close mobile sidebar if open
  closeMobileSidebar();
};

function updateSidebarActive(id) {
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-section') === id);
  });
}

function setupSectionScrollObserver() {
  const sections = document.querySelectorAll('.editor-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const name = entry.target.getAttribute('data-section-name');
        if (name) updateSidebarActive(name);
      }
    });
  }, { threshold: 0.25, rootMargin: '-60px 0px -40% 0px' });

  sections.forEach(sec => observer.observe(sec));
}

/* ================================================================
   9. GLOBAL SEARCH & KEYBOARD SHORTCUTS
   ================================================================ */

function setupSearchAndShortcuts() {
  const searchInput = document.getElementById('admin-global-search');
  const searchBtn = document.getElementById('admin-search-btn');
  const clearBtn = document.getElementById('admin-search-clear-btn');

  function performSearch() {
    if (!searchInput) return;
    const q = searchInput.value.toLowerCase().trim();
    const sections = document.querySelectorAll('.editor-section');
    
    if (clearBtn) {
      clearBtn.style.display = q ? 'inline-block' : 'none';
    }

    sections.forEach(sec => {
      const text = sec.innerText.toLowerCase();
      if (!q || text.includes(q)) {
        sec.style.display = '';
        if (q) sec.classList.add('open');
      } else {
        sec.style.display = 'none';
      }
    });
  }

  function clearSearch() {
    if (!searchInput) return;
    searchInput.value = '';
    performSearch();
  }

  if (searchInput) {
    // Reset value on setup so browser cached text does not auto-filter
    searchInput.value = '';

    // Execute search ONLY when user presses Enter key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });

    // Show/hide clear button on input, but do NOT auto-execute search
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim();
      if (clearBtn) {
        clearBtn.style.display = val ? 'inline-block' : 'none';
      }
      // If user deletes all text manually, reset section visibility
      if (!val) {
        performSearch();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      performSearch();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSearch();
    });
  }

  // Keyboard Shortcuts: Ctrl+S to save, Ctrl+K to search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveData();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) { searchInput.focus(); searchInput.select(); }
    }
    if (e.key === 'Escape') {
      if (searchInput && document.activeElement === searchInput) {
        clearSearch();
        searchInput.blur();
      }
      closeSupabaseModal();
      closeMobileSidebar();
    }
  });

  // Mobile sidebar controls
  const toggleBtn = document.getElementById('mobile-sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sb = document.getElementById('admin-sidebar');
      if (sb) sb.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('active');
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sb = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sb) sb.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

/* ================================================================
   10. EXPORT / IMPORT / RESET
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
        buildSidebar();
        saveData();
        toast('JSON imported and synchronized!', 'success');
      } catch (err) {
        toast('Invalid JSON file format', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

window.resetToFile = async function () {
  if (!confirm('Reset all fields back to default portfolio.json? Unsaved changes will be replaced.')) return;
  try {
    const res = await fetch('./portfolio.json');
    DATA = await res.json();
    renderEditor();
    buildSidebar();
    saveData();
    toast('Reset to default portfolio.json', 'info');
  } catch (err) {
    toast('Could not reload portfolio.json', 'error');
  }
};

/* ================================================================
   11. GATEKEEPER AUTHENTICATION & INITIALIZATION
   ================================================================ */

function checkGatekeeperAuth() {
  const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
  const modal = document.getElementById('admin-gatekeeper-modal');
  const form = document.getElementById('admin-gatekeeper-form');
  const userIn = document.getElementById('gk-user');
  const passIn = document.getElementById('gk-pass');
  const errBox = document.getElementById('gk-error');

  if (!isAuth) {
    if (modal) modal.style.display = 'flex';
    if (userIn) setTimeout(() => userIn.focus(), 150);
  } else {
    if (modal) modal.style.display = 'none';
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = (userIn ? userIn.value : '').trim();
      const p = (passIn ? passIn.value : '').trim();

      if (u === 'admin' && p === 'admin') {
        sessionStorage.setItem('admin_authenticated', 'true');
        if (errBox) errBox.style.display = 'none';
        if (modal) modal.style.display = 'none';
        toast('Welcome to Control Room', 'success');
      } else {
        if (errBox) {
          errBox.style.display = 'flex';
        }
        if (passIn) {
          passIn.value = '';
          passIn.focus();
        }
      }
    });
  }
}

window.lockAdminSession = function() {
  sessionStorage.removeItem('admin_authenticated');
  const modal = document.getElementById('admin-gatekeeper-modal');
  if (modal) modal.style.display = 'flex';
  const userIn = document.getElementById('gk-user');
  const passIn = document.getElementById('gk-pass');
  if (userIn) userIn.value = '';
  if (passIn) passIn.value = '';
  toast('Control Room session locked', 'info');
};

async function init() {
  checkGatekeeperAuth();

  try {
    DATA = await loadData();
  } catch (err) {
    console.error('[Admin] Failed to load data:', err);
    document.getElementById('editor-container').innerHTML =
      `<div class="loading-state-card" style="color:var(--rose)">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:24px; margin-bottom:12px;"></i>
        <p>Failed to load portfolio content.</p>
      </div>`;
    return;
  }

  buildSidebar();
  renderEditor();
  updateSupabaseStatusBadge();
  setupSearchAndShortcuts();

  const brandName = document.getElementById('admin-brand-name');
  if (brandName) brandName.textContent = DATA.site?.name || DATA.identity?.brand || 'Portfolio Studio';

  setStatus('saved');

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

init();


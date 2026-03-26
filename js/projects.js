function renderProjects() {
  const g = document.getElementById('proj-grid');
  g.innerHTML = '';
  state.projects.forEach(p => {
    const devCount = p.devices.length;
    const rackCount = p.racks.length;
    const div = document.createElement('div');
    div.className = 'proj-card';
    div.innerHTML = `
      <button class="pdel" title="Delete project" onclick="deleteProject('${p.id}', event)">✕</button>
      <div class="pname">${esc(p.name)}</div>
      <div class="pmeta"><span>${devCount}</span> devices &nbsp;·&nbsp; <span>${rackCount}</span> racks</div>
      <div class="pmeta" style="margin-top:4px;color:var(--text3);">${p.created || 'Project'}</div>
    `;
    div.addEventListener('click', () => openProject(p.id));
    g.appendChild(div);
  });
  const np = document.createElement('div');
  np.className = 'proj-new';
  np.innerHTML = `<span style="font-size:20px;color:var(--accent)">+</span> New Project`;
  np.onclick = newProject;
  g.appendChild(np);
}

function newProject() {
  openModal(`
    <h3>New Project</h3>
    <div class="form-row"><label>Project Name</label>
      <input class="form-control" id="pn-name" placeholder="e.g. Office Network 2025" autofocus></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createProject()">Create</button>
    </div>
  `);
  setTimeout(() => document.getElementById('pn-name')?.focus(), 50);
}

function createProject() {
  const name = document.getElementById('pn-name')?.value?.trim();
  if (!name) return toast('Enter a project name', 'error');
  const p = {
    id: genId(), name,
    company: '', location: '', contactMgmt: '', contactIT: '',
    created: new Date().toLocaleDateString(),
    devices: [], racks: [], changelog: [], siteNotes: [],
    flowchart: JSON.parse(JSON.stringify(DEFAULT_FLOWCHART)),
    fcNodePositions: {},
    vendors: [], checklist: getDefaultChecklist(), timeLog: [],
    cableRuns: [], locations: [], siteMap: { data: null, markers: [], cableLines: [] }
  };
  state.projects.push(p);
  save();
  closeModal();
  openProject(p.id);
}
function deleteProject(id, e) {
  e.stopPropagation();
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  // First confirmation
  openModal(`
    <h3 style="color:var(--red)">⚠ Delete Project</h3>
    <p style="margin-bottom:16px;color:var(--text2)">This will permanently delete <strong style="color:#fff">${esc(p.name)}</strong> and all its devices, racks, and data. This cannot be undone.</p>
    <p style="margin-bottom:16px;color:var(--text2)">To confirm, type the project name below:</p>
    <div class="form-row"><input class="form-control" id="del-confirm-name" placeholder="${esc(p.name)}"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmDeleteProject('${id}')">Delete Permanently</button>
    </div>`);
  setTimeout(() => document.getElementById('del-confirm-name')?.focus(), 50);
}

function confirmDeleteProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  const typed = document.getElementById('del-confirm-name')?.value?.trim();
  if (typed !== p.name) return toast('Project name does not match', 'error');
  state.projects = state.projects.filter(x => x.id !== id);
  save();
  closeModal();
  renderProjects();
  toast('Project deleted');
}

function openProject(id) {
  // Verify data is in localStorage before navigating
  const stored = localStorage.getItem('netrack_data');
  const projCount = stored ? JSON.parse(stored).length : 0;
  console.log('[openProject] projects in memory:', state.projects.length, '| in localStorage:', projCount, '| opening id:', id);
  if (projCount === 0 && state.projects.length > 0) {
    // localStorage is empty but we have projects in memory — force save before navigating
    console.warn('[openProject] localStorage empty, forcing save...');
    try {
      localStorage.setItem('netrack_data', JSON.stringify(state.projects));
      localStorage.setItem('netrack_colors', JSON.stringify(state.typeColors || {}));
    } catch(e) {
      alert('Storage full — cannot save projects. Export your data to avoid losing it.');
      return;
    }
  }
  state.currentProjectId = id;
  localStorage.setItem('netrack_current_project', id);
  window.location.href = 'dashboard.html';
}

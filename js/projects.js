function renderProjects() {
  const g = document.getElementById('proj-grid');
  g.innerHTML = '';

  // Local projects (full data in IDB)
  state.projects.forEach(p => {
    const devCount = p.devices.length;
    const rackCount = p.racks.length;
    const photoCount = (p.photos||[]).length;
    const div = document.createElement('div');
    div.className = 'proj-card';
    div.innerHTML = `
      <button class="pdel" title="Delete project" onclick="deleteProject('${p.id}', event)">✕</button>
      <div class="pname">${esc(p.name)}</div>
      <div class="pmeta"><span>${devCount}</span> devices &nbsp;·&nbsp; <span>${rackCount}</span> racks &nbsp;·&nbsp; <span>${photoCount}</span> photos</div>
      <div class="pmeta" style="margin-top:4px;color:var(--text3);">${p.created || 'Project'}</div>
    `;
    div.addEventListener('click', () => openProject(p.id));
    g.appendChild(div);
  });

  // Drive-only projects (metadata stubs — no data downloaded yet)
  const localNames = new Set(state.projects.map(p => p.name));
  const driveOnly = (state.driveIndex || []).filter(d => !localNames.has(d.name));
  driveOnly.forEach(d => {
    const div = document.createElement('div');
    div.className = 'proj-card';
    div.style.borderColor = 'rgba(66,133,244,.3)';
    div.innerHTML = `
      <div style="position:absolute;top:8px;right:8px;font-size:10px;color:#4285f4;font-family:var(--mono);background:rgba(66,133,244,.1);border:1px solid rgba(66,133,244,.3);border-radius:4px;padding:1px 6px">☁ Drive</div>
      <div class="pname">${esc(d.name)}</div>
      <div class="pmeta" style="color:#4285f4">Click to download &amp; open</div>
      <div class="pmeta" style="margin-top:4px;color:var(--text3);font-size:10px">${d.modifiedTime ? new Date(d.modifiedTime).toLocaleDateString() : ''}${d.size ? ' &middot; ' + (d.size/1024).toFixed(0) + ' KB' : ''}</div>
    `;
    div.addEventListener('click', () => openDriveProject(d.driveFileId));
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
    photos: [], photoFolders: [],
    checklist: getDefaultChecklist(), timeLog: [],
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
  _idbDeleteProject(id).catch(() => {});
  save();
  closeModal();
  renderProjects();
  toast('Project deleted');
}

function openProject(id) {
  state.currentProjectId = id;
  sessionStorage.setItem('netrack_current_project', id);
  try { localStorage.setItem('netrack_current_project', id); } catch(e) {}
  window.location.href = 'dashboard.html';
}

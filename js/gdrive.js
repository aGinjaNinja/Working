// ═══════════════════════════════════════════
//  GOOGLE DRIVE SYNC
// ═══════════════════════════════════════════

// ── Paste your OAuth 2.0 Client ID here ──────────────────────────────────────
const GDRIVE_CLIENT_ID = '761585225303-f5pe1sfedqoksov4eepkh7o6ijm76v87.apps.googleusercontent.com';
// ─────────────────────────────────────────────────────────────────────────────

const GDRIVE_SCOPE       = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_FOLDER_NAME = 'NetRackManager';
let _driveTokenClient = null;
let _driveToken       = null;
let _driveCallback    = null;

function _initDriveClient() {
  if (_driveTokenClient) return true;
  if (!window.google?.accounts?.oauth2) {
    toast('Google Identity Services not loaded yet — try again in a moment.', 'error');
    return false;
  }
  if (!GDRIVE_CLIENT_ID || GDRIVE_CLIENT_ID.startsWith('YOUR_CLIENT_ID')) {
    openModal(`
      <h3>☁ Google Drive Setup</h3>
      <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
        A <b>Google OAuth Client ID</b> is required before Drive sync can work. This is a one-time setup.
      </p>
      <ol style="font-size:13px;color:var(--text2);line-height:2;padding-left:18px">
        <li>Go to <b style="color:var(--accent)">console.cloud.google.com</b></li>
        <li>Create a project → <b>APIs &amp; Services → Enable APIs</b> → enable <b>Google Drive API</b></li>
        <li><b>APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID</b></li>
        <li>Application type: <b>Web application</b></li>
        <li>Under <b>Authorised JavaScript origins</b> add the URL you open this file from<br>
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(location.origin)}</span></li>
        <li>Copy the <b>Client ID</b> and paste it into the <code>GDRIVE_CLIENT_ID</code> constant<br>
          near the top of the Drive Sync section in this file's source.</li>
      </ol>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal()">OK</button>
      </div>`);
    return false;
  }
  _driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: GDRIVE_SCOPE,
    callback: (resp) => {
      if (resp.error) { toast('Google auth error: ' + resp.error, 'error'); return; }
      _driveToken = resp.access_token;
      if (_driveCallback) { const cb = _driveCallback; _driveCallback = null; cb(); }
    }
  });
  return true;
}

function _driveAuth(callback) {
  _driveCallback = callback;
  if (!_initDriveClient()) return;
  _driveTokenClient.requestAccessToken({ prompt: _driveToken ? '' : '' });
}

async function _driveFetch(url, opts) {
  const resp = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + _driveToken, ...(opts?.headers || {}) }
  });
  if (resp.status === 401) { _driveToken = null; throw new Error('Auth expired — please try again'); }
  return resp;
}

async function _getOrCreateDriveFolder() {
  const q = encodeURIComponent(`name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await _driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
  const d = await r.json();
  if (d.files?.length) return d.files[0].id;
  const cr = await _driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: GDRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  return (await cr.json()).id;
}

async function gdriveSave() {
  const p = getProject();
  if (!p) return toast('No project open', 'error');
  _driveAuth(async () => {
    try {
      const folderId = await _getOrCreateDriveFolder();
      const fileName = p.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') + '_netrack.json';
      const content  = JSON.stringify({ _netrack_version: 2, typeColors: state.typeColors || {}, project: p }, null, 2);
      const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
      const search = await _driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
      const { files } = await search.json();
      if (files?.length) {
        await _driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: content
        });
      } else {
        const boundary = 'nrm' + Date.now();
        const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/json' });
        const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
        await _driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body
        });
      }
      logChange('Project saved to Google Drive');
      save();
      toast(`☁ Saved "${p.name}" to Google Drive`, 'success');
    } catch (err) { toast('Drive save failed: ' + err.message, 'error'); }
  });
}

async function gdriveSaveAll() {
  if (!state.projects.length) return toast('No projects to save', 'error');
  _driveAuth(async () => {
    try {
      const folderId = await _getOrCreateDriveFolder();
      let saved = 0, failed = 0;
      toast(`☁ Saving ${state.projects.length} project${state.projects.length !== 1 ? 's' : ''} to Drive…`);
      for (const p of state.projects) {
        try {
          const fileName = p.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') + '_netrack.json';
          const content = JSON.stringify({ _netrack_version: 2, typeColors: state.typeColors || {}, project: p }, null, 2);
          const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
          const search = await _driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
          const { files } = await search.json();
          if (files?.length) {
            await _driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=media`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content
            });
          } else {
            const boundary = 'nrm' + Date.now();
            const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/json' });
            const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
            await _driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
            });
          }
          saved++;
        } catch (err) { failed++; }
      }
      const parts = [`${saved} saved`];
      if (failed) parts.push(`${failed} failed`);
      toast(`☁ ${parts.join(', ')}`, saved > 0 ? 'success' : 'error');
    } catch (err) { toast('Drive save failed: ' + err.message, 'error'); }
  });
}

async function gdriveLoad() {
  _driveAuth(async () => {
    try {
      const folderId = await _getOrCreateDriveFolder();
      const q = encodeURIComponent(`'${folderId}' in parents and name contains '_netrack.json' and trashed=false`);
      const r = await _driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime+desc`);
      const { files } = await r.json();
      if (!files?.length) return toast('No NetRackManager files found in Google Drive.', 'error');

      _gdrivePendingFiles = files;
      openModal(`
        <h3>☁ Load from Google Drive</h3>
        <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
          Click a project to download &amp; open it, or add all to your dashboard.
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow-y:auto">
          ${files.map(f => {
            const label = f.name.replace(/_netrack\.json$/,'').replace(/_/g,' ');
            const date  = new Date(f.modifiedTime).toLocaleString();
            const size  = f.size ? (f.size/1024).toFixed(0)+' KB' : '';
            return `<div onclick="gdriveImportFile('${f.id}','${esc(f.name)}')"
              style="padding:10px 14px;background:var(--card2);border:1px solid var(--border2);border-radius:6px;cursor:pointer;transition:border-color .15s"
              onmouseover="this.style.borderColor='var(--accent)'"
              onmouseout="this.style.borderColor='var(--border2)'">
              <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(label)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px;font-family:var(--mono)">
                Modified: ${esc(date)}${size ? ' · ' + size : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="gdriveAddAllToDashboard()">☁ Add All to Dashboard (${files.length})</button>
        </div>
      `, '500px');
    } catch (err) { toast('Drive load failed: ' + err.message, 'error'); }
  });
}

let _gdrivePendingFiles = [];

// Saves metadata only — no project data downloaded. Cards appear on the dashboard.
async function gdriveAddAllToDashboard() {
  const files = _gdrivePendingFiles;
  if (!files?.length) return;
  const index = files.map(f => ({
    driveFileId: f.id,
    name: f.name.replace(/_netrack\.json$/, '').replace(/_/g, ' '),
    fileName: f.name,
    modifiedTime: f.modifiedTime,
    size: f.size
  }));
  // Merge with existing drive index
  const merged = [...state.driveIndex];
  for (const entry of index) {
    const idx = merged.findIndex(e => e.driveFileId === entry.driveFileId);
    if (idx >= 0) merged[idx] = entry; else merged.push(entry);
  }
  state.driveIndex = merged;
  await _idbSaveConfig('driveIndex', merged);
  closeModal();
  if (typeof renderProjects === 'function') renderProjects();
  toast(`☁ ${files.length} project${files.length !== 1 ? 's' : ''} added — click one to download`, 'success');
}

// Downloads one project from Drive, saves to IDB, and opens it
async function openDriveProject(driveFileId) {
  if (!_driveToken) {
    _driveAuth(() => openDriveProject(driveFileId));
    return;
  }
  try {
    toast('☁ Downloading project…');
    const r = await _driveFetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
    const text = await r.text();
    let p = null, importedColors = null;
    const parsed = JSON.parse(text);
    if (parsed._netrack_version === 2 && parsed.project) {
      p = parsed.project; importedColors = parsed.typeColors;
    } else if (parsed.id && parsed.name) {
      p = parsed;
    } else { throw new Error('Unrecognised file format'); }
    if (!p.id || !p.name) throw new Error('Missing project id or name');
    migrateProject(p);
    await _idbSaveProject(p);
    const existing = state.projects.findIndex(x => x.id === p.id);
    if (existing >= 0) { state.projects[existing] = p; }
    else { state.projects.push(p); }
    if (importedColors) {
      state.typeColors = Object.assign({}, importedColors, state.typeColors);
      _idbSaveConfig('typeColors', state.typeColors).catch(() => {});
    }
    // Remove from drive index — it's now a local project
    state.driveIndex = state.driveIndex.filter(e => e.driveFileId !== driveFileId);
    _idbSaveConfig('driveIndex', state.driveIndex).catch(() => {});
    state.currentProjectId = p.id;
    localStorage.setItem('netrack_current_project', p.id);
    window.location.href = 'dashboard.html';
  } catch (err) { toast('Failed to load: ' + err.message, 'error'); }
}

async function gdriveImportFile(fileId, fileName) {
  try {
    toast('☁ Downloading project…');
    const r = await _driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    const text = await r.text();
    let p = null, importedColors = null;
    const parsed = JSON.parse(text);
    if (parsed._netrack_version === 2 && parsed.project) {
      p = parsed.project; importedColors = parsed.typeColors;
    } else if (parsed.id && parsed.name) {
      p = parsed;
    } else { throw new Error('Unrecognised file format'); }
    if (!p.id || !p.name) throw new Error('Missing project id or name');
    migrateProject(p);
    // Save directly to IndexedDB (no localStorage quota issues)
    await _idbSaveProject(p);
    // Update in-memory state
    const existing = state.projects.findIndex(x => x.id === p.id);
    if (existing >= 0) { state.projects[existing] = p; }
    else { state.projects.push(p); }
    if (importedColors) {
      state.typeColors = Object.assign({}, importedColors, state.typeColors);
      _idbSaveConfig('typeColors', state.typeColors).catch(() => {});
    }
    save();
    closeModal();
    // Open the project — openProject() is only on index.html, so fall back to direct nav
    state.currentProjectId = p.id;
    localStorage.setItem('netrack_current_project', p.id);
    window.location.href = 'dashboard.html';
  } catch (err) { toast('Failed to load file: ' + err.message, 'error'); }
}

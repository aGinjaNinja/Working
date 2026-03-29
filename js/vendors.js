const VENDOR_TYPES = ['ISP','MSP','Carrier','Vendor','Other'];

function addVendor() { openVendorModal(null); }
function editVendor(id) { openVendorModal(id); }

function openVendorModal(id) {
  const v = id ? state.globalVendors.find(x=>x.id===id) : null;
  const isNew = !v;
  const typeOpts = VENDOR_TYPES.map(t=>`<option value="${t}" ${(v?.type||'Vendor')===t?'selected':''}>${t}</option>`).join('');
  openModal(`
    <h3>${isNew?'Add Vendor':'Edit Vendor'}</h3>
    <div class="form-row-inline">
      <div class="form-row" style="flex:2"><label>Vendor Name *</label>
        <input class="form-control" id="v-name" value="${esc(v?.name||'')}" placeholder="Comcast Business"></div>
      <div class="form-row"><label>Type</label>
        <select class="form-control" id="v-type">${typeOpts}</select></div>
    </div>
    <div class="form-row-inline">
      <div class="form-row"><label>Account #</label>
        <input class="form-control" id="v-acct" value="${esc(v?.accountNum||'')}" placeholder="ACC-123456"></div>
      <div class="form-row"><label>Circuit ID</label>
        <input class="form-control" id="v-circuit" value="${esc(v?.circuitId||'')}" placeholder="CKT-XXXX"></div>
    </div>
    <div class="form-row-inline">
      <div class="form-row"><label>Support Phone</label>
        <input class="form-control" id="v-phone" value="${esc(v?.supportPhone||'')}" placeholder="1-800-XXX-XXXX"></div>
      <div class="form-row"><label>Support Email</label>
        <input class="form-control" id="v-email" value="${esc(v?.supportEmail||'')}" placeholder="support@vendor.com"></div>
    </div>
    <div class="form-row"><label>Notes</label>
      <textarea class="form-control" id="v-notes" rows="2" placeholder="Contract terms, SLA, etc.">${esc(v?.notes||'')}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveVendor('${id||''}')">Save</button>
    </div>`, '520px');
  setTimeout(()=>document.getElementById('v-name')?.focus(),50);
}

function saveVendor(id) {
  const name = document.getElementById('v-name')?.value?.trim();
  if (!name) return toast('Vendor name is required','error');
  const data = {
    name, type: document.getElementById('v-type')?.value||'Vendor',
    accountNum: document.getElementById('v-acct')?.value?.trim()||'',
    circuitId: document.getElementById('v-circuit')?.value?.trim()||'',
    supportPhone: document.getElementById('v-phone')?.value?.trim()||'',
    supportEmail: document.getElementById('v-email')?.value?.trim()||'',
    notes: document.getElementById('v-notes')?.value?.trim()||'',
  };
  if (id) {
    const idx=state.globalVendors.findIndex(v=>v.id===id);
    if(idx>=0) Object.assign(state.globalVendors[idx],data);
  } else {
    state.globalVendors.push({id:genId(),...data});
  }
  saveGlobalVendors();
  closeModal();
  // Re-render whichever view is active
  if (typeof renderVendorPage === 'function' && document.getElementById('vendor-list-area')) renderVendorPage();
  if (typeof renderDashboard === 'function' && typeof getProject === 'function' && getProject()) renderDashboard();
  toast(id?'Vendor updated':'Vendor added','success');
}

function deleteVendor(id) {
  if(!confirm('Delete this vendor?')) return;
  const v = state.globalVendors.find(x=>x.id===id);
  state.globalVendors = state.globalVendors.filter(x=>x.id!==id);
  // Clear vendorId references across all projects
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => { if (d.vendorId === id) d.vendorId = ''; });
  });
  saveGlobalVendors();
  save();
  if (typeof renderVendorPage === 'function' && document.getElementById('vendor-list-area')) renderVendorPage();
  if (typeof renderDashboard === 'function' && typeof getProject === 'function' && getProject()) renderDashboard();
  toast('Vendor deleted');
}

// ═══════════════════════════════════════════
//  VENDOR PAGE — rendered on index.html
// ═══════════════════════════════════════════
function renderVendorPage() {
  const area = document.getElementById('vendor-list-area');
  if (!area) return;
  const vendors = state.globalVendors || [];

  // Count how many devices across all projects reference each vendor
  const usageCounts = {};
  vendors.forEach(v => { usageCounts[v.id] = 0; });
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (d.vendorId && usageCounts[d.vendorId] !== undefined) usageCounts[d.vendorId]++;
    });
  });

  // Count unresolved devices (no vendor assigned, across all projects)
  let unresolvedCount = 0;
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (_isVendorMissing(d.vendorId)) unresolvedCount++;
    });
  });

  area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">Vendors &amp; Contracts</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Shared across all projects &nbsp;·&nbsp; ${vendors.length} vendor${vendors.length!==1?'s':''}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${unresolvedCount > 0 ? `<button class="btn btn-ghost btn-sm" onclick="showUnresolvedDevices()" style="color:var(--amber);border-color:rgba(255,170,0,.4)">⚠ ${unresolvedCount} device${unresolvedCount!==1?'s':''} without vendor</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="addVendor()">+ Add Vendor</button>
      </div>
    </div>
    ${vendors.length===0 ? `
      <div style="text-align:center;padding:40px 20px;color:var(--text3)">
        <div style="font-size:28px;margin-bottom:8px">📋</div>
        <div style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:4px">No vendors yet</div>
        <div style="font-size:12px">Add ISPs, MSPs, carriers, and service providers shared across all your projects.</div>
      </div>` : `
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Type</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Name</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Account #</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Circuit ID</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Support</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Used By</th>
            <th style="padding:8px 10px;border-bottom:2px solid var(--border);width:60px"></th>
          </tr></thead>
          <tbody>
            ${vendors.map(v=>`<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 10px"><span style="background:var(--card);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;font-family:var(--mono)">${esc(v.type||'')}</span></td>
              <td style="padding:8px 10px;font-weight:600">${esc(v.name||'')}</td>
              <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${esc(v.accountNum||'—')}</td>
              <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${esc(v.circuitId||'—')}</td>
              <td style="padding:8px 10px;font-size:11px">${esc(v.supportPhone||'')}${v.supportPhone&&v.supportEmail?' / ':''}${esc(v.supportEmail||'')}</td>
              <td style="padding:8px 10px;font-size:11px;color:var(--text2)">${usageCounts[v.id]||0} device${(usageCounts[v.id]||0)!==1?'s':''}</td>
              <td style="padding:8px 10px">
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="editVendor('${v.id}')" title="Edit">✎</button>
                  <button class="btn btn-danger btn-sm btn-icon" onclick="deleteVendor('${v.id}')" title="Delete">✕</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
}

function _isVendorMissing(vendorId) {
  if (!vendorId) return true;
  const v = vendorId.toLowerCase().trim();
  return !v || v === 'n/s' || v === 'n/a' || v === 'na' || v === 'none' || v === 'unknown' || v === '-' || v === '—';
}

function showUnresolvedDevices() {
  const rows = [];
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (_isVendorMissing(d.vendorId)) {
        rows.push({ project: p.name, device: d.name, type: d.deviceType||'', ip: d.ip||'', id: d.id, pid: p.id });
      }
    });
  });
  if (rows.length === 0) return toast('All devices have vendors assigned','success');

  const vendorOpts = state.globalVendors.map(v=>`<option value="${v.id}">${esc(v.name)} (${esc(v.type||'')})</option>`).join('');

  openModal(`
    <h3>⚠ Devices Without Vendor (${rows.length})</h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Select a vendor for each device, or use "Assign All" to bulk-assign.</div>
    ${state.globalVendors.length > 0 ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 10px;background:var(--panel);border:1px solid var(--border);border-radius:6px">
      <label style="font-size:11px;white-space:nowrap;color:var(--text2)">Bulk assign:</label>
      <select class="form-control" id="bulk-vendor-select" style="flex:1;font-size:12px"><option value="">— Choose —</option>${vendorOpts}</select>
      <button class="btn btn-primary btn-sm" onclick="bulkAssignVendor()">Assign All</button>
    </div>` : ''}
    <div style="max-height:400px;overflow-y:auto">
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Project</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Device</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Type</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">IP</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);min-width:140px">Vendor</th>
        </tr></thead>
        <tbody>
          ${rows.map((r,i)=>`<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;color:var(--text2)">${esc(r.project)}</td>
            <td style="padding:6px 8px;font-weight:600">${esc(r.device)}</td>
            <td style="padding:6px 8px">${esc(r.type)}</td>
            <td style="padding:6px 8px;font-family:var(--mono)">${esc(r.ip||'—')}</td>
            <td style="padding:6px 8px"><select class="form-control unres-vendor" data-pid="${r.pid}" data-did="${r.id}" style="font-size:11px;padding:3px 6px"><option value="">—</option>${vendorOpts}</select></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUnresolvedVendors()">Save Assignments</button>
    </div>`, '720px');
}

function bulkAssignVendor() {
  const vid = document.getElementById('bulk-vendor-select')?.value;
  if (!vid) return toast('Select a vendor first','error');
  document.querySelectorAll('.unres-vendor').forEach(sel => { sel.value = vid; });
}

function saveUnresolvedVendors() {
  let count = 0;
  document.querySelectorAll('.unres-vendor').forEach(sel => {
    const vid = sel.value;
    if (!vid) return;
    const pid = sel.dataset.pid;
    const did = sel.dataset.did;
    const proj = state.projects.find(p => p.id === pid);
    if (!proj) return;
    const dev = proj.devices.find(d => d.id === did);
    if (!dev) return;
    dev.vendorId = vid;
    count++;
  });
  if (count > 0) save();
  closeModal();
  if (typeof renderVendorPage === 'function') renderVendorPage();
  toast(`${count} device${count!==1?'s':''} assigned to vendors`, 'success');
}

function toggleVendorPage() {
  const area = document.getElementById('vendor-list-area');
  const grid = document.getElementById('proj-grid');
  const actions = document.querySelector('.proj-actions');
  const backupStatus = document.getElementById('proj-backup-status');
  if (!area) return;
  const showing = area.style.display !== 'none';
  area.style.display = showing ? 'none' : 'block';
  if (grid) grid.style.display = showing ? '' : 'none';
  if (actions) actions.style.display = showing ? '' : 'none';
  if (backupStatus) backupStatus.style.display = showing ? '' : 'none';
  const btn = document.getElementById('vendor-toggle-btn');
  if (btn) btn.textContent = showing ? '📋 Vendors' : '← Back to Projects';
  if (!showing) renderVendorPage();
}

const VENDOR_TYPES = ['ISP','MSP','Carrier','Vendor','Other'];

let _returnToUnresolved = false;
let _pendingOUI = '';

function addVendor() { openVendorModal(null); }
function editVendor(id) { openVendorModal(id); }

function addVendorFromUnresolved(mac, deviceId, projectId) {
  const oui = _extractOUI(mac);
  openModal(`
    <h3>Assign Manufacturer</h3>
    ${mac ? `<div style="font-size:11px;color:var(--accent);margin-bottom:10px;padding:6px 10px;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);border-radius:5px">MAC: <strong style="font-family:var(--mono)">${esc(mac)}</strong>${oui ? ` &nbsp;·&nbsp; OUI prefix: <strong style="font-family:var(--mono)">${esc(oui)}</strong> — all devices sharing this prefix will be auto-assigned` : ''}</div>` : ''}
    <div class="form-row"><label>Manufacturer Name</label>
      <input class="form-control" id="unres-mfr-name" placeholder="e.g. Cisco, Ubiquiti, Ruckus" autofocus></div>
    <input type="hidden" id="unres-mfr-mac" value="${esc(mac||'')}">
    <input type="hidden" id="unres-mfr-did" value="${esc(deviceId||'')}">
    <input type="hidden" id="unres-mfr-pid" value="${esc(projectId||'')}">
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal();showUnresolvedDevices()">Cancel</button>
      <button class="btn btn-primary" onclick="saveQuickManufacturer()">Save</button>
    </div>`, '400px');
  setTimeout(() => document.getElementById('unres-mfr-name')?.focus(), 50);
}

function saveQuickManufacturer() {
  const name = document.getElementById('unres-mfr-name')?.value?.trim();
  if (!name) return toast('Enter a manufacturer name', 'error');
  const mac = document.getElementById('unres-mfr-mac')?.value || '';
  const did = document.getElementById('unres-mfr-did')?.value || '';
  const pid = document.getElementById('unres-mfr-pid')?.value || '';
  const oui = _extractOUI(mac);

  // Add to globalVendors if not already there
  let vendor = state.globalVendors.find(v => v.name.toLowerCase() === name.toLowerCase());
  if (!vendor) {
    vendor = { id: genId(), name, type: 'Vendor', accountNum: '', circuitId: '', supportPhone: '', supportEmail: '', notes: '' };
    state.globalVendors.push(vendor);
    saveGlobalVendors();
  }

  // Assign to the clicked device directly
  if (did && pid) {
    const proj = state.projects.find(p => p.id === pid);
    if (proj) {
      const dev = proj.devices.find(d => d.id === did);
      if (dev) { dev.manufacturer = name; dev.vendorId = vendor.id; }
    }
  }

  // Auto-match all unresolved devices sharing the same OUI prefix
  if (oui) {
    _autoMatchByOUI(vendor.id, name, oui);
  }

  save();
  closeModal();
  showUnresolvedDevices();
  toast(`Manufacturer "${name}" assigned`, 'success');
}

function _extractOUI(mac) {
  if (!mac) return '';
  const clean = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  if (clean.length < 6) return '';
  return clean.slice(0,2) + ':' + clean.slice(2,4) + ':' + clean.slice(4,6);
}

function _deviceMatchesOUI(deviceMac, oui) {
  if (!deviceMac || !oui) return false;
  return _extractOUI(deviceMac) === oui;
}

// A device is "missing vendor" if it has no manufacturer AND no vendorId linked
function _isDeviceMissingVendor(d) {
  // Check manufacturer field first — vendor and manufacturer are the same thing
  const mfr = (d.manufacturer || '').trim().toLowerCase().replace(/[\[\]]/g, '');
  const hasMfr = mfr && mfr !== 'n/s' && mfr !== 'n/a' && mfr !== 'na' && mfr !== 'none'
    && mfr !== 'unknown' && mfr !== '-' && mfr !== '—' && mfr !== 'n\\a' && mfr !== 'n\\s';
  if (hasMfr) return false;
  // Also check vendorId link
  const vid = (d.vendorId || '').trim();
  if (vid && state.globalVendors.find(v => v.id === vid)) return false;
  return true;
}

function openVendorModal(id, prefillOUI) {
  const v = id ? state.globalVendors.find(x=>x.id===id) : null;
  const isNew = !v;
  const typeOpts = VENDOR_TYPES.map(t=>`<option value="${t}" ${(v?.type||'Vendor')===t?'selected':''}>${t}</option>`).join('');
  const prefillName = prefillOUI ? 'OUI ' + prefillOUI : '';
  openModal(`
    <h3>${isNew?'Add Vendor':'Edit Vendor'}</h3>
    ${prefillOUI ? `<div style="font-size:11px;color:var(--accent);margin-bottom:10px;padding:6px 10px;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);border-radius:5px">MAC prefix: <strong style="font-family:var(--mono)">${esc(prefillOUI)}</strong> — after saving, all devices sharing this prefix will be auto-assigned.</div>` : ''}
    <div class="form-row-inline">
      <div class="form-row" style="flex:2"><label>Vendor / Manufacturer Name *</label>
        <input class="form-control" id="v-name" value="${esc(v?.name||prefillName)}" placeholder="Cisco, Comcast Business, etc."></div>
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
      <button class="btn btn-ghost" onclick="_cancelVendorModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveVendor('${id||''}')">Save</button>
    </div>`, '520px');
  setTimeout(()=>{
    const el = document.getElementById('v-name');
    if (el) { el.focus(); el.select(); }
  }, 50);
}

function _cancelVendorModal() {
  const wasReturning = _returnToUnresolved;
  _returnToUnresolved = false;
  _pendingOUI = '';
  closeModal();
  if (wasReturning) showUnresolvedDevices();
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
  let newVendorId = id;
  if (id) {
    const idx = state.globalVendors.findIndex(v=>v.id===id);
    if (idx >= 0) Object.assign(state.globalVendors[idx], data);
  } else {
    newVendorId = genId();
    state.globalVendors.push({ id: newVendorId, ...data });
  }
  saveGlobalVendors();
  closeModal();

  if (_returnToUnresolved) {
    const oui = _pendingOUI;
    _returnToUnresolved = false;
    _pendingOUI = '';
    if (!id) {
      // Auto-match: set manufacturer + vendorId on matching devices
      if (oui) {
        _autoMatchByOUI(newVendorId, data.name, oui);
      } else {
        _autoMatchByName(newVendorId, data.name);
      }
    }
    showUnresolvedDevices();
  } else {
    if (typeof renderVendorPage === 'function' && document.getElementById('vendor-list-area')) renderVendorPage();
    if (typeof renderDashboard === 'function' && typeof getProject === 'function' && getProject()) renderDashboard();
  }
  toast(id ? 'Vendor updated' : 'Vendor added', 'success');
}

function _autoMatchByOUI(vendorId, vendorName, oui) {
  if (!oui) return;
  let matched = 0;
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (!_isDeviceMissingVendor(d)) return;
      if (_deviceMatchesOUI(d.mac, oui)) {
        d.vendorId = vendorId;
        d.manufacturer = vendorName;
        matched++;
      }
    });
  });
  if (matched > 0) {
    save();
    toast(`Auto-assigned ${matched} device${matched!==1?'s':''} with MAC prefix ${oui}`, 'success');
  }
}

function _autoMatchByName(vendorId, vendorName) {
  if (!vendorName) return;
  const vLower = vendorName.toLowerCase().trim();
  let matched = 0;
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (!_isDeviceMissingVendor(d)) return;
      const mfr = (d.manufacturer||'').toLowerCase().trim();
      if (mfr && (mfr.includes(vLower) || vLower.includes(mfr))) {
        d.vendorId = vendorId;
        matched++;
      }
    });
  });
  if (matched > 0) {
    save();
    toast(`Auto-assigned ${matched} device${matched!==1?'s':''} matching "${vendorName}"`, 'success');
  }
}

function deleteVendor(id) {
  if (!confirm('Delete this vendor?')) return;
  state.globalVendors = state.globalVendors.filter(x=>x.id!==id);
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

  const usageCounts = {};
  vendors.forEach(v => { usageCounts[v.id] = 0; });
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (d.vendorId && usageCounts[d.vendorId] !== undefined) usageCounts[d.vendorId]++;
    });
  });

  let unresolvedCount = 0;
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (_isDeviceMissingVendor(d)) unresolvedCount++;
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

function showUnresolvedDevices() {
  const rows = [];
  state.projects.forEach(p => {
    (p.devices||[]).forEach(d => {
      if (_isDeviceMissingVendor(d)) {
        rows.push({ project: p.name, device: d.name, type: d.deviceType||'', ip: d.ip||'', mac: d.mac||'', manufacturer: d.manufacturer||'', id: d.id, pid: p.id });
      }
    });
  });
  if (rows.length === 0) {
    toast('All devices have vendors assigned', 'success');
    if (typeof renderVendorPage === 'function') renderVendorPage();
    return;
  }

  const vendorOpts = state.globalVendors.map(v=>`<option value="${v.id}">${esc(v.name)} (${esc(v.type||'')})</option>`).join('');
  const hasVendors = state.globalVendors.length > 0;

  openModal(`
    <h3 style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span>⚠ ${rows.length} Device${rows.length!==1?'s':''} Without Vendor</span>
      <button class="btn btn-primary btn-sm" onclick="_returnToUnresolved=true;openVendorModal(null)">+ New Vendor</button>
    </h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Click <strong>+ Add</strong> on a row to create a vendor from that device's MAC prefix (first 3 octets). All devices sharing that prefix get auto-assigned.</div>
    ${hasVendors ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 10px;background:var(--panel);border:1px solid var(--border);border-radius:6px">
      <label style="font-size:11px;white-space:nowrap;color:var(--text2)">Bulk assign:</label>
      <select class="form-control" id="bulk-vendor-select" style="flex:1;font-size:12px"><option value="">— Choose Vendor —</option>${vendorOpts}</select>
      <button class="btn btn-primary btn-sm" onclick="bulkAssignVendor()">Assign All</button>
    </div>` : ''}
    <div style="max-height:420px;overflow:auto">
      <table style="width:100%;font-size:11px;border-collapse:collapse;min-width:700px">
        <thead><tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap">Project</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap">Device</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap">Type</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap">MAC Address</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap">IP</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap;min-width:120px">Assign Vendor</th>
          <th style="padding:6px 8px;border-bottom:2px solid var(--border);white-space:nowrap;width:70px"></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:6px 8px;color:var(--text2);white-space:nowrap">${esc(r.project)}</td>
            <td style="padding:6px 8px;font-weight:600;white-space:nowrap">${esc(r.device)}</td>
            <td style="padding:6px 8px;white-space:nowrap">${esc(r.type)}</td>
            <td style="padding:6px 8px;font-family:var(--mono);font-size:10px;white-space:nowrap">${r.mac ? esc(r.mac) : '<span style="color:var(--text3)">—</span>'}</td>
            <td style="padding:6px 8px;font-family:var(--mono);white-space:nowrap">${esc(r.ip||'—')}</td>
            <td style="padding:6px 8px">${hasVendors ? `<select class="form-control unres-vendor" data-pid="${r.pid}" data-did="${r.id}" style="font-size:11px;padding:3px 6px"><option value="">—</option>${vendorOpts}</select>` : '<span style="font-size:10px;color:var(--text3)">—</span>'}</td>
            <td style="padding:6px 8px;text-align:center"><button class="btn btn-primary btn-sm" onclick="addVendorFromUnresolved('${esc(r.mac)}','${r.id}','${r.pid}')" style="font-size:10px;white-space:nowrap;padding:3px 10px">+ Add</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal();if(typeof renderVendorPage==='function')renderVendorPage()">Close</button>
      ${hasVendors ? `<button class="btn btn-primary" onclick="saveUnresolvedVendors()">Save Assignments</button>` : ''}
    </div>`, '900px');
}

function bulkAssignVendor() {
  const vid = document.getElementById('bulk-vendor-select')?.value;
  if (!vid) return toast('Select a vendor first', 'error');
  document.querySelectorAll('.unres-vendor').forEach(sel => { sel.value = vid; });
}

function saveUnresolvedVendors() {
  let count = 0;
  const vendorName = {};
  state.globalVendors.forEach(v => { vendorName[v.id] = v.name; });
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
    if (vendorName[vid]) dev.manufacturer = vendorName[vid];
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

const VENDOR_TYPES = ['ISP','MSP','Carrier','Vendor','Other'];

function addVendor() { openVendorModal(null); }
function editVendor(id) { openVendorModal(id); }

function openVendorModal(id) {
  const p = getProject();
  const v = id ? (p.vendors||[]).find(x=>x.id===id) : null;
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
  const p = getProject();
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
  if (!p.vendors) p.vendors=[];
  if (id) {
    const idx=p.vendors.findIndex(v=>v.id===id);
    if(idx>=0){Object.assign(p.vendors[idx],data);logChange(`Vendor updated: ${name}`);}
  } else {
    p.vendors.push({id:genId(),...data});
    logChange(`Vendor added: ${name} (${data.type})`);
  }
  save(); closeModal(); renderDashboard(); toast(id?'Vendor updated':'Vendor added','success');
}

function deleteVendor(id) {
  if(!confirm('Delete this vendor?')) return;
  const p=getProject();
  const v=(p.vendors||[]).find(x=>x.id===id);
  if(v) logChange(`Vendor deleted: ${v.name}`);
  p.vendors=(p.vendors||[]).filter(x=>x.id!==id);
  save(); renderDashboard(); toast('Vendor deleted');
}

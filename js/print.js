function printSiteReport() {
  const p = getProject();
  const now = new Date().toLocaleString();
  const devsByType = [...p.devices].sort((a,b)=>(a.deviceType||'').localeCompare(b.deviceType||''));
  const log50 = (p.changelog||[]).slice(0,50);

  const css = `body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff;margin:0;padding:20px}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}
    h3{font-size:13px;margin:14px 0 6px;color:#444}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
    th{background:#eee;padding:6px 8px;text-align:left;border:1px solid #ccc;font-size:10px}
    td{padding:5px 8px;border:1px solid #ddd}tr:nth-child(even)td{background:#f9f9f9}
    .header{border-bottom:3px solid #333;margin-bottom:20px;padding-bottom:12px}
    .meta{color:#555;font-size:11px;margin:2px 0}
    @media print{body{padding:0}h2{page-break-before:auto}}`;

  const devTableRows = devsByType.map(d=>{
    const rack = p.racks.find(r=>r.id===d.rackId);
    return `<tr>
      <td>${d.name}</td><td>${d.deviceType||''}</td>
      <td>${d.ip||'—'}</td><td>${d.mac||'—'}</td>
      <td>${d.manufacturer||''} ${d.model||''}</td>
      <td>${rack?rack.name:'—'}</td>
      <td>${d.serial||'—'}</td>
      <td>${STATUS_LABELS[d.status]||d.status||'—'}</td>
    </tr>`;
  }).join('');

  const rackSections = p.racks.map(r=>{
    const rDevs = p.devices.filter(d=>d.rackId===r.id).sort((a,b)=>(a.rackU||0)-(b.rackU||0));
    return `<h3>${r.name} — ${r.location||'No location'} (${r.uHeight}U)</h3>
      <table><thead><tr><th>U</th><th>Device</th><th>Type</th><th>IP</th></tr></thead><tbody>
      ${rDevs.map(d=>`<tr><td>${d.rackU||'—'}</td><td>${d.name}</td><td>${d.deviceType||''}</td><td>${d.ip||'—'}</td></tr>`).join('')}
      </tbody></table>`;
  }).join('');

  const vendorRows = (p.vendors||[]).map(v=>`<tr>
    <td>${v.type||''}</td><td>${v.name||''}</td><td>${v.accountNum||'—'}</td>
    <td>${v.circuitId||'—'}</td><td>${v.supportPhone||''} ${v.supportEmail||''}</td>
  </tr>`).join('');

  const notesList = (p.siteNotes||[]).map(n=>`<div style="margin-bottom:8px;padding:6px 8px;border:1px solid #ddd;border-radius:3px">
    <div style="font-size:10px;color:#777">${fmtTs(n.ts)}</div>
    <div>${n.text}</div>
  </div>`).join('');

  const logList = log50.map(e=>`<tr><td style="white-space:nowrap">${fmtTs(e.ts)}</td><td>${e.msg}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Site Report — ${p.name}</title><style>${css}</style></head>
    <body>
    <div class="header">
      <h1>${p.name||'Site Report'}</h1>
      <div class="meta">Company: ${p.company||'—'}</div>
      <div class="meta">Location: ${p.location||'—'}</div>
      <div class="meta">Management Contact: ${p.contactMgmt||'—'} &nbsp;·&nbsp; IT Contact: ${p.contactIT||'—'}</div>
      <div class="meta">Generated: ${now}</div>
    </div>

    <h2>1. Device Inventory (${devsByType.length} devices)</h2>
    ${devsByType.length>0?`<table><thead><tr><th>Name</th><th>Type</th><th>IP</th><th>MAC</th><th>Manufacturer/Model</th><th>Rack</th><th>Serial</th><th>Status</th></tr></thead><tbody>${devTableRows}</tbody></table>`:'<p>No devices.</p>'}

    <h2>2. Rack Summary</h2>
    ${p.racks.length>0?rackSections:'<p>No racks.</p>'}

    <h2>3. Vendors &amp; Contracts</h2>
    ${(p.vendors||[]).length>0?`<table><thead><tr><th>Type</th><th>Name</th><th>Account #</th><th>Circuit ID</th><th>Support</th></tr></thead><tbody>${vendorRows}</tbody></table>`:'<p>No vendors.</p>'}

    <h2>4. Site Notes</h2>
    ${(p.siteNotes||[]).length>0?notesList:'<p>No site notes.</p>'}

    <h2>5. Change Log (last 50 entries)</h2>
    ${log50.length>0?`<table><thead><tr><th>Date/Time</th><th>Event</th></tr></thead><tbody>${logList}</tbody></table>`:'<p>No log entries.</p>'}
    </body></html>`;

  const w = window.open('','_blank','width=900,height=700');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(), 800);
}

// ═══════════════════════════════════════════
//  FEATURE 10: PORT LABEL SHEET
// ═══════════════════════════════════════════
function printPortLabels(switchId) {
  const p = getProject();
  const sw = p.devices.find(d=>d.id===switchId);
  if (!sw) return;
  const portCount = sw.ports||24;
  const assignments = sw.portAssignments||{};
  const labels = sw.portLabels||{};
  const now = new Date().toLocaleDateString();

  const labelCss = `body{font-family:Arial,sans-serif;font-size:9px;margin:0;padding:0.25in}
    h1{font-size:14px;margin:0 0 8px;border-bottom:2px solid #333;padding-bottom:6px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.1in;margin-top:0.1in}
    .label{border:1px solid #999;border-radius:3px;padding:4px 6px;height:0.85in;display:flex;flex-direction:column;justify-content:center;overflow:hidden;box-sizing:border-box}
    .port-num{font-size:10px;font-weight:700;color:#333;margin-bottom:2px}
    .port-lbl{font-size:9px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .port-dev{font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media print{@page{size:letter;margin:0.5in} body{padding:0} h1{font-size:13px}}`;

  let labelHtml = '';
  for(let i=1;i<=portCount;i++){
    const connDev = assignments[i] ? p.devices.find(d=>d.id===assignments[i]) : null;
    const lbl = labels[i]||'';
    labelHtml += `<div class="label">
      <div class="port-num">Port ${i}</div>
      ${lbl?`<div class="port-lbl">${lbl}</div>`:'<div class="port-lbl" style="color:#ccc">—</div>'}
      ${connDev?`<div class="port-dev">→ ${connDev.name}</div>`:''}
    </div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Port Labels — ${sw.name}</title><style>${labelCss}</style></head>
    <body>
    <h1>${sw.name} — Port Labels &nbsp;<span style="font-size:11px;color:#777;font-weight:400">Printed: ${now}</span></h1>
    <div class="grid">${labelHtml}</div>
    </body></html>`;

  const w = window.open('','_blank','width=800,height=600');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(), 600);
}

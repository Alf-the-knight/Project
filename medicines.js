// medicines.js - Handles listing, viewing, and prescribing medicines
(function(){
  'use strict';
  const medsGrid = document.getElementById('medsGrid');
  const searchInput = document.getElementById('medSearch');
  const searchBtn = document.getElementById('searchBtn');
  const filterStock = document.getElementById('filterStock');
  const detailsPane = document.getElementById('medDetails');
  const DB_NAME = 'healthcareDB';

  function fetchMedicinesJSON(q){
    return fetch('medicines.json').then(r=> r.ok ? r.json() : Promise.reject('no meds')).then(list=> Array.isArray(list)?list:list || []).catch(()=>[]);
  }

  const FALLBACK_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#0f172a"/><g transform="translate(30,20)"><rect x="0" y="20" rx="18" ry="18" width="140" height="40" fill="#3b82f6"/><rect x="70" y="20" rx="18" ry="18" width="70" height="40" fill="#e2e8f0" opacity="0.9"/></g><text x="16" y="104" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#e5e7eb">Medicine</text></svg>`);

  function renderList(list){
    medsGrid.innerHTML = '';
    if (!list.length) { medsGrid.innerHTML = '<div class="empty-message">No medicines found.</div>'; return; }
    list.forEach(m => {
      const card = document.createElement('div'); card.className = 'med-card';
      const img = document.createElement('img'); img.className='med-thumb'; img.src = (m.image || FALLBACK_SVG); img.alt = m.Drug || 'medicine';
      img.onerror = function(){ this.onerror=null; this.src = FALLBACK_SVG; };
      const info = document.createElement('div'); info.className='med-info';
      const formsLabel = Array.isArray(m.Forms) && m.Forms.length ? m.Forms.join(', ') : (m.Form || '—');
      info.innerHTML = `<h3>${(m.Drug||'Unnamed').replace(/</g,'&lt;')}</h3>`+
        `<p>Form: ${formsLabel} • Strength: ${m.Strength || '—'}</p>`+
        `<p>Manufacturer: ${m.Manufacturer || '—'}</p>`+
        `<p>Stock: ${typeof m.stock !== 'undefined' ? m.stock : 'N/A'}</p>`;
      const actions = document.createElement('div'); actions.className='med-actions';
      const view = document.createElement('button'); view.className='btn'; view.textContent='View'; view.addEventListener('click', ()=> showDetails(m));
      const pres = document.createElement('button'); pres.className='btn ghost'; pres.textContent='Prescribe'; pres.addEventListener('click', ()=> prescribe(m));
      actions.appendChild(view); actions.appendChild(pres);
      card.appendChild(img); card.appendChild(info); card.appendChild(actions);
      medsGrid.appendChild(card);
    });
  }

  function showDetails(m){
    detailsPane.style.display='block';
    let forms = Array.isArray(m.Forms) ? m.Forms.join(', ') : (m.Form || '—');
    detailsPane.innerHTML = `<h3>${(m.Drug||'').replace(/</g,'&lt;')}</h3>
      <p><strong>Form:</strong> ${forms}</p>
      <p><strong>Strength:</strong> ${m.Strength || '—'}</p>
      <p><strong>Manufacturer:</strong> ${m.Manufacturer || '—'}</p>
      <p><strong>Stock:</strong> ${typeof m.stock !== 'undefined' ? m.stock : 'N/A'}</p>
      <div style="margin-top:12px;text-align:right"><button class="btn ghost" id="closeDetails">Close</button></div>`;
    document.getElementById('closeDetails').addEventListener('click', ()=> detailsPane.style.display='none');
  }

  function prescribe(m){
    const doctorRaw = sessionStorage.getItem('user');
    const role = sessionStorage.getItem('role');
    if (!doctorRaw || role !== 'doctor'){ alert('Please sign in as a doctor to prescribe'); return; }
    const doc = JSON.parse(doctorRaw);
    const patient = prompt('Enter patient username/NHS to prescribe to:'); if (!patient) return;
    const dosage = prompt('Enter dosage/instructions','As directed');
    // ensure IDB stores exist and update
    const r = indexedDB.open(DB_NAME);
    r.onupgradeneeded = function(e){
      const db = e.target.result;
      try{ if (!db.objectStoreNames.contains('medicines')) db.createObjectStore('medicines',{keyPath:'id'}); }catch(_){ }
      try{ if (!db.objectStoreNames.contains('prescriptions')) db.createObjectStore('prescriptions',{autoIncrement:true}); }catch(_){ }
      try{ if (!db.objectStoreNames.contains('restockRequests')) db.createObjectStore('restockRequests',{autoIncrement:true}); }catch(_){ }
      try{ if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs',{autoIncrement:true}); }catch(_){ }
      try{ if (!db.objectStoreNames.contains('appointments')) db.createObjectStore('appointments',{keyPath:'id'}); }catch(_){ }
      try{ if (!db.objectStoreNames.contains('contactMessages')) db.createObjectStore('contactMessages',{autoIncrement:true}); }catch(_){ }
    };
    r.onsuccess = function(e){
      const db = e.target.result;
      try{
        const txStores = ['medicines','prescriptions','logs'];
        if (db.objectStoreNames.contains('restockRequests')) txStores.push('restockRequests');
        const tx = db.transaction(txStores,'readwrite');
        const mStore = tx.objectStore('medicines');
        const pStore = tx.objectStore('prescriptions');
        const lStore = tx.objectStore('logs');
        // ensure medicine record exists in IDB
        mStore.get(m.id).onsuccess = function(ev){
          const rec = ev.target.result;
          if (!rec){ // seed from current object
            m.stock = typeof m.stock !== 'undefined' ? m.stock : 10;
            mStore.put(m);
            commitPrescription(m);
          } else {
            if (!rec.stock || rec.stock <= 0){
              alert('Out of stock — restock request logged');
              try{ const rs = tx.objectStore('restockRequests'); rs.add({ medicineId: m.id, doctor: doc.username||doc.email||'', ts: new Date().toISOString() }); }catch(e){}
              return;
            }
            rec.stock = (rec.stock || 0) - 1;
            mStore.put(rec);
            commitPrescription(rec);
          }
        };

        function commitPrescription(medRec){
          pStore.add({ doctor: doc.username||doc.email||'', patient: patient, medicineId: medRec.id, medicineName: medRec.Drug||'', dosage: dosage||'', ts: new Date().toISOString() });
          lStore.add({ timestamp: new Date().toISOString(), action: `Prescribed ${medRec.Drug} to ${patient} by ${doc.username||''}` });
          tx.oncomplete = function(){ alert('Prescription recorded'); }
        }
      }catch(err){ console.error('prescribe err',err); alert('Fail: '+err.message); }
    };
    r.onerror = function(){ alert('IndexedDB unavailable — prescription not recorded'); };
  }

  function applyFiltersAndRender(){
    const q = (searchInput.value||'').trim();
    const stockFilter = filterStock.value;
    fetchMedicinesJSON().then(list=>{
      // ensure stock/image fields exist on each (if not, apply defaults)
      list.forEach((m)=>{ if (typeof m.stock === 'undefined') m.stock = (m.InitialStock || 10); if (!m.image) m.image = FALLBACK_SVG; if (!m.Form && Array.isArray(m.Forms) && m.Forms.length) m.Form = m.Forms[0]; });
      let res = list;
      if (q) res = res.filter(x => (x.Drug||'').toLowerCase().includes(q.toLowerCase()));
      if (stockFilter === 'low') res = res.filter(x => (x.stock||0) <= 5 && (x.stock||0) > 0);
      if (stockFilter === 'out') res = res.filter(x => (x.stock||0) <= 0);
      renderList(res);
    });
  }

  searchBtn.addEventListener('click', applyFiltersAndRender);
  searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') applyFiltersAndRender(); });
  filterStock.addEventListener('change', applyFiltersAndRender);

  // initial load
  applyFiltersAndRender();
})();

// patient-interface.js — clean patient dashboard script (canonical)
// Requirements: sessionStorage.user (JSON) and sessionStorage.role === 'patient'
// Demo persistence: localStorage 'appointments'
(function(){
  'use strict';

  function $id(id){ return document.getElementById(id); }

  function showInlineAlert(containerId, message, kind){
    var c = $id(containerId);
    if (!c) return;
    c.innerHTML = '<div class="alert ' + (kind === 'success' ? 'alert-success' : 'alert-error') + '">' + message + '</div>';
    setTimeout(function(){ if (c) c.innerHTML = ''; }, 3500);
  }

  function requirePatient(){
    try{
      var raw = sessionStorage.getItem('user');
      var role = sessionStorage.getItem('role');
      if (!raw || role !== 'patient'){
        if (window.ui && ui.showToast) ui.showToast('Please sign in as a patient', 'default', 900);
        setTimeout(function(){ location.href = 'Hospital Login page.html?role=patient'; }, 700);
        return null;
      }
      return JSON.parse(raw);
    } catch (e){
      console.warn('requirePatient error', e);
      return null;
    }
  }

  function loadDoctors(){
    fetch('doctors.json').then(function(r){ return r.json(); }).then(function(data){
      var docs = Array.isArray(data) ? data : (data.doctors || []);
      docs = enrichDoctors(docs);
      populateDoctors(docs);
      renderDoctorsGrid(docs);
    }).catch(function(){
      var fallback = [ { id: '1', name: 'Dr. Sarah Thompson', specialty: 'Cardiology' }, { id: '2', name: 'Dr. James Patel', specialty: 'Neurology' } ];
      populateDoctors(fallback);
      renderDoctorsGrid(fallback);
    });
  }

  // Add synthetic specialties/experience/photos if missing
  function enrichDoctors(list){
    var specs = ['Cardiology','Dermatology','Orthopedics','Neurology','Pediatrics','Oncology','Psychiatry','Endocrinology','Gastroenterology','Family Medicine'];
    return (list||[]).map(function(d,i){
      var name = (d.name || ((d.first_name||'') + ' ' + (d.last_name||'')).trim()).trim();
      var specialty = d.specialty || d.specialization || specs[i % specs.length];
      var exp = d.experienceYears || (3 + (i % 25));
      var hospital = d.hospital || 'City General Hospital';
      var email = d.email || '';
      var id = d.id || (email || name || ('doc'+i));
      var photo = d.photo || 'https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=300&q=60';
      return Object.assign({}, d, { id:id, name:name, specialty:specialty, experienceYears: exp, hospital: hospital, email: email, photo: photo });
    });
  }

  function populateDoctors(list){
    var sel = $id('doctor-select'); if (!sel) return;
    sel.innerHTML = '<option value="">Choose a doctor...</option>';
    list.forEach(function(d){
      var o = document.createElement('option');
      o.value = (d.email || d.id || d.name);
      o.textContent = (d.name || d.first_name) + ' — ' + (d.specialty || d.specialization || '');
      sel.appendChild(o);
    });
  }

  function renderDoctorsGrid(list){
    var grid = $id('doctors-grid'); if (!grid) return;
    grid.innerHTML = '';
    list.forEach(function(d){
      var card = document.createElement('div');
      card.className = 'doctor-card';
      card.style.cssText = 'background: rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:12px; display:flex; gap:10px; align-items:center;';
      card.innerHTML = '<img src="'+(d.photo||'')+'" alt="doc" style="width:56px;height:56px;border-radius:10px;object-fit:cover">'
        +'<div style="flex:1"><div style="font-weight:700">'+(d.name||'')+'</div>'
        +'<div style="color:#9aa6b2;font-size:13px">'+(d.specialty||'')+' • '+(d.experienceYears||'')+' yrs exp • '+(d.hospital||'')+'</div></div>'
        +'<div><button class="btn btn-small">Select</button></div>';
      card.querySelector('button').addEventListener('click', function(){ var sel = $id('doctor-select'); if (sel) { sel.value = (d.email||d.id||d.name); sel.dispatchEvent(new Event('change')); } });
      grid.appendChild(card);
    });
  }

  function getAppointments(){ try{ return JSON.parse(localStorage.getItem('appointments')||'[]'); }catch(e){ return []; } }
  function saveAppointments(list){ localStorage.setItem('appointments', JSON.stringify(list)); }

  // Try to save a single appointment to IndexedDB; fallback will be handled by caller
  function saveAppointmentToIDB(ap, cb, errCb){
    try{
      var req = indexedDB.open('healthcareDB');
      req.onsuccess = function(e){
        try{
          var idb = e.target.result;
          if (!idb.objectStoreNames.contains('appointments')){
            if (errCb) errCb(new Error('appointments store missing')); return;
          }
          var tx = idb.transaction('appointments','readwrite');
          var store = tx.objectStore('appointments');
          var addReq = store.add(ap);
          addReq.onsuccess = function(){ if (cb) cb(); };
          addReq.onerror = function(ev){ if (errCb) errCb(ev); };
        }catch(err){ if (errCb) errCb(err); }
      };
      req.onerror = function(ev){ if (errCb) errCb(ev); };
    }catch(e){ if (errCb) errCb(e); }
  }

  // BroadcastChannel to notify other tabs (doctors) about appointment changes
  var apChannel = null;
  try{ if ('BroadcastChannel' in window) apChannel = new BroadcastChannel('appointments'); }catch(e){ apChannel = null; }

  // Available slots filtering (no collisions)
  var BASE_SLOTS = ['09:00','10:00','11:00','14:00','15:00','16:00'];
  function refreshAvailableTimes(){
    var doctorId = ($id('doctor-select')||{}).value || '';
    var date = ($id('appointment-date')||{}).value || '';
    var timeSel = $id('appointment-time'); if (!timeSel) return;
    timeSel.innerHTML = '';
    if (!doctorId || !date){
      var opt = document.createElement('option'); opt.value=''; opt.textContent='— Select doctor and date —'; timeSel.appendChild(opt); return;
    }
    collectBooked(doctorId, date, function(booked){
      var taken = new Set((booked||[]).map(function(a){ return a.time; }));
      var available = BASE_SLOTS.filter(function(t){ return !taken.has(t); });
      if (!available.length){ var o = document.createElement('option'); o.value=''; o.textContent='No slots available'; timeSel.appendChild(o); return; }
      available.forEach(function(t){ var o = document.createElement('option'); o.value=t; o.textContent=t; timeSel.appendChild(o); });
    });
  }

  function collectBooked(doctorId, date, cb){
    var out = [];
    // IDB
    try{
      var req = indexedDB.open('healthcareDB');
      req.onsuccess = function(e){
        var idb = e.target.result;
        if (idb && idb.objectStoreNames && idb.objectStoreNames.contains('appointments')){
          try{
            var tx = idb.transaction('appointments','readonly'); var store = tx.objectStore('appointments');
            store.openCursor().onsuccess = function(ev){ var c = ev.target.result; if (c){ var a = c.value; if ((a.doctor||a.doctorId||'').toString() === doctorId.toString() && (a.date||'') === date) out.push(a); c.continue(); } else { next(); } };
          }catch(err){ next(); }
        } else next();
      };
      req.onerror = next;
    }catch(e){ next(); }

    function next(){
      // localStorage
      try{ var ls = JSON.parse(localStorage.getItem('appointments')||'[]'); ls.forEach(function(a){ if ((a.doctor||a.doctorId||'').toString() === doctorId.toString() && (a.date||'') === date) out.push(a); }); }catch(e){}
      // file
      fetch('appointments.json').then(function(r){ return r.json(); }).then(function(list){ try{ (list||[]).forEach(function(a){ if ((a.doctor||a.doctorId||'').toString() === doctorId.toString() && (a.date||'') === date) out.push(a); }); }catch(e){} finally { cb(out); } }).catch(function(){ cb(out); });
    }
  }

  // check for appointment conflict: same doctor, same date and time
  function checkAppointmentConflict(doctorId, date, time, cb){
    try{
      var req = indexedDB.open('healthcareDB');
      req.onsuccess = function(e){
        var idb = e.target.result;
        if (idb && idb.objectStoreNames && idb.objectStoreNames.contains('appointments')){
          var tx = idb.transaction('appointments','readonly');
          var store = tx.objectStore('appointments');
          store.openCursor().onsuccess = function(ev){
            var cursor = ev.target.result;
            if (cursor){
              var a = cursor.value;
              if ((a.doctor||a.doctorId||'').toString() === doctorId.toString() && (a.date||'') === date && ((a.time||'') === (time||''))){
                cb(true); // conflict found
                return;
              }
              cursor.continue();
            } else {
              // finished scanning IDB, check localStorage as fallback
              try{
                var apps = JSON.parse(localStorage.getItem('appointments')||'[]');
                var conf = apps.some(function(x){
                  return (x.doctor||x.doctorId||'').toString() === doctorId.toString() && (x.date||'') === date && ((x.time||'') === (time||''));
                });
                cb(conf);
              }catch(err){ cb(false); }
            }
          };
        } else {
          // no IDB store, check localStorage
          try{
            var apps2 = JSON.parse(localStorage.getItem('appointments')||'[]');
            var conf2 = apps2.some(function(x){
              return (x.doctor||x.doctorId||'').toString() === doctorId.toString() && (x.date||'') === date && ((x.time||'') === (time||''));
            });
            cb(conf2);
          }catch(err){ cb(false); }
        }
      };
      req.onerror = function(){
        try{
          var apps3 = JSON.parse(localStorage.getItem('appointments')||'[]');
          var conf3 = apps3.some(function(x){
            return (x.doctor||x.doctorId||'').toString() === doctorId.toString() && (x.date||'') === date && ((x.time||'') === (time||''));
          });
          cb(conf3);
        }catch(err){ cb(false); }
      };
    }catch(e){
      try{
        var apps4 = JSON.parse(localStorage.getItem('appointments')||'[]');
        var conf4 = apps4.some(function(x){
          return (x.doctor||x.doctorId||'').toString() === doctorId.toString() && (x.date||'') === date && ((x.time||'') === (time||''));
        });
        cb(conf4);
      }catch(err){ cb(false); }
    }
  }

  function formatDate(d){ try{ return new Date(d).toLocaleDateString(); }catch(e){ return d; } }

  function renderAppointmentsFor(userEmail){
    var listEl = $id('appointments-list'); if (!listEl) return;
    listEl.innerHTML = '';
    // prefer reading from IndexedDB
    try{
      var req = indexedDB.open('healthcareDB');
      req.onsuccess = function(e){
        var idb = e.target.result;
        try{
          if (!idb.objectStoreNames.contains('appointments')) { fallback(); return; }
          var tx = idb.transaction('appointments','readonly');
          var store = tx.objectStore('appointments');
          var apps = [];
          store.openCursor().onsuccess = function(ev){
            var cursor = ev.target.result;
            if (cursor){ apps.push(cursor.value); cursor.continue(); }
            else {
              apps = apps.filter(function(a){ return (a.patient||a.userEmail) === userEmail; });
              if (!apps.length) { listEl.innerHTML = '<li class="empty-message">No appointments scheduled yet.</li>'; return; }
              apps.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
              apps.forEach(function(a){
                var li = document.createElement('li'); li.className = 'appointment-item';
                li.innerHTML = '<div>' +
                                '<div style="color:var(--primary); font-weight:600; margin-bottom:6px;">📅 ' + formatDate(a.date) + (a.time ? (' at ' + a.time) : '') + '</div>' +
                                '<div style="color:#888; font-size:.95rem;">👨‍⚕️ ' + (a.doctorName || a.doctor || a.doctorId) + '</div>' +
                              '</div>' +
                              '<div class="appointment-status">' + (a.status || 'Scheduled') + '</div>';
                listEl.appendChild(li);
              });
            }
          };
        }catch(err){ console.warn('IDB render error', err); fallback(); }
      };
      req.onerror = function(){ fallback(); };
    }catch(e){ fallback(); }

    function fallback(){
      var apps = getAppointments().filter(function(a){ return a.userEmail === userEmail; });
      if (!apps.length) { listEl.innerHTML = '<li class="empty-message">No appointments scheduled yet.</li>'; return; }
      apps.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
      apps.forEach(function(a){
        var li = document.createElement('li'); li.className = 'appointment-item';
        li.innerHTML = '<div>' +
                        '<div style="color:var(--primary); font-weight:600; margin-bottom:6px;">📅 ' + formatDate(a.date) + (a.time ? (' at ' + a.time) : '') + '</div>' +
                        '<div style="color:#888; font-size:.95rem;">👨‍⚕️ ' + (a.doctorName || a.doctorId) + '</div>' +
                      '</div>' +
                      '<div class="appointment-status">' + (a.status || 'Scheduled') + '</div>';
        listEl.appendChild(li);
      });
    }
  }

  // DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    var patient = requirePatient(); if (!patient) return;
    var patientRecord = null;
    // Try to resolve full patient record (for DOB/NHS on doctor dashboard)
    try{
      fetch('patients.json').then(function(r){ return r.json(); }).then(function(blob){
        var list = Array.isArray(blob) ? blob : (blob.patients || []);
        var uname = (patient.username||'').toString().toLowerCase();
        var nm = (patient.name||'').toString().toLowerCase();
        patientRecord = (list||[]).find(function(p){
          return (p.nhs||'').toString().toLowerCase() === uname
                 || (p.accountUsername||'').toString().toLowerCase() === uname
                 || (p.name||'').toString().toLowerCase() === nm;
        }) || null;
      }).catch(function(){});
    }catch(e){}
    function firstName(full){ try{ if (!full) return ''; if (typeof full !== 'string') full = String(full); return full.split(/\s+/)[0]; }catch(e){ return full; } }
    var displayName = firstName(patient.name || patient.firstName || patient.username || patient.email || 'Patient');
    var nameEl = $id('patient-name'); if (nameEl) nameEl.textContent = displayName;
    var emailEl = $id('patient-email'); if (emailEl) emailEl.textContent = patient.email || patient.username || '';

    var logout = $id('logout-btn'); if (logout) logout.addEventListener('click', function(){ sessionStorage.clear(); if (window.ui) ui.showToast('Logged out','default'); setTimeout(function(){ location.href='Hospital Home.html'; }, 500); });
    var homeBtn = $id('homeBtn'); if (homeBtn) homeBtn.addEventListener('click', function(){ location.href = 'Hospital Home.html'; });

    loadDoctors();
  var dfield = $id('appointment-date'); if (dfield) dfield.min = new Date().toISOString().split('T')[0];
  // initialize slot list and reactive filtering
  try{ refreshAvailableTimes(); }catch(e){}
  var ds = $id('doctor-select'); if (ds) ds.addEventListener('change', function(){ try{ refreshAvailableTimes(); }catch(e){} });
  if (dfield) dfield.addEventListener('change', function(){ try{ refreshAvailableTimes(); }catch(e){} });

    var bookBtn = $id('book-btn'); if (bookBtn) bookBtn.addEventListener('click', function(){
      var doctorSel = $id('doctor-select'); var doctorId = doctorSel ? doctorSel.value : '';
      var date = ($id('appointment-date')||{}).value || '';
      var time = ($id('appointment-time')||{}).value || '';
      if (!doctorId){ showInlineAlert('booking-alert','Please select a doctor','error'); return; }
      if (!date){ showInlineAlert('booking-alert','Please select a date','error'); return; }
      var doctorName = (doctorSel && doctorSel.selectedOptions) ? doctorSel.selectedOptions[0].textContent : doctorId;
      var ap = { id: Date.now(), userEmail: patient.email||patient.username||displayName, doctor: doctorId, doctorName: doctorName, patient: patient.email||patient.username||displayName, date: date, time: time, status: 'Scheduled', createdAt: new Date().toISOString() };
      // enrich with patient details for doctor dashboard visibility
      try{
        var fullName = patient.name || (patient.firstName? (patient.firstName + ' ' + (patient.lastName||'')) : '') || displayName;
        ap.patientName = fullName;
        if (patientRecord){ ap.patientDob = patientRecord.dob || ''; ap.patientNhs = patientRecord.nhs || ''; ap.patientPhone = patientRecord.phone || ''; }
      }catch(e){}
      // check conflict before saving
      checkAppointmentConflict(doctorId, date, time, function(conflict){
        if (conflict){ showInlineAlert('booking-alert','That slot is already booked for this doctor. Please choose another time.','error'); return; }
        // try IndexedDB first, fallback to localStorage
        saveAppointmentToIDB(ap, function(){
          // success saving to IDB
          try{ if (apChannel) apChannel.postMessage({ type:'appointment:created', appointment: ap }); }catch(e){}
          showInlineAlert('booking-alert','Appointment booked successfully!','success');
          setTimeout(function(){ if ($id('appointment-date')) $id('appointment-date').value=''; if (doctorSel) doctorSel.selectedIndex=0; renderAppointmentsFor(ap.userEmail); }, 700);
          try{ refreshAvailableTimes(); }catch(e){}
        }, function(){
          // fallback to localStorage
          var apps = getAppointments(); apps.push(ap); saveAppointments(apps);
          try{ if (apChannel) apChannel.postMessage({ type:'appointment:created', appointment: ap, fallback: true }); }catch(e){}
          showInlineAlert('booking-alert','Appointment booked (offline)','success');
          setTimeout(function(){ if ($id('appointment-date')) $id('appointment-date').value=''; if (doctorSel) doctorSel.selectedIndex=0; renderAppointmentsFor(ap.userEmail); }, 700);
          try{ refreshAvailableTimes(); }catch(e){}
        });
      });
    });

    // Export appointments (downloads a JSON file combining IDB/localStorage and static file fetch) for developer/admin to persist to appointments.json
    var exportBtn = $id('export-appointments-btn');
    if (exportBtn){ exportBtn.addEventListener('click', function(){
      // aggregate from localStorage and IDB
      var out = [];
      try{ out = out.concat(JSON.parse(localStorage.getItem('appointments')||'[]')); }catch(e){}
      try{
        var req = indexedDB.open('healthcareDB');
        req.onsuccess = function(e){ var idb = e.target.result; if (!idb || !idb.objectStoreNames.contains('appointments')) { finalize(); return; } var tx = idb.transaction('appointments','readonly'); var store = tx.objectStore('appointments'); var cur = store.openCursor(); cur.onsuccess = function(ev){ var c = ev.target.result; if (c){ out.push(c.value); c.continue(); } else { finalize(); } }; };
        req.onerror = finalize;
      }catch(e){ finalize(); }

      function finalize(){ try{ var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'appointments.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); if (window.ui && ui.showToast) ui.showToast('Appointments exported', 'default', 1200); }catch(err){ alert('Export failed: '+err.message); } }
    }); }

  renderAppointmentsFor(patient.email || patient.username || displayName);
  // also try to render prescriptions/notes
  try{ if (window.renderPatientNotes) window.renderPatientNotes(patient.email || patient.username || displayName); }catch(e){}
  });

})();

// Render prescriptions and notes/messages for patient in the 'notes-list'
(function(){
  function $id(id){ return document.getElementById(id); }
  function renderPatientNotes(userEmail){
    var list = $id('notes-list'); if (!list) return;
    list.innerHTML = '';
    try{
      var req = indexedDB.open('healthcareDB');
      req.onsuccess = function(e){ var idb = e.target.result; if (!idb){ fallback(); return; }
        // prescriptions
        try{
          var txp = idb.transaction('prescriptions','readonly'); var ps = txp.objectStore('prescriptions');
          var items = [];
          ps.openCursor().onsuccess = function(ev){ var c = ev.target.result; if (c){ var p = c.value; if ((p.patient||'') === userEmail) items.push({ kind:'rx', text:(p.medicineName||'') + (p.dosage?(' — '+p.dosage):''), ts:p.ts }); c.continue(); } else { next(items); } };
        }catch(err){ next([]); }

        function next(items){
          // messages
          try{ var txm = idb.transaction('contactMessages','readonly'); var ms = txm.objectStore('contactMessages'); ms.openCursor().onsuccess = function(ev){ var c = ev.target.result; if (c){ var m = c.value; if ((m.to||'') === userEmail) items.push({kind:'msg', text:m.message||m.text||'', ts:m.ts}); c.continue(); } else { finish(items); } }; }
          catch(err){ finish(items); }
        }
        function finish(items){ if (!items.length) { list.innerHTML='<li class="empty-message">No prescriptions or notes available yet.</li>'; return; } items.sort(function(a,b){ return new Date(b.ts||0)-new Date(a.ts||0); }); items.forEach(function(it){ var li=document.createElement('li'); li.textContent = (it.kind==='rx'?'Rx: ':'Note: ')+it.text; list.appendChild(li); }); }
      };
      req.onerror = fallback;
    }catch(e){ fallback(); }

    function fallback(){ list.innerHTML = '<li class="empty-message">No prescriptions or notes available yet.</li>'; }
  }
  window.renderPatientNotes = renderPatientNotes;
})();

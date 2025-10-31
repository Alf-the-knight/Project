// ====================================================
// Admin Dashboard Script (Connected to accounts.json + patients.json)
// ====================================================

let db;
const dbName = "healthcareDB";
const encryptionKey = "SuperSecureKey123";

// ====================================================
// Initialize IndexedDB
// ====================================================
window.onload = function () {
  initDB();
  setupUI();
};

function initDB() {
  let request = indexedDB.open(dbName, 4); // bumped from 3 -> 4

  request.onupgradeneeded = function (event) {
    db = event.target.result;

    if (!db.objectStoreNames.contains("patients")) {
      let store = db.createObjectStore("patients", { keyPath: "id", autoIncrement: true });
      store.createIndex("name", "name", { unique: false });
    }

    if (!db.objectStoreNames.contains("accounts")) {
      let accStore = db.createObjectStore("accounts", { keyPath: "id", autoIncrement: true });
      accStore.createIndex("username", "username", { unique: true });
    }

    if (!db.objectStoreNames.contains("logs")) {
      db.createObjectStore("logs", { keyPath: "timestamp" });
    }

    // contact messages
    if (!db.objectStoreNames.contains("contactMessages")) {
      const cms = db.createObjectStore("contactMessages", { keyPath: 'id', autoIncrement: true });
      cms.createIndex('ts', 'ts', { unique: false });
    }

    // New: doctors store for doctor management
    if (!db.objectStoreNames.contains("doctors")) {
      let docStore = db.createObjectStore("doctors", { keyPath: "id", autoIncrement: true });
      docStore.createIndex("name", "name", { unique: false });
      docStore.createIndex("specialization", "specialization", { unique: false });
    }

    // Appointments store (shared between patients, doctors, admin)
    if (!db.objectStoreNames.contains("appointments")) {
      let aStore = db.createObjectStore("appointments", { keyPath: "id", autoIncrement: true });
      aStore.createIndex("byDoctor", "doctor", { unique: false });
      aStore.createIndex("byPatient", "patient", { unique: false });
      aStore.createIndex("byDate", "date", { unique: false });
    }

    // Medicines store (inventory)
    if (!db.objectStoreNames.contains("medicines")) {
      let mStore = db.createObjectStore("medicines", { keyPath: "id", autoIncrement: true });
      mStore.createIndex("drug", "Drug", { unique: false });
      mStore.createIndex("stock", "stock", { unique: false });
    }

    // Prescriptions store (records of prescriptions by doctors)
    if (!db.objectStoreNames.contains("prescriptions")) {
      let pStore = db.createObjectStore("prescriptions", { keyPath: "id", autoIncrement: true });
      pStore.createIndex("byDoctor", "doctor", { unique: false });
      pStore.createIndex("byPatient", "patient", { unique: false });
      pStore.createIndex("byMedicine", "medicineId", { unique: false });
    }

    // Restock requests (created by doctors when medicines are out of stock)
    if (!db.objectStoreNames.contains("restockRequests")) {
      db.createObjectStore("restockRequests", { keyPath: "id", autoIncrement: true });
    }

    console.log("Database structure ready.");
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    console.log("Database opened successfully.");
    checkAndLoadJSON();
    // display contact messages if admin page is open
    displayContactMessages();
    // Also render JSON-backed lists so admin can immediately see file contents
    renderAllFromJSON().catch((err) => console.warn('Render from JSON failed:', err));
  };

  request.onerror = function (event) {
    console.error("Database error:", event.target.errorCode);
  };
}

// ====================================================
// Load JSON Data into IndexedDB (if empty)
// ====================================================
function checkAndLoadJSON() {
  // Patients
  let tx1 = db.transaction("patients", "readonly");
  let store1 = tx1.objectStore("patients");
  let count1 = store1.count();

  count1.onsuccess = function () {
    if (count1.result === 0) {
      console.log("Loading data from patients.json...");
      fetchPatientsJSON();
    } else {
      displayPatients();
    }
  };

  // Accounts
  let tx2 = db.transaction("accounts", "readonly");
  let store2 = tx2.objectStore("accounts");
  let count2 = store2.count();

  count2.onsuccess = function () {
    if (count2.result === 0) {
      console.log("Loading data from accounts.json...");
      fetchAccountsJSON();
    } else {
      displayAccounts();
    }
  };

  // Doctors (new)
  if (db.objectStoreNames.contains("doctors")) {
    let tx3 = db.transaction("doctors", "readonly");
    let store3 = tx3.objectStore("doctors");
    let count3 = store3.count();

    count3.onsuccess = function () {
      if (count3.result === 0) {
        console.log("Attempting to load data from doctors.json (if present)...");
        fetchDoctorsJSON(); // safe if file missing, will catch
      } else {
        displayDoctors();
      }
    };
  }

  // Medicines
  if (db.objectStoreNames.contains("medicines")) {
    let txm = db.transaction("medicines", "readonly");
    let storem = txm.objectStore("medicines");
    let countm = storem.count();

    countm.onsuccess = function () {
      if (countm.result === 0) {
        console.log("Loading medicines from medicines.json (if present)...");
        fetchMedicinesJSON();
      } else {
        // no-op; admin view will call displayMedicines when needed
      }
    };
  }
}

// add a small wrapper so fetches use a cache-busting query and provide clearer hints
function safeFetchJSON(path) {
  // cache-bust to avoid stale results during development
  const url = `${path}?_=${Date.now()}`;
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${path} (status ${res.status}). Ensure you're serving the site via http(s) and that ${path} exists.`);
      return res.json();
    })
    .catch((err) => {
      // give a clear hint when running from file:// which blocks fetch in many browsers
      if (location.protocol === "file:") {
        console.error(`${err.message}\nHint: Using file:// may block fetch requests. Run a local static server (e.g. ` +
          "`npx http-server` or `python -m http.server`) and reload the page.");
      } else {
        console.error(err);
      }
      throw err;
    });
}

// ====================================================
// Fetch and store patients.json
// ====================================================
function fetchPatientsJSON() {
  safeFetchJSON("patients.json")
    .then((data) => {
      let tx = db.transaction("patients", "readwrite");
      let store = tx.objectStore("patients");

      data.patients.forEach((p) => {
        // store plaintext for demo/testing
        const patientRecord = {
          name: p.name,
          address: p.address || "",
          dob: p.dob || "",
          phone: p.phone || "",
          nhs: p.nhs || "",
        };
        store.add(patientRecord);
      });

      tx.oncomplete = () => {
        logActivity("Loaded patient data from patients.json");
        displayPatients();
      };
    })
    .catch((err) => console.error("Error loading patients.json:", err));
}

// ====================================================
// Fetch and store accounts.json
// ====================================================
function fetchAccountsJSON() {
  safeFetchJSON("accounts.json")
    .then((data) => {
      let tx = db.transaction("accounts", "readwrite");
      let store = tx.objectStore("accounts");

      data.accounts.forEach((acc) => {
        // store plaintext account for demo/testing
        const account = {
          username: acc.username,
          password: acc.password || "",
          role: acc.role,
          lastActive: acc.lastActive || null,
        };
        store.add(account);
      });

      tx.oncomplete = () => {
        logActivity("Loaded account data from accounts.json");
        displayAccounts();
      };
    })
    .catch((err) => console.error("Error loading accounts.json:", err));
}

// ====================================================
// Fetch and store doctors.json
// ====================================================
function fetchDoctorsJSON() {
  safeFetchJSON("doctors.json")
    .then((data) => {
      let tx = db.transaction("doctors", "readwrite");
      let store = tx.objectStore("doctors");

      data.doctors.forEach((d) => {
        // store plaintext doctor record
        const doctorRecord = {
          name: d.first_name || d.name || '',
          specialization: d.specialization || '',
          phone: d.Telephone || d.phone || '',
          nhs: d.nhs || '',
          notes: d.notes || ''
        };
        store.add(doctorRecord);
      });

      tx.oncomplete = () => {
        logActivity("Loaded doctor data from doctors.json");
        displayDoctors();
      };
    })
    .catch((err) => console.warn("No doctors.json or load error:", err));
}

// ====================================================
// Fetch and store medicines.json
// ====================================================
function fetchMedicinesJSON() {
  safeFetchJSON("medicines.json")
    .then((data) => {
      let tx = db.transaction("medicines", "readwrite");
      let store = tx.objectStore("medicines");

      // medicines.json may be an array or object array; handle both
      const list = Array.isArray(data) ? data : (data.medicines || data);
      list.forEach((m) => {
        store.add({
          Drug: m.Drug || m.drug || '',
          meta: m,
          stock: typeof m.stock === 'number' ? m.stock : 50, // default stock
        });
      });

      tx.oncomplete = () => {
        logActivity("Loaded medicines from medicines.json");
      };
    })
    .catch((err) => console.warn("No medicines.json or load error:", err));
}

function displayMedicines(filter = '') {
  const tbody = document.querySelector('#medicinesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!db.objectStoreNames.contains('medicines')) return;

  let tx = db.transaction('medicines', 'readonly');
  let store = tx.objectStore('medicines');
  store.openCursor().onsuccess = function (e) {
    const cursor = e.target.result;
    if (cursor) {
      const med = cursor.value;
      const text = (med.Drug || '') + ' ' + JSON.stringify(med.meta || {});
      if (!filter || text.toLowerCase().includes(filter.toLowerCase())) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${(med.Drug||'').replace(/</g,'&lt;')}</td>
          <td>${med.stock || 0}</td>
          <td><button class="action-btn" onclick="editMedicine(${cursor.primaryKey})">Edit</button>
              <button class="action-btn" onclick="requestRestock(${cursor.primaryKey})">Request restock</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      cursor.continue();
    }
  };
}

function renderMedicinesFromJSON() {
  const tbody = document.querySelector('#medicinesTable tbody');
  if (!tbody) return Promise.resolve();
  tbody.innerHTML = '';
  return safeFetchJSON('medicines.json')
    .then((data) => {
      const list = Array.isArray(data) ? data : (data.medicines || data);
      (list || []).forEach((m) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${(m.Drug||'').replace(/</g,'&lt;')}</td>
          <td>${m.stock || 50}</td>
          <td><button class="action-btn" onclick="importMedicineToDB('${(m.id||'').toString().replace(/'/g, "\\'")}')">Import to DB</button></td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((err) => console.warn('Could not render medicines.json:', err));
}

function importMedicineToDB(id) {
  safeFetchJSON('medicines.json')
    .then((data) => {
      const list = Array.isArray(data) ? data : (data.medicines || data);
      const m = (list || []).find(x => (x.id||'').toString() === id.toString());
      if (!m) {
        if (window.ui && ui.showToast) ui.showToast('Medicine not found in medicines.json', 'error', 2200);
        return;
      }
      const tx = db.transaction('medicines', 'readwrite');
      tx.objectStore('medicines').add({ Drug: m.Drug || '', meta: m, stock: m.stock || 50 });
      tx.oncomplete = () => {
        if (window.ui && ui.showToast) ui.showToast('Imported medicine to DB', 'success', 1400);
        displayMedicines();
      };
    })
    .catch((err) => console.error('Import medicine failed:', err));
}

// ====================================================
// Encryption / Decryption
// ====================================================
// Encryption removed for demo: identity functions
function encrypt(text) { return text || ''; }
function decrypt(cipherText) { return cipherText || ''; }

// ====================================================
// PATIENT MANAGEMENT
// ====================================================
function displayPatients(query = "") {
  const tbody = document.querySelector("#patientTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let tx = db.transaction("patients", "readonly");
  let store = tx.objectStore("patients");

  store.openCursor().onsuccess = function (event) {
    let cursor = event.target.result;
    if (cursor) {
      const patient = cursor.value;

      // Decrypted fields to check against query
      const dec = {
        name: patient.name || "",
        address: decrypt(patient.address),
        dob: decrypt(patient.dob),
        phone: decrypt(patient.phone),
        nhs: decrypt(patient.nhs),
      };

      const q = (query || "").toLowerCase().trim();
      const matches =
        !q ||
        Object.values(dec)
          .join(" ")
          .toLowerCase()
          .includes(q);

      if (matches) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dec.name}</td>
          <td>${dec.address}</td>
          <td>${dec.dob}</td>
          <td>${dec.phone}</td>
          <td>${dec.nhs}</td>
          <td>
            <button class="action-btn" onclick="editPatient(${patient.id})">Edit</button>
            <button class="action-btn delete" onclick="deletePatient(${patient.id})">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      cursor.continue();
    }
  };
}

function promptAddPatient() {
  const name = prompt("Enter patient name:");
  const address = prompt("Enter address:");
  const dob = prompt("Enter DOB (YYYY-MM-DD):");
  const phone = prompt("Enter phone number:");
  const nhs = prompt("Enter NHS number:");

  if (name && address && dob && phone && nhs) {
    const encryptedPatient = {
      name,
      address: encrypt(address),
      dob: encrypt(dob),
      phone: encrypt(phone),
      nhs: encrypt(nhs),
    };
    let tx = db.transaction("patients", "readwrite");
    tx.objectStore("patients").add(encryptedPatient);
    tx.oncomplete = () => {
      logActivity(`Added new patient: ${name}`);
      displayPatients();
      if (window.ui && ui.showToast) ui.showToast('Patient added', 'success', 2000);
    };
  }
}

function editPatient(id) {
  let tx = db.transaction("patients", "readwrite");
  let store = tx.objectStore("patients");
  store.get(id).onsuccess = function (e) {
    let patient = e.target.result;
    if (patient) {
      const newName = prompt("New name:", patient.name);
      const newAddr = prompt("New address:", decrypt(patient.address));
      const newDOB = prompt("New DOB:", decrypt(patient.dob));
      const newPhone = prompt("New phone:", decrypt(patient.phone));
      const newNHS = prompt("New NHS:", decrypt(patient.nhs));

      patient.name = newName;
      patient.address = encrypt(newAddr);
      patient.dob = encrypt(newDOB);
      patient.phone = encrypt(newPhone);
      patient.nhs = encrypt(newNHS);

      store.put(patient);
      tx.oncomplete = () => {
        logActivity(`Updated patient ${newName}`);
        displayPatients();
      };
    }
  };
}

function deletePatient(id) {
  if (window.ui && ui.confirmDialog) {
    ui.confirmDialog('Delete this patient record?').then((ok) => {
      if (!ok) return;
      let tx = db.transaction('patients', 'readwrite');
      tx.objectStore('patients').delete(id);
      tx.oncomplete = () => {
        logActivity(`Deleted patient ID ${id}`);
        displayPatients();
        if (window.ui && ui.showToast) ui.showToast('Patient deleted', 'default', 1800);
      };
    });
  } else {
    if (!confirm('Delete this patient record?')) return;
    let tx = db.transaction('patients', 'readwrite');
    tx.objectStore('patients').delete(id);
    tx.oncomplete = () => {
      logActivity(`Deleted patient ID ${id}`);
      displayPatients();
    };
  }
}

// ====================================================
// DOCTOR MANAGEMENT
// ====================================================
function displayDoctors(query = "") {
  const tbody = document.querySelector("#doctorTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!db.objectStoreNames.contains("doctors")) return;

  let tx = db.transaction("doctors", "readonly");
  let store = tx.objectStore("doctors");

  // track whether any DB results were rendered; fallback to doctors.json if none
  let foundAny = false;

  store.openCursor().onsuccess = function (event) {
    let cursor = event.target.result;
    if (cursor) {
      foundAny = true;
      const doc = cursor.value;
      const dec = {
        name: doc.name || "",
        specialization: doc.specialization || "",
        phone: decrypt(doc.phone),
        nhs: decrypt(doc.nhs),
        notes: decrypt(doc.notes),
      };

      const q = (query || "").toLowerCase().trim();
      const matches =
        !q ||
        Object.values(dec)
          .join(" ")
          .toLowerCase()
          .includes(q);

      if (matches) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dec.name}</td>
          <td>${dec.specialization}</td>
          <td>${dec.phone}</td>
          <td>${dec.nhs}</td>
          <td>
            <button class="action-btn" onclick="editDoctor(${doc.id})">Edit</button>
            <button class="action-btn delete" onclick="deleteDoctor(${doc.id})">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      cursor.continue();
    }
  };

  tx.oncomplete = function () {
    if (!foundAny) {
      // no entries in DB — show doctors.json as a fallback view so admin can import
      renderDoctorsFromJSON().catch((err) => console.warn('Fallback renderDoctorsFromJSON failed:', err));
    }
  };
}

function promptAddDoctor() {
  const name = prompt("Doctor name:");
  const specialization = prompt("Specialization:");
  const phone = prompt("Phone:");
  const nhs = prompt("NHS number:");
  const notes = prompt("Notes (optional):", "");

  if (!name) {
    if (window.ui && ui.showToast) ui.showToast('Name required', 'error', 2200);
    return;
  }

  const encryptedDoctor = {
    name,
    specialization,
    phone: encrypt(phone || ""),
    nhs: encrypt(nhs || ""),
    notes: encrypt(notes || ""),
  };

  let tx = db.transaction("doctors", "readwrite");
  tx.objectStore("doctors").add(encryptedDoctor);
  tx.oncomplete = () => {
    logActivity(`Added doctor: ${name}`);
    displayDoctors();
  };
  if (window.ui && ui.showToast) ui.showToast('Doctor added', 'success', 1800);
}

// ====================================================
// Modal-based Add Patient / Add Doctor (preferred)
// ====================================================
function _showBackdrop(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  // trap focus briefly by focusing first focusable
  const first = el.querySelector('input, textarea, select, button');
  if (first) first.focus();
}

function _closeBackdrop(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
}

function showPatientModal() {
  _showBackdrop('patientModalBackdrop');
}

function closePatientModal() {
  // clear form to ensure Cancel leaves no partial state
  const f = document.getElementById('patientModalForm');
  if (f) f.reset();
  _closeBackdrop('patientModalBackdrop');
}

function submitPatientModal() {
  const first = (document.getElementById('p_first') || {}).value || '';
  const last = (document.getElementById('p_last') || {}).value || '';
  const dob = (document.getElementById('p_dob') || {}).value || '';
  const phone = (document.getElementById('p_phone') || {}).value || '';
  const nhs = (document.getElementById('p_nhs') || {}).value || '';
  const address = (document.getElementById('p_address') || {}).value || '';
  const notes = (document.getElementById('p_notes') || {}).value || '';

  if (!first) {
    if (window.ui && ui.showToast) ui.showToast('Patient first name required', 'error', 2000);
    return;
  }

  const name = `${first} ${last}`.trim();

  const tx = db.transaction('patients', 'readwrite');
  const store = tx.objectStore('patients');
  store.add({
    name: name,
    address: encrypt(address),
    dob: encrypt(dob),
    phone: encrypt(phone),
    nhs: encrypt(nhs),
    notes: encrypt(notes || '')
  });
  tx.oncomplete = () => {
    logActivity(`Added patient: ${name}`);
    displayPatients();
    if (window.ui && ui.showToast) ui.showToast('Patient added', 'success', 1400);
    closePatientModal();
  };
  tx.onerror = function (e) {
    console.error('Add patient failed', e);
    if (window.ui && ui.showToast) ui.showToast('Failed to add patient', 'error', 2200);
  };
}

function showDoctorModal() {
  _showBackdrop('doctorModalBackdrop');
}

function closeDoctorModal() {
  const f = document.getElementById('doctorModalForm');
  if (f) f.reset();
  _closeBackdrop('doctorModalBackdrop');
}

function submitDoctorModal() {
  const first = (document.getElementById('d_first') || {}).value || '';
  const last = (document.getElementById('d_last') || {}).value || '';
  const spec = (document.getElementById('d_spec') || {}).value || '';
  const phone = (document.getElementById('d_phone') || {}).value || '';
  const nhs = (document.getElementById('d_nhs') || {}).value || '';
  const notes = (document.getElementById('d_notes') || {}).value || '';

  if (!first) {
    if (window.ui && ui.showToast) ui.showToast('Doctor first name required', 'error', 2000);
    return;
  }

  const name = `${first} ${last}`.trim();

  const tx = db.transaction('doctors', 'readwrite');
  const store = tx.objectStore('doctors');
  store.add({
    name: name,
    specialization: spec,
    phone: encrypt(phone),
    nhs: encrypt(nhs),
    notes: encrypt(notes || '')
  });
  tx.oncomplete = () => {
    logActivity(`Added doctor: ${name}`);
    displayDoctors();
    if (window.ui && ui.showToast) ui.showToast('Doctor added', 'success', 1400);
    closeDoctorModal();
  };
  tx.onerror = function (e) {
    console.error('Add doctor failed', e);
    if (window.ui && ui.showToast) ui.showToast('Failed to add doctor', 'error', 2200);
  };
}

// Close modals on Escape key press
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closePatientModal();
    closeDoctorModal();
  }
});

function editDoctor(id) {
  let tx = db.transaction("doctors", "readwrite");
  let store = tx.objectStore("doctors");
  store.get(id).onsuccess = function (e) {
    let doc = e.target.result;
    if (doc) {
      const newName = prompt("New name:", doc.name);
      const newSpec = prompt("New specialization:", doc.specialization);
      const newPhone = prompt("New phone:", decrypt(doc.phone));
      const newNHS = prompt("New NHS:", decrypt(doc.nhs));
      const newNotes = prompt("New notes:", decrypt(doc.notes));

      doc.name = newName;
      doc.specialization = newSpec;
      doc.phone = encrypt(newPhone);
      doc.nhs = encrypt(newNHS);
      doc.notes = encrypt(newNotes);

      store.put(doc);
      tx.oncomplete = () => {
        logActivity(`Updated doctor ${newName}`);
        displayDoctors();
      };
    }
  };
}

function deleteDoctor(id) {
  if (window.ui && ui.confirmDialog) {
    ui.confirmDialog('Delete this doctor record?').then((ok) => {
      if (!ok) return;
      let tx = db.transaction('doctors', 'readwrite');
      tx.objectStore('doctors').delete(id);
      tx.oncomplete = () => {
        logActivity(`Deleted doctor ID ${id}`);
        displayDoctors();
        if (window.ui && ui.showToast) ui.showToast('Doctor deleted', 'default', 1800);
      };
    });
  } else {
    if (!confirm('Delete this doctor record?')) return;
    let tx = db.transaction('doctors', 'readwrite');
    tx.objectStore('doctors').delete(id);
    tx.oncomplete = () => {
      logActivity(`Deleted doctor ID ${id}`);
      displayDoctors();
    };
  }
}

// Edit medicine record (simple inline prompt for stock)
function editMedicine(id) {
  let tx = db.transaction('medicines', 'readwrite');
  let store = tx.objectStore('medicines');
  store.get(id).onsuccess = function (e) {
    const med = e.target.result;
    if (!med) return;
    const newStock = prompt('Set stock for ' + (med.Drug || '') + ':', (med.stock || 0));
    if (newStock === null) return;
    const parsed = parseInt(newStock.toString().trim(), 10);
    med.stock = isNaN(parsed) ? (med.stock || 0) : parsed;
    store.put(med);
    tx.oncomplete = () => {
      logActivity(`Updated medicine ${med.Drug} stock to ${med.stock}`);
      displayMedicines();
      if (window.ui && ui.showToast) ui.showToast('Medicine updated', 'success', 1400);
    };
  };
}

function requestRestock(medicineId) {
  const reason = prompt('Enter restock reason / note (optional):', 'Low stock request');
  const tx = db.transaction('restockRequests', 'readwrite');
  tx.objectStore('restockRequests').add({ medicineId, reason: reason || '', ts: new Date().toISOString() });
  tx.oncomplete = () => {
    logActivity(`Restock requested for medicine ID ${medicineId}`);
    if (window.ui && ui.showToast) ui.showToast('Restock requested', 'default', 1600);
  };
}

// ====================================================
// ACCOUNT MANAGEMENT
// ====================================================
function displayAccounts() {
  const tbody = document.querySelector("#accountTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let tx = db.transaction("accounts", "readonly");
  let store = tx.objectStore("accounts");

  store.openCursor().onsuccess = function (event) {
    const cursor = event.target.result;
    if (cursor) {
      const acc = cursor.value;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${acc.username}</td>
        <td>${acc.role}</td>
        <td>${decrypt(acc.password)}</td>
        <td>
          <button class="action-btn" onclick="editAccount(${acc.id})">Edit</button>
          <button class="action-btn delete" onclick="deleteAccount(${acc.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
      cursor.continue();
    }
  };
}

function addAccount() {
  const username = prompt("Enter username:");
  const password = prompt("Enter password:");
  const role = prompt("Enter role (admin/doctor/patient):");

  if (!username || !password || !role) {
    if (window.ui && ui.showToast) ui.showToast('All fields required', 'error', 2200);
    return;
  }

  let tx = db.transaction("accounts", "readwrite");
  let store = tx.objectStore("accounts");
  store.add({
    username,
    password: encrypt(password),
    role,
    lastActive: new Date().toISOString(),
  });
  tx.oncomplete = () => {
    logActivity(`Added account for ${username}`);
    displayAccounts();
  };
  if (window.ui && ui.showToast) ui.showToast('Account added', 'success', 1800);
}

function editAccount(id) {
  let tx = db.transaction("accounts", "readwrite");
  let store = tx.objectStore("accounts");
  store.get(id).onsuccess = function (e) {
    let acc = e.target.result;
    if (acc) {
      const newUser = prompt("New username:", acc.username);
      const newPass = prompt("New password:", decrypt(acc.password));
      const newRole = prompt("New role:", acc.role);

      acc.username = newUser;
      acc.password = encrypt(newPass);
      acc.role = newRole;
      acc.lastActive = new Date().toISOString();

      store.put(acc);
      tx.oncomplete = () => {
        logActivity(`Updated account ${newUser}`);
        displayAccounts();
      };
    }
  };
}

function deleteAccount(id) {
  if (window.ui && ui.confirmDialog) {
    ui.confirmDialog('Delete this account?').then((ok) => {
      if (!ok) return;
      let tx = db.transaction('accounts', 'readwrite');
      tx.objectStore('accounts').delete(id);
      tx.oncomplete = () => {
        logActivity(`Deleted account ID ${id}`);
        displayAccounts();
        if (window.ui && ui.showToast) ui.showToast('Account deleted', 'default', 1800);
      };
    });
  } else {
    if (!confirm('Delete this account?')) return;
    let tx = db.transaction('accounts', 'readwrite');
    tx.objectStore('accounts').delete(id);
    tx.oncomplete = () => {
      logActivity(`Deleted account ID ${id}`);
      displayAccounts();
    };
  }
}

// ====================================================
// Logs
// ====================================================
function logActivity(action) {
  let tx = db.transaction("logs", "readwrite");
  let store = tx.objectStore("logs");
  const timestamp = new Date().toISOString();
  store.add({ timestamp, action });
  tx.oncomplete = () => displayLogs();
}

function displayLogs() {
  const logList = document.getElementById("activityLog");
  if (!logList) return;
  logList.innerHTML = "";

  let tx = db.transaction("logs", "readonly");
  let store = tx.objectStore("logs");
  store.openCursor(null, "prev").onsuccess = function (e) {
    const cursor = e.target.result;
    if (cursor) {
      const log = cursor.value;
      let li = document.createElement("li");
      li.textContent = `[${log.timestamp}] ${log.action}`;
      logList.appendChild(li);
      cursor.continue();
    }
  };
}

// ====================================================
// Contact messages display
// ====================================================
function displayContactMessages(filter = '') {
  const tbody = document.querySelector('#contactsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!db.objectStoreNames.contains('contactMessages')) return;

  let tx = db.transaction('contactMessages', 'readonly');
  let store = tx.objectStore('contactMessages');
  store.openCursor(null, 'prev').onsuccess = function (e) {
    const cursor = e.target.result;
    if (cursor) {
      const msg = cursor.value;
      const text = [msg.name, msg.email, msg.phone, msg.message, msg.ts].join(' ').toLowerCase();
      if (!filter || text.includes(filter.toLowerCase())) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${msg.name || ''}</td>
          <td>${msg.email || ''}</td>
          <td>${msg.phone || ''}</td>
          <td style="max-width:360px; white-space:pre-wrap;">${(msg.message||'').replace(/</g,'&lt;')}</td>
          <td>${msg.ts || ''}</td>
          <td><button class="action-btn" onclick="deleteContactMessage(${cursor.primaryKey})">Delete</button></td>
        `;
        tbody.appendChild(tr);
      }
      cursor.continue();
    }
  };
}

function deleteContactMessage(id) {
  if (!confirm('Delete this contact message?')) return;
  let tx = db.transaction('contactMessages', 'readwrite');
  tx.objectStore('contactMessages').delete(id);
  tx.oncomplete = () => {
    logActivity(`Deleted contact message ID ${id}`);
    displayContactMessages();
    if (window.ui && ui.showToast) ui.showToast('Message deleted', 'default', 1200);
  };
}


function showSection(id) {
  document.querySelectorAll(".main-content section").forEach((s) => (s.style.display = "none"));
  document.getElementById(id).style.display = "block";
}

function logout() {
  if (window.ui && ui.showToast) ui.showToast('You have been logged out', 'default', 1000);
  setTimeout(() => { window.location.href = 'Hospital Home.html'; }, 700);
}

// import/export helpers removed to simplify admin UI per request

function importPatientToDB(nhs) {
  safeFetchJSON('patients.json')
    .then((data) => {
      const p = (data.patients || []).find(x => x.nhs === nhs);
      if (!p) {
        if (window.ui && ui.showToast) ui.showToast('Patient not found in patients.json', 'error', 2200);
        return;
      }
      const tx = db.transaction('patients', 'readwrite');
      tx.objectStore('patients').add({
        name: p.name,
        address: encrypt(p.address || ''),
        dob: encrypt(p.dob || ''),
        phone: encrypt(p.phone || ''),
        nhs: encrypt(p.nhs || ''),
      });
      tx.oncomplete = () => {
        if (window.ui && ui.showToast) ui.showToast('Imported patient to DB', 'success', 1400);
        displayPatients();
      };
    })
    .catch((err) => console.error('Import patient failed:', err));
}

function renderDoctorsFromJSON() {
  const tbody = document.querySelector('#doctorTable tbody');
  if (!tbody) return Promise.resolve();
  tbody.innerHTML = '';

  return safeFetchJSON('doctors.json')
    .then((data) => {
      (data.doctors || []).forEach((d) => {
        const name = d.first_name ? `${d.first_name} ${d.last_name || ''}`.trim() : (d.name || '');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${name}</td>
          <td>${d.specialization || ''}</td>
          <td>${d.Telephone || d.phone || ''}</td>
          <td>${d.nhs || ''}</td>
          <td><button class="action-btn" onclick="importDoctorToDB('${(d.nhs||'').replace(/'/g, "\\'")}')">Import to DB</button></td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((err) => console.warn('Could not render doctors.json:', err));
}

function importDoctorToDB(nhs) {
  safeFetchJSON('doctors.json')
    .then((data) => {
      const d = (data.doctors || []).find(x => x.nhs === nhs);
      if (!d) {
        if (window.ui && ui.showToast) ui.showToast('Doctor not found in doctors.json', 'error', 2200);
        return;
      }
      const name = d.first_name ? `${d.first_name} ${d.last_name || ''}`.trim() : (d.name || '');
      const tx = db.transaction('doctors', 'readwrite');
      tx.objectStore('doctors').add({
        name: name,
        specialization: d.specialization || '',
        phone: encrypt(d.Telephone || d.phone || ''),
        nhs: encrypt(d.nhs || ''),
        notes: encrypt(d.notes || ''),
      });
      tx.oncomplete = () => {
        if (window.ui && ui.showToast) ui.showToast('Imported doctor to DB', 'success', 1400);
        displayDoctors();
      };
    })
    .catch((err) => console.error('Import doctor failed:', err));
}

function renderAllFromJSON() {
  // Render concurrently and return a Promise that resolves when all attempted
  return Promise.allSettled([
    renderAccountsFromJSON(),
    renderPatientsFromJSON(),
    renderDoctorsFromJSON(),
  ]).then(() => {});
}

function importPatientsFile(file, mode = "merge") {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data.patients) throw new Error("Invalid format");
      let tx = db.transaction("patients", "readwrite");
      let store = tx.objectStore("patients");

      if (mode === "replace") {
        // clear then add
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
          data.patients.forEach((p) => {
            store.add({
              name: p.name,
              address: encrypt(p.address || ""),
              dob: encrypt(p.dob || ""),
              phone: encrypt(p.phone || ""),
              nhs: encrypt(p.nhs || ""),
            });
          });
        };
      } else {
        data.patients.forEach((p) => {
          store.add({
            name: p.name,
            address: encrypt(p.address || ""),
            dob: encrypt(p.dob || ""),
            phone: encrypt(p.phone || ""),
            nhs: encrypt(p.nhs || ""),
          });
        });
      }

      tx.oncomplete = () => {
        logActivity(`Imported patients (${mode})`);
        displayPatients();
      };
    } catch (err) {
      console.error("Import patients failed:", err);
      if (window.ui && ui.showToast) ui.showToast('Failed to import patients file', 'error', 3000);
    }
  };
  reader.readAsText(file);
}

function importAccountsFile(file, mode = "merge") {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data.accounts) throw new Error("Invalid format");
      let tx = db.transaction("accounts", "readwrite");
      let store = tx.objectStore("accounts");

      if (mode === "replace") {
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
          data.accounts.forEach((acc) => {
            store.add({
              username: acc.username,
              password: encrypt(acc.password || ""),
              role: acc.role,
              lastActive: acc.lastActive || null,
            });
          });
        };
      } else {
        data.accounts.forEach((acc) => {
          store.add({
            username: acc.username,
            password: encrypt(acc.password || ""),
            role: acc.role,
            lastActive: acc.lastActive || null,
          });
        });
      }

      tx.oncomplete = () => {
        logActivity(`Imported accounts (${mode})`);
        displayAccounts();
      };
    } catch (err) {
      console.error("Import accounts failed:", err);
      if (window.ui && ui.showToast) ui.showToast('Failed to import accounts file', 'error', 3000);
    }
  };
  reader.readAsText(file);
}

function updateAccountActivity(accountId, note = "activity") {
  let tx = db.transaction("accounts", "readwrite");
  let store = tx.objectStore("accounts");
  store.get(accountId).onsuccess = function (e) {
    const acc = e.target.result;
    if (!acc) return;
    acc.lastActive = new Date().toISOString();
    store.put(acc);
    tx.oncomplete = () => {
      logActivity(`Account ${acc.username} activity: ${note}`);
      displayAccounts();
    };
  };
}

// Setup UI hooks for search and file inputs (safe if elements are missing)
function setupUI() {
  const pSearch = document.getElementById("patientSearch");
  if (pSearch) {
    pSearch.addEventListener("input", (e) => {
      displayPatients(e.target.value);
    });
  }

  const dSearch = document.getElementById("doctorSearch");
  if (dSearch) {
    dSearch.addEventListener("input", (e) => {
      displayDoctors(e.target.value);
    });
  }

  const importPatientsInput = document.getElementById("importPatientsFile");
  if (importPatientsInput) {
    // import UI removed
  }

  const importAccountsInput = document.getElementById("importAccountsFile");
  if (importAccountsInput) {
    // import UI removed
  }

  const exportPatientsBtn = document.getElementById("exportPatientsBtn");
  // export patients button removed

  const exportAccountsBtn = document.getElementById("exportAccountsBtn");
  // export accounts button removed

  const contactSearch = document.getElementById('contactSearch');
  if (contactSearch) contactSearch.addEventListener('input', (e) => displayContactMessages(e.target.value));

  const medSearch = document.getElementById('medSearch');
  if (medSearch) medSearch.addEventListener('input', (e) => displayMedicines(e.target.value));

  const exportContactsBtn = document.getElementById('exportContactsBtn');
  // export contacts button removed
}

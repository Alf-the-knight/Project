// === Global Variables ===
let db, doctor_data = [], people_data = [], drug_data = [];
let currentStore, currentKey = null;

// === Initialize after DOM loaded ===
document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // Search inputs
  document.getElementById("doctorSearch").addEventListener("input", e => showTable("doctors", "doctorTable", e.target.value));
  document.getElementById("medicineSearch").addEventListener("input", e => showTable("medicine", "medicineTable", e.target.value));
  document.getElementById("patientSearch").addEventListener("input", e => showTable("patients", "patientTable", e.target.value));
  document.getElementById("historySearch").addEventListener("input", e => showTable("patientHistory", "historyTable", e.target.value));
  document.getElementById("apptSearch").addEventListener("input", e => showTable("appointments", "apptTable", e.target.value));

  // Modal save button
  document.getElementById("modalSave").addEventListener("click", saveModalData);
});

// === Database Functions ===
function createOrOpenDB() {
  const request = indexedDB.open("HealthcareDB", 10);

  request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("doctors")) db.createObjectStore("doctors", { keyPath: "id" });
    if (!db.objectStoreNames.contains("medicine")) db.createObjectStore("medicine", { keyPath: "id" });
    if (!db.objectStoreNames.contains("patients")) db.createObjectStore("patients", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("patientHistory")) db.createObjectStore("patientHistory", { keyPath: "NHS" });
    if (!db.objectStoreNames.contains("appointments")) db.createObjectStore("appointments", { keyPath: "id", autoIncrement: true });
  };

  request.onsuccess = e => {
    db = e.target.result;
    alert("Database ready");
    showAllData();
  };

  request.onerror = e => alert("DB Error:" + e.target.error);
}

// Fetch JSON from GitHub
function getMyData() {
  const output = document.getElementById("output");
  output.innerHTML = "⏳ Fetching data...";

  Promise.all([
    fetch("https://raw.githubusercontent.com/Alf-the-knight/Project/refs/heads/main/doctors.json").then(r => r.json()),
    fetch("https://raw.githubusercontent.com/Alf-the-knight/Project/refs/heads/main/patients.json").then(r => r.json()),
    fetch("https://raw.githubusercontent.com/Alf-the-knight/Project/refs/heads/main/medicines.json").then(r => r.json())
  ])
    .then(([d, p, m]) => {
      doctor_data = d; people_data = p; drug_data = m;
      output.innerHTML = "✅ JSON fetched successfully.";
    })
    .catch(err => { console.error(err); output.innerHTML = "❌ Fetch failed."; });
}

// Import fetched data (duplicate-safe)
function importFetchedData() {
  if (!db) return alert("DB not open");

  const importStore = (storeName, records) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    records.forEach(r => {
      const key = store.keyPath === "id" ? r.id : r.NHS;
      const request = store.get(key);
      request.onsuccess = e => {
        if (!e.target.result) store.put(r); // Add only if not exist
      };
    });

    tx.oncomplete = showAllData;
  };

  if (doctor_data.length) importStore("doctors", doctor_data);
  if (people_data.length) importStore("patients", people_data);
  if (drug_data.length) importStore("medicine", drug_data);
}

// === Show Tables ===
function showTable(storeName, tableId, filter = "") {
  if (!db) return;
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";

  const cursorRequest = storeName === "patients" ? store.openCursor(null, "next") : store.openCursor();
  cursorRequest.onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const obj = cursor.value;
      if (JSON.stringify(obj).toLowerCase().includes(filter.toLowerCase())) {
        const row = document.createElement("tr");

        if (storeName === "patients") {
          row.innerHTML = `<td>${obj.id}</td><td>${obj.NHS}</td><td>${obj.Title}</td><td>${obj.First}</td><td>${obj.Last}</td>
          <td>${obj.DOB}</td><td>${obj.Gender}</td><td>${obj.Address}</td><td>${obj.Email}</td><td>${obj.Telephone}</td>`;
        } else {
          Object.values(obj).forEach(v => row.innerHTML += `<td>${v}</td>`);
        }

        row.innerHTML += `<td>
          <button onclick='openModal("${storeName}",${JSON.stringify(obj[store.keyPath])})'>Edit</button>
          <button onclick='deleteRecord("${storeName}",${JSON.stringify(obj[store.keyPath])})'>Delete</button>
        </td>`;
        tbody.appendChild(row);
      }
      cursor.continue();
    }
  };
}

function showAllData() {
  showTable("doctors", "doctorTable");
  showTable("medicine", "medicineTable");
  showTable("patients", "patientTable");
  showTable("patientHistory", "historyTable");
  showTable("appointments", "apptTable");
}

// === Delete Record ===
function deleteRecord(storeName, key) {
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  tx.oncomplete = showAllData;
}

// === Modal Functions ===
function openModal(storeName, key = null) {
  currentStore = storeName;
  currentKey = key;
  const modalBg = document.getElementById("modalBg");
  const modalFields = document.getElementById("modalFields");
  modalFields.innerHTML = "";

  let fields = [];
  switch (storeName) {
    case "doctors": fields = ["id","first_name","last_name","email","gender","Address","Telephone"]; break;
    case "medicine": fields = ["id","Drug"]; break;
    case "patients": fields = ["id","NHS","Title","First","Last","DOB","Gender","Address","Email","Telephone"]; break;
    case "patientHistory": fields = ["NHS","First","Last","ChiefReason","Medication","Allergies","SocialHistory","MedicalHistory","FamilyHistory"]; break;
    case "appointments": fields = ["PatientNHS","PatientFirst","PatientLast","DoctorID","DoctorFirst","DoctorLast","Date","Time"]; break;
  }

  if (key === null) {
    fields.forEach(f => modalFields.innerHTML += `<label>${f}: <input name="${f}" value="" ${f==="id"&&storeName==="patients"?"readonly placeholder='Auto-generated'":""}></label>`);
    modalBg.style.display = "flex";
  } else {
    db.transaction(storeName, "readonly").objectStore(storeName).get(key).onsuccess = e => {
      const data = e.target.result;
      fields.forEach(f => modalFields.innerHTML += `<label>${f}: <input name="${f}" value="${data[f]||""}" ${f==="id"&&storeName==="patients"?"readonly":""}></label>`);
      modalBg.style.display = "flex";
    };
  }
}

function saveModalData() {
  const updated = {};
  document.getElementById("modalFields").querySelectorAll("input").forEach(i => updated[i.name] = i.value);
  const tx = db.transaction(currentStore, "readwrite");
  tx.objectStore(currentStore).put(updated);
  tx.oncomplete = () => { showAllData(); closeModal(); };
}

function closeModal() {
  document.getElementById("modalBg").style.display = "none";
}

// === Queries, Clear, Delete, Close ===
function queryAllData() {
  if(!db) return alert("DB not open");
  const result = [];
  db.transaction("patients", "readonly").objectStore("patients").openCursor().onsuccess = e => {
    const c = e.target.result;
    if(c){ result.push(c.value); c.continue(); } else console.log("All Patients:", result);
  };
}

function queryPerson() {
  const nhs = prompt("Enter Patient NHS:");
  if(!db || !nhs) return;
  db.transaction("patients","readonly").objectStore("patients").openCursor().onsuccess = e => {
    const c = e.target.result;
    if(c){ if(c.value.NHS === nhs) console.log("Found:", c.value); c.continue(); }
  };
}

function queryDoctor() {
  if(!db) return alert("DB not open");
  const id = prompt("Enter Doctor ID:");
  if(!id) return;
  db.transaction("doctors","readonly").objectStore("doctors").get(Number(id)).onsuccess = e => {
    const r = e.target.result; r?console.log("Doctor:",r):alert("Not found");
  };
}

function queryMedicine() {
  if(!db) return alert("DB not open");
  const id = prompt("Enter Medicine ID:");
  if(!id) return;
  db.transaction("medicine","readonly").objectStore("medicine").get(Number(id)).onsuccess = e => {
    const r = e.target.result; r?console.log("Medicine:",r):alert("Not found");
  };
}

function queryAppointment() {
  const id = prompt("Enter Appointment ID:");
  if(!db || !id) return;
  db.transaction("appointments","readonly").objectStore("appointments").get(Number(id)).onsuccess = e => {
    const r = e.target.result; r?console.log("Appointment:",r):alert("Not found");
  };
}

function searchData() {
  const term = prompt("Enter search term:");
  if(!term) return;
  showAllData(); // searches automatically via filter inputs
}

function clearDatabase() {
  if(!db) return alert("DB not open");
  if(confirm("Clear all data from database?")){
    ["doctors","medicine","patients","patientHistory","appointments"].forEach(store=>{
      db.transaction(store,"readwrite").objectStore(store).clear();
    });
    showAllData();
  }
}

function deleteDatabase() {
  if(confirm("Delete the entire database?")){
    const req = indexedDB.deleteDatabase("HealthcareDB");
    req.onsuccess = () => { alert("Database deleted"); db=null; };
    req.onerror = e => alert("Delete failed:"+e.target.error);
  }
}

function closeDatabase() {
  if(db){ db.close(); db=null; alert("Database closed"); }
}

// Shared IndexedDB helper for the Hospital site
// Provides: openDB(), addPatient(), getPatientByNHS(), getPatientByEmail(), getAccount(), authenticateAccount(), authenticatePatient()
const DB_NAME = 'healthcareDB';
const DB_VERSION = 4;
// Encryption removed: store plaintext for demo/testing

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        try {
          if (!db.objectStoreNames.contains('patients')) {
            db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('doctors')) {
            db.createObjectStore('doctors', { keyPath: 'id', autoIncrement: true });
          }
          // Use numeric id for accounts to match adminjs expectations; create index on username
          if (!db.objectStoreNames.contains('accounts')) {
            const acc = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
            acc.createIndex('username', 'username', { unique: true });
          }
          // contact messages store for messages sent via contact form
          if (!db.objectStoreNames.contains('contactMessages')) {
            const cms = db.createObjectStore('contactMessages', { keyPath: 'id', autoIncrement: true });
            cms.createIndex('ts', 'ts', { unique: false });
          }
        } catch (err) {
          console.warn('upgrade error', err);
        }
      };

    req.onsuccess = async (e) => {
      const db = e.target.result;
      // ensure initial JSON data exists in stores (only runs if store empty)
      try {
        await seedInitialData(db);
      } catch (err) {
        console.warn('seeding initial data failed', err);
      }
      resolve(db);
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

function addContactMessage(msg) {
  return openDB().then(db => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('contactMessages', 'readwrite');
      const store = tx.objectStore('contactMessages');
      const payload = Object.assign({}, msg, { ts: new Date().toISOString() });
      const req = store.add(payload);
      req.onsuccess = e => resolve(Object.assign({ id: e.target.result }, payload));
      req.onerror = e => reject(e.target.error);
    } catch (err) { reject(err); }
  }));
}

function getContactMessages() {
  return openDB().then(db => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('contactMessages', 'readonly');
      const store = tx.objectStore('contactMessages');
      const out = [];
      store.openCursor(null, 'prev').onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { out.push(Object.assign({ id: cursor.primaryKey }, cursor.value)); cursor.continue(); }
        else resolve(out);
      };
    } catch (err) { reject(err); }
  }));
}

function seedInitialData(db) {
  return new Promise((resolve) => {
    // Check counts and fetch json files if stores empty
    try {
      const tx = db.transaction(['accounts', 'patients', 'doctors'], 'readwrite');
      const accStore = tx.objectStore('accounts');
      const patStore = tx.objectStore('patients');
      const docStore = tx.objectStore('doctors');

      const accCountReq = accStore.count();
      const patCountReq = patStore.count();
      const docCountReq = docStore.count();

      accCountReq.onsuccess = () => {
        if (accCountReq.result === 0) {
          // fetch accounts.json and add
              fetch('accounts.json', {cache: 'no-store'})
                .then(r => r.json())
                .then(data => {
                  if (data && data.accounts) {
                    data.accounts.forEach(a => {
                      try {
                        const pwd = a.password || '';
                        accStore.add({ username: a.username, password: pwd, role: a.role, lastActive: a.lastActive || null });
                      } catch(e){}
                    });
                  }
                }).catch(()=>{});
        }
      };

      patCountReq.onsuccess = () => {
        if (patCountReq.result === 0) {
          fetch('patients.json', {cache: 'no-store'})
            .then(r => r.json())
            .then(data => {
              if (data && data.patients) {
                    data.patients.forEach(p => {
                      try { patStore.add(p); } catch(e){}
                    });
              }
            }).catch(()=>{});
        }
      };

      docCountReq.onsuccess = () => {
        if (docCountReq.result === 0) {
          fetch('doctors.json', {cache: 'no-store'})
            .then(r => r.json())
            .then(data => {
                  if (Array.isArray(data)) {
                    data.forEach(d => { try { docStore.add(d); } catch(e){} });
                  } else if (data && data.doctors) {
                    data.doctors.forEach(d => { try { docStore.add(d); } catch(e){} });
                  }
            }).catch(()=>{});
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      resolve();
    }
  });
}

function addPatient(patient) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('patients', 'readwrite');
    const store = tx.objectStore('patients');
    const req = store.add(patient);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  }));
}

function getPatientByNHS(nhs) {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction('patients', 'readonly');
    const store = tx.objectStore('patients');
    const results = [];
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        if (val.nhs && val.nhs === nhs) results.push(val);
        cursor.continue();
      } else {
        resolve(results[0] || null);
      }
    };
  }));
}

function getPatientByEmail(email) {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction('patients', 'readonly');
    const store = tx.objectStore('patients');
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        if (val.email && val.email.toLowerCase() === email.toLowerCase()) {
          resolve(val);
          return;
        }
        cursor.continue();
      } else {
        resolve(null);
      }
    };
  }));
}

function getAccount(username) {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction('accounts', 'readonly');
    const store = tx.objectStore('accounts');
    // use username index
    try {
      const idx = store.index('username');
      const req = idx.get(username);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (err) {
      // fallback to scanning
      const req2 = store.openCursor();
      req2.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value && cursor.value.username === username) resolve(cursor.value);
          else cursor.continue();
        } else resolve(null);
      };
    }
  }));
}

function authenticateAccount(username, password, role) {
  return getAccount(username).then(acc => {
    if (!acc) return null;
    let stored = acc.password || '';

    if (stored === password && (!role || acc.role === role)) return acc;
    return null;
  });
}

function addAccount(username, password, role='patient') {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    let pwd = password || '';
    // store plaintext password for demo
    pwd = password || '';
    const req = store.add({ username, password: pwd, role, lastActive: new Date().toISOString() });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

function authenticatePatient(ident, password) {
  // Try accounts store first (username = email or phone), then fallback to patients store
  return getAccount(ident).then(acc => {
    if (acc && acc.role === 'patient') {
      // check password (authenticateAccount already handles decryption)
      return authenticateAccount(ident, password, 'patient').then(found => {
        if (found) {
          // find patient record by email/phone/nhs
          return getPatientByEmail(ident).then(p => p || null);
        }
        return null;
      });
    }
    // fallback: ident can be email or nhs
    return Promise.resolve().then(() => {
      if (ident && ident.includes('@')) {
        return getPatientByEmail(ident);
      }
      return getPatientByNHS(ident);
    }).then(patient => {
      if (!patient) return null;
      if (!patient.password) return null; // patient must have a password (registered)
      if (patient.password === password) return patient;
      return null;
    });
  });
}

function logout() {
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('role');
}

function resetDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        // still resolve but warn
        resolve();
      };
    } catch (e) { reject(e); }
  });
}

// expose functions
window.hdb = {
  openDB, addPatient, getPatientByNHS, getPatientByEmail, getAccount, authenticateAccount, authenticatePatient, addAccount, resetDatabase, logout
};

//GLOBAL VARIABLES
console.log("=== Patient Portal Script Started ===");

let db;
let dbReady = false;

//INDEXEDDB INITIALIZATION
function initDB() {
  console.log("Initializing IndexedDB...");
  const request = indexedDB.open("MedicalSystemDB", 4);

  request.onerror = (event) => {
    console.error("Database failed to open:", event.target.error);
    alert("Database error! Please try a different browser or clear your browser data.");
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    dbReady = true;
    console.log("Database opened successfully");
    
    // Load doctors from JSON file
    loadDoctorsFromJSON();
    
    // Check for auto-login
    const loggedInUser = localStorage.getItem("loggedInUser");
    if (loggedInUser) {
      console.log("Auto-login detected for:", loggedInUser);
      const tx = db.transaction("patients", "readonly");
      const store = tx.objectStore("patients");
      const req = store.get(loggedInUser);
      
      req.onsuccess = (e) => {
        const user = e.target.result;
        if (user) {
          console.log("User found, showing dashboard");
          showDashboard(user);
        }
      };
    }
  };

  request.onupgradeneeded = (event) => {
    console.log("Creating/updating database stores...");
    db = event.target.result;

    if (!db.objectStoreNames.contains("patients")) {
      db.createObjectStore("patients", { keyPath: "email" });
      console.log("Created 'patients' store");
    }
    if (!db.objectStoreNames.contains("doctors")) {
      db.createObjectStore("doctors", { keyPath: "id" });
      console.log("Created 'doctors' store");
    }
    if (!db.objectStoreNames.contains("appointments")) {
      db.createObjectStore("appointments", { keyPath: "id", autoIncrement: true });
      console.log("Created 'appointments' store");
    }
    if (!db.objectStoreNames.contains("prescriptions")) {
      db.createObjectStore("prescriptions", { keyPath: "id", autoIncrement: true });
      console.log("Created 'prescriptions' store");
    }
  };
}

//LOAD DOCTORS FROM JSON
function loadDoctorsFromJSON() {
  console.log("Loading doctors from JSON...");
  
  fetch("doctors.json")
    .then(response => {
      if (!response.ok) {
        throw new Error("doctors.json not found");
      }
      return response.json();
    })
    .then(doctors => {
      console.log("Doctors loaded from JSON:", doctors);
      
      const tx = db.transaction("doctors", "readwrite");
      const store = tx.objectStore("doctors");
      
      doctors.forEach(doc => {
        store.put(doc);
      });
      
      tx.oncomplete = () => {
        console.log("Doctors saved to database");
        populateDoctors();
      };
    })
    .catch(error => {
      console.warn("Could not load doctors.json:", error);
      console.log("Using fallback doctor data");
      
      //Fallback doctors data
      const fallbackDoctors = [
        { id: 1, name: "Dr. Sarah Thompson", specialty: "Cardiology", email: "sarah.thompson@hospital.com", phone: "+230 5678 1010" },
        { id: 2, name: "Dr. James Patel", specialty: "Neurology", email: "james.patel@hospital.com", phone: "+230 5678 2020" },
        { id: 3, name: "Dr. Emily Wong", specialty: "Pediatrics", email: "emily.wong@hospital.com", phone: "+230 5678 3030" },
        { id: 4, name: "Dr. Ahmed Khan", specialty: "General Medicine", email: "ahmed.khan@hospital.com", phone: "+230 5678 4040" },
        { id: 5, name: "Dr. Maria Rodrigues", specialty: "Dermatology", email: "maria.rodrigues@hospital.com", phone: "+230 5678 5050" }
      ];
      
      const tx = db.transaction("doctors", "readwrite");
      const store = tx.objectStore("doctors");
      
      fallbackDoctors.forEach(doc => {
        store.put(doc);
      });
      
      tx.oncomplete = () => {
        console.log("Fallback doctors saved to database");
        populateDoctors();
      };
    });
}

//UTILITY FUNCTIONS
function showAlert(elementId, message, type) {
  const alertDiv = document.getElementById(elementId);
  alertDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    alertDiv.innerHTML = '';
  }, 4000);
}

//AUTH TOGGLE LINKS
document.getElementById("show-signup").onclick = function() {
  console.log("Switching to signup form");
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("signup-section").classList.remove("hidden");
};

document.getElementById("show-login").onclick = function() {
  console.log("Switching to login form");
  document.getElementById("signup-section").classList.add("hidden");
  document.getElementById("login-section").classList.remove("hidden");
};

//SIGNUP
document.getElementById("signup-btn").onclick = function() {
  console.log("=== SIGNUP BUTTON CLICKED ===");
  
  if (!dbReady) {
    alert("Please wait, database is still loading...");
    return;
  }

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const password = document.getElementById("signup-password").value;
  const phone = document.getElementById("signup-phone").value.trim();

  console.log("Signup attempt:", { name, email, phone });

  //Validation
  if (!name || !email || !password) {
    showAlert("signup-alert", "Please fill in all required fields", "error");
    return;
  }

  if (!email.includes("@")) {
    showAlert("signup-alert", "Please enter a valid email address", "error");
    return;
  }

  if (password.length < 6) {
    showAlert("signup-alert", "Password must be at least 6 characters", "error");
    return;
  }

  //Check if email exists
  const tx = db.transaction("patients", "readwrite");
  const store = tx.objectStore("patients");
  
  store.get(email).onsuccess = (event) => {
    if (event.target.result) {
      console.log("Email already exists");
      showAlert("signup-alert", "An account with this email already exists!", "error");
    } else {
      console.log("Creating new account...");
      const addReq = store.add({ 
        name, 
        email, 
        password, 
        phone,
        createdAt: new Date().toISOString()
      });
      
      addReq.onsuccess = () => {
        console.log("Account created successfully!");
        showAlert("signup-alert", "Account created successfully! Please login.", "success");
        
        setTimeout(() => {
          document.getElementById("signup-section").classList.add("hidden");
          document.getElementById("login-section").classList.remove("hidden");
          
          // Clear form
          document.getElementById("signup-name").value = '';
          document.getElementById("signup-email").value = '';
          document.getElementById("signup-password").value = '';
          document.getElementById("signup-phone").value = '';
        }, 1500);
      };
      
      addReq.onerror = (error) => {
        console.error("Error creating account:", error);
        showAlert("signup-alert", "Error creating account. Please try again.", "error");
      };
    }
  };
};

//LOGIN
document.getElementById("login-btn").onclick = function() {
  console.log("=== LOGIN BUTTON CLICKED ===");
  
  if (!dbReady) {
    alert("Please wait, database is still loading...");
    return;
  }

  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  console.log("Login attempt for:", email);

  //Validation
  if (!email || !password) {
    showAlert("login-alert", "Please enter both email and password", "error");
    return;
  }

  //Check credentials
  const tx = db.transaction("patients", "readonly");
  const store = tx.objectStore("patients");
  
  store.get(email).onsuccess = (event) => {
    const user = event.target.result;
    console.log("User lookup result:", user ? "Found" : "Not found");
    
    if (user && user.password === password) {
      console.log("Login successful!");
      localStorage.setItem("loggedInUser", email);
      showDashboard(user);
    } else {
      console.log("Invalid credentials");
      showAlert("login-alert", "Invalid email or password", "error");
    }
  };
};

//SHOW DASHBOARD
function showDashboard(user) {
  console.log("Showing dashboard for:", user.name);
  
  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("patient-name").textContent = user.name;
  document.getElementById("patient-email").textContent = user.email;

  //Set minimum date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("appointment-date").min = today;

  //Load user data
  loadAppointments(user.email);
  loadPrescriptions(user.email);
}

//LOGOUT
document.getElementById("logout-btn").onclick = function() {
  console.log("Logout clicked");
  
  localStorage.removeItem("loggedInUser");
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("auth-container").classList.remove("hidden");
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("signup-section").classList.add("hidden");
  
  //Clear login form
  document.getElementById("login-email").value = '';
  document.getElementById("login-password").value = '';
};

//POPULATE DOCTORS DROPDOWN
function populateDoctors() {
  console.log("Populating doctors dropdown");
  
  const select = document.getElementById("doctor-select");
  select.innerHTML = '<option value="">Choose a doctor...</option>';
  
  const tx = db.transaction("doctors", "readonly");
  const store = tx.objectStore("doctors");
  
  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const doctor = cursor.value;
      const opt = document.createElement("option");
      opt.value = doctor.id;
      opt.textContent = `${doctor.name} - ${doctor.specialty}`;
      select.appendChild(opt);
      cursor.continue();
    }
  };
}

//BOOK APPOINTMENT
document.getElementById("book-btn").onclick = function() {
  console.log("=== BOOK APPOINTMENT CLICKED ===");
  
  const userEmail = localStorage.getItem("loggedInUser");
  const doctorId = parseInt(document.getElementById("doctor-select").value);
  const date = document.getElementById("appointment-date").value;
  const time = document.getElementById("appointment-time").value;

  console.log("Booking details:", { doctorId, date, time });

  //Validation
  if (!doctorId) {
    showAlert("booking-alert", "Please select a doctor", "error");
    return;
  }

  if (!date) {
    showAlert("booking-alert", "Please select a date", "error");
    return;
  }

  //Get doctor details and create appointment
  const tx = db.transaction(["doctors", "appointments"], "readwrite");
  const doctorStore = tx.objectStore("doctors");
  const aptStore = tx.objectStore("appointments");

  doctorStore.get(doctorId).onsuccess = (event) => {
    const doctor = event.target.result;
    
    if (!doctor) {
      showAlert("booking-alert", "Doctor not found. Please try again.", "error");
      return;
    }
    
    console.log("Doctor found:", doctor.name);
    
    const appointment = {
      userEmail: userEmail,
      doctorId: doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date: date,
      time: time,
      status: "Scheduled",
      createdAt: new Date().toISOString()
    };

    const addReq = aptStore.add(appointment);
    
    addReq.onsuccess = () => {
      console.log("✅ Appointment booked successfully!");
      showAlert("booking-alert", "Appointment booked successfully! 🎉", "success");
      
      setTimeout(() => {
        document.getElementById("appointment-date").value = '';
        document.getElementById("doctor-select").selectedIndex = 0;
        loadAppointments(userEmail);
      }, 1500);
    };
    
    addReq.onerror = (error) => {
      console.error(" Error booking appointment:", error);
      showAlert("booking-alert", "Error booking appointment. Please try again.", "error");
    };
  };
};

//LOAD APPOINTMENTS
function loadAppointments(userEmail) {
  console.log("Loading appointments for:", userEmail);
  
  const list = document.getElementById("appointments-list");
  list.innerHTML = "";

  const tx = db.transaction("appointments", "readonly");
  const store = tx.objectStore("appointments");
  const appointments = [];

  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      if (cursor.value.userEmail === userEmail) {
        appointments.push(cursor.value);
      }
      cursor.continue();
    } else {
      if (appointments.length === 0) {
        list.innerHTML = '<li class="empty-message">No appointments scheduled yet.</li>';
      } else {
        console.log(`Found ${appointments.length} appointments`);
        appointments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        appointments.forEach(apt => {
          const li = document.createElement("li");
          li.className = "appointment-item";
          li.innerHTML = `
            <div>
              <div style="color: #667eea; font-weight: 600; margin-bottom: 5px;">📅 ${formatDate(apt.date)} at ${apt.time}</div>
              <div style="color: #666;">👨‍⚕️ ${apt.doctorName} (${apt.specialty})</div>
            </div>
            <span style="background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 0.85rem;">${apt.status}</span>
          `;
          list.appendChild(li);
        });
      }
    }
  };
}

//LOAD PRESCRIPTIONS
function loadPrescriptions(userEmail) {
  console.log("Loading prescriptions for:", userEmail);
  
  const list = document.getElementById("notes-list");
  list.innerHTML = "";

  const tx = db.transaction("prescriptions", "readonly");
  const store = tx.objectStore("prescriptions");
  const prescriptions = [];

  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      if (cursor.value.userEmail === userEmail) {
        prescriptions.push(cursor.value);
      }
      cursor.continue();
    } else {
      if (prescriptions.length === 0) {
        list.innerHTML = '<li class="empty-message">No prescriptions or notes available yet.</li>';
      } else {
        console.log(`Found ${prescriptions.length} prescriptions`);
        prescriptions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        prescriptions.forEach(presc => {
          const li = document.createElement("li");
          li.innerHTML = `
            <div style="color: #667eea; font-weight: 600; margin-bottom: 5px;"> ${formatDate(presc.date)} - Dr. ${presc.doctorName}</div>
            <div style="color: #666; margin-top: 8px;">${presc.notes}</div>
            ${presc.medication ? `<div style="margin-top: 8px; color: #667eea; font-weight: 500;">Medication: ${presc.medication}</div>` : ''}
          `;
          list.appendChild(li);
        });
      }
    }
  };
}

//FORMAT DATE
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

//INITIALIZE ON PAGE LOAD 
initDB();

console.log("=== Script loaded and ready ===");
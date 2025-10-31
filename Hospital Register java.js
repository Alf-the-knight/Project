// --- Simple in-memory storage (example) ---
let users = []; // [{ firstName, surname, gender, email, address, phone, password }]

// --- Password strength (your original logic kept) ---
function PasswordStrength() {
  const pass = document.getElementById("password").value;
  const strengthMeter = document.getElementById("strengthMeter");
  const strengthText = document.getElementById("strengthText");

  let strength = 0;
  if (pass.length >= 6) strength++;          // length
  if (/[A-Z]/.test(pass)) strength++;        // uppercase
  if (/[0-9]/.test(pass)) strength++;        // number
  if (/[^A-Za-z0-9]/.test(pass)) strength++; // special

  strengthMeter.value = strength;

  let msg = "";
  if (strength === 0) msg = "";
  else if (strength === 1) msg = "Very Weak";
  else if (strength === 2) msg = "Weak";
  else if (strength === 3) msg = "Good";
  else if (strength === 4) msg = "Strong";

  strengthText.innerText = msg;
}

// --- Live password match check ---
function checkPasswordsMatch() {
  const p1 = document.getElementById("password").value;
  const p2 = document.getElementById("confirmPassword").value;
  const msg = document.getElementById("matchMsg");
  const btn = document.getElementById("registerBtn");

  if (!p1 && !p2) {
    msg.textContent = "";
    btn.disabled = false;
    return;
  }

  if (p1 === p2) {
    msg.style.color = "#32cd32";
    msg.textContent = "Passwords match ✓";
    btn.disabled = false;
  } else {
    msg.style.color = "#ff6961";
    msg.textContent = "Passwords do not match";
    btn.disabled = true; // prevent accidental submit
  }
}

// --- Register handler ---
function Register() {
  const firstName = document.getElementById("firstName").value.trim();
  const surname   = document.getElementById("surname").value.trim();
  const email     = document.getElementById("email").value.trim();
  const dob       = (document.getElementById("dob") && document.getElementById("dob").value) || "";
  const nhs       = (document.getElementById("nhs") && document.getElementById("nhs").value.trim()) || "";
  const address   = document.getElementById("address").value.trim();
  const phone     = document.getElementById("phone").value.trim();
  const password  = document.getElementById("password").value;
  const confirm   = document.getElementById("confirmPassword").value;

  // get selected gender (from radios)
  const genderRadio = document.querySelector("input[name='gender']:checked");
  const gender = genderRadio ? genderRadio.value : "";

  const message = document.getElementById("message");

  // Basic validations (keep simple & clear)
  if (!firstName || !surname || !gender || !email || !dob || !nhs || !address || !phone || !password || !confirm) {
    message.textContent = "Please fill in all fields.";
    return;
  }

  if (password !== confirm) {
    message.textContent = "Passwords do not match.";
    return;
  }

  // (Optional) simple email format check
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    message.textContent = "Please enter a valid email address.";
    return;
  }

  // (Optional) simple NHS format check (alphanumeric 5–20)
  var nhsOk = /^[A-Za-z0-9\-]{5,20}$/.test(nhs);
  if (!nhsOk) {
    message.textContent = "Please enter a valid NHS number (5–20 letters/numbers).";
    return;
  }

  // Success: store and show confirmation
  const patient = {
    name: `${firstName} ${surname}`,
    firstName,
    surname,
    gender,
    email,
    dob,
    nhs,
    address,
    phone,
    password // store password in patients store so patient can login
  };

  // add to indexedDB via helper
  hdb.addPatient(patient).then(id => {
    patient.id = id;
    // create an account entry so patient can login via accounts store; use NHS as username per login flow
    const username = nhs || patient.email || patient.phone || (`patient${id}`);
    hdb.addAccount(username, password, 'patient').then(accId => {
      // show success toast and redirect
      if (window.ui && ui.showToast) ui.showToast('Registration successful — welcome!', 'success', 1800);
      sessionStorage.setItem('user', JSON.stringify(patient));
      sessionStorage.setItem('role', 'patient');
      setTimeout(() => { window.location.href = 'patient.html'; }, 900);
    }).catch((err)=>{
      console.error('Account create failed', err);
      if (window.ui && ui.showToast) ui.showToast('Registration saved but account creation failed', 'error', 3000);
      sessionStorage.setItem('user', JSON.stringify(patient));
      sessionStorage.setItem('role', 'patient');
      setTimeout(() => { window.location.href = 'patient.html'; }, 900);
    });
  }).catch(err => {
    console.error(err);
    if (window.ui && ui.showToast) ui.showToast('Registration failed', 'error', 3000);
    message.textContent = 'Registration failed. Try again.';
  });
}

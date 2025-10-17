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
  const address   = document.getElementById("address").value.trim();
  const phone     = document.getElementById("phone").value.trim();
  const password  = document.getElementById("password").value;
  const confirm   = document.getElementById("confirmPassword").value;

  // get selected gender (from radios)
  const genderRadio = document.querySelector("input[name='gender']:checked");
  const gender = genderRadio ? genderRadio.value : "";

  const message = document.getElementById("message");

  // Basic validations (keep simple & clear)
  if (!firstName || !surname || !gender || !email || !address || !phone || !password || !confirm) {
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

  // Success: store in memory (demo) and show confirmation
  users.push({ firstName, surname, gender, email, address, phone, password });

  // Clear any error message and show success
  message.style.color = "lime";
  message.textContent = "Registration successful! Redirecting to login...";

  // Redirect after a short pause
  setTimeout(() => {
    window.location.href = "Hospital Login page.html";
  }, 800);
}

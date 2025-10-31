// Role-aware login using shared IndexedDB helper (db.js)
window.addEventListener('load', () => {
  // read role from query string and set selector
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');
  if (role) {
    const sel = document.getElementById('roleSelect');
    if (sel) sel.value = role;
  }
});

function Login() {
  // Validate credentials solely against accounts.json (no IndexedDB or other stores)
  const ident = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;
  const role = document.getElementById('roleSelect').value;
  const msg = document.getElementById('message');
  msg.style.color = 'red';

  if (!ident || !pass) {
    msg.innerText = 'Enter username/email or NHS and password.';
    return;
  }

  fetch('accounts.json').then(function(res){
    if (!res.ok) throw new Error('accounts.json not available');
    return res.json();
  }).then(function(data){
    var list = data && data.accounts ? data.accounts : [];
    // find matching account by username AND role (case-insensitive role match)
    var match = list.find(function(a){
      if (!a || !a.username || !a.password) return false;
      // normalize role comparison
      var arole = (a.role || '').toString().toLowerCase();
      var wanted = (role || '').toString().toLowerCase();
      return (a.username === ident || (a.email && a.email === ident)) && a.password === pass && arole === wanted;
    });

    if (match) {
      // Enrich with name from doctors.json or patients.json based on role
      var resolvedRole = (match.role||role||'').toString().toLowerCase();
      function finish(userProfile){
        sessionStorage.setItem('user', JSON.stringify(userProfile));
        sessionStorage.setItem('role', userProfile.role);
        if (window.ui && ui.showToast) ui.showToast('Login successful', 'success', 900);
        setTimeout(function(){
          if (userProfile.role === 'admin') window.location.href = 'admin.html';
          else if (userProfile.role === 'doctor') window.location.href = 'doctor.html';
          else if (userProfile.role === 'patient') window.location.href = 'patient.html';
          else window.location.href = 'Hospital Home.html';
        }, 700);
      }

      if (resolvedRole === 'doctor'){
        fetch('doctors.json').then(function(r){ return r.json(); }).then(function(docs){
          var list = Array.isArray(docs) ? docs : (docs.doctors||[]);
          var doc = list.find(function(d){ return (d.email||'').toLowerCase() === (match.username||'').toLowerCase(); });
          var name = doc ? ((doc.first_name||'') + ' ' + (doc.last_name||'')).trim() : (match.username||'Doctor');
          finish({ username: match.username, role: 'doctor', name: name, email: match.username });
        }).catch(function(){ finish({ username: match.username, role: 'doctor', name: match.username }); });
      } else if (resolvedRole === 'patient'){
        fetch('patients.json').then(function(r){ return r.json(); }).then(function(pats){
          var list = Array.isArray(pats) ? pats : (pats.patients||[]);
          var pat = list.find(function(p){ return (p.nhs||'').toLowerCase() === (match.username||'').toLowerCase(); });
          var name = pat ? (pats && pat.name ? pat.name : match.username) : match.username;
          finish({ username: match.username, role: 'patient', name: name, nhs: match.username });
        }).catch(function(){ finish({ username: match.username, role: 'patient', name: match.username }); });
      } else {
        finish({ username: match.username, role: resolvedRole||'user', name: match.username });
      }
    } else {
      if (window.ui && ui.showToast) ui.showToast('Login failed — check credentials', 'error', 2500);
      msg.innerText = 'Login failed. Check username and password (accounts.json).';
    }
  }).catch(function(err){
    console.error('Login error', err);
    if (window.ui) ui.showToast('Login error', 'error', 2500);
    msg.innerText = 'Login error — could not read accounts.json.';
  });
}

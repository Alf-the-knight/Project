// Small profile dropdown inserted into .navbar
(function(){
  function renderProfile() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    // avoid duplicate
    if (nav.querySelector('.profile-area')) return;

    const userJson = sessionStorage.getItem('user');
    const role = sessionStorage.getItem('role');
    const area = document.createElement('div');
    area.className = 'profile-area';
    area.style.marginLeft = '12px';
    area.style.display = 'inline-flex';
    area.style.alignItems = 'center';

    if (!userJson) {
      const a = document.createElement('a'); a.href='Hospital Login page.html'; a.innerText='Login'; a.className='btn';
      area.appendChild(a);
      nav.appendChild(area);
      return;
    }

    let user = {};
    try { user = JSON.parse(userJson); } catch {}
    const name = user.name || user.username || user.first_name || user.firstName || 'User';

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.display='inline-flex'; btn.style.gap='8px';
    btn.innerText = `${name} (${role||'user'})`;

    const menu = document.createElement('div');
    menu.style.position='absolute'; menu.style.background='white'; menu.style.color='#001018';
    menu.style.borderRadius='8px'; menu.style.boxShadow='0 6px 18px rgba(0,0,0,0.2)'; menu.style.padding='8px';
    menu.style.display='none'; menu.style.right='18px';

    const profileLink = document.createElement('div'); profileLink.innerText='Profile'; profileLink.style.padding='6px'; profileLink.style.cursor='pointer';
    profileLink.onclick = ()=> { if (role==='admin') window.location.href='admin.html'; else if (role==='doctor') window.location.href='doctor.html'; else window.location.href='patient.html'; };
    const logout = document.createElement('div'); logout.innerText='Logout'; logout.style.padding='6px'; logout.style.cursor='pointer';
    logout.onclick = ()=> { sessionStorage.clear(); if (window.ui) ui.showToast('Logged out', 'default', 1000); setTimeout(()=> window.location.href='Hospital Home.html', 600); };

    menu.appendChild(profileLink); menu.appendChild(logout);

    area.style.position='relative';
    area.appendChild(btn); area.appendChild(menu);

    btn.addEventListener('click', ()=> { menu.style.display = (menu.style.display==='none')? 'block' : 'none'; });

    nav.appendChild(area);
  }

  window.addEventListener('load', () => setTimeout(renderProfile, 200));
  // also re-render when session changes (simple polling)
  setInterval(renderProfile, 2000);
})();

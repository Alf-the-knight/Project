// Small UI helpers: toast and simple confirm
(function(){
  function ensureContainer(){
    let c = document.querySelector('.toast-container');
    if (!c){ c = document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
    return c;
  }

  function showToast(message, type='default', timeout=3000){
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = 'toast' + (type? ' '+type: '');
    el.innerText = message;
    c.appendChild(el);
    if (timeout>0) setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, timeout);
    return el;
  }

  function confirmDialog(message){
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.style.position='fixed'; wrap.style.left=0; wrap.style.top=0; wrap.style.right=0; wrap.style.bottom=0;
      wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.justifyContent='center';
      wrap.style.background='rgba(0,0,0,0.35)'; wrap.style.zIndex=10000;
      const box = document.createElement('div'); box.style.background='white'; box.style.color='#001018'; box.style.padding='18px'; box.style.borderRadius='10px'; box.style.minWidth='320px';
      const txt = document.createElement('div'); txt.innerText=message; txt.style.marginBottom='12px';
      const btnRow = document.createElement('div'); btnRow.style.display='flex'; btnRow.style.justifyContent='flex-end'; btnRow.style.gap='8px';
      const ok = document.createElement('button'); ok.innerText='OK'; ok.className='btn';
      const cancel = document.createElement('button'); cancel.innerText='Cancel'; cancel.className='btn';
      ok.onclick = () => { wrap.remove(); resolve(true); };
      cancel.onclick = () => { wrap.remove(); resolve(false); };
      btnRow.appendChild(cancel); btnRow.appendChild(ok);
      box.appendChild(txt); box.appendChild(btnRow); wrap.appendChild(box); document.body.appendChild(wrap);
    });
  }

  window.ui = { showToast, confirmDialog };
})();

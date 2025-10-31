// ux.js - small microinteraction helpers: ripple, reveal-on-scroll, toast enhancer
(function(){
  const supportsReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function addRipple(e){
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement('span');
    r.className = 'ripple';
    const size = Math.max(rect.width, rect.height) * 0.9;
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size/2) + 'px';
    r.style.top = (e.clientY - rect.top - size/2) + 'px';
    btn.appendChild(r);
    r.addEventListener('animationend', ()=> r.remove());
  }

  function wireRipples(){
    document.querySelectorAll('.btn').forEach(b => {
      if (b._ux_ripple) return; b._ux_ripple = true;
      b.addEventListener('pointerdown', (e)=>{
        if (supportsReducedMotion) return; addRipple(e);
      });
    });
  }

  function revealOnScroll(){
    if (supportsReducedMotion) return;
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(en => {
        if (en.isIntersecting) en.target.classList.add('in-view');
      });
    }, { threshold: .08 });
    document.querySelectorAll('.card, .dept-grid, .desc-card').forEach(el=> obs.observe(el));
  }

  // enhance toasts created by ui.showToast by toggling .show class
  function enhanceToasts(){
    const container = document.querySelector('.toast-container');
    if (!container) return;
    const mo = new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => {
        if (n.classList && n.classList.contains('toast')){
          // force reflow then add show
          requestAnimationFrame(()=> n.classList.add('show'));
          // auto remove after 4.5s if not persistent
          setTimeout(()=> {
            n.classList.remove('show');
            setTimeout(()=> n.remove(), 350);
          }, 4200);
        }
      }));
    });
    mo.observe(container, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    wireRipples();
    revealOnScroll();
    enhanceToasts();
    // subtle entrance for body
    document.documentElement.classList.add('ux-ready');
  });

  // expose for quick manual use
  window.UX = { wireRipples, revealOnScroll };
})();

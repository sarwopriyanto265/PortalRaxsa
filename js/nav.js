/**
 * RAXSA Portal v3 — Navigation Module
 * Sidebar, mobile menu, active links, logout
 */

function initMobileNav() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}

function setActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(current)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.RaxsaAuth) window.RaxsaAuth.logout();
    });
  }
}

function showMobileToggle() {
  const btn = document.getElementById('mobile-menu-toggle');
  if (!btn) return;
  const check = () => { btn.style.display = window.innerWidth <= 768 ? 'grid' : 'none'; };
  check();
  window.addEventListener('resize', check);
}

function showToast(msg, dur = 3000) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

window.RaxsaNav = { initMobileNav, setActiveNav, initLogout, showMobileToggle, showToast };

/* ===================================================
   FANUP Landing Page - main.js
   =================================================== */

// ─── Theme Toggle ───
const html = document.documentElement;
const themeBtn = document.getElementById('themeToggle');

// 초기 렌더링 완료 후 테마 전환 트랜지션 활성화 (번쩍거림 방지)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.add('theme-ready');
  });
});

themeBtn?.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('fanup-theme', next);
});

// ─── View Switch (크리에이터 / 팬) ───
const viewBtns = document.querySelectorAll('.view-btn');
viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    viewBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.for-creator').forEach(el => {
      el.style.display = view === 'creator' ? '' : 'none';
    });
    document.querySelectorAll('.for-fan').forEach(el => {
      el.style.display = view === 'fan' ? '' : 'none';
    });
  });
});

// ─── Nav Scroll Effect ───
const topnav = document.querySelector('.topnav');
window.addEventListener('scroll', () => {
  topnav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ─── Scroll Fade Animations (히어로 제외 — CSS animation 처리) ───
const scrollFadeEls = document.querySelectorAll('.fade-up:not(.hero .fade-up)');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
scrollFadeEls.forEach(el => observer.observe(el));

// ─── Stat Counter Animation ───
function animateCounter(el, target, duration = 1800) {
  const isFloat = target % 1 !== 0;
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const step = (timestamp) => {
    if (!el._startTime) el._startTime = timestamp;
    const progress = Math.min((timestamp - el._startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = eased * target;
    el.textContent = prefix + (isFloat ? value.toFixed(1) : Math.floor(value).toLocaleString()) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target._counted) {
      e.target._counted = true;
      animateCounter(e.target, parseFloat(e.target.dataset.target));
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.counter').forEach(el => statObserver.observe(el));

// ─── Ranking Bar Animation ───
const rankObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.rank-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width || '0%';
      });
      rankObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.ranking-list').forEach(el => rankObserver.observe(el));

// ─── Smooth Scroll for Anchor Links ───
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#' || href === '#top') return;
    let target;
    try {
      target = document.querySelector(href);
    } catch {
      return;
    }
    if (target) {
      e.preventDefault();
      const navH = topnav?.offsetHeight || 64;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ─── Mobile Nav Toggle ───
const hamburger = document.querySelector('.nav-hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  navMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─── Mouse Glow Follow (데스크탑 전용) ───
const mouseGlow = document.getElementById('mouseGlow');
if (mouseGlow && window.innerWidth > 768) {
  document.addEventListener('mousemove', (e) => {
    mouseGlow.style.opacity = '1';
    mouseGlow.style.left = e.clientX + 'px';
    mouseGlow.style.top = e.clientY + 'px';
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    mouseGlow.style.opacity = '0';
  });
}

// ─── 3D Card Tilt (데스크탑 전용) ───
if (window.innerWidth > 768) {
  document.querySelectorAll('.feat-card, .phone-mockup').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transition = 'none';
      card.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.4s ease';
      card.style.transform = '';
    });
  });
}


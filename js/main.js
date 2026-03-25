/* ===================================================
   FANUP Landing Page - main.js
   =================================================== */

// ─── Theme Toggle ───
const html = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('fanup-theme');

// 저장된 테마 or 시스템 설정 적용
if (saved) {
  html.setAttribute('data-theme', saved);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  html.setAttribute('data-theme', 'dark');
}

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
  if (window.scrollY > 20) {
    topnav.classList.add('scrolled');
  } else {
    topnav.classList.remove('scrolled');
  }
}, { passive: true });

// ─── Scroll Fade Animations ───
const fadeEls = document.querySelectorAll('.fade-up');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
fadeEls.forEach(el => observer.observe(el));

// ─── Stat Counter Animation ───
function animateCounter(el, target, duration = 1800) {
  const isFloat = target % 1 !== 0;
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  let start = 0;
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
      const target = parseFloat(e.target.dataset.target);
      animateCounter(e.target, target);
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
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.ranking-list').forEach(el => rankObserver.observe(el));

// ─── Chart Filter Tabs ───
document.querySelectorAll('.chart-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.chart-filter').querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─── Hero Particles ───
function createParticles() {
  const container = document.querySelector('.hero-bg');
  if (!container) return;
  const colors = ['#8B5CF6', '#EC4899', '#22D3EE', '#FACC15'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: ${Math.random() * 40}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${Math.random() * 4 + 2}px;
      height: ${Math.random() * 4 + 2}px;
      animation-delay: ${Math.random() * 8}s;
      animation-duration: ${6 + Math.random() * 6}s;
    `;
    container.appendChild(p);
  }
}
createParticles();

// ─── Chat Demo Typing Animation ───
const chatMessages = [
  { side: 'right', text: '오늘 방송 정말 재밌었어요! 🎉' },
  { side: 'left', text: '고마워요! 여러분 덕분에 힘이 나요 💜' },
  { side: 'right', text: '치즈 드릴게요~' },
];
let chatIdx = 0;
const chatDemo = document.querySelector('.ai-chat-demo');
if (chatDemo) {
  // 채팅 애니메이션은 이미 HTML에 정적으로 포함
}

// ─── Smooth Scroll for Anchor Links ───
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const navH = document.querySelector('.topnav')?.offsetHeight || 64;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ─── Mobile Nav Toggle ───
const mobileBtn = document.querySelector('.nav-mobile-btn');
const navLinks = document.querySelector('.nav-links');
if (mobileBtn && navLinks) {
  mobileBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    mobileBtn.setAttribute('aria-expanded', isOpen);
    navLinks.style.cssText = isOpen
      ? 'display:flex;flex-direction:column;position:absolute;top:64px;left:0;right:0;background:rgba(7,7,15,0.95);backdrop-filter:blur(20px);padding:16px 24px;gap:4px;border-bottom:1px solid rgba(139,92,246,0.15);'
      : '';
  });
}

// ─── Hero Visual Float on Mouse ───
const heroVisual = document.querySelector('.hero-visual-wrap');
if (heroVisual && window.innerWidth > 768) {
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 12;
    const y = (e.clientY / window.innerHeight - 0.5) * 8;
    heroVisual.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });
}

// ─── Mouse Glow Follow ───
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

// ─── 3D Card Tilt ───
const tiltCards = document.querySelectorAll('.feat-card, .phone-mockup');
tiltCards.forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform 0.4s ease';
    setTimeout(() => card.style.transition = '', 400);
  });
});

// ─── Cheese Particle Burst ───
const CHEESE_EMOJIS = ['🧀', '⭐', '💜', '✨', '🎉'];
document.querySelectorAll('.btn-primary').forEach(btn => {
  btn.addEventListener('mouseenter', (e) => {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('span');
      el.className = 'cheese-particle';
      el.textContent = CHEESE_EMOJIS[Math.floor(Math.random() * CHEESE_EMOJIS.length)];
      const angle = (i / 8) * 360;
      const dist = 60 + Math.random() * 40;
      const dx = Math.cos((angle * Math.PI) / 180) * dist;
      const dy = Math.sin((angle * Math.PI) / 180) * dist - 20;
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 750);
    }
  });
});

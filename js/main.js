/* ===================================================
   FANUP Landing Page - main.js
   =================================================== */

// ─── Theme Toggle ───
const html = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
// 테마는 <head> 인라인 스크립트에서 이미 적용됨 (FOUC 방지)
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
  if (window.scrollY > 20) {
    topnav.classList.add('scrolled');
  } else {
    topnav.classList.remove('scrolled');
  }
}, { passive: true });

// ─── Scroll Fade Animations ───
const fadeEls = document.querySelectorAll('.fade-up');
// 히어로 영역 fade-up은 CSS animation으로 처리되므로 제외
const scrollFadeEls = document.querySelectorAll('.fade-up:not(.hero .fade-up)');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target); // 한 번 보이면 해제
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
scrollFadeEls.forEach(el => observer.observe(el));

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

// ─── Ranking Bar Fallback (IO 미작동 시) ───
setTimeout(() => {
  document.querySelectorAll('.rank-bar-fill').forEach(bar => {
    if (bar.style.width === '0%') {
      bar.style.width = bar.dataset.width || '0%';
    }
  });
}, 3000);

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
  for (let i = 0; i < 8; i++) {
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
const hamburger = document.querySelector('.nav-hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  // 메뉴 링크 클릭 시 닫기
  navMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
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

// ─── 3D Card Tilt (데스크탑 전용) ───
if (window.innerWidth > 768) {
  const tiltCards = document.querySelectorAll('.feat-card, .phone-mockup');
  tiltCards.forEach(card => {
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

// ─── Cheese Particle Burst ───
const CHEESE_EMOJIS = ['🧀', '⭐', '💜', '✨', '🎉'];
document.querySelectorAll('.btn-primary').forEach(btn => {
  btn.addEventListener('mouseenter', (e) => {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 5; i++) {
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

// ── Navbar scroll ──
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Strip nav active link ──
const sections = document.querySelectorAll('[id]');
const stripLinks = document.querySelectorAll('.strip-nav a');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      stripLinks.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`);
      });
    }
  });
}, { threshold: 0.3 });
sections.forEach(s => observer.observe(s));

// ── Video fallback ──
const video = document.getElementById('bg-video');
if (video) {
  video.addEventListener('error', () => {
    // Si no encuentra el video, muestra un fondo oscuro con partículas via canvas
    video.style.display = 'none';
    spawnParticles();
  });
}

function spawnParticles() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:.35;';
  
  const heroVideoWrap = document.querySelector('.hero-video-wrap');
  if(heroVideoWrap) {
    heroVideoWrap.appendChild(canvas);
  }
  
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  particles = Array.from({length: 80}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - .5) * .4,
    vy: -Math.random() * .6 - .2,
    r: Math.random() * 1.5 + .5,
    a: Math.random()
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,192,192,${p.a * .7})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < 0) { p.y = H; p.x = Math.random() * W; }
      if (p.x < 0 || p.x > W) p.vx *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}
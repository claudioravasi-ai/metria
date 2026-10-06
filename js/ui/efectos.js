/* ============================================================
   Efectos visuales: inclinación 3D, luz que sigue al puntero,
   aparición al desplazarse y contadores animados.
   Todo se apaga con "reducir movimiento" y en pantallas táctiles
   la inclinación no se usa (solo la aparición y los contadores).
   ============================================================ */

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tactil = () => matchMedia('(hover: none)').matches;

/** Inclinación 3D suave + luz (--mx, --my) siguiendo al puntero. */
export function inclinar(el, max = 7) {
  if (reducido()) return el;
  el.classList.add('fx-inclinable');
  const mover = (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    if (!tactil()) {
      el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
    }
  };
  el.addEventListener('pointermove', mover);
  el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  return el;
}

/** Aparición escalonada de los elementos [data-revelar] cuando entran en pantalla. */
export function revelar(raiz) {
  const items = raiz.querySelectorAll('[data-revelar]');
  if (reducido() || !('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('fx-visible')); return; }
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('fx-visible');
      io.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach((i, n) => { i.style.setProperty('--retraso', `${(n % 6) * 70}ms`); io.observe(i); });
}

/** Contador que sube desde 0 cuando el número aparece en pantalla. */
export function contar(el, hasta, formato = (v) => Math.round(v).toLocaleString('es-AR'), ms = 1200) {
  if (reducido() || !Number.isFinite(hasta)) { el.textContent = Number.isFinite(hasta) ? formato(hasta) : '—'; return el; }
  el.textContent = formato(0);
  const correr = () => {
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - p) ** 3;
      el.textContent = formato(hasta * e);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); correr(); } });
    io.observe(el);
  } else correr();
  return el;
}

/** Línea de electrocardiograma animada (decorativa). */
export function ecg({ ancho = 1200, alto = 120, clase = '' } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', `fx-ecg ${clase}`);
  svg.setAttribute('aria-hidden', 'true');
  const m = alto / 2;
  let d = `M0 ${m}`;
  for (let x = 0; x < ancho; x += 200) {
    d += ` L${x + 60} ${m} L${x + 70} ${m - 8} L${x + 80} ${m} L${x + 92} ${m} L${x + 100} ${m + 14} L${x + 110} ${m - alto * 0.42} L${x + 122} ${m + alto * 0.3} L${x + 130} ${m} L${x + 150} ${m} L${x + 165} ${m - 12} L${x + 180} ${m} L${x + 200} ${m}`;
  }
  for (const c of ['fx-ecg-base', 'fx-ecg-luz']) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', c);
    p.setAttribute('pathLength', '1000');
    svg.appendChild(p);
  }
  return svg;
}

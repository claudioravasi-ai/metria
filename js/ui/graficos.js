/* ============================================================
   Gráficos SVG en tiempo real (sin librerías)
   Cada componente devuelve { el, set(...) }: al cambiar el valor, el
   gráfico "persigue" el objetivo cuadro a cuadro (resorte suave), así
   que al arrastrar un control se mueve en vivo y sin saltos.
   SVG vectorial: nítido en cualquier pantalla y densidad de píxeles.
   ============================================================ */

import { h } from '../core/dom.js';

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let uid = 0;
const nuevoId = (p) => `${p}${++uid}`;

/** Motor de seguimiento: llama a dibujar(valorActual) hasta alcanzar el objetivo. */
export function seguidor(dibujar, { suavizado = 0.18, umbral = 0.001 } = {}) {
  let actual = null, objetivo = null, raf = 0;
  const paso = () => {
    raf = 0;
    if (actual === null) return;
    if (Array.isArray(objetivo)) {
      let listo = true;
      actual = actual.map((a, i) => {
        const o = objetivo[i];
        const n = a + (o - a) * suavizado;
        if (Math.abs(o - n) > umbral * (Math.abs(o) + 1)) listo = false; else return o;
        return n;
      });
      dibujar(actual);
      if (!listo) raf = requestAnimationFrame(paso);
    } else {
      actual += (objetivo - actual) * suavizado;
      if (Math.abs(objetivo - actual) <= umbral * (Math.abs(objetivo) + 1)) actual = objetivo;
      dibujar(actual);
      if (actual !== objetivo) raf = requestAnimationFrame(paso);
    }
  };
  return {
    set(v, inmediato = false) {
      objetivo = v;
      if (actual === null || inmediato || reducido() || (Array.isArray(v) && (!Array.isArray(actual) || actual.length !== v.length))) {
        actual = Array.isArray(v) ? [...v] : v;
        dibujar(actual);
        return;
      }
      if (!raf) raf = requestAnimationFrame(paso);
    },
    get valor() { return actual; },
  };
}

/* ---------- Número animado ---------- */
export function numero(formato = (v) => Math.round(v).toLocaleString('es-AR'), clase = 'num') {
  const el = h(`span.${clase}`, '—');
  const s = seguidor((v) => { el.textContent = Number.isFinite(v) ? formato(v) : '—'; }, { suavizado: 0.22 });
  return { el, set: (v) => (Number.isFinite(v) ? s.set(v) : (el.textContent = '—')) };
}

/* ---------- Medidor semicircular con aguja ---------- */
export function medidor({ min, max, bandas, formato = (v) => v.toFixed(1), unidad = '', etiqueta = '', marcas }) {
  const W = 320, cx = 160, cy = 168, r = 128, g = 26;
  const ang = (v) => Math.PI - ((clamp(v, min, max) - min) / (max - min)) * Math.PI;
  const pt = (v, rr = r) => [cx + rr * Math.cos(ang(v)), cy - rr * Math.sin(ang(v))];
  const arco = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  const idG = nuevoId('mg');
  // Marcador sobre el arco (no tapa el número central)
  const aguja = h('g.medidor-aguja',
    h('path', { d: `M${cx - 8} ${cy - r + g / 2 + 22} L${cx} ${cy - r + g / 2 + 6} L${cx + 8} ${cy - r + g / 2 + 22} Z`, fill: 'currentColor' }),
    h('circle', { cx, cy: cy - r, r: g / 2 + 3, fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': 5 }));
  const valor = h('text.medidor-valor', { x: cx, y: cy - 22, 'text-anchor': 'middle' }, '—');
  const uni = h('text.medidor-unidad', { x: cx, y: cy + 2, 'text-anchor': 'middle' }, unidad);
  const brillo = h('path.medidor-brillo', { d: '', stroke: `url(#${idG})`, 'stroke-width': g + 8, fill: 'none', 'stroke-linecap': 'round', opacity: 0.25 });
  const ticks = (marcas || bandas.slice(1).map((b) => b.desde)).map((v) => {
    const [x, y] = pt(v, r + g / 2 + 12);
    return h('text.medidor-tick', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, String(v).replace('.', ','));
  });
  const svg = h('svg.medidor', { viewBox: `0 0 ${W} 190`, role: 'img', 'aria-label': etiqueta },
    h('defs', h('linearGradient', { id: idG, x1: 0, x2: 1 }, ...bandas.map((b, i) => h('stop', { offset: `${(i / Math.max(1, bandas.length - 1)) * 100}%`, 'stop-color': b.color })))),
    h('path', { d: arco(min, max), stroke: 'var(--line)', 'stroke-width': g + 10, fill: 'none', 'stroke-linecap': 'round' }),
    ...bandas.map((b) => h('path', { d: arco(Math.max(min, b.desde), Math.min(max, b.hasta)), stroke: b.color, 'stroke-width': g, fill: 'none', opacity: 0.9 })),
    brillo, ...ticks, aguja, valor, uni);
  const cat = h('div.medidor-cat');
  const el = h('div.medidor-wrap', svg, cat);
  const s = seguidor((v) => {
    const deg = ((clamp(v, min, max) - min) / (max - min)) * 180 - 90;
    aguja.setAttribute('transform', `rotate(${deg} ${cx} ${cy})`);
    valor.textContent = formato(v);
    const b = bandas.find((x) => v < x.hasta) || bandas[bandas.length - 1];
    aguja.style.color = b.color;
    const [x0, y0] = pt(min), [x1, y1] = pt(v);
    brillo.setAttribute('d', `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`);
    brillo.setAttribute('stroke', b.color);
  });
  return {
    el,
    set(v, nombreCat) {
      if (!Number.isFinite(v)) { valor.textContent = '—'; cat.textContent = 'Faltan datos'; cat.style.color = ''; return; }
      s.set(v);
      const b = bandas.find((x) => v < x.hasta) || bandas[bandas.length - 1];
      cat.textContent = nombreCat || b.nombre || '';
      cat.style.color = b.color;
      cat.style.setProperty('--cat', b.color);
    },
  };
}

/* ---------- Anillo doble (metabolismo basal + gasto total) ---------- */
export function anillo({ max = 3500, formato = (v) => Math.round(v).toLocaleString('es-AR'), unidad = 'kcal/día', etiqueta = '' }) {
  const S = 260, c = S / 2, r1 = 104, r2 = 80;
  const L1 = 2 * Math.PI * r1, L2 = 2 * Math.PI * r2;
  const idA = nuevoId('an'), idB = nuevoId('an');
  const ext = h('circle', { cx: c, cy: c, r: r1, fill: 'none', stroke: `url(#${idA})`, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-dasharray': `0 ${L1}`, transform: `rotate(-90 ${c} ${c})` });
  const int = h('circle', { cx: c, cy: c, r: r2, fill: 'none', stroke: `url(#${idB})`, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-dasharray': `0 ${L2}`, transform: `rotate(-90 ${c} ${c})` });
  const n1 = h('text.anillo-num', { x: c, y: c - 2, 'text-anchor': 'middle' }, '—');
  const n2 = h('text.anillo-uni', { x: c, y: c + 22, 'text-anchor': 'middle' }, unidad);
  const n3 = h('text.anillo-sub', { x: c, y: c + 46, 'text-anchor': 'middle' }, etiqueta);
  const svg = h('svg.anillo', { viewBox: `0 0 ${S} ${S}`, role: 'img', 'aria-label': etiqueta },
    h('defs',
      h('linearGradient', { id: idA, x1: 0, y1: 0, x2: 1, y2: 1 }, h('stop', { offset: '0%', 'stop-color': 'var(--c1)' }), h('stop', { offset: '100%', 'stop-color': 'var(--c2)' })),
      h('linearGradient', { id: idB, x1: 1, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': '#fde68a' }), h('stop', { offset: '100%', 'stop-color': 'var(--c1)' }))),
    h('circle', { cx: c, cy: c, r: r1, fill: 'none', stroke: 'var(--line)', 'stroke-width': 18 }),
    h('circle', { cx: c, cy: c, r: r2, fill: 'none', stroke: 'var(--line)', 'stroke-width': 14, opacity: 0.6 }),
    ext, int, n1, n2, n3);
  const s = seguidor(([a, b]) => {
    ext.setAttribute('stroke-dasharray', `${clamp(a / max, 0, 1) * L1} ${L1}`);
    int.setAttribute('stroke-dasharray', `${clamp(b / max, 0, 1) * L2} ${L2}`);
    n1.textContent = formato(a);
  });
  return { el: svg, set: (total, basal) => s.set([total, basal]), etiqueta: (t) => { n3.textContent = t; } };
}

/* ---------- Barras horizontales (niveles) ---------- */
export function barras({ formato = (v) => Math.round(v).toLocaleString('es-AR'), unidad = '' } = {}) {
  const el = h('div.barras');
  let filas = new Map();
  return {
    el,
    set(items, activo, max) {
      const M = max || Math.max(...items.map((i) => i.valor), 1);
      if (filas.size !== items.length) {
        el.replaceChildren();
        filas = new Map();
        for (const it of items) {
          const fill = h('div.barra-fill');
          const val = h('span.barra-val.num');
          const fila = h('button.barra', { type: 'button', onclick: () => it.onclick?.() },
            h('div.barra-txt', h('strong', it.nombre), it.desc ? h('small', it.desc) : null),
            h('div.barra-pista', fill), val);
          filas.set(it.id, { fila, fill, val, s: seguidor((v) => { fill.style.width = `${clamp(v / M, 0, 1) * 100}%`; val.textContent = `${formato(v)}${unidad ? ' ' + unidad : ''}`; }) });
          el.appendChild(fila);
        }
      }
      for (const it of items) {
        const f = filas.get(it.id);
        if (!f) continue;
        f.fila.classList.toggle('barra--activa', it.id === activo);
        f.fila.setAttribute('aria-pressed', String(it.id === activo));
        if (it.color) f.fill.style.background = it.color;
        f.s.set(it.valor);
      }
    },
  };
}

/* ---------- Barra apilada con leyenda ---------- */
export function apilada({ formato = (v) => Math.round(v).toLocaleString('es-AR'), unidad = '' } = {}) {
  const pista = h('div.apilada');
  const ley = h('div.apilada-ley');
  const el = h('div', pista, ley);
  let segs = [];
  return {
    el,
    set(items) {
      const total = items.reduce((a, i) => a + Math.max(0, i.valor), 0) || 1;
      if (segs.length !== items.length) {
        pista.replaceChildren(); ley.replaceChildren(); segs = [];
        for (const it of items) {
          const seg = h('div.apilada-seg', { style: { background: it.color } });
          const v = h('strong.num');
          const p = h('small');
          ley.appendChild(h('div.apilada-item', h('i', { style: { background: it.color } }), h('span', it.nombre), v, p));
          pista.appendChild(seg);
          segs.push({ seg, s: seguidor(([val, pct]) => { seg.style.width = `${pct}%`; v.textContent = `${formato(val)}${unidad ? ' ' + unidad : ''}`; p.textContent = `${Math.round(pct)} %`; }) });
        }
      }
      items.forEach((it, i) => segs[i].s.set([it.valor, (Math.max(0, it.valor) / total) * 100]));
    },
  };
}

/* ---------- Escala de categorías con marcador ---------- */
export function escala({ segmentos, formato = (v) => `${v.toFixed(1).replace('.', ',')} %` }) {
  // Cada segmento ocupa el mismo ancho: el marcador interpola dentro del suyo.
  const n = segmentos.length;
  const pos = (v) => {
    for (let i = 0; i < n; i++) {
      const s = segmentos[i];
      if (v < s.hasta || i === n - 1) return ((i + clamp((v - s.desde) / (s.hasta - s.desde), 0, 1)) / n) * 100;
    }
    return 100;
  };
  const marca = h('div.escala-marca', h('span.escala-burbuja.num', '—'));
  const el = h('div.escala',
    h('div.escala-pista', ...segmentos.map((s) => h('div.escala-seg', { style: { background: s.color } }, h('span', s.nombre)))),
    h('div.escala-limites', ...segmentos.slice(1).map((s, i) => h('span', { style: { left: `${((i + 1) / n) * 100}%` } }, String(s.desde).replace('.', ',')))),
    marca);
  const burbuja = marca.firstChild;
  const s = seguidor((v) => { marca.style.left = `${pos(v)}%`; burbuja.textContent = formato(v); });
  return {
    el,
    set(v) {
      if (!Number.isFinite(v)) { marca.style.display = 'none'; return; }
      marca.style.display = '';
      const seg = segmentos.find((x) => v < x.hasta) || segmentos[n - 1];
      marca.style.setProperty('--cat', seg.color);
      s.set(v);
    },
  };
}

/* ---------- Gráfico de líneas interactivo ---------- */
export function lineas({ alto = 280, ejeX = {}, ejeY = {}, formatoY = (v) => v.toFixed(1).replace('.', ','), formatoX = (v) => v, tooltip } = {}) {
  // El ancho del dibujo sigue al del contenedor (texto legible en móvil y en PC).
  let W = 680;
  const H = alto, pl = 46, pr = 16, pt = 14, pb = 30;
  const wrap = h('div.lineas');
  const svg = h('svg.lineas-svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ejeY.titulo || 'Gráfico', style: { height: `${H}px` } });
  const gGrid = h('g.lineas-grid'), gSeries = h('g'), gCursor = h('g.lineas-cursor', { style: { display: 'none' } });
  const lineaCursor = h('line', { y1: pt, y2: H - pb, stroke: 'currentColor', 'stroke-dasharray': '4 4', opacity: 0.5 });
  gCursor.appendChild(lineaCursor);
  const capa = h('rect', { x: pl, y: pt, width: W - pl - pr, height: H - pt - pb, fill: 'transparent', style: { cursor: 'crosshair', touchAction: 'pan-y' } });
  svg.append(gGrid, gSeries, gCursor, capa);
  const tip = h('div.lineas-tip', { style: { display: 'none' } });
  const ejeYtxt = h('div.lineas-ejes');
  wrap.append(svg, tip, ejeYtxt);

  let estado = { series: [], xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
  const sx = (x) => pl + ((x - estado.xmin) / (estado.xmax - estado.xmin || 1)) * (W - pl - pr);
  const sy = (y) => pt + (1 - (y - estado.ymin) / (estado.ymax - estado.ymin || 1)) * (H - pt - pb);
  const elementos = new Map();
  const alCursor = new Set();

  function ejes() {
    gGrid.replaceChildren();
    const ny = 5;
    for (let i = 0; i <= ny; i++) {
      const y = estado.ymin + ((estado.ymax - estado.ymin) * i) / ny;
      gGrid.append(h('line', { x1: pl, x2: W - pr, y1: sy(y), y2: sy(y), stroke: 'var(--line)' }),
        h('text.lineas-tick', { x: pl - 8, y: sy(y), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, formatoY(y)));
    }
    const ticks = ejeX.ticks || [estado.xmin, estado.xmax];
    for (const x of ticks) if (x >= estado.xmin && x <= estado.xmax) gGrid.append(h('text.lineas-tick', { x: sx(x), y: H - 10, 'text-anchor': 'middle' }, String(formatoX(x))));
    for (const z of ejeY.zonas || []) {
      const y1 = sy(Math.min(estado.ymax, z.hasta)), y2 = sy(Math.max(estado.ymin, z.desde));
      if (y2 > y1) gGrid.prepend(h('rect', { x: pl, width: W - pl - pr, y: y1, height: y2 - y1, fill: z.color, opacity: 0.09 }));
    }
    for (const m of ejeX.marcas || []) {
      if (m.x < estado.xmin || m.x > estado.xmax) continue;
      gGrid.append(h('line', { x1: sx(m.x), x2: sx(m.x), y1: pt, y2: H - pb, stroke: m.color || 'var(--text-3)', 'stroke-dasharray': '2 5' }),
        h('text.lineas-marca', { x: sx(m.x) + 4, y: pt + 10 }, m.texto));
    }
  }

  const camino = (pts, fy = 'y') => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p[fy]).toFixed(1)}`).join('');

  function dibujar(series) {
    for (const s of series) {
      let e = elementos.get(s.id);
      if (!e) {
        const banda = h('path', { fill: s.color, opacity: 0.13 });
        const area = h('path', { fill: s.color, opacity: s.area ? 0.12 : 0 });
        const linea = h('path', { fill: 'none', stroke: s.color, 'stroke-width': s.grosor || 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': s.punteada ? '6 6' : null });
        const punto = h('circle', { r: 5.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2.5 });
        gSeries.append(banda, area, linea);
        gCursor.append(punto);
        e = { banda, area, linea, punto };
        elementos.set(s.id, e);
      }
      const d = s.datos;
      if (!d.length) { e.linea.setAttribute('d', ''); e.banda.setAttribute('d', ''); e.area.setAttribute('d', ''); continue; }
      e.linea.setAttribute('d', camino(d));
      if (s.area) e.area.setAttribute('d', `${camino(d)}L${sx(d[d.length - 1].x)} ${H - pb}L${sx(d[0].x)} ${H - pb}Z`);
      if (d[0].y0 !== undefined) {
        const sup = d.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y1).toFixed(1)}`).join('');
        const inf = [...d].reverse().map((p) => `L${sx(p.x).toFixed(1)} ${sy(p.y0).toFixed(1)}`).join('');
        e.banda.setAttribute('d', sup + inf + 'Z');
      } else e.banda.setAttribute('d', '');
      e.linea.style.opacity = s.tenue ? 0.35 : 1;
    }
    for (const [id, e] of elementos) {
      if (!series.find((s) => s.id === id)) { e.banda.remove(); e.area.remove(); e.linea.remove(); e.punto.remove(); elementos.delete(id); }
    }
  }

  // Transición: interpola los puntos (mismas x) entre el estado viejo y el nuevo
  let previas = null;
  const anim = seguidor((t) => {
    if (!previas) return dibujar(estado.series);
    const mix = estado.series.map((s) => {
      const p = previas.find((x) => x.id === s.id);
      if (!p || p.datos.length !== s.datos.length) return s;
      return { ...s, datos: s.datos.map((q, i) => {
        const o = p.datos[i];
        const lerp = (a, b) => (a === undefined || b === undefined ? b : a + (b - a) * t);
        return { ...q, y: lerp(o.y, q.y), y0: lerp(o.y0, q.y0), y1: lerp(o.y1, q.y1) };
      }) };
    });
    dibujar(mix);
  }, { suavizado: 0.2, umbral: 0.002 });

  let cursorX = null;
  function mostrarCursor(x) {
    cursorX = x;
    if (x === null || !estado.series.length) { gCursor.style.display = 'none'; tip.style.display = 'none'; return; }
    gCursor.style.display = '';
    const X = sx(x);
    lineaCursor.setAttribute('x1', X); lineaCursor.setAttribute('x2', X);
    const valores = [];
    for (const s of estado.series) {
      const e = elementos.get(s.id);
      if (!s.datos.length || s.sinPunto) { e && (e.punto.style.display = 'none'); continue; }
      let mejor = s.datos[0];
      for (const p of s.datos) if (Math.abs(p.x - x) < Math.abs(mejor.x - x)) mejor = p;
      if (Math.abs(mejor.x - x) > (estado.xmax - estado.xmin) / 8 && s.datos.length < 15) { e.punto.style.display = 'none'; continue; }
      e.punto.style.display = '';
      e.punto.setAttribute('cx', sx(mejor.x)); e.punto.setAttribute('cy', sy(mejor.y));
      valores.push({ serie: s, punto: mejor });
    }
    if (tooltip && valores.length) {
      tip.replaceChildren(tooltip(x, valores));
      tip.style.display = '';
      const rect = svg.getBoundingClientRect();
      const px = (X / W) * rect.width;
      tip.style.left = `${clamp(px, 70, rect.width - 70)}px`;
    }
    alCursor.forEach((cb) => cb(x, valores));
  }
  const desdeEvento = (e) => {
    const rect = svg.getBoundingClientRect();
    const X = ((e.clientX - rect.left) / rect.width) * W;
    return estado.xmin + ((clamp(X, pl, W - pr) - pl) / (W - pl - pr)) * (estado.xmax - estado.xmin);
  };
  capa.addEventListener('pointermove', (e) => mostrarCursor(desdeEvento(e)));
  capa.addEventListener('pointerdown', (e) => mostrarCursor(desdeEvento(e)));
  capa.addEventListener('pointerleave', () => { if (!wrap.dataset.fijo) mostrarCursor(null); });

  function medir() {
    const w = Math.round(wrap.clientWidth);
    if (!w || Math.abs(w - W) < 2) return;
    W = Math.max(280, w);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    capa.setAttribute('width', W - pl - pr);
    if (estado.series.length) { ejes(); dibujar(estado.series); if (cursorX !== null) mostrarCursor(cursorX); }
  }
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(wrap);

  return {
    el: wrap,
    set(series, { xmin, xmax, ymin, ymax } = {}) {
      const todos = series.flatMap((s) => s.datos.flatMap((p) => [p.y, p.y0, p.y1].filter(Number.isFinite)));
      const xs = series.flatMap((s) => s.datos.map((p) => p.x));
      const lo = ymin ?? (todos.length ? Math.min(...todos) : 0), hi = ymax ?? (todos.length ? Math.max(...todos) : 1);
      const margen = (hi - lo) * 0.1 || 1;
      previas = estado.series.length ? estado.series : null;
      estado = {
        series,
        xmin: xmin ?? (xs.length ? Math.min(...xs) : 0), xmax: xmax ?? (xs.length ? Math.max(...xs) : 1),
        ymin: ymin ?? Math.floor(lo - margen), ymax: ymax ?? Math.ceil(hi + margen),
      };
      medir();
      ejes();
      anim.set(0, true);
      anim.set(1);
      if (cursorX !== null) requestAnimationFrame(() => mostrarCursor(cursorX));
    },
    cursor: mostrarCursor,
    alMoverCursor: (cb) => alCursor.add(cb),
    fijar: (v) => { if (v) wrap.dataset.fijo = '1'; else delete wrap.dataset.fijo; },
  };
}

/* ---------- Silueta corporal que cambia con el IMC ---------- */
export function silueta() {
  const idG = nuevoId('sg');
  const cuerpo = h('path.silueta-cuerpo', { fill: `url(#${idG})` });
  const brazoI = h('path.silueta-cuerpo', { fill: `url(#${idG})` });
  const brazoD = h('path.silueta-cuerpo', { fill: `url(#${idG})` });
  const cabeza = h('circle.silueta-cuerpo', { cx: 100, cy: 34, r: 17, fill: `url(#${idG})` });
  const ref = h('path.silueta-ref', { fill: 'none' });
  const cinturaL = h('line.silueta-cintura', { y1: 128, y2: 128 });
  const cinturaT = h('text.silueta-txt', { y: 122, 'text-anchor': 'middle', x: 100 }, '');
  const svg = h('svg.silueta', { viewBox: '0 0 200 310', role: 'img', 'aria-label': 'Silueta según el índice de masa corporal' },
    h('defs', h('linearGradient', { id: idG, x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': 'var(--c2)' }), h('stop', { offset: '100%', 'stop-color': 'var(--c1)' }))),
    ref, brazoI, brazoD, cuerpo, cabeza, cinturaL, cinturaT);

  // Catmull-Rom → Bézier para un contorno suave
  const suave = (p) => {
    let d = `M${p[0][0]} ${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6},${p2[0]} ${p2[1]}`;
    }
    return d + 'Z';
  };
  function contorno(f, fw, mujer) {
    const fc = 1 + (f - 1) * 0.55, fh = 1 + (f - 1) * 0.75, fl = 1 + (f - 1) * 0.6;
    const hom = mujer ? 30 : 34, cad = mujer ? 31 : 27;
    const der = [
      [8, 56], [20, 64], [hom, 72], [hom * fc - 1, 92], [23 * fw, 126], [cad * fh, 150], [28 * fh, 172],
      [19 * fl, 222], [13.5, 268], [12, 292], [17, 302], [5, 302], [6, 292], [6.5, 268], [Math.max(4, 9 - (f - 1) * 7), 222], [2.5, 186],
    ];
    const izq = [...der].reverse().map(([x, y]) => [-x, y]);
    return [...der, ...izq].map(([x, y]) => [100 + x, y]);
  }
  function brazo(f, lado, mujer) {
    const fa = 1 + (f - 1) * 0.6, fc = 1 + (f - 1) * 0.55;
    const x0 = 100 + lado * ((mujer ? 30 : 34) + 2), x1 = 100 + lado * ((mujer ? 33 : 37) * fc + 4 + (f - 1) * 6);
    const w = 8 * fa;
    return `M${x0} 70 C${x0 + lado * w * 1.2} 74,${x1 + lado * w} 120,${x1 + lado * w * 0.4} 168 L${x1 - lado * w * 0.6} 166 C${x1 - lado * w * 0.4} 124,${x0 - lado * 2} 96,${x0 - lado * 4} 80Z`;
  }
  let mujer = true;
  const s = seguidor(([f, fw]) => {
    cuerpo.setAttribute('d', suave(contorno(f, fw, mujer)));
    brazoI.setAttribute('d', brazo(f, -1, mujer));
    brazoD.setAttribute('d', brazo(f, 1, mujer));
    const half = 23 * fw + 6;
    cinturaL.setAttribute('x1', 100 - half); cinturaL.setAttribute('x2', 100 + half);
  }, { suavizado: 0.14 });
  return {
    el: svg,
    set({ imc, ict, sexo, cintura }) {
      mujer = sexo !== 'M';
      ref.setAttribute('d', suave(contorno(1, 1, mujer)));
      const f = clamp(1 + ((imc || 22) - 22) * 0.045, 0.75, 2);
      const fw = ict ? clamp(1 + (ict - 0.46) * 2.6, 0.78, 2.3) : f;
      s.set([f, fw]);
      cinturaT.textContent = cintura ? `${cintura} cm` : '';
    },
  };
}

/* ---------- Mini serie (sparkline) ---------- */
export function mini(datos, color = 'var(--c1)') {
  const W = 120, H = 36;
  if (!datos?.length) return h('svg.mini', { viewBox: `0 0 ${W} ${H}` });
  const lo = Math.min(...datos), hi = Math.max(...datos);
  const pts = datos.map((v, i) => [(i / Math.max(1, datos.length - 1)) * (W - 6) + 3, H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)]);
  return h('svg.mini', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' },
    h('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    h('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3.5, fill: color }));
}

/* ---------- Dona de macronutrientes ---------- */
export function dona(items, { tam = 150, centro = '' } = {}) {
  const c = tam / 2, r = tam / 2 - 14, L = 2 * Math.PI * r;
  const total = items.reduce((a, i) => a + i.valor, 0) || 1;
  let acc = 0;
  return h('svg.dona', { viewBox: `0 0 ${tam} ${tam}`, width: tam, height: tam, role: 'img', 'aria-label': centro },
    h('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': 18 }),
    ...items.map((it) => {
      const len = (it.valor / total) * L;
      const el = h('circle', { cx: c, cy: c, r, fill: 'none', stroke: it.color, 'stroke-width': 18, 'stroke-dasharray': `${Math.max(0, len - 3)} ${L}`, 'stroke-dashoffset': -acc, transform: `rotate(-90 ${c} ${c})` });
      acc += len;
      return el;
    }),
    h('text.dona-txt', { x: c, y: c + 5, 'text-anchor': 'middle' }, centro));
}

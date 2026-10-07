/* ============================================================
   Micro-helper de DOM: h(tag, props, ...hijos)
   Acepta h('div.clase#id', {props}, hijos) y h('div', hijo, hijo).
   ============================================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'title', 'filter', 'feGaussianBlur', 'feDropShadow', 'pattern']);

const esProps = (v) => v !== null && typeof v === 'object' && !(v instanceof Node) && !Array.isArray(v) && (v.constructor === Object || v.constructor === undefined);

export function h(spec, props = null, ...hijos) {
  if (props !== null && props !== undefined && !esProps(props)) { hijos.unshift(props); props = null; }
  const m = String(spec).match(/^([a-zA-Z][a-zA-Z0-9-]*)?((?:[.#][^.#]+)*)$/);
  let tag = 'div', id = null;
  const clases = [];
  if (m) {
    tag = m[1] || 'div';
    for (const p of m[2]?.match(/[.#][^.#]+/g) || []) p[0] === '.' ? clases.push(p.slice(1)) : (id = p.slice(1));
  }
  const svg = SVG_TAGS.has(tag);
  const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (id) el.id = id;
  if (clases.length) svg ? el.setAttribute('class', clases.join(' ')) : (el.className = clases.join(' '));
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === 'boolean' && (k.startsWith('aria-') || k.startsWith('data-'))) { el.setAttribute(k, String(v)); continue; }
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') {
        const todo = [...clases, v].filter(Boolean).join(' ');
        svg ? el.setAttribute('class', todo) : (el.className = todo);
      } else if (k === 'style' && typeof v === 'object') {
        for (const [p, x] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, x) : (el.style[p] = x);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(el);
      } else if (k === 'html') {
        el.innerHTML = v; // solo con contenido propio, nunca con datos del usuario
      } else if (svg || k.includes('-') || k === 'for' || k === 'role' || k === 'list') {
        el.setAttribute(k === 'className' ? 'class' : k, v === true ? '' : v);
      } else if (k in el) {
        el[k] = v;
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const c of hijos.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export function montar(cont, ...hijos) { cont.replaceChildren(); agregar(cont, hijos); return cont; }

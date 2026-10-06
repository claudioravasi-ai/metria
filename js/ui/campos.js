/* ============================================================
   Controles de formulario: deslizadores en vivo, segmentados,
   interruptores, fichas y editor de medicación con vademécum.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { buscar, reconocer, CLASES } from '../engine/meds.js';

let n = 0;
const id = (p) => `${p}-${++n}`;
const coma = (v) => String(v).replace('.', ',');
const aNum = (s) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null; };

/** Deslizador con burbuja de valor, entrada exacta y botones ±. Dispara oninput en vivo. */
export function deslizador({ etiqueta, min, max, paso = 1, valor, unidad = '', onInput, formato, ayuda, icono: ic }) {
  const iid = id('rng');
  const dec = (String(paso).split('.')[1] || '').length;
  const coma = (v) => String(+(+v).toFixed(dec)).replace('.', ',');
  formato = formato || coma;
  if (valor != null) valor = +(+valor).toFixed(dec);
  const rango = h('input.rango', { type: 'range', id: iid, min, max, step: paso, value: valor ?? min, 'aria-label': etiqueta });
  const exacto = h('input.rango-num', { type: 'text', inputmode: 'decimal', value: valor != null ? coma(valor) : '', 'aria-label': `${etiqueta} (valor exacto)` });
  const burbuja = h('span.rango-burbuja.num');
  const pintar = () => {
    const v = +rango.value;
    const pct = ((v - min) / (max - min)) * 100;
    rango.style.setProperty('--pct', `${pct}%`);
    burbuja.textContent = `${formato(v)}${unidad ? ' ' + unidad : ''}`;
    burbuja.style.left = `calc(${pct}% + ${(0.5 - pct / 100) * 22}px)`;
  };
  const emitir = (v) => { pintar(); onInput?.(v); };
  rango.addEventListener('input', () => { exacto.value = coma(+rango.value); emitir(+rango.value); });
  exacto.addEventListener('change', () => {
    const v = aNum(exacto.value);
    if (v === null) { exacto.value = coma(+rango.value); return; }
    const c = Math.min(max, Math.max(min, v));
    rango.value = c; exacto.value = coma(c); emitir(c);
  });
  const mover = (s) => { const v = Math.min(max, Math.max(min, Math.round((+rango.value + s * paso) / paso) * paso)); rango.value = v; exacto.value = coma(v); emitir(+rango.value); };
  const el = h('div.control',
    h('div.control-cab', h('label', { for: iid }, ic ? icono(ic, { tam: 16 }) : null, etiqueta), h('div.control-exacto', exacto, unidad ? h('span.unidad', unidad) : null)),
    h('div.rango-fila',
      h('button.btn-mini', { type: 'button', 'aria-label': `Bajar ${etiqueta}`, onclick: () => mover(-1) }, icono('menos', { tam: 16 })),
      h('div.rango-wrap', burbuja, rango),
      h('button.btn-mini', { type: 'button', 'aria-label': `Subir ${etiqueta}`, onclick: () => mover(1) }, icono('mas', { tam: 16 }))),
    ayuda ? h('small.ayuda', ayuda) : null);
  queueMicrotask(pintar);
  return { el, get valor() { return +rango.value; }, set(v) { v = +(+v).toFixed(dec); rango.value = v; exacto.value = coma(v); pintar(); } };
}

/** Control segmentado (radio accesible). */
export function segmentado(opciones, valor, onChange, { etiqueta = '', pequeno = false } = {}) {
  const nombre = id('seg');
  const el = h(`div.segmentado${pequeno ? '.segmentado--chico' : ''}`, { role: 'radiogroup', 'aria-label': etiqueta });
  for (const o of opciones) {
    const i = h('input', { type: 'radio', name: nombre, value: o.valor, checked: o.valor === valor, id: `${nombre}-${o.valor}` });
    i.addEventListener('change', () => onChange?.(o.valor));
    el.append(h('div.seg-op', i, h('label', { for: `${nombre}-${o.valor}` }, o.icono ? icono(o.icono, { tam: 16 }) : null, o.texto)));
  }
  return el;
}

/** Interruptor tipo switch. */
export function interruptor(etiqueta, valor, onChange, desc) {
  const iid = id('sw');
  const i = h('input', { type: 'checkbox', id: iid, role: 'switch', checked: !!valor });
  i.addEventListener('change', () => onChange?.(i.checked));
  return h('label.interruptor', { for: iid }, i, h('span.sw'), h('span.sw-txt', h('strong', etiqueta), desc ? h('small', desc) : null));
}

/** Fichas seleccionables (selección múltiple). */
export function fichas(opciones, seleccion = {}, onChange) {
  return h('div.fichas', ...opciones.map(([clave, texto, alerta]) => {
    const b = h(`button.ficha${alerta ? '.ficha--alerta' : ''}`, { type: 'button', 'aria-pressed': !!seleccion[clave] }, h('span.ficha-check', icono('ok', { tam: 13 })), texto);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      onChange?.(clave, on);
    });
    return b;
  }));
}

/** Campo de texto/número/fecha con etiqueta, sufijo y ayuda. */
export function campo(etiqueta, props = {}, { sufijo, ayuda, requerido } = {}) {
  const iid = props.id || id('f');
  const tipo = props.type || 'text';
  const { opciones = [], ...resto } = props;
  const entrada = tipo === 'select'
    ? h('select', { ...resto, id: iid, type: null, value: null }, ...opciones.map(([v, t]) => h('option', { value: v, selected: String(props.value ?? '') === String(v) }, t)))
    : h('input', { ...resto, id: iid, ...(tipo === 'number' ? { type: 'text', inputmode: 'decimal' } : {}) });
  return h('div.campo',
    h('label', { for: iid }, etiqueta, requerido ? h('span.req', ' *') : null),
    sufijo ? h('div.campo-sufijo', entrada, h('span', sufijo)) : entrada,
    ayuda ? h('small.ayuda', ayuda) : null);
}

export const leerNum = aNum;

/** Medidor de fortaleza de contraseña (orientativo). */
export function fuerzaClave(input) {
  const barra = h('div.fuerza-barra');
  const txt = h('small');
  const el = h('div.fuerza', h('div.fuerza-pista', barra), txt);
  const calc = () => {
    const v = input.value;
    let p = 0;
    if (v.length >= 10) p++;
    if (v.length >= 14) p++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) p++;
    if (/\d/.test(v)) p++;
    if (/[^A-Za-z0-9]/.test(v)) p++;
    const niv = [['Muy débil', '#ef4444'], ['Débil', '#f97316'], ['Aceptable', '#eab308'], ['Buena', '#22c55e'], ['Muy buena', '#16a34a'], ['Excelente', '#15803d']][p];
    barra.style.width = `${(p / 5) * 100}%`; barra.style.background = niv[1];
    txt.textContent = v ? `${niv[0]}${v.length < 10 ? ' · mínimo 10 caracteres' : ''}` : 'Mínimo 10 caracteres';
  };
  input.addEventListener('input', calc);
  calc();
  return el;
}

/** Editor de medicación con autocompletado del vademécum. */
export function editorMeds(lista = [], onChange) {
  let meds = lista.map((m) => ({ ...m }));
  const ul = h('ul.meds');
  const entrada = h('input', { type: 'text', placeholder: 'Escribí el nombre o la marca (ej.: Lotrial, metformina…)', autocomplete: 'off', 'aria-label': 'Agregar medicamento' });
  const dosis = h('input', { type: 'text', placeholder: 'Dosis (opcional)', 'aria-label': 'Dosis' });
  const sugerencias = h('ul.sugerencias', { role: 'listbox' });
  const emitir = () => onChange?.(meds.map((m) => ({ ...m })));
  const pintar = () => {
    ul.replaceChildren(...meds.map((m, i) => h('li.med',
      h('span.med-ico', icono('pildora', { tam: 16 })),
      h('div.med-txt', h('strong', m.nombre), h('small', (m.clases || []).map((c) => CLASES[c] || c).join(' · ') || 'Sin clase reconocida')),
      h('button.btn-icono', { type: 'button', 'aria-label': `Quitar ${m.nombre}`, onclick: () => { meds.splice(i, 1); pintar(); emitir(); } }, icono('basura', { tam: 16 })))));
    if (!meds.length) ul.append(h('li.med.med--vacio', 'Sin medicación cargada'));
  };
  const agregar = (texto, f) => {
    const nombre = `${texto}${dosis.value.trim() ? ' ' + dosis.value.trim() : ''}`.trim();
    if (!nombre) return;
    const r = f || reconocer(nombre);
    meds.push({ nombre: nombre.slice(0, 80), clases: r?.clases || [] });
    entrada.value = ''; dosis.value = ''; sugerencias.replaceChildren();
    pintar(); emitir();
  };
  entrada.addEventListener('input', () => {
    const r = buscar(entrada.value);
    sugerencias.replaceChildren(...r.map((f) => h('li', { role: 'option' },
      h('button', { type: 'button', onclick: () => agregar(f.marca ? `${f.marca} (${f.generico})` : f.generico, f) },
        h('strong', f.marca ? `${f.marca}` : f.generico), h('small', `${f.marca ? f.generico + ' · ' : ''}${f.clases.map((c) => CLASES[c]).join(' · ')}`)))));
  });
  entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(entrada.value.trim()); } });
  pintar();
  return h('div.editor-meds', ul,
    h('div.meds-nueva', h('div.meds-buscar', icono('buscar', { tam: 16 }), entrada), dosis,
      h('button.btn.btn--suave', { type: 'button', onclick: () => agregar(entrada.value.trim()) }, icono('mas', { tam: 16 }), 'Agregar')),
    sugerencias);
}

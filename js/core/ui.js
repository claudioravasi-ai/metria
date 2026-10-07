/* ============================================================
   Componentes comunes: formato, avisos, ventanas, sección.
   ============================================================ */

import { h } from './dom.js';
import { icono } from './iconos.js';

/* ---------- Formato (es-AR) ---------- */
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export const fmt0 = (v) => fmt(v, 0);
export const fmtPct = (v, d = 1) => (Number.isFinite(v) ? `${fmt(v, d)} %` : '—');
export const fecha = (t) => (t ? new Date(typeof t === 'string' ? t + (t.length === 10 ? 'T12:00:00' : '') : t).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fechaHora = (t) => (t ? new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const hoyISO = (t = Date.now()) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function duracion(ms) {
  if (ms <= 0) return '0 min';
  const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d) return `${d} d ${hh} h`;
  if (hh) return `${hh} h ${m} min`;
  return `${m} min`;
}
export const dniMascara = (dni) => (dni ? `••.•••.${String(dni).slice(-3)}` : '—');

/* ---------- Avisos breves ---------- */
let zonaToast;
export function toast(texto, tipo = 'info', ms = 3600) {
  if (!zonaToast) { zonaToast = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(zonaToast); }
  const t = h(`div.toast.toast--${tipo}`, icono(tipo === 'error' ? 'alerta' : tipo === 'ok' ? 'okCirculo' : 'info', { tam: 18 }), h('span', texto));
  zonaToast.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--in'));
  setTimeout(() => { t.classList.remove('toast--in'); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- Ventana modal accesible ---------- */
const pilaModales = [];
export function modal({ titulo, cuerpo, acciones = [], clase = '', alCerrar, ancho = 560, color, cerrable = true }) {
  const previo = document.activeElement;
  const fondo = h('div.modal-fondo', { onclick: (e) => { if (e.target === fondo && cerrable) cerrar(); } });
  const [c1, c2] = Array.isArray(color) ? color : [color, color];
  const caja = h(`div.modal.${clase || 'modal--base'}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo, style: { maxWidth: `${ancho}px`, ...(color ? { '--c1': c1, '--c2': c2 } : {}) } },
    h('header.modal-cab', h('h2', titulo), cerrable ? h('button.btn-icono', { 'aria-label': 'Cerrar', onclick: () => cerrar() }, icono('x')) : null),
    h('div.modal-cuerpo', cuerpo),
    acciones.length ? h('footer.modal-pie', acciones) : null);
  fondo.appendChild(caja);
  document.body.appendChild(fondo);
  document.body.classList.add('con-modal');
  requestAnimationFrame(() => fondo.classList.add('modal--in'));
  const enfocables = () => [...caja.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.disabled);
  const tecla = (e) => {
    if (pilaModales[pilaModales.length - 1] !== api) return;
    if (e.key === 'Escape' && cerrable) cerrar();
    if (e.key === 'Tab') {
      const f = enfocables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', tecla);
  setTimeout(() => (enfocables()[cerrable ? 1 : 0] || enfocables()[0])?.focus(), 60);
  let cerrado = false;
  function cerrar(valor) {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', tecla);
    fondo.classList.remove('modal--in');
    pilaModales.splice(pilaModales.indexOf(api), 1);
    if (!pilaModales.length) document.body.classList.remove('con-modal');
    setTimeout(() => fondo.remove(), 220);
    previo?.focus?.();
    alCerrar?.(valor);
  }
  const api = { cerrar, caja, cuerpo: caja.querySelector('.modal-cuerpo') };
  pilaModales.push(api);
  return api;
}
export const cerrarTodos = () => [...pilaModales].reverse().forEach((m) => m.cerrar());

export function confirmar({ titulo, texto, si = 'Aceptar', no = 'Cancelar', peligro = false, icono: ic = 'alerta', color }) {
  return new Promise((res) => {
    const m = modal({
      titulo, color, ancho: 460, alCerrar: (v) => res(!!v),
      cuerpo: h('div.confirmar', h('div.confirmar-ico', icono(ic, { tam: 28 })), typeof texto === 'string' ? h('p', texto) : texto),
      acciones: [h('button.btn.btn--suave', { onclick: () => m.cerrar(false) }, no), h(`button.btn.${peligro ? 'btn--peligro' : 'btn--primario'}`, { onclick: () => m.cerrar(true) }, si)],
    });
  });
}

/* ---------- Bloques de sección ---------- */
export const SECCIONES = {
  inicio: { nombre: 'Inicio', icono: 'inicio', c1: '#6366f1', c2: '#a855f7' },
  datos: { nombre: 'Mis datos', icono: 'datos', c1: '#06b6d4', c2: '#3b82f6' },
  metabolismo: { nombre: 'Metabolismo', icono: 'llama', c1: '#f97316', c2: '#facc15' },
  cuerpo: { nombre: 'Cuerpo', icono: 'cuerpo', c1: '#14b8a6', c2: '#22c55e' },
  corazon: { nombre: 'Corazón', icono: 'corazon', c1: '#f43f5e', c2: '#fb923c' },
  laboratorio: { nombre: 'Laboratorio', icono: 'matraz', c1: '#8b5cf6', c2: '#d946ef' },
  tratamiento: { nombre: 'Tratamiento', icono: 'jeringa', c1: '#2563eb', c2: '#06b6d4' },
  plan: { nombre: 'Plan integral', icono: 'objetivo', c1: '#ec4899', c2: '#f59e0b' },
  estudios: { nombre: 'Estudios', icono: 'carpeta', c1: '#10b981', c2: '#84cc16' },
  privacidad: { nombre: 'Privacidad', icono: 'escudo', c1: '#475569', c2: '#0ea5e9' },
  ayuda: { nombre: 'Ayuda', icono: 'ayuda', c1: '#eab308', c2: '#f97316' },
  pacientes: { nombre: 'Pacientes', icono: 'usuarios', c1: '#6366f1', c2: '#06b6d4' },
  panel: { nombre: 'Panel', icono: 'grafico', c1: '#7c3aed', c2: '#ec4899' },
  medicos: { nombre: 'Profesionales', icono: 'estetoscopio', c1: '#0891b2', c2: '#22c55e' },
};

export function estiloSeccion(id) {
  const s = SECCIONES[id] || SECCIONES.inicio;
  return { '--c1': s.c1, '--c2': s.c2 };
}

/** Cabecera de sección con gradiente y gema. */
export function heroe(id, titulo, subtitulo, extra = null) {
  const s = SECCIONES[id];
  return h('header.heroe', { style: estiloSeccion(id) },
    h('div.heroe-gema', icono(s.icono, { tam: 28 })),
    h('div.heroe-txt', h('h1', titulo || s.nombre), subtitulo ? h('p', subtitulo) : null),
    extra ? h('div.heroe-extra', extra) : null);
}

export function tarjeta(titulo, ...contenido) {
  const opts = contenido[0] && typeof contenido[0] === 'object' && !(contenido[0] instanceof Node) && !Array.isArray(contenido[0]) ? contenido.shift() : {};
  return h(`section.card${opts.clase ? '.' + opts.clase : ''}`, { style: opts.seccion ? estiloSeccion(opts.seccion) : null },
    titulo ? h('header.card-cab', opts.icono ? h('span.card-ico', icono(opts.icono, { tam: 18 })) : null, h('h3', titulo), opts.extra || null) : null,
    ...contenido);
}

export function chip(texto, tono = 'neutro', ic) {
  return h(`span.chip.chip--${tono}`, ic ? icono(ic, { tam: 14 }) : null, texto);
}

export function vacio(ic, titulo, texto, accion) {
  return h('div.vacio', h('div.vacio-ico', icono(ic, { tam: 30 })), h('h4', titulo), texto ? h('p', texto) : null, accion || null);
}

export function aviso(tipo, texto, ic) {
  return h(`div.aviso.aviso--${tipo}`, icono(ic || (tipo === 'peligro' ? 'alerta' : tipo === 'ok' ? 'okCirculo' : 'info'), { tam: 18 }), h('div', texto));
}

export function cargando(texto = 'Cargando…') {
  return h('div.cargando', h('div.spinner'), h('span', texto));
}

/** Barra de progreso actualizable. */
export function progreso() {
  const barra = h('div.progreso-barra');
  const el = h('div.progreso', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, barra);
  return { el, set: (p) => { const v = Math.round(p * 100); barra.style.width = `${v}%`; el.setAttribute('aria-valuenow', v); } };
}

/** Desplegable simple con <details>. */
export function plegable(titulo, contenido, abierto = false) {
  return h('details.plegable', { open: abierto }, h('summary', h('span', titulo), icono('chevronAbajo', { tam: 18 })), h('div.plegable-cuerpo', contenido));
}

/* ============================================================
   Marco de la app: barra lateral (PC), riel (tablet) y barra
   inferior (móvil), con el color de cada sección en el ambiente.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { SECCIONES, estiloSeccion, modal, toast, fechaHora, confirmar } from '../core/ui.js';
import { CONFIG, MS_DIA } from '../config.js';
import { backend } from '../data/servicio.js';

/* ---------- Tema claro / oscuro (preferencia local del equipo) ---------- */
export function temaInicial() {
  let t = null;
  try { t = localStorage.getItem('metria-tema'); } catch { /* */ }
  if (t) document.documentElement.dataset.theme = t;
}
export function alternarTema() {
  const r = document.documentElement;
  const oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = oscuro ? 'light' : 'dark';
  try { localStorage.setItem('metria-tema', r.dataset.theme); } catch { /* */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#f5f7fb' : '#0b1020');
}

export function ambiente(id) {
  const s = SECCIONES[id] || SECCIONES.inicio;
  document.body.style.setProperty('--amb1', s.c1);
  document.body.style.setProperty('--amb2', s.c2);
}

/** Logo: insignia METRIA APP. variante: 'normal' (con nombre), 'chico' (solo insignia) o 'grande' (portada y carga). */
export function logo(variante = 'normal') {
  const v = variante === true ? 'chico' : variante;
  return h(`div.logo.logo--${v}`,
    h('img.logo-marca', { src: v === 'grande' ? 'icons/logo-512.png' : 'icons/logo-256.png', alt: v === 'normal' ? '' : `${CONFIG.app} App`, width: 256, height: 256, decoding: 'async' }),
    v === 'normal' ? h('div.logo-txt', h('strong', CONFIG.app), h('small', 'Salud cardiometabólica')) : null);
}

/** Indicador de conexión en vivo y de la demo. */
function estadoVivo() {
  const B = backend();
  const el = h('div.vivo', { title: B.modo === 'demo' ? 'Demo: se sincroniza entre pestañas y ventanas de este navegador' : 'Conectado: los cambios llegan en vivo a todos los equipos' },
    h('span.vivo-punto'), h('span', B.modo === 'demo' ? 'Demo en vivo' : 'En vivo'));
  return el;
}

/** Barra de la demo: aviso y reloj adelantable para probar vencimientos. */
export function barraDemo(alCambiar) {
  const B = backend();
  if (B.modo !== 'demo') return null;
  const dias = Math.round(B.relojAdelantado() / MS_DIA);
  return h('div.barra-demo', { role: 'note' },
    icono('info', { tam: 16 }),
    h('span', h('strong', 'Demo: '), h('span.solo-ancho', 'los datos quedan solo en este navegador. Abrí otra pestaña para ver la sincronización en vivo.'), h('span.solo-movil', 'datos solo en este navegador.')),
    h('div.barra-demo-acc',
      dias ? h('span.chip.chip--aviso', `Reloj +${dias} d`) : null,
      h('button.btn-link', { type: 'button', onclick: async () => { B.adelantarReloj(MS_DIA); toast('Reloj de la demo adelantado 1 día', 'info'); alCambiar?.(); } }, '+1 día'),
      h('button.btn-link', { type: 'button', onclick: async () => {
        if (await confirmar({ titulo: 'Reiniciar la demo', texto: 'Se borran todos los datos de prueba de este navegador y se vuelven a cargar los de ejemplo.', si: 'Reiniciar', peligro: true })) {
          await B.reiniciarDemo(); location.reload();
        }
      } }, 'Reiniciar')));
}

/**
 * Arma el marco.
 * items: [{ id, nombre?, icono?, badge? }] · principales: ids para la barra inferior
 */
export function marco({ items, principales, actual, onIr, usuario, rolTexto, onSalir, contenido, extraTop }) {
  const nav = (clase) => h(`nav.${clase}`, { 'aria-label': 'Secciones' },
    ...items.map((it) => {
      const s = SECCIONES[it.id] || {};
      return h('a.nav-item', {
        href: `#${it.id}`, 'aria-current': it.id === actual ? 'page' : null, style: estiloSeccion(it.id),
        onclick: (e) => { e.preventDefault(); onIr(it.id); },
      }, h('span.nav-ico', icono(it.icono || s.icono, { tam: 20 })), h('span.nav-txt', it.nombre || s.nombre), it.badge ? h('span.nav-badge', String(it.badge)) : null);
    }));

  const masItems = items.filter((i) => !principales.includes(i.id));
  const abrirMas = () => {
    const m = modal({
      titulo: 'Más secciones', clase: 'modal--hoja', ancho: 520,
      cuerpo: h('div.hoja-grid',
        ...masItems.map((it) => {
          const s = SECCIONES[it.id] || {};
          return h('button.hoja-item', { type: 'button', style: estiloSeccion(it.id), onclick: () => { m.cerrar(); onIr(it.id); } },
            h('span.nav-ico', icono(it.icono || s.icono, { tam: 22 })), h('span', it.nombre || s.nombre), it.badge ? h('span.nav-badge', String(it.badge)) : null);
        }),
        h('button.hoja-item', { type: 'button', onclick: () => { m.cerrar(); alternarTema(); } }, h('span.nav-ico', icono('luna', { tam: 22 })), h('span', 'Tema claro / oscuro')),
        h('button.hoja-item.hoja-item--salir', { type: 'button', onclick: () => { m.cerrar(); onSalir(); } }, h('span.nav-ico', icono('salir', { tam: 22 })), h('span', 'Cerrar sesión'))),
    });
  };
  const inferior = h('nav.nav-inferior', { 'aria-label': 'Secciones principales' },
    ...principales.map((id) => {
      const it = items.find((i) => i.id === id);
      const s = SECCIONES[id];
      return h('a.nav-inf', { href: `#${id}`, 'aria-current': id === actual ? 'page' : null, style: estiloSeccion(id), onclick: (e) => { e.preventDefault(); onIr(id); } },
        h('span.nav-inf-ico', icono(it?.icono || s.icono, { tam: 22 }), it?.badge ? h('span.nav-badge', String(it.badge)) : null), h('span', it?.nombre || s.nombre));
    }),
    h('button.nav-inf', { type: 'button', 'aria-current': !principales.includes(actual) ? 'page' : null, onclick: abrirMas }, h('span.nav-inf-ico', icono('menu', { tam: 22 })), h('span', 'Más')));

  const iniciales = (usuario || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const lateral = h('aside.lateral',
    logo(),
    nav('nav-lateral'),
    h('div.lateral-pie',
      estadoVivo(),
      h('div.usuario', h('span.avatar', iniciales), h('div', h('strong', usuario), h('small', rolTexto))),
      h('div.lateral-acc',
        h('button.btn-icono', { type: 'button', 'aria-label': 'Cambiar tema', title: 'Tema claro / oscuro', onclick: alternarTema }, icono('luna')),
        h('button.btn-icono', { type: 'button', 'aria-label': 'Cerrar sesión', title: 'Cerrar sesión', onclick: onSalir }, icono('salir')))));

  const sec = SECCIONES[actual] || SECCIONES.inicio;
  const top = h('header.top',
    logo('chico'),
    h('div.top-titulo', { style: estiloSeccion(actual) }, h('span.top-gema', icono(sec.icono, { tam: 16 })), h('span', sec.nombre)),
    h('div.top-acc', estadoVivo(), h('button.btn-icono', { type: 'button', 'aria-label': 'Cambiar tema', onclick: alternarTema }, icono('luna')), h('span.avatar.avatar--chico', iniciales)));

  ambiente(actual);
  return h('div.app',
    lateral,
    h('div.principal', top, extraTop || null, h('main.contenido#contenido', { tabindex: -1, style: estiloSeccion(actual) }, contenido)),
    inferior);
}

/* ---------- Cierre por inactividad ---------- */
let temporizador, aviso, avisoModal;
export function vigilarInactividad(onSalir) {
  const minutos = CONFIG.minutosInactividad;
  const reiniciar = () => {
    clearTimeout(temporizador); clearTimeout(aviso);
    aviso = setTimeout(() => {
      avisoModal = modal({ titulo: '¿Seguís ahí?', ancho: 420, cuerpo: h('p', 'Por seguridad, la sesión se cerrará en 1 minuto por inactividad.'), acciones: [h('button.btn.btn--primario', { onclick: () => { avisoModal.cerrar(); reiniciar(); } }, 'Seguir conectado')] });
    }, (minutos - 1) * 60000);
    temporizador = setTimeout(() => { avisoModal?.cerrar(); toast('Sesión cerrada por inactividad', 'info'); onSalir(); }, minutos * 60000);
  };
  const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  let ultimo = 0;
  const tocar = () => { const t = Date.now(); if (t - ultimo > 5000) { ultimo = t; reiniciar(); } };
  eventos.forEach((e) => window.addEventListener(e, tocar, { passive: true }));
  reiniciar();
  return () => { clearTimeout(temporizador); clearTimeout(aviso); eventos.forEach((e) => window.removeEventListener(e, tocar)); };
}

export { fechaHora };

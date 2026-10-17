/* ============================================================
   Panel de firma: con el dedo, el lápiz digital o el mouse («Dibujar»),
   o escribiendo el nombre con el teclado («Escribir»), que se dibuja
   en letra manuscrita.
   Devuelve la firma como PNG chico (data URL) para guardarla con el
   consentimiento o como firma del médico en las órdenes.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';

const LETRA = "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', 'Apple Chancery', 'URW Chancery L', cursive";

export function panelFirma({ alto = 150, onCambio, nombre = '', teclado = false } = {}) {
  let modo = 'trazo';
  const cv = h('canvas.firma-lienzo', { 'aria-label': 'Espacio para firmar' });
  let ctx, trazos = 0, dibujando = false, ultimo = null, escala = 1;
  const preparar = () => {
    const ancho = cv.parentElement?.clientWidth || 360;
    escala = Math.min(2, window.devicePixelRatio || 1);
    cv.width = ancho * escala; cv.height = alto * escala;
    cv.style.width = `${ancho}px`; cv.style.height = `${alto}px`;
    ctx = cv.getContext('2d');
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f5c';
    trazos = 0; onCambio?.(false);
  };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); dibujando = true; ultimo = pos(e); ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); });
  cv.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y);
    ctx.quadraticCurveTo(ultimo.x, ultimo.y, (ultimo.x + p.x) / 2, (ultimo.y + p.y) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p;
  });
  const fin = () => { if (dibujando) { dibujando = false; trazos++; onCambio?.(true); } };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('pointerleave', fin);
  // Firma escrita con el teclado: se dibuja el texto en letra manuscrita sobre el mismo lienzo
  const texto = h('input.firma-texto', { type: 'text', maxlength: 60, value: nombre, placeholder: 'Escribí tu nombre y apellido', 'aria-label': 'Firma escrita', autocomplete: 'off' });
  const dibujarTexto = () => {
    preparar();
    const t = texto.value.trim();
    if (!t) return;
    const ancho = cv.width / escala;
    let tam = 46;
    ctx.font = `italic ${tam}px ${LETRA}`;
    while (ctx.measureText(t).width > ancho - 40 && tam > 18) { tam -= 2; ctx.font = `italic ${tam}px ${LETRA}`; }
    ctx.fillStyle = '#0b1f5c'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, 24, alto - 46);
    trazos = 1; onCambio?.(true);
  };
  texto.addEventListener('input', dibujarTexto);
  const zonaTexto = h('div.firma-escribir', { hidden: true }, texto);
  const cambiarModo = (m) => {
    modo = m;
    cv.style.pointerEvents = m === 'trazo' ? '' : 'none';
    zonaTexto.hidden = m !== 'teclado';
    el.querySelectorAll('.firma-modo button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
    if (m === 'teclado') { dibujarTexto(); setTimeout(() => texto.focus(), 30); } else preparar();
  };
  const el = h('div.firma',
    teclado ? h('div.firma-modo', { role: 'group', 'aria-label': 'Cómo firmar' },
      h('button', { type: 'button', 'data-m': 'trazo', 'aria-pressed': 'true', onclick: () => cambiarModo('trazo') }, icono('editar', { tam: 14 }), 'Dibujar (dedo, lápiz o mouse)'),
      h('button', { type: 'button', 'data-m': 'teclado', 'aria-pressed': 'false', onclick: () => cambiarModo('teclado') }, icono('texto', { tam: 14 }), 'Escribir con el teclado')) : null,
    zonaTexto,
    h('div.firma-marco', cv, h('span.firma-linea'), h('span.firma-guia', 'Firmá acá')),
    h('button.btn-link.firma-borrar', { type: 'button', onclick: () => { if (modo === 'teclado') { texto.value = ''; } preparar(); } }, icono('basura', { tam: 14 }), 'Borrar'));
  requestAnimationFrame(preparar);
  return {
    el,
    vacia: () => trazos === 0,
    metodo: () => modo,
    /** PNG reducido (máx. 420 px de ancho) para que pese poco. */
    png() {
      if (!trazos) return null;
      const w = Math.min(420, cv.width / escala), k = w / (cv.width / escala);
      const out = document.createElement('canvas');
      out.width = Math.round(w); out.height = Math.round(alto * k);
      out.getContext('2d').drawImage(cv, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    },
  };
}

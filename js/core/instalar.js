/* ============================================================
   Instalar Metria como app (Android, PC e iPhone).
   - Chrome / Edge / Samsung Internet: usan el aviso del navegador
     (beforeinstallprompt) con un solo toque.
   - Si el navegador no lo ofrece, explica el paso exacto según dónde
     se abrió el enlace (WhatsApp, Gmail, Instagram… no permiten instalar).
   ============================================================ */

import { h } from './dom.js';
import { icono } from './iconos.js';
import { modal, toast } from './ui.js';

let aviso = null;
const botones = new Set();

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; refrescar(); });
window.addEventListener('appinstalled', () => { aviso = null; toast('Metria quedó instalada en tu equipo', 'ok'); refrescar(); });

export const yaInstalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function refrescar() {
  for (const b of botones) { if (!b.isConnected) botones.delete(b); else b.hidden = yaInstalada(); }
}

/** Botón «Instalar app». Se oculta solo si ya se abrió como app instalada. */
export function botonInstalar(clase = 'btn.btn--vidrio') {
  const b = h(`button.${clase}`, { type: 'button', hidden: yaInstalada(), onclick: instalar }, icono('bajar', { tam: 18 }), 'Instalar app');
  botones.add(b);
  return b;
}

export async function instalar() {
  if (aviso) {
    const a = aviso; aviso = null;
    a.prompt();
    const { outcome } = await a.userChoice.catch(() => ({}));
    if (outcome !== 'accepted') aviso = a; // se puede volver a intentar
    return;
  }
  ayudaInstalar();
}

function ayudaInstalar() {
  const ua = navigator.userAgent || '';
  const android = /Android/i.test(ua);
  const ios = !android && (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const dentroDeApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\/|Twitter|TikTok|Telegram/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  const firefox = /Firefox|FxiOS/i.test(ua);
  const url = location.href.split('#')[0];
  const pasos = (...l) => h('ol.instalar-pasos', ...l.map((t) => h('li', t)));
  let cuerpo;
  if (yaInstalada()) {
    cuerpo = h('p', 'Ya estás usando Metria como app instalada.');
  } else if (dentroDeApp) {
    cuerpo = h('div',
      h('p', h('strong', 'Abriste el enlace desde otra aplicación (WhatsApp, Gmail, Instagram…). '), 'Esas ventanas no permiten instalar.'),
      pasos(ios ? 'Tocá el menú (⋯ o el ícono de compartir) y elegí «Abrir en Safari».' : 'Tocá el menú ⋮ arriba a la derecha y elegí «Abrir en Chrome» (o «Abrir en el navegador»).',
        'Ya en el navegador, volvé a tocar «Instalar app».'),
      copiar(url));
  } else if (ios) {
    cuerpo = h('div',
      h('p', 'En iPhone y iPad se instala desde Safari:'),
      pasos('Abrí esta página en Safari (no en Chrome ni desde WhatsApp).', 'Tocá el botón Compartir (el cuadrado con la flecha hacia arriba).', 'Elegí «Agregar a inicio» y después «Agregar».'));
  } else if (android) {
    cuerpo = h('div',
      h('p', samsung ? 'En Samsung Internet:' : firefox ? 'En Firefox:' : 'En Chrome:'),
      pasos(
        samsung ? 'Tocá el menú ☰ abajo a la derecha.' : 'Tocá el menú ⋮ arriba a la derecha.',
        samsung ? 'Elegí «Agregar página a» → «Pantalla de inicio».' : 'Elegí «Instalar app» o «Agregar a la pantalla principal».',
        'Confirmá con «Instalar».'),
      h('p.ayuda', 'Si no aparece la opción: actualizá Chrome desde Play Store, cerrá la pestaña y volvé a abrir el enlace. Si Metria ya estaba instalada, buscala entre tus aplicaciones o desinstalala y volvé a probar.'));
  } else {
    cuerpo = h('div',
      h('p', 'En la computadora (Chrome o Edge):'),
      pasos('Buscá el ícono de instalar a la derecha de la barra de direcciones (una pantalla con una flecha).', 'O abrí el menú ⋮ → «Transmitir, guardar y compartir» → «Instalar página como app».'),
      h('p.ayuda', 'Safari y Firefox de computadora no instalan apps web: usá Chrome o Edge.'));
  }
  const m = modal({ titulo: 'Instalar Metria', ancho: 460, cuerpo: h('div.instalar-ayuda', cuerpo),
    acciones: [h('button.btn.btn--primario', { type: 'button', onclick: () => m.cerrar() }, 'Entendido')] });
}

function copiar(url) {
  return h('button.btn.btn--suave', { type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado: pegalo en Chrome o Safari', 'ok'); } catch { toast(url, 'info'); }
  } }, icono('copiar', { tam: 16 }), 'Copiar el enlace');
}

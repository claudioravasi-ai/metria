/* ============================================================
   Página del médico que recibe un estudio compartido (sin cuenta).
   Dirección: …/#c/<enlace>. Pide la contraseña, descifra en este equipo,
   muestra el estudio y deja descargarlo mientras el enlace no venza.
   ============================================================ */

import { h, montar } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { aviso, cargando, progreso, fechaHora, duracion } from '../core/ui.js';
import { logo } from './shell.js';
import { backend } from '../data/servicio.js';
import { leerCompartido, abrirCompartido } from '../data/compartir.js';
import { mostrarEnVisor, descargarBlob, tamanoLegible } from '../data/archivos.js';

export async function pantallaCompartido(tok, { onEntrar }) {
  const raiz = document.getElementById('app');
  const marco = (...c) => montar(raiz, h('div.acceso', h('div.acceso-fondo', h('i'), h('i'), h('i'), h('i')),
    h('header.acceso-top', logo()), h('main.acceso-main.estado-publico', ...c),
    h('footer.acceso-pie', h('span', 'Datos de salud: no los reenvíes'))));
  const volver = h('button.btn.btn--suave', { type: 'button', onclick: onEntrar }, 'Ir a Metria');
  marco(cargando('Buscando el estudio…'));
  const c = await leerCompartido(tok);
  if (!c || !c.listo || !(c.vence > backend().ahora())) {
    marco(h('section.acceso-card.centro', h('span.puerta-gema', icono('candado', { tam: 26 })), h('h2', 'Este enlace ya no está disponible'),
      h('p', 'Venció, el paciente lo anuló o el estudio ya se borró. Pedile al paciente que te lo comparta de nuevo.'), volver));
    return;
  }

  const campo = h('input.compartido-clave', { type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX', maxlength: 12, 'aria-label': 'Contraseña' });
  const error = h('p.form-error', { role: 'alert' });
  const barra = progreso();
  const btn = h('button.btn.btn--primario.compartido-btn', { type: 'submit' }, icono('candado', { tam: 18 }), 'Abrir el estudio');
  const form = h('form.acceso-card', { onsubmit: (e) => { e.preventDefault(); abrir(); } },
    h('span.puerta-gema', icono('estetoscopio', { tam: 26 })),
    h('h2', 'Un paciente te compartió un estudio'),
    h('p', 'Escribí la contraseña que te pasó el paciente. El estudio se descifra solo en este equipo.'),
    h('label.campo', h('span', 'Contraseña'), campo),
    error, btn,
    h('p.ayuda', `Disponible hasta el ${fechaHora(c.vence)} (${duracion(c.vence - backend().ahora())}) · ${tamanoLegible(c.tamano || 0)}`),
    h('p.ayuda', 'Contiene información de salud sensible (Ley 25.326): usala solo para la atención del paciente.'));
  marco(form);
  setTimeout(() => campo.focus(), 60);

  async function abrir() {
    if (campo.value.replace(/[^a-z0-9]/gi, '').length < 8) { error.textContent = 'La contraseña tiene 8 letras y números (por ejemplo K7P4-M2QX).'; return; }
    btn.disabled = true; error.textContent = '';
    form.append(barra.el);
    try {
      const { meta, blob } = await abrirCompartido(tok, c, campo.value, barra.set);
      const visor = h('div.visor');
      const descargar = h('button.btn.btn--primario', { type: 'button', onclick: () => descargarBlob(blob, meta.nombre || 'estudio') }, icono('bajar', { tam: 18 }), 'Descargar');
      marco(h('section.compartido-ver',
        h('header', h('h1', meta.titulo || 'Estudio'), h('small', `${meta.nombre || ''}${meta.fechaEstudio ? ' · ' + meta.fechaEstudio.split('-').reverse().join('/') : ''}`)),
        aviso('info', `Guardalo si lo necesitás: el enlace vence el ${fechaHora(c.vence)} y después se borra.`),
        visor, h('div.botones', descargar, volver)));
      await mostrarEnVisor(blob, meta, visor);
    } catch (e) {
      barra.el.remove(); btn.disabled = false;
      error.textContent = e.code === 'CLAVE' ? 'La contraseña no es correcta. Revisala con el paciente.' : 'No se pudo abrir: el enlace venció o se anuló.';
    }
  }
}

/* ============================================================
   Plan integral: alimentación, actividad, tratamiento sugerido,
   interacciones, efectos adversos y seguimiento.
   - Médico: todo, con dosis y tiempos, más el análisis con IA (opcional).
   - Paciente: alimentación, actividad y controles; los fármacos aparecen
     solo como "temas para hablar con tu médico" (sin dosis, Ley 17.132).
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, toast, vacio, plegable } from '../core/ui.js';
import * as GL from '../engine/glp1.js';
import { analizarConIA, guardarNota, backend } from '../data/servicio.js';

const PRIO = { alta: ['Prioridad alta', 'peligro'], media: ['Sugerido', 'aviso'], baja: ['A considerar', 'info'] };
const lista = (items, clase = '') => h(`ul.lista${clase}`, ...items.map((t) => h('li', t)));

export function vistaPlan(ev, { rol, pacUid, medico } = {}) {
  const pl = ev.plan;
  const med = rol === 'medico';
  if (!pl?.dieta) {
    return h('div.seccion', heroe('plan', 'Plan integral', 'Alimentación, actividad y tratamiento a tu medida'),
      vacio('datos', 'Faltan datos', 'Cargá al menos peso, talla y fecha de nacimiento en «Mis datos» para armar el plan.'));
  }
  const d = pl.dieta, a = pl.actividad;
  const bloques = [];

  if (pl.alertas.length) bloques.push(h('div.avisos', ...pl.alertas.map((t) => aviso('peligro', t))));

  const kcal = h('div.plan-kcal', h('small', 'Calorías por día'), h('strong.num', d.kcal.toLocaleString('es-AR')), h('span', `Gasto total ${d.get.toLocaleString('es-AR')} · basal ${d.tmb.toLocaleString('es-AR')}`));
  bloques.push(tarjeta('Alimentación', { icono: 'llama', seccion: 'metabolismo', extra: chip(d.patron, 'info') },
    h('div.plan-alim', kcal,
      h('div.plan-macros',
        macro('Proteínas', d.macros.proteina, '#14b8a6'), macro('Carbohidratos', d.macros.carbohidratos, '#f59e0b'),
        macro('Grasas', d.macros.grasas, '#8b5cf6'), macro('Fibra', d.macros.fibra, '#22c55e'), macro('Agua', d.macros.agua, '#06b6d4'))),
    h('p.plan-objetivo', icono('objetivo', { tam: 16 }), d.objetivo),
    d.reglas.length ? h('div', h('h4.sub', 'A tu medida'), lista(d.reglas)) : null,
    d.evitar.length ? h('div', h('h4.sub', 'Evitar'), lista(d.evitar, '.lista--aviso')) : null,
    plegable('Ejemplo de un día', lista(d.ejemplo)),
    h('p.ayuda', 'Las calorías nunca bajan del metabolismo basal ni de 1200 (mujeres) / 1500 (varones), con un déficit de hasta 25 %.')));

  bloques.push(tarjeta('Actividad física', { icono: 'rayo', seccion: 'cuerpo' },
    h('div.plan-act',
      dato('Aeróbica', a.aerobica, 'pulso'), dato('Fuerza', a.fuerza, 'cuerpo'), dato('Flexibilidad', a.flexibilidad, 'chispa'), dato('Pasos', a.pasos, 'huella')),
    a.reglas.length ? h('div', h('h4.sub', 'Cómo empezar'), lista(a.reglas)) : null,
    a.precauciones.length ? h('div', h('h4.sub', 'Precauciones'), lista(a.precauciones, '.lista--aviso')) : null));

  if (med) {
    bloques.push(tarjeta('Tratamiento sugerido', { icono: 'jeringa', seccion: 'tratamiento', extra: chip('Para el médico', 'neutro') },
      pl.tratamiento.length ? h('div.plan-trat', ...pl.tratamiento.map((t) => h(`article.trat.trat--${t.prioridad}`,
        h('header', chip(...PRIO[t.prioridad] || PRIO.media), h('strong', t.titulo)),
        lista(t.detalle, '.lista--chica'), t.fuente ? h('small.ayuda', `Fuente: ${t.fuente}`) : null))) : h('p.ayuda', 'Sin cambios de medicación sugeridos con los datos actuales.'),
      h('p.ayuda', 'Sugerencias automáticas basadas en guías vigentes. La indicación y la receta (plataforma registrada, Ley 27.553) son del médico tratante.')));
    const g = ev.glp1;
    if (g?.interacciones?.length || g?.obesogenos?.length) {
      bloques.push(tarjeta('Interacciones con lo que toma', { icono: 'pildora' },
        ...(g.interacciones || []).map((i) => h(`div.inter.inter--${i.severidad}`, h('div.inter-cab', chip(i.severidad, i.severidad === 'alta' ? 'peligro' : i.severidad === 'moderada' ? 'aviso' : 'info'), h('strong', i.farmaco)), h('p', i.efecto), h('p.inter-conducta', icono('flechaDer', { tam: 14 }), i.conducta))),
        ...(g.obesogenos || []).map((o) => aviso('info', `${o.farmaco}: ${o.texto}`))));
    }
    bloques.push(tarjeta('Efectos adversos posibles (agonistas de GLP-1 / GIP)', { icono: 'alerta' },
      h('div.ea', grupo('Muy frecuentes', g.efectos.muyFrecuentes, 'alto'), grupo('Frecuentes', g.efectos.frecuentes, 'medio'), grupo('Raros', g.efectos.raros, 'bajo'))));
  } else {
    const temas = pl.tratamiento.map((t) => t.titulo.replace(/ — .*/, ''));
    bloques.push(tarjeta('Para hablar con tu médico', { icono: 'estetoscopio', seccion: 'tratamiento' },
      temas.length ? lista(temas) : h('p', 'Con tus datos actuales no surgen cambios de medicación para conversar.'),
      h('p.ayuda', 'Son temas que la app detectó con tus datos. La decisión, el medicamento y la dosis los define tu médico.')));
    bloques.push(h('section.card.alarmas', h('header.card-cab', h('span.card-ico', icono('alerta', { tam: 18 })), h('h3', 'Consultá de inmediato si tenés…')), lista(GL.ALARMAS)));
  }

  bloques.push(tarjeta('Controles', { icono: 'calendario' },
    h('ol.linea-tiempo', ...pl.seguimiento.map((s) => h('li', h('strong', s.cuando), h('span', s.que))))));

  const nr = pl.noReconocido;
  const hayNR = nr.enfermedades.length || nr.analisis.length || nr.medicamentos.length;
  if (hayNR) {
    bloques.push(tarjeta('Datos que la app no reconoce', { icono: 'info', extra: chip('Revisar', 'aviso') },
      h('p.ayuda', med ? 'No entran en las reglas automáticas: revisalos vos (o pedí el análisis con IA, que sí los considera).' : 'Tu médico los va a revisar personalmente.'),
      nr.enfermedades.length ? h('p', h('strong', 'Enfermedades: '), nr.enfermedades.join(', ')) : null,
      nr.medicamentos.length ? h('p', h('strong', 'Medicamentos: '), nr.medicamentos.join(', ')) : null,
      nr.analisis.length ? h('p', h('strong', 'Análisis: '), nr.analisis.join(', ')) : null));
  }

  if (med) bloques.push(tarjetaIA(ev, pacUid, medico));

  return h('div.seccion',
    heroe('plan', 'Plan integral', med ? 'Alimentación, actividad, tratamiento, interacciones y seguimiento — calculado con todos los datos de la ficha' : 'Tu alimentación, tu actividad y tus controles, calculados con tus datos'),
    ...bloques);
}

const macro = (t, v, c) => h('div.macro', { style: { '--m': c } }, h('small', t), h('strong', v));
const dato = (t, v, ic) => h('div.plan-dato', icono(ic, { tam: 18 }), h('div', h('small', t), h('strong', v)));
const grupo = (t, l, tono) => h(`div.ea-grupo.ea-grupo--${tono}`, h('h4', t), h('ul', ...l.map(([n, d]) => h('li', h('strong', n), d ? h('small', d) : null))));

/* ---------- Análisis con IA (segunda opinión para el médico) ---------- */
function tarjetaIA(ev, pacUid, medico) {
  const B = backend();
  const cont = h('div.ia-resultado');
  const btn = h('button.btn.btn--primario.btn--brillo', { type: 'button' }, icono('chispa', { tam: 16 }), 'Analizar con IA');
  btn.onclick = async () => {
    btn.disabled = true;
    cont.replaceChildren(h('div.cargando', h('div.spinner'), h('span', 'La IA está revisando la ficha (puede tardar hasta un minuto)…')));
    try {
      const r = await analizarConIA(ev);
      cont.replaceChildren(resultadoIA(r, pacUid, medico));
    } catch (e) {
      cont.replaceChildren(aviso('aviso', e.code === 'ia/sin-servidor' ? 'El análisis con IA se activa al configurar el servidor (Apps Script con la clave de Anthropic). En la demo no está disponible.' : `No se pudo completar el análisis: ${e.message}`));
    } finally { btn.disabled = false; }
  };
  return tarjeta('Segunda opinión con IA', { icono: 'chispa', seccion: 'laboratorio' },
    h('p.ayuda', 'Envía a Claude (Anthropic) la ficha SIN nombre, DNI, correo ni fecha de nacimiento: edad, sexo, medidas, enfermedades (incluidas las no reconocidas), medicación y análisis. Devuelve una revisión con evidencia reciente. Es apoyo: no reemplaza tu criterio.'),
    B.modo === 'demo' ? aviso('info', 'En la demo no hay servidor de IA configurado.') : null,
    h('div.botones', btn), cont);
}

function resultadoIA(r, pacUid, medico) {
  const sec = (t, items) => (items?.length ? h('div', h('h4.sub', t), lista(items)) : null);
  const texto = [r.resumen, ...(r.tratamiento || []).map((t) => `${t.farmaco}: ${t.dosis}. ${t.titulacion} ${t.duracion}`)].join('\n');
  return h('div.ia-caja',
    h('p.ia-resumen', r.resumen),
    sec('Riesgos y hallazgos', r.hallazgos),
    r.tratamiento?.length ? h('div', h('h4.sub', 'Tratamiento propuesto'), ...r.tratamiento.map((t) => h('article.trat.trat--media',
      h('header', h('strong', t.farmaco)), lista([`Dosis: ${t.dosis}`, `Titulación: ${t.titulacion}`, `Duración: ${t.duracion}`, `Por qué: ${t.justificacion}`], '.lista--chica')))) : null,
    sec('Alimentación', r.alimentacion), sec('Actividad física', r.actividad), sec('Interacciones', r.interacciones),
    sec('Efectos adversos a vigilar', r.efectosAdversos), sec('Controles', r.controles), sec('Advertencias', r.advertencias),
    h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: async () => {
      try { await guardarNota(pacUid, `Análisis con IA (revisar):\n${texto}`, medico); toast('Guardado en Notas', 'ok'); } catch { toast('No se pudo guardar', 'error'); }
    } }, icono('editar', { tam: 16 }), 'Guardar en notas')),
    h('p.ayuda', `Generado por IA (${r.modelo || 'Claude'}). Verificá dosis y contraindicaciones con el prospecto vigente.`));
}

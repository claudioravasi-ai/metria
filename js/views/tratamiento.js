/* ============================================================
   Tratamiento con agonistas de GLP-1 / GIP
   - Médico: motor de decisión completo, proyección y armado del plan.
   - Paciente: ve el plan que su médico confirmó (dosis, calendario,
     cómo aplicarlo, olvidos, alarmas) y registra cómo se siente.
     Sin plan, solo orientación general SIN dosis (Ley 17.132).
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, toast, confirmar, fecha, fmt, fmt0, plegable, vacio, hoyISO } from '../core/ui.js';
import { simProyeccion } from '../ui/simuladores.js';
import { segmentado, campo, leerNum } from '../ui/campos.js';
import * as G from '../ui/graficos.js';
import * as GL from '../engine/glp1.js';
import { guardarPlan, registrarTolerancia, backend } from '../data/servicio.js';

const VEREDICTO = {
  indicado: { tono: 'ok', icono: 'okCirculo', color: '#16a34a' },
  precaucion: { tono: 'aviso', icono: 'alerta', color: '#f59e0b' },
  'no-indicado': { tono: 'info', icono: 'info', color: '#64748b' },
  contraindicado: { tono: 'peligro', icono: 'alerta', color: '#dc2626' },
  fuera: { tono: 'info', icono: 'info', color: '#64748b' },
  incompleto: { tono: 'info', icono: 'datos', color: '#64748b' },
};
const SEV = { alta: 'peligro', moderada: 'aviso', baja: 'info' };

function esquemaVisual(esq, hoy) {
  const vig = GL.pasoVigente(esq, hoy);
  return h('ol.titulacion', ...esq.map((p) => {
    const estado = vig && p.paso === vig.paso ? 'actual' : p.desde > hoy ? 'futuro' : 'hecho';
    return h(`li.tit-paso.tit-paso--${estado}`,
      h('span.tit-punto', estado === 'hecho' ? icono('ok', { tam: 14 }) : String(p.paso)),
      h('div.tit-txt', h('strong.num', `${GL.fmtDosis(p.dosis)} ${p.unidad}`), h('small', p.frecuencia === 'semanal' ? 'por semana' : 'por día')),
      h('div.tit-fechas', h('small', p.mantenimiento ? `Desde ${fecha(p.desde)}` : `${fecha(p.desde)} → ${fecha(p.hasta)}`), h('em', p.mantenimiento ? 'Mantenimiento' : `Semanas ${p.semanaDesde}–${p.semanaHasta}`)),
      estado === 'actual' ? chip('Ahora', 'ok') : null);
  }));
}

/* ======================= MÉDICO ======================= */
export function panelGlp1Medico({ ev, plan, tolerancia, pacUid, medico, paciente }) {
  const g = ev.glp1;
  const V = VEREDICTO[g.veredicto] || VEREDICTO.incompleto;
  const out = [heroe('tratamiento', 'Tratamiento GLP-1 / GIP', 'Apoyo a la decisión: indicación, opciones, interacciones, titulación y seguimiento')];

  out.push(h('section.card.veredicto', { style: { '--cat': V.color } },
    h('div.veredicto-cab', h('div.veredicto-ico', icono(V.icono, { tam: 30 })),
      h('div', h('small', 'Recomendación del motor'), h('h2', g.titulo), h('p', g.resumen))),
    g.indicaciones?.length ? h('div.veredicto-bloque', h('h4', 'Indicaciones que cumple'), h('ul.lista', ...g.indicaciones.map((t) => h('li', t)))) : null,
    g.comorbilidades?.length ? h('div.chips', ...g.comorbilidades.map((c) => chip(c, 'info'))) : null,
    g.yaRecibe ? aviso('aviso', 'Ya recibe un agonista de GLP-1 / GIP según su medicación: evaluar respuesta y tolerancia antes de cambiar.') : null,
    h('p.ayuda', `Motor revisado al ${fecha(g.fecha)}. Es apoyo a la decisión: la indicación y la receta (por plataforma registrada, Ley 27.553) son responsabilidad del médico tratante. Verificar siempre el prospecto vigente aprobado por ANMAT.`)));

  const ci = g.contraindicaciones;
  if (ci && (ci.absolutas.length || ci.relativas.length)) {
    out.push(tarjeta('Contraindicaciones y precauciones', { icono: 'alerta' },
      h('div.ci-lista',
        ...ci.absolutas.map((c) => h('div.ci.ci--abs', h('span.ci-tipo', 'Contraindicación'), h('strong', c.texto), h('p', c.conducta))),
        ...ci.relativas.map((c) => h('div.ci.ci--rel', h('span.ci-tipo', 'Precaución'), h('strong', c.texto), h('p', c.conducta))))));
  }
  if (g.interacciones?.length || g.obesogenos?.length) {
    out.push(tarjeta('Interacciones con su medicación', { icono: 'pildora' },
      g.interacciones.length ? h('div.inter-lista', ...g.interacciones.map((i) => h(`div.inter.inter--${i.severidad}`,
        h('div.inter-cab', chip(i.severidad === 'alta' ? 'Importante' : i.severidad === 'moderada' ? 'Moderada' : 'Menor', SEV[i.severidad]), h('strong', i.farmaco), h('small', i.clase)),
        h('p', i.efecto), h('p.inter-conducta', icono('flechaDer', { tam: 14 }), i.conducta)))) : h('p.ayuda', 'Sin interacciones relevantes con la medicación cargada.'),
      g.obesogenos?.length ? h('div', h('h4.sub', 'Fármacos que favorecen el aumento de peso'), h('ul.lista', ...g.obesogenos.map((o) => h('li', h('strong', o.farmaco + ': '), o.texto)))) : null));
  }

  if (g.opciones?.length) {
    const maxP = Math.max(...g.opciones.map((o) => o.puntaje), 1);
    out.push(tarjeta('Opciones ordenadas para este paciente', { icono: 'estrella' },
      h('div.opciones', ...g.opciones.map((o, i) => {
        const f = o.farmaco;
        return h(`article.opcion${i === 0 ? '.opcion--top' : ''}`, { style: { '--chip': f.color } },
          h('div.opcion-cab',
            h('span.opcion-rank', `${i + 1}`),
            h('div', h('h4', `${f.generico} · ${f.comercial}`), h('small', `${f.via} · ${f.disponible}`)),
            i === 0 ? chip('Sugerida', 'ok', 'estrella') : null),
          h('div.opcion-barra', h('div', { style: { width: `${Math.max(8, (o.puntaje / maxP) * 100)}%` } })),
          h('div.opcion-datos',
            h('div', h('small', 'Descenso esperado (72 sem)'), h('strong.num', `−${fmt(o.perdida72, 1)} %`), o.pesoFinal ? h('em', `≈ ${fmt(o.pesoFinal, 1)} kg`) : null),
            h('div', h('small', 'Titulación'), h('strong', f.pasos.map((p) => GL.fmtDosis(p.dosis)).join(' → ') + ` ${f.unidad}`), h('em', f.mantenimiento))),
          o.porque.length ? h('ul.lista.lista--chica.lista--ok', ...o.porque.map((t) => h('li', t))) : null,
          o.cuidado.length ? h('ul.lista.lista--chica.lista--aviso', ...o.cuidado.map((t) => h('li', t))) : null,
          h('p.ayuda', f.eficacia.texto),
          h('button.btn.btn--suave', { type: 'button', onclick: () => { elegirEnPlan(f.id); document.querySelector('.plan-armado')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, icono('jeringa', { tam: 16 }), 'Usar en el plan'));
      })),
      g.objetivo ? aviso('info', `Objetivo sugerido: −5 % a los 3–4 meses y −${g.objetivo.pct} % al año${g.objetivo.peso ? ` (≈ ${fmt(g.objetivo.peso, 1)} kg)` : ''}.`) : null));
    out.push(tarjeta('Proyección de peso interactiva', { icono: 'grafico' },
      simProyeccion({ peso: +ev.antropo.peso, talla: +ev.antropo.talla, dm2: !!ev.pat.dm2, opciones: g.opciones, planId: plan?.farmaco, inicio: plan?.inicio }).el));
  }

  /* --- Armado del plan --- */
  let elegirEnPlan = () => {};
  if (g.opciones?.length || plan) {
    const ids = g.opciones?.length ? g.opciones.map((o) => o.farmaco.id) : GL.FARMACOS.map((f) => f.id);
    const st = { farmaco: plan?.farmaco || ids[0], inicio: plan?.inicio || hoyISO(backend().ahora()), notas: plan?.notas || '' };
    const vista = h('div.plan-vista');
    const sel = h('select', { 'aria-label': 'Fármaco' }, ...GL.FARMACOS.filter((f) => ids.includes(f.id) || f.id === plan?.farmaco).map((f) => h('option', { value: f.id, selected: f.id === st.farmaco }, `${f.generico} (${f.comercial})`)));
    const ini = h('input', { type: 'date', value: st.inicio, 'aria-label': 'Fecha de inicio' });
    const notas = h('textarea', { rows: 3, maxlength: 600, 'aria-label': 'Indicaciones para el paciente', placeholder: 'Indicaciones para el paciente: día de aplicación, alimentación, cuándo consultar…' }, st.notas);
    const pintar = () => {
      const f = GL.farmaco(st.farmaco);
      vista.replaceChildren(esquemaVisual(GL.esquema(st.farmaco, st.inicio), hoyISO(backend().ahora())),
        h('div.grid-2.grid-2--compacto', h('div', h('h4.sub', 'Cómo se aplica'), h('p', f.administracion)), h('div', h('h4.sub', 'Si se olvida una dosis'), h('p', f.olvido))),
        h('p.ayuda', f.respuesta), f.novedad ? h('p.ayuda', f.novedad) : null);
    };
    sel.onchange = () => { st.farmaco = sel.value; pintar(); };
    ini.onchange = () => { st.inicio = ini.value; pintar(); };
    notas.oninput = () => { st.notas = notas.value; };
    elegirEnPlan = (id) => { if ([...sel.options].some((o) => o.value === id)) { sel.value = id; st.farmaco = id; pintar(); } };
    pintar();
    const btn = h('button.btn.btn--primario.btn--grande', { type: 'button' }, icono('ok', { tam: 18 }), plan ? 'Actualizar plan' : 'Confirmar e indicar el plan');
    btn.onclick = async () => {
      if (g.veredicto === 'contraindicado' && !(await confirmar({ titulo: 'Hay contraindicaciones', texto: 'El motor detectó contraindicaciones. ¿Confirmás igual el plan bajo tu responsabilidad?', si: 'Confirmar igual', peligro: true }))) return;
      if (!(await confirmar({ titulo: 'Indicar plan', icono: 'jeringa', color: '#2563eb', si: 'Indicar', texto: `El paciente verá en su app ${GL.farmaco(st.farmaco).generico} (${GL.farmaco(st.farmaco).comercial}) con el calendario de dosis desde el ${fecha(st.inicio)}. Recordá emitir la receta por una plataforma registrada.` }))) return;
      btn.disabled = true;
      try { await guardarPlan(pacUid, { farmaco: st.farmaco, inicio: st.inicio, notas: st.notas.slice(0, 600), estado: 'activo' }, medico); toast('Plan indicado. El paciente ya lo ve.', 'ok'); }
      catch (e) { console.error(e); toast('No se pudo guardar el plan.', 'error'); }
      finally { btn.disabled = false; }
    };
    const acciones = h('div.plan-acc', btn,
      plan && plan.estado === 'activo' ? h('button.btn.btn--suave', { type: 'button', onclick: async () => {
        if (await confirmar({ titulo: 'Suspender tratamiento', texto: 'El plan queda como suspendido en la app del paciente.', si: 'Suspender', peligro: true })) {
          await guardarPlan(pacUid, { ...plan, estado: 'suspendido', suspendido: hoyISO(backend().ahora()) }, medico); toast('Plan suspendido', 'ok');
        }
      } }, 'Suspender') : null);
    out.push(tarjeta(plan ? `Plan actual (${plan.estado})` : 'Armar el plan', { icono: 'jeringa', clase: 'plan-armado' },
      plan ? aviso(plan.estado === 'activo' ? 'ok' : 'info', `Indicado por ${plan.indicadoPor?.nombre || '—'} (${plan.indicadoPor?.matricula || ''}) el ${fecha(plan.fecha)}.`) : null,
      h('div.grid-form', h('div.campo', h('label', 'Fármaco'), sel), h('div.campo', h('label', 'Fecha de inicio'), ini), h('div.campo.campo--ancho', h('label', 'Indicaciones para el paciente'), notas)),
      vista, acciones));
  }

  if (tolerancia && Object.keys(tolerancia).length) out.push(tarjeta('Cómo se siente el paciente (registro semanal)', { icono: 'pulso' }, tablaTolerancia(tolerancia)));

  if (g.monitoreo) out.push(tarjeta('Plan de seguimiento', { icono: 'calendario' }, h('ul.lista', ...g.monitoreo.map((t) => h('li', t)))));
  out.push(tarjeta('Efectos adversos', { icono: 'alerta' }, efectosAdversos(g.efectos)));
  if (g.alternativas?.length) out.push(tarjeta('Alternativas y medidas de base', { icono: 'objetivo' }, h('ul.lista', ...g.alternativas.map((t) => h('li', t)))));
  out.push(plegable('Novedades internacionales (no comercializadas en Argentina a la fecha)', h('ul.lista', ...GL.NOVEDADES.map((n) => h('li', h('strong', n.nombre), ` — ${n.estado}. ${n.dato}`)))));
  return h('div.seccion', ...out);
}

function efectosAdversos(e) {
  const grupo = (t, l, tono) => h(`div.ea-grupo.ea-grupo--${tono}`, h('h4', t), h('ul', ...l.map(([n, d]) => h('li', h('strong', n), d ? h('small', d) : null))));
  return h('div', h('div.ea', grupo('Muy frecuentes (≥ 10 %)', e.muyFrecuentes, 'alto'), grupo('Frecuentes (1–10 %)', e.frecuentes, 'medio'), grupo('Poco frecuentes o raros', e.raros, 'bajo')),
    h('ul.lista.lista--chica', ...e.otros.map((t) => h('li', t))));
}

function tablaTolerancia(tol) {
  const filas = Object.values(tol).sort((a, b) => a.fecha - b.fecha);
  const sintomas = [['nauseas', 'Náuseas'], ['vomitos', 'Vómitos'], ['diarrea', 'Diarrea'], ['constipacion', 'Constipación'], ['dolor', 'Dolor abdominal']];
  const nivel = ['—', 'Leve', 'Moderado', 'Intenso'];
  return h('div.tabla-scroll', h('table.tabla',
    h('thead', h('tr', h('th', 'Fecha'), h('th', 'Sem.'), ...sintomas.map(([, t]) => h('th', t)), h('th', 'Peso'))),
    h('tbody', ...filas.reverse().map((f) => h('tr',
      h('td', fecha(f.fecha)), h('td', f.semana ?? '—'),
      ...sintomas.map(([k]) => h('td', h(`span.nivel.nivel--${f[k] || 0}`, nivel[f[k] || 0]))),
      h('td.num', f.peso ? `${fmt(f.peso, 1)} kg` : '—'))))));
}

/* ======================= PACIENTE ======================= */
export function vistaTratamientoPaciente({ ev, plan, tolerancia, uid }) {
  const g = ev.glp1;
  const hoy = hoyISO(backend().ahora());
  if (plan && plan.estado === 'activo') {
    const f = GL.farmaco(plan.farmaco);
    const esq = GL.esquema(plan.farmaco, plan.inicio);
    const vig = GL.pasoVigente(esq, hoy);
    const sig = vig ? esq[vig.paso] : esq[0];
    const semana = Math.max(0, Math.floor((new Date(hoy) - new Date(plan.inicio)) / 604800000) + 1);
    const out = [heroe('tratamiento', 'Mi tratamiento', `${f.generico} (${f.comercial}) · indicado por ${plan.indicadoPor?.nombre || 'tu médico'}`)];
    out.push(h('section.card.dosis-hoy',
      h('div.dosis-hoy-cab',
        h('div', h('small', plan.inicio > hoy ? 'Empezás el' : 'Tu dosis actual'), h('strong.num.dosis-num', plan.inicio > hoy ? fecha(plan.inicio) : `${GL.fmtDosis(vig.dosis)} ${f.unidad}`), h('span', f.frecuencia === 'semanal' ? 'una vez por semana' : 'una vez por día')),
        h('div.dosis-semana', h('small', 'Semana'), h('strong.num', String(semana)))),
      sig && vig && !vig.mantenimiento ? aviso('info', `Próximo paso: ${GL.fmtDosis(sig.dosis)} ${f.unidad} desde el ${fecha(sig.desde)}, solo si toleraste bien la dosis actual. Si tenés náuseas fuertes, avisá a tu médico antes de subir.`) : vig?.mantenimiento ? aviso('ok', 'Ya estás en la dosis de mantenimiento.') : null,
      plan.notas ? h('div.nota-medico', icono('estetoscopio', { tam: 18 }), h('div', h('small', 'Indicaciones de tu médico'), h('p', plan.notas))) : null));
    out.push(tarjeta('Mi calendario de dosis', { icono: 'calendario' }, esquemaVisual(esq, hoy)));
    out.push(h('div.grid-2',
      tarjeta('Cómo aplicarlo', { icono: 'jeringa' }, h('p', f.administracion), h('p.ayuda', 'Guardá las lapiceras sin abrir en la heladera (2–8 °C), nunca en el congelador.')),
      tarjeta('Si me olvido una dosis', { icono: 'reloj' }, h('p', f.olvido))));
    out.push(tarjeta('¿Cómo te sentiste esta semana?', { icono: 'pulso' }, formTolerancia(uid, semana, ev.antropo.peso), tolerancia ? tablaTolerancia(tolerancia) : null));
    out.push(tarjeta('Para sentirte mejor', { icono: 'chispa' }, h('ul.lista',
      h('li', 'Comé porciones chicas, despacio, y frená apenas te sientas lleno/a.'),
      h('li', 'Evitá frituras, comidas muy grasas y el alcohol: empeoran las náuseas.'),
      h('li', 'Tomá 1,5 a 2 litros de agua por día (más si tenés diarrea o vómitos).'),
      h('li', 'Priorizá proteínas en cada comida y hacé ejercicios de fuerza 2–3 veces por semana para cuidar los músculos.'),
      h('li', 'Antes de una cirugía, endoscopía o sedación, avisá que usás este medicamento.'))));
    out.push(h('section.card.alarmas', h('header.card-cab', h('span.card-ico', icono('alerta', { tam: 18 })), h('h3', 'Consultá de inmediato si tenés…')), h('ul.lista', ...GL.ALARMAS.map((t) => h('li', t)))));
    out.push(tarjeta('Qué se puede esperar', { icono: 'grafico' }, simProyeccion({ peso: +ev.antropo.peso, talla: +ev.antropo.talla, dm2: !!ev.pat.dm2, opciones: [{ farmaco: f }], planId: f.id, inicio: plan.inicio }).el));
    return h('div.seccion', ...out);
  }

  // Sin plan activo: orientación general, sin dosis
  const V = VEREDICTO[g.veredicto] || VEREDICTO.incompleto;
  const textos = {
    indicado: ['Podrías ser candidato/a', 'Según tus datos, podrías cumplir criterios para un tratamiento con medicación para el peso. La decisión, el medicamento y la dosis los define tu médico en la consulta.'],
    precaucion: ['Podrías ser candidato/a, con cuidados', 'Según tus datos podrías cumplir criterios, pero hay antecedentes que tu médico tiene que evaluar con atención antes de decidir.'],
    'no-indicado': ['Hoy no hace falta medicación', 'Con tus datos actuales no hay indicación de medicamentos para bajar de peso. Estos fármacos no deben usarse con fines estéticos: la alimentación y la actividad física son la mejor herramienta.'],
    contraindicado: ['Estos medicamentos no son seguros para vos', 'Hay antecedentes que hacen que este tipo de medicación no sea segura en tu caso. Hablalo con tu médico: hay otras opciones.'],
    fuera: ['Consultá con un equipo pediátrico', 'La evaluación en menores de 18 años la hace un equipo especializado.'],
    incompleto: ['Completá tus datos', 'Necesitamos al menos tu peso, talla y fecha de nacimiento para orientarte.'],
  }[g.veredicto] || ['', ''];
  const contale = [
    ...(g.contraindicaciones?.absolutas || []), ...(g.contraindicaciones?.relativas || []),
  ].map((c) => c.texto);
  return h('div.seccion',
    heroe('tratamiento', 'Tratamiento', 'Orientación sobre medicación para el peso'),
    h('section.card.veredicto', { style: { '--cat': V.color } },
      h('div.veredicto-cab', h('div.veredicto-ico', icono(V.icono, { tam: 30 })), h('div', h('small', 'Orientación según tus datos'), h('h2', textos[0]), h('p', textos[1])))),
    contale.length ? tarjeta('Contale a tu médico', { icono: 'estetoscopio' }, h('ul.lista', ...contale.map((t) => h('li', t)))) : null,
    g.interacciones?.length ? tarjeta('Tu medicación a revisar', { icono: 'pildora' }, h('ul.lista', ...[...new Set(g.interacciones.map((i) => i.farmaco))].map((t) => h('li', t))), h('p.ayuda', 'Algunos de tus medicamentos pueden necesitar ajustes si empezás un tratamiento. Tu médico lo va a revisar.')) : null,
    tarjeta('Importante', { icono: 'escudo' }, h('ul.lista',
      h('li', 'Estos medicamentos se venden bajo receta. No los uses sin indicación médica.'),
      h('li', 'Comprá solo en farmacias habilitadas: hubo alertas por productos falsificados y preparaciones de origen dudoso.'),
      h('li', 'Ningún medicamento reemplaza la alimentación saludable, el movimiento y el descanso.'))),
    plan && plan.estado !== 'activo' ? aviso('info', `Tu plan con ${GL.farmaco(plan.farmaco)?.generico || 'medicación'} está ${plan.estado}.`) : null);
}

function formTolerancia(uid, semana, peso) {
  const st = { nauseas: 0, vomitos: 0, diarrea: 0, constipacion: 0, dolor: 0, peso: peso ? +peso : null };
  const filas = [['nauseas', 'Náuseas'], ['vomitos', 'Vómitos'], ['diarrea', 'Diarrea'], ['constipacion', 'Constipación'], ['dolor', 'Dolor de panza']];
  const pesoCampo = campo('Peso de hoy (opcional)', { type: 'number', value: st.peso ?? '' }, { sufijo: 'kg' });
  pesoCampo.querySelector('input').oninput = (e) => { st.peso = leerNum(e.target.value); };
  const btn = h('button.btn.btn--primario', { type: 'button' }, icono('ok', { tam: 16 }), 'Enviar a mi médico');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      await registrarTolerancia(uid, { semana, ...st });
      toast('Gracias. Tu médico ya lo puede ver.', 'ok');
      if (st.dolor >= 3 || st.vomitos >= 3) toast('Dolor o vómitos intensos: consultá hoy mismo a tu médico o a una guardia.', 'error', 9000);
    } catch { toast('No se pudo enviar', 'error'); }
    finally { btn.disabled = false; }
  };
  return h('div.tolerancia',
    ...filas.map(([k, t]) => h('div.tol-fila', h('span', t), segmentado([0, 1, 2, 3].map((v) => ({ valor: String(v), texto: ['Nada', 'Leve', 'Moderado', 'Intenso'][v] })), '0', (v) => { st[k] = +v; }, { etiqueta: t, pequeno: true }))),
    h('div.tol-pie', pesoCampo, btn));
}

export { vacio, fmt0, G };

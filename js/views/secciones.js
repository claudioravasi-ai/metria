/* ============================================================
   Secciones clínicas compartidas por paciente y médico.
   rol: 'paciente' (lenguaje llano) | 'medico' (detalle técnico)
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, fmt, fmt0, fecha, vacio, plegable } from '../core/ui.js';
import * as G from '../ui/graficos.js';
import { simMetabolismo, simCuerpo, simRiesgo } from '../ui/simuladores.js';
import * as A from '../engine/anthro.js';

const TONO = { ok: 'ok', limite: 'aviso', alto: 'peligro', bajo: 'info' };

function faltanDatos(lista, irDatos) {
  return tarjeta(null, { clase: 'card--faltan' },
    vacio('datos', 'Faltan algunos datos', `Para este cálculo necesitamos: ${lista.join(', ')}.`,
      irDatos ? h('button.btn.btn--primario', { type: 'button', onclick: irDatos }, icono('editar', { tam: 16 }), 'Completar mis datos') : null));
}

/* ---------- Metabolismo ---------- */
export function seccionMetabolismo(ev, { rol, irDatos } = {}) {
  const an = ev.antropo;
  const tiene = an.peso && an.talla && ev.edad;
  const sim = simMetabolismo(tiene ? { peso: +an.peso, talla: +an.talla, edad: Math.max(18, ev.edad), sexo: ev.sexo, actividad: ev.habitos.actividad || 'sedentario', grasa: ev.comp?.grasa?.medida || null } : {});
  return h('div.seccion',
    heroe('metabolismo', 'Metabolismo', rol === 'medico' ? 'Tasa metabólica basal y gasto energético total' : 'Cuánta energía usa tu cuerpo por día. Mové los controles y mirá cómo cambia en vivo.'),
    tiene ? null : faltanDatos(['peso', 'talla', 'fecha de nacimiento'], irDatos),
    tarjeta(tiene ? 'Tu simulador' : 'Simulador', { icono: 'llama', extra: tiene ? chip('Arranca con tus datos', 'info') : null }, sim.el),
    tarjeta('Cómo se calcula', { icono: 'info' },
      h('ul.lista',
        h('li', h('strong', 'Metabolismo basal (TMB): '), 'la energía que gasta tu cuerpo en reposo para respirar, latir y mantener la temperatura. Se calcula con la ecuación de Mifflin-St Jeor, la más precisa en adultos con y sin obesidad.'),
        h('li', h('strong', 'Gasto total (GET): '), 'el basal multiplicado por tu nivel de actividad (1,2 a 1,9). Incluye la digestión (~10 %).'),
        h('li', h('strong', 'Para bajar de peso: '), 'un déficit moderado de 500 kcal/día suele dar ~0,5 kg por semana. No conviene comer por debajo del basal sin supervisión.'),
        rol === 'medico' && ev.ener ? h('li', h('strong', 'Detalle: '), `Mifflin ${fmt0(ev.ener.mifflin)} · Harris-Benedict ${fmt0(ev.ener.harris)}${ev.ener.katch ? ` · Katch-McArdle ${fmt0(ev.ener.katch)}` : ''} kcal/día. Factor de actividad ${fmt(ev.ener.factor, 3)}.`) : null)));
}

/* ---------- Cuerpo ---------- */
export function seccionCuerpo(ev, { rol, mediciones = {}, irDatos } = {}) {
  const an = ev.antropo;
  const tiene = an.peso && an.talla;
  const sim = simCuerpo(tiene ? { peso: +an.peso, talla: +an.talla, sexo: ev.sexo, cintura: an.cintura ? +an.cintura : null, edad: ev.edad || 40 } : {});
  const hist = Object.values(mediciones || {}).filter((m) => m.peso).sort((a, b) => a.fecha - b.fecha);
  let grafHist = null;
  if (hist.length >= 2) {
    const ch = G.lineas({
      alto: 240, formatoY: (v) => fmt(v, 0),
      ejeX: { ticks: hist.length > 6 ? [hist[0].fecha, hist[Math.floor(hist.length / 2)].fecha, hist[hist.length - 1].fecha] : hist.map((m) => m.fecha) },
      formatoX: (t) => new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      tooltip: (x, vals) => h('div', h('strong', fecha(vals[0]?.punto.x)), ...vals.map((v) => h('div.tip-fila', h('i', { style: { background: v.serie.color } }), h('span', v.serie.nombre), h('b.num', `${fmt(v.punto.y, 1)} ${v.serie.id === 'peso' ? 'kg' : 'cm'}`)))),
    });
    const r = A.rangoPesoSaludable(+an.talla);
    queueMicrotask(() => ch.set([{ id: 'peso', nombre: 'Peso', color: 'var(--c1)', area: true, datos: hist.map((m) => ({ x: m.fecha, y: m.peso })) }]));
    const dif = hist[hist.length - 1].peso - hist[0].peso;
    const pct = (dif / hist[0].peso) * 100;
    grafHist = tarjeta('Tu evolución', { icono: 'grafico', extra: chip(`${dif <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dif), 1)} kg (${fmt(Math.abs(pct), 1)} %)`, dif <= 0 ? 'ok' : 'aviso') },
      ch.el, r ? h('small.ayuda', `Rango saludable para tu talla: ${fmt(r.min, 1)} a ${fmt(r.max, 1)} kg.`) : null);
  }
  const c = ev.comp;
  const det = rol === 'medico' && c ? tarjeta('Estadificación de la obesidad', { icono: 'objetivo' },
    h('div.grid-2.grid-2--compacto',
      h('div.dato-grande', h('small', 'Comisión Lancet 2025'), h('strong', ev.lancet?.nombre || '—'),
        ev.lancet?.confirmaciones?.length ? h('p.ayuda', `Exceso de adiposidad confirmado por: ${ev.lancet.confirmaciones.join(', ').toLowerCase()}.`) : null,
        ev.lancet?.criterios?.length ? h('ul.lista.lista--chica', ...ev.lancet.criterios.map((t) => h('li', t))) : null),
      h('div.dato-grande', h('small', 'Edmonton (EOSS)'), h('strong', `Estadio ${ev.eoss.estadio}`),
        h('p.ayuda', ev.eoss.motivos.join(' · ') || 'Sin factores de riesgo ni síntomas atribuibles'))),
    h('p.ayuda', 'Estimaciones automáticas a partir de la ficha: confirmar en la consulta.')) : null;
  return h('div.seccion',
    heroe('cuerpo', 'Cuerpo', rol === 'medico' ? 'Antropometría, composición estimada y estadificación' : 'Tu índice de masa corporal y tu silueta. Probá cambiar el peso o la cintura.'),
    tiene ? null : faltanDatos(['peso', 'talla'], irDatos),
    tarjeta('Índice de masa corporal', { icono: 'cuerpo' }, sim.el),
    grafHist,
    c ? tarjeta('Indicadores de grasa abdominal', { icono: 'cinta' },
      h('div.grid-3',
        indicador('Cintura', an.cintura ? `${an.cintura} cm` : '—', c.cintura ? (c.cintura.muyElevado ? 'peligro' : c.cintura.elevado ? 'aviso' : 'ok') : null, `Riesgo desde ${c.cintura?.alad ?? (ev.sexo === 'F' ? 88 : 94)} cm (ALAD)`),
        indicador('Cintura / cadera', c.icc ? fmt(c.icc.valor, 2) : '—', c.icc ? (c.icc.elevado ? 'aviso' : 'ok') : null, ev.sexo === 'F' ? 'Elevado ≥ 0,85' : 'Elevado ≥ 0,90'),
        indicador('Cintura / talla', c.ict ? fmt(c.ict.valor, 2) : '—', c.ict ? { normal: 'ok', aumentado: 'aviso', alto: 'peligro' }[c.ict.nivel] : null, 'Mantener por debajo de 0,5'))) : null,
    det);
}

function indicador(t, v, tono, sub) {
  return h(`div.indicador${tono ? '.indicador--' + tono : ''}`, h('small', t), h('strong.num', v), h('em', sub));
}

/* ---------- Corazón ---------- */
export function seccionCorazon(ev, { rol, irDatos } = {}) {
  const p = ev.prevent;
  const cat = ev.categoria;
  const med = rol === 'medico';
  const bloques = [];
  if (cat) {
    bloques.push(h('section.card.card--destacada', { style: { '--cat': cat.color } },
      h('div.riesgo-cab',
        h('div.riesgo-ico', icono('corazon', { tam: 30 })),
        h('div', h('small', med ? 'Categoría de riesgo cardiovascular' : 'Tu riesgo cardiovascular'), h('h2', cat.nombre),
          h('p', ...cat.motivos.map((m, i) => [i ? ' · ' : '', m])))),
      cat.sugerirSubir ? aviso('aviso', `Hay ${ev.potenciadores.length} potenciadores de riesgo: considerar la categoría superior.`) : null,
      ev.ldlObjetivo && Number.isFinite(ev.der.ldl) ? h('div.ldl-meta',
        h('div', h('small', 'LDL actual'), h('strong.num', `${fmt0(ev.der.ldl)} mg/dL`)),
        h('div.ldl-flecha', icono('flechaDer')),
        h('div', h('small', 'Objetivo para tu riesgo'), h('strong.num', `< ${ev.ldlObjetivo} mg/dL`)),
        h('div', ev.der.ldl < ev.ldlObjetivo ? chip('En objetivo', 'ok', 'ok') : chip(`Faltan ${fmt0(ev.der.ldl - ev.ldlObjetivo)} mg/dL`, 'peligro'))) : null));
  }
  if (p.ok) {
    bloques.push(tarjeta(med ? 'Simulador PREVENT (AHA 2023): ¿y si…?' : '¿Y si cambiás algo? Simulalo en vivo', { icono: 'pulso' }, simRiesgo(ev.preventIn).el,
      med && ev.framingham ? h('p.ayuda', `Referencia: Framingham 2008 (ECV general a 10 años) ${fmt(ev.framingham, 1)} %. PREVENT está calibrada sin raza, incluye filtrado glomerular y no sobreestima el riesgo como las Pooled Cohort.`) : null,
      cat?.fuente === 'clinica' ? aviso('info', med ? 'Prevención secundaria o equivalente: la categoría la define la clínica; PREVENT se muestra solo como referencia.' : 'Por tus antecedentes, tu riesgo ya se considera alto: el simulador sirve para ver cuánto ayuda cada cambio.') : null));
  } else {
    bloques.push(faltanDatos((p.faltan || []).map((k) => ({ edad: 'fecha de nacimiento', ct: 'colesterol total', hdl: 'colesterol HDL', pas: 'presión sistólica', tfg: 'creatinina' }[k] || k)), irDatos));
  }
  const pa = ev.pa;
  const sm = ev.sm;
  bloques.push(h('div.grid-2',
    tarjeta('Presión arterial', { icono: 'pulso' },
      pa ? h('div.pa', h('strong.num.pa-valor', `${ev.vitales.pas}/${ev.vitales.pad}`), h('span', 'mmHg'), chip(pa.nombre, pa.id === 'normal' ? 'ok' : pa.id === 'elevada' ? 'aviso' : 'peligro')) : h('p.ayuda', 'Sin registro de presión.'),
      pa && pa.id !== 'normal' ? h('p.ayuda', med
        ? `Guía AHA/ACC 2025: objetivo < 130/80. En etapa 1, tratar con fármacos si PREVENT ECV total ≥ 7,5 % o si hay diabetes o ERC${p.ok ? ` (PREVENT ${fmt(p.cvd10, 1)} %)` : ''}.`
        : 'Conviene controlarla en casa, reducir la sal y consultarlo con tu médico. El objetivo general es menos de 130/80.') : null),
    tarjeta('Síndrome metabólico', { icono: 'objetivo', extra: chip(sm.cumple ? 'Presente' : sm.sinDato > 2 ? 'Faltan datos' : 'No cumple', sm.cumple ? 'peligro' : 'ok') },
      h('ul.criterios', ...sm.criterios.map((c) => h(`li.criterio.criterio--${c.ok === null ? 'nd' : c.ok ? 'si' : 'no'}`, icono(c.ok === null ? 'puntos' : c.ok ? 'alerta' : 'ok', { tam: 16 }), c.nombre))),
      h('small.ayuda', `${sm.n} de 5 criterios (se necesitan 3).`))));
  if (ev.potenciadores.length) {
    bloques.push(tarjeta(med ? 'Potenciadores de riesgo' : 'Otros factores que suman', { icono: 'alerta' }, h('ul.lista', ...ev.potenciadores.map((t) => h('li', t)))));
  }
  if (ev.findrisc) {
    const f = ev.findrisc;
    bloques.push(tarjeta(med ? 'FINDRISC: riesgo de diabetes tipo 2 a 10 años' : 'Riesgo de diabetes', { icono: 'gota', extra: chip(`${f.puntos} puntos`, ['bajo', 'leve'].includes(f.id) ? 'ok' : f.id === 'moderado' ? 'aviso' : 'peligro') },
      h('p', h('strong', f.nombre), ` — aproximadamente ${f.riesgo} de probabilidad en 10 años.`),
      f.incompleto ? h('small.ayuda', 'Sin cintura cargada: el puntaje puede estar subestimado.') : null));
  }
  return h('div.seccion',
    heroe('corazon', 'Corazón', med ? 'PREVENT (AHA 2023) · categorías clínicas · presión · síndrome metabólico' : 'Tu riesgo de infarto, ACV o insuficiencia cardíaca, y cuánto podés bajarlo.'),
    ...bloques,
    med ? null : h('p.ayuda.centro', 'Estos cálculos son orientativos y no reemplazan la evaluación de tu médico.'));
}

/* ---------- Laboratorio ---------- */
export function seccionLaboratorio(ev, { rol, irDatos } = {}) {
  const filas = ev.labsInt;
  const med = rol === 'medico';
  if (!filas.length) {
    return h('div.seccion', heroe('laboratorio', 'Laboratorio', 'Resultados e índices derivados'), faltanDatos(['resultados de laboratorio'], irDatos));
  }
  const grupos = [
    ['Glucosa e insulina', ['glucosa', 'hba1c', 'insulina', 'homa', 'tyg']],
    ['Lípidos', ['ct', 'hdl', 'ldl', 'nohdl', 'tg', 'tghdl', 'lpa', 'apob']],
    ['Riñón', ['creatinina', 'tfg', 'racu', 'urico']],
    ['Hígado', ['ast', 'alt', 'fib4']],
    ['Otros', ['pcr', 'tsh']],
  ];
  return h('div.seccion',
    heroe('laboratorio', 'Laboratorio', med ? 'Valores, índices derivados y su interpretación' : 'Tus análisis explicados en simple.',
      ev.labs.fecha ? chip(`Análisis del ${fecha(ev.labs.fecha)}`, 'info', 'calendario') : null),
    ev.glucemia ? aviso(ev.glucemia.id === 'normal' ? 'ok' : ev.glucemia.id === 'pre' ? 'aviso' : 'peligro', h('span', h('strong', 'Estado glucémico: '), ev.glucemia.nombre)) : null,
    ...grupos.map(([t, ids]) => {
      const fs = filas.filter((f) => ids.includes(f.id));
      if (!fs.length) return null;
      return tarjeta(t, { icono: 'matraz' }, h('div.labs', ...fs.map((f) => h(`div.lab.lab--${TONO[f.estado] || 'ok'}`,
        h('div.lab-nombre', h('strong', f.nombre), h('small', f.texto)),
        h('div.lab-valor', h('strong.num', fmt(f.valor, f.valor < 10 && f.id !== 'creatinina' ? 2 : f.valor < 100 ? 1 : 0)), h('span', f.unidad)),
        h('div.lab-ref', h('small', 'Referencia'), h('span', f.ref))))));
    }),
    med && ev.der ? plegable('Fórmulas usadas', h('ul.lista.lista--chica',
      h('li', 'Filtrado glomerular: CKD-EPI 2021 sin raza (Inker, NEJM 2021).'),
      h('li', 'LDL calculado: ecuación de Sampson / NIH (JAMA Cardiol 2020), válida hasta TG 800 mg/dL; Friedewald como referencia.'),
      h('li', 'HOMA-IR = glucemia × insulina / 405 · TyG = ln(TG × glucemia / 2).'),
      h('li', 'FIB-4 = edad × AST / (plaquetas × √ALT); corte bajo 1,3 (2,0 en ≥ 65 años) y alto 2,67.'))) : null);
}

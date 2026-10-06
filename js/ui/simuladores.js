/* ============================================================
   Simuladores en tiempo real
   - Metabolismo: deslizadores de peso, talla, edad, sexo y actividad;
     anillo de gasto, barras por nivel y desglose (como las calculadoras
     de TMB de los hospitales, pero con varias fórmulas a la vez).
   - Cuerpo: medidor de IMC con aguja, silueta que cambia y rango saludable.
   - Corazón: "¿y si…?" con PREVENT, todo se recalcula al arrastrar.
   - Tratamiento: proyección de peso semana a semana por fármaco.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { fmt, fmt0 } from '../core/ui.js';
import * as G from './graficos.js';
import { deslizador, segmentado, interruptor } from './campos.js';
import * as A from '../engine/anthro.js';
import * as R from '../engine/risk.js';
import * as GL from '../engine/glp1.js';

const kcal = (v) => Math.round(v).toLocaleString('es-AR');

/* ---------- Metabolismo ---------- */
export function simMetabolismo(inicial = {}) {
  const st = { peso: 70, talla: 168, edad: 40, sexo: 'F', actividad: 'ligera', grasa: null, ...inicial };
  const ring = G.anillo({ max: 4200, unidad: 'kcal/día en total', etiqueta: 'Gasto total diario' });
  const tmbNum = G.numero(kcal, 'num.grande');
  const getNum = G.numero(kcal, 'num.grande');
  const bars = G.barras({ unidad: 'kcal' });
  const stack = G.apilada({ unidad: 'kcal' });
  const formulas = G.barras({ unidad: 'kcal' });
  const metas = h('div.metas');

  const recalcular = () => {
    const e = A.energia(st);
    if (!e) return;
    ring.set(e.get, e.tmb);
    ring.etiqueta(`Basal ${kcal(e.tmb)} · ${A.ACTIVIDAD.find((a) => a.id === st.actividad).nombre}`);
    tmbNum.set(e.tmb);
    getNum.set(e.get);
    bars.set(e.porNivel.map((n) => ({ id: n.id, nombre: n.nombre, desc: n.desc, valor: n.kcal, onclick: () => { st.actividad = n.id; segAct.querySelector(`input[value="${n.id}"]`).checked = true; recalcular(); } })), st.actividad, 4200);
    stack.set([
      { nombre: 'Metabolismo basal', valor: e.desglose.basal, color: 'var(--c1)' },
      { nombre: 'Digestión (efecto térmico)', valor: e.desglose.digestion, color: '#facc15' },
      { nombre: 'Actividad física', valor: e.desglose.actividad, color: '#fb7185' },
    ]);
    formulas.set([
      { id: 'mifflin', nombre: 'Mifflin-St Jeor', desc: 'Recomendada en adultos', valor: e.mifflin, color: 'var(--c1)' },
      { id: 'harris', nombre: 'Harris-Benedict', desc: 'Revisión 1984', valor: e.harris, color: '#f59e0b' },
      ...(e.katch ? [{ id: 'katch', nombre: 'Katch-McArdle', desc: 'Usa la masa magra', valor: e.katch, color: '#fb7185' }] : []),
    ], 'mifflin', 2800);
    const prot = A.proteinaDiaria(st.peso, st.talla);
    metas.replaceChildren(
      meta('Mantener el peso', `${kcal(e.get)} kcal`, 'objetivo'),
      meta('Bajar ~0,5 kg/semana', `${kcal(Math.max(e.tmb, e.get - 500))} kcal`, 'balanza', e.get - 500 < e.tmb ? 'Topeado en el basal: no bajar de ahí' : null),
      meta('Proteínas', prot ? `${fmt0(prot.min)}–${fmt0(prot.max)} g/día` : '—', 'cuerpo'),
      meta('Agua', `${fmt(st.peso * 0.035, 1)} L/día`, 'gota'),
    );
  };
  const meta = (t, v, ic, nota) => h('div.meta', icono(ic, { tam: 18 }), h('div', h('small', t), h('strong.num', v), nota ? h('em', nota) : null));

  const sPeso = deslizador({ etiqueta: 'Peso', min: 35, max: 220, paso: 0.5, valor: st.peso, unidad: 'kg', icono: 'balanza', onInput: (v) => { st.peso = v; recalcular(); } });
  const sTalla = deslizador({ etiqueta: 'Talla', min: 130, max: 210, paso: 1, valor: st.talla, unidad: 'cm', icono: 'cinta', onInput: (v) => { st.talla = v; recalcular(); } });
  const sEdad = deslizador({ etiqueta: 'Edad', min: 18, max: 95, paso: 1, valor: st.edad, unidad: 'años', icono: 'calendario', onInput: (v) => { st.edad = v; recalcular(); } });
  const segSexo = segmentado([{ valor: 'F', texto: 'Mujer' }, { valor: 'M', texto: 'Varón' }], st.sexo, (v) => { st.sexo = v; recalcular(); }, { etiqueta: 'Sexo biológico' });
  const segAct = segmentado(A.ACTIVIDAD.map((a) => ({ valor: a.id, texto: a.nombre })), st.actividad, (v) => { st.actividad = v; recalcular(); }, { etiqueta: 'Actividad', pequeno: true });

  const el = h('div.sim.sim-metab',
    h('div.sim-controles',
      h('div.control', h('div.control-cab', h('label', 'Sexo biológico')), segSexo),
      sPeso.el, sTalla.el, sEdad.el,
      h('div.control', h('div.control-cab', h('label', 'Nivel de actividad')), segAct)),
    h('div.sim-visual',
      h('div.sim-anillo', ring.el),
      h('div.sim-kpis',
        h('div.kpi', h('small', 'Metabolismo basal'), tmbNum.el, h('span.unidad', 'kcal/día')),
        h('div.kpi.kpi--acento', h('small', 'Gasto total (GET)'), getNum.el, h('span.unidad', 'kcal/día'))),
      metas));
  const detalle = h('div.grid-2',
    h('section.card', h('header.card-cab', h('h3', 'Calorías según tu actividad')), h('p.ayuda', 'Tocá un nivel para simularlo.'), bars.el),
    h('section.card', h('header.card-cab', h('h3', '¿En qué se van las calorías?')), stack.el,
      h('header.card-cab.mt', h('h3', 'Comparación de fórmulas')), formulas.el));
  queueMicrotask(recalcular);
  return {
    el: h('div', el, detalle),
    cargar(v) {
      Object.assign(st, v);
      sPeso.set(st.peso); sTalla.set(st.talla); sEdad.set(st.edad);
      segSexo.querySelector(`input[value="${st.sexo}"]`).checked = true;
      segAct.querySelector(`input[value="${st.actividad}"]`).checked = true;
      recalcular();
    },
  };
}

/* ---------- Cuerpo ---------- */
export function simCuerpo(inicial = {}, { soloLectura = false } = {}) {
  const st = { peso: 70, talla: 168, sexo: 'F', cintura: null, edad: 40, ...inicial };
  const gauge = G.medidor({
    min: 14, max: 45, unidad: 'kg/m²', etiqueta: 'Índice de masa corporal', formato: (v) => fmt(v, 1),
    bandas: A.CATS_IMC.map((c) => ({ desde: Math.max(14, c.min), hasta: Math.min(45, c.max), color: c.color, nombre: c.nombre })),
    marcas: [18.5, 25, 30, 35, 40],
  });
  const sil = G.silueta();
  const rango = h('div.rango-sano');
  const indicadores = h('div.indicadores');
  const recalcular = () => {
    const b = A.imc(st.peso, st.talla);
    gauge.set(b, A.categoriaImc(b)?.nombre);
    const ict = st.cintura ? st.cintura / st.talla : null;
    sil.set({ imc: b, ict, sexo: st.sexo, cintura: st.cintura });
    const r = A.rangoPesoSaludable(st.talla);
    if (r) {
      const lo = 35, hi = Math.max(160, st.peso + 10);
      const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
      rango.replaceChildren(
        h('div.rango-sano-cab', h('span', 'Peso saludable para tu talla'), h('strong.num', `${fmt(r.min, 1)} – ${fmt(r.max, 1)} kg`)),
        h('div.rango-sano-pista', h('div.rango-sano-zona', { style: { left: pos(r.min), width: `calc(${pos(r.max)} - ${pos(r.min)})` } }),
          h('div.rango-sano-yo', { style: { left: pos(st.peso) } }, h('span.num', `${fmt(st.peso, 1)} kg`))),
        h('small.ayuda', st.peso > r.max ? `Estás ${fmt(st.peso - r.max, 1)} kg por encima del límite superior. Bajar un 5–10 % ya mejora la presión, la glucemia y los lípidos.` : st.peso < r.min ? 'Estás por debajo del rango saludable.' : 'Estás dentro del rango saludable.'),
      );
    }
    const comp = A.composicion({ peso: st.peso, talla: st.talla, edad: st.edad, sexo: st.sexo, cintura: st.cintura });
    indicadores.replaceChildren(
      ind('Cintura / talla', comp?.ict ? fmt(comp.ict.valor, 2) : '—', comp?.ict ? { normal: 'ok', aumentado: 'limite', alto: 'alto' }[comp.ict.nivel] : null, 'Ideal < 0,5'),
      ind('Grasa corporal estimada', comp?.grasa?.usada ? `${fmt(comp.grasa.usada, 1)} %` : '—', comp?.grasa?.usada ? (A.grasaExcesiva(comp.grasa.usada, st.sexo) ? 'alto' : 'ok') : null, comp?.grasa?.rfm ? 'Fórmula RFM (cintura)' : 'Fórmula CUN-BAE'),
      ind('Masa magra estimada', comp?.masaMagra ? `${fmt(comp.masaMagra, 1)} kg` : '—', null, 'Músculo, hueso y agua'),
      ind('Superficie corporal', comp?.sc ? `${fmt(comp.sc, 2)} m²` : '—', null, 'Mosteller'),
    );
  };
  const ind = (t, v, tono, sub) => h(`div.ind${tono ? '.ind--' + tono : ''}`, h('small', t), h('strong.num', v), sub ? h('em', sub) : null);
  const sPeso = deslizador({ etiqueta: 'Peso', min: 35, max: 220, paso: 0.5, valor: st.peso, unidad: 'kg', icono: 'balanza', onInput: (v) => { st.peso = v; recalcular(); } });
  const sTalla = deslizador({ etiqueta: 'Talla', min: 130, max: 210, paso: 1, valor: st.talla, unidad: 'cm', icono: 'cinta', onInput: (v) => { st.talla = v; recalcular(); } });
  const sCint = deslizador({ etiqueta: 'Cintura', min: 50, max: 180, paso: 1, valor: st.cintura || 85, unidad: 'cm', icono: 'cinta', onInput: (v) => { st.cintura = v; recalcular(); }, ayuda: 'A la altura del ombligo, al final de una espiración.' });
  const el = h('div.sim.sim-cuerpo',
    h('div.sim-visual.sim-visual--cuerpo', h('div.sim-gauge', gauge.el), h('div.sim-silueta', sil.el)),
    h('div.sim-controles', soloLectura ? null : [sPeso.el, sTalla.el, sCint.el], rango, indicadores));
  queueMicrotask(recalcular);
  return { el, cargar(v) { Object.assign(st, v); sPeso.set(st.peso); sTalla.set(st.talla); if (st.cintura) sCint.set(st.cintura); recalcular(); } };
}

/* ---------- Corazón: ¿y si…? ---------- */
export function simRiesgo(base) {
  const st = { ...base };
  const segASCVD = [
    { desde: 0, hasta: 3, color: '#22c55e', nombre: 'Bajo' }, { desde: 3, hasta: 5, color: '#eab308', nombre: 'Limítrofe' },
    { desde: 5, hasta: 10, color: '#f97316', nombre: 'Intermedio' }, { desde: 10, hasta: 40, color: '#ef4444', nombre: 'Alto' },
  ];
  const escAscvd = G.escala({ segmentos: segASCVD });
  const escCvd = G.escala({ segmentos: [
    { desde: 0, hasta: 5, color: '#22c55e', nombre: 'Bajo' }, { desde: 5, hasta: 7.5, color: '#eab308', nombre: 'Limítrofe' },
    { desde: 7.5, hasta: 20, color: '#f97316', nombre: 'Intermedio' }, { desde: 20, hasta: 50, color: '#ef4444', nombre: 'Alto' }] });
  const escHf = G.escala({ segmentos: [
    { desde: 0, hasta: 2.5, color: '#22c55e', nombre: 'Bajo' }, { desde: 2.5, hasta: 5, color: '#eab308', nombre: 'Limítrofe' },
    { desde: 5, hasta: 10, color: '#f97316', nombre: 'Intermedio' }, { desde: 10, hasta: 40, color: '#ef4444', nombre: 'Alto' }] });
  const n30 = G.numero((v) => `${fmt(v, 1)} %`, 'num.grande');
  const n10 = G.numero((v) => `${fmt(v, 1)} %`, 'num.grande');
  const dif = h('div.sim-dif');
  const avisos = h('div');
  const contrib = h('div.contrib');
  const original = R.prevent(base);

  const recalcular = () => {
    const p = R.prevent(st);
    if (!p.ok) return;
    escAscvd.set(p.ascvd10); escCvd.set(p.cvd10); escHf.set(p.hf10);
    n10.set(p.cvd10); n30.set(p.cvd30);
    const d = p.cvd10 - original.cvd10;
    dif.className = `sim-dif ${d < -0.05 ? 'sim-dif--mejor' : d > 0.05 ? 'sim-dif--peor' : ''}`;
    dif.textContent = Math.abs(d) < 0.05 ? 'Igual que tus valores actuales' : `${d < 0 ? '▼' : '▲'} ${fmt(Math.abs(d), 1)} puntos frente a tus valores actuales (${fmt(original.cvd10, 1)} %)`;
    avisos.replaceChildren(...p.avisos.slice(0, 2).map((a) => h('p.ayuda', a)));
    const c = R.contribuciones(st) || [];
    const max = Math.max(...c.map((x) => x.baja), 0.5);
    contrib.replaceChildren(...(c.length ? c.map((x) => h('div.contrib-fila',
      h('span', x.nombre), h('div.contrib-pista', h('div.contrib-fill', { style: { width: `${(x.baja / max) * 100}%` } })),
      h('strong.num', `−${fmt(x.baja, 1)}`))) : [h('p.ayuda', 'Tus factores modificables ya están en valores óptimos.')]));
  };
  const sl = (etq, k, min, max, paso, u, ic) => deslizador({ etiqueta: etq, min, max, paso, valor: st[k], unidad: u, icono: ic, onInput: (v) => { st[k] = v; recalcular(); } });
  const controles = [
    sl('Presión sistólica', 'pas', 90, 200, 1, 'mmHg', 'pulso'),
    sl('Colesterol total', 'ct', 130, 320, 1, 'mg/dL', 'gota'),
    sl('Colesterol HDL', 'hdl', 20, 100, 1, 'mg/dL', 'gota'),
    sl('IMC', 'imc', 18.5, 45, 0.1, 'kg/m²', 'cuerpo'),
  ];
  const tog = (etq, k, desc) => interruptor(etq, st[k], (v) => { st[k] = v; recalcular(); }, desc);
  const el = h('div.sim.sim-riesgo',
    h('div.sim-controles', ...controles.map((c) => c.el),
      h('div.toggles', tog('Fuma', 'tabaco'), tog('Diabetes', 'dm'), tog('Toma estatinas', 'estatina'), tog('Toma antihipertensivos', 'tratHta')),
      h('button.btn.btn--suave', { type: 'button', onclick: () => { Object.assign(st, base); controles.forEach((c, i) => c.set(st[['pas', 'ct', 'hdl', 'imc'][i]])); el.querySelectorAll('.toggles input').forEach((inp, i) => { inp.checked = !!st[['tabaco', 'dm', 'estatina', 'tratHta'][i]]; }); recalcular(); } }, icono('sincronizar', { tam: 16 }), 'Volver a mis valores')),
    h('div.sim-visual',
      h('div.sim-kpis',
        h('div.kpi.kpi--acento', h('small', 'Riesgo cardiovascular total a 10 años'), n10.el),
        h('div.kpi', h('small', 'A 30 años'), n30.el)),
      dif,
      h('div.escala-bloque', h('h4', 'Infarto o ACV (aterosclerótico) a 10 años'), escAscvd.el),
      h('div.escala-bloque', h('h4', 'Enfermedad cardiovascular total a 10 años'), escCvd.el),
      h('div.escala-bloque', h('h4', 'Insuficiencia cardíaca a 10 años'), escHf.el),
      avisos,
      h('div.escala-bloque', h('h4', '¿Cuánto bajaría si corregís cada factor?'), contrib)));
  queueMicrotask(recalcular);
  return { el };
}

/* ---------- Tratamiento: proyección de peso ---------- */
export function simProyeccion({ peso, talla, dm2 = false, opciones, planId, inicio }) {
  const ids = opciones?.length ? opciones.map((o) => o.farmaco.id) : GL.FARMACOS.filter((f) => f.para.includes('obesidad')).map((f) => f.id);
  const st = { activos: new Set([planId || ids[0]]), semana: 24, suspender: false, semSusp: 52 };
  const chart = G.lineas({
    alto: 300, formatoY: (v) => fmt(v, 0), formatoX: (v) => `${v}`,
    ejeX: { ticks: [0, 12, 24, 36, 48, 60, 72, 84, 96, 104] },
    tooltip: (x, vals) => h('div', h('strong', `Semana ${Math.round(x)}`), ...vals.filter((v) => !v.serie.sinTip).map((v) => h('div.tip-fila', h('i', { style: { background: v.serie.color } }), h('span', v.serie.nombre), h('b.num', `${fmt(v.punto.y, 1)} kg`)))),
  });
  const leyenda = h('div.proy-ley');
  const lectura = h('div.proy-lectura');
  const pasos = h('div.proy-pasos');
  const recalcular = () => {
    const sem = st.suspender ? 104 : 72;
    const series = [];
    const placebo = GL.proyeccion('placebo', peso, { semanas: sem, dm2 });
    series.push({ id: 'placebo', nombre: 'Solo cambios de hábitos', color: '#94a3b8', punteada: true, datos: placebo.map((p) => ({ x: p.s, y: p.peso })) });
    for (const id of ids) {
      if (!st.activos.has(id)) continue;
      const f = GL.farmaco(id);
      const d = GL.proyeccion(id, peso, { semanas: sem, dm2, suspenderEn: st.suspender ? st.semSusp : null });
      series.push({ id, nombre: `${f.generico} (${f.comercial})`, color: f.color, area: false, datos: d.map((p) => ({ x: p.s, y: p.peso, y0: p.alto, y1: p.bajo })) });
    }
    chart.set(series, { xmin: 0, xmax: sem });
    leyenda.replaceChildren(...ids.map((id) => {
      const f = GL.farmaco(id);
      const b = h('button.proy-chip', { type: 'button', 'aria-pressed': st.activos.has(id), style: { '--chip': f.color } }, h('i'), `${f.generico} · ${f.comercial}`);
      b.onclick = () => { if (st.activos.has(id) && st.activos.size > 1) st.activos.delete(id); else st.activos.add(id); recalcular(); };
      return b;
    }));
    st.semana = Math.min(st.semana, sem);
    chart.cursor(st.semana);
    pintarLectura(st.semana);
  };
  const pintarLectura = (x) => {
    const s = Math.min(Math.round(x), st.suspender ? 104 : 72);
    const prim = [...st.activos][0];
    const f = GL.farmaco(prim);
    if (!f) return;
    const d = GL.proyeccion(prim, peso, { semanas: Math.max(s, 1), dm2, suspenderEn: st.suspender ? st.semSusp : null })[s] || { pct: 0, peso };
    const bmi = A.imc(d.peso, talla);
    const esq = GL.esquema(prim, inicio || new Date().toISOString().slice(0, 10));
    const paso = esq.filter((p) => p.semanaDesde <= s + 1).pop();
    lectura.replaceChildren(
      h('div.proy-dato', h('small', 'Semana'), h('strong.num', String(s))),
      h('div.proy-dato', h('small', 'Peso estimado'), h('strong.num', `${fmt(d.peso, 1)} kg`)),
      h('div.proy-dato', h('small', 'Descenso'), h('strong.num', `−${fmt(d.pct, 1)} %`)),
      h('div.proy-dato', h('small', 'IMC'), h('strong.num', fmt(bmi, 1)), h('em', A.categoriaImc(bmi)?.nombre || '')),
      h('div.proy-dato', h('small', st.suspender && s > st.semSusp ? 'Situación' : 'Dosis en esa semana'), h('strong.num', st.suspender && s > st.semSusp ? 'Suspendido' : paso ? `${GL.fmtDosis(paso.dosis)} mg` : '—')),
    );
    pasos.replaceChildren(...esq.map((p) => h(`div.proy-paso${paso && p.paso === paso.paso && !(st.suspender && s > st.semSusp) ? '.proy-paso--activo' : ''}`, { style: { '--chip': f.color, flex: p.mantenimiento ? '2' : '1' } },
      h('strong', `${GL.fmtDosis(p.dosis)} mg`), h('small', p.mantenimiento ? `sem ${p.semanaDesde}+` : `sem ${p.semanaDesde}–${p.semanaHasta}`))));
  };
  chart.alMoverCursor((x) => { st.semana = Math.round(x); slider.set(st.semana); pintarLectura(x); });
  const slider = deslizador({ etiqueta: 'Mové la semana', min: 0, max: 104, paso: 1, valor: st.semana, icono: 'calendario', onInput: (v) => { st.semana = Math.min(v, st.suspender ? 104 : 72); chart.cursor(st.semana); pintarLectura(st.semana); } });
  const susp = interruptor('¿Qué pasa si se suspende?', false, (v) => { st.suspender = v; recalcular(); }, 'Simula suspender en la semana 52: se recupera parte del peso (STEP-1 extensión).');
  chart.fijar(true);
  queueMicrotask(recalcular);
  return {
    el: h('div.sim.sim-proy',
      leyenda, chart.el, h('div.proy-pasos-wrap', h('small', 'Titulación del primer fármaco elegido'), pasos), lectura,
      h('div.sim-controles.sim-controles--fila', slider.el, susp),
      h('p.ayuda', `Curva media de los ensayos clínicos (efecto en tratamiento) ${dm2 ? 'ajustada por diabetes tipo 2 ' : ''}y banda de variación individual aproximada. No es una predicción personal: la respuesta real varía mucho entre personas.`)),
  };
}

/* ============================================================
   Informe clínico para imprimir o guardar en PDF.
   No imprime la pantalla: arma un documento aparte, en A4, con tablas
   ordenadas por secciones (identificación, antecedentes, medicación,
   medidas, metabolismo, laboratorio, riesgo, tratamiento, plan y firma).
   El médico elige antes qué incluir (DNI completo, plan, notas).
   ============================================================ */

import { h } from '../core/dom.js';
import { modal, fmt, fmt0, fecha, fechaHora, toast } from '../core/ui.js';
import { icono } from '../core/iconos.js';
import { CONFIG } from '../config.js';
import { ACTIVIDAD } from '../engine/anthro.js';
import { reconocer, CLASES } from '../engine/meds.js';
import * as GL from '../engine/glp1.js';
import { PAT, SINT, FAM } from './datos-form.js';

const ETQ = Object.fromEntries([...Object.values(PAT).flat(), ...SINT, ...FAM].map(([k, t]) => [k, t]));
const TABACO = { nunca: 'No fuma', ex: 'Ex fumador/a', actual: 'Fuma actualmente' };
const ALCOHOL = { no: 'No consume', moderado: 'Moderado', riesgo: 'Más de 2 tragos por día' };
const ESTADO = { alto: ['Alto', 'alto'], bajo: ['Bajo', 'bajo'], limite: ['Limítrofe', 'limite'], ok: ['Normal', 'ok'] };
const VEREDICTO = { indicado: 'Candidato a tratamiento', precaucion: 'Candidato con precaución', 'no-indicado': 'No indicado por ahora', contraindicado: 'Contraindicado' };
const pct = (v) => (Number.isFinite(v) ? `${fmt(v)} %` : '—');
const conU = (v, u, d = 1) => (Number.isFinite(v) ? `${fmt(v, d)} ${u}` : '—');
const unir = (items) => items.map((t) => String(t).trim().replace(/[.;]+$/, '')).join('; ');
const diaLocal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Pregunta qué incluir y manda a imprimir. */
export function imprimirInforme({ ev, F, medico }) {
  const ops = { dni: true, plan: true, notas: false };
  const op = (k, t, d) => h('label.check', h('input', { type: 'checkbox', checked: ops[k], onchange: (e) => { ops[k] = e.target.checked; } }), h('span', h('strong', t), h('small', ` — ${d}`)));
  const m = modal({
    titulo: 'Imprimir informe', ancho: 480,
    cuerpo: h('div.informe-opciones',
      h('p', 'Se arma un informe clínico en hoja A4. Para guardarlo como PDF, elegí «Guardar como PDF» en la ventana de impresión.'),
      op('dni', 'DNI completo', 'si no, solo los 3 últimos números'),
      op('plan', 'Plan integral', 'alimentación, actividad y controles'),
      op('notas', 'Notas del equipo', 'uso interno de los profesionales')),
    acciones: [
      h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button.btn.btn--primario', { type: 'button', onclick: () => { m.cerrar(); setTimeout(() => imprimir(armar({ ev, F, medico, ops })), 250); } }, icono('imprimir', { tam: 16 }), 'Imprimir'),
    ],
  });
}

function imprimir(doc) {
  document.getElementById('informe-impresion')?.remove();
  document.body.appendChild(doc);
  document.documentElement.classList.add('imprimiendo');
  const titulo = document.title;
  document.title = doc.dataset.archivo; // nombre sugerido del PDF
  const fin = () => { document.documentElement.classList.remove('imprimiendo'); doc.remove(); document.title = titulo; window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  const img = doc.querySelector('img');
  const ir = () => { try { window.print(); } catch { toast('No se pudo abrir la impresión', 'error'); fin(); } };
  if (img && !img.complete) { img.onload = img.onerror = ir; setTimeout(() => { if (doc.isConnected && !img.complete) ir(); }, 1500); } else ir();
}

/* ---------- Armado del documento ---------- */
function armar({ ev, F, medico, ops }) {
  const per = F.pac.perfil || {};
  const cl = F.pac.clinica || {};
  const ahora = Date.now();
  const nro = `${String(F.uid).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}-${diaLocal(ahora).slice(2).replace(/-/g, '')}`;
  const md = medico?.datos || {};
  const nomMed = md.nombre ? `${md.nombre} ${md.apellido || ''}`.trim() : (medico?.email || 'Profesional');
  const mat = md.matricula ? `${md.matricula.tipo} ${md.matricula.numero}${md.matricula.provincia ? ` (${md.matricula.provincia})` : ''}` : '';
  const secs = [];
  let n = 0;
  const sec = (titulo, ...cont) => { const c = cont.flat().filter(Boolean); if (c.length) secs.push(h('section.inf-sec', h('h2', h('span.inf-n', String(++n)), titulo), ...c)); };

  // 1. Identificación
  const dni = per.dni ? (ops.dni ? Number(per.dni).toLocaleString('es-AR') : `•••••${String(per.dni).slice(-3)}`) : '—';
  sec('Identificación del paciente', kv([
    ['Apellido y nombre', `${per.apellido || ''}, ${per.nombre || ''}`], ['DNI', dni],
    ['Fecha de nacimiento', per.fechaNac ? `${fecha(per.fechaNac)} (${ev.edad ?? '—'} años)` : '—'], ['Sexo', per.sexo === 'M' ? 'Masculino' : 'Femenino'],
    ['Correo', per.email || '—'], ['Teléfono', per.telefono || '—'],
    ['Identidad', F.verif ? `Verificada con DNI el ${fecha(F.verif.cuando)}` : 'No verificada en consulta'], ['Ficha completa', `${ev.completitud.pct} %`],
  ]));

  // 2. Antecedentes
  const pats = Object.keys(cl.patologias || {}).filter((k) => cl.patologias[k]).map((k) => ETQ[k] || k);
  const extra = (cl.patologiasExtra || []).map((p) => p.texto + (ev.extras.noReconocidas.includes(p.texto) ? ' *' : ''));
  const fam = Object.entries(cl.familia || {}).filter(([, v]) => v).map(([k, v]) => (k === 'dm2' ? `Diabetes tipo 2 (${v === '1grado' ? 'familiar de 1.er grado' : v})` : ETQ[k] || k));
  const sint = Object.keys(cl.sintomas || {}).filter((k) => cl.sintomas[k]).map((k) => ETQ[k] || k);
  const hab = ev.habitos || {};
  sec('Antecedentes', kv([
    ['Enfermedades', [...pats, ...extra].join(' · ') || 'Ninguna registrada'],
    ['Antecedentes familiares', fam.join(' · ') || 'Ninguno registrado'],
    ['Síntomas', sint.join(' · ') || 'Ninguno registrado'],
    ['Tabaco', TABACO[hab.tabaco] || '—'], ['Alcohol', ALCOHOL[hab.alcohol] || '—'],
    ['Actividad física', ACTIVIDAD.find((a) => a.id === hab.actividad)?.nombre || '—'],
  ], 1), extra.some((t) => t.endsWith(' *')) ? h('p.inf-nota', '* No reconocida por la base de conocimiento de la app: revisión manual.') : null);

  // 3. Medicación
  const meds = ev.meds || [];
  sec('Medicación habitual', meds.length
    ? tabla(['#', 'Medicamento y dosis', 'Grupo'], meds.map((m, i) => {
      const cls = m.clases?.length ? m.clases : reconocer(m.nombre)?.clases || [];
      return [String(i + 1), m.nombre, cls.map((c) => CLASES[c] || c).join(', ') || 'No reconocido'];
    }), { anchos: ['6%', '54%', '40%'] })
    : h('p', 'No toma medicación habitual registrada.'));

  // 4. Medidas y signos vitales
  const an = ev.antropo || {}, vit = ev.vitales || {}, c = ev.comp;
  const filasMed = [
    ['Peso', conU(an.peso, 'kg'), c?.rango ? `${fmt0(c.rango.min)}–${fmt0(c.rango.max)} kg` : '', ''],
    ['Talla', conU(an.talla, 'cm', 0), '', ''],
    ['Índice de masa corporal', c?.imc ? conU(c.imc, 'kg/m²') : '—', '18,5–24,9', c?.categoria?.nombre || ''],
    ['Cintura', conU(an.cintura, 'cm', 0), ev.sexo === 'M' ? '< 94 cm' : '< 80 cm', c?.cintura ? (c.cintura.muyElevado ? 'Muy aumentada' : c.cintura.elevado ? 'Aumentada' : 'Normal') : ''],
    ['Índice cintura/talla', c?.ict ? fmt(c.ict.valor, 2) : '—', '< 0,50', c?.ict ? (c.ict.nivel === 'alto' ? 'Alto' : c.ict.nivel === 'limite' ? 'Limítrofe' : 'Normal') : ''],
    ['Índice cintura/cadera', c?.icc ? fmt(c.icc.valor, 2) : '—', ev.sexo === 'M' ? '< 0,90' : '< 0,85', c?.icc ? (c.icc.elevado ? 'Elevado' : 'Normal') : ''],
    ['Grasa corporal estimada', c?.grasa?.usada ? pct(c.grasa.usada) : '—', ev.sexo === 'M' ? '< 25 %' : '< 32 %', c?.grasa?.medida ? 'Medida' : 'Estimada (RFM)'],
    ['Masa magra', conU(c?.masaMagra, 'kg'), '', ''],
    ['Presión arterial', Number.isFinite(vit.pas) ? `${fmt0(vit.pas)}/${fmt0(vit.pad)} mmHg` : '—', '< 120/80', ev.pa?.nombre || ''],
    ['Frecuencia cardíaca', conU(vit.fc, 'lpm', 0), '60–100', ''],
  ].filter((f) => f[1] !== '—' || f[0] === 'Peso');
  sec('Medidas y signos vitales', tabla(['Parámetro', 'Valor', 'Referencia', 'Interpretación'], filasMed, { anchos: ['34%', '22%', '20%', '24%'] }));

  // 5. Metabolismo
  const en = ev.ener;
  if (en) {
    sec('Metabolismo y requerimientos', tabla(['Cálculo', 'Resultado', 'Método'], [
      ['Metabolismo basal (TMB)', `${fmt0(en.tmb)} kcal/día`, 'Mifflin-St Jeor'],
      ['TMB (comparación)', `${fmt0(en.harris)} kcal/día`, 'Harris-Benedict revisada'],
      en.katch ? ['TMB por masa magra', `${fmt0(en.katch)} kcal/día`, 'Katch-McArdle'] : null,
      ['Gasto energético total', `${fmt0(en.get)} kcal/día`, `TMB × ${fmt(en.factor, 3)} (${ACTIVIDAD.find((a) => a.f === en.factor)?.nombre || 'actividad'})`],
      c?.proteina ? ['Proteínas recomendadas', `${fmt0(c.proteina.min)}–${fmt0(c.proteina.max)} g/día`, `1,2–1,6 g/kg de peso ajustado (${fmt(c.proteina.pesoBase)} kg)`] : null,
      ev.plan?.dieta ? ['Calorías sugeridas', `${fmt0(ev.plan.dieta.kcal)} kcal/día`, ev.plan.dieta.objetivo] : null,
    ].filter(Boolean), { anchos: ['34%', '24%', '42%'] }));
  }

  // 6. Laboratorio
  const der = ev.der || {};
  // El LDL se juzga contra el objetivo de su categoría de riesgo, no contra un valor fijo
  const li = (ev.labsInt || []).map((l) => (l.id === 'ldl' && ev.ldlObjetivo && Number.isFinite(l.valor) && l.valor >= ev.ldlObjetivo
    ? { ...l, estado: 'alto', ref: `< ${ev.ldlObjetivo}`, texto: `Por encima del objetivo para riesgo ${(ev.categoria?.nombre || '').toLowerCase()}` } : l));
  sec(`Laboratorio${ev.labs?.fecha ? ` (${fecha(ev.labs.fecha)})` : ''}`, li.length
    ? tabla(['Determinación', 'Resultado', 'Referencia', 'Estado', 'Comentario'], li.map((l) => {
      const [t, k] = ESTADO[l.estado] || ['—', ''];
      return [l.nombre, `${fmtNum(l.valor)}${l.unidad ? ` ${l.unidad}` : ''}`, l.ref || '', h(`span.inf-est.inf-est--${k}`, t), l.texto || ''];
    }), { anchos: ['26%', '15%', '13%', '11%', '35%'], chica: true })
    : h('p', 'Sin análisis cargados.'),
  der.erc?.erc ? h('p.inf-nota', `Enfermedad renal crónica: estadio ${der.erc.texto} (filtrado CKD-EPI 2021: ${fmt0(der.tfg)} mL/min/1,73 m²).`) : null,
  (ev.extras.labsNoReconocidos || []).length ? h('p.inf-nota', `Análisis no reconocidos (revisión manual): ${ev.extras.labsNoReconocidos.map((x) => x.texto || x.nombre || x).join(', ')}.`) : null);

  // 7. Riesgo cardiometabólico
  const pr = ev.prevent, cat = ev.categoria;
  const filasR = [
    cat ? ['Categoría de riesgo cardiovascular', h('strong', cat.nombre), (cat.motivos || []).join('; ')] : null,
    ev.ldlObjetivo ? ['Objetivo de LDL', `< ${ev.ldlObjetivo} mg/dL`, `LDL actual: ${Number.isFinite(der.ldl) ? `${fmt0(der.ldl)} mg/dL${der.ldlMedido ? '' : ' (calculado, Sampson)'}` : 'sin dato'}`] : null,
    ev.glucemia ? ['Estado glucémico', ev.glucemia.nombre, ''] : null,
    ev.sm ? ['Síndrome metabólico', ev.sm.cumple ? 'Presente' : 'Ausente', `${ev.sm.n} de 5 criterios${ev.sm.sinDato ? ` (${ev.sm.sinDato} sin dato)` : ''}`] : null,
    ev.lancet ? ['Obesidad (Lancet 2025)', ev.lancet.nombre, (ev.lancet.criterios || []).join('; ')] : null,
    ev.eoss ? ['Estadio EOSS', `Estadio ${ev.eoss.estadio}`, (ev.eoss.motivos || []).join('; ')] : null,
    ev.findrisc ? ['Riesgo de diabetes (FINDRISC)', `${ev.findrisc.puntos} puntos — ${ev.findrisc.nombre}`, `Riesgo a 10 años: ${ev.findrisc.riesgo}`] : null,
    ev.potenciadores?.length ? ['Potenciadores de riesgo', String(ev.potenciadores.length), unir(ev.potenciadores)] : null,
  ].filter(Boolean);
  sec('Riesgo cardiometabólico',
    filasR.length ? tabla(['Evaluación', 'Resultado', 'Detalle'], filasR, { anchos: ['30%', '22%', '48%'] }) : null,
    pr?.ok ? h('div.inf-sub', h('h3', 'Ecuaciones PREVENT (AHA 2023)'), tabla(['Evento', 'A 10 años', 'A 30 años'], [
      ['Enfermedad cardiovascular total', pct(pr.cvd10), pct(pr.cvd30)],
      ['Enfermedad aterosclerótica (IAM, ACV)', pct(pr.ascvd10), pct(pr.ascvd30)],
      ['Insuficiencia cardíaca', pct(pr.hf10), pct(pr.hf30)],
    ], { anchos: ['52%', '24%', '24%'] }), Number.isFinite(ev.framingham) ? h('p.inf-nota', `Framingham 2008 (riesgo cardiovascular global a 10 años): ${pct(ev.framingham)}.`) : null,
    ...(pr.avisos || []).map((a) => h('p.inf-nota', a))) : null);

  // 8. Tratamiento farmacológico de la obesidad
  const g = ev.glp1, plan = F.pac.plan;
  if (g) {
    const opc = (g.opciones || []).slice(0, 3);
    const ci = [...(g.contraindicaciones?.absolutas || []).map((x) => ['Absoluta', x.texto, x.conducta || '']), ...(g.contraindicaciones?.relativas || []).map((x) => ['Relativa', x.texto, x.conducta || ''])];
    sec('Agonistas de GLP-1 / GIP',
      kv([['Evaluación', `${VEREDICTO[g.veredicto] || g.titulo}`], ['Resumen', g.resumen || '—'], ...(g.objetivo ? [['Objetivo de peso', `−${g.objetivo.pct} % (≈ ${fmt(g.objetivo.peso)} kg)`]] : [])], 1),
      opc.length && g.veredicto !== 'contraindicado' ? h('div.inf-sub', h('h3', 'Opciones ordenadas por conveniencia'), tabla(['Fármaco', 'Vía', 'Mantenimiento', 'Fundamento'],
        opc.map((o) => [`${o.farmaco.generico} (${o.farmaco.comercial})`, o.farmaco.via, o.farmaco.mantenimiento || '', (o.porque || []).join(' ')]), { anchos: ['20%', '20%', '28%', '32%'], chica: true })) : null,
      ci.length ? h('div.inf-sub', h('h3', 'Contraindicaciones'), tabla(['Tipo', 'Motivo', 'Conducta'], ci, { anchos: ['14%', '36%', '50%'], chica: true })) : null,
      g.interacciones?.length ? h('div.inf-sub', h('h3', 'Interacciones con la medicación actual'), tabla(['Medicamento', 'Severidad', 'Efecto', 'Conducta'],
        g.interacciones.map((i) => [i.farmaco, i.severidad ? i.severidad[0].toUpperCase() + i.severidad.slice(1) : '', i.efecto, i.conducta]), { anchos: ['20%', '12%', '34%', '34%'], chica: true })) : null,
      plan?.farmaco ? planActual(plan) : null);
  }

  // 9. Plan integral
  const pl = ev.plan;
  if (ops.plan && pl?.dieta) {
    const d = pl.dieta, a = pl.actividad;
    sec('Plan integral',
      h('div.inf-sub', h('h3', `Alimentación — ${d.patron}`), kv([['Calorías', `${fmt0(d.kcal)} kcal/día`], ['Proteínas', d.macros.proteina], ['Carbohidratos', d.macros.carbohidratos], ['Grasas', d.macros.grasas], ['Fibra', d.macros.fibra], ['Agua', d.macros.agua]]),
        d.reglas.length ? lista(d.reglas) : null, d.evitar.length ? h('p.inf-nota', `Evitar: ${unir(d.evitar)}.`) : null),
      a ? h('div.inf-sub', h('h3', 'Actividad física'), kv([['Aeróbica', a.aerobica], ['Fuerza', a.fuerza], ['Flexibilidad', a.flexibilidad], ['Pasos', a.pasos]], 1),
        a.precauciones?.length ? h('p.inf-nota', `Precauciones: ${unir(a.precauciones)}.`) : null) : null,
      pl.tratamiento?.length ? h('div.inf-sub', h('h3', 'Tratamiento sugerido'), tabla(['Prioridad', 'Indicación', 'Detalle'],
        pl.tratamiento.map((t) => [{ alta: 'Alta', media: 'Sugerido', baja: 'A considerar' }[t.prioridad] || '', t.titulo, (t.detalle || []).join(' ')]), { anchos: ['12%', '30%', '58%'], chica: true })) : null,
      pl.seguimiento?.length ? h('div.inf-sub', h('h3', 'Controles'), tabla(['Cuándo', 'Qué controlar'], pl.seguimiento.map((s) => [s.cuando, s.que]), { anchos: ['28%', '72%'] })) : null);
  }

  // 10. Notas
  if (ops.notas) {
    const notas = Object.values(F.notas || {}).sort((x, y) => y.cuando - x.cuando);
    sec('Notas del equipo', notas.length ? tabla(['Fecha', 'Profesional', 'Nota'], notas.map((x) => [fechaHora(x.cuando), x.nombre || '', x.texto]), { anchos: ['16%', '20%', '64%'], chica: true }) : h('p', 'Sin notas.'));
  }

  const cab = h('header.inf-cab',
    h('div.inf-marca', h('img', { src: 'icons/logo-256.png', alt: '', width: 52, height: 52 }), h('div', h('strong', CONFIG.app.toUpperCase()), h('small', 'Salud cardiometabólica'))),
    h('div.inf-titulo', h('h1', 'Informe clínico cardiometabólico'), h('p', `${per.apellido || ''}, ${per.nombre || ''} · DNI ${dni}`)),
    h('dl.inf-meta', h('dt', 'Fecha'), h('dd', fechaHora(ahora)), h('dt', 'Informe N.º'), h('dd', nro), h('dt', 'Emitido por'), h('dd', nomMed)));

  const firma = h('section.inf-firma',
    h('div.inf-firma-caja', h('div.inf-linea'), h('strong', nomMed), h('span', [mat && `Matrícula ${mat}`, md.especialidad].filter(Boolean).join(' · ') || 'Firma y sello')),
    h('p.inf-legal', 'Los cálculos (PREVENT, Framingham, CKD-EPI 2021, Mifflin-St Jeor, FINDRISC, EOSS y criterios Lancet 2025) son herramientas de apoyo y no reemplazan el juicio clínico. ',
      'La indicación de fármacos y su receta corresponden al médico tratante (Ley 17.132 y Ley 27.553).'));

  const pie = h('footer.inf-pie', h('span', 'Documento confidencial — datos de salud protegidos por la Ley 25.326 y el secreto profesional (Ley 17.132, art. 11).'), h('span', `${CONFIG.app} v${CONFIG.version}`));

  const doc = h('div#informe-impresion', { 'aria-hidden': 'true' },
    h('table.inf-marco', h('thead', h('tr', h('td', cab))), h('tfoot', h('tr', h('td', pie))), h('tbody', h('tr', h('td', h('main.inf-cuerpo', ...secs, firma))))));
  doc.dataset.archivo = `Informe ${per.apellido || ''} ${per.nombre || ''} ${diaLocal(ahora)}`.replace(/\s+/g, ' ').trim();
  return doc;
}

function planActual(plan) {
  const f = GL.farmaco(plan.farmaco);
  if (!f) return null;
  const esq = plan.inicio ? GL.esquema(plan.farmaco, plan.inicio) : [];
  return h('div.inf-sub', h('h3', `Plan indicado: ${f.generico} (${f.comercial}) — ${plan.estado}`),
    h('p.inf-nota', `Indicado por ${plan.indicadoPor?.nombre || '—'}${plan.indicadoPor?.matricula ? ` (${plan.indicadoPor.matricula})` : ''} el ${fecha(plan.fecha)}. Inicio: ${fecha(plan.inicio)}.`),
    esq.length ? tabla(['Paso', 'Dosis', 'Desde', 'Hasta', 'Semanas'], esq.map((p) => [String(p.paso), `${GL.fmtDosis(p.dosis)} ${p.unidad} ${p.frecuencia === 'semanal' ? 'por semana' : 'por día'}`,
      fecha(p.desde), p.mantenimiento ? 'Mantenimiento' : fecha(p.hasta), p.mantenimiento ? `desde la ${p.semanaDesde}` : `${p.semanaDesde} a ${p.semanaHasta}`]), { anchos: ['8%', '30%', '20%', '20%', '22%'] }) : null);
}

/* ---------- Piezas ---------- */
const fmtNum = (v) => (Number.isFinite(v) ? v.toLocaleString('es-AR', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : Math.abs(v) < 10 ? 2 : 1 }) : String(v ?? '—'));

function tabla(cols, filas, { anchos = [], chica = false } = {}) {
  return h(`table.inf-tabla${chica ? '.inf-tabla--chica' : ''}`,
    anchos.length ? h('colgroup', ...anchos.map((w) => h('col', { style: { width: w } }))) : null,
    h('thead', h('tr', ...cols.map((c) => h('th', c)))),
    h('tbody', ...filas.map((f) => h('tr', ...f.map((x) => h('td', x ?? ''))))));
}

/** Pares clave-valor: en 2 columnas (por defecto) o en 1. */
function kv(pares, cols = 2) {
  return h(`dl.inf-kv.inf-kv--${cols}`, ...pares.map(([k, v]) => h('div', h('dt', k), h('dd', v ?? '—'))));
}

const lista = (items) => h('ul.inf-lista', ...items.map((t) => h('li', t)));

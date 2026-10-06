/* ============================================================
   Formulario de datos clínicos (paciente y médico).
   Mientras se completa, un panel lateral recalcula IMC, metabolismo
   y riesgo en vivo. Guarda todo junto y deja historial de mediciones.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, toast, fmt, fmt0, chip, aviso } from '../core/ui.js';
import { campo, segmentado, interruptor, fichas, editorMeds, leerNum } from '../ui/campos.js';
import { evaluarPaciente } from '../engine/evaluar.js';
import { ACTIVIDAD } from '../engine/anthro.js';
import { guardarClinica, actualizarPerfil, backend } from '../data/servicio.js';
import * as G from '../ui/graficos.js';

const PAT = {
  cardiometabolicas: [['hta', 'Hipertensión'], ['dm2', 'Diabetes tipo 2'], ['dm1', 'Diabetes tipo 1'], ['prediabetes', 'Prediabetes'], ['dislipemia', 'Colesterol o triglicéridos altos'], ['hipercolFamiliar', 'Hipercolesterolemia familiar']],
  cardiovasculares: [['iam', 'Infarto'], ['acv', 'ACV o AIT'], ['eap', 'Enfermedad arterial periférica'], ['revasc', 'Stent o bypass'], ['ic', 'Insuficiencia cardíaca'], ['fa', 'Fibrilación auricular']],
  otras: [['erc', 'Enfermedad renal crónica'], ['sahos', 'Apnea del sueño'], ['higadoGraso', 'Hígado graso'], ['sop', 'Ovario poliquístico'], ['artrosis', 'Artrosis de rodilla o cadera'], ['hipotiroidismo', 'Hipotiroidismo'], ['inflamatoria', 'Artritis, psoriasis, lupus o VIH'], ['preeclampsia', 'Preeclampsia o menopausia precoz'], ['hipogonadismo', 'Hipogonadismo (testosterona baja)'], ['depresion', 'Depresión'], ['neuropatia', 'Neuropatía diabética']],
  importantes: [['pancreatitis', 'Pancreatitis', true], ['litiasisBiliar', 'Cálculos en la vesícula', true], ['gastroparesia', 'Gastroparesia', true], ['retinopatia', 'Retinopatía diabética', true], ['naion', 'Neuropatía óptica isquémica', true], ['cmtPersonal', 'Cáncer medular de tiroides', true], ['men2', 'Neoplasia endocrina múltiple tipo 2', true], ['tca', 'Anorexia o bulimia', true], ['ideacionSuicida', 'Ideas de autolesión', true], ['alergiaGlp1', 'Alergia a semaglutida, liraglutida o tirzepatida', true], ['cirugiaBariatrica', 'Cirugía bariátrica previa'], ['cirugiaProgramada', 'Cirugía o endoscopía programada', true], ['glucosaAltaPrevia', 'Glucemia alta alguna vez']],
  mujer: [['embarazo', 'Embarazo', true], ['lactancia', 'Lactancia', true], ['buscaEmbarazo', 'Busco embarazo', true]],
};
const SINT = [['disnea', 'Falta de aire al caminar'], ['dolorRodillaCadera', 'Dolor de rodillas o cadera'], ['incontinencia', 'Pérdidas de orina'], ['linfedema', 'Hinchazón crónica de piernas'], ['limitacionActividades', 'Me cuesta higienizarme, vestirme o moverme']];
const FAM = [['ecvPrecoz', 'Infarto o ACV en padres o hermanos jóvenes (varón < 55, mujer < 65)'], ['cmt', 'Cáncer medular de tiroides', true], ['men2', 'Neoplasia endocrina múltiple tipo 2', true]];
const LABS = [
  ['glucosa', 'Glucemia en ayunas', 'mg/dL'], ['hba1c', 'Hemoglobina glicosilada (A1c)', '%'], ['insulina', 'Insulina basal', 'µU/mL'],
  ['ct', 'Colesterol total', 'mg/dL'], ['hdl', 'Colesterol HDL', 'mg/dL'], ['ldl', 'Colesterol LDL (si figura)', 'mg/dL'], ['tg', 'Triglicéridos', 'mg/dL'],
  ['creatinina', 'Creatinina', 'mg/dL'], ['racu', 'Albuminuria (RACu)', 'mg/g'], ['acidoUrico', 'Ácido úrico', 'mg/dL'],
  ['ast', 'TGO / AST', 'U/L'], ['alt', 'TGP / ALT', 'U/L'], ['plaquetas', 'Plaquetas', '×10³/µL'],
  ['pcr', 'PCR ultrasensible', 'mg/L'], ['lpa', 'Lipoproteína (a)', 'mg/dL'], ['apob', 'Apolipoproteína B', 'mg/dL'], ['tsh', 'TSH', 'µUI/mL'],
];

export function formularioDatos({ uid, perfil, clinica, quien, onGuardado, titulo = 'Mis datos', subtitulo }) {
  const w = JSON.parse(JSON.stringify(clinica || {}));
  for (const k of ['antropo', 'vitales', 'habitos', 'patologias', 'familia', 'sintomas', 'labs', 'preferencias']) w[k] = w[k] || {};
  w.meds = w.meds || [];
  const p = { ...perfil };
  let sucio = false;
  const esMedico = quien.rol === 'medico';

  /* --- Panel en vivo --- */
  const vivoImc = G.numero((v) => fmt(v, 1), 'num.grande');
  const vivoTmb = G.numero((v) => fmt0(v), 'num.grande');
  const vivoRiesgo = h('strong.vivo-riesgo', '—');
  const anillo = h('div.completo', h('svg', { viewBox: '0 0 36 36' }, h('circle', { cx: 18, cy: 18, r: 15.5, fill: 'none', stroke: 'var(--line)', 'stroke-width': 3.5 }), h('circle.completo-arco', { cx: 18, cy: 18, r: 15.5, fill: 'none', stroke: 'var(--c1)', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-dasharray': '0 100', transform: 'rotate(-90 18 18)', pathLength: 100 })), h('span.num', '0 %'));
  const faltan = h('small.ayuda');
  const btnGuardar = h('button.btn.btn--primario.btn--grande', { type: 'submit' }, icono('ok', { tam: 18 }), 'Guardar cambios');
  const estadoGuardar = h('span.guardar-estado');

  const actualizarVivo = () => {
    const ev = evaluarPaciente(p, w);
    vivoImc.set(ev.comp?.imc);
    vivoTmb.set(ev.ener?.tmb);
    vivoRiesgo.textContent = ev.categoria?.nombre || '—';
    vivoRiesgo.style.color = ev.categoria?.color || '';
    const c = ev.completitud;
    anillo.querySelector('.completo-arco').setAttribute('stroke-dasharray', `${c.pct} 100`);
    anillo.querySelector('span').textContent = `${c.pct} %`;
    faltan.textContent = c.faltan.length ? `Falta: ${c.faltan.slice(0, 4).join(', ')}${c.faltan.length > 4 ? '…' : ''}` : '¡Ficha completa!';
  };
  const marcar = () => { sucio = true; estadoGuardar.textContent = 'Cambios sin guardar'; estadoGuardar.className = 'guardar-estado guardar-estado--pend'; actualizarVivo(); };

  const num = (obj, k, etq, suf, ayuda, ph) => {
    const c = campo(etq, { type: 'number', value: obj[k] ?? '', placeholder: ph || '', name: k }, { sufijo: suf, ayuda });
    c.querySelector('input').addEventListener('input', (e) => { obj[k] = leerNum(e.target.value); marcar(); });
    return c;
  };
  const toggleFichas = (lista, obj) => fichas(lista, obj, (k, on) => { if (on) obj[k] = true; else delete obj[k]; marcar(); });

  /* --- Identificación --- */
  const ident = tarjeta('Identificación', { icono: 'usuario' },
    h('div.grid-form',
      textoCampo('Nombre', 'nombre'), textoCampo('Apellido', 'apellido'),
      campo('DNI', { value: p.dni || '', disabled: true }, { ayuda: esMedico ? 'Constatar con el documento en la consulta.' : 'Para corregirlo, pedilo desde Privacidad.' }),
      fechaCampo(), h('div.campo', h('label', 'Sexo biológico'), segmentado([{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }], p.sexo, (v) => { p.sexo = v; marcar(); }, { etiqueta: 'Sexo biológico' }), h('small.ayuda', 'Lo usan las fórmulas médicas.')),
      textoCampo('Teléfono (opcional)', 'telefono')));
  function textoCampo(etq, k) {
    const c = campo(etq, { value: p[k] || '', maxlength: 80 });
    c.querySelector('input').addEventListener('input', (e) => { p[k] = e.target.value; marcar(); });
    return c;
  }
  function fechaCampo() {
    const c = campo('Fecha de nacimiento', { type: 'date', value: p.fechaNac || '', max: new Date().toISOString().slice(0, 10) });
    c.querySelector('input').addEventListener('input', (e) => { p.fechaNac = e.target.value; marcar(); });
    return c;
  }

  /* --- Medidas --- */
  const medidas = tarjeta('Medidas y presión', { icono: 'cinta' },
    h('div.grid-form',
      num(w.antropo, 'talla', 'Talla', 'cm', null, '165'), num(w.antropo, 'peso', 'Peso', 'kg', null, '72,5'),
      num(w.antropo, 'cintura', 'Cintura', 'cm', 'A la altura del ombligo, al final de la espiración.'), num(w.antropo, 'cadera', 'Cadera', 'cm', 'En la parte más ancha de los glúteos.'),
      num(w.antropo, 'grasa', 'Grasa corporal medida', '%', 'Solo si tenés bioimpedancia o DEXA.'),
      num(w.vitales, 'pas', 'Presión sistólica (máxima)', 'mmHg', 'Promedio de 2 tomas sentado.', '120'), num(w.vitales, 'pad', 'Presión diastólica (mínima)', 'mmHg', null, '80'),
      num(w.vitales, 'fc', 'Frecuencia cardíaca', 'lpm')));

  /* --- Hábitos --- */
  const habitos = tarjeta('Hábitos', { icono: 'rayo' },
    h('div.grid-form',
      h('div.campo', h('label', 'Tabaco'), segmentado([{ valor: 'nunca', texto: 'Nunca' }, { valor: 'ex', texto: 'Ex fumador/a' }, { valor: 'actual', texto: 'Fumo' }], w.habitos.tabaco, (v) => { w.habitos.tabaco = v; marcar(); }, { etiqueta: 'Tabaco' })),
      h('div.campo', h('label', 'Alcohol'), segmentado([{ valor: 'no', texto: 'No' }, { valor: 'moderado', texto: 'Moderado' }, { valor: 'riesgo', texto: 'Más de 2 por día' }], w.habitos.alcohol, (v) => { w.habitos.alcohol = v; marcar(); }, { etiqueta: 'Alcohol' })),
      h('div.campo.campo--ancho', h('label', 'Actividad física'), segmentado(ACTIVIDAD.map((a) => ({ valor: a.id, texto: a.nombre })), w.habitos.actividad, (v) => { w.habitos.actividad = v; marcar(); }, { etiqueta: 'Actividad física', pequeno: true }), h('small.ayuda', ACTIVIDAD.map((a) => `${a.nombre}: ${a.desc.toLowerCase()}`).join(' · '))),
      interruptor('Como frutas o verduras todos los días', w.habitos.frutasVerduras, (v) => { w.habitos.frutasVerduras = v; marcar(); }),
      interruptor('Prefiero evitar las inyecciones', w.preferencias.oral, (v) => { w.preferencias.oral = v; marcar(); }, 'Para evaluar opciones por vía oral.')));

  /* --- Antecedentes --- */
  const fam = w.familia;
  const antecedentes = tarjeta('Enfermedades y antecedentes', { icono: 'corazon' },
    h('h4.sub', 'Cardiometabólicas'), toggleFichas(PAT.cardiometabolicas, w.patologias),
    h('h4.sub', 'Cardiovasculares'), toggleFichas(PAT.cardiovasculares, w.patologias),
    h('h4.sub', 'Otras'), toggleFichas(PAT.otras, w.patologias),
    h('h4.sub', 'Importantes para la medicación ', h('span.chip.chip--peligro', 'revisar')), toggleFichas(PAT.importantes, w.patologias),
    p.sexo === 'F' ? [h('h4.sub', 'Embarazo'), toggleFichas(PAT.mujer, w.patologias)] : null,
    h('h4.sub', 'Síntomas'), toggleFichas(SINT, w.sintomas),
    h('h4.sub', 'Familiares'), toggleFichas(FAM, fam),
    h('div.campo', h('label', 'Diabetes en la familia'), segmentado([{ valor: 'no', texto: 'No' }, { valor: '2grado', texto: 'Abuelos, tíos o primos' }, { valor: '1grado', texto: 'Padres, hermanos o hijos' }], fam.dm2 || 'no', (v) => { fam.dm2 = v; marcar(); }, { etiqueta: 'Diabetes en la familia', pequeno: true })));

  /* --- Medicación --- */
  const medicacion = tarjeta('Medicación que tomás', { icono: 'pildora' },
    h('p.ayuda', 'Se cruza con los tratamientos para detectar interacciones. Incluí anticonceptivos, vitaminas y lo que tomes seguido.'),
    editorMeds(w.meds, (m) => { w.meds = m; marcar(); }));

  /* --- Laboratorio --- */
  const fechaLab = campo('Fecha del análisis', { type: 'date', value: w.labs.fecha || '', max: new Date().toISOString().slice(0, 10) });
  fechaLab.querySelector('input').addEventListener('input', (e) => { w.labs.fecha = e.target.value; marcar(); });
  const lpaUnidad = h('div.campo', h('label', 'Unidad de Lp(a)'), segmentado([{ valor: 'mg', texto: 'mg/dL' }, { valor: 'nmol', texto: 'nmol/L' }], w.labs.lpaUnidad || 'mg', (v) => { w.labs.lpaUnidad = v; marcar(); }, { pequeno: true }));
  const laboratorio = tarjeta('Laboratorio', { icono: 'matraz' },
    h('p.ayuda', 'Copiá los valores de tu último análisis. Lo que no tengas, dejalo vacío.'),
    h('div.grid-form', fechaLab, ...LABS.map(([k, etq, u]) => num(w.labs, k, etq, u)), lpaUnidad));

  /* --- Guardado --- */
  const form = h('form.form-datos', { novalidate: true },
    ident, medidas, habitos, antecedentes, medicacion, laboratorio,
    h('div.guardar-barra', estadoGuardar, btnGuardar));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errores = validar(p, w);
    if (errores.length) { toast(errores[0], 'error', 5000); return; }
    btnGuardar.disabled = true;
    try {
      if (['nombre', 'apellido', 'telefono', 'fechaNac', 'sexo'].some((k) => p[k] !== perfil[k])) await actualizarPerfil(uid, p);
      const ev = await guardarClinica(uid, p, w, quien);
      sucio = false;
      estadoGuardar.textContent = 'Guardado ✓'; estadoGuardar.className = 'guardar-estado guardar-estado--ok';
      toast('Datos guardados. Los cálculos ya están actualizados.', 'ok');
      onGuardado?.(ev);
    } catch (err) {
      console.error(err);
      toast(err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message) ? 'No tenés permiso para guardar estos datos.' : 'No se pudo guardar. Revisá la conexión e intentá de nuevo.', 'error');
    } finally { btnGuardar.disabled = false; }
  });

  const vivo = h('aside.vivo-panel',
    h('div.vivo-panel-cab', h('span.vivo-punto'), h('strong', 'Cálculo en vivo')),
    anillo, faltan,
    h('div.vivo-fila', h('small', 'IMC'), vivoImc.el),
    h('div.vivo-fila', h('small', 'Metabolismo basal'), vivoTmb.el, h('span.unidad', 'kcal')),
    h('div.vivo-fila', h('small', 'Riesgo cardiovascular'), vivoRiesgo),
    h('p.ayuda', 'Se actualiza mientras completás. Recién se guarda al tocar «Guardar cambios».'));

  queueMicrotask(actualizarVivo);
  const el = h('div.seccion',
    heroe('datos', titulo, subtitulo || (esMedico ? 'Ficha clínica completa. Lo que guardes lo ve también el paciente.' : 'Completá lo que sepas: cuanto más completo, más precisos los cálculos.')),
    h('div.datos-layout', form, vivo));
  return { el, get sucio() { return sucio; } };
}

function validar(p, w) {
  const e = [];
  const rango = (v, a, b) => v == null || v === '' || (v >= a && v <= b);
  if (!p.nombre?.trim() || !p.apellido?.trim()) e.push('Completá nombre y apellido.');
  if (!rango(w.antropo.talla, 100, 230)) e.push('La talla debe estar entre 100 y 230 cm.');
  if (!rango(w.antropo.peso, 25, 350)) e.push('El peso debe estar entre 25 y 350 kg.');
  if (!rango(w.antropo.cintura, 40, 250)) e.push('Revisá la cintura (40–250 cm).');
  if (!rango(w.vitales.pas, 60, 260) || !rango(w.vitales.pad, 30, 160)) e.push('Revisá los valores de presión.');
  if (w.vitales.pas && w.vitales.pad && w.vitales.pad >= w.vitales.pas) e.push('La presión mínima debe ser menor que la máxima.');
  if (!rango(w.labs.hba1c, 3, 20)) e.push('La HbA1c debe estar entre 3 y 20 %.');
  if (!rango(w.labs.creatinina, 0.2, 15)) e.push('Revisá la creatinina (0,2–15 mg/dL).');
  if (!rango(w.labs.glucosa, 30, 800)) e.push('Revisá la glucemia.');
  return e;
}

export { chip, aviso, backend };

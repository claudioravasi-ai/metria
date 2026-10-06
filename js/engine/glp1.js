/* ============================================================
   Motor de decisión: agonistas de GLP-1 y GIP/GLP-1
   ------------------------------------------------------------
   APOYO A LA DECISIÓN DEL MÉDICO. No reemplaza el juicio clínico
   ni el prospecto aprobado por ANMAT. La indicación, la dosis y la
   receta son actos médicos (Ley 17.132): la app solo muestra al
   paciente el plan que su médico confirmó.

   Fuentes principales (resumidas en el texto de cada ítem):
   prospectos de Wegovy, Ozempic, Rybelsus, Mounjaro, Saxenda y
   Trulicity; STEP-1/2/HFpEF/UP, SELECT, FLOW, ESSENCE, SURMOUNT-1/4/5/OSA,
   SUMMIT, SCALE, SUSTAIN-6, REWIND; ADA Standards of Care 2026;
   Comisión Lancet 2025 de obesidad clínica; consenso multisociedad 2024
   sobre GLP-1 y anestesia; EMA (2025) sobre NAION.
   Disponibilidad en Argentina revisada en octubre de 2026: actualizar
   DISPONIBILIDAD cuando ANMAT apruebe nuevas presentaciones.
   ============================================================ */

import { clasesDe, CLASES } from './meds.js';
import { comorbilidades } from './obesity.js';

export const FECHA_REVISION = '2026-10-06';

/* Curva media de descenso (efecto en tratamiento): pct(t) = emax·(1 − e^−(t/τ)^k) */
export const FARMACOS = [
  {
    id: 'sema-ob', generico: 'Semaglutida', comercial: 'Wegovy', via: 'Inyección subcutánea semanal', frecuencia: 'semanal', unidad: 'mg',
    para: ['obesidad'], color: '#3b82f6',
    disponible: 'Comercializado en Argentina desde octubre de 2025 (ANMAT), adultos y adolescentes desde 12 años.',
    pasos: [{ dosis: 0.25, dias: 28 }, { dosis: 0.5, dias: 28 }, { dosis: 1, dias: 28 }, { dosis: 1.7, dias: 28 }, { dosis: 2.4, dias: null }],
    mantenimiento: '2,4 mg por semana (1,7 mg si 2,4 mg no se tolera).',
    novedad: 'La UE (febrero de 2026) y EE.UU. (marzo de 2026) aprobaron 7,2 mg semanales tras ≥ 4 semanas con 2,4 mg (STEP UP: ~ −21 %). Verificar su aprobación en ANMAT antes de indicarla.',
    eficacia: { emax: 16, tau: 22, k: 1.3, texto: 'STEP-1: −14,9 % a 68 semanas (placebo −2,4 %).' },
    administracion: 'Una vez por semana, el mismo día, a cualquier hora, con o sin comidas. Abdomen, muslo o brazo, rotando el sitio.',
    olvido: 'Si faltan más de 2 días (48 h) para la próxima dosis, aplicarla apenas se recuerde; si faltan menos, saltearla. Si se omiten más de 2 semanas, consultar: puede ser necesario reiniciar la titulación.',
    respuesta: 'Evaluar a las 12–16 semanas con la dosis de mantenimiento: si el descenso es < 5 %, reconsiderar el tratamiento.',
  },
  {
    id: 'tirz', generico: 'Tirzepatida', comercial: 'Mounjaro', via: 'Inyección subcutánea semanal', frecuencia: 'semanal', unidad: 'mg',
    para: ['obesidad', 'dm2'], color: '#8b5cf6',
    disponible: 'Comercializado en Argentina desde diciembre de 2025 (obesidad y diabetes tipo 2).',
    pasos: [{ dosis: 2.5, dias: 28 }, { dosis: 5, dias: 28 }, { dosis: 7.5, dias: 28 }, { dosis: 10, dias: 28 }, { dosis: 12.5, dias: 28 }, { dosis: 15, dias: null }],
    mantenimiento: '5, 10 o 15 mg por semana: la dosis más alta tolerada que logre el objetivo. Subir de a 2,5 mg cada ≥ 4 semanas.',
    eficacia: { emax: 21.5, tau: 24, k: 1.3, texto: 'SURMOUNT-1: −15,0 / −19,5 / −20,9 % con 5 / 10 / 15 mg a 72 semanas. SURMOUNT-5: −20,2 % frente a −13,7 % con semaglutida.' },
    administracion: 'Una vez por semana, el mismo día, con o sin comidas. Abdomen, muslo o brazo, rotando el sitio.',
    olvido: 'Aplicar la dosis omitida dentro de los 4 días (96 h); si pasó más tiempo, saltearla y seguir el día habitual. Deben pasar al menos 3 días entre dos dosis.',
    respuesta: 'Evaluar a las 12–16 semanas con dosis efectiva: si el descenso es < 5 %, reconsiderar.',
  },
  {
    id: 'sema-dm', generico: 'Semaglutida', comercial: 'Ozempic', via: 'Inyección subcutánea semanal', frecuencia: 'semanal', unidad: 'mg',
    para: ['dm2'], color: '#0ea5e9',
    disponible: 'Aprobado en Argentina para diabetes tipo 2.',
    pasos: [{ dosis: 0.25, dias: 28 }, { dosis: 0.5, dias: 28 }, { dosis: 1, dias: 28 }, { dosis: 2, dias: null }],
    mantenimiento: '0,5 a 2 mg por semana según control glucémico. 1 mg es la dosis con beneficio renal (FLOW).',
    eficacia: { emax: 6.5, tau: 16, k: 1.2, texto: 'SUSTAIN: −4 a −6,5 % de peso; HbA1c −1,5 a −1,8 %.' },
    administracion: 'Una vez por semana, el mismo día, con o sin comidas.',
    olvido: 'Si faltan más de 2 días para la próxima dosis, aplicarla; si no, saltearla.',
    respuesta: 'Evaluar HbA1c a los 3 meses.',
  },
  {
    id: 'lira-ob', generico: 'Liraglutida', comercial: 'Saxenda', via: 'Inyección subcutánea diaria', frecuencia: 'diaria', unidad: 'mg',
    para: ['obesidad'], color: '#14b8a6',
    disponible: 'Aprobado en Argentina para obesidad.',
    pasos: [{ dosis: 0.6, dias: 7 }, { dosis: 1.2, dias: 7 }, { dosis: 1.8, dias: 7 }, { dosis: 2.4, dias: 7 }, { dosis: 3, dias: null }],
    mantenimiento: '3 mg por día.',
    eficacia: { emax: 8.4, tau: 14, k: 1.2, texto: 'SCALE: −8,0 % a 56 semanas (placebo −2,6 %).' },
    administracion: 'Una vez por día, a la misma hora, con o sin comidas.',
    olvido: 'Si pasaron menos de 12 h, aplicarla; si no, saltearla. Si se omiten más de 3 días, reiniciar con 0,6 mg y volver a titular.',
    respuesta: 'Suspender si a las 12 semanas con 3 mg el descenso es < 5 % (prospecto).',
  },
  {
    id: 'sema-oral', generico: 'Semaglutida oral', comercial: 'Rybelsus', via: 'Comprimido diario', frecuencia: 'diaria', unidad: 'mg',
    para: ['dm2'], color: '#06b6d4',
    disponible: 'Aprobado en Argentina para diabetes tipo 2 (verificar la presentación vigente).',
    pasos: [{ dosis: 3, dias: 30 }, { dosis: 7, dias: 30 }, { dosis: 14, dias: null }],
    mantenimiento: '7 o 14 mg por día.',
    eficacia: { emax: 4.5, tau: 16, k: 1.2, texto: 'PIONEER: −2 a −4,5 % de peso; HbA1c −1 a −1,4 %.' },
    administracion: 'En ayunas, con no más de 120 mL de agua, 30 minutos antes de comer o tomar otros medicamentos.',
    olvido: 'Saltear la dosis olvidada y tomar la siguiente al día siguiente.',
    respuesta: 'Evaluar HbA1c a los 3 meses.',
  },
  {
    id: 'dula', generico: 'Dulaglutida', comercial: 'Trulicity', via: 'Inyección subcutánea semanal', frecuencia: 'semanal', unidad: 'mg',
    para: ['dm2'], color: '#f59e0b',
    disponible: 'Aprobado en Argentina para diabetes tipo 2 (verificar disponibilidad).',
    pasos: [{ dosis: 0.75, dias: 28 }, { dosis: 1.5, dias: 28 }, { dosis: 3, dias: 28 }, { dosis: 4.5, dias: null }],
    mantenimiento: '1,5 a 4,5 mg por semana.',
    eficacia: { emax: 4.5, tau: 16, k: 1.2, texto: 'AWARD-11: −3 a −4,7 kg; REWIND: −12 % de eventos cardiovasculares.' },
    administracion: 'Una vez por semana, con o sin comidas.',
    olvido: 'Si faltan 3 días o más para la próxima dosis, aplicarla; si no, saltearla.',
    respuesta: 'Evaluar HbA1c a los 3 meses.',
  },
];

/** Novedades internacionales aún no comercializadas en Argentina (sin esquema de dosis en la app). */
export const NOVEDADES = [
  { nombre: 'Semaglutida 7,2 mg (Wegovy)', estado: 'UE feb-2026, FDA mar-2026', dato: 'STEP UP: ~ −21 % a 72 semanas.' },
  { nombre: 'Semaglutida oral 25 mg (Wegovy comprimidos)', estado: 'FDA dic-2025', dato: 'OASIS 4: −13,6 % (−16,6 % en tratamiento) a 64 semanas.' },
  { nombre: 'Orforglipron (Foundayo)', estado: 'FDA abr-2026', dato: 'GLP-1 oral no peptídico, sin ayuno. ATTAIN-1: −12,4 %.' },
];

export const farmaco = (id) => FARMACOS.find((f) => f.id === id);
export const fmtDosis = (n) => String(n).replace('.', ',');

/* ---------- Interacciones por clase ---------- */
const INTERACCIONES = {
  insulina: ['alta', 'Riesgo de hipoglucemia al sumar el agonista.', 'Reducir la insulina basal 10–20 % al iniciar si la HbA1c es < 8 % y en cada escalamiento; automonitoreo de glucemia.'],
  sulfonilurea: ['alta', 'Riesgo de hipoglucemia.', 'Reducir la dosis a la mitad o suspender, sobre todo si la HbA1c es < 8 %.'],
  meglitinida: ['moderada', 'Riesgo de hipoglucemia.', 'Reducir o suspender según las glucemias.'],
  dpp4: ['alta', 'Misma vía de las incretinas: sin beneficio adicional y más efectos adversos.', 'Suspender el inhibidor de DPP-4 al iniciar.'],
  glp1: ['alta', 'Ya recibe un agonista de GLP-1 / GIP.', 'No combinar dos agonistas: rotar o ajustar el actual.'],
  avk: ['moderada', 'El vaciamiento gástrico lento puede cambiar la absorción; se describieron variaciones del RIN.', 'RIN al iniciar y en cada escalamiento.'],
  levotiroxina: ['moderada', 'La semaglutida oral aumenta ~33 % la exposición a levotiroxina; el vaciamiento lento puede alterar su absorción.', 'TSH a las 6–8 semanas; con semaglutida oral, tomarlas separadas.'],
  aco: ['moderada', 'Tirzepatida reduce la exposición al anticonceptivo oral (al iniciar y en cada aumento); los vómitos o la diarrea también.', 'Con tirzepatida: método no oral, o sumar método de barrera 4 semanas desde el inicio y desde cada aumento de dosis.'],
  digoxina: ['moderada', 'Margen terapéutico estrecho: absorción variable.', 'Controlar digoxinemia y síntomas.'],
  litio: ['moderada', 'Margen estrecho; vómitos o diarrea elevan la litemia.', 'Litemia al iniciar y ante síntomas digestivos.'],
  antiepileptico: ['moderada', 'Margen estrecho: absorción variable.', 'Controlar niveles plasmáticos.'],
  inmunosupresor: ['moderada', 'Margen estrecho: absorción variable.', 'Controlar niveles plasmáticos.'],
  teofilina: ['moderada', 'Margen estrecho.', 'Controlar niveles.'],
  diuretico: ['moderada', 'Con vómitos o diarrea, riesgo de deshidratación e insuficiencia renal aguda.', 'Hidratación adecuada; ante pérdidas digestivas, suspender transitoriamente ("días de enfermedad").'],
  ieca: ['moderada', 'Riesgo de insuficiencia renal aguda si hay deshidratación.', 'Hidratación; suspender transitoriamente ante vómitos o diarrea importantes.'],
  ara2: ['moderada', 'Riesgo de insuficiencia renal aguda si hay deshidratación.', 'Hidratación; suspender transitoriamente ante vómitos o diarrea importantes.'],
  sglt2: ['moderada', 'Deshidratación y, con pérdidas digestivas, riesgo de cetoacidosis euglucémica.', 'Suspender transitoriamente en días de enfermedad.'],
  aine: ['moderada', 'Suma riesgo renal si hay deshidratación.', 'Evitar el uso crónico; hidratación.'],
  opioide: ['baja', 'Suman enlentecimiento digestivo y constipación.', 'Prevenir la constipación; vigilar íleo.'],
  anticolinergico: ['baja', 'Suman enlentecimiento digestivo y constipación.', 'Prevenir la constipación.'],
  orlistat: ['baja', 'Más síntomas digestivos.', 'Evaluar si conviene mantenerlo.'],
};

/** Fármacos que favorecen el aumento de peso: revisar alternativas. */
const OBESOGENOS = {
  antipsicotico: 'Los antipsicóticos atípicos (olanzapina, clozapina, quetiapina) aumentan el peso: evaluar alternativa con psiquiatría.',
  corticoide: 'Los corticoides sistémicos crónicos aumentan el peso y la glucemia.',
  antidepresivoPeso: 'Mirtazapina, paroxetina y tricíclicos aumentan el peso: considerar bupropión o ISRS neutros.',
  gabapentinoide: 'Gabapentin y pregabalina pueden aumentar el peso.',
  valproato: 'El valproato aumenta el peso: considerar alternativa con neurología.',
  betabloqueante: 'Atenolol y metoprolol pueden aumentar el peso; carvedilol o nebivolol son más neutros.',
  insulina: 'La insulina aumenta el peso: el agonista suele permitir reducirla.',
  sulfonilurea: 'Las sulfonilureas aumentan el peso: suelen poder suspenderse.',
  pioglitazona: 'La pioglitazona aumenta el peso y la retención hídrica.',
};

/* ---------- Efectos adversos ---------- */
export const EFECTOS_ADVERSOS = {
  muyFrecuentes: [
    ['Náuseas', 'semaglutida 44 % · tirzepatida 25–31 %'],
    ['Diarrea', '30 % · 19–23 %'],
    ['Vómitos', '24 % · 8–12 %'],
    ['Constipación', '24 % · 11–17 %'],
    ['Dolor abdominal', '~20 %'],
    ['Cefalea y fatiga', '11–14 %'],
  ],
  frecuentes: [
    ['Dispepsia, reflujo, eructos, distensión', ''],
    ['Mareos', ''],
    ['Hipoglucemia', 'en diabetes con insulina o sulfonilureas'],
    ['Caída del cabello', '~3 %, transitoria, ligada al descenso rápido'],
    ['Litiasis biliar', '1,6–2,6 %'],
    ['Aumento de la frecuencia cardíaca', '+1 a +4 latidos/min'],
    ['Reacción en el sitio de inyección', ''],
  ],
  raros: [
    ['Pancreatitis aguda', '~0,2 %'],
    ['Colecistitis', ''],
    ['Insuficiencia renal aguda por deshidratación', ''],
    ['Empeoramiento de retinopatía diabética', 'con descensos rápidos de HbA1c'],
    ['Íleo / obstrucción intestinal', ''],
    ['Broncoaspiración en anestesia o sedación', ''],
    ['Neuropatía óptica isquémica (NAION)', 'muy rara (EMA 2025, semaglutida)'],
    ['Hipersensibilidad / anafilaxia', ''],
  ],
  otros: [
    'Pérdida de masa magra: 25–40 % del peso perdido. Proteínas 1,2–1,6 g/kg/día y ejercicio de fuerza 2–3 veces por semana.',
    'Al suspender se recupera peso: dos tercios en un año (STEP-1 extensión); +14 % en SURMOUNT-4. Es un tratamiento crónico.',
  ],
};

/** Señales de alarma para el paciente (consulta urgente). */
export const ALARMAS = [
  'Dolor abdominal intenso y persistente, que puede irradiarse a la espalda, con o sin vómitos (posible pancreatitis).',
  'Vómitos o diarrea que impiden tomar líquidos, orinar poco o mareos al pararse (deshidratación).',
  'Dolor en la parte alta derecha del abdomen, fiebre u ojos amarillos (vesícula).',
  'Bulto en el cuello, ronquera persistente o dificultad para tragar.',
  'Pérdida brusca de la visión en un ojo.',
  'Ideas de lastimarse o tristeza que empeora.',
  'Hinchazón de cara o labios, ronchas generalizadas o falta de aire (alergia).',
];

/* ---------- Evaluación ---------- */

function contraindicaciones(c) {
  const p = c.pat || {}, f = c.fam || {};
  const abs = [], rel = [];
  if (p.cmtPersonal || f.cmt) abs.push(['cmt', 'Antecedente personal o familiar de carcinoma medular de tiroides', 'Contraindicación del prospecto (advertencia en recuadro).']);
  if (p.men2 || f.men2) abs.push(['men2', 'Neoplasia endocrina múltiple tipo 2 (personal o familiar)', 'Contraindicación del prospecto.']);
  if (p.embarazo) abs.push(['embarazo', 'Embarazo', 'Suspender; el descenso de peso no está indicado durante el embarazo.']);
  if (p.lactancia) abs.push(['lactancia', 'Lactancia', 'No usar durante la lactancia.']);
  if (p.buscaEmbarazo) abs.push(['busca', 'Búsqueda de embarazo', 'Suspender semaglutida ≥ 2 meses antes de buscar embarazo.']);
  if (p.alergiaGlp1) abs.push(['alergia', 'Hipersensibilidad previa a un agonista de GLP-1', 'No reexponer.']);
  if (p.tca) abs.push(['tca', 'Trastorno de la conducta alimentaria restrictivo o purgativo', 'Contraindicación clínica: derivar a salud mental.']);
  if (Number.isFinite(c.imc) && c.imc < 18.5) abs.push(['bajo', 'Bajo peso (IMC < 18,5)', 'No hay indicación de descenso de peso.']);

  if (p.dm1) rel.push(['dm1', 'Diabetes tipo 1', 'No indicado para el control glucémico ni la cetoacidosis; el uso para obesidad con DM1 es fuera de prospecto.']);
  if (p.pancreatitis) rel.push(['pancreatitis', 'Pancreatitis previa', 'No estudiado: usar con mucha cautela o evitar; suspender ante dolor abdominal persistente.']);
  if (Number.isFinite(c.labs?.tg) && c.labs.tg >= 500) rel.push(['tg500', 'Triglicéridos ≥ 500 mg/dL', 'Riesgo de pancreatitis: tratar primero la hipertrigliceridemia.']);
  if (p.litiasisBiliar) rel.push(['vesicula', 'Litiasis biliar / colecistitis previa', 'El descenso rápido aumenta el riesgo biliar: vigilar síntomas.']);
  if (p.gastroparesia) rel.push(['gastroparesia', 'Gastroparesia o enfermedad digestiva grave', 'No recomendado: empeora el vaciamiento gástrico.']);
  if (p.retinopatia && (p.dm2 || p.dm1)) rel.push(['retino', 'Retinopatía diabética', 'Con semaglutida hubo más complicaciones (SUSTAIN-6): fondo de ojo antes y durante; evitar descensos bruscos de HbA1c.']);
  if (p.naion) rel.push(['naion', 'Neuropatía óptica isquémica previa', 'La EMA (2025) incorporó NAION como efecto muy raro de semaglutida: evitarla.']);
  if (p.ideacionSuicida) rel.push(['suicidio', 'Antecedente de ideación suicida', 'Vigilar el ánimo en cada control; suspender si reaparece.']);
  else if (p.depresion) rel.push(['depresion', 'Depresión', 'Vigilar el estado de ánimo en cada control.']);
  if (Number.isFinite(c.tfg) && c.tfg < 30) rel.push(['erc', 'Filtrado glomerular < 30', 'Experiencia limitada: extremar la hidratación y vigilar la función renal.']);
  if (p.cirugiaProgramada) rel.push(['cirugia', 'Cirugía o endoscopía programada', 'Informar al anestesiólogo: dieta líquida 24 h antes o suspender la dosis semanal 1 semana antes, según el riesgo (consenso multisociedad 2024).']);
  if (Number.isFinite(c.edad) && c.edad >= 75) rel.push(['mayor', 'Edad ≥ 75 años', 'Riesgo de sarcopenia y deshidratación: objetivo moderado, proteínas y fuerza.']);
  if (c.alcohol === 'riesgo') rel.push(['alcohol', 'Consumo de alcohol de riesgo', 'Aumenta el riesgo de pancreatitis e hipoglucemia.']);
  if (p.cirugiaBariatrica) rel.push(['bariatrica', 'Cirugía bariátrica previa', 'Puede usarse ante reganancia; vigilar déficit nutricional y tolerancia.']);
  const map = ([id, texto, conducta]) => ({ id, texto, conducta });
  return { absolutas: abs.map(map), relativas: rel.map(map) };
}

function interacciones(meds) {
  const clases = clasesDe(meds);
  const out = [], peso = [];
  for (const m of meds) {
    const mc = clasesDe([m]);
    for (const cl of mc) {
      const i = INTERACCIONES[cl];
      if (i) out.push({ farmaco: m.nombre, clase: CLASES[cl] || cl, claseId: cl, severidad: i[0], efecto: i[1], conducta: i[2] });
      if (OBESOGENOS[cl]) peso.push({ farmaco: m.nombre, texto: OBESOGENOS[cl] });
    }
  }
  const orden = { alta: 0, moderada: 1, baja: 2 };
  out.sort((a, b) => orden[a.severidad] - orden[b.severidad]);
  return { lista: out, obesogenos: peso, clases };
}

function puntuar(f, c, ci) {
  const p = c.pat || {};
  let s = 0;
  const porque = [], cuidado = [];
  const ecv = p.iam || p.acv || p.eap || p.revasc;
  if (f.id === 'sema-ob') {
    s = 7;
    // En prevención secundaria manda la reducción de eventos, no la magnitud del descenso.
    if (ecv) { s += 10; porque.push('Enfermedad cardiovascular establecida: reducción probada de infarto, ACV y muerte cardiovascular (SELECT: −20 %). Prioridad en prevención secundaria.'); }
    if (p.ic) { s += 2; porque.push('Mejora síntomas en insuficiencia cardíaca con fracción preservada (STEP-HFpEF).'); }
    if (p.higadoGraso && (c.fib4 >= 1.3 || p.mash)) { s += 2; porque.push('Resolución de esteatohepatitis y mejoría de fibrosis F2–F3 (ESSENCE; FDA 2025).'); }
    if (p.artrosis) { s += 1; porque.push('Menos dolor en artrosis de rodilla (STEP 9).'); }
    if (p.erc && p.dm2) { s += 1; porque.push('Protección renal con semaglutida en DM2 (FLOW).'); }
  }
  if (f.id === 'tirz') {
    s = 8;
    porque.push('Mayor descenso de peso disponible en Argentina (SURMOUNT-5: −20,2 % frente a −13,7 %).');
    if (c.imc >= 35) { s += 3; porque.push('IMC ≥ 35: conviene la opción más potente.'); }
    if (p.sahos) { s += 3; porque.push('Aprobada para apnea del sueño moderada a grave con obesidad (SURMOUNT-OSA).'); }
    if (p.dm2) { s += 2; porque.push('En DM2 baja más la HbA1c y el peso que semaglutida 1 mg (SURPASS-2).'); }
    if (p.ic) { s += 1; porque.push('Menos eventos de insuficiencia cardíaca con fracción preservada (SUMMIT).'); }
    if (ecv) cuidado.push(p.dm2 ? 'Con ECV establecida: en DM2 fue no inferior a dulaglutida en eventos (SURPASS-CVOT), pero la evidencia más sólida de reducción de eventos con obesidad es la de semaglutida 2,4 mg (SELECT).' : 'Sin ensayo de eventos cardiovasculares en obesidad sin diabetes: con ECV establecida se prefiere semaglutida 2,4 mg.');
    if (c.clases.has('aco')) { s -= 1; cuidado.push('Reduce el efecto del anticonceptivo oral: usar método de barrera o no oral.'); }
  }
  if (f.id === 'sema-dm') {
    s = 6;
    if (p.erc || c.erc?.erc) { s += 3; porque.push('Diabetes con enfermedad renal: reduce 24 % los eventos renales (FLOW, 1 mg).'); }
    if (ecv) { s += 5; porque.push('Reducción de eventos cardiovasculares en DM2 (SUSTAIN-6).'); }
    if (c.indicObesidad) cuidado.push('Para bajar de peso, la dosis de Wegovy (2,4 mg) es más eficaz.');
  }
  if (f.id === 'lira-ob') {
    s = 3;
    porque.push('Alternativa diaria con más años de experiencia de uso.');
    cuidado.push('Menor eficacia (−8 %) y aplicación diaria.');
  }
  if (f.id === 'sema-oral') {
    s = 4;
    if (p.fobiaAgujas || c.prefiereOral) { s += 3; porque.push('Prefiere evitar inyecciones.'); }
    cuidado.push('Exige tomarla en ayunas, con poca agua, 30 minutos antes de comer.');
    if (c.clases.has('levotiroxina')) cuidado.push('Aumenta la exposición a levotiroxina: control de TSH.');
  }
  if (f.id === 'dula') {
    s = 4;
    if (ecv) { s += 4; porque.push('Reducción de eventos cardiovasculares en DM2 (REWIND).'); }
    cuidado.push('Menor efecto sobre el peso que semaglutida o tirzepatida.');
  }
  // Penalizaciones por contraindicaciones relativas propias de la molécula
  const rel = new Set(ci.relativas.map((r) => r.id));
  if (f.generico.startsWith('Semaglutida')) {
    if (rel.has('retino')) { s -= 3; cuidado.push('Retinopatía: con semaglutida hubo más complicaciones retinianas.'); }
    if (rel.has('naion')) { s -= 6; cuidado.push('NAION previa: evitar semaglutida.'); }
  }
  return { s, porque, cuidado };
}

/**
 * Evaluación completa para un paciente.
 * c: { edad, sexo, imc, peso, talla, pat, fam, meds, labs, tfg, erc, fib4, alcohol, cintura, comp, prefiereOral, glucemia }
 */
export function evaluar(c) {
  const pat = c.pat || {};
  const meds = c.meds || [];
  const inter = interacciones(meds);
  const ctx = { ...c, clases: inter.clases };
  const base = {
    fecha: FECHA_REVISION,
    interacciones: inter.lista,
    obesogenos: inter.obesogenos,
    efectos: EFECTOS_ADVERSOS,
    alarmas: ALARMAS,
    novedades: NOVEDADES,
    yaRecibe: inter.clases.has('glp1'),
  };

  if (!Number.isFinite(c.edad)) return { ...base, veredicto: 'incompleto', titulo: 'Faltan datos', resumen: 'Cargá la fecha de nacimiento.' };
  if (c.edad < 18) {
    return { ...base, veredicto: 'fuera', titulo: 'Fuera del alcance del motor',
      resumen: 'Menor de 18 años: semaglutida 2,4 mg está aprobada desde los 12 años con IMC ≥ percentil 95, pero la evaluación corresponde a un equipo pediátrico especializado.' };
  }
  if (!Number.isFinite(c.imc)) return { ...base, veredicto: 'incompleto', titulo: 'Faltan datos', resumen: 'Cargá peso y talla para evaluar la indicación.' };

  const ci = contraindicaciones(ctx);
  const ecv = pat.iam || pat.acv || pat.eap || pat.revasc;
  const comorb = comorbilidades(pat, {
    ercLab: c.erc?.erc, prediabetesLab: c.glucemia === 'pre',
    dislipemiaLab: (c.labs?.tg >= 150) || (Number.isFinite(c.ldl) && c.ldl >= 160),
    htaPa: c.pas >= 130 || c.pad >= 80,
  });
  const indic = [];
  const indicObesidad = c.imc >= 30 || (c.imc >= 27 && comorb.length > 0);
  if (c.imc >= 30) indic.push(`Obesidad (IMC ${c.imc.toFixed(1).replace('.', ',')}).`);
  else if (c.imc >= 27 && comorb.length) indic.push(`Sobrepeso con IMC ≥ 27 y comorbilidad: ${comorb.join(', ').toLowerCase()}.`);
  if (pat.dm2) indic.push('Diabetes tipo 2: agonista de GLP-1 o tirzepatida como opción preferente si hay obesidad, enfermedad cardiovascular o renal (ADA 2026).');
  if (ecv && c.imc >= 27) indic.push('Enfermedad cardiovascular establecida con IMC ≥ 27: semaglutida 2,4 mg redujo 20 % los eventos (SELECT).');
  ctx.indicObesidad = indicObesidad;

  const alternativas = [
    'Plan de alimentación con déficit moderado (500–750 kcal/día) y proteínas suficientes, 150–300 min/semana de actividad aeróbica y fuerza 2–3 veces por semana: es la base de cualquier tratamiento.',
  ];
  if (pat.prediabetes || c.glucemia === 'pre') alternativas.push('Prediabetes: metformina si IMC ≥ 35, edad < 60 años o diabetes gestacional previa (ADA).');
  if (c.imc >= 35 || (c.imc >= 30 && pat.dm2)) alternativas.push('Cirugía bariátrica / metabólica: evaluar derivación (ASMBS/IFSO 2022: IMC ≥ 35, o ≥ 30 con diabetes tipo 2).');
  if (indicObesidad) alternativas.push('Si los agonistas están contraindicados: orlistat 120 mg con cada comida principal (−3 a −4 %).');
  if (pat.tca) alternativas.push('Derivación a salud mental especializada en trastornos alimentarios.');

  const comun = { ...base, contraindicaciones: ci, comorbilidades: comorb, indicaciones: indic, alternativas };

  if (ci.absolutas.length) {
    return { ...comun, veredicto: 'contraindicado', titulo: 'No usar agonistas de GLP-1',
      resumen: `Hay ${ci.absolutas.length === 1 ? 'una contraindicación' : ci.absolutas.length + ' contraindicaciones'}: ${ci.absolutas.map((a) => a.texto.toLowerCase()).join('; ')}.`, opciones: [] };
  }
  if (!indic.length) {
    const resumen = c.imc >= 25
      ? 'Sobrepeso sin comorbilidades: no cumple criterios de tratamiento farmacológico. Priorizar alimentación y actividad física. El uso con fines estéticos no está indicado ni aprobado.'
      : 'IMC en rango saludable: no hay indicación de fármacos para bajar de peso. Los agonistas de GLP-1 no deben usarse con fines estéticos.';
    return { ...comun, veredicto: 'no-indicado', titulo: 'No indicado', resumen, opciones: [] };
  }

  const tipos = new Set();
  if (indicObesidad) tipos.add('obesidad');
  if (pat.dm2) tipos.add('dm2');
  const opciones = FARMACOS.filter((f) => f.para.some((t) => tipos.has(t)))
    .map((f) => {
      const r = puntuar(f, ctx, ci);
      const dm = !!pat.dm2;
      const pct = proyeccionPct(f, 72, dm);
      return { farmaco: f, puntaje: r.s, porque: r.porque, cuidado: r.cuidado, perdida72: pct, pesoFinal: c.peso ? c.peso * (1 - pct / 100) : null };
    })
    .sort((a, b) => b.puntaje - a.puntaje);

  const veredicto = ci.relativas.length ? 'precaucion' : 'indicado';
  const top = opciones[0]?.farmaco;
  const metaPct = c.imc >= 35 || pat.sahos || pat.higadoGraso || pat.dm2 ? 15 : 10;
  return {
    ...comun,
    veredicto,
    titulo: veredicto === 'indicado' ? 'Candidato a tratamiento' : 'Candidato, con precauciones',
    resumen: `${indic[0]} Opción sugerida: ${top.generico} (${top.comercial}). ${veredicto === 'precaucion' ? 'Revisar las precauciones antes de indicar.' : ''}`.trim(),
    opciones,
    objetivo: { pct: metaPct, peso: c.peso ? c.peso * (1 - metaPct / 100) : null, inicial: 5 },
    monitoreo: monitoreo(ctx, ci),
  };
}

function monitoreo(c, ci) {
  const p = c.pat || {};
  const m = [
    'Cada 4 semanas durante la titulación: tolerancia digestiva, peso, cintura, presión y frecuencia cardíaca. Escalar solo si tolera; si no, mantener la dosis 4 semanas más.',
    'A las 12–16 semanas con dosis efectiva: descenso ≥ 5 % para continuar.',
    'Cada 3 meses: peso, cintura, presión arterial, glucemia; perfil lipídico y función renal a los 6 meses.',
    'Ingesta de proteínas 1,2–1,6 g/kg/día, hidratación ≥ 1,5–2 L/día y ejercicio de fuerza para cuidar la masa muscular.',
  ];
  if (p.dm2) m.push('Diabetes: glucemias capilares y HbA1c a los 3 meses; ajustar insulina o sulfonilureas.');
  if (p.retinopatia) m.push('Fondo de ojo antes de iniciar y al año (antes si baja la visión).');
  if (c.sexo === 'F' && c.edad < 50) m.push('Anticoncepción eficaz; test de embarazo ante atraso menstrual. La pérdida de peso puede aumentar la fertilidad (p. ej., en SOP).');
  m.push(ci.relativas.some((r) => r.id === 'vesicula' || r.id === 'pancreatitis')
    ? 'Antecedente biliar o pancreático: interrogar en cada control dolor en hipocondrio derecho o abdominal persistente; ecografía ante síntomas.'
    : 'Interrogar dolor en hipocondrio derecho (riesgo biliar) y dolor abdominal persistente (pancreatitis).');
  if (p.depresion || p.ideacionSuicida) m.push('Estado de ánimo en cada control.');
  m.push('Antes de cirugías, endoscopías o sedaciones: avisar que recibe el fármaco.');
  return m;
}

/* ---------- Titulación ---------- */
const DIA = 86400000;

/** Esquema con fechas a partir de un inicio 'AAAA-MM-DD'. */
export function esquema(id, inicioISO, hastaPaso = null) {
  const f = farmaco(id);
  if (!f) return [];
  const t0 = new Date(inicioISO + 'T12:00:00');
  let d = 0;
  const pasos = hastaPaso != null ? f.pasos.slice(0, hastaPaso + 1) : f.pasos;
  return pasos.map((p, i) => {
    const desde = new Date(t0.getTime() + d * DIA);
    const fin = i === pasos.length - 1 ? null : p.dias;
    const hasta = fin ? new Date(t0.getTime() + (d + fin - 1) * DIA) : null;
    const item = {
      paso: i + 1, dosis: p.dosis, unidad: f.unidad, frecuencia: f.frecuencia,
      desde: desde.toISOString().slice(0, 10), hasta: hasta ? hasta.toISOString().slice(0, 10) : null,
      semanaDesde: Math.floor(d / 7) + 1, semanaHasta: fin ? Math.floor((d + fin - 1) / 7) + 1 : null,
      mantenimiento: !fin,
    };
    d += fin || 0;
    return item;
  });
}

/** Paso vigente de un esquema para una fecha. */
export function pasoVigente(esq, hoyISO) {
  if (!esq?.length) return null;
  let actual = null;
  for (const p of esq) if (p.desde <= hoyISO) actual = p;
  return actual;
}

/* ---------- Proyección de peso ---------- */
const FACTOR_DM2 = 0.67; // STEP-2 y SURMOUNT-2: ~2/3 del efecto en personas con diabetes

export function proyeccionPct(f, semana, dm2 = false) {
  if (!f || semana <= 0) return 0;
  const { emax, tau, k } = f.eficacia;
  const e = f.para.includes('obesidad') && dm2 ? emax * FACTOR_DM2 : emax;
  return e * (1 - Math.exp(-((semana / tau) ** k)));
}

/** Curva semanal: { s, pct, peso, bajo, alto } con suspensión opcional. */
export function proyeccion(id, pesoInicial, { semanas = 72, dm2 = false, suspenderEn = null } = {}) {
  const f = id === 'placebo' ? { para: ['obesidad'], eficacia: { emax: 2.6, tau: 20, k: 1.2 } } : farmaco(id);
  if (!f || !Number.isFinite(pesoInicial)) return [];
  const out = [];
  for (let s = 0; s <= semanas; s++) {
    let pct;
    if (suspenderEn != null && s > suspenderEn) {
      const perdida = proyeccionPct(f, suspenderEn, dm2);
      const rec = 0.67 * (1 - Math.exp(-(s - suspenderEn) / 20)); // recupera ~2/3 en un año
      pct = perdida * (1 - rec);
    } else pct = proyeccionPct(f, s, dm2);
    out.push({ s, pct, peso: pesoInicial * (1 - pct / 100), bajo: pesoInicial * (1 - (pct * 1.35) / 100), alto: pesoInicial * (1 - (pct * 0.6) / 100) });
  }
  return out;
}

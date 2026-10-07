/* ============================================================
   Base de conocimiento ampliable
   ------------------------------------------------------------
   Lo que el paciente o el médico cargan como "otra enfermedad",
   "otro análisis" u "otro medicamento" se reconoce acá por nombre
   o sinónimo y pasa a influir en:
     - la decisión sobre GLP-1 / GIP (contraindicaciones y precauciones),
     - el plan de alimentación, de actividad física y de tratamiento.
   Lo que no se reconoce queda marcado para revisión del médico (y
   entra igual en el análisis con IA, si está configurado).
   Revisado: octubre 2026. Para sumar algo nuevo, agregar una entrada.
   ============================================================ */

export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- Enfermedades ----------
   glp1: { tipo: 'absoluta' | 'relativa', texto, conducta }
   dieta / actividad / tratamiento: recomendaciones que se suman al plan */
export const ENFERMEDADES = [
  { id: 'gota', nombre: 'Gota / ácido úrico alto', sin: ['gota', 'hiperuricemia', 'acido urico alto', 'podagra'],
    dieta: ['Bajo en purinas: limitar vísceras, mariscos, carnes rojas y cerveza; evitar bebidas azucaradas con fructosa.', 'Hidratación de 2 a 3 litros por día si no hay restricción.'],
    tratamiento: ['Descenso de peso gradual: el ayuno o la pérdida brusca pueden desencadenar crisis.'] },
  { id: 'epoc', nombre: 'EPOC', sin: ['epoc', 'enfisema', 'bronquitis cronica', 'enfermedad pulmonar obstructiva'],
    actividad: ['Rehabilitación respiratoria; intervalos cortos y broncodilatador previo según indicación.'], dieta: ['Asegurar proteínas suficientes: riesgo de pérdida muscular.'] },
  { id: 'asma', nombre: 'Asma', sin: ['asma', 'asmatico', 'broncoespasmo'], actividad: ['Entrada en calor larga; tener el broncodilatador de rescate a mano.'] },
  { id: 'cirrosis', nombre: 'Cirrosis hepática', sin: ['cirrosis', 'hepatopatia cronica', 'insuficiencia hepatica'],
    glp1: { tipo: 'relativa', texto: 'Cirrosis', conducta: 'Experiencia limitada en cirrosis descompensada (Child-Pugh B/C): decidir con hepatología.' },
    dieta: ['Proteínas 1,2–1,5 g/kg; colación nocturna; sodio < 2 g si hay ascitis. Alcohol: cero.'] },
  { id: 'hepatitis', nombre: 'Hepatitis crónica', sin: ['hepatitis b', 'hepatitis c', 'hepatitis cronica', 'hepatitis autoinmune'], dieta: ['Alcohol: cero.'] },
  { id: 'eii', nombre: 'Enfermedad inflamatoria intestinal', sin: ['crohn', 'enfermedad de crohn', 'colitis ulcerosa', 'eii', 'enfermedad inflamatoria intestinal'],
    glp1: { tipo: 'relativa', texto: 'Enfermedad inflamatoria intestinal', conducta: 'Los síntomas digestivos pueden confundirse con un brote: iniciar solo en remisión y con gastroenterología.' },
    dieta: ['Adaptar fibra según actividad de la enfermedad; evitar ultraprocesados.'] },
  { id: 'diverticulitis', nombre: 'Diverticulitis', sin: ['diverticulitis', 'diverticulosis', 'diverticulos'],
    glp1: { tipo: 'relativa', texto: 'Enfermedad diverticular', conducta: 'Prevenir la constipación (fibra, agua); consultar ante dolor abdominal con fiebre.' },
    dieta: ['Fibra 25–35 g/día y agua abundante.'] },
  { id: 'erge', nombre: 'Reflujo / hernia hiatal', sin: ['reflujo', 'erge', 'hernia hiatal', 'esofagitis', 'acidez'],
    glp1: { tipo: 'relativa', texto: 'Reflujo gastroesofágico / hernia hiatal', conducta: 'El vaciamiento gástrico lento puede empeorar el reflujo: porciones chicas, no acostarse después de comer.' },
    dieta: ['Cenar 3 horas antes de acostarse; evitar fritos, chocolate, café, alcohol y mate en exceso.'] },
  { id: 'celiaquia', nombre: 'Enfermedad celíaca', sin: ['celiaquia', 'celiaco', 'celiaca', 'intolerancia al gluten'], dieta: ['Alimentación estricta sin TACC (trigo, avena, cebada, centeno).'] },
  { id: 'colecistectomia', nombre: 'Colecistectomía', sin: ['colecistectomia', 'sin vesicula', 'le sacaron la vesicula', 'extirpacion de vesicula'],
    tratamiento: ['Sin vesícula no hay riesgo de colelitiasis con el descenso de peso (sí de otras complicaciones biliares, raras).'] },
  { id: 'litiasisRenal', nombre: 'Cálculos renales', sin: ['calculos renales', 'litiasis renal', 'nefrolitiasis', 'piedras en el rinon'],
    dieta: ['Agua ≥ 2,5 L/día, sal < 5 g/día, proteína animal moderada; no restringir el calcio de los alimentos.'] },
  { id: 'osteoporosis', nombre: 'Osteoporosis', sin: ['osteoporosis', 'osteopenia'],
    dieta: ['Calcio 1000–1200 mg/día con los alimentos y vitamina D suficiente.'], actividad: ['Fuerza y ejercicios de impacto moderado y equilibrio; evitar flexiones bruscas de columna.'],
    tratamiento: ['El descenso de peso reduce la densidad ósea: asegurar proteínas, calcio, vitamina D y entrenamiento de fuerza.'] },
  { id: 'sarcopenia', nombre: 'Sarcopenia / fragilidad', sin: ['sarcopenia', 'fragilidad', 'perdida muscular'],
    glp1: { tipo: 'relativa', texto: 'Sarcopenia o fragilidad', conducta: 'El descenso de peso puede empeorar la pérdida muscular: objetivo moderado, proteínas 1,2–1,6 g/kg y fuerza supervisada.' },
    actividad: ['Entrenamiento de fuerza progresivo 3 veces por semana como prioridad.'] },
  { id: 'anemia', nombre: 'Anemia', sin: ['anemia', 'ferropenia', 'deficit de hierro'], dieta: ['Hierro de carnes, legumbres y verduras verdes con vitamina C; separar el mate y el té de las comidas.'] },
  { id: 'arritmia', nombre: 'Arritmia / taquicardia', sin: ['arritmia', 'taquicardia', 'extrasistoles', 'wolff', 'flutter'],
    glp1: { tipo: 'relativa', texto: 'Arritmia o taquicardia', conducta: 'Los agonistas de GLP-1 aumentan la frecuencia cardíaca 1–4 lpm: controlar FC y síntomas.' } },
  { id: 'hipotension', nombre: 'Hipotensión / mareos al pararse', sin: ['hipotension', 'presion baja', 'hipotension ortostatica'],
    tratamiento: ['Con el descenso de peso puede bajar más la presión: revisar antihipertensivos y asegurar hidratación.'] },
  { id: 'cancerActivo', nombre: 'Cáncer en tratamiento', sin: ['cancer', 'oncologico', 'tumor', 'quimioterapia', 'linfoma', 'leucemia', 'carcinoma'],
    glp1: { tipo: 'relativa', texto: 'Enfermedad oncológica activa', conducta: 'Evitar el descenso de peso no buscado y la desnutrición: decidir con oncología.' } },
  { id: 'nodTiroideo', nombre: 'Nódulo tiroideo', sin: ['nodulo tiroideo', 'bocio', 'nodulo de tiroides'],
    glp1: { tipo: 'relativa', texto: 'Nódulo tiroideo', conducta: 'Descartar carcinoma medular (ecografía y, si corresponde, calcitonina) antes de iniciar.' } },
  { id: 'hipertiroidismo', nombre: 'Hipertiroidismo', sin: ['hipertiroidismo', 'graves', 'tirotoxicosis'], tratamiento: ['Controlar la función tiroidea antes de evaluar el peso: puede explicar cambios de peso y taquicardia.'] },
  { id: 'cushing', nombre: 'Síndrome de Cushing', sin: ['cushing', 'hipercortisolismo'], tratamiento: ['Obesidad secundaria: tratar la causa con endocrinología antes de un fármaco para el peso.'] },
  { id: 'atracon', nombre: 'Trastorno por atracón', sin: ['atracon', 'atracones', 'comedor compulsivo', 'binge'],
    glp1: { tipo: 'relativa', texto: 'Trastorno por atracón', conducta: 'Puede mejorar con el tratamiento, pero requiere seguimiento por salud mental en paralelo.' } },
  { id: 'esquizofrenia', nombre: 'Esquizofrenia / trastorno bipolar', sin: ['esquizofrenia', 'bipolar', 'psicosis', 'trastorno bipolar'],
    tratamiento: ['Revisar con psiquiatría los antipsicóticos y estabilizadores que aumentan el peso.'] },
  { id: 'menopausia', nombre: 'Menopausia', sin: ['menopausia', 'climaterio', 'perimenopausia'], actividad: ['Fuerza y ejercicios de impacto para la masa ósea y muscular.'] },
  { id: 'dgPrevia', nombre: 'Diabetes gestacional previa', sin: ['diabetes gestacional'], tratamiento: ['Riesgo alto de DM2: glucemia o HbA1c al menos una vez por año.'] },
  { id: 'migrana', nombre: 'Migraña', sin: ['migrana', 'jaqueca'], dieta: ['No saltear comidas y mantener la hidratación (las náuseas del tratamiento pueden empeorarla).'] },
  { id: 'epilepsia', nombre: 'Epilepsia', sin: ['epilepsia', 'convulsiones'], tratamiento: ['Con antiepilépticos de margen estrecho, controlar niveles si hay vómitos o diarrea.'] },
  { id: 'insuficienciaRenalDialisis', nombre: 'Diálisis', sin: ['dialisis', 'hemodialisis', 'dialisis peritoneal'],
    glp1: { tipo: 'relativa', texto: 'Diálisis', conducta: 'Datos limitados: decidir con nefrología; riesgo de deshidratación y desnutrición.' } },
  { id: 'trasplante', nombre: 'Trasplante de órgano', sin: ['trasplante', 'trasplantado'],
    glp1: { tipo: 'relativa', texto: 'Trasplante con inmunosupresores', conducta: 'Controlar niveles de tacrolimus o ciclosporina al iniciar y al escalar.' } },
  { id: 'lumbalgia', nombre: 'Dolor lumbar crónico', sin: ['lumbalgia', 'hernia de disco', 'dolor de espalda', 'ciatica'], actividad: ['Fortalecimiento del tronco, caminata y natación; evitar cargas axiales pesadas.'] },
  { id: 'fibromialgia', nombre: 'Fibromialgia', sin: ['fibromialgia'], actividad: ['Ejercicio aeróbico suave y progresivo (agua, caminata), en días alternos.'] },
  { id: 'vih', nombre: 'VIH', sin: ['vih', 'hiv', 'sida'], tratamiento: ['Revisar interacciones con el esquema antirretroviral y la lipodistrofia.'] },
];

/* ---------- Análisis de laboratorio extra ----------
   ref: [min, max] (o por sexo: { F: [..], M: [..] })
   reglas(valor, ctx) → efectos: { glp1, alerta, dieta, tratamiento } */
export const ANALITOS = [
  { id: 'vitD', nombre: '25-OH vitamina D', unidad: 'ng/mL', ref: [30, 100], sin: ['vitamina d', '25 oh', '25 hidroxivitamina d', 'vit d'],
    reglas: (v) => (v < 20 ? { estado: 'bajo', texto: 'Deficiencia', tratamiento: ['Vitamina D: colecalciferol 1000–2000 UI/día (o esquema de carga según el médico) y control a los 3 meses.'] }
      : v < 30 ? { estado: 'limite', texto: 'Insuficiencia', tratamiento: ['Vitamina D: considerar 1000 UI/día y exposición solar segura.'] } : null) },
  { id: 'ferritina', nombre: 'Ferritina', unidad: 'ng/mL', ref: { F: [15, 150], M: [30, 400] }, sin: ['ferritina'],
    reglas: (v, c) => (v < (c.sexo === 'M' ? 30 : 15) ? { estado: 'bajo', texto: 'Depósitos de hierro bajos', tratamiento: ['Hierro: estudiar la causa y reponer.'] }
      : v > 1000 ? { estado: 'alto', texto: 'Muy elevada: descartar sobrecarga o inflamación', alerta: true } : null) },
  { id: 'hb', nombre: 'Hemoglobina', unidad: 'g/dL', ref: { F: [12, 16], M: [13, 17.5] }, sin: ['hemoglobina', 'hb'],
    reglas: (v, c) => (v < (c.sexo === 'M' ? 13 : 12) ? { estado: 'bajo', texto: 'Anemia', tratamiento: ['Estudiar la anemia antes de un plan con déficit calórico.'] } : null) },
  { id: 'b12', nombre: 'Vitamina B12', unidad: 'pg/mL', ref: [200, 900], sin: ['vitamina b12', 'b12', 'cobalamina'],
    reglas: (v, c) => (v < 200 ? { estado: 'bajo', texto: 'Deficiencia', tratamiento: [`Reponer vitamina B12${c.clases?.has('metformina') ? ' (la metformina la disminuye: controlar una vez por año)' : ''}.`] } : null) },
  { id: 'calcitonina', nombre: 'Calcitonina', unidad: 'pg/mL', ref: { F: [0, 5], M: [0, 10] }, sin: ['calcitonina'],
    reglas: (v, c) => (v > (c.sexo === 'M' ? 10 : 5) ? { estado: 'alto', texto: 'Elevada', alerta: true,
      glp1: { tipo: 'absoluta', texto: 'Calcitonina elevada', conducta: 'No iniciar agonistas de GLP-1 hasta descartar carcinoma medular de tiroides (endocrinología).' } } : null) },
  { id: 'lipasa', nombre: 'Lipasa', unidad: 'U/L', ref: [0, 60], sin: ['lipasa'],
    reglas: (v) => (v > 180 ? { estado: 'alto', texto: 'Más de 3 veces el normal', alerta: true,
      glp1: { tipo: 'absoluta', texto: 'Lipasa > 3 veces el valor normal', conducta: 'Descartar pancreatitis aguda: no iniciar (o suspender) el agonista hasta aclararlo.' } }
      : v > 60 ? { estado: 'limite', texto: 'Elevada', glp1: { tipo: 'relativa', texto: 'Lipasa elevada', conducta: 'Repetir y vigilar síntomas pancreáticos.' } } : null) },
  { id: 'amilasa', nombre: 'Amilasa', unidad: 'U/L', ref: [25, 125], sin: ['amilasa'],
    reglas: (v) => (v > 375 ? { estado: 'alto', texto: 'Más de 3 veces el normal', alerta: true,
      glp1: { tipo: 'absoluta', texto: 'Amilasa > 3 veces el valor normal', conducta: 'Descartar pancreatitis aguda antes de iniciar o continuar.' } } : null) },
  { id: 'potasio', nombre: 'Potasio', unidad: 'mEq/L', ref: [3.5, 5.0], sin: ['potasio', 'k', 'kalemia'],
    reglas: (v) => (v > 5.5 ? { estado: 'alto', texto: 'Hiperpotasemia', alerta: true, dieta: ['Limitar alimentos ricos en potasio hasta revisar con el médico.'] }
      : v < 3.5 ? { estado: 'bajo', texto: 'Hipopotasemia', alerta: true } : null) },
  { id: 'sodio', nombre: 'Sodio', unidad: 'mEq/L', ref: [135, 145], sin: ['sodio', 'natremia', 'na'],
    reglas: (v) => (v < 133 || v > 147 ? { estado: v < 133 ? 'bajo' : 'alto', texto: 'Fuera de rango', alerta: true } : null) },
  { id: 'calcio', nombre: 'Calcio', unidad: 'mg/dL', ref: [8.5, 10.5], sin: ['calcio', 'calcemia'],
    reglas: (v) => (v > 10.5 ? { estado: 'alto', texto: 'Hipercalcemia: descartar hiperparatiroidismo', alerta: true } : null) },
  { id: 'ggt', nombre: 'GGT', unidad: 'U/L', ref: { F: [0, 40], M: [0, 60] }, sin: ['ggt', 'gama glutamil', 'gamma gt'],
    reglas: (v) => (v > 100 ? { estado: 'alto', texto: 'Elevada', dieta: ['Alcohol: cero; evaluar hígado graso y colestasis.'] } : null) },
  { id: 'fal', nombre: 'Fosfatasa alcalina', unidad: 'U/L', ref: [40, 130], sin: ['fosfatasa alcalina', 'fal', 'fa'],
    reglas: (v) => (v > 200 ? { estado: 'alto', texto: 'Elevada: descartar colestasis o enfermedad ósea' } : null) },
  { id: 'bilirrubina', nombre: 'Bilirrubina total', unidad: 'mg/dL', ref: [0.2, 1.2], sin: ['bilirrubina', 'bilirrubina total'],
    reglas: (v) => (v > 2 ? { estado: 'alto', texto: 'Elevada', alerta: true, glp1: { tipo: 'relativa', texto: 'Bilirrubina elevada', conducta: 'Descartar colestasis o patología biliar antes de iniciar.' } } : null) },
  { id: 't4l', nombre: 'T4 libre', unidad: 'ng/dL', ref: [0.8, 1.8], sin: ['t4 libre', 't4l', 'tiroxina libre'],
    reglas: (v) => (v < 0.8 ? { estado: 'bajo', texto: 'Baja: hipotiroidismo' } : v > 1.8 ? { estado: 'alto', texto: 'Alta: hipertiroidismo' } : null) },
  { id: 'cortisol', nombre: 'Cortisol', unidad: 'µg/dL', ref: [5, 23], sin: ['cortisol', 'cortisol plasmatico'], reglas: () => null },
  { id: 'testosterona', nombre: 'Testosterona total', unidad: 'ng/dL', ref: { F: [8, 60], M: [300, 1000] }, sin: ['testosterona'],
    reglas: (v, c) => (c.sexo === 'M' && v < 300 ? { estado: 'bajo', texto: 'Baja: hipogonadismo (mejora con el descenso de peso)' } : c.sexo === 'F' && v > 60 ? { estado: 'alto', texto: 'Alta: evaluar SOP' } : null) },
  { id: 'peptidoC', nombre: 'Péptido C', unidad: 'ng/mL', ref: [0.8, 3.1], sin: ['peptido c'],
    reglas: (v) => (v < 0.6 ? { estado: 'bajo', texto: 'Bajo: reserva insulínica escasa (descartar DM1 / LADA)', glp1: { tipo: 'relativa', texto: 'Péptido C bajo', conducta: 'Posible déficit insulínico: el agonista no reemplaza a la insulina.' } } : null) },
  { id: 'cpk', nombre: 'CPK', unidad: 'U/L', ref: [0, 200], sin: ['cpk', 'creatinfosfoquinasa', 'ck'],
    reglas: (v, c) => (v > 1000 ? { estado: 'alto', texto: 'Muy elevada', alerta: true, tratamiento: [c.clases?.has('estatina') ? 'Con estatinas: suspender y evaluar miopatía.' : 'Evaluar causa (ejercicio intenso, miopatía).'] } : null) },
  { id: 'ntprobnp', nombre: 'NT-proBNP', unidad: 'pg/mL', ref: [0, 125], sin: ['nt probnp', 'probnp', 'bnp'],
    reglas: (v) => (v > 125 ? { estado: 'alto', texto: 'Elevado: evaluar insuficiencia cardíaca', alerta: true } : null) },
  { id: 'glucPost', nombre: 'Glucemia 2 h poscarga', unidad: 'mg/dL', ref: [0, 140], sin: ['ptog', 'glucemia 2 horas', 'poscarga', 'curva de glucemia'],
    reglas: (v) => (v >= 200 ? { estado: 'alto', texto: 'En rango de diabetes' } : v >= 140 ? { estado: 'limite', texto: 'Intolerancia a la glucosa' } : null) },
  { id: 'magnesio', nombre: 'Magnesio', unidad: 'mg/dL', ref: [1.7, 2.4], sin: ['magnesio'], reglas: (v) => (v < 1.6 ? { estado: 'bajo', texto: 'Bajo' } : null) },
  { id: 'eritro', nombre: 'Eritrosedimentación', unidad: 'mm/h', ref: [0, 20], sin: ['eritrosedimentacion', 'vsg', 'eritro'], reglas: () => null },
];

/* ---------- Medicamentos extra (se suman al vademécum) ---------- */
export const MEDS_EXTRA = [
  ['Alopurinol', ['Zyloprim'], []], ['Febuxostat', ['Adenuric'], []], ['Colchicina', ['Colchicina'], []],
  ['Omeprazol', ['Omeprazol', 'Ulcozol'], []], ['Pantoprazol', ['Pantus'], []], ['Esomeprazol', ['Nexium'], []],
  ['Salbutamol', ['Ventolin'], []], ['Budesonide/formoterol', ['Symbicort'], []], ['Montelukast', ['Singulair'], []],
  ['Metimazol', ['Danantizol'], []], ['Sertralina', ['Zoloft'], []], ['Escitalopram', ['Lexapro'], []], ['Fluoxetina', ['Prozac'], []],
  ['Bupropión', ['Wellbutrin'], []], ['Clonazepam', ['Rivotril'], []], ['Alprazolam', ['Alplax'], []],
  ['Levetiracetam', ['Keppra'], []], ['Lamotrigina', ['Lamictal'], []], ['Topiramato', ['Topamax'], []],
  ['Furosemida', ['Lasix'], ['diuretico']], ['Sacubitril/valsartán', ['Entresto'], ['ara2']],
  ['Ivabradina', ['Procoralan'], []], ['Amiodarona', ['Atlansil'], []], ['Sildenafil', ['Viagra'], []], ['Tadalafilo', ['Cialis'], []],
  ['Calcio + vitamina D', ['Calcimax'], []], ['Colecalciferol', ['Vitamina D3'], []], ['Sulfato ferroso', ['Ferroso'], []],
  ['Isotretinoína', ['Roaccutane'], []], ['Tamoxifeno', ['Nolvadex'], []], ['Anastrozol', ['Arimidex'], []],
  ['Metotrexato', ['Metotrexato'], ['inmunosupresor']], ['Hidroxicloroquina', ['Plaquenil'], []],
  ['Adalimumab', ['Humira'], []], ['Insulina degludec/liraglutida', ['Xultophy'], ['insulina', 'glp1']],
];

/* ---------- Búsqueda ---------- */
const coincide = (texto, lista) => {
  const t = normalizar(texto);
  if (!t) return false;
  return lista.some((s) => { const n = normalizar(s); return t === n || (` ${t} `).includes(` ${n} `) || (n.length >= 5 && t.includes(n)); });
};
export const buscarEnfermedad = (texto) => ENFERMEDADES.find((e) => coincide(texto, [e.nombre, ...e.sin])) || null;
export const buscarAnalito = (texto) => ANALITOS.find((a) => coincide(texto, [a.nombre, ...a.sin])) || null;
export function sugerirEnfermedades(texto, max = 6) {
  const t = normalizar(texto);
  if (t.length < 2) return [];
  return ENFERMEDADES.filter((e) => [e.nombre, ...e.sin].some((s) => normalizar(s).includes(t))).slice(0, max);
}
export function sugerirAnalitos(texto, max = 6) {
  const t = normalizar(texto);
  if (t.length < 2) return [];
  return ANALITOS.filter((a) => [a.nombre, ...a.sin].some((s) => normalizar(s).includes(t))).slice(0, max);
}
const refDe = (a, sexo) => (Array.isArray(a.ref) ? a.ref : a.ref?.[sexo === 'M' ? 'M' : 'F']);

/**
 * Procesa lo "extra" de la ficha y devuelve sus efectos.
 * cl.patologiasExtra: [{ texto }]  ·  cl.labsExtra: [{ nombre, valor, unidad, refMin, refMax }]
 */
export function procesarExtras(cl = {}, ctx = {}) {
  const out = { enfermedades: [], noReconocidas: [], labs: [], labsNoReconocidos: [], ciAbsolutas: [], ciRelativas: [], dieta: [], actividad: [], tratamiento: [], alertas: [] };
  for (const p of cl.patologiasExtra || []) {
    const e = buscarEnfermedad(p.texto);
    if (!e) { out.noReconocidas.push(p.texto); continue; }
    out.enfermedades.push(e);
    if (e.glp1) (e.glp1.tipo === 'absoluta' ? out.ciAbsolutas : out.ciRelativas).push({ id: `x-${e.id}`, texto: e.glp1.texto, conducta: e.glp1.conducta });
    out.dieta.push(...(e.dieta || []));
    out.actividad.push(...(e.actividad || []));
    out.tratamiento.push(...(e.tratamiento || []));
  }
  for (const l of cl.labsExtra || []) {
    const v = parseFloat(String(l.valor).replace(',', '.'));
    if (!Number.isFinite(v)) continue;
    const a = buscarAnalito(l.nombre);
    if (a) {
      const r = a.reglas(v, ctx) || null;
      const ref = refDe(a, ctx.sexo);
      const estado = r?.estado || (ref && (v < ref[0] ? 'bajo' : v > ref[1] ? 'alto' : 'ok')) || 'ok';
      out.labs.push({ id: `x-${a.id}`, nombre: a.nombre, valor: v, unidad: l.unidad || a.unidad, estado, texto: r?.texto || (estado === 'ok' ? 'En rango' : 'Fuera de rango'), ref: ref ? `${ref[0]}–${ref[1]}` : '—' });
      if (r?.glp1) (r.glp1.tipo === 'absoluta' ? out.ciAbsolutas : out.ciRelativas).push({ id: `x-${a.id}`, texto: r.glp1.texto, conducta: r.glp1.conducta });
      if (r?.alerta) out.alertas.push(`${a.nombre} ${String(v).replace('.', ',')} ${l.unidad || a.unidad}: ${r.texto}`);
      out.dieta.push(...(r?.dieta || []));
      out.tratamiento.push(...(r?.tratamiento || []));
    } else {
      const min = parseFloat(String(l.refMin ?? '').replace(',', '.')), max = parseFloat(String(l.refMax ?? '').replace(',', '.'));
      const tieneRef = Number.isFinite(min) || Number.isFinite(max);
      const fuera = tieneRef && ((Number.isFinite(min) && v < min) || (Number.isFinite(max) && v > max));
      out.labsNoReconocidos.push(l.nombre);
      out.labs.push({ id: `x-${normalizar(l.nombre)}`, nombre: l.nombre, valor: v, unidad: l.unidad || '', estado: fuera ? (v < min ? 'bajo' : 'alto') : tieneRef ? 'ok' : 'info',
        texto: tieneRef ? (fuera ? 'Fuera del rango indicado' : 'Dentro del rango indicado') : 'Sin referencia: lo interpreta el médico', ref: tieneRef ? `${Number.isFinite(min) ? min : ''}–${Number.isFinite(max) ? max : ''}` : '—', noReconocido: true });
    }
  }
  return out;
}

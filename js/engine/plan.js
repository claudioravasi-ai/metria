/* ============================================================
   Plan integral automático
   A partir de la evaluación completa (datos, enfermedades, medicación,
   laboratorio y lo "extra" reconocido) arma:
     - alimentación (calorías con topes de seguridad, macronutrientes, reglas),
     - actividad física (dosis semanal y precauciones),
     - tratamiento sugerido (fármacos con dosis y tiempos) — PARA EL MÉDICO,
     - seguimiento (qué controlar y cuándo).
   Guías: ADA 2026, AHA/ACC HTA 2025 y dislipemias 2026, ESC 2021/2025,
   KDIGO 2024, OMS actividad física 2020, consensos argentinos (SAC, SAD).
   Es apoyo a la decisión: el médico confirma y prescribe (Ley 17.132).
   ============================================================ */

import * as GL from './glp1.js';
import { reconocer } from './meds.js';

const r0 = (v) => Math.round(v);
const r50 = (v) => Math.round(v / 50) * 50;
const coma = (v, d = 1) => String(+v.toFixed(d)).replace('.', ',');

export function planIntegral(ev, extras = {}) {
  const p = ev.pat || {}, an = ev.antropo || {}, l = ev.labs || {}, d = ev.der || {}, cl = ev.banderas?.clases || new Set();
  const peso = +an.peso, imc = ev.comp?.imc;
  const dm = p.dm2 || p.dm1, hta = p.hta || ['e1', 'e2', 'crisis'].includes(ev.pa?.id);
  const ercAvanz = Number.isFinite(d.tfg) && d.tfg < 45;
  const ecv = p.iam || p.acv || p.eap || p.revasc;
  const plan = { alertas: [...(extras.alertas || [])], dieta: null, actividad: null, tratamiento: [], seguimiento: [], noReconocido: {} };

  /* ---------- Alimentación ---------- */
  if (ev.ener && peso) {
    const piso = ev.sexo === 'M' ? 1500 : 1200;
    let kcal = ev.ener.get, objetivo = 'Mantener el peso';
    if (imc >= 25) {
      // Topes de seguridad: déficit ≤ 25 % del gasto y ≤ 500–750 kcal, nunca bajo el basal ni bajo el piso
      const deficit = Math.min(imc >= 35 ? 750 : 500, ev.ener.get * 0.25);
      kcal = Math.max(ev.ener.tmb, piso, ev.ener.get - deficit);
      objetivo = `Descenso de ~${coma(Math.min(1, (ev.ener.get - kcal) * 7 / 7700), 1)} kg por semana (máximo 1 % del peso)`;
    } else if (imc < 18.5) { kcal = ev.ener.get + 300; objetivo = 'Recuperar peso'; }
    const prot = ev.comp?.proteina;
    let protMin = prot?.min, protMax = prot?.max;
    const reglas = [], evitar = [];
    if (ercAvanz && !p.dialisis) { protMin = 0.8 * (prot?.pesoBase || peso); protMax = protMin; reglas.push('Enfermedad renal avanzada: proteínas 0,8 g/kg/día (KDIGO 2024), de buena calidad.'); }
    const carbPct = dm || p.prediabetes || ev.glucemia?.id === 'pre' ? [40, 45] : [45, 50];
    const satMax = Number.isFinite(d.ldl) && ev.ldlObjetivo && d.ldl > ev.ldlObjetivo ? 7 : 10;
    let patron = 'Mediterráneo';
    if (hta) { patron = 'DASH mediterráneo'; reglas.push('Sodio < 2 g/día (≈ 5 g de sal): sin salero, evitar fiambres, embutidos, quesos duros y snacks.'); }
    if (dm || p.prediabetes) reglas.push('Carbohidratos de bajo índice glucémico, repartidos en el día; primero verduras y proteínas, después el almidón. Sin bebidas azucaradas.');
    if (Number.isFinite(d.ldl) && d.ldl > (ev.ldlObjetivo || 116)) reglas.push(`Grasas saturadas < ${satMax} % de las calorías; 2–3 porciones de pescado por semana; frutos secos 30 g/día; fibra soluble (avena, legumbres).`);
    if (l.tg >= 150) reglas.push('Triglicéridos altos: cero alcohol, sin azúcares ni harinas refinadas.');
    if (p.higadoGraso) reglas.push('Hígado graso: descenso de 7–10 % del peso, sin fructosa agregada ni alcohol; café sin azúcar es beneficioso.');
    if (p.erc || ercAvanz) reglas.push('Riñón: ajustar potasio y fósforo según el laboratorio; evitar ultraprocesados con aditivos fosfatados.');
    if (p.ic) reglas.push('Insuficiencia cardíaca: sodio < 2 g/día; líquidos según indicación del cardiólogo.');
    if (ev.glp1?.yaRecibe || ev.planActivo) reglas.push('Con agonista de GLP-1: porciones chicas, comer despacio, proteína en cada comida, evitar frituras y grasas; parar al primer signo de saciedad.');
    if (ev.habitos?.alcohol === 'riesgo') evitar.push('Alcohol: reducir a cero o como máximo 1 medida por día.');
    if (ev.habitos?.tabaco === 'actual') evitar.push('Tabaco: plan de cesación (el aumento de peso al dejar es menor que el beneficio).');
    reglas.push(...(extras.dieta || []));
    const aguaMl = p.ic || ercAvanz ? null : r50(peso * 30);
    plan.dieta = {
      kcal: r50(kcal), get: r50(ev.ener.get), tmb: r50(ev.ener.tmb), objetivo, patron,
      macros: {
        proteina: protMin ? `${r0(protMin)}–${r0(protMax)} g/día` : '—',
        carbohidratos: `${carbPct[0]}–${carbPct[1]} % (${r0((kcal * carbPct[0]) / 400)}–${r0((kcal * carbPct[1]) / 400)} g)`,
        grasas: `30–35 % (saturadas < ${satMax} %)`,
        fibra: '25–35 g/día', agua: aguaMl ? `${coma(aguaMl / 1000)} L/día` : 'Según indicación médica',
      },
      reglas: [...new Set(reglas)], evitar,
      ejemplo: [
        'Desayuno: infusión + yogur natural o huevo + fruta + avena/pan integral.',
        'Almuerzo y cena: mitad del plato verduras, un cuarto proteína (carne magra, pescado, huevo, legumbres), un cuarto almidón integral.',
        'Colaciones: fruta, frutos secos o lácteo descremado. Agua como bebida principal.',
      ],
    };
  }

  /* ---------- Actividad física ---------- */
  {
    const reglas = [], prec = [];
    let aerobica = '150–300 minutos por semana de intensidad moderada (o 75–150 de intensa)';
    let fuerza = '2–3 veces por semana, grandes grupos musculares, 8–12 repeticiones';
    const inicio = ev.habitos?.actividad === 'sedentario' || !ev.habitos?.actividad;
    if (inicio) reglas.push('Empezar con 10–15 minutos por día de caminata y sumar 5 minutos por semana.');
    if (imc >= 35 || p.artrosis || ev.sintomas?.dolorRodillaCadera) reglas.push('Bajo impacto: bicicleta fija, agua, elíptico, caminata en llano.');
    if (ev.edad >= 65) reglas.push('Equilibrio y movilidad 3 veces por semana (prevención de caídas).');
    if (ev.glp1?.veredicto === 'indicado' || ev.glp1?.veredicto === 'precaucion' || ev.planActivo) { fuerza = '3 veces por semana: prioridad para conservar la masa muscular durante el descenso'; }
    if (ecv || p.ic) prec.push('Enfermedad cardiovascular: prueba de esfuerzo o rehabilitación cardiovascular antes de la intensidad alta.');
    if (dm && (cl.has('insulina') || cl.has('sulfonilurea'))) prec.push('Con insulina o sulfonilureas: medir glucemia antes y después, llevar hidratos de rescate.');
    if (p.retinopatia) prec.push('Retinopatía: evitar maniobras de Valsalva, cabeza hacia abajo y alto impacto.');
    if (ev.vitales?.pas >= 180 || ev.vitales?.pad >= 110) prec.push('Presión ≥ 180/110: no iniciar ejercicio intenso hasta controlarla.');
    if (p.sahos) reglas.push('Apnea del sueño: el ejercicio regular reduce su gravedad.');
    reglas.push(...(extras.actividad || []));
    plan.actividad = { aerobica, fuerza, flexibilidad: '2–3 veces por semana, al final de la sesión', pasos: inicio ? 'Meta inicial 6000 pasos/día → 8000–10 000' : '8000–10 000 pasos/día', reglas: [...new Set(reglas)], precauciones: prec };
  }

  /* ---------- Tratamiento sugerido (para el médico) ---------- */
  const T = (prioridad, titulo, detalle, fuente) => plan.tratamiento.push({ prioridad, titulo, detalle, fuente });
  const g = ev.glp1;
  if (g?.opciones?.length && ['indicado', 'precaucion'].includes(g.veredicto)) {
    const f = g.opciones[0].farmaco;
    const pasos = f.pasos.map((x) => `${GL.fmtDosis(x.dosis)} ${f.unidad}${x.dias ? ` × ${x.dias >= 28 ? `${x.dias / 7} sem` : `${x.dias} d`}` : ''}`).join(' → ');
    T(g.veredicto === 'indicado' ? 'alta' : 'media', `${f.generico} (${f.comercial}) — ${f.via.toLowerCase()}`,
      [`Titulación: ${pasos}.`, `Mantenimiento: ${f.mantenimiento}`, f.respuesta, 'Duración: tratamiento crónico; en los ensayos, 68–72 semanas. Al suspender se recupera gran parte del peso.',
        ...g.opciones[0].porque.slice(0, 2), ...(g.contraindicaciones?.relativas || []).slice(0, 3).map((c) => `Precaución: ${c.texto} — ${c.conducta}`)], f.eficacia.texto);
  } else if (g?.veredicto === 'contraindicado') {
    T('alta', 'Agonistas de GLP-1 / GIP contraindicados', (g.contraindicaciones?.absolutas || []).map((c) => `${c.texto}: ${c.conducta}`), 'Prospectos aprobados');
    if (imc >= 30) T('media', 'Alternativa: orlistat 120 mg con cada comida principal', ['Suplementar vitaminas liposolubles; efectos digestivos con comidas grasas.'], 'XENDOS');
  }
  // Lípidos (ACC/AHA 2026: estatina clase I con PREVENT ASCVD ≥ 5 %; objetivos de LDL por categoría)
  const ldl = d.ldl, obj = ev.ldlObjetivo;
  // Estatina solo con indicación: riesgo clínico alto/muy alto, LDL ≥ 190, PREVENT ASCVD ≥ 5 % o 3–5 % con potenciadores
  const ascvd = ev.prevent?.ok ? ev.prevent.ascvd10 : null;
  const indicaEstatina = ['muy-alto', 'alto'].includes(ev.categoria?.id) || ldl >= 190 || ascvd >= 5 || (ascvd >= 3 && (ev.potenciadores?.length || 0) >= 1);
  if (Number.isFinite(ldl) && obj && ldl > obj && (indicaEstatina || ev.banderas?.estatina)) {
    const altoRiesgo = ['muy-alto', 'alto'].includes(ev.categoria?.id);
    const reduccion = Math.round((1 - obj / ldl) * 100);
    if (!ev.banderas?.estatina) {
      T(altoRiesgo ? 'alta' : 'media', `Estatina de ${altoRiesgo || reduccion >= 50 ? 'alta' : 'moderada'} intensidad`,
        [altoRiesgo || reduccion >= 50 ? 'Atorvastatina 40–80 mg/día o rosuvastatina 20–40 mg/día.' : 'Atorvastatina 10–20 mg/día o rosuvastatina 5–10 mg/día.',
          `LDL ${r0(ldl)} → objetivo < ${obj} mg/dL (reducción necesaria ~${reduccion} %).`, 'Perfil lipídico y transaminasas a las 4–12 semanas; CPK si hay dolores musculares.'], 'ACC/AHA 2026 · ESC/EAS');
    } else {
      T('media', 'Intensificar el tratamiento hipolipemiante', ['Llevar la estatina a alta intensidad y, si no alcanza, sumar ezetimibe 10 mg/día.', `LDL ${r0(ldl)} → objetivo < ${obj} mg/dL.`], 'ACC/AHA 2026');
    }
  }
  if (l.tg >= 500) T('alta', 'Hipertrigliceridemia grave', ['Fenofibrato 145–160 mg/día + omega-3 de prescripción; dieta sin alcohol ni azúcares.', 'Riesgo de pancreatitis: tratarla antes de iniciar GLP-1.'], 'ESC/EAS');
  // Presión arterial (AHA/ACC 2025)
  if (ev.pa && ['e1', 'e2', 'crisis'].includes(ev.pa.id)) {
    const necesita = ev.pa.id !== 'e1' || dm || p.erc || (ev.prevent?.ok && ev.prevent.cvd10 >= 7.5) || ecv;
    if (necesita && !ev.banderas?.antihipertensivo) {
      T(ev.pa.id === 'crisis' ? 'alta' : 'media', 'Iniciar tratamiento antihipertensivo',
        [ev.pa.id === 'e2' ? 'Combinación en un comprimido: IECA o ARA II + bloqueante cálcico o tiazida.' : 'IECA o ARA II, bloqueante cálcico o tiazida.',
          dm || d.erc?.a ? 'Con diabetes o albuminuria: IECA o ARA II de primera elección.' : 'Elegir según comorbilidades.',
          'Objetivo < 130/80 mmHg; control a las 4 semanas; ionograma y creatinina si IECA/ARA II o diuréticos.'], 'AHA/ACC 2025');
    } else if (ev.banderas?.antihipertensivo) T('media', 'Presión fuera de objetivo con tratamiento', ['Ajustar dosis o sumar un segundo fármaco; verificar adherencia y medición domiciliaria.'], 'AHA/ACC 2025');
  }
  // Glucemia
  if ((p.prediabetes || ev.glucemia?.id === 'pre') && !dm && !cl.has('metformina') && (imc >= 35 || ev.edad < 60 || p.dgPrevia))
    T('media', 'Metformina para prevenir diabetes', ['500 mg con la cena × 1 semana → 850–1000 mg cada 12 h con las comidas.', 'B12 una vez por año.'], 'ADA 2026 (DPP)');
  if (dm && (p.erc || d.erc?.erc || p.ic) && !cl.has('sglt2'))
    T('alta', 'Inhibidor de SGLT2', ['Dapagliflozina 10 mg/día o empagliflozina 10 mg/día (protección renal y cardíaca).', 'Suspender en días de enfermedad aguda y 3 días antes de cirugías.'], 'ADA 2026 · KDIGO 2024');
  if (dm && Number.isFinite(l.hba1c) && l.hba1c > 7) plan.alertas.push(`HbA1c ${coma(l.hba1c)} %: por encima del objetivo habitual (≤ 7 %).`);
  if (cl.has('sulfonilurea') && (g?.veredicto === 'indicado' || g?.veredicto === 'precaucion')) T('alta', 'Ajustar sulfonilurea al iniciar el agonista', ['Reducir 50 % o suspender si HbA1c < 8 % (riesgo de hipoglucemia).'], 'Prospectos');
  if (cl.has('insulina') && (g?.veredicto === 'indicado' || g?.veredicto === 'precaucion')) T('alta', 'Ajustar insulina al iniciar el agonista', ['Reducir la basal 10–20 % si HbA1c < 8 %; automonitoreo diario.'], 'ADA 2026');
  for (const t of extras.tratamiento || []) T('media', t.split(':')[0], [t], 'Base de conocimiento');

  /* ---------- Seguimiento ---------- */
  plan.seguimiento = [
    { cuando: 'Cada 4 semanas al inicio', que: 'Peso, cintura, presión, frecuencia cardíaca y tolerancia.' },
    { cuando: 'A los 3 meses', que: `Respuesta: objetivo −5 % del peso${dm ? ', HbA1c' : ''}${plan.tratamiento.some((x) => /Estatina|hipolipemiante/.test(x.titulo)) ? ', perfil lipídico y transaminasas' : ''}.` },
    { cuando: 'A los 6 meses', que: 'Laboratorio completo: glucemia, HbA1c, lípidos, función renal, hepatograma y vitamina D.' },
    { cuando: 'Cada año', que: `Reevaluar riesgo cardiovascular (PREVENT)${dm ? ', fondo de ojo, albuminuria y pie diabético' : ''}${cl.has('metformina') ? ', vitamina B12' : ''}.` },
  ];
  plan.noReconocido = { enfermedades: extras.noReconocidas || [], analisis: extras.labsNoReconocidos || [], medicamentos: (ev.meds || []).filter((m) => !(m.clases?.length) && !reconocer(m.nombre)).map((m) => m.nombre) };
  return plan;
}

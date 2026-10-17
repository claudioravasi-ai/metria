/* ============================================================
   ¿Me corresponde una colonoscopia?  (orientación para la portada)
   Función pura: recibe las respuestas y devuelve una de cuatro
   categorías, un valor 0–100 para el medidor y los motivos.

   Guías en las que se apoya:
   - USPSTF 2021 / ACS 2018 / USMSTF 2021 / ACG 2021: riesgo promedio
     de 45 a 75 años (colonoscopia cada 10 años o test inmunoquímico
     de sangre oculta —FIT— anual). 76–85: decisión individual. >85: no.
   - USMSTF 2017 (antecedentes familiares) y ACG 2021: un familiar de
     1.er grado <60 años o dos o más de 1.er grado a cualquier edad →
     colonoscopia desde los 40 o 10 años antes del caso más joven,
     cada 5 años. Un familiar de 1.er grado ≥60 → desde los 40, cada 10.
     Solo 2.º o 3.er grado → riesgo promedio.
   - USMSTF 2017 / ESGE 2020 (calidad del screening): FIT positivo →
     colonoscopia diagnóstica sin demora (idealmente dentro de 60 días).
   - AGA 2024 (CCR de inicio temprano), NICE NG12 y BSG/ACPGBI 2022:
     sangrado rectal, cambio del hábito evacuatorio o pérdida de peso
     no buscada se estudian a cualquier edad; no es screening.
   No reemplaza la consulta: es una orientación.
   ============================================================ */

export const CATS_COLON = [
  { id: 'no', nombre: 'No te corresponde por ahora', corto: 'No aún', desde: 0, hasta: 25, color: '#22c55e' },
  { id: 'screening', nombre: 'Screening poblacional', corto: 'Screening', desde: 25, hasta: 50, color: '#06b6d4' },
  { id: 'programada', nombre: 'Colonoscopia programada', corto: 'Programar', desde: 50, hasta: 75, color: '#f97316' },
  { id: 'rapida', nombre: 'Consulta rápida: colonoscopia diagnóstica', corto: 'Rápida', desde: 75, hasta: 100, color: '#ef4444' },
];

const cat = (id) => CATS_COLON.find((c) => c.id === id);
/** Ubica el valor dentro de la banda (f de 0 a 1). */
const enBanda = (id, f) => { const c = cat(id); return c.desde + (c.hasta - c.desde) * Math.min(0.92, Math.max(0.08, f)); };
const anios = (n) => `${n} ${n === 1 ? 'año' : 'años'}`;

/**
 * @param {object} p
 *  sexo 'F'|'M', edad,
 *  previa: bool, aniosPrevia, intervaloIndicado: number|null (años que indicó el médico),
 *  perdidaPeso, cambioHabito, sangreMoco: bool,
 *  fit: 'no' | 'neg' (último año) | 'negViejo' | 'pos',
 *  familiar: 'ninguno' | '1' | '2' | '3', familiares1: 1|2, edadFamiliar
 */
export function evaluarColon(p) {
  const edad = p.edad;
  const motivos = [];
  const sintomas = [p.sangreMoco && 'sangre o moco en la materia fecal', p.cambioHabito && 'cambio en el hábito evacuatorio', p.perdidaPeso && 'pérdida de peso no buscada'].filter(Boolean);

  // Riesgo familiar
  let inicio = 45, intervalo = 10, familiarAlto = false, fam = 'promedio';
  if (p.familiar === '1') {
    const alto = p.familiares1 >= 2 || (Number.isFinite(p.edadFamiliar) && p.edadFamiliar < 60);
    const diezAntes = Number.isFinite(p.edadFamiliar) ? p.edadFamiliar - 10 : 40;
    inicio = Math.max(18, Math.min(40, diezAntes));
    if (alto) { intervalo = 5; familiarAlto = true; fam = 'alto'; } else { fam = 'moderado'; }
  }

  // 1) Síntomas de alarma o FIT positivo → estudio diagnóstico, no screening
  if (sintomas.length || p.fit === 'pos') {
    if (p.fit === 'pos') motivos.push('El test de sangre oculta en heces dio positivo: corresponde colonoscopia diagnóstica sin demora, idealmente dentro de los 60 días (USMSTF, ESGE).');
    const lista = sintomas.length > 1 ? `${sintomas.slice(0, -1).join(', ')} y ${sintomas[sintomas.length - 1]}` : sintomas[0];
    if (sintomas.length) motivos.push(`Tenés ${lista}: son síntomas de alarma que se estudian a cualquier edad, no es screening (AGA 2024, NICE NG12).`);
    if (edad < 45) motivos.push('Ser menor de 45 no descarta el estudio: el cáncer colorrectal en menores de 50 está en aumento y suele diagnosticarse tarde.');
    if (edad > 75) motivos.push('Pasados los 75, con síntomas, el estudio se decide con tu médico según tu estado de salud.');
    const peso = sintomas.length + (p.fit === 'pos' ? 2 : 0) + (p.sangreMoco && p.perdidaPeso ? 1 : 0) + (edad >= 50 ? 0.5 : 0);
    return armar('rapida', enBanda('rapida', peso / 5), 'Consultá con tu médico en los próximos días', 'Colonoscopia diagnóstica', motivos, fam);
  }

  // 2) Mayores de 75 sin síntomas
  if (edad > 85) {
    motivos.push('Después de los 85 años sin síntomas no se recomienda el screening (USPSTF, USMSTF).');
    return armar('no', enBanda('no', 0.85), 'No se recomienda screening', 'Ninguno', motivos, fam);
  }
  if (edad > 75) {
    motivos.push('Entre 76 y 85 años sin síntomas el screening no es rutinario: se decide de forma individual con tu médico, según estudios previos y estado de salud.');
    if (p.previa && p.intervaloIndicado && p.aniosPrevia >= p.intervaloIndicado) {
      motivos.push(`Tu médico te indicó repetirla a los ${anios(p.intervaloIndicado)} y ya pasaron ${anios(p.aniosPrevia)}: conversalo en la próxima consulta.`);
      return armar('programada', enBanda('programada', 0.2), 'Hablalo con tu médico', 'Individualizar', motivos, fam);
    }
    return armar('no', enBanda('no', 0.75), 'Decisión individual con tu médico', 'Individualizar', motivos, fam);
  }

  // 3) Colonoscopia previa: ¿está al día?
  if (p.previa) {
    const prox = p.intervaloIndicado || (familiarAlto ? 5 : 10);
    const resta = prox - p.aniosPrevia;
    const quien = p.intervaloIndicado ? `tu médico te indicó repetirla a los ${anios(p.intervaloIndicado)}` : `sin indicación especial se repite a los ${anios(prox)}${familiarAlto ? ' por tu antecedente familiar' : ' si fue normal'}`;
    if (resta > 0) {
      motivos.push(`Tu última colonoscopia fue hace ${anios(p.aniosPrevia)} y ${quien}: estás al día.`);
      motivos.push(`Te toca la próxima en ${anios(resta)}. Si aparecen síntomas, consultá antes.`);
      return armar('no', enBanda('no', 0.6 - Math.min(0.5, resta / 20)), `Próxima en ${anios(resta)}`, 'Ninguno por ahora', motivos, fam);
    }
    motivos.push(`Tu última colonoscopia fue hace ${anios(p.aniosPrevia)} y ${quien}: ya te corresponde repetirla.`);
    if (p.intervaloIndicado || familiarAlto) {
      motivos.push('Es un control de vigilancia o de riesgo aumentado: se programa, no se reemplaza por el test de sangre oculta.');
      return armar('programada', enBanda('programada', 0.4 + Math.min(0.5, -resta / 10)), 'Programala en los próximos meses', 'Colonoscopia de control', motivos, fam);
    }
    if (edad >= 45) {
      motivos.push('Con riesgo promedio podés repetir la colonoscopia o hacer el test de sangre oculta (FIT) cada año.');
      return armar('screening', enBanda('screening', 0.75), 'Te toca este año', 'Colonoscopia o FIT anual', motivos, fam);
    }
  }

  // 4) Antecedente familiar de 1.er grado
  if (p.familiar === '1') {
    const det = familiarAlto
      ? (p.familiares1 >= 2 ? 'dos o más familiares de primer grado con cáncer colorrectal' : `un familiar de primer grado diagnosticado a los ${p.edadFamiliar} años (antes de los 60)`)
      : `un familiar de primer grado diagnosticado a los ${p.edadFamiliar} años`;
    if (edad >= inicio) {
      motivos.push(`Tenés ${det}: tu riesgo es aumentado y te corresponde colonoscopia desde los ${inicio} años, cada ${anios(intervalo)} (USMSTF 2017, ACG 2021).`);
      if (familiarAlto) motivos.push('Conviene una consulta de asesoramiento genético (síndrome de Lynch u otros).');
      return armar('programada', enBanda('programada', familiarAlto ? 0.6 : 0.3), 'Programala con tu médico', `Colonoscopia cada ${anios(intervalo)}`, motivos, fam);
    }
    motivos.push(`Tenés ${det}: vas a necesitar colonoscopia desde los ${inicio} años (10 antes del diagnóstico del familiar, o a los 40), cada ${anios(intervalo)}.`);
    return armar('no', enBanda('no', 0.55 + (edad - inicio + 10) / 40), `Empezás a los ${inicio} años`, 'Ninguno por ahora', motivos, fam);
  }
  if (p.familiar === '2' || p.familiar === '3') {
    motivos.push(`Un familiar de ${p.familiar === '2' ? 'segundo' : 'tercer'} grado con cáncer colorrectal no cambia la edad de inicio: se sigue el esquema de riesgo promedio (USMSTF 2017). Si son varios del mismo lado de la familia, consultalo.`);
  }

  // 5) Riesgo promedio
  if (edad < 45) {
    motivos.push(`Sin síntomas ni antecedentes de primer grado, el screening empieza a los 45 años (USPSTF 2021, ACS 2018). Te faltan ${anios(45 - edad)}.`);
    return armar('no', enBanda('no', 0.15 + edad / 100), `Empezás a los 45 años`, 'Ninguno por ahora', motivos, fam);
  }
  if (p.fit === 'neg') {
    motivos.push('Tu test de sangre oculta del último año fue negativo: estás dentro del screening. Repetilo cada año, o pasá a colonoscopia cada 10 años.');
    return armar('screening', enBanda('screening', 0.2), 'Al día: repetí el FIT al año', 'FIT anual', motivos, fam);
  }
  motivos.push('Tenés entre 45 y 75 años, sin síntomas y con riesgo promedio: estás dentro del screening poblacional.');
  motivos.push(p.fit === 'negViejo'
    ? 'Tu último test de sangre oculta tiene más de un año: hay que repetirlo, o hacer una colonoscopia (cada 10 años si es normal).'
    : 'Las opciones son colonoscopia cada 10 años o test de sangre oculta inmunoquímico (FIT) cada año; si da positivo, colonoscopia.');
  if (p.sexo === 'F') motivos.push('Las recomendaciones son iguales para mujeres y varones.');
  return armar('screening', enBanda('screening', 0.4 + (edad - 45) / 100), 'Te corresponde este año', 'Colonoscopia o FIT anual', motivos, fam);
}

function armar(id, valor, cuando, estudio, motivos, riesgoFamiliar) {
  return { categoria: cat(id), valor, cuando, estudio, motivos, riesgoFamiliar };
}

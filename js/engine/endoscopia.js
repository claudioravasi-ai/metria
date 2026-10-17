/* ============================================================
   Motor de turnos de endoscopia digestiva (sin pantalla: solo lógica)
   - Estudios: VEDA (alta), VCC (baja) y turno doble (ambas).
   - Prequirúrgico: analítica, ECG con lectura cardiológica y
     valoración anestesiológica, con vigencia en días.
   - Cupos: el médico abre fechas; un turno simple ocupa 1 cupo y
     uno doble, 2 cupos seguidos.
   - Documentos: consentimiento informado (Ley 26.529, art. 5),
     preparación y recomendaciones adaptadas a cada paciente.
   Fuentes (resumidas en FUENTES): ESGE, USMSTF 2025, ASGE/ACG 2022,
   BSG/ESGE 2021, ASA 2023 y guía multisocietaria GLP-1 2024.
   ============================================================ */

export const ESTUDIOS = {
  veda: {
    id: 'veda', corto: 'VEDA', nombre: 'Endoscopia digestiva alta', cupos: 1, simple: true,
    queEs: 'Se observa por dentro el esófago, el estómago y el duodeno con un tubo fino y flexible con cámara que se introduce por la boca.',
    dura: 'entre 10 y 20 minutos',
    c1: '#06b6d4', c2: '#6366f1',
  },
  vcc: {
    id: 'vcc', corto: 'VCC', nombre: 'Videocolonoscopia (endoscopia baja)', cupos: 1, simple: true,
    queEs: 'Se observa por dentro todo el colon (intestino grueso) y el final del intestino delgado con un tubo flexible con cámara que se introduce por el ano.',
    dura: 'entre 20 y 45 minutos',
    c1: '#f97316', c2: '#ec4899',
  },
  doble: {
    id: 'doble', corto: 'VEDA + VCC', nombre: 'Endoscopia alta y baja (turno doble)', cupos: 2, simple: false,
    queEs: 'Se hacen los dos estudios en la misma sedación: primero la endoscopia alta (por la boca) y después la colonoscopia (por el ano).',
    dura: 'entre 30 y 60 minutos',
    c1: '#a855f7', c2: '#f43f5e',
  },
};

export const REQUISITOS = [
  { id: 'analitica', nombre: 'Análisis de sangre', detalle: 'Hemograma, glucemia, uremia y coagulograma (TP, KPTT, RIN)', icono: 'matraz', c1: '#8b5cf6', c2: '#d946ef' },
  { id: 'ecg', nombre: 'Electrocardiograma', detalle: 'ECG con lectura e informe de un cardiólogo', icono: 'pulso', c1: '#f43f5e', c2: '#fb923c' },
  { id: 'anestesia', nombre: 'Valoración anestesiológica', detalle: 'Evaluación preanestésica por un anestesiólogo', icono: 'estetoscopio', c1: '#0891b2', c2: '#22c55e' },
];

export const VALIDEZ_DEFECTO = { analitica: 90, ecg: 180, anestesia: 90 };

export const MOTIVOS = [
  ['control', 'Control o prevención de cáncer de colon'],
  ['acidez', 'Acidez, reflujo o dolor de estómago'],
  ['digestivo', 'Dificultad para tragar o vómitos'],
  ['anemia', 'Anemia o falta de hierro'],
  ['sangrado', 'Sangrado digestivo o materia fecal oscura'],
  ['habito', 'Cambio del ritmo intestinal'],
  ['polipos', 'Seguimiento de pólipos o estudio anterior'],
  ['otro', 'Otro motivo'],
];

export const ANTECEDENTES = [
  ['anticoagulante', 'Tomo anticoagulantes (Sintrom, warfarina, apixabán, rivaroxabán, dabigatrán…)'],
  ['antiagregante', 'Tomo aspirina, clopidogrel u otro antiagregante'],
  ['insulina', 'Diabetes con insulina'],
  ['antidiabeticos', 'Diabetes con pastillas'],
  ['glp1', 'Uso semaglutida, tirzepatida, liraglutida u otro GLP-1 (Ozempic, Wegovy, Mounjaro…)'],
  ['corazon', 'Enfermedad del corazón o arritmia'],
  ['marcapasos', 'Marcapasos o cardiodesfibrilador'],
  ['pulmon', 'EPOC, asma u oxígeno en casa'],
  ['apnea', 'Apnea del sueño'],
  ['renal', 'Enfermedad renal crónica'],
  ['constipacion', 'Constipación crónica (menos de 3 evacuaciones por semana)'],
  ['cirugiaAbd', 'Cirugía abdominal previa'],
  ['embarazo', 'Embarazo posible o en curso'],
  ['latex', 'Alergia al látex'],
  ['anestesiaPrev', 'Problemas con una anestesia anterior'],
];

export const PREPARACIONES = {
  peg4: { nombre: 'Polietilenglicol 4 litros en dosis dividida', tarde: '2 litros entre las 19 y las 21 h (un vaso de 250 ml cada 15 minutos)', manana: '2 litros a partir de 5 horas antes del estudio, terminando como mínimo 2 horas antes' },
  peg2: { nombre: 'Polietilenglicol 2 litros con ascorbato en dosis dividida', tarde: '1 litro de la solución + 500 ml de líquidos claros entre las 19 y las 21 h', manana: '1 litro de la solución + 500 ml de líquidos claros desde 5 horas antes, terminando como mínimo 2 horas antes' },
  pico: { nombre: 'Picosulfato sódico con citrato de magnesio en dosis dividida', tarde: '1 sobre disuelto en 150 ml de agua a las 19 h y después 1,5 litros de líquidos claros', manana: '1 sobre 5 horas antes del estudio y 1 litro de líquidos claros, terminando como mínimo 2 horas antes' },
};

export const FUENTES = [
  'ESGE — Preparación intestinal para colonoscopia, actualización 2019 (Hassan y col., Endoscopy 2019).',
  'US Multi-Society Task Force — Recomendaciones para optimizar la preparación intestinal (2025).',
  'ASGE / ACG — Manejo periendoscópico de anticoagulantes y antiagregantes (2022).',
  'BSG / ESGE — Endoscopia en pacientes con antiagregantes o anticoagulantes, actualización 2021.',
  'ASA — Guía de ayuno preoperatorio (2023).',
  'AGA, ASGE, AASLD, ASMBS y NASPGHAN — Agonistas de GLP-1 en el período periprocedimiento (2024).',
  'ESGE / ESGENA / ESA — Sedación en endoscopia digestiva.',
  'Ley 26.529 de Derechos del Paciente (arts. 5 a 10): consentimiento informado.',
];

/* ---------- Fechas ---------- */
const MS_DIA = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const diaISO = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const aMin = (hhmm) => { const [a, b] = String(hhmm).replace(':', '').match(/^(\d{2})(\d{2})$/)?.slice(1) || [0, 0]; return +a * 60 + +b; };
export const deMin = (m) => `${pad(Math.floor(m / 60))}${pad(m % 60)}`;
export const hora = (clave) => `${String(clave).slice(0, 2)}:${String(clave).slice(2, 4)}`;
export const fechaLarga = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });

/* ---------- Prequirúrgico ---------- */
/**
 * pre: { analitica: { tiene, fecha }, ecg: { tiene, fecha, informe }, anestesia: { tiene, fecha, apto } }
 * Devuelve el estado de cada requisito y si puede pasar a elegir turno.
 */
export function evaluarPrequirurgico(pre = {}, ahora = Date.now(), validez = VALIDEZ_DEFECTO) {
  const items = REQUISITOS.map((r) => {
    const x = pre[r.id] || {};
    const dias = validez[r.id] || VALIDEZ_DEFECTO[r.id];
    if (x.tiene !== true) return { ...r, estado: x.tiene === false ? 'falta' : 'sin-responder', texto: x.tiene === false ? 'No lo tenés' : 'Sin responder', dias };
    if (!x.fecha) return { ...r, estado: 'incompleto', texto: 'Falta la fecha en que lo hiciste', dias };
    const hecho = new Date(`${x.fecha}T12:00:00`).getTime();
    if (hecho > ahora + MS_DIA) return { ...r, estado: 'incompleto', texto: 'La fecha no puede ser futura', dias };
    const vence = hecho + dias * MS_DIA;
    if (r.id === 'ecg' && !x.informe) return { ...r, estado: 'incompleto', texto: 'Falta la lectura del cardiólogo', dias, vence };
    if (r.id === 'anestesia' && x.apto === false) return { ...r, estado: 'no-apto', texto: 'El anestesiólogo no dio el apto', dias, vence };
    if (vence < ahora) return { ...r, estado: 'vencido', texto: `Venció: tiene más de ${dias} días`, dias, vence };
    return { ...r, estado: 'ok', texto: `Vigente hasta el ${new Date(vence).toLocaleDateString('es-AR')}`, dias, vence };
  });
  const faltan = items.filter((i) => i.estado !== 'ok');
  const venceTodo = items.every((i) => i.vence) ? Math.min(...items.map((i) => i.vence)) : null;
  return { items, faltan, completo: !faltan.length, venceTodo, pedir: items.filter((i) => ['falta', 'vencido'].includes(i.estado)) };
}

/* ---------- Cupos ---------- */
/** Claves de cupo ("0830") de una fecha abierta. */
export function cuposDe(dia) {
  if (!dia || dia.cerrada) return [];
  const desde = aMin(dia.desde), hasta = aMin(dia.hasta), paso = Math.max(10, +dia.minutos || 30);
  const out = [];
  for (let m = desde; m + paso <= hasta; m += paso) out.push(deMin(m));
  return out;
}

/** Horarios libres para un estudio en una fecha: cada opción trae la lista de cupos que ocupa. */
export function horariosLibres(dia, ocupados = {}, tipo, { ahora = Date.now(), fecha } = {}) {
  const cupos = cuposDe(dia);
  const n = ESTUDIOS[tipo]?.cupos || 1;
  const hoy = diaISO(ahora);
  const minAhora = new Date(ahora).getHours() * 60 + new Date(ahora).getMinutes();
  const out = [];
  for (let i = 0; i + n <= cupos.length; i++) {
    const tramo = cupos.slice(i, i + n);
    // los cupos tienen que ser seguidos (sin huecos) y estar libres
    const seguidos = tramo.every((c, k) => !k || aMin(c) - aMin(tramo[k - 1]) === Math.max(10, +dia.minutos || 30));
    if (!seguidos || tramo.some((c) => ocupados?.[c])) continue;
    if (fecha === hoy && aMin(tramo[0]) <= minAhora + 120) continue; // no se reserva con menos de 2 h
    out.push({ hora: tramo[0], cupos: tramo });
  }
  return out;
}

/** Fechas abiertas desde mañana (o desde una fecha dada, sin incluirla), ordenadas. */
export function fechasAbiertas(agenda = {}, { ahora = Date.now(), despuesDe = null } = {}) {
  const hoy = diaISO(ahora);
  return Object.keys(agenda)
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !agenda[f]?.cerrada && f >= hoy && (!despuesDe || f > despuesDe))
    .sort();
}

/** Primer horario libre para un estudio a partir del día siguiente a `despuesDe` (para reprogramar). */
export function proximoLibre(agenda, ocupacion, tipo, { ahora = Date.now(), despuesDe } = {}) {
  const manana = diaISO(ahora + MS_DIA);
  const desde = despuesDe && despuesDe >= manana ? despuesDe : diaISO(ahora);
  for (const f of fechasAbiertas(agenda, { ahora, despuesDe: desde })) {
    const libres = horariosLibres(agenda[f], ocupacion?.[f], tipo, { ahora, fecha: f });
    if (libres.length) return { fecha: f, ...libres[0] };
  }
  return null;
}

/* ---------- Recordatorio (48 h antes) ---------- */
export const inicioTurno = (t) => new Date(`${t.fecha}T${hora(t.hora)}:00`).getTime();
/** Turnos confirmados que empiezan dentro de las próximas 48 h. */
export const dentroDe48h = (t, ahora = Date.now()) => t?.estado === 'confirmado' && inicioTurno(t) > ahora && inicioTurno(t) - ahora <= 48 * 3600000;
export function faltaTexto(t, ahora = Date.now()) {
  const hs = Math.round((inicioTurno(t) - ahora) / 3600000);
  const dia = diaISO(inicioTurno(t));
  if (hs <= 1) return 'en menos de una hora';
  if (dia === diaISO(ahora)) return `hoy (en ${hs} horas)`;
  if (dia === diaISO(ahora + 86400000)) return 'mañana';
  if (dia === diaISO(ahora + 2 * 86400000)) return 'pasado mañana';
  return `en ${Math.round(hs / 24)} días`;
}

/* ---------- Lista de espera ----------
   esperas: { pac: { tipo, antesDe?, creado, oferta?: { fecha, hora, cupos, vence }, ofrecidos?: { 'fecha_hora': t } } }
   Cada lugar libre se le ofrece primero al que se anotó antes; si en HORAS_OFERTA no lo toma,
   pasa al siguiente. La misma lógica corre en el servidor (avisarEspera_ en Codigos.gs). */
export const HORAS_OFERTA = 12;
export function nuevasOfertas(esperas = {}, agenda = {}, ocupacion = {}, { ahora = Date.now(), dias = 60 } = {}) {
  const ocup = JSON.parse(JSON.stringify(ocupacion || {}));
  const tomar = (f, cupos, v = 'oferta') => { ocup[f] = ocup[f] || {}; cupos.forEach((k) => { ocup[f][k] = v; }); };
  const lista = Object.entries(esperas).filter(([, e]) => e && E_OK(e)).sort((a, b) => (a[1].creado || 0) - (b[1].creado || 0));
  // las ofertas vigentes apartan su lugar
  for (const [, e] of lista) if (e.oferta && e.oferta.vence > ahora) tomar(e.oferta.fecha, e.oferta.cupos || []);
  const limite = diaISO(ahora + dias * MS_DIA);
  const out = [];
  for (const [pac, e] of lista) {
    if (e.oferta && e.oferta.vence > ahora) continue;
    for (const f of fechasAbiertas(agenda, { ahora, despuesDe: diaISO(ahora) })) {
      if (f > limite || (e.antesDe && f >= e.antesDe)) break;
      const libre = horariosLibres(agenda[f], ocup[f], e.tipo, { ahora, fecha: f }).find((l) => !e.ofrecidos?.[`${f}_${l.hora}`]);
      if (!libre) continue;
      tomar(f, libre.cupos);
      out.push({ pac, oferta: { tipo: e.tipo, fecha: f, hora: libre.hora, cupos: libre.cupos, vence: ahora + HORAS_OFERTA * 3600000 } });
      break;
    }
  }
  return out;
}
const E_OK = (e) => ['veda', 'vcc', 'doble'].includes(e.tipo);

/* ---------- Código del turno ---------- */
const ALFA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O ni 1/I para que no se confundan
export function nuevoCodigo(azar = crypto.getRandomValues(new Uint8Array(8))) {
  const c = [...azar].map((b) => ALFA[b % 32]).join('');
  return `MTR-${c.slice(0, 4)}-${c.slice(4, 8)}`;
}
export const codigoValido = (c) => /^MTR-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(String(c || '').trim().toUpperCase());
export const normalizarCodigo = (c) => {
  const s = String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^MTR/, '');
  return s.length === 8 ? `MTR-${s.slice(0, 4)}-${s.slice(4)}` : String(c || '').trim().toUpperCase();
};

/* ---------- Estados ---------- */
export const ESTADOS = {
  confirmado: { nombre: 'Confirmado', tono: 'ok', texto: 'Tu turno está confirmado. Presentate en Admisión con este código.' },
  reprogramado: { nombre: 'Reprogramado', tono: 'aviso', texto: 'Tu turno se reprogramó automáticamente para el próximo día disponible.' },
  suspendido: { nombre: 'Suspendido', tono: 'peligro', texto: 'Tu turno se suspendió. En cuanto haya un lugar libre, la app lo reprograma sola y te avisa por correo.' },
  admitido: { nombre: 'Admitido', tono: 'info', texto: 'Ya pasaste por Admisión: estás autorizado para el estudio.' },
  realizado: { nombre: 'Realizado', tono: 'ok', texto: 'El estudio ya se realizó. El informe te llega por la sección Estudios.' },
  cancelado: { nombre: 'Cancelado', tono: 'neutro', texto: 'Este turno fue cancelado.' },
};
/** Estado para mostrar: un turno confirmado que se movió se ve como «Reprogramado». */
export const estadoVisible = (t) => (t?.estado === 'confirmado' && t.reprogramaciones ? 'reprogramado' : t?.estado || 'confirmado');
export const turnoActivo = (t) => ['confirmado', 'suspendido', 'admitido'].includes(t?.estado);

/* ---------- Factores del paciente para adaptar los textos ---------- */
export function factores(datos = {}, extra = {}) {
  const a = { ...(datos.antecedentes || {}) };
  if (extra.glp1) a.glp1 = true;
  if (extra.anticoagulante) a.anticoagulante = true;
  if (extra.antiagregante) a.antiagregante = true;
  if (extra.insulina) a.insulina = true;
  if (extra.antidiabeticos) a.antidiabeticos = true;
  if (extra.renal) a.renal = true;
  if (extra.apnea) a.apnea = true;
  return a;
}

/** Avisos para el médico (se muestran en su lista de turnos). */
export function alertasMedico(datos = {}) {
  const a = datos.antecedentes || {};
  const out = [];
  if (a.anticoagulante) out.push('Anticoagulado: indicar manejo periendoscópico');
  if (a.antiagregante) out.push('Antiagregado: evaluar si se hará polipectomía');
  if (a.glp1) out.push('Usa agonista de GLP-1: dieta líquida 24 h');
  if (a.insulina) out.push('Insulina: ajustar dosis');
  if (a.marcapasos) out.push('Marcapasos / CDI');
  if (a.embarazo) out.push('Embarazo posible');
  if (a.latex) out.push('Alergia al látex');
  if (a.anestesiaPrev) out.push('Problema con anestesia previa');
  if (datos.alergias) out.push(`Alergias: ${datos.alergias}`);
  return out;
}

/* ---------- Documentos ---------- */
const presentarse = (h) => deMin(Math.max(0, aMin(h) - 30));

/**
 * Arma el consentimiento, la preparación y las recomendaciones.
 * paciente: { nombre, apellido, dni, edad } · turno: { tipo, fecha, hora } · datos: formulario del paciente
 * config: { medico: { nombre, matricula }, lugar: { nombre, direccion }, preparacion }
 */
export function documentos({ paciente = {}, turno, datos = {}, config = {}, extra = {} }) {
  const e = ESTUDIOS[turno.tipo];
  const f = factores(datos, extra);
  const colon = turno.tipo !== 'veda';
  const alta = turno.tipo !== 'vcc';
  const prep = PREPARACIONES[config.preparacion] || PREPARACIONES.peg4;
  const diaAntes = diaISO(new Date(`${turno.fecha}T12:00:00`).getTime() - MS_DIA);
  const tresAntes = diaISO(new Date(`${turno.fecha}T12:00:00`).getTime() - 3 * MS_DIA);
  const tarde = aMin(turno.hora) >= 12 * 60;
  const med = config.medico || {};

  /* Resumen corto (lo primero que lee el paciente) */
  const resumen = [
    `${e.nombre}: ${e.queEs}`,
    `Dura ${e.dura}. Se hace con sedación a cargo de un anestesiólogo: vas a estar dormido/a y sin dolor.`,
    `Presentate a las ${hora(presentarse(turno.hora))} (30 minutos antes) en ${config.lugar?.nombre || 'el servicio de endoscopia'}${config.lugar?.direccion ? `, ${config.lugar.direccion}` : ''}, con DNI, credencial de tu cobertura, este código y los estudios prequirúrgicos.`,
    'Vení con un adulto que te acompañe y te lleve de vuelta: después de la sedación no podés manejar ni irte solo/a.',
  ];

  /* Preparación paso a paso */
  const pasos = [];
  if (colon) {
    pasos.push({ cuando: `Desde el ${fechaCorta(tresAntes)} (3 días antes)`, que: [
      'Dieta baja en residuos: carnes, pollo y pescado sin piel, huevo, arroz y fideos blancos, pan blanco, queso, caldos, gelatina.',
      'Evitá frutas y verduras, legumbres, cereales integrales, semillas (tomate, kiwi, uva, sésamo, chía, lino) y frutos secos.',
      'Suspendé el hierro por boca (si lo tomás) hasta el día del estudio.',
      'Tomá mucha agua: al menos 2 litros por día.',
    ] });
    pasos.push({ cuando: `El ${fechaCorta(diaAntes)} (día anterior)`, que: [
      'Desayuno y almuerzo livianos bajos en residuos. Después del almuerzo, SOLO líquidos claros: agua, caldo colado, té o café sin leche, jugos sin pulpa, bebidas deportivas, gelatina (no roja ni violeta).',
      `Preparación indicada: ${prep.nombre}.`,
      `Primera toma: ${prep.tarde}.`,
      'Es normal tener muchas deposiciones: quedate cerca del baño, usá crema protectora y caminá entre vaso y vaso si te da náuseas.',
    ] });
    pasos.push({ cuando: `El ${fechaCorta(turno.fecha)} (día del estudio)`, que: [
      `Segunda toma: ${prep.manana}.${tarde ? '' : ' Si tu turno es muy temprano, consultá si conviene tomarla de madrugada o toda la tarde anterior.'}`,
      'La preparación está bien cuando lo que sale es líquido claro, amarillento y sin restos (como té). Si sigue saliendo marrón o con restos, avisá en Admisión.',
      'Hasta 2 horas antes podés tomar líquidos claros. En las 2 horas previas, nada por boca (ni agua, ni chicles, ni caramelos).',
    ] });
  } else {
    pasos.push({ cuando: `El ${fechaCorta(diaAntes)} (día anterior)`, que: [
      'Cená liviano antes de las 22 h.',
      f.glp1 ? 'Como usás un GLP-1, ese día hacé solo dieta líquida (ver tus recomendaciones).' : 'No hace falta ninguna otra preparación.',
    ] });
    pasos.push({ cuando: `El ${fechaCorta(turno.fecha)} (día del estudio)`, que: [
      `Ayuno de sólidos de 8 horas: no comas nada desde las ${hora(deMin(Math.max(0, aMin(turno.hora) - 8 * 60)))}.`,
      `Líquidos claros (agua, té o café sin leche, jugo sin pulpa) solo hasta las ${hora(deMin(Math.max(0, aMin(turno.hora) - 2 * 60)))} (2 horas antes).`,
      'Nada de chicles, caramelos ni cigarrillos esa mañana.',
    ] });
  }
  pasos.push({ cuando: 'Para llevar', que: [
    'DNI, credencial de la cobertura y la orden médica si tu cobertura la pide.',
    'Los resultados del laboratorio, el ECG con informe y la valoración anestesiológica.',
    'Estudios endoscópicos anteriores, si tenés.',
    'Ropa cómoda, sin alhajas ni piercings; uñas sin esmalte; sacate las prótesis dentales antes de entrar.',
  ] });

  /* Recomendaciones según las guías y los factores del paciente */
  const rec = [];
  rec.push({ tono: 'info', titulo: 'Medicación habitual', texto: 'Tomá tus remedios de siempre con un sorbo de agua hasta 2 horas antes (por ejemplo, los de la presión, el corazón o la tiroides), salvo los que se nombran abajo.' });
  if (f.anticoagulante) rec.push({ tono: 'peligro', titulo: 'Anticoagulantes', texto: 'NO los suspendas por tu cuenta. Según las guías ASGE/ACG 2022 y BSG/ESGE 2021, para estudios diagnósticos muchas veces se siguen tomando y, si se prevé sacar pólipos, se suspenden unos días con pauta del médico (el acenocumarol o la warfarina con control de RIN; apixabán, rivaroxabán o dabigatrán según la función renal). Tu médico te va a indicar cómo hacerlo.' });
  if (f.antiagregante) rec.push({ tono: 'aviso', titulo: 'Aspirina y antiagregantes', texto: 'La aspirina en dosis bajas por lo general se sigue tomando. El clopidogrel, prasugrel o ticagrelor pueden requerir una pausa si se sacan pólipos: no los suspendas sin consultar, sobre todo si tenés un stent coronario.' });
  if (f.glp1) rec.push({ tono: 'aviso', titulo: 'Semaglutida, tirzepatida y otros GLP-1', texto: 'Estos medicamentos vacían el estómago más lento. La guía multisocietaria 2024 aconseja, en la mayoría de los casos, seguir con el tratamiento y hacer dieta solo líquida las 24 horas previas. Si ese día tenés náuseas, vómitos o hinchazón, avisá en Admisión: puede ser necesario reprogramar. Tu médico puede indicarte saltear la dosis semanal previa.' });
  if (f.insulina) rec.push({ tono: 'aviso', titulo: 'Insulina', texto: 'La noche anterior usá la mitad de la dosis de insulina lenta y la mañana del estudio no te apliques la rápida. Medí tu glucemia al levantarte y llevá caramelos por si baja: si tenés menos de 70 mg/dL, tomá un vaso de jugo azucarado (es líquido claro) y avisá. Confirmá la dosis con tu médico.' });
  if (f.antidiabeticos) rec.push({ tono: 'aviso', titulo: 'Pastillas para la diabetes', texto: 'La mañana del estudio no las tomes; retomalas cuando vuelvas a comer. Si tomás dapagliflozina, empagliflozina o similares (gliflozinas), en general se suspenden 3 días antes: consultalo con tu médico.' });
  if (f.renal && colon) rec.push({ tono: 'aviso', titulo: 'Riñones', texto: 'Como tenés enfermedad renal, no uses preparaciones con fosfato de sodio. El polietilenglicol es la opción segura.' });
  if (f.constipacion && colon) rec.push({ tono: 'aviso', titulo: 'Constipación', texto: 'Con constipación crónica conviene empezar la dieta baja en residuos 5 días antes y sumar la preparación reforzada que indique tu médico.' });
  if (f.apnea) rec.push({ tono: 'info', titulo: 'Apnea del sueño', texto: 'Si usás CPAP, llevalo. Avisale al anestesiólogo.' });
  if (f.marcapasos) rec.push({ tono: 'info', titulo: 'Marcapasos o cardiodesfibrilador', texto: 'Llevá la credencial del dispositivo y el último control.' });
  if (f.embarazo) rec.push({ tono: 'peligro', titulo: 'Embarazo', texto: 'Avisá a tu médico antes del estudio: puede cambiar la indicación o el momento.' });
  if (f.latex) rec.push({ tono: 'aviso', titulo: 'Látex', texto: 'Recordalo en Admisión para que preparen material sin látex.' });
  rec.push({ tono: 'info', titulo: 'Después del estudio', texto: 'Durante 24 horas no manejes, no uses máquinas peligrosas, no tomes alcohol ni firmes documentos importantes. Es normal sentir gases o la garganta irritada unas horas. Empezá con comidas livianas.' });
  rec.push({ tono: 'peligro', titulo: 'Señales de alarma', texto: 'Dolor abdominal fuerte o que aumenta, fiebre, vómitos, sangrado abundante (más que unas gotas), materia fecal negra, dolor en el pecho o dificultad para respirar o tragar: andá a una guardia o llamá al 107.' });
  rec.push({ tono: 'info', titulo: 'Resultados', texto: 'El informe del estudio se entrega al terminar. Si se toman biopsias, el resultado tarda entre 7 y 15 días y te llega por la sección Estudios de la app.' });

  /* Consentimiento informado (Ley 26.529, art. 5) */
  const riesgos = [];
  if (alta) riesgos.push('Endoscopia alta: molestia de garganta pasajera (frecuente); sangrado o perforación muy poco frecuentes (menos de 1 cada 10.000 estudios diagnósticos).');
  if (colon) riesgos.push('Colonoscopia: distensión y gases (frecuente); sangrado, sobre todo si se sacan pólipos (alrededor de 1 cada 100 a 300 polipectomías); perforación poco frecuente (1 cada 1.000 a 3.000 estudios, algo más si se sacan pólipos grandes). La preparación puede causar náuseas, mareos o alteraciones de las sales del cuerpo.');
  riesgos.push('Sedación: baja de la presión o del oxígeno, arritmias, reacciones alérgicas o broncoaspiración (raras y controladas por el anestesiólogo con monitoreo continuo).');
  riesgos.push('Muy rara vez una complicación puede requerir internación, transfusión, otro procedimiento o una cirugía.');
  if (f.anticoagulante || f.antiagregante) riesgos.push('Por tu medicación anticoagulante o antiagregante, el riesgo de sangrado puede ser mayor.');
  if (f.corazon || f.pulmon || f.apnea) riesgos.push('Por tus antecedentes cardíacos o respiratorios, el riesgo de la sedación puede ser algo mayor; el anestesiólogo lo tiene en cuenta.');

  const alternativas = [];
  if (alta) alternativas.push('Para el tubo digestivo alto: seriada esófago-gastro-duodenal con contraste o pruebas no invasivas (aliento para Helicobacter pylori), que no permiten tomar biopsias.');
  if (colon) alternativas.push('Para el colon: test de sangre oculta en materia fecal, colonografía por tomografía o cápsula endoscópica, que no permiten sacar pólipos y, si muestran algo, requieren igual una colonoscopia.');

  const consentimiento = [
    ['Estudio propuesto', `${e.nombre}. ${e.queEs} Durante el estudio pueden tomarse biopsias (muestras pequeñas e indoloras) y, si hace falta, ${colon ? 'sacarse pólipos (polipectomía), ' : ''}hacer tatuaje endoscópico o tratar un sangrado.`],
    ['Objetivo y beneficios', 'Diagnosticar la causa de los síntomas, prevenir o detectar a tiempo enfermedades como el cáncer digestivo y, en el mismo acto, tratar lesiones (pólipos o sangrados) sin cirugía.'],
    ['Sedación', 'El estudio se hace con sedación endovenosa controlada por un médico anestesiólogo, con monitoreo de la presión, el ritmo cardíaco y el oxígeno.'],
    ['Riesgos y molestias previsibles', riesgos.join(' ')],
    ['Alternativas', alternativas.join(' ')],
    ['Si no me hago el estudio', 'Puede demorarse el diagnóstico o el tratamiento de la causa de mis síntomas o no detectarse a tiempo lesiones precancerosas.'],
    ['Mis derechos', 'Recibí esta información por escrito antes del estudio y pude hacer preguntas. Puedo revocar este consentimiento en cualquier momento antes del estudio, sin expresar causa y sin que eso afecte mi atención (Ley 26.529, art. 10). El día del estudio el equipo médico puede ampliar esta información.'],
    ['Declaración', `Yo, ${paciente.nombre || ''} ${paciente.apellido || ''}${paciente.dni ? `, DNI ${Number(paciente.dni).toLocaleString('es-AR')}` : ''}, declaro haber leído y comprendido esta información y autorizo al Dr./Dra. ${med.nombre || 'médico/a actuante'}${med.matricula ? ` (${med.matricula})` : ''} y a su equipo a realizar el estudio indicado el ${fechaLarga(turno.fecha)}.`],
  ];

  return { estudio: e, resumen, pasos, recomendaciones: rec, consentimiento, fuentes: FUENTES, presentarse: hora(presentarse(turno.hora)) };
}

/* ---------- Órdenes de estudios prequirúrgicos ---------- */
export function ordenes(faltan, { tipo } = {}) {
  const proc = tipo ? `${ESTUDIOS[tipo].nombre} bajo sedación` : 'endoscopia digestiva bajo sedación';
  const dx = `Evaluación prequirúrgica para ${proc}`;
  const O = {
    analitica: { titulo: 'Laboratorio prequirúrgico', rp: ['Hemograma completo con recuento de plaquetas', 'Glucemia en ayunas', 'Uremia', 'Coagulograma: tiempo de protrombina (TP) con RIN y KPTT'], dx },
    ecg: { titulo: 'Electrocardiograma', rp: ['Electrocardiograma de 12 derivaciones con informe y lectura cardiológica'], dx },
    anestesia: { titulo: 'Interconsulta con Anestesiología', rp: ['Interconsulta con Anestesiología: valoración preanestésica (riesgo ASA) para sedación endovenosa'], dx },
  };
  return faltan.map((id) => ({ id, ...O[id] })).filter((o) => o.titulo);
}

/* ---------- Evento de calendario (.ics) ---------- */
export function ics({ codigo, tipo, fecha, hora: hh, lugar = '' }) {
  const e = ESTUDIOS[tipo];
  const ini = `${fecha.replace(/-/g, '')}T${presentarse(hh)}00`;
  const fin = `${fecha.replace(/-/g, '')}T${deMin(aMin(hh) + 60 * (e.cupos + 1))}00`;
  const esc = (s) => String(s).replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Metria//Endoscopia//ES', 'BEGIN:VEVENT',
    `UID:${codigo}@metria`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=America/Argentina/Buenos_Aires:${ini}`, `DTEND;TZID=America/Argentina/Buenos_Aires:${fin}`,
    `SUMMARY:${esc(`${e.corto} · turno ${codigo}`)}`, `LOCATION:${esc(lugar)}`,
    `DESCRIPTION:${esc(`Presentarse 30 minutos antes con DNI, cobertura y el código ${codigo}. Venir acompañado/a.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana tenés tu estudio: revisá la preparación', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

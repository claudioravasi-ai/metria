/* ============================================================
   Vademécum mínimo para reconocer la medicación habitual y cruzarla
   con los agonistas de GLP-1. Genérico + marcas frecuentes en Argentina.
   Cada fármaco lleva una o más clases; las interacciones van por clase.
   ============================================================ */

export const CLASES = {
  insulina: 'Insulina',
  sulfonilurea: 'Sulfonilurea',
  meglitinida: 'Meglitinida',
  dpp4: 'Inhibidor de DPP-4',
  glp1: 'Agonista de GLP-1',
  sglt2: 'Inhibidor de SGLT2',
  metformina: 'Biguanida',
  pioglitazona: 'Tiazolidinediona',
  avk: 'Anticoagulante antagonista de la vitamina K',
  levotiroxina: 'Hormona tiroidea',
  aco: 'Anticonceptivo oral',
  digoxina: 'Digitálico',
  litio: 'Litio',
  antiepileptico: 'Antiepiléptico de margen estrecho',
  inmunosupresor: 'Inmunosupresor de margen estrecho',
  diuretico: 'Diurético',
  ieca: 'IECA',
  ara2: 'ARA II',
  aine: 'Antiinflamatorio no esteroideo',
  opioide: 'Opioide',
  anticolinergico: 'Anticolinérgico',
  antipsicotico: 'Antipsicótico',
  corticoide: 'Corticoide sistémico',
  antidepresivoPeso: 'Antidepresivo que aumenta el peso',
  gabapentinoide: 'Gabapentinoide',
  valproato: 'Valproato',
  betabloqueante: 'Betabloqueante',
  estatina: 'Estatina',
  ezetimibe: 'Ezetimibe',
  fibrato: 'Fibrato',
  bcc: 'Bloqueante cálcico',
  antiagregante: 'Antiagregante',
  doac: 'Anticoagulante oral directo',
  orlistat: 'Orlistat',
  teofilina: 'Teofilina',
  antihistaminicoPeso: 'Antihistamínico sedante',
};

/** [genérico, [marcas], [clases]] */
const BASE = [
  ['Metformina', ['Glucophage', 'Glafornil', 'Islotin', 'Dbi'], ['metformina']],
  ['Glibenclamida', ['Daonil', 'Euglucon'], ['sulfonilurea']],
  ['Gliclazida', ['Diamicron', 'Glicazida'], ['sulfonilurea']],
  ['Glimepirida', ['Amaryl', 'Glimepil'], ['sulfonilurea']],
  ['Repaglinida', ['Novonorm'], ['meglitinida']],
  ['Sitagliptina', ['Januvia', 'Janumet', 'Sitagil'], ['dpp4']],
  ['Vildagliptina', ['Galvus', 'Galvus Met'], ['dpp4']],
  ['Saxagliptina', ['Onglyza'], ['dpp4']],
  ['Linagliptina', ['Trayenta', 'Jentadueto'], ['dpp4']],
  ['Teneligliptina', ['Tenelia'], ['dpp4']],
  ['Dapagliflozina', ['Forxiga', 'Xigduo'], ['sglt2']],
  ['Empagliflozina', ['Jardiance', 'Synjardy'], ['sglt2']],
  ['Canagliflozina', ['Invokana'], ['sglt2']],
  ['Pioglitazona', ['Actos', 'Glustin'], ['pioglitazona']],
  ['Insulina glargina', ['Lantus', 'Toujeo', 'Basaglar'], ['insulina']],
  ['Insulina degludec', ['Tresiba'], ['insulina']],
  ['Insulina detemir', ['Levemir'], ['insulina']],
  ['Insulina NPH', ['Humulin N', 'Insulatard', 'Betalin NPH'], ['insulina']],
  ['Insulina corriente', ['Humulin R', 'Actrapid'], ['insulina']],
  ['Insulina lispro', ['Humalog'], ['insulina']],
  ['Insulina aspártica', ['NovoRapid', 'Fiasp'], ['insulina']],
  ['Insulina glulisina', ['Apidra'], ['insulina']],
  ['Semaglutida', ['Ozempic', 'Wegovy', 'Rybelsus'], ['glp1']],
  ['Liraglutida', ['Victoza', 'Saxenda'], ['glp1']],
  ['Dulaglutida', ['Trulicity'], ['glp1']],
  ['Tirzepatida', ['Mounjaro', 'Zepbound'], ['glp1']],
  ['Exenatida', ['Byetta', 'Bydureon'], ['glp1']],
  ['Warfarina', ['Coumadin'], ['avk']],
  ['Acenocumarol', ['Sintrom'], ['avk']],
  ['Apixabán', ['Eliquis'], ['doac']],
  ['Rivaroxabán', ['Xarelto'], ['doac']],
  ['Dabigatrán', ['Pradaxa'], ['doac']],
  ['Levotiroxina', ['T4 Montpellier', 'Eutirox', 'Levotiroxina Elea', 'Tiroxin'], ['levotiroxina']],
  ['Etinilestradiol / levonorgestrel', ['Microgynon', 'Norgestrel', 'Anticonceptivo oral'], ['aco']],
  ['Etinilestradiol / drospirenona', ['Yasmin', 'Yaz', 'Isis'], ['aco']],
  ['Desogestrel', ['Cerazet', 'Nactali'], ['aco']],
  ['Dienogest / etinilestradiol', ['Mirelle', 'Gynera'], ['aco']],
  ['Digoxina', ['Lanoxin'], ['digoxina']],
  ['Carbonato de litio', ['Ceglution', 'Litio'], ['litio']],
  ['Fenitoína', ['Epamin'], ['antiepileptico']],
  ['Carbamazepina', ['Tegretol'], ['antiepileptico']],
  ['Ácido valproico', ['Depakene', 'Valcote'], ['valproato', 'antiepileptico']],
  ['Ciclosporina', ['Sandimmun Neoral'], ['inmunosupresor']],
  ['Tacrolimus', ['Prograf'], ['inmunosupresor']],
  ['Hidroclorotiazida', ['Hidroclorotiazida'], ['diuretico']],
  ['Clortalidona', ['Hygroton'], ['diuretico']],
  ['Indapamida', ['Natrilix'], ['diuretico']],
  ['Furosemida', ['Lasix'], ['diuretico']],
  ['Espironolactona', ['Aldactone'], ['diuretico']],
  ['Enalapril', ['Lotrial', 'Renitec'], ['ieca']],
  ['Lisinopril', ['Zestril'], ['ieca']],
  ['Ramipril', ['Triatec'], ['ieca']],
  ['Perindopril', ['Coversyl'], ['ieca']],
  ['Losartán', ['Cozaar', 'Losacor', 'Fensartan'], ['ara2']],
  ['Valsartán', ['Diovan'], ['ara2']],
  ['Telmisartán', ['Micardis'], ['ara2']],
  ['Candesartán', ['Atacand'], ['ara2']],
  ['Olmesartán', ['Olmetec'], ['ara2']],
  ['Ibuprofeno', ['Ibupirac', 'Actron'], ['aine']],
  ['Diclofenac', ['Voltaren', 'Oxaprost'], ['aine']],
  ['Naproxeno', ['Alidase', 'Naprux'], ['aine']],
  ['Ketorolac', ['Dolten'], ['aine']],
  ['Meloxicam', ['Mobic'], ['aine']],
  ['Tramadol', ['Tramal'], ['opioide']],
  ['Codeína', ['Codeína'], ['opioide']],
  ['Morfina', ['Morfina'], ['opioide']],
  ['Oxicodona', ['Oxycontin'], ['opioide']],
  ['Oxibutinina', ['Ditropan'], ['anticolinergico']],
  ['Amitriptilina', ['Tryptanol'], ['anticolinergico', 'antidepresivoPeso']],
  ['Mirtazapina', ['Remeron', 'Comenter'], ['antidepresivoPeso']],
  ['Paroxetina', ['Aropax', 'Paxil'], ['antidepresivoPeso']],
  ['Olanzapina', ['Zyprexa'], ['antipsicotico']],
  ['Quetiapina', ['Seroquel'], ['antipsicotico']],
  ['Risperidona', ['Risperdal'], ['antipsicotico']],
  ['Clozapina', ['Lapenax'], ['antipsicotico']],
  ['Prednisona', ['Deltisona', 'Meticorten'], ['corticoide']],
  ['Meprednisona', ['Deltisona B'], ['corticoide']],
  ['Dexametasona', ['Decadron'], ['corticoide']],
  ['Gabapentin', ['Neurontin'], ['gabapentinoide']],
  ['Pregabalina', ['Lyrica'], ['gabapentinoide']],
  ['Atenolol', ['Prenormine'], ['betabloqueante']],
  ['Metoprolol', ['Lopresor'], ['betabloqueante']],
  ['Bisoprolol', ['Concor'], ['betabloqueante']],
  ['Carvedilol', ['Dilatrend'], ['betabloqueante']],
  ['Nebivolol', ['Nebilet'], ['betabloqueante']],
  ['Atorvastatina', ['Lipitor', 'Atorvastatina'], ['estatina']],
  ['Rosuvastatina', ['Crestor', 'Rosuvast'], ['estatina']],
  ['Simvastatina', ['Zocor'], ['estatina']],
  ['Pravastatina', ['Pravacol'], ['estatina']],
  ['Ezetimibe', ['Zetia', 'Vytorin'], ['ezetimibe']],
  ['Fenofibrato', ['Lipanthyl'], ['fibrato']],
  ['Gemfibrozil', ['Lopid'], ['fibrato']],
  ['Amlodipina', ['Norvasc', 'Amloc'], ['bcc']],
  ['Nifedipina', ['Adalat'], ['bcc']],
  ['Aspirina', ['Aspirinetas', 'Bayaspirina'], ['antiagregante']],
  ['Clopidogrel', ['Plavix'], ['antiagregante']],
  ['Orlistat', ['Xenical'], ['orlistat']],
  ['Teofilina', ['Teolong'], ['teofilina']],
];

export const VADEMECUM = BASE.map(([g, m, c]) => ({ generico: g, marcas: m, clases: c }));

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca un fármaco por genérico o marca (para autocompletar). */
export function buscar(texto, max = 8) {
  const t = norm(texto);
  if (t.length < 2) return [];
  const res = [];
  for (const f of VADEMECUM) {
    const g = norm(f.generico);
    const marca = f.marcas.find((m) => norm(m).startsWith(t) || norm(m).includes(' ' + t));
    if (g.startsWith(t) || g.includes(t) || marca) res.push({ ...f, marca: marca || null, puntos: g.startsWith(t) ? 0 : 1 });
  }
  return res.sort((a, b) => a.puntos - b.puntos).slice(0, max);
}

/** Reconoce el fármaco de un texto libre ("Lotrial 10 mg"). */
export function reconocer(texto) {
  const t = norm(texto);
  if (!t) return null;
  for (const f of VADEMECUM) {
    if (t.includes(norm(f.generico))) return f;
    if (f.marcas.some((m) => t.includes(norm(m)))) return f;
  }
  return null;
}

/** Clases presentes en una lista de medicación [{nombre, clases?}]. */
export function clasesDe(meds = []) {
  const set = new Set();
  for (const m of meds) {
    const cl = m.clases?.length ? m.clases : reconocer(m.nombre)?.clases || [];
    cl.forEach((c) => set.add(c));
  }
  return set;
}

/** Banderas útiles para los cálculos de riesgo. */
export function banderas(meds = []) {
  const c = clasesDe(meds);
  return {
    clases: c,
    antihipertensivo: ['ieca', 'ara2', 'diuretico', 'bcc', 'betabloqueante'].some((k) => c.has(k)),
    estatina: c.has('estatina'),
    fibrato: c.has('fibrato'),
    antidiabetico: ['insulina', 'sulfonilurea', 'meglitinida', 'dpp4', 'glp1', 'sglt2', 'metformina', 'pioglitazona'].some((k) => c.has(k)),
    glp1: c.has('glp1'),
  };
}

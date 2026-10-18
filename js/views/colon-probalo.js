/* ============================================================
   Portada · «¿Te corresponde una colonoscopia?»
   Mismo formato que la calculadora metabólica (probalo): controles a la
   izquierda, medidor con aguja a la derecha. Nada se guarda.
   El motor está en engine/colon.js.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { segmentado, deslizador, interruptor } from '../ui/campos.js';
import * as G from '../ui/graficos.js';
import { CATS_COLON, evaluarColon } from '../engine/colon.js';

// Estilos propios del bloque (archivo aparte para no tocar app.css)
function estilos() {
  if (document.querySelector('link[data-colon-css]')) return;
  document.head.append(h('link', { rel: 'stylesheet', href: 'css/colon.css', 'data-colon-css': '' }));
}

export function probaloColon() {
  estilos();
  const st = { sexo: 'F', edad: 50, previa: false, aniosPrevia: 5, indicado: false, intervaloIndicado: 5, perdidaPeso: false, cambioHabito: false, sangreMoco: false, fit: 'no', familiar: 'ninguno', familiares1: 1, edadFamiliar: 65 };

  const corto = (v) => (CATS_COLON.find((c) => v < c.hasta) || CATS_COLON[CATS_COLON.length - 1]).corto;
  const gauge = G.medidor({ min: 0, max: 100, unidad: 'orientación', etiqueta: 'Necesidad de colonoscopia', formato: corto, bandas: CATS_COLON.map((c) => ({ desde: c.desde, hasta: c.hasta, color: c.color, nombre: c.nombre })), marcas: [] });
  const estudio = h('strong.colon-kpi-txt');
  const cuando = h('strong.colon-kpi-txt');
  const motivos = h('ul.colon-motivos');

  const recalcular = () => {
    const r = evaluarColon({ ...st, intervaloIndicado: st.previa && st.indicado ? st.intervaloIndicado : null });
    gauge.set(r.valor, r.categoria.nombre);
    estudio.textContent = r.estudio;
    cuando.textContent = r.cuando;
    motivos.replaceChildren(...r.motivos.map((m) => h('li', m)));
  };

  const sl = (etq, k, min, max, paso, u, ic) => deslizador({ etiqueta: etq, min, max, paso, valor: st[k], unidad: u, icono: ic, onInput: (v) => { st[k] = v; recalcular(); } }).el;
  const seg = (etq, k, ops, alCambiar, chico = true) => h('div.control', h('div.control-cab', h('label', etq)),
    segmentado(ops.map(([valor, texto]) => ({ valor, texto })), st[k], (v) => { st[k] = v; alCambiar?.(); recalcular(); }, { etiqueta: etq, pequeno: chico }));
  const sw = (etq, k, desc) => interruptor(etq, st[k], (v) => { st[k] = v; recalcular(); }, desc);

  // Preguntas que aparecen según la respuesta anterior
  const indicadoSl = sl('Le indicaron repetirla a los', 'intervaloIndicado', 1, 10, 1, 'años', 'calendario');
  const previaExtra = h('div.colon-sub',
    sl('¿Cuánto tiempo pasó?', 'aniosPrevia', 0, 20, 1, 'años', 'reloj'),
    seg('¿El médico le dijo cuándo repetirla?', 'indicado', [[false, 'No / no recuerdo'], [true, 'Sí']], () => { indicadoSl.hidden = !st.indicado; }),
    indicadoSl);
  const familiarExtra = h('div.colon-sub',
    seg('¿Cuántos familiares de 1.er grado?', 'familiares1', [[1, 'Uno'], [2, 'Dos o más']]),
    sl('Edad del familiar al diagnóstico', 'edadFamiliar', 20, 90, 1, 'años', 'usuario'));
  const mostrar = () => { previaExtra.hidden = !st.previa; indicadoSl.hidden = !st.indicado; familiarExtra.hidden = st.familiar !== '1'; };
  mostrar();
  queueMicrotask(recalcular);

  return h('section.probalo.colon-probalo', { 'data-revelar': '' },
    h('div.seccion-titulo', h('span.portada-etiqueta', icono('endoscopio', { tam: 14 }), 'Colon y recto'), h('h2', 'Mové los controles y mirá si te corresponde una colonoscopia'), h('p', 'Según las últimas guías (USPSTF, USMSTF, ACG, ESGE, AGA). Sin registrarte y sin guardar nada.')),
    h('div.probalo-grid',
      h('div.probalo-controles',
        seg('Sexo biológico', 'sexo', [['F', 'Mujer'], ['M', 'Varón']], null, false),
        sl('Edad', 'edad', 18, 90, 1, 'años', 'calendario'),
        seg('¿Se hizo una colonoscopia antes?', 'previa', [[false, 'No'], [true, 'Sí']], mostrar),
        previaExtra,
        h('div.control', h('div.control-cab', h('label', icono('alerta', { tam: 16 }), 'En el último tiempo…')),
          h('div.colon-sintomas',
            sw('Sangre o moco en la materia fecal', 'sangreMoco'),
            sw('Cambios en el hábito intestinal', 'cambioHabito', 'Cambió la forma en que va de cuerpo normalmente'),
            sw('Pérdida de peso sin buscarla', 'perdidaPeso'))),
        seg('Test de sangre oculta en heces', 'fit', [['no', 'No se hizo'], ['neg', 'Negativo (<1 año)'], ['negViejo', 'Negativo (>1 año)'], ['pos', 'Positivo']]),
        seg('Familiares con cáncer colorrectal', 'familiar', [['ninguno', 'Ninguno'], ['1', '1.er grado'], ['2', '2.º grado'], ['3', '3.er grado']], mostrar),
        h('p.colon-ayuda', '1.er grado: padres, hermanos, hijos. 2.º: abuelos, tíos, nietos. 3.º: bisabuelos, primos.'),
        familiarExtra),
      h('div.probalo-resultado.colon-resultado',
        h('div.probalo-gauge', gauge.el),
        h('div.probalo-kpis',
          h('div.kpi-vidrio', { style: { '--c1': '#0ea5e9', '--c2': '#6366f1' } }, h('small', 'Qué estudio'), estudio),
          h('div.kpi-vidrio', { style: { '--c1': '#ec4899', '--c2': '#f97316' } }, h('small', 'Cuándo'), cuando)),
        motivos,
        h('p.colon-aviso', icono('info', { tam: 15 }), 'Es una orientación aproximada, no un diagnóstico: la decisión la toma tu médico en la consulta presencial, según tus antecedentes, medicación y hábitos. Si tenés síntomas, consultá aunque el resultado diga otra cosa. No contempla enfermedad inflamatoria intestinal ni síndromes hereditarios conocidos (Lynch, poliposis): en esos casos el control lo indica tu médico.'))));
}

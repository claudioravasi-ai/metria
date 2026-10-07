/* ============================================================
   Manual de uso (Ayuda). Mantener al día con cada cambio de la app.
   ============================================================ */

import { h } from '../core/dom.js';
import { heroe, tarjeta, plegable } from '../core/ui.js';
import { CONFIG } from '../config.js';
import { POLITICA, TERMINOS, verTexto } from './legal.js';

const PACIENTE = [
  ['Crear la cuenta', 'Desde «Soy paciente» → «Crear cuenta». Necesitás tu correo (te llega un enlace para verificarlo), DNI, fecha de nacimiento y una contraseña de al menos 10 caracteres. Al final aceptás la política de privacidad y el uso de tus datos de salud.'],
  ['Completar mis datos', 'En «Mis datos» cargás medidas, presión, hábitos, enfermedades, medicación y laboratorio. A la derecha (o abajo en el teléfono) ves los cálculos en vivo. Nada se guarda hasta que tocás «Guardar cambios».'],
  ['Otras enfermedades y otros análisis', 'En «Mis datos» podés escribir enfermedades que no están en la lista y agregar cualquier análisis (vitamina D, ferritina, calcitonina, lipasa…). Si la app los reconoce, los usa en los cálculos y en el plan; si no, quedan marcados para que los revise tu médico.'],
  ['Plan integral', 'Calorías del día con topes de seguridad, proteínas, carbohidratos, grasas, fibra y agua, reglas de alimentación según tus enfermedades, actividad física con precauciones y el calendario de controles. Los medicamentos aparecen como temas para hablar con tu médico.'],
  ['Metabolismo, Cuerpo y Corazón', 'Cada sección arranca con tus datos y tiene controles para simular: arrastrá el peso, la presión o el colesterol y mirá cómo cambian los gráficos al instante. Simular no modifica tu ficha.'],
  ['Laboratorio', 'Muestra tus análisis con colores: verde normal, amarillo límite, rojo alto. Incluye índices calculados como el filtrado renal o el HOMA.'],
  ['Tratamiento', 'Si tu médico te indicó un tratamiento, ves la dosis de hoy, el calendario completo, cómo aplicarlo, qué hacer si te olvidás una dosis y las señales de alarma. Cada semana podés contarle cómo te sentiste. Si no hay plan, ves solo una orientación general sin dosis.'],
  ['Estudios', `Ves un bosquejo de cada estudio. Al tocarlo te avisamos que vas a ver información sensible y recién ahí lo traemos de la base. Si lo descargás, queda ${CONFIG.horasTrasDescarga} horas más y se borra para siempre: guardalo en tu teléfono o computadora.`],
  ['Privacidad', 'Mirá quién abrió o descargó tus estudios, descargá una copia de tus datos, pedí correcciones o la baja, y cambiá tu contraseña.'],
  ['Varios equipos', 'Podés entrar desde el teléfono, la tablet y la computadora a la vez: lo que cambia en uno aparece en los otros en segundos. Por seguridad, la sesión se cierra sola tras unos minutos sin uso y al cerrar el navegador (salvo que marques «Recordarme en este equipo»).'],
];

const MEDICO = [
  ['Alta de profesionales', 'Desde «Soy profesional» → «Crear cuenta» con matrícula (MN o MP). La cuenta queda pendiente hasta que el médico titular verifica la matrícula (SISA/REFEPS) y la habilita en «Profesionales».'],
  ['Pacientes', 'La lista se actualiza en vivo. Buscá por apellido, nombre o los últimos 3 dígitos del DNI y filtrá por riesgo o candidatos a tratamiento. Los datos completos se traen solo al abrir la ficha.'],
  ['Verificar identidad', 'Antes de cargar estudios, constatá el DNI en la consulta y tocá «Verificar identidad». Sin eso no se pueden subir estudios a esa cuenta.'],
  ['Ficha', 'Resumen, Datos (editables), Metabolismo, Cuerpo (con estadificación Lancet 2025 y Edmonton), Corazón (PREVENT 10 y 30 años, categoría clínica, objetivo de LDL, presión, síndrome metabólico, FINDRISC), Laboratorio, Tratamiento, Estudios, Notas y Accesos.'],
  ['Motor GLP-1 / GIP', 'Indica si el paciente es candidato, contraindicaciones absolutas y relativas, interacciones con su medicación, opciones ordenadas con su justificación, proyección interactiva de peso y el armado del plan con fechas. Al confirmarlo, el paciente lo ve en su app. Recordá emitir la receta por una plataforma registrada.'],
  ['Plan integral y segunda opinión con IA', 'La pestaña «Plan integral» arma alimentación, actividad, tratamiento sugerido con dosis y tiempos, interacciones, efectos adversos y controles con TODOS los datos (incluidos los extra). «Analizar con IA» envía la ficha sin datos identificatorios a Claude y devuelve una revisión que podés guardar en Notas. Requiere el servidor de Apps Script con la clave de Anthropic.'],
  ['Estudios', `Arrastrá archivos (PDF, imágenes, DICOM, video, audio, texto, Word, Excel, ZIP; hasta ${CONFIG.tamanoMaximoMB} MB). La app genera un bosquejo borroso, guarda el archivo en partes en la base y el paciente lo ve al instante. Se borran ${CONFIG.horasTrasDescarga} h después de la primera descarga o a los ${CONFIG.diasRetencionMaxima} días.`],
  ['Pedidos de los pacientes', 'En el Panel aparecen los pedidos de acceso, rectificación o baja. La ley da 10 días corridos para el acceso y 5 hábiles para rectificar o suprimir.'],
  ['Borrado automático', 'Un proceso programado borra cada hora los estudios vencidos; además se borran cuando un médico o el paciente abre la app. Desde el vencimiento, las reglas de la base ya impiden leerlos. Desde el Panel podés forzar un barrido completo.'],
];

const FAQ = [
  ['¿Los cálculos son exactos?', 'Usan fórmulas validadas y publicadas, pero son estimaciones poblacionales. Sirven para orientar; el diagnóstico lo hace el médico.'],
  ['¿Por qué PREVENT y no Framingham?', 'PREVENT (AHA 2023) es la ecuación más reciente: incluye la función renal, no usa la raza y no sobreestima el riesgo. La adoptaron la guía de hipertensión 2025 y la de colesterol 2026 de AHA/ACC. Framingham se muestra al médico como referencia.'],
  ['¿Puedo usar la app sin médico?', 'Podés ver tus cálculos, pero la indicación de medicación siempre la hace un médico. Los agonistas de GLP-1 se venden bajo receta.'],
  ['¿Qué pasa si pierdo un estudio descargado?', 'Pedíselo a tu médico: el original queda en tu historia clínica y te lo puede volver a cargar.'],
];

export function vistaManual(rol) {
  const lista = rol === 'medico' ? [...MEDICO, ...PACIENTE.slice(1, 3)] : PACIENTE;
  return h('div.seccion',
    heroe('ayuda', 'Ayuda', `Cómo usar ${CONFIG.app} paso a paso`),
    tarjeta(rol === 'medico' ? 'Para profesionales' : 'Para pacientes', { icono: 'ayuda' }, h('div.manual', ...lista.map(([t, d], i) => plegable(`${i + 1}. ${t}`, h('p', d), i === 0)))),
    tarjeta('Preguntas frecuentes', { icono: 'info' }, h('div.manual', ...FAQ.map(([t, d]) => plegable(t, h('p', d))))),
    tarjeta('Documentos', { icono: 'texto' }, h('div.botones',
      h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Política de privacidad', POLITICA()) }, 'Política de privacidad'),
      h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Términos de uso', TERMINOS()) }, 'Términos de uso'))),
    h('p.ayuda.centro', `${CONFIG.app} ${CONFIG.version} · Emergencias: 107 (SAME) · 911`));
}

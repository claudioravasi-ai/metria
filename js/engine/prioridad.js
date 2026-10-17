/* ============================================================
   Prioridad endoscópica de cada paciente (para el médico)
   Ordena a quién hay que hacerle una VEDA o una VCC primero, con
   criterios publicados (no con el uso de GLP-1):
   - Síntomas de alarma → derivación urgente (NICE NG12 y BSG:
     sangrado rectal, anemia ferropénica, disfagia o vómitos
     persistentes: estudio dentro de las 2 semanas).
   - Lesión sospechosa o conducta inmediata en el informe.
   - Vigilancia según el último informe (ESGE 2020 colon, ESGE 2023
     Barrett, MAPS III 2025 estómago): vencida o próxima.
   - Rastreo de cáncer colorrectal 50-75 años sin colonoscopia
     registrada (Programa Nacional de Argentina y ESGE; USMSTF desde 45).
   ============================================================ */

import { ESTUDIOS, turnoActivo } from './endoscopia.js';

const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export const NIVELES = {
  1: { nombre: 'Prioridad 1 · Urgente', corto: 'Urgente', plazo: 'dentro de 2 semanas', tono: 'peligro', c1: '#be123c', c2: '#f43f5e' },
  2: { nombre: 'Prioridad 2 · Alta', corto: 'Alta', plazo: 'dentro de 6 semanas', tono: 'peligro', c1: '#ea580c', c2: '#f97316' },
  3: { nombre: 'Prioridad 3 · Programada', corto: 'Programada', plazo: 'dentro del año', tono: 'aviso', c1: '#ca8a04', c2: '#eab308' },
  0: { nombre: 'Sin prioridad endoscópica', corto: 'Sin prioridad', plazo: '', tono: 'neutro', c1: '#64748b', c2: '#94a3b8' },
};

const ALARMA = { sangrado: 'sangrado digestivo', anemia: 'anemia o falta de hierro', digestivo: 'dificultad para tragar o vómitos' };
const DIA = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const sumarMeses = (f, m) => { const d = new Date(`${f}T12:00:00`); d.setMonth(d.getMonth() + m); return iso(d); };

/**
 * fila: fila del índice ({ nac }) · turnos: { id: turno } del paciente · espera: entrada de la lista de espera
 * Devuelve { nivel, motivos[], riesgo (del último informe), proximo { fecha, que }, activo (turno vigente) }
 */
export function prioridadPaciente({ fila = {}, turnos = {}, espera = null, ahora = Date.now() }) {
  const lista = Object.values(turnos || {}).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const hoy = iso(ahora);
  const edad = fila.nac ? Math.floor((ahora - new Date(`${fila.nac}T12:00:00`)) / (365.25 * DIA)) : null;
  const activo = lista.find(turnoActivo) || null;
  const motivos = [];
  let nivel = 0;
  const subir = (n, m) => { if (!nivel || n < nivel) nivel = n; motivos.push({ n, m }); };

  // 1) Síntomas de alarma en un pedido que todavía no se estudió
  const pendientes = lista.filter((t) => t.estado !== 'realizado' && t.estado !== 'cancelado');
  for (const t of pendientes) {
    const al = ALARMA[t.datos?.motivo];
    if (al) subir(1, `Síntoma de alarma: ${al} (NICE/BSG: estudio dentro de las 2 semanas)`);
  }

  // 2) Último informe: lesión sospechosa y vigilancia
  const hechos = lista.filter((t) => t.informe?.resultado).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultimo = hechos[0];
  let riesgo = null, proximo = null;
  if (ultimo) {
    const res = ultimo.informe.resultado;
    riesgo = res.riesgo;
    for (const p of res.partes || []) {
      if (!Number.isFinite(p.meses)) continue;
      const fecha = p.fecha || sumarMeses(ultimo.fecha, p.meses);
      if (!proximo || fecha < proximo.fecha) proximo = { fecha, que: p.nombre };
      if (p.meses === 0) { subir(1, `${p.nombre}: conducta inmediata según el informe (${ultimo.fecha ? fechaCorta(ultimo.fecha) : ''})`); continue; }
      const dias = (new Date(`${fecha}T12:00:00`) - ahora) / DIA;
      const alto = ['alto', 'muy-alto'].includes(p.riesgo);
      if (dias < 0) subir(alto ? 2 : 3, `${p.nombre}: control VENCIDO desde el ${fechaCorta(fecha)} (riesgo ${alto ? 'alto' : 'bajo/intermedio'})`);
      else if (dias <= 90 && alto) subir(2, `${p.nombre}: control de riesgo alto el ${fechaCorta(fecha)}`);
      else if (dias <= 365) subir(3, `${p.nombre}: control el ${fechaCorta(fecha)}`);
    }
    if (res.provisorio) motivos.push({ n: 9, m: 'Falta cargar la anatomía patológica (resultado provisorio)' });
  }

  // 3) Rastreo de cáncer colorrectal
  const colonHecho = lista.some((t) => ['vcc', 'doble'].includes(t.tipo) && t.estado === 'realizado');
  if (edad !== null && edad >= 50 && edad <= 75 && !colonHecho && !(activo && ['vcc', 'doble'].includes(activo.tipo))) {
    subir(3, `Rastreo de cáncer colorrectal pendiente (${edad} años, sin colonoscopia registrada en Metria)`);
  }
  if (espera) motivos.push({ n: 9, m: `En lista de espera para ${ESTUDIOS[espera.tipo]?.corto || espera.tipo}` });
  if (activo) motivos.push({ n: 9, m: `Turno ${ESTUDIOS[activo.tipo].corto} el ${fechaCorta(activo.fecha)}` });

  return { nivel, motivos: motivos.sort((a, b) => a.n - b.n).map((x) => x.m), riesgo, proximo, activo, edad, hoy };
}

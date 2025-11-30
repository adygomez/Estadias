// backend/utils/detectarTipoRegistro.js
/**
 * Detecta y asigna automáticamente el tipo de registro basándose en los campos disponibles.
 * Esta función permite que el sistema se adapte a Excel antiguos que no tienen los nuevos campos.
 * 
 * @param {Object} doc - Documento de alumno (puede venir de Excel o de la base de datos)
 * @returns {Object} - Documento con tipo_registro asignado
 */
function detectarYAsignarTipoRegistro(doc) {
  // Si ya tiene tipo_registro, respetarlo
  if (doc.tipo_registro && (doc.tipo_registro === 'inscripcion' || doc.tipo_registro === 'reinscripcion')) {
    return doc;
  }

  // Lógica de detección automática:
  const semestre = doc.datos_alumno?.semestre || doc.semestre;
  const tieneSemestreReinscripcion = doc.semestre_reinscripcion !== undefined && doc.semestre_reinscripcion !== null;
  const tieneMatricula = doc.matricula && doc.matricula.trim() !== '';
  const tieneFolio = doc.folio && doc.folio.trim() !== '';

  // Si tiene semestre_reinscripcion (2-6) → es reinscripción
  if (tieneSemestreReinscripcion && doc.semestre_reinscripcion >= 2 && doc.semestre_reinscripcion <= 6) {
    doc.tipo_registro = 'reinscripcion';
    return doc;
  }

  // Si tiene matrícula Y semestre 2-6 → es reinscripción
  if (tieneMatricula && semestre >= 2 && semestre <= 6) {
    doc.tipo_registro = 'reinscripcion';
    if (!doc.semestre_reinscripcion) {
      doc.semestre_reinscripcion = semestre;
    }
    return doc;
  }

  // Si tiene folio → es inscripción (por defecto)
  if (tieneFolio) {
    doc.tipo_registro = 'inscripcion';
    return doc;
  }

  // Si tiene matrícula pero semestre 1 o sin semestre → es inscripción
  if (tieneMatricula && (!semestre || semestre === 1)) {
    doc.tipo_registro = 'inscripcion';
    return doc;
  }

  // Por defecto: inscripción (para registros antiguos sin campos específicos)
  doc.tipo_registro = 'inscripcion';
  return doc;
}

module.exports = detectarYAsignarTipoRegistro;


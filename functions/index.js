/**
 * Cloud Function: handleSessionUpdate
 * Escucha actualizaciones en la colección 'sesiones' para gestionar
 * el recálculo de horas y la auditoría.
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Inicialización del SDK (V12+)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.handleSessionUpdate = onDocumentUpdated("sesiones/{sesionId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const sesionId = event.params.sesionId;

  // Salir si no hay cambio de estado (evita ejecuciones innecesarias)
  if (before.estado === after.estado) return null;

  const userId = after.userId;
  const horas = after.horasCalculadas || 0;
  const userRef = db.collection("usuarios").doc(userId);
  const auditRef = db.collection("logs_auditoria").doc(); // ID automático

  const batch = db.batch();

  /**
   * REQUERIMIENTO 1: Recálculo de Horas Totales
   * Lógica robusta para cualquier transición de estado
   */
  let incrementValue = 0;

  // Caso A: Se aprueba un registro (suma al total)
  if (after.estado === "aprobado" && before.estado !== "aprobado") {
    incrementValue = horas;
  } 
  // Caso B: Un registro aprobado deja de estarlo (resta del total)
  // Esto cubre: aprobado -> pendiente (edición) y aprobado -> rechazado
  else if (before.estado === "aprobado" && after.estado !== "aprobado") {
    incrementValue = -horas;
  }

  if (incrementValue !== 0) {
    batch.update(userRef, {
      horasTotales: admin.firestore.FieldValue.increment(incrementValue)
    });
  }

  /**
   * REQUERIMIENTO 2: Sistema de Trazabilidad (Audit Log)
   */
  batch.set(auditRef, {
    sesionId: sesionId,
    accion: `Cambio de estado: ${before.estado.toUpperCase()} -> ${after.estado.toUpperCase()}`,
    estadoAnterior: before.estado,
    estadoNuevo: after.estado,
    modificadoPor: after.updatedBy || "sistema_auto",
    fecha: admin.firestore.FieldValue.serverTimestamp()
  });

  try {
    await batch.commit();
    console.log(`[Audit] Sesión ${sesionId} procesada exitosamente por ${after.updatedBy}`);
  } catch (error) {
    console.error(`[Error] Fallo en la actualización de la sesión ${sesionId}:`, error);
  }
});

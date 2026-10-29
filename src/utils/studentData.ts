type Data = Record<string, any>;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const uniqueIds = (values: unknown[]): string[] => [...new Set(values.map(text).filter(Boolean))];

export function normalizeAttendanceRecord(record: Data): Data {
  const rawStatus = text(record.estado || record.validationStatus || record.validation_status).toLowerCase();
  const status = rawStatus || (record.status === 'A' ? 'aprobado' : 'pendiente');
  const validationStatus = ['aprobada', 'validado', 'validada'].includes(status) ? 'aprobado' : status;
  const hours = Number(record.horasCalculadas ?? record.hours ?? record.horas ?? record.horas_calculadas ?? record.duration ?? 0);
  return { ...record, hours: Number.isFinite(hours) ? hours : 0, validationStatus, estado: validationStatus };
}

export function getStudentApprovedHours(student: Data | null | undefined): number {
  if (!student) return 0;
  const recordsHours = (student.records || []).reduce((sum: number, record: Data) => {
    const normalized = normalizeAttendanceRecord(record);
    return sum + (normalized.validationStatus === 'aprobado' ? normalized.hours : 0);
  }, 0);
  const storedHours = ['horasTotales', 'accumulatedHours', 'totalHours', 'horasAcumuladas',
    'horasAprobadas', 'approvedHours', 'completedHours', 'horas', 'hours']
    .map(key => Number(student[key] || 0)).filter(Number.isFinite);
  return Math.max(0, recordsHours, ...storedHours);
}

export function isStudentFinished(student: Data | null | undefined): boolean {
  if (!student) return false;
  const finished = ['finalizado', 'concluido', 'terminado'];
  return Boolean(student.isArchived) || finished.includes(text(student.status).toLowerCase()) ||
    finished.includes(text(student.workStatus).toLowerCase()) || getStudentApprovedHours(student) >= 480;
}

function updatedAt(data: Data): number {
  const value = data.updatedAt || data.createdAt;
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return Date.parse(value) || 0;
}

/** Replace the directory from one snapshot, without adding cached or sample profiles. */
export function normalizeStudentProfiles(documents: { id: string; data: Data }[]): Data[] {
  const profiles: Data[] = [];
  // A migrated profile's latest document owns its assignments and skills. Older IDs
  // remain aliases only, so historical sessions can still be attached to it.
  const ordered = [...documents].sort((a, b) => updatedAt(a.data) - updatedAt(b.data) ||
    Number(a.id === a.data.uid) - Number(b.id === b.data.uid));
  for (const { id, data } of ordered) {
    const email = text(data.email).toLowerCase();
    let identityIds = uniqueIds([id, data.id, data.uid, ...(data.identityIds || [])]);
    for (let i = profiles.length - 1; i >= 0; i--) {
      const previous = profiles[i];
      if ((email && email === text(previous.email).toLowerCase()) ||
          previous.identityIds.some((alias: string) => identityIds.includes(alias))) {
        identityIds = uniqueIds([...identityIds, ...previous.identityIds]);
        profiles.splice(i, 1);
      }
    }
    profiles.push({
      ...data,
      id, // The Firestore document ID, never an obsolete stored `id` field.
      uid: id,
      identityIds,
      role: data.role || 'user',
      name: [data.firstName, data.lastNamePaterno, data.lastNameMaterno].filter(Boolean).join(' ').trim() || data.name || 'Sin nombre',
      projectIds: Array.isArray(data.projectIds) ? data.projectIds : [],
      records: Array.isArray(data.records) ? data.records : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
      skillRatings: Array.isArray(data.skillRatings) ? data.skillRatings : [],
      status: data.status || 'En Curso',
      workStatus: data.workStatus || (data.projectIds?.length ? 'Asignado' : 'Sin asignar'),
    });
  }
  return profiles;
}

export function sessionBelongsToStudent(session: Data, student: Data): boolean {
  const ids = uniqueIds([student.id, student.uid, student.studentId, ...(student.identityIds || [])]);
  return [session.userId, session.studentId, session.matricula].some(id => id != null && ids.includes(String(id).trim()));
}

/** Keep embedded legacy records, but the live session wins on every status change. */
export function mergeStudentRecords(student: Data, sessions: Data[], removedSessionIds: string[] = []): Data[] {
  const records = new Map<string | symbol, Data>();
  const matching = sessions.filter(session => sessionBelongsToStudent(session, student));
  const embedded = (student.records || []).filter((record: Data) => !removedSessionIds.includes(record.id));
  for (const record of [...embedded, ...matching]) {
    records.set(record.id || Symbol(), normalizeAttendanceRecord(record));
  }
  return Array.from(records.values());
}

/** Selecting every category must also include students who have no records yet. */
export function matchesStudentCategories(student: Data, selected: string[], categories: Data[]): boolean {
  return categories.every(category => selected.includes(category.id)) ||
    (student.records || []).some((record: Data) => selected.includes(record.categoryId));
}

export function reconcileCategorySelection(selected: string[], previous: string[], current: string[]): string[] {
  const allSelected = previous.length === selected.length && previous.every(id => selected.includes(id));
  return allSelected ? current : selected.filter(id => current.includes(id));
}

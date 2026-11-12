export interface SessionContext {
  projectName: string;
  categoryName: string;
  sprintName?: string;
  stageName?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  participants: { name: string; hours: number }[];
  tasksDiscussed: {
    title: string;
    status: string;
    priority?: string;
    isMilestone?: boolean;
    assignees?: string[];
  }[];
  meetingNotes?: string;
  transcription?: string; // Transcripción en vivo o por audio de la sesión presencial
  hasAudioRecording?: boolean;
}

export interface DetailedMinuteResult {
  summary: string;
  topicsDiscussed: string[];
  agreements: string[];
  nextSteps: string[];
  fullMinuteText: string;
}

/**
 * Genera la síntesis oficial ejecutiva de la sesión (~100 palabras) para el expediente institucional.
 * La llamada a Gemini se realiza de forma segura en el servidor backend (/api/gemini/summary).
 */
export async function generateSessionSummary(context: SessionContext): Promise<string> {
  try {
    const response = await fetch('/api/gemini/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(context),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.summary && typeof data.summary === 'string' && data.summary.trim().length > 30) {
        return data.summary.trim();
      }
    } else {
      console.warn('Aviso: El servidor respondió con estado no exitoso para el resumen IA:', response.status);
    }

    return generateFallbackSummary(context);
  } catch (error) {
    console.warn('Aviso: No fue posible contactar al servicio de IA del servidor, usando síntesis institucional:', error);
    return generateFallbackSummary(context);
  }
}

/**
 * Genera una minuta completa, estructurada y detallada de la reunión a partir de la transcripción presencial,
 * tareas Kanban, bitácora y compromisos de los alumnos.
 * Procesada en el servidor backend (/api/gemini/minute).
 */
export async function generateDetailedSessionMinute(context: SessionContext): Promise<DetailedMinuteResult> {
  try {
    const response = await fetch('/api/gemini/minute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(context),
    });

    if (response.ok) {
      const data: DetailedMinuteResult = await response.json();
      if (data && data.fullMinuteText && data.fullMinuteText.length > 50) {
        return {
          summary: data.summary || generateFallbackSummary(context),
          topicsDiscussed: Array.isArray(data.topicsDiscussed) && data.topicsDiscussed.length > 0
            ? data.topicsDiscussed
            : [`Revisión de actividades y acuerdos del proyecto ${context.projectName}.`],
          agreements: Array.isArray(data.agreements) && data.agreements.length > 0
            ? data.agreements
            : [`Continuar con las tareas asignadas en el tablero Kanban.`],
          nextSteps: Array.isArray(data.nextSteps) && data.nextSteps.length > 0
            ? data.nextSteps
            : [`Entrega de avances en la plataforma conforme al cronograma.`],
          fullMinuteText: data.fullMinuteText,
        };
      }
    } else {
      console.warn('Aviso: El servidor respondió con estado no exitoso para la minuta IA:', response.status);
    }

    return generateFallbackDetailedMinute(context);
  } catch (error) {
    console.warn('Aviso: Fallo al comunicarse con el servidor para la minuta IA, usando plantilla:', error);
    return generateFallbackDetailedMinute(context);
  }
}

export function generateFallbackDetailedMinute(context: SessionContext): DetailedMinuteResult {
  const milestoneTasks = (context.tasksDiscussed || []).filter(t => t.isMilestone);
  const completedTasks = (context.tasksDiscussed || []).filter(t => t.status === 'done');
  const inProgressTasks = (context.tasksDiscussed || []).filter(t => t.status === 'working_on_it' || t.status === 'todo');
  const studentNames = (context.participants || []).map(p => p.name).join(', ') || 'Prestadores de servicio social';

  const topics: string[] = [
    `Seguimiento y revisión técnica de las actividades del proyecto ${context.projectName} en modalidad presencial.`,
    completedTasks.length > 0
      ? `Revisión y validación de entregables concluidos: ${completedTasks.map(t => t.title).join('; ')}.`
      : `Análisis del estatus del tablero Kanban y asignación de actividades del sprint.`,
    milestoneTasks.length > 0
      ? `Evaluación de cumplimiento de hitos críticos: ${milestoneTasks.map(t => t.title).join('; ')}.`
      : `Revisión de criterios de calidad y especificaciones para la etapa de ${context.stageName || 'Desarrollo'}.`
  ];

  if (context.transcription && context.transcription.trim().length > 15) {
    const rawSnippet = context.transcription.trim();
    const preview = rawSnippet.length > 180 ? rawSnippet.substring(0, 180) + '...' : rawSnippet;
    topics.push(`Temas abordados durante la conversación presencial registrada: "${preview}"`);
  }

  if (context.meetingNotes && context.meetingNotes.trim()) {
    topics.push(`Anotaciones de bitácora: ${context.meetingNotes.trim()}`);
  }

  const agreements: string[] = [
    `Los alumnos (${studentNames}) se comprometen a avanzar con sus tareas asignadas para el cumplimiento de las metas del sprint.`,
    inProgressTasks.length > 0
      ? `Priorizar las tareas activas: ${inProgressTasks.slice(0, 3).map(t => t.title).join(', ')}.`
      : `Asegurar el cumplimiento de entregables técnicos acordados en la sesión.`,
    `Mantener comunicación continua con la coordinación y registrar oportunamente la evidencia de trabajo.`
  ];

  const nextSteps: string[] = [
    `Subir los archivos de evidencia y entregables correspondientes al repositorio del proyecto.`,
    `Verificación de cumplimiento de los hitos calendarizados para la próxima revisión presencial.`,
    `Convocatoria a la siguiente sesión de seguimiento conforme al calendario escolar.`
  ];

  const fullMinuteText = `
MINUTA OFICIAL DE SESIÓN PRESENCIAL DE SERVICIO SOCIAL

1. INFORMACIÓN GENERAL
- Proyecto: ${context.projectName}
- Modalidad: ${context.categoryName}
- Fecha y Horario: ${context.date} (${context.startTime} a ${context.endTime} hrs, ${context.totalHours} hrs)
- Asistentes (${(context.participants || []).length}): ${studentNames}

2. SÍNTESIS EJECUTIVA
${generateFallbackSummary(context)}

3. TEMAS TRATADOS Y PUNTOS CLAVE DE LA SESIÓN PRESENCIAL
${topics.map(t => `• ${t}`).join('\n')}

4. ACUERDOS Y COMPROMISOS ADQUIRIDOS
${agreements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

5. PRÓXIMOS PASOS Y ENTREGABLES
${nextSteps.map(s => `• ${s}`).join('\n')}
${context.transcription ? `\n6. REGISTRO DE TRANSCRIPCIÓN DE AUDIO PRESENCIAL\n${context.transcription.trim()}` : ''}
`.trim();

  return {
    summary: generateFallbackSummary(context),
    topicsDiscussed: topics,
    agreements: agreements,
    nextSteps: nextSteps,
    fullMinuteText: fullMinuteText
  };
}

export function generateFallbackSummary(context: SessionContext): string {
  const milestoneCount = (context.tasksDiscussed || []).filter(t => t.isMilestone).length;
  const completedCount = (context.tasksDiscussed || []).filter(t => t.status === 'done').length;
  const studentCount = (context.participants || []).length;

  const transcriptionMention = (context.transcription && context.transcription.trim().length > 15)
    ? ' Con base en la transcripción del audio de la sesión presencial, se clarificaron dudas técnicas y se concertaron compromisos directos con los prestadores.'
    : '';

  return `Se llevó a cabo la sesión de trabajo en modalidad ${context.categoryName} correspondiente al proyecto ${context.projectName}, contando con la participación activa de ${studentCount} prestadores de servicio social durante una jornada de ${context.totalHours} horas. Durante la reunión se dio seguimiento a las actividades programadas en el tablero Kanban para el ${context.sprintName || 'sprint vigente'}, revisando avances clave y resolviendo dudas técnicas. Se registraron ${completedCount} tareas concluidas y se evaluó el cumplimiento de ${milestoneCount > 0 ? `${milestoneCount} hitos prioritarios` : 'los entregables de etapa'}.${transcriptionMention} Finalmente, se establecieron compromisos y acuerdos puntuales para asegurar el avance continuo de los objetivos del proyecto.`.trim();
}

export interface StudentClockOutContext {
  studentName: string;
  projectName: string;
  categoryName: string;
  stageName?: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  assignedTasks: {
    title: string;
    status: string;
    description?: string;
  }[];
  sessionTasks?: {
    title: string;
    status: string;
  }[];
  meetingNotes?: string;
  transcription?: string;
}

export function enforceUnder50WordsClient(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 50) return cleaned;
  const sliced = words.slice(0, 46).join(' ').replace(/[,;:]$/, '');
  return sliced.endsWith('.') ? sliced : `${sliced}.`;
}

export function generateFallbackStudentClockOutReport(ctx: StudentClockOutContext): string {
  const taskTitles = (ctx.assignedTasks.length > 0 ? ctx.assignedTasks : (ctx.sessionTasks || []))
    .slice(0, 2)
    .map(t => t.title)
    .join(' y ');
  const taskPart = taskTitles
    ? `trabajó en "${taskTitles}"`
    : `participó en la etapa de ${ctx.stageName || 'Desarrollo'}`;
  const notesSnippet = ctx.meetingNotes?.trim()
    ? ` y se revisó: ${ctx.meetingNotes.trim().split(/\s+/).slice(0, 8).join(' ')}`
    : ctx.transcription?.trim()
      ? ` abordando acuerdos de la sesión: ${ctx.transcription.trim().split(/\s+/).slice(0, 7).join(' ')}`
      : ', dando seguimiento a los entregables y acuerdos vistos en la sesión';
  const raw = `En sesión de ${ctx.projectName} (${ctx.startTime}-${ctx.endTime}, ${ctx.hours}h), ${ctx.studentName} ${taskPart}${notesSnippet}.`;
  return enforceUnder50WordsClient(raw);
}

/**
 * Genera el reporte individual de menos de 50 palabras al hacer Clock Out manual por alumno.
 */
export async function generateStudentClockOutReport(ctx: StudentClockOutContext): Promise<string> {
  try {
    const response = await fetch('/api/gemini/student-clockout-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ctx),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.report && typeof data.report === 'string' && data.report.trim().length > 10) {
        return enforceUnder50WordsClient(data.report.trim());
      }
    }
    return generateFallbackStudentClockOutReport(ctx);
  } catch (err) {
    console.warn('Aviso al generar reporte individual <50 palabras, usando plantilla concisa:', err);
    return generateFallbackStudentClockOutReport(ctx);
  }
}


import { GoogleGenAI } from '@google/genai';

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

let isPrepaymentDepleted = false;

/**
 * Genera la síntesis oficial ejecutiva de la sesión (~100 palabras) para el expediente institucional.
 * Si se incluye transcripción de la sesión presencial, se sintetizan los puntos clave hablados.
 */
export async function generateSessionSummary(context: SessionContext): Promise<string> {
  if (isPrepaymentDepleted) {
    return generateFallbackSummary(context);
  }

  const milestoneTasks = context.tasksDiscussed.filter(t => t.isMilestone);
  const completedTasks = context.tasksDiscussed.filter(t => t.status === 'done');
  const inProgressTasks = context.tasksDiscussed.filter(t => t.status === 'working_on_it' || t.status === 'todo');
  const stuckTasks = context.tasksDiscussed.filter(t => t.status === 'stuck');

  const hasTranscription = Boolean(context.transcription && context.transcription.trim().length > 15);
  const transcriptionSnippet = hasTranscription
    ? `\n- Transcripción de Audio de la Sesión Presencial (Puntos Clave Discutidos):\n"""\n${context.transcription!.trim().slice(0, 3000)}\n"""`
    : '';

  const prompt = `
Genera una síntesis ejecutiva e institucional de exactamente ~100 palabras (entre 90 y 110 palabras) para el reporte oficial de servicio social de la sesión de trabajo realizada.

Datos de la Sesión:
- Proyecto: ${context.projectName}
- Categoría / Modalidad: ${context.categoryName}${hasTranscription ? ' (Sesión Presencial con Audio Grabado y Transcripción)' : ''}
- Sprint / Etapa: ${context.sprintName || 'General'} · ${context.stageName || 'Seguimiento'}
- Fecha y Horario: ${context.date} (${context.startTime} a ${context.endTime}, ${context.totalHours} hrs)
- Alumnos participantes (${context.participants.length}): ${context.participants.map(p => `${p.name} (${p.hours}h)`).join(', ')}
- Tareas e Hitos abordados:
  * Hitos clave: ${milestoneTasks.length > 0 ? milestoneTasks.map(t => t.title).join(', ') : 'Ninguno marcado'}
  * Tareas completadas: ${completedTasks.length > 0 ? completedTasks.map(t => t.title).join(', ') : 'En desarrollo'}
  * Tareas en progreso: ${inProgressTasks.length > 0 ? inProgressTasks.map(t => t.title).join(', ') : 'Ninguna'}
  * Bloqueos / Atascadas: ${stuckTasks.length > 0 ? stuckTasks.map(t => t.title).join(', ') : 'Ninguno'}
- Notas y acuerdos de bitácora: ${context.meetingNotes || 'Revisión y avance de entregables conforme al cronograma.'}${transcriptionSnippet}

Reglas estrictas de redacción:
1. Longitud obligatoria: Aproximadamente 100 palabras (entre 90 y 110 palabras).
2. Tono: Formal, técnico, objetivo y en tercera persona ("Se llevó a cabo...", "Se revisaron...", "Los prestadores acordaron...").
3. Contenido: Mencionar explícitamente el proyecto, la categoría de la sesión, las actividades e hitos revisados, los avances en el tablero Kanban y los acuerdos establecidos para el sprint.${hasTranscription ? ' Integra las decisiones y acuerdos discutidos en la transcripción de la sesión presencial.' : ''}
4. Salida: Únicamente el párrafo de texto plano del resumen, sin títulos, sin asteriscos de markdown, sin viñetas y sin introducciones.
`;

  try {
    const apiKey = process.env.GEMINI_API_KEY || (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__);
    if (!apiKey) {
      console.warn("GEMINI_API_KEY no encontrada, usando generador determinista institucional.");
      return generateFallbackSummary(context);
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "Eres un redactor académico e institucional encargado de elaborar bitácoras oficiales de servicio social universitario. Generas resúmenes concisos, estructurados y de exactamente alrededor de 100 palabras.",
        temperature: 0.3,
      }
    });

    const text = response.text?.trim();
    if (text && text.length > 50) {
      return text;
    }
    return generateFallbackSummary(context);
  } catch (error: any) {
    const errorStr = (error?.message || error?.toString?.() || '');
    if (
      errorStr.includes('402') ||
      errorStr.includes('prepayment') ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('credits')
    ) {
      isPrepaymentDepleted = true;
    }
    console.warn("Aviso: No fue posible contactar a Gemini API, usando síntesis institucional determinista:", errorStr);
    return generateFallbackSummary(context);
  }
}

/**
 * Genera una minuta completa, estructurada y detallada de la reunión a partir de la transcripción presencial,
 * tareas Kanban, bitácora y compromisos de los alumnos.
 */
export async function generateDetailedSessionMinute(context: SessionContext): Promise<DetailedMinuteResult> {
  const milestoneTasks = context.tasksDiscussed.filter(t => t.isMilestone);
  const completedTasks = context.tasksDiscussed.filter(t => t.status === 'done');
  const inProgressTasks = context.tasksDiscussed.filter(t => t.status === 'working_on_it' || t.status === 'todo');

  const hasTranscription = Boolean(context.transcription && context.transcription.trim().length > 10);

  if (isPrepaymentDepleted) {
    return generateFallbackDetailedMinute(context);
  }

  const prompt = `
Eres el secretario técnico y relator de proyectos universitarios. A partir de los datos de la sesión y de la transcripción del audio presencial, redacta una MINUTA DE SESIÓN PRESENCIAL COMPLETA, PROFESIONAL Y DETALLADA.

Información del Proyecto y la Sesión:
- Proyecto: ${context.projectName}
- Modalidad: ${context.categoryName} (Presencial con grabación de audio)
- Fecha: ${context.date} (${context.startTime} a ${context.endTime}, ${context.totalHours} hrs)
- Sprint / Etapa: ${context.sprintName || 'General'} · ${context.stageName || 'Seguimiento'}
- Prestadores asistentes (${context.participants.length}): ${context.participants.map(p => `${p.name} (${p.hours}h)`).join(', ')}
- Tareas revisadas en Kanban:
  * Hitos: ${milestoneTasks.map(t => t.title).join(', ') || 'Ninguno'}
  * Completadas: ${completedTasks.map(t => t.title).join(', ') || 'En proceso'}
  * En progreso: ${inProgressTasks.map(t => t.title).join(', ') || 'En seguimiento'}
- Notas de bitácora: ${context.meetingNotes || 'Sin notas manuales previas'}

${hasTranscription ? `TRANSCRIPCIÓN COMPLETA DEL AUDIO DE LA SESIÓN PRESENCIAL:\n"""\n${context.transcription!.trim()}\n"""` : 'Nota: No se cuenta con transcripción de audio, genera la minuta con base en las tareas y notas.'}

Estructura requerida de la respuesta (debe ser clara, profesional y con viñetas):
1. **SÍNTESIS EJECUTIVA**: Párrafo formal de ~80 palabras describiendo el propósito y desarrollo de la sesión.
2. **TEMAS TRATADOS Y DISCUSIÓN**: 3 a 5 puntos claros sobre los temas y debates abordados (extraídos de la transcripción y notas).
3. **ACUERDOS Y COMPROMISOS ADQUIRIDOS**: Lista numerada con los compromisos específicos asumidos por los alumnos y el equipo.
4. **PRÓXIMOS PASOS Y SEGUIMIENTO**: Entregables previstos para la siguiente jornada o entrega del sprint.
`;

  try {
    const apiKey = process.env.GEMINI_API_KEY || (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__);
    if (!apiKey) {
      return generateFallbackDetailedMinute(context);
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "Eres un redactor académico de actas y minutas oficiales. Generas minutas estructuradas, precisas, fidedignas a la transcripción y con excelente redacción profesional.",
        temperature: 0.25,
      }
    });

    const fullMinuteText = response.text?.trim();
    if (fullMinuteText && fullMinuteText.length > 80) {
      return parseMinuteToStructure(fullMinuteText, context);
    }
    return generateFallbackDetailedMinute(context);
  } catch (err: any) {
    const errorStr = (err?.message || err?.toString?.() || '');
    if (
      errorStr.includes('402') ||
      errorStr.includes('prepayment') ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('credits')
    ) {
      isPrepaymentDepleted = true;
    }
    console.warn("Fallo al generar minuta detallada con Gemini, usando plantilla estructurada:", errorStr);
    return generateFallbackDetailedMinute(context);
  }
}

function parseMinuteToStructure(text: string, context: SessionContext): DetailedMinuteResult {
  // Extraer líneas y estructurar si es posible
  const lines = text.split('\n');
  const topics: string[] = [];
  const agreements: string[] = [];
  const nextSteps: string[] = [];
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (upper.includes('TEMAS TRATADOS') || upper.includes('DISCUSIÓN')) {
      currentSection = 'topics';
      continue;
    } else if (upper.includes('ACUERDOS') || upper.includes('COMPROMISOS')) {
      currentSection = 'agreements';
      continue;
    } else if (upper.includes('PRÓXIMOS PASOS') || upper.includes('SEGUIMIENTO') || upper.includes('ENTREGABLES')) {
      currentSection = 'nextSteps';
      continue;
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
      const cleanLine = trimmed.replace(/^[-*•\d.]+\s*/, '').trim();
      if (cleanLine.length > 5) {
        if (currentSection === 'topics') topics.push(cleanLine);
        else if (currentSection === 'agreements') agreements.push(cleanLine);
        else if (currentSection === 'nextSteps') nextSteps.push(cleanLine);
      }
    }
  }

  return {
    summary: text.slice(0, 300),
    topicsDiscussed: topics.length > 0 ? topics : [
      `Revisión general de avances del proyecto ${context.projectName}.`,
      `Validación de entregables del ${context.sprintName || 'Sprint activo'}.`,
      context.meetingNotes ? `Discusión sobre notas de trabajo: ${context.meetingNotes}` : 'Evaluación de requerimientos técnicos de la etapa.'
    ],
    agreements: agreements.length > 0 ? agreements : [
      `Continuar con el desarrollo de las tareas asignadas en el tablero Kanban.`,
      `Reportar avances y bloqueos antes de la siguiente sesión presencial.`,
      `Completar las horas correspondientes conforme al plan de trabajo.`
    ],
    nextSteps: nextSteps.length > 0 ? nextSteps : [
      `Entrega de avances en la plataforma conforme al cronograma.`,
      `Siguiente sesión presencial de seguimiento.`
    ],
    fullMinuteText: text
  };
}

export function generateFallbackDetailedMinute(context: SessionContext): DetailedMinuteResult {
  const milestoneTasks = context.tasksDiscussed.filter(t => t.isMilestone);
  const completedTasks = context.tasksDiscussed.filter(t => t.status === 'done');
  const inProgressTasks = context.tasksDiscussed.filter(t => t.status === 'working_on_it' || t.status === 'todo');
  const studentNames = context.participants.map(p => p.name).join(', ') || 'Prestadores de servicio social';

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
- Asistentes (${context.participants.length}): ${studentNames}

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
  const milestoneCount = context.tasksDiscussed.filter(t => t.isMilestone).length;
  const completedCount = context.tasksDiscussed.filter(t => t.status === 'done').length;
  const studentCount = context.participants.length;

  const transcriptionMention = (context.transcription && context.transcription.trim().length > 15)
    ? ' Con base en la transcripción del audio de la sesión presencial, se clarificaron dudas técnicas y se concertaron compromisos directos con los prestadores.'
    : '';

  return `Se llevó a cabo la sesión de trabajo en modalidad ${context.categoryName} correspondiente al proyecto ${context.projectName}, contando con la participación activa de ${studentCount} prestadores de servicio social durante una jornada de ${context.totalHours} horas. Durante la reunión se dio seguimiento a las actividades programadas en el tablero Kanban para el ${context.sprintName || 'sprint vigente'}, revisando avances clave y resolviendo dudas técnicas. Se registraron ${completedCount} tareas concluidas y se evaluó el cumplimiento de ${milestoneCount > 0 ? `${milestoneCount} hitos prioritarios` : 'los entregables de etapa'}.${transcriptionMention} Finalmente, se establecieron compromisos y acuerdos puntuales para asegurar el avance continuo de los objetivos del proyecto.`.trim();
}

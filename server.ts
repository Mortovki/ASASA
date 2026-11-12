import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SessionContext {
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
  transcription?: string;
  hasAudioRecording?: boolean;
}

interface DetailedMinuteResult {
  summary: string;
  topicsDiscussed: string[];
  agreements: string[];
  nextSteps: string[];
  fullMinuteText: string;
}

function parseMinuteToStructure(text: string, context: SessionContext): DetailedMinuteResult {
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

function generateFallbackSummary(context: SessionContext): string {
  const milestoneCount = (context.tasksDiscussed || []).filter(t => t.isMilestone).length;
  const completedCount = (context.tasksDiscussed || []).filter(t => t.status === 'done').length;
  const studentCount = (context.participants || []).length;

  const transcriptionMention = (context.transcription && context.transcription.trim().length > 15)
    ? ' Con base en la transcripción del audio de la sesión presencial, se clarificaron dudas técnicas y se concertaron compromisos directos con los prestadores.'
    : '';

  return `Se llevó a cabo la sesión de trabajo en modalidad ${context.categoryName} correspondiente al proyecto ${context.projectName}, contando con la participación activa de ${studentCount} prestadores de servicio social durante una jornada de ${context.totalHours} horas. Durante la reunión se dio seguimiento a las actividades programadas en el tablero Kanban para el ${context.sprintName || 'sprint vigente'}, revisando avances clave y resolviendo dudas técnicas. Se registraron ${completedCount} tareas concluidas y se evaluó el cumplimiento de ${milestoneCount > 0 ? `${milestoneCount} hitos prioritarios` : 'los entregables de etapa'}.${transcriptionMention} Finalmente, se establecieron compromisos y acuerdos puntuales para asegurar el avance continuo de los objetivos del proyecto.`.trim();
}

function generateFallbackDetailedMinute(context: SessionContext): DetailedMinuteResult {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Initialize server-side Gemini client with official User-Agent header
  const apiKey = process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(apiKey),
      env: isProduction ? 'production' : 'development'
    });
  });

  // POST /api/gemini/summary: Genera la síntesis ejecutiva institucional de ~100 palabras
  app.post('/api/gemini/summary', async (req: Request, res: Response) => {
    try {
      const context: SessionContext = req.body;
      if (!context || !context.projectName) {
        res.status(400).json({ error: 'Contexto de sesión inválido' });
        return;
      }

      if (!apiKey) {
        res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
        return;
      }

      const milestoneTasks = (context.tasksDiscussed || []).filter(t => t.isMilestone);
      const completedTasks = (context.tasksDiscussed || []).filter(t => t.status === 'done');
      const inProgressTasks = (context.tasksDiscussed || []).filter(t => t.status === 'working_on_it' || t.status === 'todo');
      const stuckTasks = (context.tasksDiscussed || []).filter(t => t.status === 'stuck');

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
- Alumnos participantes (${(context.participants || []).length}): ${(context.participants || []).map(p => `${p.name} (${p.hours}h)`).join(', ')}
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
        res.json({ summary: text });
      } else {
        res.json({ summary: generateFallbackSummary(context), isFallback: true });
      }
    } catch (error: any) {
      console.warn('Fallo en Gemini API para resumen de sesión, usando generador institucional:', error?.message || error);
      res.json({ summary: generateFallbackSummary(req.body), isFallback: true });
    }
  });

  // POST /api/gemini/minute: Genera la minuta detallada con temas tratados, acuerdos y compromisos
  app.post('/api/gemini/minute', async (req: Request, res: Response) => {
    try {
      const context: SessionContext = req.body;
      if (!context || !context.projectName) {
        res.status(400).json({ error: 'Contexto de sesión inválido' });
        return;
      }

      if (!apiKey) {
        res.json({ ...generateFallbackDetailedMinute(context), isFallback: true });
        return;
      }

      const milestoneTasks = (context.tasksDiscussed || []).filter(t => t.isMilestone);
      const completedTasks = (context.tasksDiscussed || []).filter(t => t.status === 'done');
      const inProgressTasks = (context.tasksDiscussed || []).filter(t => t.status === 'working_on_it' || t.status === 'todo');
      const hasTranscription = Boolean(context.transcription && context.transcription.trim().length > 10);

      const prompt = `
Eres el secretario técnico y relator de proyectos universitarios. A partir de los datos de la sesión y de la transcripción del audio presencial, redacta una MINUTA DE SESIÓN PRESENCIAL COMPLETA, PROFESIONAL Y DETALLADA.

Información del Proyecto y la Sesión:
- Proyecto: ${context.projectName}
- Modalidad: ${context.categoryName} (Presencial con grabación de audio)
- Fecha: ${context.date} (${context.startTime} a ${context.endTime}, ${context.totalHours} hrs)
- Sprint / Etapa: ${context.sprintName || 'General'} · ${context.stageName || 'Seguimiento'}
- Prestadores asistentes (${(context.participants || []).length}): ${(context.participants || []).map(p => `${p.name} (${p.hours}h)`).join(', ')}
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
        const structured = parseMinuteToStructure(fullMinuteText, context);
        res.json(structured);
      } else {
        res.json({ ...generateFallbackDetailedMinute(context), isFallback: true });
      }
    } catch (error: any) {
      console.warn('Fallo en Gemini API para minuta de sesión, usando plantilla institucional:', error?.message || error);
      res.json({ ...generateFallbackDetailedMinute(req.body), isFallback: true });
    }
  });

  // POST /api/gemini/task-suggestions: Generación estructurada de tareas y entregables por proyecto
  app.post('/api/gemini/task-suggestions', async (req: Request, res: Response) => {
    const { projectName = '', objective = '', stage = 'General' } = req.body || {};
    if (!objective || !projectName) {
      res.status(400).json({ error: 'projectName y objective son requeridos' });
      return;
    }

    try {
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY no configurada');
      }

      const prompt = `Eres un coordinador experto en proyectos comunitarios, arquitectura, urbanismo y servicio social de la UNAM.
Genera un listado de entre 4 y 7 tareas claras, operativas y bien estructuradas para el siguiente proyecto:
Proyecto: "${projectName}"
Objetivo / Etapa: "${objective}"
Fase: "${stage || 'General'}"

Para cada tarea proporciona:
- title: Nombre conciso y accionable de la tarea (máx 10 palabras)
- description: Breve descripción de qué debe entregar o realizar el prestador
- priority: 'baja', 'media' o 'alta'
- groupName: 'Pendientes' o fase sugerida
- daysEstimate: Días estimados de duración (ej. 3, 5, 7)`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'Lista de tareas sugeridas',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['baja', 'media', 'alta'] },
                groupName: { type: Type.STRING },
                daysEstimate: { type: Type.NUMBER }
              },
              required: ['title', 'description', 'priority', 'groupName', 'daysEstimate']
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '[]');
      res.json({ tasks: parsed });
    } catch (error: any) {
      console.warn('Fallo en Gemini API para tareas sugeridas, usando generador institucional:', error?.message || error);
      const fallbackTasks = [
        {
          title: `Levantamiento y diagnóstico técnico: ${projectName}`,
          description: `Recopilar requerimientos, antecedentes y levantamiento de campo para el objetivo "${objective}".`,
          priority: 'alta',
          groupName: stage || 'Diagnóstico',
          daysEstimate: 4
        },
        {
          title: `Definición de criterios y alcances de la fase`,
          description: `Estructurar la metodología de trabajo y especificaciones para la etapa de ${stage || 'General'}.`,
          priority: 'alta',
          groupName: stage || 'Planeación',
          daysEstimate: 5
        },
        {
          title: `Elaboración de entregables preliminares`,
          description: `Desarrollar el material documental, gráfico o de diseño correspondiente al objetivo establecido.`,
          priority: 'media',
          groupName: stage || 'Desarrollo',
          daysEstimate: 7
        },
        {
          title: `Revisión y retroalimentación con coordinación`,
          description: `Presentar los avances a la coordinación de servicio social para validar cumplimiento técnico.`,
          priority: 'media',
          groupName: stage || 'Revisión',
          daysEstimate: 3
        },
        {
          title: `Integración de evidencias y expediente de avance`,
          description: `Subir bitácoras, evidencias fotográficas y formatos oficiales a la plataforma.`,
          priority: 'baja',
          groupName: stage || 'Cierre',
          daysEstimate: 4
        }
      ];
      res.json({ tasks: fallbackTasks, isFallback: true });
    }
  });

  // POST /api/gemini/student-clockout-report: Genera reporte individual de Clock Out de menos de 50 palabras
  app.post('/api/gemini/student-clockout-report', async (req: Request, res: Response) => {
    const body = req.body || {};
    const {
      studentName = 'Alumno',
      projectName = 'Proyecto',
      categoryName = 'Sesión de Trabajo',
      stageName = 'Desarrollo',
      startTime = '09:00',
      endTime = '13:00',
      hours = 4,
      assignedTasks = [],
      sessionTasks = [],
      meetingNotes = '',
      transcription = ''
    } = body;

    const enforceUnder50Words = (text: string): string => {
      const cleaned = text.replace(/\s+/g, ' ').trim();
      const words = cleaned.split(' ').filter(Boolean);
      if (words.length < 50) return cleaned;
      const sliced = words.slice(0, 46).join(' ').replace(/[,;:]$/, '');
      return sliced.endsWith('.') ? sliced : `${sliced}.`;
    };

    const buildFallbackStudentReport = (): string => {
      const taskTitles = (assignedTasks.length > 0 ? assignedTasks : sessionTasks)
        .slice(0, 2)
        .map((t: any) => t.title)
        .join(' y ');
      const taskPart = taskTitles
        ? `avanzó en ${taskTitles}`
        : `colaboró en la etapa de ${stageName}`;
      const notesSnippet = meetingNotes
        ? ` abordando ${meetingNotes.trim().split(/\s+/).slice(0, 8).join(' ')}`
        : '';
      const raw = `En la sesión de ${projectName} (${startTime}-${endTime}, ${hours}h), ${studentName} ${taskPart}${notesSnippet}, revisando acuerdos técnicos y seguimiento de entregables del proyecto.`;
      return enforceUnder50Words(raw);
    };

    try {
      if (!apiKey) {
        res.json({ report: buildFallbackStudentReport(), isFallback: true });
        return;
      }

      const assignedList = Array.isArray(assignedTasks) && assignedTasks.length > 0
        ? assignedTasks.map((t: any) => `${t.title} (${t.status || 'en curso'})`).join(', ')
        : 'Apoyo general en actividades de la etapa';
      const generalTasksList = Array.isArray(sessionTasks) && sessionTasks.length > 0
        ? sessionTasks.slice(0, 4).map((t: any) => t.title).join(', ')
        : 'Seguimiento del proyecto';

      const prompt = `Redacta un reporte individual de salida (Clock Out) de ESTRICTAMENTE MENOS DE 50 PALABRAS (máximo 42 palabras) para el alumno ${studentName}.
Datos:
- Proyecto: ${projectName} (${categoryName}, etapa ${stageName})
- Horario registrado: ${startTime} a ${endTime} (${hours} hrs)
- Actividades asignadas al alumno: ${assignedList}
- Actividades/temas vistos en la sesión: ${meetingNotes || transcription || generalTasksList}

Reglas obligatorias:
1. ESTRICTAMENTE MENOS DE 50 PALABRAS (entre 25 y 42 palabras).
2. Incluye las actividades asignadas al alumno y lo visto en la sesión.
3. Un solo párrafo en texto plano, sin viñetas ni formato markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Eres un coordinador académico que redacta reportes individuales de asistencia en menos de 45 palabras, integrando las tareas asignadas al alumno y lo revisado en la sesión.',
        }
      });

      const text = response.text?.trim();
      if (text && text.length > 15) {
        res.json({ report: enforceUnder50Words(text) });
      } else {
        res.json({ report: buildFallbackStudentReport(), isFallback: true });
      }
    } catch (error: any) {
      console.warn('Aviso al generar reporte de clock out individual:', error?.message || error);
      res.json({ report: buildFallbackStudentReport(), isFallback: true });
    }
  });

  // POST /api/gemini/stream: Endpoint SSE para generación en streaming
  app.post('/api/gemini/stream', async (req: Request, res: Response) => {
    try {
      const { prompt, systemInstruction, model = 'gemini-3.8-flash' } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'Prompt es requerido' });
        return;
      }

      if (!apiKey) {
        res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      console.error('Error in /api/gemini/stream:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Error en streaming de Gemini' });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || 'Error en streaming' })}\n\n`);
        res.end();
      }
    }
  });

  // Integración de Vite o Archivos Estáticos
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor full-stack iniciado en http://0.0.0.0:${PORT} (${isProduction ? 'producción' : 'desarrollo'})`);
  });
}

startServer().catch((err) => {
  console.error('Error al inicializar el servidor:', err);
  process.exit(1);
});

import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Stage } from '../types/stage';
import { Task } from '../types/task';

/**
 * Generates a comprehensive, multi-phase project designed specifically to visualize
 * the interrelationships and dependencies of all project phases (CPM and Gantt).
 */
export function generateCompleteSampleProject(customId?: string) {
  const projectId = customId || `p-complejo-interdependiente-${Date.now()}`;
  
  // Base date set to current Monday (or today) for realistic timeline visualization
  const baseDate = new Date();
  baseDate.setHours(9, 0, 0, 0);

  const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Phase Definitions with explicit IDs, colors, detailed descriptions, and sequential dependencies
  const stage1Id = `stg-1-${projectId}`;
  const stage2Id = `stg-2-${projectId}`;
  const stage3Id = `stg-3-${projectId}`;
  const stage4Id = `stg-4-${projectId}`;
  const stage5Id = `stg-5-${projectId}`;
  const stage6Id = `stg-6-${projectId}`;

  // Timeline spans (working days offset):
  // Fase 1: Days 0 to 12
  // Fase 2: Days 12 to 27
  // Fase 3: Days 27 to 40
  // Fase 4: Days 40 to 60
  // Fase 5: Days 60 to 79
  // Fase 6: Days 79 to 88

  const s1Start = addDays(baseDate, 0);
  const s1End = addDays(baseDate, 12);

  const s2Start = addDays(baseDate, 12);
  const s2End = addDays(baseDate, 27);

  const s3Start = addDays(baseDate, 27);
  const s3End = addDays(baseDate, 40);

  const s4Start = addDays(baseDate, 40);
  const s4End = addDays(baseDate, 60);

  const s5Start = addDays(baseDate, 60);
  const s5End = addDays(baseDate, 79);

  const s6Start = addDays(baseDate, 79);
  const s6End = addDays(baseDate, 88);

  const stages: Stage[] = [
    {
      id: stage1Id,
      projectId,
      name: 'Fase 1: Diagnóstico y Factibilidad',
      description: 'Levantamiento topográfico con dron LiDAR, mecánica de suelos, manifestación de impacto ambiental y consulta participativa comunitaria.',
      order: 0,
      startDate: formatDate(s1Start),
      endDate: formatDate(s1End),
      status: 'completed',
      leaderId: null,
      color: '#d97706', // Amber 600
      spTotal: 25,
      spDone: 25,
      sprintIds: [],
      predecessors: [], // Primer fase sin predecesores
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: stage2Id,
      projectId,
      name: 'Fase 2: Diseño Ejecutivo e Ingenierías',
      description: 'Desarrollo de anteproyecto bioclimático, memoria de cálculo estructural sismorresistente, ingenierías MEP y catálogo de conceptos presupuestal.',
      order: 1,
      startDate: formatDate(s2Start),
      endDate: formatDate(s2End),
      status: 'completed',
      leaderId: null,
      color: '#2563eb', // Blue 600
      spTotal: 34,
      spDone: 34,
      sprintIds: [],
      predecessors: [stage1Id], // Interdependencia: depende de Fase 1
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: stage3Id,
      projectId,
      name: 'Fase 3: Licencias, Permisos y Licitación',
      description: 'Gestión ante ventanilla única de Licencia de Obra Mayor, dictamen de impacto urbano y licitación con contratistas especializados.',
      order: 2,
      startDate: formatDate(s3Start),
      endDate: formatDate(s3End),
      status: 'active',
      leaderId: null,
      color: '#4f46e5', // Indigo 600
      spTotal: 28,
      spDone: 14,
      sprintIds: [],
      predecessors: [stage2Id], // Interdependencia: depende de Fase 2
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: stage4Id,
      projectId,
      name: 'Fase 4: Cimentación y Estructura Principal',
      description: 'Excavación masiva, armado y colado de zapatas aisladas, montaje de estructura metálica principal y colado de losas de entrepiso.',
      order: 3,
      startDate: formatDate(s4Start),
      endDate: formatDate(s4End),
      status: 'pending',
      leaderId: null,
      color: '#e11d48', // Rose 600
      spTotal: 40,
      spDone: 0,
      sprintIds: [],
      predecessors: [stage3Id], // Interdependencia: depende de Fase 3
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: stage5Id,
      projectId,
      name: 'Fase 5: Envolvente, Redes MEP y Acabados',
      description: 'Montaje de fachada ventilada y cancelería térmica, redes hidrosanitarias y fotovoltaicas, acabados sustentables y paisajismo xerófilo.',
      order: 4,
      startDate: formatDate(s5Start),
      endDate: formatDate(s5End),
      status: 'pending',
      leaderId: null,
      color: '#059669', // Emerald 600
      spTotal: 38,
      spDone: 0,
      sprintIds: [],
      predecessors: [stage4Id], // Interdependencia: depende de Fase 4
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: stage6Id,
      projectId,
      name: 'Fase 6: Pruebas, Certificación y Entrega',
      description: 'Commissioning integral de instalaciones, auditoría para Certificación Edificación Sustentable, simulacros y entrega comunitaria formal.',
      order: 5,
      startDate: formatDate(s6Start),
      endDate: formatDate(s6End),
      status: 'pending',
      leaderId: null,
      color: '#7c3aed', // Purple 600
      spTotal: 18,
      spDone: 0,
      sprintIds: [],
      predecessors: [stage5Id], // Interdependencia: depende de Fase 5
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Tasks configuration with explicit interdependencies
  // All task IDs are generated with predictable keys
  const tId = (index: number) => `t-${index}-${projectId}`;

  interface RawTaskDef {
    index: number;
    title: string;
    description: string;
    duration: number; // days
    stageId: string;
    phase: string;
    type: Task['type'];
    status: Task['status'];
    priority: Task['priority'];
    estimatedSP: number;
    depIndexes: number[]; // indexes in this array
    startDayOffset?: number; // manual offset from baseDate if no deps
  }

  const rawTasks: RawTaskDef[] = [
    // --- FASE 1: Diagnóstico y Factibilidad (Días 0 - 12) ---
    {
      index: 1,
      title: '1.1 Levantamiento topográfico y fotogrametría LiDAR',
      description: 'Mapeo con dron del predio y curvas de nivel a cada 20 cm con geo-referenciación precisa.',
      duration: 3,
      stageId: stage1Id,
      phase: stages[0].name,
      type: 'LEVANTAMIENTO',
      status: 'done',
      priority: 5,
      estimatedSP: 5,
      depIndexes: [],
      startDayOffset: 0
    },
    {
      index: 2,
      title: '1.2 Mecánica de suelos y capacidad de carga',
      description: 'Sondeos de penetración estándar (SPT) y caracterización geotécnica para cimentación.',
      duration: 5,
      stageId: stage1Id,
      phase: stages[0].name,
      type: 'DIAGNÓSTICO',
      status: 'done',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [1] // Depende de 1.1
    },
    {
      index: 3,
      title: '1.3 Manifestación de Impacto Ambiental (MIA)',
      description: 'Estudio de flora y fauna nativa, hidrología superficial y medidas de mitigación ecológica.',
      duration: 4,
      stageId: stage1Id,
      phase: stages[0].name,
      type: 'DIAGNÓSTICO',
      status: 'done',
      priority: 4,
      estimatedSP: 5,
      depIndexes: [1] // Depende de 1.1 (paralela a 1.2, genera holgura)
    },
    {
      index: 4,
      title: '1.4 Consulta y diagnóstico social participativo',
      description: 'Talleres barriales comunitarios para validar el programa arquitectónico y necesidades del centro.',
      duration: 4,
      stageId: stage1Id,
      phase: stages[0].name,
      type: 'SOCIAL / TALLER',
      status: 'done',
      priority: 3,
      estimatedSP: 3,
      depIndexes: [],
      startDayOffset: 1 // Paralela independiente
    },
    {
      index: 5,
      title: '1.5 Dictamen de viabilidad urbana y cierre de Fase 1',
      description: 'Integración final del expediente de factibilidad, normatividad de uso de suelo y firma del dictamen.',
      duration: 4,
      stageId: stage1Id,
      phase: stages[0].name,
      type: 'REVISIÓN / ENTREGA',
      status: 'done',
      priority: 5,
      estimatedSP: 4,
      depIndexes: [2, 3, 4] // [Ruta Crítica Terminal Fase 1]
    },

    // --- FASE 2: Diseño Ejecutivo e Ingenierías (Días 12 - 27) ---
    {
      index: 6,
      title: '2.1 Anteproyecto arquitectónico y diseño bioclimático',
      description: 'Plantas, cortes, orientación solar y ventilación pasiva validados con el diagnóstico de sitio.',
      duration: 5,
      stageId: stage2Id,
      phase: stages[1].name,
      type: 'DISEÑO / MODELADO',
      status: 'done',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [5] // [INTERDEPENDENCIA FASE 1 -> FASE 2]
    },
    {
      index: 7,
      title: '2.2 Memoria de cálculo y diseño estructural',
      description: 'Modelado sismorresistente en software estructural de marcos de acero y zapatas de concreto.',
      duration: 6,
      stageId: stage2Id,
      phase: stages[1].name,
      type: 'DISEÑO / MODELADO',
      status: 'done',
      priority: 5,
      estimatedSP: 10,
      depIndexes: [6] // [Ruta Crítica Fase 2]
    },
    {
      index: 8,
      title: '2.3 Proyecto de instalaciones hidrosanitarias y captación pluvial',
      description: 'Red de distribución de agua potable, cisterna de agua de lluvia y biodigestor anaeróbico.',
      duration: 4,
      stageId: stage2Id,
      phase: stages[1].name,
      type: 'DISEÑO / MODELADO',
      status: 'done',
      priority: 4,
      estimatedSP: 5,
      depIndexes: [6] // Paralela a cálculo estructural (con holgura)
    },
    {
      index: 9,
      title: '2.4 Proyecto de electrificación solar e iluminación LED',
      description: 'Dimensionamiento de paneles solares fotovoltaicos, banco de baterías y red de distribución.',
      duration: 4,
      stageId: stage2Id,
      phase: stages[1].name,
      type: 'DISEÑO / MODELADO',
      status: 'done',
      priority: 4,
      estimatedSP: 5,
      depIndexes: [6] // Paralela con holgura
    },
    {
      index: 10,
      title: '2.5 Catálogo de conceptos, presupuesto y modelo BIM',
      description: 'Volumetrías finales, especificaciones técnicas, precios unitarios y planos ejecutivos firmados.',
      duration: 4,
      stageId: stage2Id,
      phase: stages[1].name,
      type: 'PLANOS EJECUTIVOS',
      status: 'done',
      priority: 5,
      estimatedSP: 6,
      depIndexes: [7, 8, 9] // [Ruta Crítica Terminal Fase 2]
    },

    // --- FASE 3: Licencias, Permisos y Licitación (Días 27 - 40) ---
    {
      index: 11,
      title: '3.1 Ingreso de solicitud para Licencia de Construcción',
      description: 'Ingreso oficial ante alcaldía y secretaría de desarrollo urbano del expediente técnico completo.',
      duration: 4,
      stageId: stage3Id,
      phase: stages[2].name,
      type: 'REUNIÓN / COORDINACIÓN',
      status: 'done',
      priority: 5,
      estimatedSP: 5,
      depIndexes: [10] // [INTERDEPENDENCIA FASE 2 -> FASE 3]
    },
    {
      index: 12,
      title: '3.2 Convocatoria y licitación de contratistas de obra',
      description: 'Envío de bases, junta de aclaraciones y evaluación de propuestas técnicas y económicas.',
      duration: 6,
      stageId: stage3Id,
      phase: stages[2].name,
      type: 'COSTOS Y PRESUPUESTO',
      status: 'done',
      priority: 4,
      estimatedSP: 8,
      depIndexes: [10] // Corre en paralelo con los trámites de permiso
    },
    {
      index: 13,
      title: '3.3 Emisión y pago de derechos de Licencia de Obra Mayor',
      description: 'Obtención formal de la autorización de construcción y manifestación tipo B aprobada.',
      duration: 5,
      stageId: stage3Id,
      phase: stages[2].name,
      type: 'REUNIÓN / COORDINACIÓN',
      status: 'working_on_it',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [11] // [Ruta Crítica Fase 3]
    },
    {
      index: 14,
      title: '3.4 Firma de contratos y anticipo para suministro de acero',
      description: 'Contratación del constructor principal y habilitado del lote de perfiles estructurales.',
      duration: 4,
      stageId: stage3Id,
      phase: stages[2].name,
      type: 'REUNIÓN / COORDINACIÓN',
      status: 'working_on_it',
      priority: 5,
      estimatedSP: 7,
      depIndexes: [12, 13] // [Ruta Crítica Terminal Fase 3]
    },

    // --- FASE 4: Cimentación y Estructura Principal (Días 40 - 60) ---
    {
      index: 15,
      title: '4.1 Trazo, despalme y excavación profunda',
      description: 'Preparación del terreno, colocación de ejes con estación total y corte a cota de desplante.',
      duration: 4,
      stageId: stage4Id,
      phase: stages[3].name,
      type: 'LEVANTAMIENTO',
      status: 'todo',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [14] // [INTERDEPENDENCIA FASE 3 -> FASE 4]
    },
    {
      index: 16,
      title: '4.2 Armado y colado de zapatas y losa de cimentación',
      description: 'Habilitado de acero de refuerzo, cimbra y colado de concreto f’c=250 kg/cm² con vibrado controlado.',
      duration: 6,
      stageId: stage4Id,
      phase: stages[3].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 5,
      estimatedSP: 12,
      depIndexes: [15] // [Ruta Crítica Fase 4]
    },
    {
      index: 17,
      title: '4.3 Montaje de columnas y trabes de acero estructural',
      description: 'Maniobra con grúa, nivelación, torque de pernos de alta resistencia y soldadura de inspección ultrasonido.',
      duration: 6,
      stageId: stage4Id,
      phase: stages[3].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 5,
      estimatedSP: 12,
      depIndexes: [16] // [Ruta Crítica Fase 4]
    },
    {
      index: 18,
      title: '4.4 Colado de losas de entrepiso y azotea verde',
      description: 'Colocación de lámina losacero, malla electrosoldada y bombeo de concreto con aditivo hidrófugo.',
      duration: 4,
      stageId: stage4Id,
      phase: stages[3].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [17] // [Ruta Crítica Terminal Fase 4]
    },

    // --- FASE 5: Envolvente, Redes MEP y Acabados (Días 60 - 79) ---
    {
      index: 19,
      title: '5.1 Montaje de fachada ventilada y cancelería térmica',
      description: 'Estructura secundaria de aluminio, paneles de madera certificada FSC y vidrio doble hermético (DVH).',
      duration: 6,
      stageId: stage5Id,
      phase: stages[4].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 4,
      estimatedSP: 8,
      depIndexes: [18] // Depende de 4.4, corre en paralelo a MEP
    },
    {
      index: 20,
      title: '5.2 Tendido troncal de redes hidrosanitarias, eléctricas y datos',
      description: 'Tuberías de polipropileno termofusionado, canalizaciones eléctricas y cableado estructurado Cat 6A.',
      duration: 7,
      stageId: stage5Id,
      phase: stages[4].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 5,
      estimatedSP: 11,
      depIndexes: [18] // [INTERDEPENDENCIA FASE 4 -> FASE 5: Ruta Crítica]
    },
    {
      index: 21,
      title: '5.3 Instalación del sistema fotovoltaico e inversor híbrido',
      description: 'Montaje de 32 paneles solares monocristalinos y cableado hacia centro de carga general.',
      duration: 4,
      stageId: stage5Id,
      phase: stages[4].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 4,
      estimatedSP: 6,
      depIndexes: [20] // Depende de 5.2
    },
    {
      index: 22,
      title: '5.4 Acabados interiores de bajo COV y carpinterías',
      description: 'Pinturas base agua no tóxicas, pisos de terrazo pulido y puertas acústicas de madera reciclada.',
      duration: 6,
      stageId: stage5Id,
      phase: stages[4].name,
      type: 'DISEÑO / MODELADO',
      status: 'todo',
      priority: 5,
      estimatedSP: 8,
      depIndexes: [19, 20] // [Ruta Crítica Fase 5]
    },
    {
      index: 23,
      title: '5.5 Paisajismo xerófilo, suelo vivo y captación superficial',
      description: 'Siembra de especies nativas de bajo consumo hídrico, jardineras infiltrantes y senderos permeables.',
      duration: 4,
      stageId: stage5Id,
      phase: stages[4].name,
      type: 'DIAGNÓSTICO',
      status: 'todo',
      priority: 4,
      estimatedSP: 5,
      depIndexes: [21, 22] // [Ruta Crítica Terminal Fase 5]
    },

    // --- FASE 6: Pruebas, Certificación y Entrega (Días 79 - 88) ---
    {
      index: 24,
      title: '6.1 Commissioning integral y pruebas de balance hidrónico',
      description: 'Pruebas de presión en tuberías, verificación de aislamiento eléctrico y pruebas de flujo de aire.',
      duration: 3,
      stageId: stage6Id,
      phase: stages[5].name,
      type: 'REVISIÓN / ENTREGA',
      status: 'todo',
      priority: 5,
      estimatedSP: 5,
      depIndexes: [23] // [INTERDEPENDENCIA FASE 5 -> FASE 6: Ruta Crítica]
    },
    {
      index: 25,
      title: '6.2 Auditoría técnica para Certificación Edificación Sustentable',
      description: 'Inspección de tercería para acreditación de eficiencia energética, huella hídrica y confort térmico.',
      duration: 4,
      stageId: stage6Id,
      phase: stages[5].name,
      type: 'REVISIÓN / ENTREGA',
      status: 'todo',
      priority: 5,
      estimatedSP: 7,
      depIndexes: [24] // [Ruta Crítica Fase 6]
    },
    {
      index: 26,
      title: '6.3 Protocolo de entrega-recepción comunitaria y finiquito',
      description: 'Capacitación del comité vecinal, entrega de manuales de operación y firma del acta de recepción.',
      duration: 2,
      stageId: stage6Id,
      phase: stages[5].name,
      type: 'REVISIÓN / ENTREGA',
      status: 'todo',
      priority: 5,
      estimatedSP: 6,
      depIndexes: [25] // [Hito Final del Proyecto]
    },
  ];

  // Resolve task date calculations based on actual dependency dates
  const taskMap: Record<number, { startDate: Date; endDate: Date; id: string }> = {};
  const formattedTasks: Task[] = [];

  const sprint1Id = `sp-1-${projectId}`;
  const sprint2Id = `sp-2-${projectId}`;
  const sprint3Id = `sp-3-${projectId}`;
  const sprint4Id = `sp-4-${projectId}`;
  const sprint5Id = `sp-5-${projectId}`;
  const sprint6Id = `sp-6-${projectId}`;

  const sprints = [
    { id: sprint1Id, projectId, name: 'Sprint 1: Diagnóstico', startDate: formatDate(s1Start), endDate: formatDate(s1End), stageId: stage1Id },
    { id: sprint2Id, projectId, name: 'Sprint 2: Diseño Ejecutivo', startDate: formatDate(s2Start), endDate: formatDate(s2End), stageId: stage2Id },
    { id: sprint3Id, projectId, name: 'Sprint 3: Permisos y Licitación', startDate: formatDate(s3Start), endDate: formatDate(s3End), stageId: stage3Id },
    { id: sprint4Id, projectId, name: 'Sprint 4: Cimentación y Obra', startDate: formatDate(s4Start), endDate: formatDate(s4End), stageId: stage4Id },
    { id: sprint5Id, projectId, name: 'Sprint 5: Instalaciones y Acabados', startDate: formatDate(s5Start), endDate: formatDate(s5End), stageId: stage5Id },
    { id: sprint6Id, projectId, name: 'Sprint 6: Certificación y Entrega', startDate: formatDate(s6Start), endDate: formatDate(s6End), stageId: stage6Id },
  ];

  const stageToSprint: Record<string, string> = {
    [stage1Id]: sprint1Id,
    [stage2Id]: sprint2Id,
    [stage3Id]: sprint3Id,
    [stage4Id]: sprint4Id,
    [stage5Id]: sprint5Id,
    [stage6Id]: sprint6Id,
  };

  rawTasks.forEach((t) => {
    const taskId = tId(t.index);
    let startDate: Date;

    if (t.depIndexes.length > 0) {
      // Start date is the maximum end date of its predecessors
      const depEndDates = t.depIndexes.map(depIdx => taskMap[depIdx]?.endDate || baseDate);
      const maxEndTime = Math.max(...depEndDates.map(d => d.getTime()));
      startDate = new Date(maxEndTime);
    } else {
      // Root task
      startDate = addDays(baseDate, t.startDayOffset || 0);
    }

    const endDate = addDays(startDate, t.duration);
    taskMap[t.index] = { startDate, endDate, id: taskId };

    const actualDependencies = t.depIndexes.map(depIdx => tId(depIdx));

    formattedTasks.push({
      id: taskId,
      projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      effort: t.duration * 8,
      type: t.type,
      assignedTo: '',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      phase: t.phase,
      stageId: t.stageId,
      sprintId: stageToSprint[t.stageId] || null,
      epic: 'Complejo Bioclimático',
      estimatedSP: t.estimatedSP,
      categoryId: '',
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
      dependencies: actualDependencies,
      duration: t.duration,
      isMilestone: t.index === 26 || t.index === 5 || t.index === 10,
    });
  });

  const project = {
    id: projectId,
    name: 'Complejo Bioclimático y Regeneración Urbana (6 Fases Interdependientes)',
    color: '#6366f1',
    description: 'Proyecto arquitectónico y urbano integral diseñado para visualizar la interdependencia secuencial y paralela entre todas las fases de ejecución: desde estudios preliminares hasta certificación y entrega.',
    startDate: formatDate(s1Start),
    endDate: formatDate(s6End),
    stages,
    currentStageIndex: 2,
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    isDeleted: false,
    deletedAt: null
  };

  return {
    project,
    stages,
    sprints,
    tasks: formattedTasks
  };
}

/**
 * Saves the complete interdependent project to Firestore.
 */
export async function saveCompleteSampleProjectToFirestore(userRole: string = 'admin'): Promise<string> {
  const { project, tasks, sprints } = generateCompleteSampleProject();

  // 1. Save Project document
  await setDoc(doc(db, 'projects', project.id), project);

  // 2. Save Sprints
  for (const sp of sprints) {
    await setDoc(doc(db, `projects/${project.id}/sprints/${sp.id}`), sp);
  }

  // 3. Save Tasks to subcollection in chunks (batch limit is 500)
  const batch = writeBatch(db);
  for (const task of tasks) {
    const taskRef = doc(db, `projects/${project.id}/tasks/${task.id}`);
    batch.set(taskRef, task);
  }
  await batch.commit();

  return project.id;
}

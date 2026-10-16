import { toast } from 'react-hot-toast';
import { Task, StageCPM } from '../types/criticalPath';
import { Stage } from '../types/stage';

/**
 * Computes Critical Path for tasks, optionally incorporating stage-level predecessor interdependencies.
 * If stage A precedes stage B, root tasks of stage B inherit dependencies from terminal tasks of stage A.
 */
export function computeCriticalPath(tasks: Task[], stages?: Stage[]): Task[] {
  if (!tasks || tasks.length === 0) return [];

  // Map to hold enriched tasks
  const taskMap: { [key: string]: Task } = {};

  // Clone tasks and prepare initial mapping
  tasks.forEach(t => {
    taskMap[t.id] = { 
      ...t,
      dependencies: t.dependencies ? [...t.dependencies] : []
    };

    // Calculate duration in days if not present
    if (t.startDate && t.endDate) {
      const start = new Date(t.startDate).getTime();
      const end = new Date(t.endDate).getTime();
      taskMap[t.id].duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    } else {
      taskMap[t.id].duration = 1; // Default 1 day
    }
  });

  // Stage-to-task dependency propagation if stages are provided
  if (stages && stages.length > 0) {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    
    // Group tasks by stage
    const tasksByStage: { [stageId: string]: string[] } = {};
    Object.values(taskMap).forEach(t => {
      // Find matching stage by ID or name/phase
      const stage = stages.find(s => s.id === (t as any).stageId || s.name === t.phase || s.id === t.phase);
      if (stage) {
        if (!tasksByStage[stage.id]) tasksByStage[stage.id] = [];
        tasksByStage[stage.id].push(t.id);
      }
    });

    // For each stage with predecessors, link tasks
    stages.forEach(stage => {
      if (!stage.predecessors || stage.predecessors.length === 0) return;
      
      const currentStageTasks = tasksByStage[stage.id] || [];
      if (currentStageTasks.length === 0) return;

      // Find root tasks of this stage (tasks that don't depend on another task in the same stage)
      const rootTasksInCurrentStage = currentStageTasks.filter(tid => {
        const deps = taskMap[tid]?.dependencies || [];
        return !deps.some(depId => currentStageTasks.includes(depId));
      });

      const targets = rootTasksInCurrentStage.length > 0 ? rootTasksInCurrentStage : currentStageTasks;

      // For each predecessor stage, gather its terminal tasks (or all its tasks)
      stage.predecessors.forEach(predStageId => {
        const predStage = stageMap.get(predStageId);
        if (!predStage) return;

        const predTasks = tasksByStage[predStage.id] || [];
        if (predTasks.length === 0) return;

        // Terminal tasks in predStage (tasks that are not dependencies of any other task in predStage)
        const predDepSet = new Set<string>();
        predTasks.forEach(tid => {
          (taskMap[tid]?.dependencies || []).forEach(d => predDepSet.add(d));
        });
        const terminalPredTasks = predTasks.filter(tid => !predDepSet.has(tid));
        const sources = terminalPredTasks.length > 0 ? terminalPredTasks : predTasks;

        // Add each source task as dependency to target tasks
        targets.forEach(targetId => {
          sources.forEach(sourceId => {
            if (targetId !== sourceId && !taskMap[targetId].dependencies!.includes(sourceId)) {
              taskMap[targetId].dependencies!.push(sourceId);
            }
          });
        });
      });
    });
  }

  // 1. Build graph and reverse graph
  const graph: { [key: string]: string[] } = {};
  const reverseGraph: { [key: string]: string[] } = {};

  Object.values(taskMap).forEach(t => {
    // Filter out invalid/non-existent task dependency IDs
    const validDeps = (t.dependencies || []).filter(depId => !!taskMap[depId] && depId !== t.id);
    t.dependencies = validDeps;
    graph[t.id] = validDeps;
    if (!reverseGraph[t.id]) reverseGraph[t.id] = [];
  });

  Object.values(taskMap).forEach(t => {
    (t.dependencies || []).forEach(depId => {
      if (!reverseGraph[depId]) reverseGraph[depId] = [];
      reverseGraph[depId].push(t.id);
    });
  });

  // 2. Cycle detection (DFS)
  const visited: { [key: string]: number } = {}; // 0: unvisited, 1: visiting, 2: visited
  const cyclePath: string[] = [];

  function hasCycle(nodeId: string, path: string[]): boolean {
    if (visited[nodeId] === 1) {
      cyclePath.push(...path.slice(path.indexOf(nodeId)), nodeId);
      return true;
    }
    if (visited[nodeId] === 2) return false;

    visited[nodeId] = 1;
    path.push(nodeId);

    for (const depId of graph[nodeId] || []) {
      if (taskMap[depId] && hasCycle(depId, path)) return true;
    }

    path.pop();
    visited[nodeId] = 2;
    return false;
  }

  for (const taskId of Object.keys(taskMap)) {
    if (!visited[taskId]) {
      if (hasCycle(taskId, [])) {
        const titles = cyclePath.map(id => taskMap[id]?.title || id).join(' → ');
        toast.error(`Ciclo detectado en dependencias de tareas/etapas: ${titles}`);
        // Return without breaking the app
        return tasks;
      }
    }
  }

  // 3. Forward Pass (Calculate ES, EF)
  const topoOrder: string[] = [];
  const inDegree: { [key: string]: number } = {};

  Object.keys(taskMap).forEach(id => {
    inDegree[id] = (graph[id] || []).filter(depId => !!taskMap[depId]).length;
  });

  const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topoOrder.push(currentId);

    const task = taskMap[currentId];
    let maxEF = 0;

    (graph[currentId] || []).forEach(depId => {
      if (taskMap[depId] && (taskMap[depId].earlyFinish || 0) > maxEF) {
        maxEF = taskMap[depId].earlyFinish || 0;
      }
    });

    task.earlyStart = maxEF;
    task.earlyFinish = task.earlyStart + (task.duration || 1);

    (reverseGraph[currentId] || []).forEach(nextId => {
      if (taskMap[nextId]) {
        inDegree[nextId]--;
        if (inDegree[nextId] === 0) queue.push(nextId);
      }
    });
  }

  // 4. Backward Pass (Calculate LS, LF, Slack, isCritical)
  const projectDuration = Math.max(...Object.values(taskMap).map(t => t.earlyFinish || 0), 0);

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const currentId = topoOrder[i];
    const task = taskMap[currentId];

    let minLS = projectDuration;
    const successors = reverseGraph[currentId] || [];

    if (successors.length > 0) {
      let hasValidSuccessor = false;
      successors.forEach(nextId => {
        if (taskMap[nextId]) {
          hasValidSuccessor = true;
          if ((taskMap[nextId].lateStart ?? projectDuration) < minLS) {
            minLS = taskMap[nextId].lateStart ?? projectDuration;
          }
        }
      });
      if (!hasValidSuccessor) minLS = projectDuration;
    }

    task.lateFinish = minLS;
    task.lateStart = task.lateFinish - (task.duration || 1);
    task.slack = Math.max(0, (task.lateStart || 0) - (task.earlyStart || 0));
    task.isCritical = task.slack === 0;
  }

  return Object.values(taskMap);
}

/**
 * Computes Critical Path at the Stage/Phase level.
 * Handles stage interdependencies (predecessors), calculates ES, EF, LS, LF, Slack,
 * determines critical stages, and aggregates progress and task metrics.
 */
export function computeStageCriticalPath(stages: Stage[], tasks: any[] = []): StageCPM[] {
  if (!stages || stages.length === 0) return [];

  const stageMap: { [id: string]: StageCPM } = {};
  const graph: { [id: string]: string[] } = {};
  const reverseGraph: { [id: string]: string[] } = {};

  // Initialize stage CPM entries
  stages.forEach(stage => {
    let duration = 1;
    if (stage.startDate && stage.endDate) {
      const s = new Date(stage.startDate).getTime();
      const e = new Date(stage.endDate).getTime();
      duration = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    }

    // Filter tasks for this stage
    const stageTasks = tasks.filter(t => t.stageId === stage.id || t.phase === stage.name || t.phase === stage.id);
    const completedTasks = stageTasks.filter(t => t.status === 'done' || t.status === 'completed');
    const taskCount = stageTasks.length;
    const completedTaskCount = completedTasks.length;
    const progressPercent = taskCount > 0 
      ? Math.round((completedTaskCount / taskCount) * 100)
      : (stage.spTotal > 0 ? Math.round((stage.spDone / stage.spTotal) * 100) : (stage.status === 'completed' ? 100 : 0));

    stageMap[stage.id] = {
      id: stage.id,
      name: stage.name || 'Sin Nombre',
      color: stage.color || '#3b82f6',
      startDate: stage.startDate || new Date().toISOString(),
      endDate: stage.endDate || new Date().toISOString(),
      duration,
      predecessors: stage.predecessors ? [...stage.predecessors] : [],
      status: stage.status || 'pending',
      description: stage.description,
      taskCount,
      completedTaskCount,
      progressPercent,
      earlyStart: 0,
      earlyFinish: duration,
      lateStart: 0,
      lateFinish: duration,
      slack: 0,
      isCritical: false
    };

    graph[stage.id] = (stage.predecessors || []).filter(predId => stages.some(s => s.id === predId));
    reverseGraph[stage.id] = [];
  });

  // Build reverse graph
  Object.keys(graph).forEach(stageId => {
    graph[stageId].forEach(predId => {
      if (reverseGraph[predId]) {
        reverseGraph[predId].push(stageId);
      }
    });
  });

  // Cycle detection on stages
  const visited: { [id: string]: number } = {};
  const cyclePath: string[] = [];

  function hasStageCycle(nodeId: string, path: string[]): boolean {
    if (visited[nodeId] === 1) {
      cyclePath.push(...path.slice(path.indexOf(nodeId)), nodeId);
      return true;
    }
    if (visited[nodeId] === 2) return false;

    visited[nodeId] = 1;
    path.push(nodeId);

    for (const predId of graph[nodeId] || []) {
      if (stageMap[predId] && hasStageCycle(predId, path)) return true;
    }

    path.pop();
    visited[nodeId] = 2;
    return false;
  }

  for (const stageId of Object.keys(stageMap)) {
    if (!visited[stageId]) {
      if (hasStageCycle(stageId, [])) {
        const names = cyclePath.map(id => stageMap[id]?.name || id).join(' → ');
        toast.error(`Ciclo de predecesoras detectado entre etapas: ${names}`);
        return Object.values(stageMap);
      }
    }
  }

  // Forward pass
  const topoOrder: string[] = [];
  const inDegree: { [id: string]: number } = {};

  Object.keys(stageMap).forEach(id => {
    inDegree[id] = (graph[id] || []).length;
  });

  const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topoOrder.push(currentId);

    const stage = stageMap[currentId];
    let maxEF = 0;

    (graph[currentId] || []).forEach(predId => {
      if (stageMap[predId] && (stageMap[predId].earlyFinish || 0) > maxEF) {
        maxEF = stageMap[predId].earlyFinish || 0;
      }
    });

    stage.earlyStart = maxEF;
    stage.earlyFinish = stage.earlyStart + stage.duration;

    (reverseGraph[currentId] || []).forEach(nextId => {
      if (stageMap[nextId]) {
        inDegree[nextId]--;
        if (inDegree[nextId] === 0) queue.push(nextId);
      }
    });
  }

  // Backward pass
  const maxProjectDays = Math.max(...Object.values(stageMap).map(s => s.earlyFinish || 0), 0);

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const currentId = topoOrder[i];
    const stage = stageMap[currentId];

    let minLS = maxProjectDays;
    const successors = reverseGraph[currentId] || [];

    if (successors.length > 0) {
      let hasValidSuccessor = false;
      successors.forEach(nextId => {
        if (stageMap[nextId]) {
          hasValidSuccessor = true;
          if ((stageMap[nextId].lateStart ?? maxProjectDays) < minLS) {
            minLS = stageMap[nextId].lateStart ?? maxProjectDays;
          }
        }
      });
      if (!hasValidSuccessor) minLS = maxProjectDays;
    }

    stage.lateFinish = minLS;
    stage.lateStart = stage.lateFinish - stage.duration;
    stage.slack = Math.max(0, (stage.lateStart || 0) - (stage.earlyStart || 0));
    stage.isCritical = stage.slack === 0;
  }

  return Object.values(stageMap);
}

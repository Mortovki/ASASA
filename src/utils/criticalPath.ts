import { toast } from 'react-hot-toast';
import { Task } from '../types/criticalPath';

export function computeCriticalPath(tasks: Task[]): Task[] {
  // 1. Build graph and calculate durations
  const graph: { [key: string]: string[] } = {};
  const reverseGraph: { [key: string]: string[] } = {};
  const taskMap: { [key: string]: Task } = {};
  
  tasks.forEach(t => {
    taskMap[t.id] = { ...t };
    graph[t.id] = t.dependencies || [];
    if (!reverseGraph[t.id]) reverseGraph[t.id] = [];
    (t.dependencies || []).forEach((depId: string) => {
      if (!reverseGraph[depId]) reverseGraph[depId] = [];
      reverseGraph[depId].push(t.id);
    });
    
    // Calculate duration in days if not present
    if (t.startDate && t.endDate) {
      const start = new Date(t.startDate).getTime();
      const end = new Date(t.endDate).getTime();
      taskMap[t.id].duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    } else {
      taskMap[t.id].duration = 1; // Default 1 day
    }
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
        toast.error(`Ciclo detectado entre tareas: ${titles}`);
        return tasks; // Return original if cycle
      }
    }
  }

  // 3. Forward Pass (Calculate ES, EF)
  const topoOrder: string[] = [];
  const inDegree: { [key: string]: number } = {};
  
  Object.keys(taskMap).forEach(id => {
    inDegree[id] = (graph[id] || []).filter(depId => taskMap[depId]).length;
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

  // 4. Backward Pass (Calculate LS, LF)
  const projectDuration = Math.max(...Object.values(taskMap).map(t => t.earlyFinish || 0));
  
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
    task.slack = task.lateStart - (task.earlyStart || 0);
    task.isCritical = task.slack === 0;
  }

  return Object.values(taskMap);
}

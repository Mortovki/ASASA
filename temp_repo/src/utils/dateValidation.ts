import { differenceInCalendarDays } from 'date-fns';
import { Stage, Project } from '../types/stage';
import { Task } from '../types/task';
import { Sprint } from '../types/project';

// Regla 1: las fechas de etapas deben estar dentro del rango del proyecto
export function validateStageDates(
  stages: Stage[],
  projectStart: string | null,
  projectEnd: string | null
): string[] {
  const errors: string[] = []
  if (!projectStart || !projectEnd) return errors
  stages.forEach(stage => {
    if (stage.startDate && stage.startDate < projectStart) {
      errors.push(`"${stage.name}": inicio antes del inicio del proyecto`)
    }
    if (stage.endDate && stage.endDate > projectEnd) {
      errors.push(`"${stage.name}": fin después del fin del proyecto`)
    }
    if (stage.startDate && stage.endDate && stage.startDate > stage.endDate) {
      errors.push(`"${stage.name}": fecha de inicio posterior al fin`)
    }
  })
  return errors
}

// Regla 2: las fechas de tareas deben estar dentro de su etapa (advertencia)
export function warnTaskOutsideStage(
  task: Task,
  stage: Stage
): boolean {
  if (!stage.startDate || !stage.endDate || !task.startDate || !task.endDate) return false
  return (
    task.startDate < stage.startDate ||
    task.endDate   > stage.endDate
  )
}

// Regla 3: los sprints deben estar dentro de las fechas del proyecto
export function validateSprintDates(
  sprint: Sprint,
  project: Project
): string[] {
  const errors: string[] = []
  if (project.startDate && sprint.startDate < project.startDate) {
    errors.push('El sprint empieza antes del inicio del proyecto')
  }
  if (project.endDate && sprint.endDate > project.endDate) {
    errors.push('El sprint termina después del fin del proyecto')
  }
  return errors
}

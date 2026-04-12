import { Skill } from '../types/skills';

export const SKILL_CATEGORIES = [
  { id: 'arquitectura', name: 'Arquitectura', color: '#8B4513' },
  { id: 'urbanismo', name: 'Urbanismo', color: '#3b82f6' },
  { id: 'paisaje', name: 'Paisaje', color: '#22c55e' },
  { id: 'comunitario', name: 'Comunitario', color: '#f97316' },
  { id: 'tecnica', name: 'Técnica', color: '#0ea5e9' },
  { id: 'soft', name: 'Soft / Humanas', color: '#a855f7' },
];

export const PREDEFINED_SKILLS: Skill[] = [
  // Arquitectura
  { id: 'arq_1', name: 'Diseño', category: 'arquitectura' },
  { id: 'arq_2', name: 'Normativa', category: 'arquitectura' },
  { id: 'arq_3', name: 'Construcción vernácula', category: 'arquitectura' },
  { id: 'arq_4', name: 'Accesibilidad', category: 'arquitectura' },
  
  // Urbanismo
  { id: 'urb_1', name: 'Análisis urbano', category: 'urbanismo' },
  { id: 'urb_2', name: 'Movilidad', category: 'urbanismo' },
  { id: 'urb_3', name: 'Planeación territorial', category: 'urbanismo' },
  { id: 'urb_4', name: 'Espacio público', category: 'urbanismo' },
  
  // Paisaje
  { id: 'pai_1', name: 'Plantas nativas', category: 'paisaje' },
  { id: 'pai_2', name: 'Restauración ecológica', category: 'paisaje' },
  { id: 'pai_3', name: 'Infraestructura verde', category: 'paisaje' },
  
  // Comunitario
  { id: 'com_1', name: 'Diagnóstico participativo', category: 'comunitario' },
  { id: 'com_2', name: 'Talleres', category: 'comunitario' },
  { id: 'com_3', name: 'Mapeo colectivo', category: 'comunitario' },
  { id: 'com_4', name: 'Gestión social', category: 'comunitario' },
  
  // Técnica
  { id: 'tec_1', name: 'AutoCAD', category: 'tecnica' },
  { id: 'tec_2', name: 'Revit', category: 'tecnica' },
  { id: 'tec_3', name: 'QGIS', category: 'tecnica' },
  { id: 'tec_4', name: 'Levantamiento físico', category: 'tecnica' },
  { id: 'tec_5', name: 'Fotogrametría', category: 'tecnica' },
  
  // Soft / Humanas
  { id: 'sof_1', name: 'Escucha activa', category: 'soft' },
  { id: 'sof_2', name: 'Empatía comunitaria', category: 'soft' },
  { id: 'sof_3', name: 'Facilitación', category: 'soft' },
  { id: 'sof_4', name: 'Resolución de conflictos', category: 'soft' },
];

# Tablero de Tareas y Gestión de Proyectos con Integración a Google Tasks

Plan de integración para incorporar un sistema visual y reactivo de gestión de tareas (Tabla principal agrupada, Kanban, Gantt interactivo y Calendario mensual) inspirado en Monday.com, con sincronización bidireccional mediante Google Tasks API, control estricto de accesos según roles y preservación sinérgica de todos los módulos existentes (bitácora, sesiones, reportes y habilidades).

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario en la fase de clarificación:**
> - **Ubicación:** Tablero dual: pestaña dedicada de "Tareas y Cronograma" dentro de cada proyecto y una sección de navegación principal ("Gestión de Tareas") con vista global consolidada y filtro rápido "Mis Tareas".
> - **Google Tasks:** Sincronización bidireccional completa. Las tareas creadas o actualizadas en la plataforma se sincronizan con las listas de Google Tasks del usuario, y los cambios externos en Google Tasks actualizan el estado en la aplicación.
> - **Permisos de Alumnxs:** Los alumnos prestadores pueden ver sus tareas asignadas, actualizar su estado (`En curso`, `Listo`, `Detenido`), adjuntar archivos o entregables y comentar, sin alterar la estructura ni asignaciones fijadas por los coordinadores.

---

### 1. Overview & Core Concept

- **Qué hace:** Proporciona un espacio de trabajo visual completo para planificar, asignar, supervisar y ejecutar tareas de servicio social y proyectos comunitarios. Dispone de 4 vistas sincronizadas en tiempo real:
  1. **Tabla principal:** Agrupada por fases o estados (`Pendientes`, `Completado`, `Entregables`, grupos personalizados), con columnas de Responsables, Estado, Vencimiento con alertas, Prioridad, Entregables/Archivos, Cronograma (timeline) y barra de totales.
  2. **Kanban:** Tablero de arrastre de tarjetas distribuidas por columnas de estado (`No iniciado`, `En curso`, `Detenido`, `Listo`).
  3. **Gantt:** Cronograma temporal interactivo con barras de duración, marcas semanales/diarias y ajuste automático.
  4. **Calendario:** Malla mensual interactiva que muestra la duración de las tareas con barras codificadas por color según su estado.
- **Público objetivo:**
  - *Supercoordinadores y Coordinador Maestro:* Supervisión global de todas las brigadas, cronogramas y cuellos de botella.
  - *Coordinadores de Proyecto / Alumno Coordinador:* Planificación de hitos, asignación de tareas a prestadores y revisión de entregables.
  - *Alumnxs / Prestadores:* Claridad absoluta sobre sus actividades pendientes, fechas límites y registro directo de avances.
- **Valor agregado:** Cierra la brecha entre la planeación de metas y el registro de horas de servicio, permitiendo que una tarea concluida alimente directamente la bitácora de actividades o las minutas de sesiones presenciales.

---

### 2. User Experience & Visual Design

#### Vistas y Flujos Clave
1. **Acceso Dual Coherente:**
   - *Pestaña en Proyecto:* Al ingresar a cualquier proyecto desde el Directorio, se añade la pestaña **"Tareas y Cronograma"**, mostrando únicamente las tareas de ese proyecto.
   - *Vista Global en Menú Lateral:* Nueva sección **"Gestión de Tareas"** accesible desde la navegación principal. Los coordinadores ven un selector de proyecto o vista consolidada; los alumnos ven por defecto sus tareas pendientes asignadas en todos sus proyectos.
2. **Selector de Vistas:** Barra de navegación superior con pestañas: `Tabla principal`, `Kanban`, `Gantt`, `Calendario`, además de barra de filtros rápidos (`Buscar`, `Persona/Responsable`, `Estado`, `Prioridad`, `Ordenar`).
3. **Modal de Detalle y Entregables:**
   - Panel lateral o modal expandible al hacer clic en una tarea para ver descripción detallada, responsables asignados, fechas límite, historial de cambios, carga de entregables (enlace Drive o subida) y comentarios con menciones.
4. **Asistente de IA ("Sugerencias de IA"):**
   - Botón contextual en la cabecera que permite al coordinador redactar un objetivo general (ej. *"Levantamiento topográfico de la zona norte"*) y generar con Gemini una propuesta desglosada en tareas, prioridades y cronogramas sugeridos.

#### Dirección Visual y Tokens de Diseño
- **Estilo:** Utilitario, minimalista y de alta densidad de información (inspirado en Monday.com y ClickUp), adaptado perfectamente tanto al tema claro como al modo oscuro de la plataforma.
- **Códigos de Color Semánticos (Estados):**
  - `Listo` (Verde esmeralda: `#10B981` / `bg-emerald-500`)
  - `En curso` (Ámbar / Naranja: `#F59E0B` / `bg-amber-500`)
  - `Detenido` (Rojo / Carmesí: `#EF4444` / `bg-red-500`)
  - `No iniciado` (Gris neutro: `#6B7280` / `bg-slate-400`)
- **Prioridades:**
  - `Alta` (Púrpura intenso: `#6366F1`)
  - `Media` (Azul lavanda: `#818CF8`)
  - `Baja` (Azul suave: `#93C5FD`)
- **Tipografía y Legibilidad:**
  - Uso de cifras tabulares (`tabular-nums`) para fechas, cronogramas y contadores.
  - Supresión de badges tipo pastilla innecesarios en metadatos estáticos; etiquetas legibles y unificadas.

---

### 3. Matriz de Permisos por Rol

| Acción / Función | Supercoordinador / C. Maestro | Coordinador de Proyecto | Coordinador Alumno | Alumno Prestador |
| :--- | :---: | :---: | :---: | :---: |
| **Ver todas las tareas (Global)** | Sí (todos los proyectos) | Proyectos asignados | Proyectos asignados | Solo tareas asignadas |
| **Crear / Editar tareas y grupos** | Total | Total en sus proyectos | Total en su proyecto | No |
| **Asignar responsables** | Sí | Sí | Sí | No |
| **Modificar Estado** | Sí | Sí | Sí | **Sí (en sus tareas)** |
| **Subir archivos / Entregables** | Sí | Sí | Sí | **Sí (en sus tareas)** |
| **Comentar en tareas** | Sí | Sí | Sí | **Sí (en sus tareas)** |
| **Sincronizar con Google Tasks** | Lista del proyecto o personal | Lista del proyecto o personal | Lista personal | **Lista personal** |
| **Vincular tarea a Bitácora de horas** | Sí | Sí | Sí | **Sí (autocompleta horas)** |

---

### 4. Integración con Google Tasks

1. **Configuración OAuth:**
   - Alcance requerido: `https://www.googleapis.com/auth/tasks`
   - Configuración mediante el flujo estándar de AI Studio (`set_up_oauth`).
2. **Arquitectura de Sincronización Bidireccional:**
   - **App ➔ Google Tasks:** Al crear o asignar una tarea a un usuario con sesión vinculada a Google Workspace, se crea automáticamente una tarea correspondiente en su lista de Google Tasks con título, notas (proyecto y descripción) y fecha de vencimiento.
   - **Google Tasks ➔ App:** Al consultar el tablero o presionar el botón de sincronización, se verifican las tareas completadas en Google Tasks para actualizar su estado a `Listo` en Firestore.

---

### 5. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INTERFAZ DE USUARIO                             │
│  ┌─────────────────────────┐       ┌────────────────────────────────┐  │
│  │ Vista Proyecto:         │       │ Vista Global:                  │  │
│  │ Tab: Tareas/Cronograma  │       │ Ruta /view=task-board          │  │
│  └────────────┬────────────┘       └──────────────┬─────────────────┘  │
│               │                                   │                    │
│               ▼                                   ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   TaskWorkspace Component                        │  │
│  │  ┌─────────────────┬───────────┬─────────────┬────────────────┐  │  │
│  │  │ Tabla Principal │  Kanban   │    Gantt    │   Calendario   │  │  │
│  │  └─────────────────┴───────────┴─────────────┴────────────────┘  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│       Firestore Database      │           │     Google Tasks Sync Service │
│ - Colección: tasks            │           │ - Scope: .../auth/tasks       │
│ - Subgrupos y Entregables     │           │ - Web Client SDK              │
│ - Reglas de seguridad RBAC    │           │ - Sincronización periódica    │
└───────────────────────────────┘           └───────────────────────────────┘
```

#### Modelo de Datos en Firestore (`tasks/{taskId}`)
```typescript
export interface ProjectTask {
  id: string;
  projectId: string;
  projectName: string;
  groupId: string;             // 'pendientes' | 'completado' | custom
  groupName: string;
  title: string;
  description?: string;
  assigneeIds: string[];        // UIDs de prestadores/coordinadores
  status: 'no_iniciado' | 'en_curso' | 'detenido' | 'listo';
  priority: 'baja' | 'media' | 'alta';
  dueDate?: string;            // 'YYYY-MM-DD'
  startDate?: string;          // Para Gantt y Cronograma
  endDate?: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    uploadedBy: string;
    uploadedAt: string;
  }[];
  commentsCount?: number;
  googleTaskId?: string;       // ID de enlace con Google Tasks
  lastUpdated: string;
  updatedBy: string;
  linkedRecordId?: string;     // Enlace opcional a bitácora de horas
}
```

---

### 6. Estrategia de Preservación de Funcionalidades Existentes

- **Sin regresiones:** Ninguna vista existente (Directorio de Proyectos, Bitácora, Sesiones de Trabajo con Minutas y Transcripción, Habilidades, Perfiles) será eliminada ni alterada en sus contratos esenciales.
- **Sinergia Natural:**
  - Al completar una tarea en el tablero, se le ofrece al alumno un botón directo: *"Asentar horas de esta tarea en mi bitácora"*, que abre el registro con el proyecto, fecha y descripción ya precargados.
  - En la vista de Sesiones de Trabajo, los acuerdos o compromisos tomados durante la sesión presencial pueden convertirse con un clic en tareas del tablero del proyecto.

---

### 7. Plan de Implementación por Fases

1. **Fase 1: Configuración de OAuth y Esquema Firestore**
   - Añadir scope `https://www.googleapis.com/auth/tasks` mediante `set_up_oauth`.
   - Crear tipos TypeScript (`src/types/tasks.ts`) y servicio de almacenamiento reactivo con Firestore (`src/services/taskService.ts`).
2. **Fase 2: Motor de Tablero y Vistas (Tabla, Kanban, Gantt, Calendario)**
   - Construir componentes desacoplados: `TaskTableView`, `TaskKanbanView`, `TaskGanttView`, `TaskCalendarView`.
   - Implementar filtros en tiempo real, selector de grupo y drag & drop / selección de estados.
3. **Fase 3: Integración Bidireccional con Google Tasks**
   - Servicio `googleTasksService.ts` para sincronizar estados y tareas asignadas con la cuenta de Google activa.
4. **Fase 4: Integración en Proyecto y Navegación Global**
   - Pestaña "Tareas y Cronograma" dentro del modal/detalle de proyecto.
   - Acceso desde el menú lateral como "Tablero de Tareas".
   - Integración con "Sugerencias de IA" para desglose automático de metas con Gemini.
5. **Fase 5: Validación y Pruebas de Permisos**
   - Verificación de accesos por rol (supercoordinador, coordinador y alumno).
   - Verificación con `compile_applet` y `lint_applet`.

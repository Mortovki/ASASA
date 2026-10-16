# Plan de Rediseño UI/UX: Modal de Actividades del Día en el Calendario

Plan integral para optimizar la interfaz y experiencia de usuario del modal de detalle diario de actividades, corrigiendo desbordes visuales, eliminando botones redundantes y estructurando la información con jerarquía visual profesional.

---

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones de diseño confirmadas con base en el análisis de la captura de pantalla y las respuestas del usuario:

- **Estructura de Tarjetas**: Tarjetas estructuradas con columnas claras y sin desbordes horizontales ni recortes de texto.
- **Acciones Unificadas**: Un solo botón principal de **Agregar Alumnos** (`UserPlus`) por actividad, eliminando la duplicidad observada en la interfaz previa.
- **Visualización de Participantes**: Chips compactos y horizontales con inicial/avatar, nombre, horas computadas y controles de edición/eliminación integrados sin saturar el espacio vertical.

---

## 1. Diagnóstico de la Interfaz Actual

A partir del análisis detallado de la captura de pantalla (`image.png`):

1. **Recorte en el Extremo Izquierdo**: El bloque de horario (`13:00 / 1.5 HRS`) se encuentra truncado o pegado al borde izquierdo de la tarjeta, perdiendo legibilidad.
2. **Desborde en el Extremo Derecho**: Los botones de acción finales (ej. `EDITAR`) quedan parcialmente cortados por el margen del contenedor con barra de desplazamiento (`pr-3` insuficiente / flex sin ancho mínimo adecuado).
3. **Botones Redundantes y Confusos**: Existe un botón `+ ALUMNO` debajo de los nombres de los alumnos y otro botón `+ ALUMNOS` a la derecha, lo que genera confusión operativa y desperdicia espacio horizontal.
4. **Acumulación Vertical de Participantes**: Cada participante genera una caja de tarjeta completa con botones visibles de edición y papelera, forzando un crecimiento vertical desmedido en actividades grupales.
5. **Descripción Comprimida**: El texto de descripción queda apretado en una columna intermedia flotante sin una clara relación de lectura.

---

## 2. Nueva Arquitectura Visual y de Experiencia (UI/UX)

### A. Estructura de Tres Columnas por Tarjeta de Actividad

Cada tarjeta adoptará una rejilla flexible estructurada con responsividad fluida:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [13:00 - 14:30] │  REUNIÓN PRESENCIAL · Manual                                         │
│    1.5 HRS      │  "Trabajo y organización en gabinete para dar seguimiento..."         │
│                 │  ──────────────────────────────────────────────────────────────────  │
│                 │  Participantes (2):                                                  │
│                 │  [T Tania Miguel (1.5h) ✎ 🗑]  [A Ana González (1.5h) ✎ 🗑]           │
│                 │                                             [+ Alumnos]  [✎ Editar]  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Columna 1: Horario y Tiempo Computado** (`w-24 sm:w-28 shrink-0`):
   - Horario con tipografía tabular (`tabular-nums`) de alto contraste.
   - Insignia sutil de horas totales calculadas sin bordes recortados.
   - Separación generosa respecto al borde izquierdo.

2. **Columna 2: Contenido, Descripción y Participantes** (`flex-1 min-w-0`):
   - **Línea Superior**: Identificador de categoría con distintivo cromático sobrio + indicador de modalidad (`Presencial`, `Manual`, `Proyecto`).
   - **Cuerpo Central**: Descripción completa con tipografía equilibrada (13px, interlineado cómodo, sin cursivas comprimidas).
   - **Zona de Participantes**:
     - Contador claro de prestadores asignados.
     - Chips horizontales modernos: mini avatar con inicial, nombre legible, horas entre paréntesis y micro-acciones contextuales de edición y eliminación accesibles al interactuar o con contraste armónico.

3. **Columna 3 / Pie de Tarjeta: Barra de Acciones Limpia**:
   - **`+ Alumnos`**: Un único botón prominente en tono esmeralda para incorporar más alumnos activos a esa actividad.
   - **`Editar`**: Botón de edición de la sesión/horas sin desbordes ni solapamientos con la barra de scroll.

### B. Ajustes del Contenedor Modal y Scrollbar

- **Anchura Máxima y Márgenes**: Ajustar `max-w-4xl` con padding interno equilibrado (`p-6 sm:p-8`), asegurando `overflow-x-hidden` en el contenedor de actividades.
- **Margen de Desplazamiento (Gutter)**: Incorporar `pr-3 sm:pr-4` en la lista scrollable para que la barra de desplazamiento nativa o personalizada no oculte los botones de acción derechos.
- **Cabecera del Modal**:
  - Título con fecha formateada en CDMX.
  - Subtítulo unificado con métricas en texto limpio: `76 horas computadas · 5 actividades registradas`.
  - Botón principal `+ Asignar Horas` y botón `X` de cierre con espacio de respiro adecuado.

---

## 3. Diagrama de Componentes y Flujo de Interacción

```
┌──────────────────────────────────────────────────────────────┐
│                    Modal del Calendario                      │
│                  (selectedCalendarDate)                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌────────────────────────────┐          ┌────────────────────────────┐
│      Cabecera y Meta       │          │  Contenedor de Actividades │
│ Fecha · Métricas · Botón + │          │    (overflow-y-auto pr-4)  │
└────────────────────────────┘          └──────────────┬─────────────┘
                                                       │
                 ┌─────────────────────────────────────┴──────────────────┐
                 ▼                                                        ▼
   ┌───────────────────────────┐                            ┌───────────────────────────┐
   │ Tarjeta de Actividad 1    │                            │ Tarjeta de Actividad N    │
   │ ├─ Columna Horario/Horas  │                            │ ├─ Columna Horario/Horas  │
   │ ├─ Categoría & Descripción│                            │ ├─ Categoría & Descripción│
   │ ├─ Chips de Alumnos       │                            │ ├─ Chips de Alumnos       │
   │ └─ Acciones [+Alumnos][✎] │                            │ └─ Acciones [+Alumnos][✎] │
   └─────────────┬─────────────┘                            └───────────────────────────┘
                 │
                 ├──► Clic en "+ Alumnos" ──► Modal: Agregar Alumnos Activos
                 ├──► Clic en "Editar"    ──► Modal: Editar Horas y Horario
                 └──► Clic en 🗑 Alumno   ──► Modal de Confirmación y Eliminación
```

---

## 4. Fases de Ejecución

1. **Fase 1: Reestructuración de la Rejilla y Contenedores**:
   - Corregir el layout contenedor de la lista en `selectedCalendarDate` para prevenir desbordes horizontales y clipping.
   - Implementar la estructura en columnas para las tarjetas con anchos mínimos y proporciones responsivas.

2. **Fase 2: Unificación de Acciones y Eliminación de Duplicados**:
   - Remover el botón duplicado `+ ALUMNO` del contenedor de chips de participantes.
   - Consolidar las acciones principales en un bloque derecho limpio (`+ Alumnos` y `Editar`).

3. **Fase 3: Rediseño de Chips de Participantes**:
   - Construir chips horizontales compactos con avatar, nombre, horas y micro-acciones de edición/eliminación.
   - Soportar modo claro y modo oscuro con contraste accesible (WCAG AA).

4. **Fase 4: Verificación y Pruebas**:
   - Comprobar que en días con 5 o más actividades no existan desbordes horizontales ni recortes.
   - Validar que las funciones de edición, adición de alumnos y eliminación mantengan persistencia exacta en Firestore.
   - Ejecutar `compile_applet` y `lint_applet`.

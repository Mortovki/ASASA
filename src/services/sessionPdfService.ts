import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SessionPdfData {
  projectName: string;
  categoryName: string;
  sprintName?: string;
  stageName?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  coordinatorName?: string;
  coordinatorEmail?: string;
  aiSummary: string;
  meetingNotes?: string;
  evidenceUrl?: string;
  transcription?: string;
  hasAudioRecording?: boolean;
  detailedMinute?: string;
  topicsDiscussed?: string[];
  agreements?: string[];
  nextSteps?: string[];
  participants: {
    studentId: string;
    name: string;
    career?: string;
    hours: number;
    startTime?: string;
    endTime?: string;
    status?: string;
  }[];
  tasks: {
    title: string;
    status: string;
    priority?: string | number;
    isMilestone?: boolean;
    assignees?: string[];
  }[];
}

export function generateSessionPdf(data: SessionPdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Paleta de colores institucional
  const primaryColor: [number, number, number] = [30, 58, 138]; // Azul marino institucional #1e3a8a
  const accentColor: [number, number, number] = [217, 119, 6]; // Ámbar / Oro UNAM #d97706
  const darkTextColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const lightBgColor: [number, number, number] = [248, 250, 252]; // Slate 50
  const mutedTextColor: [number, number, number] = [100, 116, 139]; // Slate 500

  // Encabezado superior institucional
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Línea de acento dorado
  doc.setFillColor(...accentColor);
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Texto de cabecera
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('REPORTE OFICIAL DE SESIÓN DE TRABAJO', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('PROGRAMA DE SERVICIO SOCIAL Y APOYO COMUNITARIO', margin, 17);

  // Folio y Fecha de generación a la derecha
  const folio = `FOLIO: SES-${data.date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  doc.setFontSize(7.5);
  doc.text(folio, pageWidth - margin, 11, { align: 'right' });
  doc.text(`EMISIÓN: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - margin, 17, { align: 'right' });

  let y = 33;

  // 1. FICHA TÉCNICA DE LA SESIÓN (Recuadro resumen)
  const isPresencialWithAudio = (data.categoryName.toLowerCase().includes('presencial') || data.hasAudioRecording || Boolean(data.transcription));
  const cardHeight = isPresencialWithAudio ? 38 : 34;
  doc.setFillColor(...lightBgColor);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('1. INFORMACIÓN GENERAL DE LA SESIÓN', margin + 4, y + 6);

  if (isPresencialWithAudio) {
    doc.setFontSize(7);
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.text('● REGISTRO DE AUDIO Y TRANSCRIPCIÓN ACTIVADOS', pageWidth - margin - 4, y + 6, { align: 'right' });
  }

  doc.setFontSize(8);
  doc.setTextColor(...darkTextColor);

  // Columna izquierda
  doc.setFont('helvetica', 'bold');
  doc.text('Proyecto:', margin + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.projectName || 'Proyecto General', margin + 25, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Modalidad:', margin + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  const modLabel = isPresencialWithAudio ? `${data.categoryName} (Presencial con Audio)` : data.categoryName;
  doc.text(modLabel || 'General', margin + 25, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Sprint / Etapa:', margin + 4, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.sprintName || 'General'} · ${data.stageName || 'Seguimiento'}`, margin + 25, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('Coordinador:', margin + 4, y + 30);
  doc.setFont('helvetica', 'normal');
  doc.text(data.coordinatorName || data.coordinatorEmail || 'Coordinación de Servicio Social', margin + 25, y + 30);

  // Columna derecha
  const col2X = margin + (contentWidth / 2) + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', col2X, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date || '—', col2X + 22, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Horario:', col2X, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.startTime || '—'} a ${data.endTime || '—'} hrs`, col2X + 22, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Duración:', col2X, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.totalHours || 0} horas por participante`, col2X + 22, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('Participantes:', col2X, y + 30);
  doc.setFont('helvetica', 'normal');
  const totalHrsAcum = data.participants.reduce((acc, p) => acc + (p.hours || 0), 0);
  doc.text(`${data.participants.length} alumno(s) · Total: ${totalHrsAcum} hrs acreditadas`, col2X + 22, y + 30);

  y += cardHeight + 5;

  // 2. SÍNTESIS EJECUTIVA / RESUMEN INSTITUCIONAL (~100 PALABRAS)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('2. SÍNTESIS EJECUTIVA INSTITUCIONAL (REPORTE OFICIAL)', margin, y);

  y += 3;
  const summaryText = data.aiSummary?.trim() || 'Se realizó la sesión de trabajo correspondiente conforme al cronograma de actividades de servicio social.';
  const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 8);
  const summaryHeight = Math.max(16, (splitSummary.length * 4) + 6);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, summaryHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...darkTextColor);
  doc.text(splitSummary, margin + 4, y + 5);

  y += summaryHeight + 5;

  // 3. MINUTA DETALLADA GENERADA CON IA A PARTIR DE TRANSCRIPCIÓN (si existe transcripción o minuta enriquecida)
  const hasEnrichedMinute = (data.topicsDiscussed && data.topicsDiscussed.length > 0) ||
                            (data.agreements && data.agreements.length > 0) ||
                            (data.transcription && data.transcription.trim().length > 15);

  if (hasEnrichedMinute) {
    if (y > pageHeight - 65) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryColor);
    doc.text('3. MINUTA DETALLADA DE LA REUNIÓN PRESENCIAL (GENERADA CON IA)', margin, y);
    y += 4;

    // Caja de Minuta Detallada
    let minuteContentHeight = 8;
    const topicsLines = (data.topicsDiscussed || []).map(t => doc.splitTextToSize(`• ${t}`, contentWidth - 12));
    const agreementsLines = (data.agreements || []).map((a, i) => doc.splitTextToSize(`${i + 1}. ${a}`, contentWidth - 12));
    
    // Calcular altura estimada
    const topicsTotalLines = topicsLines.reduce((acc, l) => acc + l.length, 0);
    const agreementsTotalLines = agreementsLines.reduce((acc, l) => acc + l.length, 0);
    minuteContentHeight += (topicsTotalLines * 3.8) + (agreementsTotalLines * 3.8) + 16;

    if (data.transcription) {
      minuteContentHeight += 18;
    }

    if (y + minuteContentHeight > pageHeight - 35) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, minuteContentHeight, 1.5, 1.5, 'FD');

    let currentMinuteY = y + 5;

    if (data.topicsDiscussed && data.topicsDiscussed.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(30, 41, 59);
      doc.text('TEMAS ABORDADOS Y DISCUSIÓN EN LA REUNIÓN PRESENCIAL:', margin + 4, currentMinuteY);
      currentMinuteY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      topicsLines.forEach(tLines => {
        doc.text(tLines, margin + 4, currentMinuteY);
        currentMinuteY += (tLines.length * 3.6);
      });
      currentMinuteY += 2;
    }

    if (data.agreements && data.agreements.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(30, 41, 59);
      doc.text('ACUERDOS Y COMPROMISOS ESPECÍFICOS ASUMIDOS:', margin + 4, currentMinuteY);
      currentMinuteY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      agreementsLines.forEach(aLines => {
        doc.text(aLines, margin + 4, currentMinuteY);
        currentMinuteY += (aLines.length * 3.6);
      });
      currentMinuteY += 2;
    }

    if (data.transcription && data.transcription.trim().length > 15) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('EXTRACTO DE TRANSCRIPCIÓN DEL AUDIO PRESENCIAL REGISTRADO:', margin + 4, currentMinuteY);
      currentMinuteY += 3.5;

      const rawTranscriptSnippet = data.transcription.trim();
      const snippetToPrint = rawTranscriptSnippet.length > 250 ? rawTranscriptSnippet.substring(0, 247) + '...' : rawTranscriptSnippet;
      const splitTranscript = doc.splitTextToSize(`"${snippetToPrint}"`, contentWidth - 12);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(splitTranscript, margin + 4, currentMinuteY);
      currentMinuteY += (splitTranscript.length * 3.4);
    }

    y += minuteContentHeight + 5;
  }

  // 4. NOTAS Y ACUERDOS DE LA BITÁCORA MANUAL (si existen)
  if (data.meetingNotes && data.meetingNotes.trim()) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryColor);
    doc.text('4. NOTAS Y ANOTACIONES DE BITÁCORA', margin, y);

    y += 3;
    const splitNotes = doc.splitTextToSize(data.meetingNotes.trim(), contentWidth - 8);
    const notesHeight = Math.max(12, (splitNotes.length * 4) + 6);

    doc.setFillColor(254, 252, 232); // Fondo cálido muy sutil #fefce8
    doc.setDrawColor(254, 240, 138);
    doc.roundedRect(margin, y, contentWidth, notesHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...darkTextColor);
    doc.text(splitNotes, margin + 4, y + 5);

    y += notesHeight + 5;
  }

  // 5. REGISTRO DE ASISTENCIA Y HORAS ACREDITADAS (TABLA)
  if (y > pageHeight - 55) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('5. LISTA DE ALUMNOS PARTICIPANTES Y HORAS ACREDITADAS', margin, y);
  y += 2;

  const attendanceRows = data.participants.map((p, idx) => {
    const statusLabel = p.status === 'late' ? 'Retardo' : p.status === 'excused' ? 'Falta Just.' : 'Presente';
    const hoursFormatted = `${p.hours || 0} hrs`;
    const scheduleStr = (p.startTime && p.endTime) ? `${p.startTime} - ${p.endTime}` : `${data.startTime} - ${data.endTime}`;
    return [
      String(idx + 1),
      p.name || 'Alumno',
      p.career || p.studentId || '—',
      scheduleStr,
      statusLabel,
      hoursFormatted
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Nombre del Prestador', 'Carrera / Matrícula', 'Horario', 'Estatus', 'Horas']],
    body: attendanceRows.length > 0 ? attendanceRows : [['—', 'Sin participantes registrados', '—', '—', '—', '0 hrs']],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: darkTextColor,
      cellPadding: 1.8
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // 6. SEGUIMIENTO DE TAREAS E HITOS ABORDADOS
  if (data.tasks && data.tasks.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryColor);
    doc.text('6. TAREAS E HITOS DEL PROYECTO ABORDADOS', margin, y);
    y += 2;

    const taskStatusMap: Record<string, string> = {
      'done': 'Finalizada (Done)',
      'working_on_it': 'En Progreso',
      'todo': 'Por Iniciar',
      'stuck': 'Bloqueada',
      'review': 'En Revisión'
    };

    const taskRows = data.tasks.slice(0, 10).map((t, idx) => {
      const typeLabel = t.isMilestone ? 'HITO CLAVE' : 'Tarea Regular';
      const statusLabel = taskStatusMap[t.status] || t.status;
      const assigneesStr = (t.assignees && t.assignees.length > 0) ? t.assignees.join(', ') : 'Equipo';
      return [
        String(idx + 1),
        t.title,
        typeLabel,
        statusLabel,
        assigneesStr
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Título de la Tarea / Entregable', 'Tipo', 'Estado Kanban', 'Responsable(s)']],
      body: taskRows,
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105], // Slate 600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: 1.8
      },
      bodyStyles: {
        fontSize: 7,
        textColor: darkTextColor,
        cellPadding: 1.6
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 40 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Comprobar si cabe la sección de firmas o si agregamos página
  if (y > pageHeight - 48) {
    doc.addPage();
    y = 25;
  }

  // Enlace de evidencia digital si se proporcionó
  if (data.evidenceUrl && data.evidenceUrl.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryColor);
    doc.text('ENLACE DE EVIDENCIA DIGITAL / REPOSITORIO:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235); // Azul enlace
    const truncatedUrl = data.evidenceUrl.length > 80 ? data.evidenceUrl.substring(0, 77) + '...' : data.evidenceUrl;
    doc.text(truncatedUrl, margin + 65, y);
    y += 8;
  }

  // 7. FIRMAS INSTITUCIONALES DE VALIDACIÓN
  y = Math.max(y + 4, pageHeight - 38);

  const colWidth = (contentWidth - 16) / 2;
  const lineY = y + 14;

  // Firma Coordinador
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(margin + 5, lineY, margin + 5 + colWidth, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkTextColor);
  doc.text(data.coordinatorName || 'Coordinador del Proyecto', margin + 5 + (colWidth / 2), lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...mutedTextColor);
  doc.text('Responsable de Seguimiento y Validación', margin + 5 + (colWidth / 2), lineY + 7.5, { align: 'center' });

  // Firma / Sello Servicio Social
  const sign2X = margin + 5 + colWidth + 16;
  doc.line(sign2X, lineY, sign2X + colWidth, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkTextColor);
  doc.text('Coordinación de Servicio Social', sign2X + (colWidth / 2), lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...mutedTextColor);
  doc.text('Sello y Registro en Expediente Único', sign2X + (colWidth / 2), lineY + 7.5, { align: 'center' });

  // Pie de página en todas las páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento oficial probatorio de Servicio Social Universitario · Generado automáticamente vía Sistema de Asistencia Prestadores`,
      margin,
      pageHeight - 6
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // Guardar y descargar el archivo PDF
  const cleanProjectName = (data.projectName || 'Proyecto').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Reporte_Sesion_${cleanProjectName}_${data.date}.pdf`;
  doc.save(filename);
}

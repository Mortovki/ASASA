export const safeFormatDate = (dateStr: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  try {
    if (!dateStr || dateStr.includes('NaN')) return 'Fecha Inválida';
    // Use local midnight to avoid off-by-one day errors
    const date = new Date(`${dateStr.split('T')[0]}T00:00:00`);
    if (isNaN(date.getTime())) return 'Fecha Inválida';
    return date.toLocaleDateString('es-ES', options);
  } catch (e) {
    return 'Fecha Inválida';
  }
};

export const toLocalISOString = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(`${dateStr.split('T')[0]}T00:00:00`).toISOString();
};

export function formatName(firstName: string = '', lastName: string = ''): string {
  if (!firstName) return 'Sin asignar';
  const initial = lastName ? ` ${lastName.charAt(0)}.` : '';
  return `${firstName}${initial}`;
}

export function formatFullName(fullName?: string): string {
  if (!fullName || fullName === 'Usuario' || fullName === 'Sistema') return fullName || 'Usuario';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1]; // Use last part as last name
  return `${firstName} ${lastName.charAt(0)}.`;
}

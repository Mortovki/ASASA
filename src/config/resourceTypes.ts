export type ResourceType = 
  | 'drive'
  | 'canva' 
  | 'onedrive' 
  | 'youtube' 
  | 'link';

export const RESOURCE_ICONS: Record<ResourceType, {
  bg: string;
  color: string;
  logo: string | null;
  label: string;
}> = {
  drive:    { bg: 'bg-emerald-50', color: 'text-emerald-600', logo: 'https://cdn.simpleicons.org/googledrive/34A853', label: 'Google Drive' },
  canva:    { bg: 'bg-violet-50', color: 'text-violet-600', logo: 'https://upload.wikimedia.org/wikipedia/en/b/bb/Canva_Logo.svg',        label: 'Canva' },
  onedrive: { bg: 'bg-sky-50',    color: 'text-sky-600',    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Microsoft_Office_OneDrive_%282019%E2%80%932025%29.svg', label: 'OneDrive' },
  youtube:  { bg: 'bg-red-50',    color: 'text-red-600',    logo: 'https://cdn.simpleicons.org/youtube/FF0000',     label: 'YouTube' },
  link:     { bg: 'bg-indigo-50', color: 'text-indigo-600', logo: null,                  label: 'Enlace' },
};

export function detectResourceType(url: string): ResourceType {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('drive.google.com'))  return 'drive';
  if (lowerUrl.includes('canva.com'))         return 'canva';
  if (lowerUrl.includes('onedrive.live.com') || lowerUrl.includes('sharepoint.com')) return 'onedrive';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  
  return 'link';
}

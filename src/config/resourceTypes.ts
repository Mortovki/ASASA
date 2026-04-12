export type ResourceType = 
  | 'drive' 
  | 'docs' 
  | 'sheets' 
  | 'canva' 
  | 'onedrive' 
  | 'figma' 
  | 'notion' 
  | 'youtube' 
  | 'github' 
  | 'link';

export const RESOURCE_ICONS: Record<ResourceType, {
  bg: string;
  color: string;
  logo: string | null;
  label: string;
}> = {
  drive:    { bg: 'bg-blue-50',   color: 'text-blue-600',   logo: '/logos/gdrive.svg',   label: 'Google Drive' },
  docs:     { bg: 'bg-blue-50',   color: 'text-blue-700',   logo: '/logos/gdocs.svg',    label: 'Google Docs' },
  sheets:   { bg: 'bg-green-50',  color: 'text-green-700',  logo: '/logos/gsheets.svg',  label: 'Google Sheets' },
  canva:    { bg: 'bg-violet-50', color: 'text-violet-600', logo: '/logos/canva.svg',    label: 'Canva' },
  onedrive: { bg: 'bg-sky-50',    color: 'text-sky-600',    logo: '/logos/onedrive.svg', label: 'OneDrive' },
  figma:    { bg: 'bg-pink-50',   color: 'text-pink-600',   logo: '/logos/figma.svg',    label: 'Figma' },
  notion:   { bg: 'bg-gray-100',  color: 'text-gray-700',   logo: '/logos/notion.svg',   label: 'Notion' },
  youtube:  { bg: 'bg-red-50',    color: 'text-red-600',    logo: '/logos/youtube.svg',  label: 'YouTube' },
  github:   { bg: 'bg-gray-100',  color: 'text-gray-800',   logo: '/logos/github.svg',   label: 'GitHub' },
  link:     { bg: 'bg-gray-50',   color: 'text-gray-500',   logo: null,                  label: 'Enlace' },
};

export function detectResourceType(url: string): ResourceType {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('drive.google.com'))  return 'drive';
  if (lowerUrl.includes('docs.google.com/document')) return 'docs';
  if (lowerUrl.includes('docs.google.com/spreadsheets')) return 'sheets';
  if (lowerUrl.includes('canva.com'))         return 'canva';
  if (lowerUrl.includes('onedrive.live.com') || lowerUrl.includes('sharepoint.com')) return 'onedrive';
  if (lowerUrl.includes('figma.com'))         return 'figma';
  if (lowerUrl.includes('notion.so'))         return 'notion';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('github.com'))        return 'github';
  return 'link';
}

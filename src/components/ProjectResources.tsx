import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  ExternalLink, 
  Copy, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  FolderOpen,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useResources, ProjectResource, ResourceType } from '../hooks/useResources';
import { RESOURCE_ICONS } from '../config/resourceTypes';
import { useBreakpoint } from '../hooks/useBreakpoint';
import toast from 'react-hot-toast';
import { ConfirmModal } from './ui/ConfirmModal';
import { AddResourceModal } from './AddResourceModal';

export function ProjectResources({ projectId, permissions, isDarkMode }: any) {
  const { 
    resources, 
    loading, 
    addResource, 
    updateResource, 
    updateLastAccessed, 
    deleteResource,
    reorderResources
  } = useResources(projectId);
  
  const [filter, setFilter] = useState<ResourceType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ProjectResource | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const { isMobile, isDesktop } = useBreakpoint();

  const filtered = useMemo(() => {
    return resources.filter(r => {
      const matchesFilter = filter === 'all' || r.type === filter;
      const matchesSearch = (r.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                           (r.description || '').toLowerCase().includes((searchQuery || '').toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [resources, filter, searchQuery]);

  const presentTypes = useMemo(() => {
    return [...new Set(resources.map(r => r.type))];
  }, [resources]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Enlace copiado al portapapeles');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('resourceIndex', index.toString());
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('resourceIndex'));
    if (sourceIndex === targetIndex) return;

    const newOrder = [...resources];
    const [movedItem] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, movedItem);
    
    try {
      await reorderResources(newOrder);
    } catch (error) {
      console.error("Error reordering resources:", error);
      toast.error('Error al reordenar recursos');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-20 rounded-2xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-4 lg:p-6 min-h-full rounded-2xl ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recursos del Proyecto</h2>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Links y documentos externos del equipo</p>
        </div>
        {permissions.canEditProject && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={18} />
            Agregar recurso
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 w-full md:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
              filter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : isDarkMode 
                  ? 'bg-white/5 text-gray-400 border-white/10 hover:border-indigo-500/50' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            <LayoutGrid size={14} /> Todos ({resources.length})
          </button>
          {presentTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type as ResourceType)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
                filter === type
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : isDarkMode 
                    ? 'bg-white/5 text-gray-400 border-white/10 hover:border-indigo-500/50' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {RESOURCE_ICONS[type as ResourceType].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar recurso..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm font-medium outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:ring-indigo-500'}`}
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <FolderOpen size={48} className={isDarkMode ? 'text-gray-800' : 'text-slate-200'} mb-4 />
          <p className={`font-bold ${isDarkMode ? 'text-gray-600' : 'text-slate-500'}`}>No se encontraron recursos</p>
          {permissions.canEditProject && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-indigo-600 text-sm font-black uppercase tracking-widest hover:underline"
            >
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((resource, index) => (
            <ResourceItem 
              key={resource.id} 
              resource={resource} 
              index={index}
              onEdit={() => setEditingResource(resource)}
              onDelete={() => setResourceToDelete(resource.id)}
              onOpen={() => updateLastAccessed(resource.id)}
              canEdit={permissions.canEditProject}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      )}

      {(showAddModal || editingResource) && (
        <AddResourceModal 
          projectId={projectId}
          resource={editingResource}
          onClose={() => {
            setShowAddModal(false);
            setEditingResource(null);
          }}
          addResource={addResource}
          updateResource={updateResource}
          isDarkMode={isDarkMode}
        />
      )}

      <ConfirmModal
        isOpen={!!resourceToDelete}
        onClose={() => setResourceToDelete(null)}
        onConfirm={() => {
          if (resourceToDelete) deleteResource(resourceToDelete);
        }}
        title="¿Eliminar Recurso?"
        message="¿Estás seguro de que deseas eliminar este recurso? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

function ResourceItem({ 
  resource, 
  index, 
  onEdit, 
  onDelete, 
  onOpen, 
  canEdit,
  onDragStart,
  onDrop,
  isDarkMode
}: any) {
  const iconConfig = RESOURCE_ICONS[resource.type as ResourceType];
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div 
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, index)}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 hover:border-indigo-500/50 hover:shadow-indigo-500/5' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
    >
      {canEdit && (
        <div className={`cursor-grab active:cursor-grabbing transition-colors ${isDarkMode ? 'text-gray-700 hover:text-gray-600' : 'text-slate-300 hover:text-slate-500'}`}>
          <GripVertical size={20} />
        </div>
      )}

      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
        {iconConfig.logo ? (
          <img src={iconConfig.logo} alt={resource.type} className="w-6 h-6" />
        ) : (
          <LayoutGrid className={`w-6 h-6 ${iconConfig.color}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{resource.name}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-widest ${iconConfig.color}`}>
            {iconConfig.label}
          </span>
          <span className={isDarkMode ? 'text-gray-800' : 'text-slate-300'}>·</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
            Por {resource.addedByName}
          </span>
          {resource.lastAccessed && (
            <>
              <span className={isDarkMode ? 'text-gray-800' : 'text-slate-300'}>·</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                Visto: {new Date(resource.lastAccessed).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
        {resource.description && (
          <p className={`text-xs mt-1 line-clamp-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{resource.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300' : 'hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700'}`}
          title="Abrir"
        >
          <ExternalLink size={18} />
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(resource.url);
            toast.success('Copiado');
          }}
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-600 hover:text-gray-400' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600'}`}
          title="Copiar link"
        >
          <Copy size={18} />
        </button>
        {canEdit && (
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-600 hover:text-gray-400' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600'}`}
            >
              <MoreVertical size={18} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className={`absolute right-0 bottom-full mb-2 w-40 rounded-xl shadow-xl border p-1 z-20 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-100'}`}
                  >
                    <button
                      onClick={() => { onEdit(); setShowMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button
                      onClick={() => { onDelete(); setShowMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-400/10' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

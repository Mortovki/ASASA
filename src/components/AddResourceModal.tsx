import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, FileText, ExternalLink, Info, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectResource, ResourceType } from '../hooks/useResources';
import { RESOURCE_ICONS, detectResourceType } from '../config/resourceTypes';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface AddResourceModalProps {
  projectId: string;
  resource?: ProjectResource | null;
  onClose: () => void;
  addResource: (data: any) => Promise<void>;
  updateResource: (id: string, data: any) => Promise<void>;
  isDarkMode?: boolean;
}

export function AddResourceModal({ 
  projectId, 
  resource, 
  onClose, 
  addResource, 
  updateResource,
  isDarkMode
}: AddResourceModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    type: 'link' as ResourceType,
  });

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name,
        url: resource.url,
        description: resource.description || '',
        type: resource.type as ResourceType,
      });
    }
  }, [resource]);

  const handleUrlChange = (url: string) => {
    const type = detectResourceType(url);
    setFormData(prev => ({ ...prev, url, type }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) {
      toast.error('Nombre y URL son obligatorios');
      return;
    }

    setLoading(true);
    try {
      if (resource) {
        await updateResource(resource.id, formData);
        toast.success('Recurso actualizado');
      } else {
        await addResource({
          ...formData,
          addedBy: user?.uid,
          addedByName: user?.displayName || 'Usuario',
        });
        toast.success('Recurso agregado');
      }
      onClose();
    } catch (error) {
      console.error("Error saving resource:", error);
      toast.error('Error al guardar el recurso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${isDarkMode ? 'bg-black/70' : 'bg-slate-900/60'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-100'}`}
      >
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
          <div>
            <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {resource ? 'Editar Recurso' : 'Nuevo Recurso'}
            </h3>
            <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              {resource ? 'Actualiza los detalles del link' : 'Agrega un link externo al proyecto'}
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-600 hover:text-gray-400' : 'hover:bg-white text-slate-400 hover:text-slate-600'}`}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* URL Input */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              <LinkIcon size={14} /> URL del Recurso
            </label>
            <div className="relative">
              <input
                type="url"
                value={formData.url}
                onChange={e => handleUrlChange(e.target.value)}
                placeholder="https://..."
                className={`w-full pl-4 pr-12 py-3 border rounded-2xl text-sm font-medium outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500'}`}
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {formData.url && (
                  <div className={`p-1.5 rounded-lg ${RESOURCE_ICONS[formData.type].bg}`}>
                    {RESOURCE_ICONS[formData.type].logo ? (
                      <img src={RESOURCE_ICONS[formData.type].logo!} alt={formData.type} className="w-4 h-4" />
                    ) : (
                      <ExternalLink size={14} className={RESOURCE_ICONS[formData.type].color} />
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
              Detectado como: <span className="text-indigo-500">{RESOURCE_ICONS[formData.type].label}</span>
            </p>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              <FileText size={14} /> Nombre del Recurso
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Carpeta de Diseño, Documento de Requerimientos..."
              className={`w-full px-4 py-3 border rounded-2xl text-sm font-medium outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500'}`}
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              <Info size={14} /> Descripción (Opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="¿Para qué sirve este recurso?"
              rows={3}
              className={`w-full px-4 py-3 border rounded-2xl text-sm font-medium outline-none transition-all resize-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500'}`}
            />
          </div>

          {/* Type Selection (Manual Override) */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Tipo de Recurso</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(RESOURCE_ICONS) as ResourceType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type }))}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    formData.type === type 
                      ? (isDarkMode ? 'bg-indigo-500/20 border-indigo-500/50 shadow-sm' : 'bg-indigo-50 border-indigo-200 shadow-sm') 
                      : (isDarkMode ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 hover:border-slate-200')
                  }`}
                  title={RESOURCE_ICONS[type].label}
                >
                  {RESOURCE_ICONS[type].logo ? (
                    <img src={RESOURCE_ICONS[type].logo!} alt={type} className="w-5 h-5" />
                  ) : (
                    <LinkIcon size={16} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                  )}
                  <span className={`text-[8px] font-black uppercase tracking-tighter truncate w-full text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    {RESOURCE_ICONS[type].label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={18} />
                  {resource ? 'Guardar Cambios' : 'Agregar Recurso'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

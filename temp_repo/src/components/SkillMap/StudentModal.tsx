import React, { useState, useEffect } from 'react';
import { SkillMapUser, SkillRating } from '../../types/skills';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { SkillEditor } from '../SkillEditor';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<SkillMapUser>) => void;
  user?: SkillMapUser;
  isAdmin: boolean;
  currentUserId: string;
}

export function StudentModal({ isOpen, onClose, onSave, user, isAdmin, currentUserId }: StudentModalProps) {
  const [formData, setFormData] = useState<Partial<SkillMapUser>>({
    firstName: '',
    lastNamePaterno: '',
    lastNameMaterno: '',
    position: '',
    color: '#3b82f6',
    skillRatings: [],
    career: 'Arquitectura'
  });

  useEffect(() => {
    if (user) {
      setFormData(user);
    } else {
      setFormData({
        firstName: '',
        lastNamePaterno: '',
        lastNameMaterno: '',
        position: '',
        color: '#3b82f6',
        skillRatings: [],
        career: 'Arquitectura'
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {user ? 'Editar Prestador' : 'Nuevo Prestador'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Info */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Información Básica</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nombre(s)</label>
                  <input 
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={!isAdmin}
                    className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Ej. Juan"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Apellido Paterno</label>
                  <input 
                    type="text"
                    value={formData.lastNamePaterno}
                    onChange={e => setFormData({ ...formData, lastNamePaterno: e.target.value })}
                    disabled={!isAdmin}
                    className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Ej. Pérez"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rol / Posición</label>
                <input 
                  type="text"
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  disabled={!isAdmin}
                  className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="Ej. Estudiante Arquitectura - Urbanismo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Color de Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {['#f97316', '#3b82f6', '#437a22', '#da7101', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'].map(c => (
                    <button
                      key={c}
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Skill Editor */}
          <div className="space-y-6 flex flex-col h-full">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Habilidades</h3>
            <SkillEditor 
              skillRatings={formData.skillRatings || []}
              onChange={(newRatings) => setFormData({ ...formData, skillRatings: newRatings })}
              isDarkMode={true}
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 bg-black/20">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            Guardar Cambios
          </button>
        </div>
      </motion.div>
    </div>
  );
}

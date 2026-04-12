import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { SkillRating, SkillCategory } from '../types/skills';
import { SKILL_CATEGORIES } from '../constants/skills';

interface SkillEditorProps {
  skillRatings: SkillRating[];
  onChange: (newRatings: SkillRating[]) => void;
  isDarkMode?: boolean;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({ skillRatings = [], onChange, isDarkMode }) => {
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillValue, setNewSkillValue] = useState<number>(50);
  const [newSkillType, setNewSkillType] = useState<SkillCategory>('arquitectura');
  const [activeTab, setActiveTab] = useState<SkillCategory>('arquitectura');

  const placeholders: Record<SkillCategory, string> = {
    arquitectura: "Ej. diseño, normativa, construcción, accesibilidad",
    urbanismo: "Ej. análisis urbano, movilidad, planeación",
    paisaje: "Ej. plantas nativas, restauración ecológica",
    comunitario: "Ej. diagnóstico participativo, talleres",
    tecnica: "Ej. AutoCAD, Revit, QGIS",
    soft: "Ej. escucha activa, empatía, facilitación"
  };

  const handleAddSkill = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const name = newSkillName.trim();
    if (!name) return;
    if (skillRatings.length >= 20) {
      alert("Máximo 20 habilidades permitidas.");
      return;
    }
    if (skillRatings.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      alert("Esta habilidad ya existe.");
      return;
    }

    onChange([...skillRatings, { name, type: activeTab, value: newSkillValue }]);
    setNewSkillName('');
    setNewSkillValue(50);
  };

  const handleRemoveSkill = (name: string) => {
    onChange(skillRatings.filter(s => s.name !== name));
  };

  const handleUpdateValue = (name: string, value: number) => {
    onChange(skillRatings.map(s => s.name === name ? { ...s, value } : s));
  };

  const filteredSkills = skillRatings.filter(s => s.type === activeTab);

  return (
    <div className={`rounded-[2rem] border overflow-hidden flex flex-col h-full ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className={`p-6 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
        <h2 className={`text-xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Editor de<br className="hidden xl:block"/>skills</h2>
        <div className={`flex flex-wrap gap-1 p-1 rounded-2xl w-full xl:w-auto ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
          {SKILL_CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id as SkillCategory)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === cat.id ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-6 space-y-6 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder={placeholders[activeTab]} 
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAddSkill(e);
              }
            }}
            className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'}`}
          />
          <button 
            type="button"
            onClick={(e) => handleAddSkill(e)}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center sm:min-w-[100px] border-2 ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'}`}
          >
            <Plus size={18} className="mr-2 sm:hidden" />
            Agregar
          </button>
        </div>

        <div className="space-y-3 flex-1">
          {filteredSkills.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className={`text-center py-8 text-sm font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                No hay skills registradas en esta categoría.
              </p>
            </div>
          ) : (
            skillRatings.filter(s => s.type === activeTab).map((skill, index) => {
              const catColor = SKILL_CATEGORIES.find(c => c.id === skill.type)?.color || '#6366f1';
              return (
              <div key={`${skill.name}-${index}`} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{skill.name}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      {skill.value < 40 ? 'Básico' : skill.value < 70 ? 'Intermedio' : 'Experto'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                      {skill.value}%
                    </span>
                    <button 
                      type="button"
                      onClick={() => handleRemoveSkill(skill.name)}
                      className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-500 hover:bg-white/10 hover:text-red-400' : 'text-slate-400 hover:bg-slate-100 hover:text-red-500'}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={skill.value}
                    onChange={(e) => handleUpdateValue(skill.name, Number(e.target.value))}
                    className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}
                    style={{ accentColor: catColor }}
                  />
                </div>
              </div>
            )})
          )}
        </div>

        <div className={`p-5 rounded-xl text-sm ${isDarkMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-[#FFF9E5] text-[#92400E]'}`}>
          <strong>Nota:</strong> Máximo 20 habilidades en total.<br/>Las habilidades se reflejarán<br/>automáticamente en el mapa.
        </div>
      </div>
    </div>
  );
};

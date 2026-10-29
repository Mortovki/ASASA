import React, { useState } from 'react';
import { X, Sparkles, Check, Plus, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { ProjectTask, TaskPriority, TaskStatus } from '../../types/tasks';
import { createTask } from '../../services/taskService';
import toast from 'react-hot-toast';

interface AiTaskSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentUserId: string;
  currentUserName: string;
  isDarkMode: boolean;
}

interface SuggestedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  groupName: string;
  daysEstimate: number;
  selected: boolean;
}

export const AiTaskSuggestionsModal: React.FC<AiTaskSuggestionsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentUserId,
  currentUserName,
  isDarkMode
}) => {
  const [objective, setObjective] = useState('');
  const [stage, setStage] = useState('General');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!objective.trim()) {
      toast.error('Por favor escribe el objetivo o etapa del proyecto');
      return;
    }

    setIsLoading(true);
    setSuggestions([]);

    try {
      const ai = new GoogleGenAI({});
      const prompt = `Eres un coordinador experto en proyectos comunitarios, arquitectura, urbanismo y servicio social de la UNAM.
Genera un listado de entre 4 y 7 tareas claras, operativas y bien estructuradas para el siguiente proyecto:
Proyecto: "${projectName}"
Objetivo / Etapa: "${objective}"
Fase: "${stage}"

Para cada tarea proporciona:
- title: Nombre conciso y accionable de la tarea (máx 10 palabras)
- description: Breve descripción de qué debe entregar o realizar el prestador
- priority: 'baja', 'media' o 'alta'
- groupName: 'Pendientes' o fase sugerida
- daysEstimate: Días estimados de duración (ej. 3, 5, 7)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'Lista de tareas sugeridas',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['baja', 'media', 'alta'] },
                groupName: { type: Type.STRING },
                daysEstimate: { type: Type.NUMBER }
              },
              required: ['title', 'description', 'priority', 'groupName', 'daysEstimate']
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '[]');
      const formatted: SuggestedTask[] = (parsed || []).map((t: any) => ({
        title: t.title || 'Nueva tarea',
        description: t.description || '',
        priority: (['baja', 'media', 'alta'].includes(t.priority) ? t.priority : 'media') as TaskPriority,
        groupName: t.groupName || 'Pendientes',
        daysEstimate: Number(t.daysEstimate) || 3,
        selected: true
      }));

      setSuggestions(formatted);
      if (formatted.length === 0) {
        toast('No se generaron tareas. Intenta reformular el objetivo.', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      console.error('Error generating AI tasks:', error);
      toast.error(`Error al generar sugerencias: ${error.message || 'Desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySelected = async () => {
    const toCreate = suggestions.filter(s => s.selected);
    if (toCreate.length === 0) {
      toast.error('Selecciona al menos una tarea para agregar');
      return;
    }

    setIsApplying(true);
    const today = new Date();
    try {
      for (const item of toCreate) {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + item.daysEstimate);
        const dueStr = dueDate.toISOString().split('T')[0];
        const startStr = today.toISOString().split('T')[0];

        await createTask({
          projectId,
          projectName,
          groupId: 'pendientes',
          groupName: item.groupName || 'Pendientes',
          title: item.title,
          description: item.description,
          assigneeIds: [],
          status: 'no_iniciado',
          priority: item.priority,
          startDate: startStr,
          endDate: dueStr,
          dueDate: dueStr,
          createdBy: currentUserId,
          createdByName: currentUserName,
          updatedBy: currentUserId
        });
      }

      toast.success(`${toCreate.length} tareas agregadas al tablero`);
      onClose();
    } catch (err) {
      toast.error('Error al guardar tareas');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase tracking-tight">Sugerencias de IA</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white">Nuevo</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Desglose inteligente de objetivos para {projectName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-200 text-slate-500'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objetivo o Entrega Clave</label>
            <input 
              type="text" 
              placeholder="Ej. Diagnóstico participativo en campo y levantamiento fotográfico" 
              value={objective}
              onChange={e => setObjective(e.target.value)}
              className={`w-full p-3.5 rounded-2xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div className="flex gap-2">
            {['Diagnóstico', 'Diseño', 'Ejecutivo', 'Gestión'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStage(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stage === st
                    ? 'bg-indigo-600 text-white shadow'
                    : (isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !objective.trim()}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>{isLoading ? 'Analizando con Gemini...' : 'Generar tareas sugeridas'}</span>
          </button>

          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">
                  Tareas propuestas ({suggestions.filter(s => s.selected).length}/{suggestions.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allSel = suggestions.every(s => s.selected);
                    setSuggestions(prev => prev.map(s => ({ ...s, selected: !allSel })));
                  }}
                  className="text-xs text-indigo-500 font-bold"
                >
                  {suggestions.every(s => s.selected) ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              </div>

              <div className="space-y-2">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      item.selected
                        ? (isDarkMode ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-indigo-50 border-indigo-200')
                        : (isDarkMode ? 'bg-white/5 border-white/5 opacity-60' : 'bg-slate-50 border-slate-200 opacity-60')
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                      item.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {item.selected && <Check size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-black uppercase truncate">{item.title}</h4>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">~{item.daysEstimate} días</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className={`p-4 border-t flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
            <span className="text-xs text-slate-400">
              {suggestions.filter(s => s.selected).length} seleccionadas
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplySelected}
                disabled={isApplying || suggestions.filter(s => s.selected).length === 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow flex items-center gap-2 disabled:opacity-50"
              >
                {isApplying ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>Agregar al tablero</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

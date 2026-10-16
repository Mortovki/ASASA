import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, ExternalLink, Plus, Edit2, Save, Trash2, X, PlayCircle, ChevronRight, Search, MoreHorizontal, Copy, Download, Pencil, AlertTriangle, Sparkles, Layers, Play } from 'lucide-react';
import { ConfirmModal } from './ui/ConfirmModal';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, collectionGroup } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { handleFirestoreError, OperationType } from '../firebase';

const ProjectDirectory = ({ projects, setProjects, userRole, selectedProjectId, userProfile, onUpdateProfile, onOpenWorkspace, onDeleteProject, isDarkMode }: any) => {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<{ [key: string]: boolean }>({});
  const [projectTasks, setProjectTasks] = useState<{ [key: string]: any[] }>({});
  const projectRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { isMobile, isTablet } = useBreakpoint();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksSnapshot = await getDocs(collectionGroup(db, 'tasks'));
        const tasksByProject: { [key: string]: any[] } = {};
        tasksSnapshot.forEach(doc => {
          const task = doc.data();
          const projectId = task.projectId;
          if (projectId) {
            if (!tasksByProject[projectId]) {
              tasksByProject[projectId] = [];
            }
            tasksByProject[projectId].push(task);
          }
        });
        setProjectTasks(tasksByProject);
      } catch (error) {
        console.error("Error fetching tasks for projects:", error);
        handleFirestoreError(error, OperationType.GET, 'collectionGroup/tasks');
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    if (selectedProjectId && projectRefs.current[selectedProjectId]) {
      projectRefs.current[selectedProjectId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedProjectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.project-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const enrolledProjectIds = userProfile?.projectIds || [];
  // Filtrar únicamente los documentos donde isDeleted no sea verdadero (excluir isDeleted === true)
  const displayProjects = (projects || []).filter((p: any) => {
    if (p.isDeleted === true) return false;
    const matchesSearch = (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const isEnrolled = enrolledProjectIds.includes(p.id);
    const isAdminOrCoordinator = userRole === 'admin' || userRole === 'coordinator';
    return matchesSearch && (isAdminOrCoordinator || isEnrolled);
  });

  const handleEnroll = async (projectId: string) => {
    if (userRole === 'user') {
      toast.error('No tienes permiso para realizar esta acción');
      return;
    }
    if (!userProfile || !onUpdateProfile) return;
    
    const currentProjectIds = userProfile.projectIds || [];
    const isEnrolled = currentProjectIds.includes(projectId);
    
    let newProjectIds;
    if (isEnrolled) {
      newProjectIds = currentProjectIds.filter((id: string) => id !== projectId);
      toast.success('Has abandonado el proyecto');
    } else {
      newProjectIds = [...currentProjectIds, projectId];
      toast.success('Te has unido al proyecto');
    }
    
    onUpdateProfile({
      ...userProfile,
      projectIds: newProjectIds
    });
  };

  const handleEdit = (project: any) => {
    setEditingProjectId(project.id);
    setEditData(JSON.parse(JSON.stringify(project))); // Deep copy to avoid mutating original state directly
  };

  const handleSave = async () => {
    try {
      const projectRef = doc(db, 'projects', editingProjectId!);
      await setDoc(projectRef, editData, { merge: true });
      setProjects(projects.map((p: any) => p.id === editingProjectId ? editData : p));
      setEditingProjectId(null);
      setEditData(null);
      toast.success('Proyecto actualizado');
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error('Error al actualizar proyecto');
      const { handleFirestoreError, OperationType } = await import('../firebase');
      handleFirestoreError(error, OperationType.UPDATE, `projects/${editingProjectId}`);
    }
  };

  const [isLoadingExample, setIsLoadingExample] = useState(false);

  const loadExampleProject = async () => {
    setIsLoadingExample(true);
    const toastId = toast.loading('Cargando proyecto completo de 6 fases...');
    try {
      const { saveCompleteSampleProjectToFirestore, generateCompleteSampleProject } = await import('../utils/sampleProjectGenerator');
      const sample = generateCompleteSampleProject();
      const newProjectId = await saveCompleteSampleProjectToFirestore(userRole || 'admin');
      
      // Add to local state
      setProjects((prev: any[]) => {
        const filtered = prev.filter(p => p.id !== newProjectId);
        return [sample.project, ...filtered];
      });
      
      toast.success('¡Proyecto de 6 fases interdependientes cargado con éxito!', { id: toastId });
      
      // Open workspace directly
      if (onOpenWorkspace) {
        onOpenWorkspace(newProjectId);
      }
    } catch (error) {
      console.error("Error loading example project:", error);
      toast.error('Error al cargar proyecto de ejemplo', { id: toastId });
    } finally {
      setIsLoadingExample(false);
    }
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 ${isTablet ? 'max-w-6xl mx-auto' : ''}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
        <div className="space-y-1">
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Directorio de Proyectos</h2>
          <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Gestión y Seguimiento de Iniciativas</p>
        </div>
        <div className="flex flex-col xs:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48 md:w-64 lg:w-72 group">
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-gray-600 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
            <input 
              type="text"
              placeholder="Buscar proyecto..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
            />
          </div>
          <button 
            onClick={loadExampleProject}
            disabled={isLoadingExample}
            className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
            title="Cargar proyecto completo de 6 fases con interdependencias, barras resumen en Gantt y ruta crítica"
          >
            <Sparkles size={18} /> <span>Cargar Ejemplo (6 Fases)</span>
          </button>
          {(userRole === 'admin' || userRole === 'coordinator') && (
            <button 
              onClick={() => {
                const newProjectId = `p-${Date.now()}`;
                const newProject = {
                  id: newProjectId,
                  name: 'Nuevo Proyecto',
                  color: '#6366f1',
                  description: '',
                  isDeleted: false,
                  deletedAt: null,
                  createdAt: new Date().toISOString(),
                  createdBy: userRole
                };
                setProjects([...projects, newProject]);
                setDoc(doc(db, 'projects', newProjectId), newProject);
                toast.success('Proyecto creado');
              }}
              className="w-full sm:w-auto bg-indigo-600 text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus size={18} /> <span className={isTablet ? 'hidden md:inline' : 'inline'}>Nuevo Proyecto</span>
              {isTablet && <span className="md:hidden">Nuevo</span>}
            </button>
          )}
        </div>
      </div>

      {/* Banner destacado para visualizar interdependencia de fases */}
      <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isDarkMode ? 'bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border-indigo-500/20' : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border-indigo-200/70 shadow-sm'}`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`text-sm sm:text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Proyecto de Ejemplo: Complejo Bioclimático y Regeneración Urbana
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                6 Fases Interdependientes • CPM • Gantt
              </span>
            </div>
            <p className={`text-xs mt-1 max-w-3xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Demuestra la interdependencia total entre fases: desde estudios preliminares hasta certificación y entrega. Incluye barras resumen en Gantt, cálculo de Ruta Crítica (CPM) de etapas y tareas, y holguras.
            </p>
          </div>
        </div>
        <button
          onClick={loadExampleProject}
          disabled={isLoadingExample}
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 transition-all active:scale-95 shrink-0 whitespace-nowrap disabled:opacity-50"
        >
          <Play size={16} /> Cargar Proyecto Completo
        </button>
      </div>
      {displayProjects.length === 0 ? (
        <div className={`text-center py-10 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'}`}>
          <p className={`font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
            {searchQuery ? "No se encontraron proyectos con ese nombre" : "No estás enrolado en ningún proyecto actualmente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {displayProjects.map((project: any) => (
            <div 
              key={project.id} 
              ref={el => { projectRefs.current[project.id] = el; }}
              className={`p-5 sm:p-6 rounded-3xl shadow-sm border transition-all duration-300 flex flex-col justify-between overflow-hidden min-h-[19rem] sm:min-h-[20rem] ${selectedProjectId === project.id ? 'border-indigo-500 ring-4 ring-indigo-500/20' : (isDarkMode ? 'bg-[#1a1a1a] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md')}`}
            >
              {editingProjectId === project.id ? (
                <div className="space-y-4 sm:space-y-6 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className={`text-lg font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}><Edit2 size={18} className="text-indigo-500"/> Editar Proyecto</h3>
                    <button onClick={() => setEditingProjectId(null)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100'}`}><X size={18} /></button>
                  </div>
                  
                  <div className={`p-4 rounded-2xl border flex-1 overflow-y-auto ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Color</label>
                      <input 
                        type="color" 
                        value={editData.color || '#6366f1'} 
                        onChange={e => setEditData({...editData, color: e.target.value})} 
                        className={`w-full h-10 p-1 border rounded-xl cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`} 
                      />
                    </div>
                    <div className="mt-4">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nombre</label>
                      <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-sm shadow-sm transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="mt-4">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Descripción</label>
                      <textarea value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm shadow-sm resize-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} rows={3} />
                    </div>
                  </div>

                  <div className={`mt-auto pt-4 border-t shrink-0 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/30">
                      <Save size={16} /> Guardar Cambios
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start gap-3 sm:gap-4 mb-3 shrink-0">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl shrink-0 mt-0.5 shadow-sm flex items-center justify-center text-white font-black text-xl" style={{ backgroundColor: project.color || '#6366f1' }}>
                        {project.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 
                          title={project.name}
                          className={`text-base sm:text-lg font-black break-words leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                          {project.name}
                        </h3>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                            {projectTasks[project.id]?.filter(t => t.status !== 'done' && !t.deletedAt).length || 0} tareas pendientes
                          </span>
                          {projectTasks[project.id]?.filter((t: any) => t.slack === 0 && t.status !== 'done' && !t.deletedAt).length > 0 && (
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                              · {projectTasks[project.id].filter((t: any) => t.slack === 0 && t.status !== 'done' && !t.deletedAt).length} críticas 🔴
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {userRole !== 'user' && (
                      <div className="relative project-menu-container">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                          }} 
                          className={`p-2 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50'}`}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openMenuId === project.id && (
                          <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border py-2 z-50 ${isDarkMode ? 'bg-[#2a2a2a] border-white/10' : 'bg-white border-slate-100'}`}>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                handleEdit(project); 
                                setOpenMenuId(null); 
                              }} 
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <Pencil size={14} /> Editar
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                const newProject = { 
                                  ...project, 
                                  id: `p-${Date.now()}`, 
                                  name: `${project.name} (Copia)`,
                                  isDeleted: false,
                                  deletedAt: null
                                };
                                setProjects([...projects, newProject]);
                                setOpenMenuId(null); 
                              }} 
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <Copy size={14} /> Duplicar
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href",     dataStr);
                                downloadAnchorNode.setAttribute("download", project.name + ".json");
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                                setOpenMenuId(null); 
                              }} 
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <Download size={14} /> Exportar
                            </button>
                            <div className={`h-px my-1 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}></div>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                setProjectToDelete(project.id);
                                setOpenMenuId(null);
                              }} 
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 font-medium ${isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 my-2">
                    <p className={`text-xs sm:text-sm line-clamp-4 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                      {project.description || "Sin descripción disponible."}
                    </p>
                  </div>

                  <div className={`mt-auto pt-4 border-t shrink-0 flex gap-2 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <button 
                      onClick={() => onOpenWorkspace(project.id)}
                      className={`flex-[2] px-4 py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group ${isDarkMode ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'}`}
                    >
                      Espacio de Trabajo 
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        <ConfirmModal
          isOpen={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          onConfirm={() => {
            if (projectToDelete) {
              onDeleteProject(projectToDelete);
              setProjectToDelete(null);
            }
          }}
          title="¿Eliminar Proyecto?"
          message="¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer y se eliminarán todas las tareas y recursos asociados."
          confirmText="Eliminar Proyecto"
          isDarkMode={isDarkMode}
        />
      </AnimatePresence>
    </div>
  );
};

export default ProjectDirectory;

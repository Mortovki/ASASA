import * as React from 'react';
import { Check, X, Clock, CheckCircle2, XCircle, Send, MessageSquare, ShieldAlert, CheckSquare, Square, Filter, User, Search, Calendar, MapPin, Activity, FileText, ExternalLink, Save, ChevronDown, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';
import { showSuccessToast, showErrorToast, showLoadingToast } from '../utils/toastUtils';
import toast from 'react-hot-toast';

const VALIDATION_STATUS = {
  'pendiente': { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  'aprobado': { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  'rechazado': { label: 'Rechazado', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
  'disputado': { label: 'Disputado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: MessageSquare },
};

const SUPER_ADMIN_EMAILS = ["luisedgar.gutierrez17@gmail.com", "luisedgar.gutierrez1@gmail.com"];

const toMins = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const AdminValidation = ({ students, setStudents, categories, projects, isDarkMode }: any) => {
  const [activeTab, setActiveTab] = React.useState<'pending' | 'disputed'>('pending');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [rejectingRecords, setRejectingRecords] = React.useState<any[]>([]);
  const [rejectReason, setRejectReason] = React.useState('');
  const [filterStudentId, setFilterStudentId] = React.useState<string>('all');
  const [filterDate, setFilterDate] = React.useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = React.useState<string>('all');
  const [filterProjectId, setFilterProjectId] = React.useState<string>('all');
  const [viewingRecord, setViewingRecord] = React.useState<any>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState<any>(null);

  // Pagination state
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStudentId, filterDate, filterCategoryId, filterProjectId, rowsPerPage]);

  React.useEffect(() => {
    if (isEditing && editFormData?.startTime && editFormData?.endTime) {
      const start = toMins(editFormData.startTime);
      const end = toMins(editFormData.endTime);
      if (end > start) {
        const calculatedHours = (end - start) / 60;
        if (calculatedHours !== Number(editFormData.hours)) {
          setEditFormData((prev: any) => ({ ...prev, hours: calculatedHours }));
        }
      }
    }
  }, [editFormData?.startTime, editFormData?.endTime, isEditing]);

  const toggleSelect = (e: React.MouseEvent, studentId: string, recordId: string) => {
    e.stopPropagation();
    const id = `${studentId}|${recordId}`;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = (records: any[]) => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => `${r.studentId}|${r.id}`));
    }
  };

  const handleApproveRecords = async (recordsToApprove: { studentId: string, recordId: string }[]) => {
    const loadingToast = showLoadingToast(recordsToApprove.length === 1 ? "Aprobando registro..." : `Aprobando ${recordsToApprove.length} registros...`);
    try {
      const batch = writeBatch(db);
      recordsToApprove.forEach(r => {
        const sessionRef = doc(db, 'sesiones', r.recordId);
        batch.update(sessionRef, {
          estado: 'aprobado',
          status: 'A',
          updatedBy: auth.currentUser?.uid
        });
      });
      
      await batch.commit();
      toast.dismiss(loadingToast);
      showSuccessToast(recordsToApprove.length === 1 ? "Registro aprobado" : `${recordsToApprove.length} registros aprobados`);
      setSelectedIds([]);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error approving sessions:", error);
      handleFirestoreError(error, OperationType.UPDATE, `bulk-validation`);
    }
  };

  const handleRejectRecords = async () => {
    if (rejectingRecords.length === 0 || !rejectReason.trim()) return;

    const loadingToast = showLoadingToast(rejectingRecords.length === 1 ? "Rechazando registro..." : `Rechazando ${rejectingRecords.length} registros...`);
    try {
      const batch = writeBatch(db);
      rejectingRecords.forEach(r => {
        const sessionRef = doc(db, 'sesiones', r.id);
        batch.update(sessionRef, {
          estado: 'rechazado',
          rejectReason: rejectReason,
          acknowledgedRejection: false,
          updatedBy: auth.currentUser?.uid
        });
      });

      await batch.commit();

      // Group notifications by student
      const studentsToNotify: any[] = [];
      rejectingRecords.forEach(r => {
        let student = studentsToNotify.find(s => s.id === r.studentId);
        if (!student) {
          student = { id: r.studentId, email: r.studentEmail, name: r.studentName, records: [] };
          studentsToNotify.push(student);
        }
        student.records.push(r);
      });

      studentsToNotify.forEach(student => {
        if (student.email) {
          const subject = encodeURIComponent("Registro de horas rechazado");
          const recordsList = student.records.map((r: any) => `- ${r.date}: ${r.hours}h ("${r.description}")`).join('\n');
          const body = encodeURIComponent(`Hola ${student.name},\n\nLos siguientes registros de horas han sido rechazados por el siguiente motivo:\n\n${rejectReason}\n\nRegistros afectados:\n${recordsList}\n\nPor favor revisa tu panel para más detalles.`);
          window.open(`mailto:${student.email}?subject=${subject}&body=${body}`, '_blank');
        }
      });

      toast.dismiss(loadingToast);
      showSuccessToast(rejectingRecords.length === 1 ? "Registro rechazado" : `${rejectingRecords.length} registros rechazados`);
      setRejectingRecords([]);
      setRejectReason('');
      setSelectedIds([]);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error rejecting sessions:", error);
      handleFirestoreError(error, OperationType.UPDATE, `bulk-rejection`);
    }
  };

  const pendingRecords = React.useMemo(() => {
    const records: any[] = [];
    students.forEach((s: any) => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return;
      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'pendiente') {
          records.push({ ...r, studentId: s.id, studentName: s.name, studentEmail: s.email });
        }
      });
    });
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [students]);

  const disputedRecords = React.useMemo(() => {
    const records: any[] = [];
    students.forEach((s: any) => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return;
      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'disputado') {
          records.push({ ...r, studentId: s.id, studentName: s.name, studentEmail: s.email });
        }
      });
    });
    return records.sort((a, b) => new Date(b.disputeDate || b.date).getTime() - new Date(a.disputeDate || a.date).getTime());
  }, [students]);

  const currentRecords = activeTab === 'pending' ? pendingRecords : disputedRecords;

  const filteredRecords = React.useMemo(() => {
    return currentRecords.filter(r => {
      const matchStudent = filterStudentId === 'all' || r.studentId === filterStudentId;
      const matchDate = !filterDate || r.date === filterDate;
      const matchCategory = filterCategoryId === 'all' || r.categoryId === filterCategoryId;
      const matchProject = filterProjectId === 'all' || r.projectId === filterProjectId;
      
      return matchStudent && matchDate && matchCategory && matchProject;
    });
  }, [currentRecords, filterStudentId, filterDate, filterCategoryId, filterProjectId]);

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const paginatedRecords = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  const uniqueStudents = React.useMemo(() => {
    const studentsMap = new Map();
    currentRecords.forEach(r => {
      if (!studentsMap.has(r.studentId)) {
        studentsMap.set(r.studentId, r.studentName);
      }
    });
    return Array.from(studentsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [currentRecords]);

  const handleUpdateRecord = async () => {
    if (!editFormData || !viewingRecord) return;
    
    const loadingToast = showLoadingToast("Actualizando registro...");
    try {
      const sessionRef = doc(db, 'sesiones', viewingRecord.id || viewingRecord.recordId);
      const updateData = {
        date: editFormData.date,
        hours: Number(editFormData.hours),
        startTime: editFormData.startTime || '09:00',
        endTime: editFormData.endTime || '13:00',
        projectId: editFormData.projectId,
        categoryId: editFormData.categoryId,
        description: editFormData.description,
        evidence: editFormData.evidence || '',
        updatedBy: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(sessionRef, updateData);
      
      // Update local state if needed (usually handled by listener, but if not:)
      if (setStudents) {
        setStudents((prev: any[]) => prev.map(s => {
          if (s.id === viewingRecord.studentId) {
            return {
              ...s,
              records: (s.records || []).map((r: any) => 
                (r.id === viewingRecord.id) ? { ...r, ...updateData } : r
              )
            };
          }
          return s;
        }));
      }

      toast.dismiss(loadingToast);
      showSuccessToast("Registro actualizado correctamente");
      setIsEditing(false);
      setViewingRecord({ ...viewingRecord, ...updateData });
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error updating session:", error);
      handleFirestoreError(error, OperationType.UPDATE, `session-${viewingRecord.id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="space-y-1">
          <h2 className={`text-4xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Validación de Horas</h2>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Gestiona y aprueba las horas registradas por los alumnos.</p>
        </div>
        
        <div className={`shrink-0 flex p-1 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-100 shadow-inner'}`}>
          <button 
            onClick={() => { setActiveTab('pending'); setSelectedIds([]); }}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? (isDarkMode ? 'bg-white/10 text-white shadow-xl' : 'bg-white text-slate-900 shadow-md') : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pendientes ({pendingRecords.length})
          </button>
          <button 
            onClick={() => { setActiveTab('disputed'); setSelectedIds([]); }}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'disputed' ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30') : 'text-slate-500 hover:text-slate-700'}`}
          >
            Disputas ({disputedRecords.length})
          </button>
        </div>
      </div>

      {/* Structured Filter Bar */}
      <div className={`p-6 rounded-[2rem] mb-8 border transition-all ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 px-1">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
              <Filter size={18} className="text-indigo-500" />
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>Filtros de Búsqueda</span>
          </div>
          
          {(filterDate || filterCategoryId !== 'all' || filterProjectId !== 'all' || filterStudentId !== 'all') && (
            <button 
              onClick={() => {
                setFilterStudentId('all');
                setFilterDate('');
                setFilterCategoryId('all');
                setFilterProjectId('all');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                isDarkMode 
                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' 
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-sm'
              }`}
            >
              <X size={14} /> Limpiar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Filter */}
          <div className="space-y-2">
            <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/50" />
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`w-full pl-11 pr-4 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none border transition-all appearance-none cursor-pointer ${
                  isDarkMode 
                    ? 'bg-[#121212] border-white/5 text-white focus:bg-white/10 focus:border-indigo-500/50' 
                    : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-500/5'
                }`}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Categoría</label>
            <div className="relative">
              <Activity size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/50" />
              <select 
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none border transition-all appearance-none cursor-pointer ${
                  isDarkMode 
                    ? 'bg-[#121212] border-white/5 text-white focus:bg-white/10 focus:border-indigo-500/50' 
                    : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-500/5'
                }`}
              >
                <option value="all">TODAS LAS CATEGORÍAS</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Project Filter */}
          <div className="space-y-2">
            <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Proyecto</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/50" />
              <select 
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e.target.value)}
                className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none border transition-all appearance-none cursor-pointer ${
                  isDarkMode 
                    ? 'bg-[#121212] border-white/5 text-white focus:bg-white/10 focus:border-indigo-500/50' 
                    : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-500/5'
                }`}
              >
                <option value="all">TODOS LOS PROYECTOS</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Student Filter */}
          <div className="space-y-2">
            <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Alumno</label>
            <div className="relative">
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/50" />
              <select 
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none border transition-all appearance-none cursor-pointer ${
                  isDarkMode 
                    ? 'bg-[#121212] border-white/5 text-white focus:bg-white/10 focus:border-indigo-500/50' 
                    : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-500/5'
                }`}
              >
                <option value="all">TODOS LOS ALUMNOS</option>
                {uniqueStudents.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className={`${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} p-6 rounded-[2rem] border shadow-sm`}>
        <div className="flex justify-between items-center mb-6 px-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => selectAll(filteredRecords)}
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {selectedIds.length === filteredRecords.length && filteredRecords.length > 0 ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} />}
              {selectedIds.length === filteredRecords.length && filteredRecords.length > 0 ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {selectedIds.length > 0 && (
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {selectedIds.length} seleccionados
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const toApprove = selectedIds.map(id => {
                    const [studentId, recordId] = id.split('|');
                    return { studentId, recordId };
                  });
                  handleApproveRecords(toApprove);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Check size={14} /> Aprobar
              </button>
              <button 
                onClick={() => {
                  const toReject = selectedIds.map(id => {
                    const [studentId, recordId] = id.split('|');
                    return currentRecords.find(r => r.studentId === studentId && r.id === recordId);
                  }).filter(Boolean);
                  setRejectingRecords(toReject);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2"
              >
                <X size={14} /> Rechazar
              </button>
            </div>
          )}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-gray-600' : 'bg-slate-50 text-slate-300'}`}>
              {activeTab === 'pending' ? <Clock size={32} /> : <ShieldAlert size={32} />}
            </div>
            <p className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              {filterStudentId !== 'all' || filterDate || filterCategoryId !== 'all' || filterProjectId !== 'all' ? 'No hay registros que coincidan con los filtros' : (activeTab === 'pending' ? 'No hay registros pendientes' : 'No hay disputas activas')}
            </p>
            {(filterStudentId !== 'all' || filterDate || filterCategoryId !== 'all' || filterProjectId !== 'all') && (
              <button 
                onClick={() => {
                  setFilterStudentId('all');
                  setFilterDate('');
                  setFilterCategoryId('all');
                  setFilterProjectId('all');
                }}
                className="mt-4 text-xs font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedRecords.map((r: any) => {
              const cat = categories.find((c: any) => c.id === r.categoryId);
              const proj = projects.find((p: any) => p.id === r.projectId);
              const isSelected = selectedIds.includes(`${r.studentId}|${r.id}`);
              
              return (
                <div 
                  key={`${r.studentId}-${r.id}`} 
                  onClick={() => {
                    setViewingRecord(r);
                    setIsEditing(false);
                    setEditFormData({ ...r });
                  }}
                  className={`p-6 border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all cursor-pointer group hover:scale-[1.01] active:scale-[0.99] ${
                    isSelected 
                      ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') 
                      : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:bg-slate-50 shadow-sm hover:shadow-md')
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                    <div 
                      onClick={(e) => toggleSelect(e, r.studentId, r.id)}
                      className={`w-6 h-6 rounded border flex items-center justify-center transition-all shrink-0 hover:scale-110 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : (isDarkMode ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-white')
                    }`}>
                      {isSelected && <Check size={14} />}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shrink-0 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                      {r.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.studentName}</p>
                        {r.studentEmail && (
                          <span className={`text-[9px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>({r.studentEmail})</span>
                        )}
                        {r.validationStatus === 'disputado' && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black uppercase rounded-full">Disputa</span>
                        )}
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{r.date} • {Number(r.hours.toFixed(2))}h • {cat?.name || 'Otra'} • {proj?.name || 'General'}</p>
                      <p className={`text-sm mt-1 break-words line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>"{r.description}"</p>
                      {r.validationStatus === 'disputado' && r.disputeReason && (
                        <div className={`mt-3 p-3 rounded-xl border text-xs italic ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                          <p className="font-black uppercase text-[8px] mb-1 not-italic tracking-widest">Justificación de Disputa:</p>
                          "{r.disputeReason}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handleApproveRecords([{ studentId: r.studentId, recordId: r.id }])} 
                      className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                      title="Aprobar"
                    >
                      <Check size={20} />
                    </button>
                    <button 
                      onClick={() => setRejectingRecords([r])} 
                      className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white' : 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white'}`}
                      title="Rechazar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
              <div className={`mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Registros por página</span>
                  <div className="relative">
                    <select 
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className={`pl-3 pr-8 py-1.5 rounded-lg text-xs font-black outline-none border transition-all appearance-none cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500/50' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-indigo-300'
                      }`}
                    >
                      {[10, 15, 20, 30, 50].map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    {Math.min(filteredRecords.length, (currentPage - 1) * rowsPerPage + 1)}-{Math.min(filteredRecords.length, currentPage * rowsPerPage)} de {filteredRecords.length}
                  </span>
                  
                  <div className="flex gap-2">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className={`p-2 rounded-xl transition-all border ${
                        currentPage === 1 
                          ? 'opacity-30 cursor-not-allowed' 
                          : (isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm')
                      }`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                              currentPage === pageNum
                                ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'bg-indigo-600 text-white shadow-md')
                                : (isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-50')
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className={`p-2 rounded-xl transition-all border ${
                        currentPage === totalPages 
                          ? 'opacity-30 cursor-not-allowed' 
                          : (isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm')
                      }`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Detail Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-[3rem] max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300`}>
            {/* Modal Header */}
            <div className={`px-10 py-8 border-b flex justify-between items-center ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-50 bg-slate-50/50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${isDarkMode ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                  {viewingRecord.studentName.charAt(0)}
                </div>
                <div>
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{viewingRecord.studentName}</h3>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{viewingRecord.studentEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className={`p-3 rounded-full transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:text-indigo-400' : 'bg-slate-100 text-slate-500 hover:text-indigo-600'}`}
                  >
                    <Edit2 size={20} />
                  </button>
                )}
                <button onClick={() => { setViewingRecord(null); setIsEditing(false); }} className={`p-3 rounded-full transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:text-red-400' : 'bg-slate-100 text-slate-500 hover:text-red-500'}`}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Date */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <Calendar size={12} /> Fecha
                  </label>
                  {isEditing ? (
                    <input 
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    />
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>{viewingRecord.date}</div>
                  )}
                </div>

                {/* Hora Inicio */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <Clock size={12} /> Hora Inicio
                  </label>
                  {isEditing ? (
                    <input 
                      type="time"
                      value={editFormData.startTime || '09:00'}
                      onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    />
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>{viewingRecord.startTime || '09:00'}</div>
                  )}
                </div>

                {/* Hora Fin */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <Clock size={12} /> Hora Fin
                  </label>
                  {isEditing ? (
                    <input 
                      type="time"
                      value={editFormData.endTime || '13:00'}
                      onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    />
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>{viewingRecord.endTime || '13:00'}</div>
                  )}
                </div>

                {/* Hours */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <Activity size={12} /> Total Horas
                  </label>
                  {isEditing ? (
                    <div className={`w-full p-4 border-2 rounded-2xl font-black bg-indigo-50/10 border-indigo-500/20 text-indigo-400 flex justify-between items-center ${isDarkMode ? '' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                      <span>{Number(editFormData.hours).toFixed(2)}h</span>
                      <span className="text-[8px] uppercase tracking-widest opacity-60">Calculado</span>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>{Number(viewingRecord.hours.toFixed(2))}h</div>
                  )}
                </div>

                {/* Project */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <MapPin size={12} /> Proyecto
                  </label>
                  {isEditing ? (
                    <select 
                      value={editFormData.projectId}
                      onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    >
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>
                      {projects.find((p: any) => p.id === viewingRecord.projectId)?.name || 'General'}
                    </div>
                  )}
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <Activity size={12} /> Categoría
                  </label>
                  {isEditing ? (
                    <select 
                      value={editFormData.categoryId}
                      onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    >
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>
                      {categories.find((c: any) => c.id === viewingRecord.categoryId)?.name || 'Otra'}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2 md:col-span-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <FileText size={12} /> Descripción
                  </label>
                  {isEditing ? (
                    <textarea 
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all resize-none h-32 ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    />
                  ) : (
                    <div className={`p-4 rounded-2xl border-2 font-black italic whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}>
                      "{viewingRecord.description}"
                    </div>
                  )}
                </div>

                {/* Evidence */}
                <div className="space-y-2 md:col-span-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} flex items-center gap-2`}>
                    <ExternalLink size={12} /> Evidencia
                  </label>
                  {isEditing ? (
                    <input 
                      type="url"
                      value={editFormData.evidence || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, evidence: e.target.value })}
                      placeholder="https://google.drive.com/..."
                      className={`w-full p-4 border-2 rounded-2xl font-black outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-300 focus:bg-white'}`}
                    />
                  ) : (
                    viewingRecord.evidence ? (
                      <a 
                        href={viewingRecord.evidence} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`block p-4 rounded-2xl border-2 border-dashed font-black flex items-center justify-between group transition-all ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10' : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-white'}`}
                      >
                        <span className="truncate">{viewingRecord.evidence}</span>
                        <ExternalLink size={16} className="shrink-0" />
                      </a>
                    ) : (
                      <div className={`p-4 rounded-2xl border-2 border-dashed font-black italic text-center ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                        Sin evidencia adjunta
                      </div>
                    )
                  )}
                </div>

                {/* Dispute Info */}
                {viewingRecord.validationStatus === 'disputado' && viewingRecord.disputeReason && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-indigo-500 flex items-center gap-2">
                      <MessageSquare size={12} /> Motivo de la Disputa (Enviado por alumno)
                    </label>
                    <div className={`p-4 rounded-2xl border-2 italic font-black ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                      "{viewingRecord.disputeReason}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-10 py-8 border-t flex gap-4 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-50 bg-slate-50/50'}`}>
              {isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Descartar Cambios
                  </button>
                  <button 
                    onClick={handleUpdateRecord}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                  >
                    <Save size={16} /> Guardar Cambios
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      const rec = viewingRecord;
                      setViewingRecord(null);
                      setRejectingRecords([rec]);
                    }}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white'}`}
                  >
                    <X size={16} /> Rechazar Horas
                  </button>
                  <button 
                    onClick={() => {
                      const rec = viewingRecord;
                      setViewingRecord(null);
                      handleApproveRecords([{ studentId: rec.studentId, recordId: rec.id }]);
                    }}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Aprobar Horas
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectingRecords.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {rejectingRecords.length === 1 ? 'Rechazar Registro' : `Rechazar ${rejectingRecords.length} Registros`}
              </h3>
              <button onClick={() => { setRejectingRecords([]); setRejectReason(''); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className={`p-4 rounded-2xl border max-h-40 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                {rejectingRecords.map((rec, idx) => (
                  <div key={idx} className={`${idx !== 0 ? 'mt-3 pt-3 border-t border-slate-200 dark:border-white/5' : ''}`}>
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{rec.studentName}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{rec.date} • {Number(rec.hours.toFixed(2))}h</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Motivo del Rechazo (Se enviará por correo)</label>
                <textarea 
                  className={`w-full p-4 border rounded-2xl font-bold outline-none transition-all text-sm shadow-inner resize-none h-32 ${
                    isDarkMode 
                      ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-rose-500/50' 
                      : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-rose-300'
                  }`}
                  placeholder="Explica por qué se rechazan estas horas..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setRejectingRecords([]); setRejectReason(''); }}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRejectRecords}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Enviar y Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

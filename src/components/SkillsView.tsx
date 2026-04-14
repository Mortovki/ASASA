import React, { useState, useMemo } from 'react';
import { Search, Filter, Mail, Phone, Tag, User as UserIcon, Edit2, Check, X, Briefcase, Plus } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../firebase';

interface UserProfile {
  id: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  email: string;
  phone?: string;
  career: string;
  skills: string[];
  role: string;
  status: string;
  studentId: string;
}

interface SkillsViewProps {
  users: UserProfile[];
  currentUserRole: string;
  currentUserId: string;
  projects: any[];
  isDarkMode?: boolean;
}

const SkillsView = ({ users, currentUserRole, currentUserId, projects, isDarkMode }: SkillsViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCareer, setSelectedCareer] = useState('Todas');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingSkills, setEditingSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'coordinator';

  const careers = useMemo(() => {
    const uniqueCareers = Array.from(new Set(users.map(u => u.career)));
    return ['Todas', ...uniqueCareers];
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const fullName = `${user.firstName} ${user.lastNamePaterno} ${user.lastNameMaterno}`.toLowerCase();
      const matchesSearch = fullName.includes((searchTerm || '').toLowerCase()) || 
                           (user.skills || []).some((s: any) => {
                             const skillStr = typeof s === 'string' ? s : (s.name || s.id || JSON.stringify(s));
                             return (skillStr || '').toLowerCase().includes((searchTerm || '').toLowerCase());
                           });
      const matchesCareer = selectedCareer === 'Todas' || user.career === selectedCareer;
      return matchesSearch && matchesCareer && user.role === 'user'; // Only show "prestadores"
    });
  }, [users, searchTerm, selectedCareer]);

  const handleStartEdit = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditingSkills(user.skills.map((s: any) => typeof s === 'string' ? s : (s.name || s.id || JSON.stringify(s))));
  };

  const handleSaveSkills = async (user: UserProfile) => {
    try {
      const userRef = doc(db, 'users', user.id);
      const updatedUser = { ...user, skills: editingSkills };
      await setDoc(userRef, updatedUser, { merge: true });
      
      // Sync to public_profiles
      const publicProfile = {
        firstName: user.firstName,
        lastNamePaterno: user.lastNamePaterno,
        lastNameMaterno: user.lastNameMaterno,
        career: user.career,
        skills: editingSkills,
        status: user.status,
        role: user.role,
        uid: user.id
      };
      await setDoc(doc(db, 'public_profiles', user.id), publicProfile, { merge: true });
      
      toast.success('Habilidades actualizadas');
      setEditingUserId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !editingSkills.includes(skillInput.trim())) {
      setEditingSkills([...editingSkills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setEditingSkills(editingSkills.filter(s => s !== skillToRemove));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-3xl sm:text-5xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Habilidades</h2>
          <p className={`font-medium mt-1 uppercase text-[9px] sm:text-[11px] tracking-[0.2em] italic ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Directorio de competencias de prestadores</p>
        </div>
      </div>

      <div className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border shadow-sm space-y-6 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o habilidad..." 
              className={`w-full pl-12 pr-4 py-4 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all ${isDarkMode ? 'bg-white/5 text-white placeholder:text-gray-600' : 'bg-slate-50 text-slate-900'}`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`} size={20} />
            <select 
              className={`w-full pl-12 pr-4 py-4 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer ${isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900'}`}
              value={selectedCareer}
              onChange={e => setSelectedCareer(e.target.value)}
            >
              {careers.map(c => <option key={c} value={c} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <div key={user.id} className={`p-6 rounded-[2.5rem] border flex flex-col gap-4 transition-all group relative overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl'}`}>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                    {user.firstName.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.firstName} {user.lastNamePaterno}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{user.career}</p>
                  </div>
                </div>
                {(isAdmin || currentUserId === user.id) && editingUserId !== user.id && (
                  <button 
                    onClick={() => handleStartEdit(user)}
                    className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-gray-500 hover:text-indigo-400 hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-4 relative z-10">
                <div className="flex flex-wrap gap-2">
                  {editingUserId === user.id ? (
                    <div className="w-full space-y-3">
                      <div className={`flex flex-wrap gap-2 p-3 rounded-2xl border shadow-inner min-h-[60px] ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                        {editingSkills.map((skill) => (
                          <span key={skill} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            {skill}
                            <button onClick={() => removeSkill(skill)} className="hover:text-red-500"><X size={12}/></button>
                          </span>
                        ))}
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Nueva habilidad..."
                            className={`flex-1 min-w-[100px] outline-none text-[10px] font-bold uppercase p-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-white placeholder:text-gray-600' : 'bg-slate-50 text-slate-900'}`}
                            value={skillInput}
                            onChange={e => setSkillInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSkill()}
                          />
                          <button 
                            onClick={addSkill}
                            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveSkills(user)}
                          className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                          <Check size={14} /> Guardar
                        </button>
                        <button 
                          onClick={() => setEditingUserId(null)}
                          className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {user.skills.length > 0 ? user.skills.map((skill: any, idx: number) => {
                        const skillName = typeof skill === 'string' ? skill : (skill.name || skill.id || JSON.stringify(skill));
                        return (
                          <span key={`${skillName}-${idx}`} className={`border px-3 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm flex items-center gap-1.5 ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <Tag size={10} className="text-indigo-400" /> {skillName}
                          </span>
                        );
                      }) : (
                        <p className={`text-[10px] font-black uppercase italic tracking-widest ${isDarkMode ? 'text-gray-700' : 'text-slate-300'}`}>Sin habilidades registradas</p>
                      )}
                    </>
                  )}
                </div>

                <div className={`pt-4 border-t flex items-center gap-4 ${isDarkMode ? 'border-white/5' : 'border-slate-200/50'}`}>
                  {user.email && (
                    <a href={`mailto:${user.email}`} className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
                      <Mail size={16} />
                    </a>
                  )}
                  {user.phone && (
                    <a href={`tel:${user.phone}`} className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}>
                      <Phone size={16} />
                    </a>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'En Curso' ? 'bg-emerald-500' : (isDarkMode ? 'bg-gray-700' : 'bg-slate-300')}`}></div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{user.status}</span>
                  </div>
                </div>
              </div>

              {/* Decorative background icon */}
              <Briefcase className={`absolute -bottom-4 -right-4 w-24 h-24 -rotate-12 group-hover:scale-110 transition-transform duration-500 ${isDarkMode ? 'text-white/5' : 'text-slate-200/20'}`} />
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-20">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Search className={isDarkMode ? 'text-gray-700' : 'text-slate-300'} size={32} />
            </div>
            <p className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>No se encontraron prestadores con esos criterios</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsView;

import React from 'react';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { SKILL_CATEGORIES } from '../../constants/skills';
import { Plus, Check, Filter, UserPlus, Settings } from 'lucide-react';

interface SidebarProps {
  users: SkillMapUser[];
  selectedUserIds: string[];
  toggleUser: (uid: string) => void;
  selectAll: () => void;
  activeCategories: SkillCategory[];
  toggleCategory: (catId: SkillCategory) => void;
  onAddClick: () => void;
  onEditUser: (user: SkillMapUser) => void;
  isAdmin: boolean;
  currentUserId: string;
  isDarkMode: boolean;
}

export function Sidebar({ 
  users, 
  selectedUserIds, 
  toggleUser, 
  selectAll, 
  activeCategories, 
  toggleCategory,
  onAddClick,
  onEditUser,
  isAdmin,
  currentUserId,
  isDarkMode
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <aside className={`${isOpen ? 'h-auto' : 'h-14'} lg:h-full w-full lg:w-72 border-b lg:border-b-0 lg:border-r flex flex-col overflow-hidden transition-all duration-300 ${
      isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200'
    }`}>
      <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
        isDarkMode ? 'border-white/10' : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-2 cursor-pointer lg:cursor-default" onClick={() => setIsOpen(!isOpen)}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Settings size={16} className="text-white" />
          </div>
          <span className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SkillMap</span>
          <div className="lg:hidden ml-2">
            <Filter size={14} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={onAddClick}
            className={`p-1.5 rounded-md transition-colors ${
              isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'
            }`}
            title="Nuevo prestador"
          >
            <UserPlus size={18} />
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-8 ${isOpen ? 'block' : 'hidden lg:block'}`}>
        {/* Prestadores Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Prestadores</h3>
            <button 
              onClick={selectAll}
              className="text-[10px] text-indigo-500 hover:text-indigo-600 font-black uppercase tracking-widest transition-colors"
            >
              Seleccionar todos
            </button>
          </div>
          <div className="space-y-1">
            {users.map(user => {
              const isSelected = selectedUserIds.includes(user.uid);
              return (
                <div
                  key={user.uid}
                  onClick={() => toggleUser(user.uid)}
                  className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? (isDarkMode ? 'bg-white/10' : 'bg-indigo-50 border border-indigo-100') 
                      : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50 border border-transparent')
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black text-white relative shadow-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.firstName[0]}{user.lastNamePaterno[0]}
                    {isSelected && (
                      <div className={`absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 ${isDarkMode ? 'border-[#121212]' : 'border-white shadow-sm'}`}>
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-tight truncate ${
                      isSelected 
                        ? (isDarkMode ? 'text-white' : 'text-indigo-600') 
                        : (isDarkMode ? 'text-gray-400 group-hover:text-gray-200' : 'text-slate-600 group-hover:text-slate-900')
                    }`}>
                      {user.firstName} {user.lastNamePaterno}
                    </p>
                    <p className={`text-[9px] font-bold truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{user.position}</p>
                  </div>
                  {(isAdmin || user.uid === currentUserId) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditUser(user);
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                        isDarkMode ? 'hover:bg-white/10 text-gray-500 hover:text-white' : 'hover:bg-indigo-100 text-slate-400 hover:text-indigo-600'
                      }`}
                    >
                      <Settings size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Categorías Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={12} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Categorías</h3>
          </div>
          <div className="space-y-2">
            {SKILL_CATEGORIES.map(cat => {
              const isActive = activeCategories.includes(cat.id as SkillCategory);
              return (
                <label 
                  key={cat.id} 
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleCategory(cat.id as SkillCategory)}
                      className="peer sr-only"
                    />
                    <div 
                      className={`w-4 h-4 rounded border transition-all ${
                        isActive 
                          ? 'border-transparent' 
                          : (isDarkMode ? 'border-gray-600 group-hover:border-gray-400' : 'border-slate-200 group-hover:border-slate-400 shadow-inner')
                      }`}
                      style={{ backgroundColor: isActive ? cat.color : 'transparent' }}
                    />
                    {isActive && <Check size={10} className="absolute text-white" />}
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-tight transition-colors ${
                    isActive 
                      ? (isDarkMode ? 'text-gray-200' : 'text-slate-700') 
                      : (isDarkMode ? 'text-gray-500 group-hover:text-gray-400' : 'text-slate-400 group-hover:text-slate-600')
                  }`}>
                    {cat.name}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <div className={`p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100 bg-slate-50/50'} ${isOpen ? 'block' : 'hidden lg:block'}`}>
        <p className={`text-[10px] font-bold text-center leading-relaxed ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
          Selecciona hasta 5 prestadores para comparar habilidades compartidas.
        </p>
      </div>
    </aside>
  );
}

import React, { useState, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { VennDiagram } from './VennDiagram';
import { BubbleChart } from './BubbleChart';
import { RadarChart } from './RadarChart';
import { SharedBars } from './SharedBars';
import { MatrixTable } from './MatrixTable';
import { StudentModal } from './StudentModal';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { SKILL_CATEGORIES } from '../../constants/skills';
import { Download, Info, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SkillMapProps {
  users: SkillMapUser[];
  onAddUser: (user: Partial<SkillMapUser>) => void;
  onUpdateUser: (userId: string, data: Partial<SkillMapUser>) => void;
  isAdmin: boolean;
  currentUserId: string;
  isDarkMode: boolean;
}

export function SkillMap({ users, onAddUser, onUpdateUser, isAdmin, currentUserId, isDarkMode }: SkillMapProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'conjuntos' | 'burbujas' | 'pares'>('conjuntos');
  const [activeCategories, setActiveCategories] = useState<SkillCategory[]>(
    SKILL_CATEGORIES.map(c => c.id as SkillCategory)
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SkillMapUser | undefined>();

  const selectedUsers = useMemo(() => 
    users.filter(u => selectedUserIds.includes(u.uid)),
    [users, selectedUserIds]
  );

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      if (prev.length >= 5) return prev;
      return [...prev, uid];
    });
  };

  const selectAll = () => {
    setSelectedUserIds(users.slice(0, 5).map(u => u.uid));
  };

  const toggleCategory = (catId: SkillCategory) => {
    setActiveCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const exportAsImage = () => {
    // Implementation for SVG/PNG export
    console.log('Exporting...');
  };

  return (
    <div className={`flex flex-col lg:flex-row h-full lg:h-[calc(100vh-64px)] overflow-hidden ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <Sidebar 
        users={users}
        selectedUserIds={selectedUserIds}
        toggleUser={toggleUser}
        selectAll={selectAll}
        activeCategories={activeCategories}
        toggleCategory={toggleCategory}
        onAddClick={() => {
          setEditingUser(undefined);
          setIsModalOpen(true);
        }}
        onEditUser={(user) => {
          setEditingUser(user);
          setIsModalOpen(true);
        }}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Header - More subtle for integration */}
        <header className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-4">
              <h1 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Vista de Análisis</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                {selectedUsers.length} prestadores
              </span>
            </div>
            
            {/* Export button moved to top row on mobile for better balance if needed, or keep it with tabs */}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex-1 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
              <div className={`flex rounded-lg p-1 shrink-0 snap-start ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                {[
                  { id: 'conjuntos', label: 'Conjuntos' },
                  { id: 'burbujas', label: 'Burbujas' },
                  { id: 'pares', label: 'Pares' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap snap-center ${
                      activeTab === tab.id 
                        ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                        : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={exportAsImage}
              className={`p-2 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
              title="Exportar"
            >
              <Download size={20} />
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className={`relative rounded-2xl border min-h-[400px] sm:min-h-[500px] flex flex-col transition-colors ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`p-4 flex items-center justify-between border-b ${
              isDarkMode ? 'border-white/5' : 'border-slate-100'
            }`}>
              <h2 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>
                {activeTab === 'conjuntos' && 'Diagrama de Conjuntos — habilidades compartidas'}
                {activeTab === 'burbujas' && 'Mapa de Burbujas — densidad de habilidades'}
                {activeTab === 'pares' && 'Análisis de Pares — comparación directa'}
              </h2>
              <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
                <Info size={14} />
                Cómo leer
              </button>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  {activeTab === 'conjuntos' && (
                    <VennDiagram 
                      users={selectedUsers} 
                      activeCategories={activeCategories}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  {activeTab === 'burbujas' && (
                    <BubbleChart 
                      users={selectedUsers} 
                      activeCategories={activeCategories}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  {activeTab === 'pares' && (
                    <RadarChart 
                      users={selectedUsers} 
                      activeCategories={activeCategories}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div className={`p-4 border-t flex flex-wrap gap-4 justify-center ${
              isDarkMode ? 'border-white/5' : 'border-slate-100 bg-slate-50/30'
            }`}>
              {SKILL_CATEGORIES.map(cat => (
                <div key={cat.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    {cat.name}
                  </span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-slate-300'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Única</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-white' : 'bg-indigo-500'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Compartida</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SharedBars users={selectedUsers} activeCategories={activeCategories} isDarkMode={isDarkMode} />
            <MatrixTable users={selectedUsers} activeCategories={activeCategories} isDarkMode={isDarkMode} />
          </div>
        </div>
      </main>

      {/* Modal */}
      <StudentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(data) => {
          if (editingUser) {
            onUpdateUser(editingUser.uid, data);
          } else {
            onAddUser(data);
          }
          setIsModalOpen(false);
        }}
        user={editingUser}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  );
}

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartContainer } from '../ChartContainer';
import { BarChart3, Info } from 'lucide-react';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { SKILL_CATEGORIES } from '../../constants/skills';

interface CategoryComparisonProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function CategoryComparison({ users, activeCategories, isDarkMode }: CategoryComparisonProps) {
  const categories = SKILL_CATEGORIES.filter(c => activeCategories.includes(c.id as SkillCategory));

  // Generate distinct colors for the session if needed
  const coloredUsers = useMemo(() => {
    const predefinedColors = [
      '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', 
      '#8b5cf6', '#ef4444', '#06b6d4', '#f43f5e', '#a855f7'
    ];
    return users.map((user, idx) => ({
      ...user,
      comparisonColor: user.color && user.color !== '#6366f1' ? user.color : predefinedColors[idx % predefinedColors.length]
    }));
  }, [users]);

  const chartData = useMemo(() => {
    return categories.map(cat => {
      const entry: any = { name: cat.name };
      coloredUsers.forEach(user => {
        const catSkills = (user.skillRatings || []).filter(us => us.type === cat.id);
        entry[user.uid] = catSkills.length;
      });
      return entry;
    });
  }, [coloredUsers, categories]);

  if (coloredUsers.length < 1) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <div className="max-w-md space-y-4">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-gray-600' : 'bg-slate-100 text-slate-300'}`}>
            <Info size={32} />
          </div>
          <p className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            Selecciona al menos un prestador en la barra lateral para generar la comparativa detallada
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 overflow-y-auto custom-scrollbar">
      {/* Chart Section */}
      <div className={`p-8 rounded-[2.5rem] border shadow-sm h-[420px] flex flex-col transition-colors relative overflow-hidden ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BarChart3 size={120} className={isDarkMode ? 'text-white' : 'text-slate-900'} />
        </div>

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              Densidad de Habilidades
            </h3>
            <p className={`text-[9px] font-bold mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              Cantidad de habilidades registradas por categoría
            </p>
          </div>
        </div>
        
        <ChartContainer height={290} minHeight={240} isDarkMode={isDarkMode}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 9, fontWeight: '900', fill: isDarkMode ? '#64748b' : '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tick={{ fontSize: 9, fontWeight: '900', fill: isDarkMode ? '#64748b' : '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
              contentStyle={{ 
                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                borderRadius: '16px',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
              formatter={(value) => {
                const user = coloredUsers.find(u => u.uid === value);
                return <span className={`text-[9px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{user?.firstName || value}</span>;
              }}
            />
            {coloredUsers.map((user, idx) => (
              <Bar 
                key={user.uid} 
                dataKey={user.uid} 
                fill={user.comparisonColor} 
                radius={[6, 6, 0, 0]} 
                barSize={coloredUsers.length === 1 ? 40 : undefined}
                animationDuration={1500}
                animationBegin={idx * 100}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>

      {/* Comparison Table "Por Filas (Alumnos)" */}
      <div className={`p-8 rounded-[3rem] border shadow-sm transition-colors ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              Matriz de Estudiantes vs Categorías
            </h3>
            <p className={`text-[9px] font-bold mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              Habilidades por área para cada prestador
            </p>
          </div>
        </div>
        
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left border-separate border-spacing-y-4">
            <thead>
              <tr>
                <th className={`pb-4 px-4 text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'} w-48`}>Estudiante</th>
                {categories.map(cat => (
                  <th key={cat.id} className="pb-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-1.5 group">
                      <div className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150" style={{ backgroundColor: cat.color }} />
                      <span className={`text-[8px] font-black uppercase tracking-tighter ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{cat.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coloredUsers.map(user => (
                <tr key={user.uid} className={`group transition-all duration-300`}>
                  <td className={`py-6 px-6 rounded-l-[1.5rem] border-y border-l transition-colors ${
                    isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div 
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black uppercase text-white shadow-lg"
                          style={{ backgroundColor: user.comparisonColor }}
                        >
                          {user.firstName?.charAt(0)}{user.lastNamePaterno?.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-md bg-green-500 border-2 border-white dark:border-slate-900" />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {user.firstName} {user.lastNamePaterno}
                        </span>
                        <span className={`text-[8px] font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {user.career || 'Arquitectura'}
                        </span>
                      </div>
                    </div>
                  </td>
                  {categories.map(cat => {
                    const catSkills = (user.skillRatings || []).filter(us => us.type === cat.id);
                    const isLast = cat.id === categories[categories.length - 1].id;
                    return (
                      <td key={cat.id} className={`py-6 px-4 text-center border-y ${isLast ? 'rounded-r-[1.5rem] border-r' : ''} transition-colors ${
                        isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                      }`}>
                        <div className="flex flex-wrap gap-1.5 justify-center max-w-[150px] mx-auto">
                          {catSkills.length > 0 ? (
                            catSkills.map((s, idx) => (
                              <div 
                                key={idx} 
                                className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-transform hover:scale-105 ${
                                  isDarkMode ? 'bg-white/10 text-gray-300 border border-white/10' : 'bg-slate-50 text-slate-500 border border-slate-100'
                                }`}
                              >
                                {s.name} <span className="text-indigo-500 ml-0.5">L{s.value}</span>
                              </div>
                            ))
                          ) : (
                            <span className={`text-[8px] font-black uppercase tracking-widest opacity-10 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sin data</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

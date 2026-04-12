import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { User, signOut } from 'firebase/auth';
import { showSuccessToast, showErrorToast, showLoadingToast } from '../utils/toastUtils';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../firebase';
import { SkillEditor } from './SkillEditor';
import { ProfileSkillMap } from './ProfileSkillMap';
import { SkillRating } from '../types/skills';
import { LogOut, Save } from 'lucide-react';

const profileSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastNamePaterno: z.string().min(1, "El apellido paterno es obligatorio"),
  lastNameMaterno: z.string().min(1, "El apellido materno es obligatorio"),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  emergencyPhone: z.string().optional(),
  studentId: z.string().min(1, "La matrícula es obligatoria"),
  career: z.string().min(1, "La carrera es obligatoria"),
  brigadePeriod: z.string().regex(/^\d{0,3}$/, "Debe ser máximo 3 dígitos numéricos"),
  brigade: z.string().optional(),
  workStatus: z.string().optional(),
  skillRatings: z.array(z.object({
    name: z.string(),
    type: z.enum(['arquitectura', 'urbanismo', 'paisaje', 'comunitario', 'tecnica', 'soft']),
    value: z.number().min(0).max(100)
  })).optional().default([]),
});

interface ProfileFormProps {
  user: User;
  onComplete: (profile: any) => void;
  isDarkMode?: boolean;
}

const ProfileForm = ({ user, onComplete, isDarkMode }: ProfileFormProps) => {
  const [loading, setLoading] = useState(false);
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.displayName?.split(' ')[0] || '',
      lastNamePaterno: user.displayName?.split(' ').slice(1, 2).join(' ') || '',
      lastNameMaterno: user.displayName?.split(' ').slice(2, 3).join(' ') || '',
      phone: '',
      emergencyPhone: '',
      studentId: '',
      career: 'Arquitectura',
      brigadePeriod: '',
      brigade: '',
      workStatus: 'Asignado',
      skillRatings: [] as SkillRating[],
    }
  });

  const currentSkillRatings = watch('skillRatings') || [];

  const onSubmit = async (data: any) => {
    setLoading(true);
    const loadingToast = showLoadingToast("Guardando perfil...");
    try {
      // Hardcoded admin emails, must be verified
      const adminEmails = ['luisedgar.gutierrez17@gmail.com'];
      const isAdmin = user.email && adminEmails.includes(user.email) && user.emailVerified;
      
      // Derive skills array from skillRatings for backward compatibility
      const derivedSkills = data.skillRatings.map((s: SkillRating) => s.name);

      const profileData = {
        ...data,
        skills: derivedSkills,
        role: isAdmin ? 'admin' : 'user',
        status: 'En Curso', // Default status for all new users
        email: user.email,
        uid: user.uid,
        createdAt: new Date().toISOString(),
      };
      
      const path = `users/${user.uid}`;
      try {
        await setDoc(doc(db, 'users', user.uid), profileData);
        
        // Sync to public_profiles for visibility to other users
        const publicProfile = {
          firstName: profileData.firstName,
          lastNamePaterno: profileData.lastNamePaterno,
          lastNameMaterno: profileData.lastNameMaterno,
          career: profileData.career,
          skills: profileData.skills,
          status: profileData.status,
          role: profileData.role,
          uid: profileData.uid
        };
        await setDoc(doc(db, 'public_profiles', user.uid), publicProfile, { merge: true });
        
        toast.dismiss(loadingToast);
        showSuccessToast('Perfil guardado exitosamente');
      } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error("Error saving profile to Firestore", error);
        if (error.code === 'permission-denied') {
          showErrorToast('Error de permisos en Firestore. El perfil se guardará localmente en este navegador.');
        } else {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      }

      // Always save to localStorage as fallback/cache
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify(profileData));
      onComplete(profileData);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error("Error saving profile", error);
      if (!(error instanceof Error && error.message.startsWith('{'))) {
        showErrorToast('Error al guardar el perfil');
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
      <div className={`p-8 sm:p-12 rounded-[2rem] shadow-xl border w-full max-w-4xl ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
        <h1 className={`text-3xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Completa tu perfil</h1>
        <p className={`mb-8 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Necesitamos unos datos adicionales para comenzar.</p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Nombre(s)</label>
              <input 
                {...register('firstName')} 
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. Juan"
              />
              {errors.firstName && <span className="text-red-500 text-xs font-bold">{errors.firstName.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Apellido Paterno</label>
              <input 
                {...register('lastNamePaterno')} 
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. Pérez"
              />
              {errors.lastNamePaterno && <span className="text-red-500 text-xs font-bold">{errors.lastNamePaterno.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Apellido Materno</label>
              <input 
                {...register('lastNameMaterno')} 
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. López"
              />
              {errors.lastNameMaterno && <span className="text-red-500 text-xs font-bold">{errors.lastNameMaterno.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Matrícula</label>
              <input 
                {...register('studentId')} 
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. 315123456"
              />
              {errors.studentId && <span className="text-red-500 text-xs font-bold">{errors.studentId.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Número de contacto</label>
              <input 
                {...register('phone')} 
                maxLength={10}
                onChange={(e) => {
                  if (/[^0-9]/.test(e.target.value)) {
                    toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                  }
                  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setValue('phone', e.target.value);
                }}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. 5512345678"
              />
              {errors.phone && <span className="text-red-500 text-xs font-bold">{errors.phone.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-red-500">SOS (Teléfono de Emergencia)</label>
              <input 
                {...register('emergencyPhone')} 
                maxLength={10}
                onChange={(e) => {
                  if (/[^0-9]/.test(e.target.value)) {
                    toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                  }
                  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setValue('emergencyPhone', e.target.value);
                }}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400 focus:bg-red-500/20 focus:border-red-500/50' : 'bg-red-50 border-red-100 text-red-900 focus:bg-white focus:border-red-300'}`}
                placeholder="Ej. 5598765432"
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Ciclo de brigada</label>
              <input 
                {...register('brigadePeriod')} 
                maxLength={3}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setValue('brigadePeriod', value);
                }}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                placeholder="Ej. 111"
              />
              {errors.brigadePeriod && <span className="text-red-500 text-xs font-bold">{errors.brigadePeriod.message as string}</span>}
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Carrera</label>
              <select 
                {...register('career')} 
                className={`w-full p-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
              >
                <option value="Arquitectura" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Arquitectura</option>
                <option value="Urbanismo" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Urbanismo</option>
                <option value="Arquitectura de Paisaje" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Arquitectura de Paisaje</option>
                <option value="Diseño Industrial" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Diseño Industrial</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-8 mt-8">
            <SkillEditor 
              skillRatings={currentSkillRatings} 
              onChange={(newRatings) => setValue('skillRatings', newRatings)} 
              isDarkMode={isDarkMode}
            />
            <ProfileSkillMap 
              skillRatings={currentSkillRatings} 
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button 
              type="button"
              onClick={() => signOut(auth)}
              className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <LogOut size={18} />
              Cancelar y salir
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Aceptar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileForm;

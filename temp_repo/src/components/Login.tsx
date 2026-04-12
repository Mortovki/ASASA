import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import toast from 'react-hot-toast';

const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Sesión iniciada correctamente');
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/popup-blocked') {
        toast.error('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Se cerró la ventana de inicio de sesión antes de completar el proceso.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('Este dominio no está autorizado para el inicio de sesión con Google. Revisa la configuración en la consola de Firebase.');
      } else {
        toast.error(`Error al iniciar sesión: ${error.message || 'Inténtalo de nuevo'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 sm:p-12 rounded-[2rem] shadow-xl border border-slate-200 text-center w-full max-w-md">
        <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c2.204 0 4.226.719 5.855 1.927m0 0a9.963 9.963 0 012.223 3.138m0 0A10.01 10.01 0 0122 12c0 1.265-.234 2.476-.662 3.591m-8.113-10.454a7.461 7.461 0 011.89 3.421m0 0a7.493 7.493 0 11-9.972 9.512m9.972-9.512L15 7m-3 5h.01M19 19l-2-2m-7 0l-2 2m11-4l-2 2m-7 0l-2 2" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Bienvenido</h1>
        <p className="text-slate-500 mb-8">Inicia sesión para acceder al sistema de asistencia.</p>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
              </svg>
              Iniciar sesión con Google
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;

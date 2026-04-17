import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const SUPER_ADMINS = ["luisedgar.gutierrez17@gmail.com", "luisedgar.gutierrez1@gmail.com"];

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userRole, setUserRole] = useState<'admin' | 'coordinator' | 'user'>('user');
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setUserRole('user');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Check if user is a super admin by email first
    if (user.email && SUPER_ADMINS.includes(user.email)) {
      setUserRole('admin');
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserRole(doc.data().role || 'user');
      } else if (user.email && SUPER_ADMINS.includes(user.email)) {
        setUserRole('admin');
      } else {
        setUserRole('user');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user role:", error);
      // If we can't fetch the role but it's a super admin, keep it as admin
      if (user.email && SUPER_ADMINS.includes(user.email)) {
        setUserRole('admin');
      } else {
        setUserRole('user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { user, userRole, loading };
}

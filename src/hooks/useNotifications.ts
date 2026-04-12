import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Notification } from '../types/notification';
import { isToday, isYesterday, format } from 'date-fns';
import { es } from 'date-fns/locale';

import { dedupeById } from '../utils/dedupe';

export const useNotifications = (userId: string | undefined) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Filter out incomplete documents (stubs) that might be created by setDoc merge
          if (!data.type || !data.title) return null;
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt)
          } as Notification;
        })
        .filter((n): n is Notification => n !== null);
      
      setNotifications(dedupeById(notifs));
      setUnreadCount(notifs.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [userId]);

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {
      'Hoy': [],
      'Ayer': [],
      'Anteriores': []
    };

    notifications.forEach(n => {
      const date = new Date(n.createdAt);
      if (isToday(date)) groups['Hoy'].push(n);
      else if (isYesterday(date)) groups['Ayer'].push(n);
      else groups['Anteriores'].push(n);
    });

    return groups;
  }, [notifications]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    const path = `users/${userId}/notifications/${notificationId}`;
    try {
      await setDoc(doc(db, 'users', userId, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.set(doc(db, 'users', userId, 'notifications', n.id), {
          read: true,
          readAt: new Date().toISOString()
        }, { merge: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/notifications`);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!userId) {
      console.error("No userId found in useNotifications hook");
      return;
    }
    const path = `users/${userId}/notifications/${notificationId}`;
    console.log("Attempting to delete notification:", notificationId, "for user:", userId);
    try {
      const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
      await deleteDoc(notifRef);
      console.log("Successfully deleted notification:", notificationId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const clearAll = async () => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'users', userId, 'notifications', n.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/notifications`);
    }
  };

  return {
    notifications,
    unreadCount,
    grouped,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  };
};

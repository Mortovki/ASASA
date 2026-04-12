import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Stage } from '../types/stage';
import toast from 'react-hot-toast';

export const useStages = (projectId?: string) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setStages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'stages'),
      where('projectId', '==', projectId),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Stage[];
      setStages(stagesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching stages:', error);
      toast.error('Error al cargar las etapas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const addStage = async (stageData: Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'stages'), {
        ...stageData,
        createdAt: now,
        updatedAt: now
      });
      toast.success('Etapa creada correctamente');
    } catch (error) {
      console.error('Error adding stage:', error);
      toast.error('Error al crear la etapa');
      throw error;
    }
  };

  const updateStage = async (id: string, stageData: Partial<Stage>) => {
    try {
      const stageRef = doc(db, 'stages', id);
      await updateDoc(stageRef, {
        ...stageData,
        updatedAt: new Date().toISOString()
      });
      toast.success('Etapa actualizada');
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Error al actualizar la etapa');
      throw error;
    }
  };

  const reorderStages = async (newStages: Stage[]) => {
    try {
      const batch = writeBatch(db);
      newStages.forEach((stage, index) => {
        const stageRef = doc(db, 'stages', stage.id);
        batch.update(stageRef, { 
          order: index,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      toast.success('Orden actualizado');
    } catch (error) {
      console.error('Error reordering stages:', error);
      toast.error('Error al reordenar las etapas');
      throw error;
    }
  };

  return {
    stages,
    loading,
    addStage,
    updateStage,
    reorderStages
  };
};

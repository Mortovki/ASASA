import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Sprint } from '../types/project';
import toast from 'react-hot-toast';

export const useSprints = (projectId: string | null) => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setSprints([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const sprintsRef = collection(db, 'projects', projectId, 'sprints');

    const unsubscribe = onSnapshot(sprintsRef, (snapshot) => {
      const sprintsData = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        projectId,
        ...docSnap.data()
      })) as Sprint[];

      // Sort by startDate or name
      sprintsData.sort((a, b) => {
        if (a.startDate && b.startDate) {
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      setSprints(sprintsData);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to sprints:", error);
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}/sprints`);
    });

    return () => unsubscribe();
  }, [projectId]);

  const addSprint = async (sprintData: Partial<Sprint>): Promise<string> => {
    if (!projectId) throw new Error('ID de proyecto no disponible');
    const newSprintId = sprintData.id || `sprint-${Date.now()}`;
    const sprintRef = doc(db, 'projects', projectId, 'sprints', newSprintId);
    
    const payload: Sprint = {
      id: newSprintId,
      projectId,
      name: sprintData.name || 'Nuevo Sprint',
      startDate: sprintData.startDate || new Date().toISOString().split('T')[0],
      endDate: sprintData.endDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      stageId: sprintData.stageId || null,
      ...sprintData
    };

    try {
      await setDoc(sprintRef, payload);
      toast.success(`Sprint "${payload.name}" creado`);
      return newSprintId;
    } catch (error) {
      console.error("Error creating sprint:", error);
      toast.error('Error al crear sprint');
      handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}/sprints/${newSprintId}`);
      throw error;
    }
  };

  const updateSprint = async (sprintId: string, updates: Partial<Sprint>) => {
    if (!projectId || !sprintId) return;
    const sprintRef = doc(db, 'projects', projectId, 'sprints', sprintId);
    try {
      await updateDoc(sprintRef, updates);
      toast.success('Sprint actualizado');
    } catch (error) {
      console.error("Error updating sprint:", error);
      toast.error('Error al actualizar sprint');
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/sprints/${sprintId}`);
      throw error;
    }
  };

  const deleteSprint = async (sprintId: string) => {
    if (!projectId || !sprintId) return;
    const sprintRef = doc(db, 'projects', projectId, 'sprints', sprintId);
    try {
      await deleteDoc(sprintRef);
      toast.success('Sprint eliminado');
    } catch (error) {
      console.error("Error deleting sprint:", error);
      toast.error('Error al eliminar sprint');
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/sprints/${sprintId}`);
      throw error;
    }
  };

  return {
    sprints,
    loading,
    addSprint,
    updateSprint,
    deleteSprint
  };
};


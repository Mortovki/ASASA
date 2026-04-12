import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';

export type ResourceType = 
  | 'drive' 
  | 'docs' 
  | 'sheets' 
  | 'canva' 
  | 'onedrive' 
  | 'figma' 
  | 'notion' 
  | 'youtube' 
  | 'github' 
  | 'link';

export interface ProjectResource {
  id: string;
  name: string;
  description?: string;
  url: string;
  type: ResourceType;
  icon?: string | null;
  addedBy: string;
  addedByName: string;
  createdAt: string;
  lastAccessed: string | null;
  order: number;
}

import { dedupeById } from '../utils/dedupe';

export function useResources(projectId: string) {
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, 'projects', projectId, 'resources'),
      orderBy('order', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const resourcesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectResource));
      setResources(dedupeById(resourcesData));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching resources:", err);
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, `projects/${projectId}/resources`);
    });

    return unsub;
  }, [projectId]);

  const addResource = async (data: Omit<ProjectResource, 'id' | 'createdAt' | 'lastAccessed'>) => {
    const ref = collection(db, 'projects', projectId, 'resources');
    // Simple order: at the end
    const order = resources.length;
    await addDoc(ref, { 
      ...data, 
      order, 
      createdAt: new Date().toISOString(), 
      lastAccessed: null 
    });
  };

  const updateResource = async (resourceId: string, data: Partial<ProjectResource>) => {
    await updateDoc(
      doc(db, 'projects', projectId, 'resources', resourceId),
      data
    );
  };

  const updateLastAccessed = async (resourceId: string) => {
    await updateDoc(
      doc(db, 'projects', projectId, 'resources', resourceId),
      { lastAccessed: new Date().toISOString() }
    );
  };

  const deleteResource = async (resourceId: string) => {
    await deleteDoc(doc(db, 'projects', projectId, 'resources', resourceId));
  };

  const reorderResources = async (newOrder: ProjectResource[]) => {
    const batch = writeBatch(db);
    newOrder.forEach((resource, index) => {
      const ref = doc(db, 'projects', projectId, 'resources', resource.id);
      batch.update(ref, { order: index });
    });
    await batch.commit();
  };

  return { 
    resources, 
    loading, 
    addResource, 
    updateResource, 
    updateLastAccessed, 
    deleteResource,
    reorderResources
  };
}

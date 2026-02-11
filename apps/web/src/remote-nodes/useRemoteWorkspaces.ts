import { useState, useCallback } from 'react';
import type { Workspace } from '../types';
import { NodeApiClient } from './NodeApiClient';

export interface NodeWorkspace extends Workspace {
  nodeId: string;
}

export interface UseRemoteWorkspacesReturn {
  getWorkspacesForNode: (nodeId: string) => Promise<NodeWorkspace[]>;
  createRemoteWorkspace: (nodeId: string, path: string) => Promise<Workspace | null>;
  deleteRemoteWorkspace: (nodeId: string, workspaceId: string) => Promise<void>;
  cachedWorkspaces: Map<string, NodeWorkspace[]>;
}

export function useRemoteWorkspaces(
  getNodeClient: (nodeId: string) => NodeApiClient | null
): UseRemoteWorkspacesReturn {
  const [cachedWorkspaces, setCachedWorkspaces] = useState<Map<string, NodeWorkspace[]>>(
    new Map()
  );

  const getWorkspacesForNode = useCallback(
    async (nodeId: string): Promise<NodeWorkspace[]> => {
      const client = getNodeClient(nodeId);
      if (!client) return [];

      try {
        const workspaces = await client.listWorkspaces();
        const nodeWorkspaces = workspaces.map((ws): NodeWorkspace => ({
          ...ws,
          nodeId
        }));

        setCachedWorkspaces((prev) => {
          const next = new Map(prev);
          next.set(nodeId, nodeWorkspaces);
          return next;
        });

        return nodeWorkspaces;
      } catch {
        return [];
      }
    },
    [getNodeClient]
  );

  const createRemoteWorkspace = useCallback(
    async (nodeId: string, path: string): Promise<Workspace | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;

      try {
        const workspace = await client.createWorkspace(path);

        // Update cache
        setCachedWorkspaces((prev) => {
          const next = new Map(prev);
          const existing = next.get(nodeId) || [];
          next.set(nodeId, [...existing, { ...workspace, nodeId }]);
          return next;
        });

        return workspace;
      } catch {
        return null;
      }
    },
    [getNodeClient]
  );

  const deleteRemoteWorkspace = useCallback(
    async (nodeId: string, workspaceId: string) => {
      const client = getNodeClient(nodeId);
      if (!client) return;

      await client.deleteWorkspace(workspaceId);

      setCachedWorkspaces((prev) => {
        const next = new Map(prev);
        const existing = next.get(nodeId) || [];
        next.set(nodeId, existing.filter((ws) => ws.id !== workspaceId));
        return next;
      });
    },
    [getNodeClient]
  );

  return {
    getWorkspacesForNode,
    createRemoteWorkspace,
    deleteRemoteWorkspace,
    cachedWorkspaces
  };
}

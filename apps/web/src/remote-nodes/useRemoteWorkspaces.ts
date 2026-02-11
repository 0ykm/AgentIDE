import { useState, useCallback } from 'react';
import type { Workspace } from '../types';
import type { RemoteNodeWithStatus } from '@deck-ide/shared/types';
import { NodeApiClient } from './NodeApiClient';

export interface NodeWorkspace extends Workspace {
  nodeId: string;
  nodeName: string;
}

export interface UseRemoteWorkspacesReturn {
  remoteWorkspaces: NodeWorkspace[];
  loading: boolean;
  refreshRemoteWorkspaces: () => Promise<void>;
  createRemoteWorkspace: (nodeId: string, path: string) => Promise<Workspace | null>;
  deleteRemoteWorkspace: (nodeId: string, workspaceId: string) => Promise<void>;
  updateRemoteWorkspace: (nodeId: string, wsId: string, updates: { name?: string; path?: string }) => Promise<Workspace | null>;
}

export function useRemoteWorkspaces(
  onlineRemoteNodes: RemoteNodeWithStatus[],
  getNodeClient: (nodeId: string) => NodeApiClient | null
): UseRemoteWorkspacesReturn {
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<NodeWorkspace[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshRemoteWorkspaces = useCallback(async () => {
    if (onlineRemoteNodes.length === 0) {
      setRemoteWorkspaces([]);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        onlineRemoteNodes.map(async (node) => {
          const client = getNodeClient(node.id);
          if (!client) return [];
          const workspaces = await client.listWorkspaces();
          return workspaces.map((ws): NodeWorkspace => ({
            ...ws,
            nodeId: node.id,
            nodeName: node.name
          }));
        })
      );

      const allWorkspaces: NodeWorkspace[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allWorkspaces.push(...result.value);
        }
      }

      setRemoteWorkspaces(allWorkspaces);
    } finally {
      setLoading(false);
    }
  }, [onlineRemoteNodes, getNodeClient]);

  const createRemoteWorkspace = useCallback(
    async (nodeId: string, path: string): Promise<Workspace | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;

      try {
        const workspace = await client.createWorkspace(path);
        const node = onlineRemoteNodes.find((n) => n.id === nodeId);
        const nodeWorkspace: NodeWorkspace = {
          ...workspace,
          nodeId,
          nodeName: node?.name || 'Unknown'
        };
        setRemoteWorkspaces((prev) => [...prev, nodeWorkspace]);
        return workspace;
      } catch {
        return null;
      }
    },
    [getNodeClient, onlineRemoteNodes]
  );

  const deleteRemoteWorkspace = useCallback(
    async (nodeId: string, workspaceId: string) => {
      const client = getNodeClient(nodeId);
      if (!client) return;

      await client.deleteWorkspace(workspaceId);
      setRemoteWorkspaces((prev) => prev.filter((ws) => !(ws.id === workspaceId && ws.nodeId === nodeId)));
    },
    [getNodeClient]
  );

  const updateRemoteWorkspace = useCallback(
    async (nodeId: string, wsId: string, updates: { name?: string; path?: string }): Promise<Workspace | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;

      try {
        const updated = await client.updateWorkspace(wsId, updates);
        setRemoteWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === wsId && ws.nodeId === nodeId
              ? { ...ws, ...updated }
              : ws
          )
        );
        return updated;
      } catch {
        return null;
      }
    },
    [getNodeClient]
  );

  return {
    remoteWorkspaces,
    loading,
    refreshRemoteWorkspaces,
    createRemoteWorkspace,
    deleteRemoteWorkspace,
    updateRemoteWorkspace
  };
}

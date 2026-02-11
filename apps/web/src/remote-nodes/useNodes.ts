import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RemoteNodeWithStatus, RegisterNodeRequest, NodeInfo, RemoteNode } from '@deck-ide/shared/types';
import { NodeApiClient } from './NodeApiClient';
import { API_BASE } from '../constants';

const NODE_HEALTH_CHECK_INTERVAL = 15000;

export interface UseNodesReturn {
  nodes: RemoteNodeWithStatus[];
  localNode: RemoteNodeWithStatus;
  onlineRemoteNodes: RemoteNodeWithStatus[];
  getNodeClient: (nodeId: string) => NodeApiClient | null;
  addNode: (req: RegisterNodeRequest) => Promise<void>;
  removeNode: (nodeId: string) => Promise<void>;
  updateNode: (nodeId: string, updates: Partial<RegisterNodeRequest>) => Promise<void>;
  testConnection: (host: string, port: number) => Promise<NodeInfo | null>;
  refreshAllStatuses: () => Promise<void>;
}

const createLocalNodeStatus = (info: NodeInfo | null): RemoteNodeWithStatus => ({
  id: info?.id || 'local',
  name: info?.name || 'Local',
  host: 'localhost',
  port: 0,
  isLocal: true,
  createdAt: new Date().toISOString(),
  status: 'online',
  lastSeen: new Date().toISOString(),
  version: info?.version
});

export function useNodes(): UseNodesReturn {
  const [nodes, setNodes] = useState<RemoteNodeWithStatus[]>([]);
  const [localNode, setLocalNode] = useState<RemoteNodeWithStatus>(createLocalNodeStatus(null));
  const clientsRef = useRef<Map<string, NodeApiClient>>(new Map());
  const localClientRef = useRef<NodeApiClient>(
    new NodeApiClient(API_BASE || window.location.origin)
  );

  // Initialize: fetch local node info and registered nodes
  useEffect(() => {
    let alive = true;

    const init = async () => {
      try {
        const info = await localClientRef.current.getNodeInfo();
        if (!alive) return;
        setLocalNode(createLocalNodeStatus(info));
      } catch {
        // Local node info endpoint may not exist yet; keep defaults
      }

      try {
        const remoteNodes = await localClientRef.current.listNodes();
        if (!alive) return;

        const withStatus: RemoteNodeWithStatus[] = remoteNodes
          .filter((n) => !n.isLocal)
          .map((n) => ({
            ...n,
            status: 'connecting' as const,
            lastSeen: null
          }));

        setNodes(withStatus);

        // Create clients for each remote node
        for (const node of remoteNodes.filter((n) => !n.isLocal)) {
          const url = `http://${node.host}:${node.port}`;
          clientsRef.current.set(node.id, new NodeApiClient(url));
        }
      } catch {
        // Node listing may not exist yet
      }
    };

    init();
    return () => { alive = false; };
  }, []);

  // Health check: ping each remote node periodically
  const checkNodeHealth = useCallback(async (node: RemoteNodeWithStatus) => {
    const client = clientsRef.current.get(node.id);
    if (!client) return node;

    try {
      const info = await client.getNodeInfo();
      return {
        ...node,
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        version: info.version,
        error: undefined
      };
    } catch (err) {
      return {
        ...node,
        status: 'error' as const,
        error: err instanceof Error ? err.message : 'Connection failed'
      };
    }
  }, []);

  const refreshAllStatuses = useCallback(async () => {
    setNodes((prev) => {
      if (prev.length === 0) return prev;

      // Mark all as connecting while checking
      const updated = prev.map((n) => ({ ...n }));

      // Fire health checks in parallel (don't await inside setState)
      Promise.allSettled(updated.map(checkNodeHealth)).then((results) => {
        setNodes((current) =>
          current.map((node, i) => {
            const result = results[i];
            if (result && result.status === 'fulfilled') {
              return result.value;
            }
            return { ...node, status: 'error' as const };
          })
        );
      });

      return updated;
    });
  }, [checkNodeHealth]);

  // Periodic health check
  useEffect(() => {
    if (nodes.length === 0) return;

    // Initial health check
    const doCheck = async () => {
      const results = await Promise.allSettled(nodes.map(checkNodeHealth));
      setNodes((current) =>
        current.map((node, i) => {
          const result = results[i];
          if (result && result.status === 'fulfilled') {
            return result.value;
          }
          return { ...node, status: 'error' as const };
        })
      );
    };

    doCheck();
    const interval = setInterval(doCheck, NODE_HEALTH_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [nodes.length, checkNodeHealth]); // eslint-disable-line react-hooks/exhaustive-deps

  const getNodeClient = useCallback((nodeId: string): NodeApiClient | null => {
    if (nodeId === localNode.id || nodeId === 'local') {
      return localClientRef.current;
    }
    return clientsRef.current.get(nodeId) || null;
  }, [localNode.id]);

  const addNode = useCallback(async (req: RegisterNodeRequest) => {
    const registered = await localClientRef.current.registerNode(req);
    const url = `http://${registered.host}:${registered.port}`;
    const client = new NodeApiClient(url);
    clientsRef.current.set(registered.id, client);

    // Check health immediately
    let status: RemoteNodeWithStatus = {
      ...registered,
      status: 'connecting',
      lastSeen: null
    };

    try {
      const info = await client.getNodeInfo();
      status = {
        ...status,
        status: 'online',
        lastSeen: new Date().toISOString(),
        version: info.version
      };
    } catch (err) {
      status = {
        ...status,
        status: 'error',
        error: err instanceof Error ? err.message : 'Connection failed'
      };
    }

    setNodes((prev) => [...prev, status]);
  }, []);

  const removeNode = useCallback(async (nodeId: string) => {
    await localClientRef.current.deleteNode(nodeId);
    clientsRef.current.delete(nodeId);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }, []);

  const updateNodeFn = useCallback(async (nodeId: string, updates: Partial<RegisterNodeRequest>) => {
    const updated = await localClientRef.current.updateNode(nodeId, updates);

    // Recreate client if host/port changed
    if (updates.host || updates.port) {
      const url = `http://${updated.host}:${updated.port}`;
      clientsRef.current.set(nodeId, new NodeApiClient(url));
    }

    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, ...updated, status: 'connecting' as const } : n
      )
    );
  }, []);

  const testConnection = useCallback(async (host: string, port: number): Promise<NodeInfo | null> => {
    const url = `http://${host}:${port}`;
    const testClient = new NodeApiClient(url);
    try {
      return await testClient.getNodeInfo();
    } catch {
      return null;
    }
  }, []);

  const onlineRemoteNodes = useMemo(
    () => nodes.filter((n) => n.status === 'online'),
    [nodes]
  );

  return {
    nodes,
    localNode,
    onlineRemoteNodes,
    getNodeClient,
    addNode,
    removeNode,
    updateNode: updateNodeFn,
    testConnection,
    refreshAllStatuses
  };
}

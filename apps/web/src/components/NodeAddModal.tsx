import { useState, useEffect, type FormEvent } from 'react';
import type { RegisterNodeRequest, NodeInfo, RemoteNodeWithStatus } from '@deck-ide/shared/types';

interface NodeAddModalProps {
  isOpen: boolean;
  editNode?: RemoteNodeWithStatus | null;
  onSubmit: (req: RegisterNodeRequest) => Promise<void>;
  onTestConnection: (host: string, port: number) => Promise<NodeInfo | null>;
  onClose: () => void;
}

export function NodeAddModal({
  isOpen,
  editNode,
  onSubmit,
  onTestConnection,
  onClose
}: NodeAddModalProps) {
  const isEditMode = Boolean(editNode);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('8787');
  const [name, setName] = useState('');
  const [authUser, setAuthUser] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; info?: NodeInfo; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editNode changes
  useEffect(() => {
    if (editNode) {
      setHost(editNode.host);
      setPort(String(editNode.port));
      setName(editNode.name);
      setAuthUser(editNode.authUser || '');
      setAuthPassword('');
      setTestResult(null);
    } else {
      setHost('');
      setPort('8787');
      setName('');
      setAuthUser('');
      setAuthPassword('');
      setTestResult(null);
    }
  }, [editNode]);

  const handleTest = async () => {
    if (!host.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const info = await onTestConnection(host.trim(), Number(port));
      if (info) {
        setTestResult({ success: true, info });
        if (!name.trim() && info.name) {
          setName(info.name);
        }
      } else {
        setTestResult({ success: false, error: '接続できません' });
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : '接続エラー' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!host.trim()) return;
    setSubmitting(true);
    try {
      const req: RegisterNodeRequest = {
        name: name.trim() || `Node (${host}:${port})`,
        host: host.trim(),
        port: Number(port)
      };
      if (authUser.trim()) {
        req.authUser = authUser.trim();
      }
      // Only include password if user entered one (empty = no change in edit mode)
      if (authPassword) {
        req.authPasswordEnc = authPassword;
      }
      await onSubmit(req);
      if (!isEditMode) {
        // Reset form only in add mode
        setHost('');
        setPort('8787');
        setName('');
        setAuthUser('');
        setAuthPassword('');
        setTestResult(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">{isEditMode ? 'ノード設定' : 'ノード追加'}</div>
        <label className="field">
          <span>ホスト名 / IPアドレス</span>
          <input
            type="text"
            value={host}
            placeholder="192.168.1.10"
            onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
            required
          />
        </label>
        <label className="field">
          <span>ポート</span>
          <input
            type="number"
            value={port}
            placeholder="8787"
            min={1}
            max={65535}
            onChange={(e) => { setPort(e.target.value); setTestResult(null); }}
            required
          />
        </label>
        <label className="field">
          <span>ノード名 (任意)</span>
          <input
            type="text"
            value={name}
            placeholder="自動検出されます"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>認証ユーザー名 (任意)</span>
          <input
            type="text"
            value={authUser}
            placeholder="未設定の場合は認証なし"
            onChange={(e) => setAuthUser(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>認証パスワード (任意)</span>
          <input
            type="password"
            value={authPassword}
            placeholder={isEditMode ? '変更しない場合は空欄' : '未設定の場合は認証なし'}
            onChange={(e) => setAuthPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <div className="node-test-section">
          <button
            type="button"
            className="ghost-button"
            onClick={handleTest}
            disabled={testing || !host.trim()}
          >
            {testing ? '接続テスト中...' : '接続テスト'}
          </button>
          {testResult && (
            <span className={`node-test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success
                ? `接続OK: ${testResult.info?.name || ''} (v${testResult.info?.version || '?'})`
                : `接続失敗: ${testResult.error}`}
            </span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={submitting || !host.trim()}
          >
            {submitting
              ? (isEditMode ? '保存中...' : '追加中...')
              : (isEditMode ? '保存' : '追加')}
          </button>
        </div>
      </form>
    </div>
  );
}

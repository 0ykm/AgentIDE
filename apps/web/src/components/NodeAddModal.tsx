import { useState, type FormEvent } from 'react';
import type { RegisterNodeRequest, NodeInfo } from '@deck-ide/shared/types';

interface NodeAddModalProps {
  isOpen: boolean;
  onSubmit: (req: RegisterNodeRequest) => Promise<void>;
  onTestConnection: (host: string, port: number) => Promise<NodeInfo | null>;
  onClose: () => void;
}

export function NodeAddModal({
  isOpen,
  onSubmit,
  onTestConnection,
  onClose
}: NodeAddModalProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8787');
  const [name, setName] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; info?: NodeInfo; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      await onSubmit({
        name: name.trim() || `Node (${host}:${port})`,
        host: host.trim(),
        port: Number(port)
      });
      // Reset form
      setHost('');
      setPort('8787');
      setName('');
      setTestResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">ノード追加</div>
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
            {submitting ? '追加中...' : '追加'}
          </button>
        </div>
      </form>
    </div>
  );
}

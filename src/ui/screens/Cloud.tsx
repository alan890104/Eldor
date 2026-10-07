// The "Cloud backup" block of the settings screen: a one-line status, a choice for the player on conflict; the collapsed "Advanced" section holds the transfer code, entering a transfer code, and turning backup off.

import { useState } from 'react';
import { sfx } from '../../audio/sfx.ts';
import { currentKey, linkAccount, resolveConflict, setCloudOff, syncAfterLink, syncNow, useCloud } from '../../game/cloud.ts';
import { store } from '../store.ts';
import { Modal } from '../widgets.tsx';
import { noticeIfRepaired } from '../KitNotice.tsx';

const getSave = () => store.save;
// Loading a cloud save: also show a notice when a kit revision means the skill slots need correcting
const adopt = (d: Parameters<typeof store.adoptSave>[0]) => {
  noticeIfRepaired(d);
  store.adoptSave(d);
};

function timeText(t: number): string {
  if (!t) return '';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Enter a transfer code and take over the progress from another device */
function TransferDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [err, setErr] = useState('');
  const link = async () => {
    sfx.confirm();
    setBusy(true);
    setErr('');
    try {
      await linkAccount(keyInput);
      const r = await syncAfterLink(getSave, adopt);
      onClose();
      store.showToast(r === 'loaded' ? '已接續另一台裝置的進度' : r === 'uploaded' ? '已把這台裝置的進度上傳' : '已連結（雙方都還沒有進度）');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={() => !busy && onClose()}>
      <h3>接續另一台裝置的進度</h3>
      <p>輸入另一台裝置「設定 → 進階」顯示的轉移碼。雲端有進度時會取代這台裝置的進度；雲端沒有進度時則把這台的進度上傳。</p>
      <input className="cloud-input" placeholder="ELDOR-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
      {err && <div className="cloud-status err">{err}</div>}
      <div className="row">
        <button className="btn ghost small" disabled={busy} onClick={onClose}>取消</button>
        <button className="btn small gold" disabled={busy || keyInput.trim().length < 10} onClick={() => void link()}>{busy ? '接續中…' : '接續'}</button>
      </div>
    </Modal>
  );
}

export function CloudSection() {
  const cloud = useCloud();
  const [advanced, setAdvanced] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(currentKey() ?? '');
      setCopied(true);
    } catch {
      store.showToast('無法自動複製，請手動選取轉移碼');
    }
  };

  const statusText = cloud.off
    ? '已關閉'
    : cloud.status === 'syncing'
      ? '同步中…'
      : cloud.status === 'error'
        ? `無法連線（${cloud.error}）`
        : cloud.status === 'ok'
          ? `已備份 ${timeText(cloud.lastSync)}`
          : cloud.enabled
            ? '待備份'
            : '第一次存檔時自動開始';

  return (
    <div className="cloud">
      <div className="cloud-head">
        <span>雲端備份</span>
        <span className={`cloud-status ${cloud.status === 'error' && !cloud.off ? 'err' : cloud.status === 'ok' && !cloud.off ? 'ok' : ''}`}>{statusText}</span>
      </div>
      <p className="cloud-text">進度會自動備份到雲端，不用登入。{cloud.enabled ? `這台裝置的帳號：${cloud.id}。` : ''}</p>
      {cloud.conflict && (
        <div className="cloud-conflict">
          <div>另一台裝置有較新的進度（{new Date(cloud.conflict.updatedAt).toLocaleString()}）。要保留哪一份？</div>
          <div className="cloud-actions">
            <button className="btn small gold" onClick={() => { sfx.confirm(); void resolveConflict('cloud', getSave, adopt); }}>用雲端的進度</button>
            <button className="btn small ghost" onClick={() => { sfx.confirm(); void resolveConflict('local', getSave, adopt); }}>用這台的進度</button>
          </div>
        </div>
      )}
      <div className="cloud-actions">
        {!cloud.off && <button className="btn small ghost" disabled={cloud.status === 'syncing'} onClick={() => { sfx.click(); void syncNow(getSave, adopt); }}>立即備份</button>}
        <button className="btn small ghost" onClick={() => { sfx.click(); setAdvanced((v) => !v); }}>{advanced ? '收起進階' : '進階'}</button>
      </div>
      {advanced && (
        <div className="cloud-advanced">
          {cloud.enabled && (
            <>
              <div className="cloud-label">轉移碼（把它輸入到另一台裝置的「設定 → 進階」就能接續進度；任何人拿到它都能讀寫你的進度）</div>
              <div className="cloud-key">{currentKey()}</div>
              <div className="cloud-actions">
                <button className="btn small ghost" onClick={() => void copy()}>{copied ? '已複製' : '複製轉移碼'}</button>
              </div>
            </>
          )}
          <div className="cloud-actions">
            <button className="btn small ghost" onClick={() => { sfx.click(); setTransfer(true); }}>接續另一台裝置的進度</button>
          </div>
          <label className="cloud-check">
            <input type="checkbox" checked={!cloud.off} onChange={(e) => { sfx.click(); setCloudOff(!e.target.checked); }} /> 自動備份到雲端
          </label>
        </div>
      )}
      {transfer && <TransferDialog onClose={() => setTransfer(false)} />}
    </div>
  );
}

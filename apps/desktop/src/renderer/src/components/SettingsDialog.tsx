import { useEffect, useState } from 'react';
import type { AppConfig } from '../../../main/config';

interface Props {
  onClose: () => void;
}

/** 设置弹窗：自动接受对局开关（写入 %APPDATA%/ChooseHextech/config.json） */
export default function SettingsDialog({ onClose }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void window.choosehextech.getConfig().then((config: AppConfig) => {
      setAutoAccept(config.autoAccept ?? false);
      setLoaded(true);
    });
  }, []);

  const save = async (): Promise<void> => {
    await window.choosehextech.saveConfig({ autoAccept });
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <div className="settings-mask" onClick={onClose}>
      <div className="settings-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>设置</h3>
        {!loaded ? (
          <div className="empty">正在读取配置…</div>
        ) : (
          <div className="settings-row">
            <span>自动接受对局</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoAccept}
              className={'toggle ' + (autoAccept ? 'on' : '')}
              onClick={() => setAutoAccept((value) => !value)}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        )}
        <div className="settings-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={() => void save()} disabled={!loaded || saved}>
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

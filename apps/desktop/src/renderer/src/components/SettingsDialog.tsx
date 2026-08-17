import { useState } from 'react';

interface Props {
  onClose: () => void;
}

/** 设置弹窗：暂以示例开关占位，后续再接入真实配置项 */
export default function SettingsDialog({ onClose }: Props) {
  const [sampleOn, setSampleOn] = useState(false);

  return (
    <div className="settings-mask" onClick={onClose}>
      <div className="settings-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>设置</h3>
        <div className="settings-row">
          <span>示例开关</span>
          <button
            type="button"
            role="switch"
            aria-checked={sampleOn}
            className={'toggle ' + (sampleOn ? 'on' : '')}
            onClick={() => setSampleOn((value) => !value)}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <div className="settings-actions">
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

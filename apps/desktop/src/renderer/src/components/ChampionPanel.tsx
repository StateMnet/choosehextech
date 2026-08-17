import { useEffect, useRef, useState } from 'react';
import type { Build, ChampionEntry } from '@choosehextech/data-core';
import { augmentPlaceholderIcon, championPlaceholderIcon, itemPlaceholderIcon, resolveAugmentIcon, resolveChampionIcon, resolveItemIcon } from '../lib/icons';

export interface PickResult {
  ok: boolean;
  message: string;
}

interface Props {
  champion: ChampionEntry;
  selectedBuild: string;
  augmentIcons?: Record<string, string>;
  championIcons?: Record<string, string>;
  itemIcons?: Record<string, string>;
  onSelectBuild: (buildName: string) => void;
  /** 选人阶段显示「抢选」按钮 */
  pickEnabled?: boolean;
  /** 抢选回调（返回结果用于按钮状态与提示） */
  onPick?: (championId: number) => Promise<PickResult>;
}

function BuildSections({ build, augmentIcons, itemIcons }: { build: Build; augmentIcons?: Record<string, string>; itemIcons?: Record<string, string> }) {
  return (
    <div className="build-block">
      <h2 className="build-name">{build.name}</h2>
      <section className="card">
        <h3>海克斯推荐</h3>
        <ul className="chips">
          {build.hextech.map((name) => (
            <li key={name}>
              <img
                className="chip-icon"
                src={resolveAugmentIcon(name, augmentIcons)}
                alt=""
                onError={(event) => {
                  // 映射图加载失败 → 回退确定性占位图
                  event.currentTarget.src = augmentPlaceholderIcon(name);
                }}
              />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h3>装备推荐</h3>
        <ol className="items">
          {build.items.map((name, index) => (
            <li key={name}>
              <img
                className="item-icon"
                src={resolveItemIcon(name, itemIcons)}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = itemPlaceholderIcon(name);
                }}
              />
              <span>
                {index + 1}. {name}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="card">
        <h3>对局技巧</h3>
        <ul className="tips">
          {build.tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ChampionPanel({
  champion,
  selectedBuild,
  augmentIcons,
  championIcons,
  itemIcons,
  onSelectBuild,
  pickEnabled = false,
  onPick,
}: Props) {
  const build = champion.builds.find((item) => item.name === selectedBuild) ?? champion.builds[0];
  const [pickState, setPickState] = useState<'idle' | 'picking' | 'done' | 'error'>('idle');
  const [pickMessage, setPickMessage] = useState('');
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换英雄时重置抢选状态与提示
  useEffect(() => {
    setPickState('idle');
    setPickMessage('');
  }, [champion.championId]);

  useEffect(() => {
    return () => {
      if (pickTimer.current) clearTimeout(pickTimer.current);
    };
  }, []);

  const handlePick = async (): Promise<void> => {
    if (!onPick) return;
    if (champion.numericId === undefined) {
      setPickState('error');
      setPickMessage('该英雄缺少数字 ID，无法抢选');
      return;
    }
    setPickState('picking');
    setPickMessage('');
    try {
      const result = await onPick(champion.numericId);
      setPickState(result.ok ? 'done' : 'error');
      setPickMessage(result.message);
    } catch (error) {
      console.error('[pick] 调用失败:', error);
      setPickState('error');
      setPickMessage(error instanceof Error ? error.message : String(error));
    }
    if (pickTimer.current) clearTimeout(pickTimer.current);
    pickTimer.current = setTimeout(() => {
      setPickState('idle');
      setPickMessage('');
    }, 2500);
  };

  return (
    <div className="panel">
      <div className="champion-head">
        <img
          className="champion-avatar"
          src={resolveChampionIcon(champion.nameZh, champion.championId, championIcons)}
          alt={champion.nameZh}
          onError={(event) => {
            event.currentTarget.src = championPlaceholderIcon(champion.nameZh);
          }}
        />
        <span className="champion-name">{champion.nameZh}</span>
        <span className="champion-id">{champion.championId}</span>
        {pickEnabled && onPick && (
          <button
            className={'pick-btn ' + pickState}
            onClick={() => void handlePick()}
            disabled={pickState === 'picking'}
            title="立即选择并锁定该英雄"
          >
            {pickState === 'picking' ? '抢选中…' : pickState === 'done' ? '已锁定' : '抢选'}
          </button>
        )}
      </div>
      {pickMessage !== '' && <div className={'pick-feedback ' + pickState}>{pickMessage}</div>}
      <div className="build-tabs">
        {champion.builds.map((item) => (
          <button
            key={item.name}
            className={item.name === build.name ? 'tab active' : 'tab'}
            onClick={() => onSelectBuild(item.name)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="build-hint">点击切换套路方案（单选）</div>
      {build && <BuildSections build={build} augmentIcons={augmentIcons} itemIcons={itemIcons} />}
    </div>
  );
}

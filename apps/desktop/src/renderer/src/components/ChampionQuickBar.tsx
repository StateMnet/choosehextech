import { championPlaceholderIcon, resolveChampionIcon } from '../lib/icons';
import type { QuickChampion } from '../lib/select';

interface Props {
  champions: QuickChampion[];
  championIcons?: Record<string, string>;
  /** 点击查看英雄套路 */
  onSelect: (nameZh: string) => void;
  /** 选人阶段点击备选池英雄直接抢选（交换并锁定） */
  onBenchPick?: (championId: number) => void;
}

/** 快捷英雄栏：己方/队友点击查看；备选池英雄点击直接抢选（交换并锁定） */
export default function ChampionQuickBar({ champions, championIcons, onSelect, onBenchPick }: Props) {
  return (
    <div className="quick-bar">
      {champions.map((champion) => {
        const benchPickable = champion.group === 'bench' && onBenchPick !== undefined && champion.numericId !== undefined;
        return (
          <button
            key={champion.championId}
            className={'quick-champ group-' + champion.group + (benchPickable ? ' bench-pickable' : '')}
            onClick={() => {
              if (benchPickable && champion.numericId !== undefined) {
                onBenchPick!(champion.numericId);
              } else {
                onSelect(champion.nameZh);
              }
            }}
            title={benchPickable ? '点击抢选该英雄' : champion.nameZh}
          >
            <img
              src={resolveChampionIcon(champion.nameZh, champion.championId, championIcons)}
              alt={champion.nameZh}
              onError={(event) => {
                event.currentTarget.src = championPlaceholderIcon(champion.nameZh);
              }}
            />
            <span>{champion.nameZh}</span>
          </button>
        );
      })}
    </div>
  );
}

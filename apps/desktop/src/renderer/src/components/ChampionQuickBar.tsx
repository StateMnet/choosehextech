import { championPlaceholderIcon, resolveChampionIcon } from '../lib/icons';
import type { QuickChampion } from '../lib/select';

interface Props {
  champions: QuickChampion[];
  championIcons?: Record<string, string>;
  onSelect: (nameZh: string) => void;
}

/** 选人阶段的快捷英雄栏：点击头像快速查看对应英雄的套路（分组以头像边框颜色区分） */
export default function ChampionQuickBar({ champions, championIcons, onSelect }: Props) {
  return (
    <div className="quick-bar">
      {champions.map((champion) => (
        <button
          key={champion.championId}
          className={'quick-champ group-' + champion.group}
          onClick={() => onSelect(champion.nameZh)}
          title={champion.nameZh}
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
      ))}
    </div>
  );
}

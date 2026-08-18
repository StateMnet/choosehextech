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

interface ButtonProps {
  champion: QuickChampion;
  championIcons?: Record<string, string>;
  title: string;
  pickable?: boolean;
  onClick: () => void;
}

function QuickChampButton({ champion, championIcons, title, pickable = false, onClick }: ButtonProps) {
  return (
    <button
      className={'quick-champ group-' + champion.group + (pickable ? ' bench-pickable' : '')}
      onClick={onClick}
      title={title}
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
}

/** 快捷英雄栏：己方（我+队友）一行，备选池单独一行（点击备选池英雄直接抢选） */
export default function ChampionQuickBar({ champions, championIcons, onSelect, onBenchPick }: Props) {
  const ally = champions.filter((champion) => champion.group === 'me' || champion.group === 'team');
  const bench = champions.filter((champion) => champion.group === 'bench');

  return (
    <div className="quick-bar-wrap">
      {ally.length > 0 && (
        <>
          <div className="quick-label">己方队伍（已选）</div>
          <div className="quick-row">
            {ally.map((champion) => (
              <QuickChampButton
                key={champion.championId}
                champion={champion}
                championIcons={championIcons}
                title={champion.nameZh}
                onClick={() => onSelect(champion.nameZh)}
              />
            ))}
          </div>
        </>
      )}
      {bench.length > 0 && (
        <>
          <div className="quick-label">备选池（点击可无视客户端倒计时抢选）</div>
          <div className="quick-row">
            {bench.map((champion) => {
              const pickable = onBenchPick !== undefined && champion.numericId !== undefined;
              return (
                <QuickChampButton
                  key={champion.championId}
                  champion={champion}
                  championIcons={championIcons}
                  title={pickable ? '点击抢选该英雄' : champion.nameZh}
                  pickable={pickable}
                  onClick={() => {
                    if (pickable && champion.numericId !== undefined) {
                      onBenchPick!(champion.numericId);
                    } else {
                      onSelect(champion.nameZh);
                    }
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

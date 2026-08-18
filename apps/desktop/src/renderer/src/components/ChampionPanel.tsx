import type { Build, ChampionEntry } from '@choosehextech/data-core';
import { augmentPlaceholderIcon, championPlaceholderIcon, itemPlaceholderIcon, resolveAugmentIcon, resolveChampionIcon, resolveItemIcon } from '../lib/icons';

interface Props {
  champion: ChampionEntry;
  selectedBuild: string;
  augmentIcons?: Record<string, string>;
  championIcons?: Record<string, string>;
  itemIcons?: Record<string, string>;
  onSelectBuild: (buildName: string) => void;
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
          {build.items.map((name) => (
            <li key={name} title={name}>
              <img
                className="item-icon"
                src={resolveItemIcon(name, itemIcons)}
                alt={name}
                onError={(event) => {
                  event.currentTarget.src = itemPlaceholderIcon(name);
                }}
              />
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

export default function ChampionPanel({ champion, selectedBuild, augmentIcons, championIcons, itemIcons, onSelectBuild }: Props) {
  const build = champion.builds.find((item) => item.name === selectedBuild) ?? champion.builds[0];

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
      </div>
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

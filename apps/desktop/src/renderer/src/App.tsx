import { useEffect, useMemo, useState } from 'react';
import type { DataBundle, ChampionEntry } from '@choosehextech/data-core';
import type { SessionState } from '@choosehextech/game-session';
import ChampionPanel from './components/ChampionPanel';
import ChampionQuickBar from './components/ChampionQuickBar';
import { buildQuickChampionList, championByNumericId, defaultBuildName, searchChampions } from './lib/select';

interface AppProps {
  variant?: 'panel' | 'overlay';
  onCollapse?: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  None: '已连接客户端 · 待命',
  Lobby: '大厅',
  Matchmaking: '匹配中',
  ReadyCheck: '准备确认',
  ChampSelect: '英雄选择阶段',
  GameStart: '进入游戏',
  InProgress: '游戏中',
  WaitingForStats: '等待结算',
  PreEndOfGame: '结算',
  EndOfGame: '对局结束',
  Reconnect: '重连中',
  Unknown: '未知状态',
};

export default function App({ variant = 'panel', onCollapse }: AppProps) {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedBuild, setSelectedBuild] = useState('');

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.choosehextech.onSessionState((state) => {
      if (mounted) setSession(state);
    });
    void window.choosehextech.getBundle().then((data) => {
      if (mounted) setBundle(data);
    });
    // 兜底：主动拉取一次当前状态，避免窗口加载前错过的首发消息
    void window.choosehextech.getState().then((state) => {
      if (mounted) setSession(state);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const autoChampion = useMemo(() => {
    if (!bundle || !session || session.myChampionId === null) return undefined;
    return championByNumericId(bundle, session.myChampionId);
  }, [bundle, session]);

  const results = useMemo(() => (bundle ? searchChampions(bundle, query) : []), [bundle, query]);

  const quickChampions = useMemo(
    () => (bundle && session ? buildQuickChampionList(bundle, session) : []),
    [bundle, session],
  );

  const displayChampion: ChampionEntry | undefined = useMemo(() => {
    if (query.trim() !== '') return results[0];
    return autoChampion;
  }, [query, results, autoChampion]);

  useEffect(() => {
    // 英雄切换时默认选中第一个套路
    if (displayChampion) setSelectedBuild(defaultBuildName(displayChampion.builds));
    else setSelectedBuild('');
  }, [displayChampion?.championId]);

  const phase = session?.phase ?? 'None';
  // session 为空才是真的未连接；phase=None 是「已连接但未在对局流程中」
  const connected = session !== null;
  const summonerName = session?.summonerName ?? null;
  const phaseLabel = connected ? (PHASE_LABELS[phase] ?? phase) : '未连接客户端';

  // 右上角详细状态：队列 + 当前英雄
  let statusDetail = connected ? '' : '正在自动重连客户端…';
  if (connected) {
    const parts: string[] = [];
    if (session.queueId !== null) {
      parts.push((session.isTargetMode ? '目标队列' : '非目标队列') + ' · 队列 ' + session.queueId);
    }
    if (session.myChampionId !== null && session.myChampionId > 0) {
      parts.push('当前英雄：' + (autoChampion ? autoChampion.nameZh : '英雄 ID ' + session.myChampionId));
    }
    if (!session.isTargetMode) parts.push('数据供参考');
    statusDetail = parts.join(' · ');
  }

  return (
    <div className={variant === 'overlay' ? 'app overlay-variant' : 'app'}>
      {variant === 'overlay' && (
        <div className="overlay-header">
          <span className="overlay-drag">◇ 海克斯浮窗</span>
          <button className="overlay-btn" onClick={onCollapse}>
            ◀ 收起
          </button>
        </div>
      )}
      <header className="status-bar">
        <div className="conn">
          <span className={'conn-dot ' + (connected ? 'online' : 'offline')} />
          <span className="conn-name">{connected ? (summonerName ?? '已连接') : '未连接'}</span>
        </div>
        <div className="status-detail">
          <span className={'phase phase-' + phase}>{phaseLabel}</span>
          {statusDetail !== '' && <span className="status-sub">{statusDetail}</span>}
        </div>
      </header>

      {phase === 'ChampSelect' && <div className="hint">海克斯强化在游戏内选择，先看推荐做好规划</div>}

      {quickChampions.length > 0 && (
        <ChampionQuickBar champions={quickChampions} championIcons={bundle?.championIcons} onSelect={(nameZh) => setQuery(nameZh)} />
      )}

      <div className="search-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索英雄 / 套路名"
        />
        {query !== '' && (
          <button className="clear" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </div>

      {query.trim() !== '' && results.length > 1 && (
        <ul className="search-results">
          {results.map((champion) => (
            <li key={champion.championId} onClick={() => setQuery(champion.nameZh)}>
              {champion.nameZh}（{champion.builds.length} 个套路）
            </li>
          ))}
        </ul>
      )}

      {!bundle && (
        <div className="empty">正在加载数据包…（若长时间无响应请先运行 pnpm build:data）</div>
      )}
      {bundle && !displayChampion && (
        <div className="empty">
          {session && session.myChampionId !== null
            ? '已识别当前英雄（ID ' + session.myChampionId + '），但它暂不在数据表中：占位样例仅覆盖 10 个英雄。可在上方搜索其他英雄。'
            : '未找到英雄数据。可在上方搜索，或等待进入英雄选择阶段自动识别。'}
        </div>
      )}
      {bundle && displayChampion && (
        <ChampionPanel
          champion={displayChampion}
          augmentIcons={bundle.augmentIcons}
          championIcons={bundle.championIcons}
          itemIcons={bundle.itemIcons}
          selectedBuild={selectedBuild}
          onSelectBuild={setSelectedBuild}
        />
      )}

      <footer className="footer">
        内容由社区维护，仅供参考 · 数据版本 {bundle?.dataVersion ?? '—'} · 占位样例
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, remove, onDisconnect } from 'firebase/database';
import './AomitsuRoom.css';

// ユーザーアバターの定義（App.jsxと統一）
const USER_ICONS = [
  { id: 'girl1', name: '女の子1', src: '/icons/girl1.png' },
  { id: 'girl2', name: '女の子2', src: '/icons/girl2.png' },
  { id: 'girl3', name: '女の子3', src: '/icons/girl3.png' },
  { id: 'girl4', name: '女の子4', src: '/icons/girl4.png' },
  { id: 'boy1', name: '男の子1', src: '/icons/boy1.png' },
  { id: 'boy2', name: '男の子2', src: '/icons/boy2.png' },
  { id: 'boy3', name: '男の子3', src: '/icons/boy3.png' },
  { id: 'boy4', name: '男の子4', src: '/icons/boy4.png' },
];

const GOD_QUOTES = [
  "フン、我のフワフワの毛並みに見とれるがよい！",
  "なにか我に美味いものでも持ってきたか？",
  "お主ら、仲良く遊んでおるか？良いことじゃ。",
  "ゴロゴロ……いや、喉など鳴らしておらんぞ！",
  "我をモフモフしたな？特別に運を授けてやろう！",
  "ふむ、人間どもよ。我の美しさを讃えるがよいニャ！",
  "退屈じゃ……誰か我をモフモフせぬか？"
];

function AomitsuRoom({ db, userName, userIcon }) {
  const [players, setPlayers] = useState({});
  const [godQuote, setGodQuote] = useState("");
  const [walkingStates, setWalkingStates] = useState({});
  const prevPlayersRef = useRef({});
  const walkTimersRef = useRef({});
  const quoteTimerRef = useRef(null);
  const roomRef = useRef(null);

  // 1. 部屋の参加者一覧をFirebaseとリアルタイム同期 ＆ 自動退室の制御
  useEffect(() => {
    const playersRef = ref(db, 'roomPlayers');
    const myPlayerRef = ref(db, `roomPlayers/${userName}`);
    
    // 入室処理
    const enterRoom = () => {
      const initialX = 20 + Math.random() * 60; // 20%〜80%の間
      const initialY = 30 + Math.random() * 50; // 30%〜80%の間
      
      set(myPlayerRef, {
        userIcon: userIcon,
        x: initialX,
        y: initialY,
        lastActive: Date.now()
      });
      
      // 接続切断時に自動で自分をFirebaseから削除する設定
      onDisconnect(myPlayerRef).remove().catch(err => {
        console.error("onDisconnect registration error:", err);
      });
    };

    // 退室処理
    const exitRoom = () => {
      remove(myPlayerRef).catch(err => {
        console.error("Firebase exit error:", err);
      });
    };

    // 初期入室
    enterRoom();

    // プレイヤーの動きを同期
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const activePlayers = {};
        
        // 5分以上アクションがない幽霊プレイヤーを除外してセット
        Object.keys(data).forEach(key => {
          const p = data[key];
          if (now - p.lastActive < 5 * 60 * 1000) {
            activePlayers[key] = p;
          }
        });
        
        setPlayers(activePlayers);
      } else {
        setPlayers({});
      }
    });

    // 案A: Page Visibility API による画面の表示・非表示の連携
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 画面が隠れたら（バックグラウンドに回ったら）即座に自動退室
        exitRoom();
      } else if (document.visibilityState === 'visible') {
        // 画面が再び見えたら（復帰したら）自動で初期位置に再入室
        enterRoom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // クリーンアップ（アンマウント時）
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      exitRoom();
    };
  }, [db, userName, userIcon]);

  // 1.5. プレイヤーの座標変化から歩行状態（方向・フレーム）を判定・アニメーション
  useEffect(() => {
    const newWalkingStates = { ...walkingStates };
    let hasChanged = false;

    Object.keys(players).forEach(name => {
      const player = players[name];
      const prevPlayer = prevPlayersRef.current[name];
      if (!prevPlayer) {
        prevPlayersRef.current[name] = player;
        return;
      }

      const dX = player.x - prevPlayer.x;
      const dY = player.y - prevPlayer.y;

        // 有意な移動のみ検知（座標が0.5%以上動いた時）
        if (Math.abs(dX) > 0.5 || Math.abs(dY) > 0.5) {
          let dir = 'down';
          if (Math.abs(dX) > Math.abs(dY)) {
            dir = dX > 0 ? 'right' : 'left';
          } else {
            dir = dY > 0 ? 'down' : 'up';
          }

          newWalkingStates[name] = {
            isWalking: true,
            direction: dir,
            frame: 0
          };
          hasChanged = true;

          // 既存のタイマーをクリアして上書き
          if (walkTimersRef.current[name]) {
            clearInterval(walkTimersRef.current[name].interval);
            clearTimeout(walkTimersRef.current[name].timeout);
          }

          // 150msごとにコマ（0〜3）を切り替え
          let currentFrame = 0;
          const intervalId = setInterval(() => {
            currentFrame = (currentFrame + 1) % 4;
            setWalkingStates(prev => ({
              ...prev,
              [name]: {
                ...prev[name],
                frame: currentFrame
              }
            }));
          }, 150);

          // 移動完了（800ms後）に歩行を終了し、静止フレームに戻す
          const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            setWalkingStates(prev => ({
              ...prev,
              [name]: {
                isWalking: false,
                direction: dir,
                frame: 0
              }
            }));
          }, 800);

          walkTimersRef.current[name] = {
            interval: intervalId,
            timeout: timeoutId
          };
        }
    });

    prevPlayersRef.current = players;
    if (hasChanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWalkingStates(newWalkingStates);
    }
  }, [players]);

  // コンポーネント消滅時にすべてのタイマーを解除
  useEffect(() => {
    return () => {
      Object.keys(walkTimersRef.current).forEach(name => {
        if (walkTimersRef.current[name]) {
          clearInterval(walkTimersRef.current[name].interval);
          clearTimeout(walkTimersRef.current[name].timeout);
        }
      });
    };
  }, []);

  // 2. 画面タップでアバターを移動
  const handleRoomClick = (e) => {
    // ネコ神様をクリックした場合は移動させない
    if (e.target.closest('.neko-god-npc')) return;

    const rect = roomRef.current.getBoundingClientRect();
    
    // タッチデバイスとマウスの両方に対応してタップ位置を取得
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (clientX === undefined || clientY === undefined) return;

    // クリック位置を％に変換（どの端末で見ても同じ位置になるようにする）
    const clickX = ((clientX - rect.left) / rect.width) * 100;
    const clickY = ((clientY - rect.top) / rect.height) * 100;

    // Firebaseの自分の座標を更新（他の人にトコトコ歩くアニメーションが走る）
    set(ref(db, `roomPlayers/${userName}`), {
      userIcon: userIcon,
      x: Math.max(5, Math.min(95, clickX)), // 画面外にはみ出ないようガード
      y: Math.max(15, Math.min(85, clickY)), // 画面外にはみ出ないようガード
      lastActive: Date.now()
    });
  };

  // 3. 神様をクリックしてモフモフ・喋らせる
  const handleGodClick = () => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
    }
    const randomIndex = Math.floor(Math.random() * GOD_QUOTES.length);
    setGodQuote(GOD_QUOTES[randomIndex]);

    // 3.5秒後に吹き出しを消す
    quoteTimerRef.current = setTimeout(() => {
      setGodQuote("");
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  return (
    <div 
      className="aomitsu-room-container" 
      ref={roomRef}
      onMouseDown={handleRoomClick}
    >
      {/* チャットへ戻るフローティングボタン（ひろばの世界観を壊さないお洒落デザイン） */}
      <a 
        href="/" 
        className="room-back-btn"
        style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '2px solid #8e7f72',
          borderRadius: '25px',
          padding: '8px 16px',
          color: '#3e322b',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'sans-serif',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.background = '#ffffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
        }}
      >
        <span style={{ fontSize: '1rem' }}>←</span> LINEチャットに戻る
      </a>

      {/* インテリアのラグ */}
      <div className="room-rug"></div>

      {/* ネコ神様 NPC */}
      <div className="neko-god-npc" onClick={handleGodClick}>
        <img src="/icons/neko/default.png" alt="黒猫の神様" />
      </div>

      {/* 神様の吹き出し */}
      {godQuote && (
        <div className="god-bubble">
          {godQuote}
        </div>
      )}

      {/* 部屋の中にいるお友達アバターの描画 */}
      {Object.keys(players).map((name) => {
        const player = players[name];
        const isMe = name === userName;
        
        // 基本画像（フォールバック用）: スプライトがない場合は真正面コマ0を使用
        const fallbackSrc = `/sprites/${player.userIcon}-down-0.png`;
        
        // ローカル歩行状態の取得
        const state = walkingStates[name] || { isWalking: false, direction: 'down', frame: 0 };
        let imgName = `${player.userIcon}-down-0.png`;
        
        if (state.isWalking) {
          // 歩行中: 方向とコマを反映
          imgName = `${player.userIcon}-${state.direction}-${state.frame}.png`;
        } else {
          // 停止中: 最後に歩いていた方向のコマ0
          imgName = `${player.userIcon}-${state.direction}-0.png`;
        }
        
        const iconSrc = `/sprites/${imgName}`;

        return (
          <div 
            key={name}
            className={`avatar-node ${isMe ? 'is-me' : ''}`}
            style={{ 
              left: `${player.x}%`, 
              top: `${player.y}%` 
            }}
          >
            <img 
              src={iconSrc} 
              className="avatar-node-img" 
              alt={name}
              onError={(e) => {
                // 画像ファイル（歩行コマなど）が存在しない場合は、完全正面コマ0に自動フォールバック
                if (e.target.src !== window.location.origin + fallbackSrc) {
                  e.target.src = fallbackSrc;
                }
              }}
            />
            <span className="avatar-name-tag">
              {isMe ? "あなた" : name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default AomitsuRoom;

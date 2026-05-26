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
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);
  
  // 自分用ローカルアバターの制御RefおよびState
  const [myPos, setMyPos] = useState({ x: 50, y: 50 });
  const myPosRef = useRef({ x: 50, y: 50 });
  const activeKeysRef = useRef(new Set()); // 押されているPCキーのセット
  const activeDirRef = useRef(null); // 押されているスマホ十字キーの方向
  const lastSentTimeRef = useRef(0); // Firebaseへの最終送信タイムスタンプ
  const myLastDirectionRef = useRef('down'); // 自分が最後に選択した歩行方向
  const myCurrentDirectionRef = useRef(null); // 現在入力されている方向（静止時はnull）
  const animFrameRef = useRef(0); // 自分のアニメーションフレーム (Reactステート遅延を回避するためRefで同期管理)
  
  const prevPlayersRef = useRef({});
  const walkTimersRef = useRef({});
  const quoteTimerRef = useRef(null);
  const roomRef = useRef(null);

  // 1. 部屋の参加者一覧をFirebaseとリアルタイム同期 ＆ 自動退室の制御
  useEffect(() => {
    const playersRef = ref(db, 'roomPlayers');
    const myPlayerRef = ref(db, `roomPlayers/${userName}`);
    
    // 入室処理 (初期位置の決定)
    const enterRoom = () => {
      const initialX = 20 + Math.random() * 60; // 20%〜80%の間
      const initialY = 30 + Math.random() * 50; // 30%〜80%の間
      
      setMyPos({ x: initialX, y: initialY });
      myPosRef.current = { x: initialX, y: initialY };

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

    // Page Visibility API による画面の表示・非表示の連携
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 画面が隠れたら即座に自動退室
        exitRoom();
      } else if (document.visibilityState === 'visible') {
        // 画面が再び見えたら自動で初期位置に再入室
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

  // 1.5. 自分がキーや十字キーで動いた際のローカル制御 ＆ Firebaseスロットリング同期
  useEffect(() => {
    let moveInterval = null;
    let animInterval = null;

    const SPEED = 0.55; // 1フレームあたりの移動速度(%)
    const SEND_INTERVAL = 110; // Firebaseへの送信間隔(ms)

    // Firebaseへの同期処理 (間引き送信)
    const syncPositionToFirebase = (force = false) => {
      const now = Date.now();
      if (force || now - lastSentTimeRef.current >= SEND_INTERVAL) {
        // 現在の入力状態から向きと歩行状態を決定
        let currentDir = null;
        if (activeKeysRef.current && activeKeysRef.current.has) {
          if (activeKeysRef.current.has('arrowup') || activeKeysRef.current.has('w')) currentDir = 'up';
          else if (activeKeysRef.current.has('arrowdown') || activeKeysRef.current.has('s')) currentDir = 'down';
          else if (activeKeysRef.current.has('arrowleft') || activeKeysRef.current.has('a')) currentDir = 'left';
          else if (activeKeysRef.current.has('arrowright') || activeKeysRef.current.has('d')) currentDir = 'right';
        }
        if (activeDirRef.current) {
          currentDir = activeDirRef.current;
        }

        const isWalking = currentDir !== null;
        const direction = currentDir || myLastDirectionRef.current || 'down';

        const myPlayerRef = ref(db, `roomPlayers/${userName}`);
        set(myPlayerRef, {
          userIcon: userIcon,
          x: myPosRef.current.x,
          y: myPosRef.current.y,
          direction: direction,
          isWalking: isWalking,
          lastActive: now
        });
        lastSentTimeRef.current = now;
      }
    };

    // リアルタイム移動タイマー (24msごとに更新して滑らかさを極限に)
    moveInterval = setInterval(() => {
      let dX = 0;
      let dY = 0;
      let dir = null;

      // PCキーボード入力判定から移動方向とキー判定
      if (activeKeysRef.current.has('arrowup') || activeKeysRef.current.has('w')) {
        dY -= 1;
        dir = 'up';
      }
      if (activeKeysRef.current.has('arrowdown') || activeKeysRef.current.has('s')) {
        dY += 1;
        dir = 'down';
      }
      if (activeKeysRef.current.has('arrowleft') || activeKeysRef.current.has('a')) {
        dX -= 1;
        dir = 'left';
      }
      if (activeKeysRef.current.has('arrowright') || activeKeysRef.current.has('d')) {
        dX += 1;
        dir = 'right';
      }

      // スマホ十字キー入力判定（スマホ入力がアクティブな場合はPC入力を上書き）
      if (activeDirRef.current) {
        dir = activeDirRef.current;
        if (dir === 'up') dY -= 1;
        if (dir === 'down') dY += 1;
        if (dir === 'left') dX -= 1;
        if (dir === 'right') dX += 1;
      }

      myCurrentDirectionRef.current = dir; // 現在入力されている方向をRefに保存

      if (dX !== 0 || dY !== 0) {
        // 斜め移動時の速度の正規化
        const length = Math.sqrt(dX * dX + dY * dY);
        // 縦長コンテナ(最大幅430px)による横移動の物理ピクセル速度の低下を100%解消するため、
        // アスペクト比補正（通常、縦の高さは横幅の約2.0倍）を横方向の速度に適用してキビキビとした等速移動を実現します！
        const ASPECT_RATIO_ADJUST = 2.0;
        const nextX = myPosRef.current.x + ((dX / length) * SPEED) * ASPECT_RATIO_ADJUST;
        const nextY = myPosRef.current.y + (dY / length) * SPEED;

        // マップの壁衝突判定（アバターの移動可能領域）
        const clampedX = Math.max(3, Math.min(97, nextX));
        const clampedY = Math.max(10, Math.min(88, nextY));

        myPosRef.current = { x: clampedX, y: clampedY };
        setMyPos({ x: clampedX, y: clampedY }); // これにより瞬時に再描画が走る

        if (dir) {
          myLastDirectionRef.current = dir;
        }

        syncPositionToFirebase();
      } else {
        // 静止したとき、最後の静止座標を確実に同期
        syncPositionToFirebase(true);
      }
    }, 24);

    // 歩行のパラパラ漫画コマ送りアニメーションタイマー (130ms)
    animInterval = setInterval(() => {
      const isMoving = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
      if (isMoving) {
        // 歩行中は直立(0)を除外し、1 -> 2 -> 3 -> 1 と元気に足を動かし続ける
        let nextFrame = animFrameRef.current + 1;
        if (nextFrame > 3 || nextFrame < 1) {
          nextFrame = 1;
        }
        animFrameRef.current = nextFrame;
      }
    }, 130);

    // PCキーボードイベントリスナー
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        // スペースキーなどでの不要な画面スクロールを防止
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          e.preventDefault();
        }
        if (!activeKeysRef.current.has(key)) {
          activeKeysRef.current.add(key);
          forceUpdate(); // 即座に再レンダリングを実行して向きを0msで変える！
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (activeKeysRef.current.has(key)) {
          activeKeysRef.current.delete(key);
          forceUpdate(); // 即座に再レンダリングを実行！
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearInterval(moveInterval);
      clearInterval(animInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [userName, userIcon, db]);

  // 1.8. 【他人の移動同期】 Firebaseの向き・歩行状態をリアルタイム同期
  useEffect(() => {
    const newWalkingStates = { ...walkingStates };
    let hasChanged = false;

    Object.keys(players).forEach(name => {
      // 自分以外のプレイヤーのみ同期歩行アニメの対象にする
      if (name.normalize('NFC') === userName.normalize('NFC')) return;

      const player = players[name];
      if (!player) return;

      const isWalking = player.isWalking || false;
      const direction = player.direction || 'down';

      // 以前のステートを取得
      const currentState = walkingStates[name] || { isWalking: false, direction: 'down', frame: 0 };

      // 向きや歩行状態が変わった場合のみステート更新
      if (currentState.isWalking !== isWalking || currentState.direction !== direction) {
        newWalkingStates[name] = {
          isWalking: isWalking,
          direction: direction,
          frame: isWalking ? (currentState.frame || 0) : 0
        };
        hasChanged = true;

        // 歩行中のコマ送りアニメーションタイマーの管理
        if (isWalking) {
          // すでにタイマーがあればクリア
          if (walkTimersRef.current[name]) {
            clearInterval(walkTimersRef.current[name]);
          }
          
          let currentFrame = currentState.frame || 0;
          walkTimersRef.current[name] = setInterval(() => {
            currentFrame = (currentFrame + 1) % 4;
            setWalkingStates(prev => {
              if (prev[name] && prev[name].isWalking) {
                return {
                  ...prev,
                  [name]: {
                    ...prev[name],
                    frame: currentFrame
                  }
                };
              }
              return prev;
            });
          }, 130);
        } else {
          // 静止した場合はタイマーを削除
          if (walkTimersRef.current[name]) {
            clearInterval(walkTimersRef.current[name]);
            delete walkTimersRef.current[name];
          }
        }
      }
    });

    if (hasChanged) {
      setWalkingStates(newWalkingStates);
    }
  }, [players, userName]);

  // アバタータイマーの完全クリーンアップ
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

  // 3. 神様をクリックしてモフモフ・喋らせる
  const handleGodClick = () => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
    }
    const randomIndex = Math.floor(Math.random() * GOD_QUOTES.length);
    setGodQuote(GOD_QUOTES[randomIndex]);

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

      {/* PC用の操作案内ラベル */}
      <div className="room-instruction-label">
        ⌨️ 矢印キー または WASDキーで移動できるぞ！
      </div>

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
        if (!player) return null; // 安全対策: 読み込み途中でプレイヤーが存在しない場合は描画をスキップ

        const isMe = name.normalize('NFC') === userName.normalize('NFC');
        const currentUserIcon = player.userIcon || userIcon || 'girl1'; // アイコンの安全なフォールバック
        
        // 自分の位置は超低遅延ローカル座標、他人はFirebase同期座標を使用
        const posX = isMe ? myPos.x : (player.x !== undefined ? player.x : 50);
        const posY = isMe ? myPos.y : (player.y !== undefined ? player.y : 50);

        // 基本画像（フォールバック用）: スプライトがない場合は真正面コマ0を使用
        const fallbackSrc = `/sprites/${currentUserIcon}-down-0.png`;
        
        // 歩行状態の取得
        let isWalking = false;
        let direction = 'down';
        let frame = 0;

        if (isMe) {
          // 自分自身の場合は、Refから同期的に最新の入力状態を決定（Reactステートの遅延を100%回避）
          const currentDir = myCurrentDirectionRef.current;
          isWalking = currentDir !== null;

          // 歩き始めた瞬間、直立(0)から即座に歩行コマ(1)に初期化する
          if (isWalking && (animFrameRef.current === 0 || animFrameRef.current > 3)) {
            animFrameRef.current = 1;
          }

          direction = currentDir || myLastDirectionRef.current || 'down';
          // 歩いている間は 1 -> 2 -> 3 をループし、ボタンを離して止まった瞬間だけ 0 (直立)にする！
          frame = isWalking ? animFrameRef.current : 0;
        } else {
          // 他人の場合は、Firebase同期スレッドで更新される walkingStates または Firebaseの最新値を使用
          const state = walkingStates[name] || { isWalking: false, direction: 'down', frame: 0 };
          isWalking = player.isWalking !== undefined ? player.isWalking : state.isWalking;
          direction = player.direction || state.direction || 'down';
          frame = state.frame;
        }

        let imgName = `${currentUserIcon}-down-0.png`;
        if (isWalking) {
          imgName = `${currentUserIcon}-${direction}-${frame}.png`;
        } else {
          imgName = `${currentUserIcon}-${direction}-0.png`;
        }
        
        const iconSrc = `/sprites/${imgName}`;

        return (
          <div 
            key={name}
            className={`avatar-node ${isMe ? 'is-me' : ''}`}
            style={{ 
              left: `${posX}%`, 
              top: `${posY}%` 
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

      {/* スマホ用のバーチャル十字キー（タッチ操作） */}
      <div className="room-virtual-dpad">
        <button 
          className="dpad-btn dpad-up" 
          onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'up'; forceUpdate(); }} 
          onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'up'; forceUpdate(); }}
          onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
        >▲</button>
        <div className="dpad-row-middle">
          <button 
            className="dpad-btn dpad-left" 
            onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'left'; forceUpdate(); }} 
            onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
            onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'left'; forceUpdate(); }}
            onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          >◀</button>
          <div className="dpad-center-hub"></div>
          <button 
            className="dpad-btn dpad-right" 
            onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'right'; forceUpdate(); }} 
            onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
            onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'right'; forceUpdate(); }}
            onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          >▶</button>
        </div>
        <button 
          className="dpad-btn dpad-down" 
          onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'down'; forceUpdate(); }} 
          onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'down'; forceUpdate(); }}
          onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
        >▼</button>
      </div>
      {/* 全アバター画像のプリロード（チラつき・一瞬消える現象を100%防止する最強の仕組み） */}
      <div style={{ display: 'none' }}>
        {['down', 'up', 'left', 'right'].map(dir => 
          [0, 1, 2, 3].map(f => (
            <img key={`${dir}-${f}`} src={`/sprites/${userIcon}-${dir}-${f}.png`} alt="preload" />
          ))
        )}
      </div>
    </div>
  );
}

export default AomitsuRoom;

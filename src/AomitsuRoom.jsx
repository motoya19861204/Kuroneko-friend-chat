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
  
  // 自分用ローカルアバターの制御RefおよびState（ESLint/React19準拠の完全なReactステート）
  const [myPos, setMyPos] = useState({ x: 50, y: 50 });
  const [myDirection, setMyDirection] = useState('down');
  const [myIsWalking, setMyIsWalking] = useState(false);
  const [myFrame, setMyFrame] = useState(0);

  const myPosRef = useRef({ x: 50, y: 50 });
  const activeKeysRef = useRef(new Set()); // 押されているPCキーのセット
  const activeDirRef = useRef(null); // 押されているスマホ十字キーの方向
  const lastSentTimeRef = useRef(0); // Firebaseへの最終送信タイムスタンプ
  
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
        exitRoom();
      } else if (document.visibilityState === 'visible') {
        enterRoom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

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

    const SEND_INTERVAL = 110; // Firebaseへの送信間隔(ms)

    // Firebaseへの同期処理 (間引き送信)
    const syncPositionToFirebase = (force = false, currentDir = null, isWalkingNow = false) => {
      const now = Date.now();
      if (force || now - lastSentTimeRef.current >= SEND_INTERVAL) {
        const direction = currentDir || 'down';

        const myPlayerRef = ref(db, `roomPlayers/${userName}`);
        set(myPlayerRef, {
          userIcon: userIcon,
          x: myPosRef.current.x,
          y: myPosRef.current.y,
          direction: direction,
          isWalking: isWalkingNow,
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

      const walking = dir !== null;
      setMyIsWalking(walking);

      if (dir) {
        setMyDirection(dir);
      } else {
        setMyFrame(0); // 止まったら即直立コマに戻す
      }

      if (dX !== 0 || dY !== 0) {
        // 斜め移動時の速度の正規化
        const length = Math.sqrt(dX * dX + dY * dY);
        
        // 1フレーム(24ms)あたりの移動速度を物理ピクセル（px）で定義
        // LocalRoom(16msあたり4.5px = 0.281px/ms)と物理速度を完全に同期するため、
        // 0.281 * 24ms = 約6.75px に設定します！これで完璧な等速移動になります。
        const SPEED_PX = 6.75;
        
        // コンテナの実際のピクセルサイズを取得（取得できない場合はデフォルト幅430px, 高さ850pxをフォールバック）
        const containerWidth = roomRef.current ? roomRef.current.clientWidth : 430;
        const containerHeight = roomRef.current ? roomRef.current.clientHeight : 850;
        
        // ピクセル単位 of 移動ベクトルを算出
        const vx = (dX / length) * SPEED_PX;
        const vy = (dY / length) * SPEED_PX;
        
        // 物理ピクセル移動量をパーセント座標に変換して現在の座標に加算
        const nextX = myPosRef.current.x + (vx / containerWidth) * 100;
        const nextY = myPosRef.current.y + (vy / containerHeight) * 100;

        // マップの壁衝突判定（アバターの移動可能領域）
        const clampedX = Math.max(3, Math.min(97, nextX));
        const clampedY = Math.max(10, Math.min(88, nextY));

        myPosRef.current = { x: clampedX, y: clampedY };
        setMyPos({ x: clampedX, y: clampedY }); // これにより瞬時に再描画が走る

        syncPositionToFirebase(false, dir || myDirection, walking);
      } else {
        // 静止したとき、最後の静止座標を確実に同期
        syncPositionToFirebase(true, myDirection, false);
      }
    }, 24);

    // 歩行のパラパラ漫画コマ送りアニメーションタイマー (130ms)
    animInterval = setInterval(() => {
      const isMoving = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
      if (isMoving) {
        // 歩行中は直立(0)を除外し、1 -> 2 -> 3 -> 1 と元気に足を動かし続ける
        setMyFrame(f => {
          let nextFrame = f + 1;
          if (nextFrame > 3 || nextFrame < 1) {
            nextFrame = 1;
          }
          return nextFrame;
        });
      }
    }, 130);

    // PCキーボードイベントリスナー
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          e.preventDefault();
        }
        if (!activeKeysRef.current.has(key)) {
          activeKeysRef.current.add(key);
          
          let dir = 'down';
          if (['arrowup', 'w'].includes(key)) dir = 'up';
          if (['arrowdown', 's'].includes(key)) dir = 'down';
          if (['arrowleft', 'a'].includes(key)) dir = 'left';
          if (['arrowright', 'd'].includes(key)) dir = 'right';

          setMyDirection(dir);
          setMyIsWalking(true);
          setMyFrame(1); // 即座に歩行フレームを1にする
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (activeKeysRef.current.has(key)) {
          activeKeysRef.current.delete(key);
          const isMovingNow = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
          setMyIsWalking(isMovingNow);
          if (!isMovingNow) {
            setMyFrame(0); // 完全にキーが離されたら即座に直立に戻す
          }
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
  }, [userName, userIcon, db, myDirection]);

  // 1.8. 【他人の移動同期】 Firebaseの向き・歩行状態をリアルタイム同期
  useEffect(() => {
    const activeNames = Object.keys(players).filter(name => name.normalize('NFC') !== userName.normalize('NFC'));

    activeNames.forEach(name => {
      const player = players[name];
      if (!player) return;

      const isWalkingVal = player.isWalking || false;
      const directionVal = player.direction || 'down';

      // 関数型ステート更新を徹底し、ESLint の render 内 ref アクセス / 同期 setState を100%回避！
      setWalkingStates(prev => {
        const currentState = prev[name] || { isWalking: false, direction: 'down', frame: 0 };
        if (currentState.isWalking !== isWalkingVal || currentState.direction !== directionVal) {
          // 歩行開始時のタイマー処理
          if (isWalkingVal) {
            if (walkTimersRef.current[name]) {
              clearInterval(walkTimersRef.current[name]);
            }
            
            let currentFrame = currentState.frame || 0;
            walkTimersRef.current[name] = setInterval(() => {
              currentFrame = (currentFrame + 1) % 4;
              setWalkingStates(p => {
                if (p[name] && p[name].isWalking) {
                  return {
                    ...p,
                    [name]: { ...p[name], frame: currentFrame }
                  };
                }
                return p;
              });
            }, 130);
          } else {
            // 静止した場合はタイマーを削除
            if (walkTimersRef.current[name]) {
              clearInterval(walkTimersRef.current[name]);
              delete walkTimersRef.current[name];
            }
          }

          return {
            ...prev,
            [name]: {
              isWalking: isWalkingVal,
              direction: directionVal,
              frame: isWalkingVal ? (currentState.frame || 0) : 0
            }
          };
        }
        return prev;
      });
    });

    // プレイヤーリストからいなくなった人のタイマーをクリーンアップ
    Object.keys(walkTimersRef.current).forEach(name => {
      if (!activeNames.includes(name)) {
        clearInterval(walkTimersRef.current[name]);
        delete walkTimersRef.current[name];
      }
    });

  }, [players, userName]);

  // アバタータイマーの完全クリーンアップ
  useEffect(() => {
    const timers = walkTimersRef.current;
    return () => {
      Object.keys(timers).forEach(name => {
        if (timers[name]) {
          clearInterval(timers[name]);
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

  // スマホ十字キー開始・終了のタップイベント
  const handleDpadStart = (dir) => {
    activeDirRef.current = dir;
    setMyDirection(dir);
    setMyIsWalking(true);
    setMyFrame(1);
  };

  const handleDpadEnd = () => {
    activeDirRef.current = null;
    const isMovingNow = activeKeysRef.current.size > 0;
    setMyIsWalking(isMovingNow);
    if (!isMovingNow) {
      setMyFrame(0);
    }
  };

  return (
    <div 
      className="aomitsu-room-container" 
      ref={roomRef}
    >
      {/* チャットへ戻るフローティングボタン */}
      <a 
        href="/" 
        className="room-back-btn"
      >
        <span>←</span> LINEチャットに戻る
      </a>

      {/* PC用の操作案内ラベル */}
      <div className="room-instruction-label">
        ⌨️ 矢印キー または WASDキーで移動できるぞ！
      </div>

      {/* インテリアのラグ */}
      <div className="room-rug"></div>

      {/* ネコジャンプ ゲーム機 (アーケード筐体) */}
      <a 
        href="/neko-jump/index.html?from=room" 
        className="arcade-cabinet"
        title="ネコジャンプで遊ぶ"
      >
        <span className="arcade-screen-text">NEKO JUMP</span>
        <div className="arcade-cabinet-sprite">🎮</div>
      </a>

      {/* ネコ神様 NPC */}
      <div className="neko-god-npc" onClick={handleGodClick}>
        <img src="/icons/neko/default.png" alt="黒猫の神様" draggable="false" />
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
        if (!player) return null;

        const isMe = name.normalize('NFC') === userName.normalize('NFC');
        const currentUserIcon = player.userIcon || userIcon || 'girl1';
        
        // 自分の位置は超低遅延ローカル座標、他人はFirebase同期座標を使用
        const posX = isMe ? myPos.x : (player.x !== undefined ? player.x : 50);
        const posY = isMe ? myPos.y : (player.y !== undefined ? player.y : 50);

        // 基本画像（フォールバック用）: スプライトがない場合は真正面コマ0を使用
        const fallbackSrc = `/sprites/${currentUserIcon}-down-0.png`;
        
        // 歩行状態の取得
        let isWalkingVal = false;
        let directionVal = 'down';
        let frameVal = 0;

        if (isMe) {
          isWalkingVal = myIsWalking;
          directionVal = myDirection;
          frameVal = myIsWalking ? myFrame : 0;
        } else {
          const state = walkingStates[name] || { isWalking: false, direction: 'down', frame: 0 };
          isWalkingVal = player.isWalking !== undefined ? player.isWalking : state.isWalking;
          directionVal = player.direction || state.direction || 'down';
          frameVal = state.frame;
        }

        let imgName = `${currentUserIcon}-down-0.png`;
        if (isWalkingVal) {
          imgName = `${currentUserIcon}-${directionVal}-${frameVal}.png`;
        } else {
          imgName = `${currentUserIcon}-${directionVal}-0.png`;
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
              draggable="false"
              onError={(e) => {
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
          onTouchStart={(e) => { e.preventDefault(); handleDpadStart('up'); }} 
          onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
          onMouseDown={(e) => { e.preventDefault(); handleDpadStart('up'); }}
          onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
        >▲</button>
        <div className="dpad-row-middle">
          <button 
            className="dpad-btn dpad-left" 
            onTouchStart={(e) => { e.preventDefault(); handleDpadStart('left'); }} 
            onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
            onMouseDown={(e) => { e.preventDefault(); handleDpadStart('left'); }}
            onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
          >◀</button>
          <div className="dpad-center-hub"></div>
          <button 
            className="dpad-btn dpad-right" 
            onTouchStart={(e) => { e.preventDefault(); handleDpadStart('right'); }} 
            onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
            onMouseDown={(e) => { e.preventDefault(); handleDpadStart('right'); }}
            onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
          >▶</button>
        </div>
        <button 
          className="dpad-btn dpad-down" 
          onTouchStart={(e) => { e.preventDefault(); handleDpadStart('down'); }} 
          onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
          onMouseDown={(e) => { e.preventDefault(); handleDpadStart('down'); }}
          onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
        >▼</button>
      </div>
      {/* 全アバター画像のプリロード */}
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

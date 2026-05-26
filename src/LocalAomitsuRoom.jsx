import React, { useState, useEffect, useRef } from 'react';
import './LocalAomitsuRoom.css';

function LocalAomitsuRoom({ userName, userIcon }) {
  // 自分アバターの位置とアニメーション状態
  const [myPos, setMyPos] = useState({ x: 50, y: 50 });
  const myPosRef = useRef({ x: 50, y: 50 });
  
  // 入力状態の制御（Refによる超高速同期的管理）
  const activeKeysRef = useRef(new Set()); // 押されているキー
  const activeDirRef = useRef(null); // 十字キーの方向
  const myLastDirectionRef = useRef('down'); // 最後の方向
  const myCurrentDirectionRef = useRef(null); // 現在入力されている方向 (静止時はnull)
  const animFrameRef = useRef(0); // 歩行アニメーションのコマ (0〜3)
  
  // 強制再描画トリガー (入力変化の瞬間に0msで画面に反映するための仕組み)
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  // 1. 移動 ＆ コマ送りアニメーションの制御タイマー
  useEffect(() => {
    let moveInterval = null;
    let animInterval = null;

    const SPEED = 0.65; // 1フレームあたりの移動速度(%)

    // リアルタイム移動タイマー (16ms = 秒間約60フレームで超絶に滑らか)
    moveInterval = setInterval(() => {
      let dX = 0;
      let dY = 0;
      let dir = null;

      // PCキーボード入力判定
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

      // スマホ十字キー入力判定（十字キー入力がアクティブな場合はキーボード入力を上書き）
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

        // マップの境界衝突判定（外に突き抜けないように壁を制限）
        const clampedX = Math.max(3, Math.min(97, nextX));
        const clampedY = Math.max(10, Math.min(90, nextY));

        myPosRef.current = { x: clampedX, y: clampedY };
        setMyPos({ x: clampedX, y: clampedY }); // 再描画

        if (dir) {
          myLastDirectionRef.current = dir;
        }
      }
    }, 16);

    // 歩行のパラパラ漫画アニメーションタイマー (120msでキャラクターのトコトコ感を表現)
    animInterval = setInterval(() => {
      const isMoving = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
      if (isMoving) {
        // 歩行中は直立(0)を除外し、1 -> 2 -> 3 -> 1 と元気に足を動かし続ける
        let nextFrame = animFrameRef.current + 1;
        if (nextFrame > 3 || nextFrame < 1) {
          nextFrame = 1;
        }
        animFrameRef.current = nextFrame;
        forceUpdate(); // コマ送り時に再描画を要求
      }
    }, 120);

    // PCキーボードのイベントリスナー
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          e.preventDefault(); // 画面の不要なスクロールを完全に抑止
        }
        if (!activeKeysRef.current.has(key)) {
          activeKeysRef.current.add(key);
          forceUpdate(); // キーが押されたその瞬間(0ms)に即座に画像を切り替える！
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (activeKeysRef.current.has(key)) {
          activeKeysRef.current.delete(key);
          forceUpdate(); // キーが離された瞬間(0ms)にも即座に画像を切り替える！
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
  }, [userName, userIcon]);

  // 移動タイマーが決定した「現在の入力された方向」を100%信頼して画像パスを決定する (キー判定の優先度ズレを完全解消)
  const currentDir = myCurrentDirectionRef.current;
  const isWalking = currentDir !== null;

  // 歩き始めた瞬間、直立(0)から即座に歩行コマ(1)に初期化する
  if (isWalking && (animFrameRef.current === 0 || animFrameRef.current > 3)) {
    animFrameRef.current = 1;
  }

  const direction = currentDir || myLastDirectionRef.current || 'down';
  // 歩いている間は 1 -> 2 -> 3 をループし、ボタンを離して止まった瞬間だけ 0 (直立)にする！
  const frame = isWalking ? animFrameRef.current : 0;

  // アバター画像のパス作成
  const imgName = `${userIcon}-${direction}-${frame}.png`;
  const iconSrc = `/sprites/${imgName}`;
  const fallbackSrc = `/sprites/${userIcon}-down-0.png`;

  return (
    <div className="local-room-container">
      {/* 親切なナビゲーション */}
      <a href="/" className="local-back-btn">
        <span>←</span> LINEチャットに戻る
      </a>

      {/* 操作案内 */}
      <div className="local-instruction-label">
        🕹️ PC: 矢印キー / WASD | スマホ: 画面下の十字キー
      </div>

      {/* 広々とした綺麗なフローリング部屋 */}
      <div className="local-wood-floor"></div>

      {/* 自分だけのアバターノード（トランジションなしで即座に動く） */}
      <div 
        className="local-avatar-node"
        style={{ 
          left: `${myPos.x}%`, 
          top: `${myPos.y}%` 
        }}
      >
        <img 
          src={iconSrc} 
          className="local-avatar-img" 
          alt={userName}
          onError={(e) => {
            if (e.target.src !== window.location.origin + fallbackSrc) {
              e.target.src = fallbackSrc; // 画像が読めない場合の安全なフォールバック
            }
          }}
        />
        <span className="local-name-tag">
          {userName} (あなた)
        </span>
      </div>

      {/* スマホ用のペコッと沈む極上3D十字キー */}
      <div className="local-virtual-dpad">
        <button 
          className="local-dpad-btn local-dpad-up" 
          onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'up'; forceUpdate(); }} 
          onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'up'; forceUpdate(); }}
          onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
        >▲</button>
        <div className="local-dpad-row-middle">
          <button 
            className="local-dpad-btn local-dpad-left" 
            onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'left'; forceUpdate(); }} 
            onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
            onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'left'; forceUpdate(); }}
            onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          >◀</button>
          <div className="local-dpad-center-hub"></div>
          <button 
            className="local-dpad-btn local-dpad-right" 
            onTouchStart={(e) => { e.preventDefault(); activeDirRef.current = 'right'; forceUpdate(); }} 
            onTouchEnd={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
            onMouseDown={(e) => { e.preventDefault(); activeDirRef.current = 'right'; forceUpdate(); }}
            onMouseUp={(e) => { e.preventDefault(); activeDirRef.current = null; forceUpdate(); }}
          >▶</button>
        </div>
        <button 
          className="local-dpad-btn local-dpad-down" 
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

export default LocalAomitsuRoom;

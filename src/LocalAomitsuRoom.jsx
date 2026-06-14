import React, { useState, useEffect, useRef } from 'react';
import './LocalAomitsuRoom.css';

function LocalAomitsuRoom({ userName, userIcon }) {
  // 自分アバターの位置とアニメーション状態
  const [myPos, setMyPos] = useState({ x: 50, y: 50 });
  const myPosRef = useRef({ x: 50, y: 50 });
  const roomRef = useRef(null); // 部屋のコンテナのピクセルサイズを取得するためのRef
  
  // レンダーに必要なアバター状態（ESLint / React 19 の Ref render 制限を完璧に回避）
  const [direction, setDirection] = useState('down');
  const [isWalking, setIsWalking] = useState(false);
  const [frame, setFrame] = useState(0);

  // 入力状態の管理（Refによる超高速同期管理）
  const activeKeysRef = useRef(new Set()); // 押されているキー
  const activeDirRef = useRef(null); // 十字キーの方向
  
  // 1. 移動 ＆ コマ送りアニメーションの制御タイマー
  useEffect(() => {
    let moveInterval = null;
    let animInterval = null;

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

      const walking = dir !== null;
      setIsWalking(walking);

      if (dir) {
        setDirection(dir);
      } else {
        setFrame(0); // 停止した瞬間は0msで直立(0)に戻す
      }

      if (dX !== 0 || dY !== 0) {
        // 斜め移動時の速度の正規化
        const length = Math.sqrt(dX * dX + dY * dY);
        
        // 1フレームあたりの移動速度を物理ピクセル（px）で定義（キビキビと軽快に動く4.5px/Fに設定）
        const SPEED_PX = 4.5;
        
        // コンテナの実際のピクセルサイズを取得（取得できない場合はデフォルト幅430px, 高さ850pxをフォールバック）
        const containerWidth = roomRef.current ? roomRef.current.clientWidth : 430;
        const containerHeight = roomRef.current ? roomRef.current.clientHeight : 850;
        
        // ピクセル単位の移動ベクトルを算出
        const vx = (dX / length) * SPEED_PX;
        const vy = (dY / length) * SPEED_PX;
        
        // 物理ピクセル移動量をパーセント座標に変換して現在の座標に加算（これで縦横斜めのスピードが完璧に統一！）
        const nextX = myPosRef.current.x + (vx / containerWidth) * 100;
        const nextY = myPosRef.current.y + (vy / containerHeight) * 100;

        // マップの境界衝突判定（外に突き抜けないように壁を制限）
        const clampedX = Math.max(3, Math.min(97, nextX));
        const clampedY = Math.max(10, Math.min(90, nextY));

        myPosRef.current = { x: clampedX, y: clampedY };
        setMyPos({ x: clampedX, y: clampedY }); // 再描画
      }
    }, 16);

    // 歩行のパラパラ漫画アニメーションタイマー (120msでキャラクターのトコトコ感を表現)
    animInterval = setInterval(() => {
      const isMoving = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
      if (isMoving) {
        // 歩行中は直立(0)を除外し、1 -> 2 -> 3 -> 1 と元気に足を動かし続ける
        setFrame(f => {
          let nextFrame = f + 1;
          if (nextFrame > 3 || nextFrame < 1) {
            nextFrame = 1;
          }
          return nextFrame;
        });
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
          
          // 押されたキーに対応する方向を即時反映（0ms）
          let dir = 'down';
          if (['arrowup', 'w'].includes(key)) dir = 'up';
          if (['arrowdown', 's'].includes(key)) dir = 'down';
          if (['arrowleft', 'a'].includes(key)) dir = 'left';
          if (['arrowright', 'd'].includes(key)) dir = 'right';

          setDirection(dir);
          setIsWalking(true);
          setFrame(1); // 即座に歩行フレームを1にする
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        if (activeKeysRef.current.has(key)) {
          activeKeysRef.current.delete(key);
          const isMovingNow = activeKeysRef.current.size > 0 || activeDirRef.current !== null;
          setIsWalking(isMovingNow);
          if (!isMovingNow) {
            setFrame(0); // 完全にキーが離されたら即座に直立に戻す
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
  }, [userName, userIcon]);

  // アバター画像のパス作成
  const currentFrame = isWalking ? frame : 0;
  const imgName = `${userIcon}-${direction}-${currentFrame}.png`;
  const iconSrc = `/sprites/${imgName}`;
  const fallbackSrc = `/sprites/${userIcon}-down-0.png`;

  // スマホ用D-Padの操作ハンドラー
  const handleDpadStart = (dir) => {
    activeDirRef.current = dir;
    setDirection(dir);
    setIsWalking(true);
    setFrame(1);
  };

  const handleDpadEnd = () => {
    activeDirRef.current = null;
    const isMovingNow = activeKeysRef.current.size > 0;
    setIsWalking(isMovingNow);
    if (!isMovingNow) {
      setFrame(0);
    }
  };

  return (
    <div className="local-room-container" ref={roomRef}>
      {/* 親切なナビゲーション */}
      <a href="/" className="local-back-btn">
        <span>←</span> LINEチャットに戻る
      </a>

      {/* 操作案内 */}
      <div className="local-instruction-label">
        🕹️ PC: 矢印キー / WASD | スマホ: 画面下の十字キー
      </div>

      {/* 広々としたフローリング部屋 */}
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
          draggable="false"
          onError={(e) => {
            if (e.target.src !== window.location.origin + fallbackSrc) {
              e.target.src = fallbackSrc; // 安全なフォールバック
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
          onTouchStart={(e) => { e.preventDefault(); handleDpadStart('up'); }} 
          onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
          onMouseDown={(e) => { e.preventDefault(); handleDpadStart('up'); }}
          onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
        >▲</button>
        <div className="local-dpad-row-middle">
          <button 
            className="local-dpad-btn local-dpad-left" 
            onTouchStart={(e) => { e.preventDefault(); handleDpadStart('left'); }} 
            onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
            onMouseDown={(e) => { e.preventDefault(); handleDpadStart('left'); }}
            onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
          >◀</button>
          <div className="local-dpad-center-hub"></div>
          <button 
            className="local-dpad-btn local-dpad-right" 
            onTouchStart={(e) => { e.preventDefault(); handleDpadStart('right'); }} 
            onTouchEnd={(e) => { e.preventDefault(); handleDpadEnd(); }}
            onMouseDown={(e) => { e.preventDefault(); handleDpadStart('right'); }}
            onMouseUp={(e) => { e.preventDefault(); handleDpadEnd(); }}
          >▶</button>
        </div>
        <button 
          className="local-dpad-btn local-dpad-down" 
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

export default LocalAomitsuRoom;

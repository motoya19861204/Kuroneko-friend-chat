import React, { useState, useEffect } from 'react';
import './RoomApp.css'; // あおみつひろば専用の独立したスタイルを適用
import AomitsuRoom from './AomitsuRoom';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';

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

function RoomApp() {
  const storedName = localStorage.getItem('userName') || '';
  const storedIcon = localStorage.getItem('userIcon') || 'girl1';

  const [userName, setUserName] = useState(storedName);
  const [userIcon, setUserIcon] = useState(storedIcon);
  // チャットに入室済み（ローカルストレージに名前がある）なら自動でひろばに直接入室する！
  const [isJoined, setIsJoined] = useState(!!storedName);

  // 匿名認証の実行
  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
      console.error("Firebase Authentication Error:", error);
    });
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (name) {
      localStorage.setItem('userName', name);
      localStorage.setItem('userIcon', userIcon);
      setUserName(name);
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <div className="login-screen">
        <div className="avatar-frame login-avatar-frame">
          <img src="/icons/neko/default.png" alt="黒猫" className="login-cat-icon" />
        </div>
        
        <form onSubmit={handleJoin} style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#555', marginBottom: '20px', fontFamily: 'sans-serif' }}>🏡 あおみつひろば 🏡</h2>
          
          <div className="input-group">
            <label>ひろばでの なまえ（4文字まで）</label>
            <input 
              name="name" 
              type="text" 
              defaultValue={userName} 
              placeholder="なまえ" 
              required 
              maxLength={4}
              autoComplete='off' 
            />
          </div>

          <p className="selection-label">アバターを選んでね</p>
          <div className="icon-selector" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {USER_ICONS.map(icon => (
              <div 
                key={icon.id} 
                className={`icon-option ${userIcon === icon.id ? 'selected' : ''}`}
                onClick={() => setUserIcon(icon.id)}
              >
                <img src={icon.src} alt={icon.name} />
              </div>
            ))}
          </div>

          <button type="submit" className="login-btn" style={{ backgroundColor: '#28a745' }}>ひろばに入る</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-wrapper" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <AomitsuRoom db={db} userName={userName} userIcon={userIcon} />
    </div>
  );
}

export default RoomApp;

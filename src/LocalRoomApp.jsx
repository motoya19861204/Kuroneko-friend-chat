import React, { useState } from 'react';
import './RoomApp.css'; // スタイルは既存のRoomApp.cssを再利用して統一感を持たせる
import LocalAomitsuRoom from './LocalAomitsuRoom';

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

function LocalRoomApp() {
  const storedName = localStorage.getItem('localUserName') || '';
  const storedIcon = localStorage.getItem('localUserIcon') || 'girl1';

  const [userName, setUserName] = useState(storedName);
  const [userIcon, setUserIcon] = useState(storedIcon);
  const [isJoined, setIsJoined] = useState(!!storedName);

  const handleJoin = (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (name) {
      localStorage.setItem('localUserName', name);
      localStorage.setItem('localUserIcon', userIcon);
      setUserName(name);
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <div className="login-screen">
        <div className="avatar-frame login-avatar-frame" style={{ border: '3px solid #8CE839' }}>
          {/* ローカル専用であることを示すクールで可愛い文字と黒猫 */}
          <img src="/icons/neko/default.png" alt="黒猫" className="login-cat-icon" />
        </div>
        
        <form onSubmit={handleJoin} style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#3e322b', marginBottom: '5px', fontFamily: 'sans-serif', fontWeight: 'bold' }}>🏡 あおみつソロひろば 🏡</h2>
          <p style={{ color: '#8c7f75', fontSize: '0.8rem', marginBottom: '20px', fontWeight: 'bold' }}>〜操作感追求のローカル実験室〜</p>
          
          <div className="input-group">
            <label style={{ color: '#5b4a3f' }}>なまえ（4文字まで）</label>
            <input 
              name="name" 
              type="text" 
              defaultValue={userName} 
              placeholder="なまえ" 
              required 
              maxLength={4}
              autoComplete='off' 
              style={{ border: '2px solid #d0c4b0', borderRadius: '10px' }}
            />
          </div>

          <p className="selection-label" style={{ color: '#5b4a3f' }}>アバターを選んでね</p>
          <div className="icon-selector" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {USER_ICONS.map(icon => (
              <div 
                key={icon.id} 
                className={`icon-option ${userIcon === icon.id ? 'selected' : ''}`}
                onClick={() => setUserIcon(icon.id)}
                style={{ borderColor: userIcon === icon.id ? '#8CE839' : '#d0c4b0' }}
              >
                <img src={icon.src} alt={icon.name} />
              </div>
            ))}
          </div>

          <button type="submit" className="login-btn" style={{ backgroundColor: '#8CE839', color: '#2b500f', fontWeight: 'bold', fontSize: '1rem', border: 'none', borderRadius: '25px', boxShadow: '0 4px 0 #72c42c' }}>
            ソロひろばに入る
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-wrapper" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <LocalAomitsuRoom userName={userName} userIcon={userIcon} />
    </div>
  );
}

export default LocalRoomApp;

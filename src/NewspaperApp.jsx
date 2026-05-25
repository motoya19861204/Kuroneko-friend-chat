import React, { useState, useEffect, useRef } from 'react';
import './NewspaperApp.css';
import { db } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import html2canvas from 'html2canvas';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY;

// ユーザー用アイコン定義（App.jsxと同期）
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

function NewspaperApp() {
  const [userName, setUserName] = useState('');
  const [messages, setMessages] = useState([]);
  
  // 今日の前日（昨日）をデフォルトのターゲット日付に設定
  const getYesterdayStr = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [targetDate, setTargetDate] = useState(getYesterdayStr());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // 生成された新聞データ
  const [newspaperData, setNewspaperData] = useState(null);
  
  // HTML要素を画像化するためのRef
  const paperRef = useRef(null);

  // ローカルストレージからログインユーザー名を取得
  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    } else {
      setUserName('ななしの読者');
    }
  }, []);

  // Firebaseからチャットメッセージの購読
  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;

    const chatRef = ref(db, 'friendChatMessages');
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMessages(Object.values(data));
      }
    });

    return () => unsubscribe();
  }, []);

  // 選択された日付のメッセージをフィルタリング（人間のみ ＆ 画像除外）
  const getFilteredMessages = () => {
    if (!targetDate) return [];
    
    const parts = targetDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = parseInt(parts[2], 10);
    
    const startOfDay = new Date(year, month, date, 0, 0, 0, 0).getTime();
    const endOfDay = new Date(year, month, date, 23, 59, 59, 999).getTime();

    return messages.filter(m => {
      const inRange = m.id >= startOfDay && m.id <= endOfDay;
      const isHuman = !m.isCat && m.author !== '黒猫';
      const isNotImage = m.text && !m.text.startsWith('data:image/');
      return inRange && isHuman && isNotImage;
    });
  };

  const filteredMessages = getFilteredMessages();

  // 新聞を作成する（Gemini API 呼び出し）
  const handleGenerateNewspaper = async () => {
    if (filteredMessages.length === 0) {
      alert("選択された日は会話の記録がないか、黒猫の発言のみです。会話のある日付を選んでください。");
      return;
    }

    setIsLoading(true);
    setStatusMessage('黒猫編集長が過去ログを分析中じゃ...');
    setNewspaperData(null);

    // 会話履歴をGeminiが理解しやすいテキストにまとめる
    const chatLogText = filteredMessages.map(m => `${m.author}: ${m.text}`).join('\n');

    const prompt = `あなたはお友達グループ「あおみつLINE」の出来事やお約束をまとめる「あおみつ新聞」の編集部（親切な人間の記者）です。
与えられた子供たちの1日分のチャットログを読み、以下の条件に従って「あおみつ新聞」の記事データを作成してください。

【文体とトーンに関する最重要指示】
- 「黒猫編集長のコラム（column）」以外のすべての文章（一面の大見出し title, 一面のニュース記事 article, 本日のおもしろ発言ハイライト highlights）は、普通の人間（親切な新聞記者）が書いたような、客観的で丁寧な新聞らしい文体（「〜です」「〜ます」調）で作成してください。
- 黒猫の口調（「〜じゃ」「我は〜」「〜ニャ」など）は、「黒猫編集長のコラム（column）」以外では絶対に使用しないでください。
- すべての文章は、読むのが小学生（低学年〜中学年）であることを考慮し、小学生がしっかりと理解できるやさしい言葉使い、ひらがなを多めにしたやさしい漢字で、分かりやすく説明してください。

【最重要指示（お約束の優先要約）】
会話の中から、子供たち同士が話し合って決めた「お約束」「決定事項」「議論の結論（例: 遊ぶ時間、場所、ゲームの決まりごと、明日やること等）」を最優先で探し出し、それをトップニュースの見出し（title）と記事（article）としてまとめてください。
もし具体的にお約束が決まっていない場合は、その日みんなが「どんなことで一番盛り上がっていたか（話題や結論）」をテーマにしてください。

【黒猫編集長のコラム（column）の指示】
ここだけは例外的に、黒猫の神様のキャラクターになりきってください。黒猫の神様の口調（「〜じゃ」「我は〜」）で、その日の出来事やお約束に対する、尊大で温かい一言メッセージを作成してください。猫らしい仕草やセリフ（「〜ニャ」など）を混ぜてください。

【本日のおもしろ発言ハイライト（highlights）の指示】
チャットの中から特に面白かった発言や、ほっこりしたお友達同士のやり取りを3つ、親切な記者の視点から紹介してください。必ず3つの配列にしてください。猫の口調は使用せず、丁寧な言葉でまとめてください。（例：「〇〇くんの『〇〇』という発言がとっても面白かったですね！」など）

与えられた会話ログ：
${chatLogText}`;

    try {
      const MODELS = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
      ];
      
      let responseData = null;
      let apiSuccess = false;

      for (const modelName of MODELS) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING", description: "一面の大見出し（15文字程度。その日の最も重要なお約束や結論）" },
                    article: { type: "STRING", description: "一面のニュース記事。何について話し合い、どんな約束や結論になったかの要約（子供向け）" },
                    column: { type: "STRING", description: "黒猫編集長のコラム。黒猫の尊大で温かい一言メッセージ（〜じゃ、我は〜）" },
                    highlights: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "本日のおもしろ発言ハイライト（特に面白かった発言やほっこりしたやりとりを3つ）"
                    }
                  },
                  required: ["title", "article", "column", "highlights"]
                }
              }
            })
          });

          const data = await response.json();
          if (data.candidates && data.candidates[0]) {
            const rawJson = data.candidates[0].content.parts[0].text;
            responseData = JSON.parse(rawJson);
            apiSuccess = true;
            break; // 成功したらループを抜ける
          }
        } catch (e) {
          console.warn(`モデル ${modelName} でのエラー、次のモデルを試します:`, e);
        }
      }

      if (apiSuccess && responseData) {
        setNewspaperData(responseData);
        setStatusMessage('新聞の原稿ができたニャ！');
      } else {
        throw new Error("AIからの応答を取得できませんでした。");
      }

    } catch (error) {
      console.error(error);
      alert("新聞の作成に失敗したニャ。もう一度試すか、APIキーの設定を確認してほしいニャ。");
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成された新聞を画像化してチャットに自動投稿する
  const handlePublishNewspaper = async () => {
    if (!newspaperData || !paperRef.current) return;

    setIsLoading(true);
    setStatusMessage('新聞をカメラでパシャリと撮影して画像にするニャ...');

    try {
      // html2canvasで画像化。拡大率を上げて綺麗にする。
      const canvas = await html2canvas(paperRef.current, {
        scale: 2.0, // 解像度アップ
        useCORS: true,
        backgroundColor: '#fbf8f3', // 新聞の背景色
        logging: false,
      });

      const base64Image = canvas.toDataURL('image/png');
      
      setStatusMessage('あおみつLINEのチャットへ配達中じゃ...');

      // Firebaseメッセージに追加
      // 1. 通知メッセージ
      const formattedDate = targetDate.replace(/-/g, '/');
      const notificationMsg = {
        id: Date.now(),
        author: '黒猫',
        userIcon: '/icons/neko/happy.png',
        text: `📰 【あおみつ新聞】を発行したぞ！\n日付: ${formattedDate}\n昨日のお約束や楽しかったおしゃべりをまとめたニャ！下の画像をタップして拡大して、カメラロールに保存できるぞ！`,
        isCat: true
      };

      // 2. 新聞画像メッセージ
      const imageMsg = {
        id: Date.now() + 10,
        author: '黒猫',
        userIcon: '/icons/neko/grin.png',
        text: base64Image, // Base64画像をそのままテキストとして格納
        isCat: true
      };

      const updatedHistory = [...messages, notificationMsg, imageMsg];
      
      // 保存制限
      let trimmedHistory = updatedHistory;
      if (trimmedHistory.length > 1000) {
        trimmedHistory = trimmedHistory.slice(-1000);
      }

      if (FIREBASE_CONFIGURED) {
        await set(ref(db, 'friendChatMessages'), trimmedHistory);
        setStatusMessage('配達完了！LINEチャットに届いたぞ！');
        alert("あおみつLINEに新聞画像を投稿したニャ！チャット画面に戻って確認してね！");
      } else {
        alert("Firebaseが接続されていないため、LINEチャットへの投稿はスキップされたニャ。");
      }

    } catch (error) {
      console.error(error);
      alert("新聞の配達に失敗してしまったニャ。");
    } finally {
      setIsLoading(false);
    }
  };

  // 表示用に日付フォーマットを「2026年5月25日」形式にする
  const getJpDateString = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  };

  return (
    <div className="newspaper-app-container">
      {/* ヘッダー */}
      <header className="newspaper-header">
        <div className="header-left">
          <a href="/" className="back-chat-link">
            <span className="arrow">←</span> LINEチャットに戻る
          </a>
        </div>
        <div className="header-center">
          <h1 className="main-title">📰 あおみつ新聞 発行所 🐈‍⬛</h1>
        </div>
        <div className="header-right">
          <span className="user-badge">編集員: {userName}</span>
        </div>
      </header>

      {/* メインレイアウト */}
      <div className="newspaper-main-content">
        
        {/* 左サイド：コントロールパネル */}
        <section className="control-panel">
          <div className="panel-card">
            <h3>📅 新聞をつくる日付を選んでね</h3>
            <p className="panel-desc">
              選んだ日付のLINEの会話ログから、黒猫の言葉を除外した「人間だけ」の会話をAIが分析して新聞にします。
            </p>
            
            <div className="input-group">
              <input 
                type="date" 
                value={targetDate} 
                onChange={(e) => setTargetDate(e.target.value)}
                className="date-input"
              />
            </div>

            {/* 日付の簡易選択ボタン */}
            <div className="quick-date-buttons">
              <button 
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yyyy = yesterday.getFullYear();
                  const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
                  const dd = String(yesterday.getDate()).padStart(2, '0');
                  setTargetDate(`${yyyy}-${mm}-${dd}`);
                }}
                className={`quick-date-btn ${targetDate === getYesterdayStr() ? 'active' : ''}`}
              >
                昨日
              </button>
              <button 
                onClick={() => {
                  const today = new Date();
                  const yyyy = today.getFullYear();
                  const mm = String(today.getMonth() + 1).padStart(2, '0');
                  const dd = String(today.getDate()).padStart(2, '0');
                  setTargetDate(`${yyyy}-${mm}-${dd}`);
                }}
                className="quick-date-btn"
              >
                今日
              </button>
            </div>

            {/* 抽出ログステータス */}
            <div className="log-status">
              <span className="status-label">対象の発言数:</span>
              <span className={`status-value ${filteredMessages.length > 0 ? 'success' : 'empty'}`}>
                {filteredMessages.length} 件の発言
              </span>
            </div>

            {filteredMessages.length === 0 ? (
              <div className="empty-warning">
                ⚠️ この日はお友達同士の会話がまだないニャ。他の日付を選んでね！
              </div>
            ) : (
              <button 
                onClick={handleGenerateNewspaper} 
                disabled={isLoading}
                className="action-btn generate-btn"
              >
                {isLoading ? '処理中ニャ...' : '📰 新聞の原稿をつくる！'}
              </button>
            )}

            {/* 進捗ステータス表示 */}
            {statusMessage && (
              <div className="status-message-box">
                <span className="spinner">🐈🐾</span> {statusMessage}
              </div>
            )}

            {/* 発行（投稿）ボタン：原稿があるときだけ表示 */}
            {newspaperData && (
              <div className="publish-box">
                <div className="arrow-down">↓↓ 原稿ができたニャ！ ↓↓</div>
                <button 
                  onClick={handlePublishNewspaper} 
                  disabled={isLoading}
                  className="action-btn publish-btn"
                >
                  🚀 あおみつLINEに新聞画像を投稿する！
                </button>
                <p className="publish-hint">
                  ※ボタンを押すと、右の新聞が1枚の画像（PNG）になって、あおみつLINEのチャット欄に「黒猫からの投稿」として自動で届くニャ！
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 右サイド：新聞紙面プレビュー */}
        <section className="preview-panel">
          <h2 className="preview-label">📰 新聞のプレビュー（できあがりイメージ）</h2>
          
          {newspaperData ? (
            <div className="newspaper-wrapper">
              <div className="newspaper-paper" id="newspaper-paper" ref={paperRef}>
                
                {/* 新聞の看板（ヘッダー） */}
                <div className="newspaper-masthead">
                  <div className="masthead-left">
                    <span className="masthead-meta">第{messages.length}号</span>
                    <span className="masthead-meta">{getJpDateString(targetDate)} 発行</span>
                  </div>
                  <div className="masthead-center">
                    <h1 className="masthead-title">あおみつ新聞</h1>
                  </div>
                  <div className="masthead-right">
                    <span className="masthead-meta">編集長: 黒猫の神様</span>
                    <span className="masthead-meta">あおみつLINE公式</span>
                  </div>
                </div>

                <div className="newspaper-body">
                  
                  {/* 主要ニュース：お約束と結論 */}
                  <div className="newspaper-main-story">
                    <h2 className="story-title">
                      <span className="story-badge">お約束・結論</span> 
                      {newspaperData.title}
                    </h2>
                    <div className="story-content">
                      {newspaperData.article.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="newspaper-columns-grid">
                    {/* コラム：黒猫編集長の一言 */}
                    <div className="newspaper-columnist-section">
                      <h3 className="column-title">🐈‍⬛ 黒猫編集長コラム「黒猫のつぶやき」</h3>
                      <div className="column-body">
                        <img src="/icons/neko/default.png" alt="黒猫" className="column-cat-avatar" />
                        <div className="column-text">
                          {newspaperData.column.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 面白ハイライト */}
                    <div className="newspaper-highlights-section">
                      <h3 className="column-title">✨ 本日のおもしろ発言ハイライト</h3>
                      <ul className="highlight-list">
                        {newspaperData.highlights.map((item, i) => (
                          <li key={i} className="highlight-item">
                            <span className="highlight-marker">🐾</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>

                {/* 新聞フッター */}
                <div className="newspaper-footer">
                  <p>© あおみつLINE新聞社 - お友達同士の約束と友情を永遠に記録するニャ</p>
                </div>

              </div>
            </div>
          ) : (
            <div className="empty-preview">
              <div className="empty-cat-illustration">
                <img src="/icons/neko/default.png" alt="猫" className="bouncing-cat" />
              </div>
              <p className="empty-text">
                日付を選んで「新聞の原稿をつくる！」ボタンを押すと、ここに手描きタッチの可愛い「あおみつ新聞」の出来上がりイメージが表示されるニャ！
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

export default NewspaperApp;

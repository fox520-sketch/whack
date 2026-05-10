# 鼠叔出沒 Firebase 多人合作版

這是一個可部署到 GitHub Pages 的靜態網頁遊戲。多人功能使用 Firebase Authentication 匿名登入與 Realtime Database 即時同步，不需要 Node.js 伺服器。

## 新增功能

- 多人合作模式：所有玩家一起打同一批地鼠，共同累積同一個合作分數。
- 多人競賽模式：保留每位玩家各自計分的玩法。
- 多種內建地鼠圖案：地鼠、水獺、章魚、螃蟹、河豚、海豹、海豚、鯊魚、海龜、水母、海星、機器人、幽靈等。
- 自訂地鼠圖片：可在瀏覽器上傳圖片，系統會自動縮成 256px 並儲存在本機。多人房主開始遊戲時會同步給同房玩家。
- 多種內建打中音效與沒打中音效。
- 語音音效：打中可播放「打到了」，沒打中可播放「喔喔」。
- 自訂錄音檔：可上傳打中音效與沒打中音效，建議小於 700KB。
- 20 級難度、多主題、手機觸控、房間排行榜、本機排行榜。
- 房間 QR Code：建立房間後可直接掃描加入，也可複製邀請連結。
- 離線偵測：玩家關閉網頁或斷線後，排行榜會顯示離線狀態與最後出現時間。
- 房間自動過期：房間預設約 2 小時後過期，開始遊戲會重新延長。
- PWA 安裝：支援加入手機桌面，並提供基本離線 App Shell 快取。

## 檔案結構

```text
ocean-whack-a-mole-firebase/
├─ index.html
├─ css/style.css
├─ js/app.js
├─ js/firebase-config.js
├─ js/firebase-game.js
├─ js/game-settings.js
├─ js/sounds.js
├─ icons/
│  ├─ icon-192.png
│  └─ icon-512.png
├─ manifest.webmanifest
├─ service-worker.js
├─ firebase-rules.json
└─ README.md
```

## 本機預覽

因為專案使用 ES Modules，建議用本機靜態伺服器開啟，不要直接雙擊 `index.html`。

使用 Python：

```bash
cd ocean-whack-a-mole-firebase
python3 -m http.server 8000
```

然後打開：

```text
http://localhost:8000
```

## 設定 Firebase

### 1. 建立 Web App

到 Firebase Console 的專案首頁，點「新增應用程式」並選 `</>` Web App。

建立後複製 Firebase 給你的 `firebaseConfig`，貼到：

```text
js/firebase-config.js
```

請確認有填入 `databaseURL`，例如：

```js
export const firebaseConfig = {
  apiKey: '你的 apiKey',
  authDomain: '你的專案.firebaseapp.com',
  databaseURL: 'https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: '你的專案',
  storageBucket: '你的專案.firebasestorage.app',
  messagingSenderId: '你的 sender id',
  appId: '你的 app id'
};
```

### 2. 啟用匿名登入

Firebase Console：

```text
安全性 → Authentication → 登入方式 → 匿名 → 啟用 → 儲存
```

### 3. 建立 Realtime Database

Firebase Console：

```text
資料庫和儲存空間 → Realtime Database → 建立資料庫
```

建議位置可選新加坡 `asia-southeast1`。

### 4. 發布安全性規則

打開專案內的：

```text
firebase-rules.json
```

複製全部內容，到 Firebase Console：

```text
Realtime Database → 規則 → 貼上 → 發布
```

如果你已經發布過舊版規則，這次一定要重新發布新版規則，因為此版本新增了 `gameMode`、`teamScore`、`hitClaims`、`moleVisual`、`createdAt`、`expiresAt` 等資料欄位。

## GitHub Pages 部署

1. 到 GitHub 建立 repository，例如 `ocean-whack-a-mole`。
2. 上傳此資料夾內所有檔案。
3. 進入 repository 的 `Settings → Pages`。
4. Source 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`。
6. 等待 GitHub Pages 產生網址。

## 多人合作模式玩法

1. 房主選擇「合作共分」。
2. 房主建立房間並分享 6 位數房號、邀請連結或 QR Code。
3. 其他玩家輸入房號，或掃描 QR Code 後加入。
4. 房主按「開始多人遊戲」。
5. 所有人會看到同一批地鼠。
6. 同一隻地鼠由最先打到的玩家幫全隊加 1 分。
7. 房間榜會顯示團隊合作分數，也會顯示每位玩家的貢獻次數。

## 自訂圖片與音效注意事項

- 自訂圖片會先存到瀏覽器 localStorage，並在多人房主開始遊戲時同步到該房間。
- 自訂音效目前只儲存在每位玩家自己的瀏覽器，不會同步給其他玩家。
- 錄音檔建議保持短小，最好小於 700KB。
- 如果要做正式公開比賽排行榜，建議再加 Firebase Cloud Functions 由伺服器驗證分數。

## 常見問題

### Permission denied

通常是以下其中一項：

- 沒有啟用 Authentication 的匿名登入。
- Realtime Database 規則沒有貼新版 `firebase-rules.json`。
- `databaseURL` 寫錯。
- GitHub Pages 還在快取舊檔，稍等或重新整理。

### 自訂圖片沒有同步

只有房主開始多人遊戲時，會把目前選擇的地鼠圖案同步到房間。請由房主先選圖，再按開始。

### 語音沒有聲音

瀏覽器可能要求使用者先點擊頁面才允許播放聲音。請先按一次「試聽」或開始遊戲。


## v2.1 更新

- 電腦版 9 個洞固定以 3 排 3 列呈現。
- 高難度的 12 / 16 洞仍保留較大的 4 欄配置，避免洞口過小。

## v3 更新

- 新增房間 QR Code 與邀請連結。網址會帶上 `?room=房號`，朋友開啟後會自動帶入房號。
- 新增玩家離線偵測：進入房間後每 20 秒更新一次 `lastSeen`，關閉頁面時會標記離線。
- 新增房間自動過期：房間約 2 小時後過期；房主開始遊戲時會重新延長 2 小時。
- 新增 PWA：包含 `manifest.webmanifest`、`service-worker.js` 與 192/512 圖示，可加入手機桌面。

### PWA 安裝方式

Android / Chrome：如果瀏覽器支援安裝，遊戲左側會出現「安裝到手機 / 桌面」按鈕。

iPhone / iPad：請使用 Safari 開啟網站，點分享按鈕，選「加入主畫面」。

### QR Code 注意事項

QR Code 使用瀏覽器端套件產生。若網路載入套件失敗，仍可使用「複製邀請連結」或手動輸入房號。


## v4 手機音效選擇修正

- 新增手機可直接點選的打中/沒中音效卡片，避免部分手機瀏覽器下拉選單不易選到語音選項。
- 點選語音音效或試聽時會先解鎖瀏覽器音訊，改善 iOS/Android 語音播放限制。
- 更新 service worker cache 名稱；上傳後若仍看到舊版，請重新整理或移除舊 PWA 後再加入主畫面。

# 鼠叔出沒 v6：Firebase 多人合作打地鼠

這是可放在 GitHub Pages 的靜態網頁小遊戲。多人即時房間、分數、排行榜使用 Firebase Realtime Database，同時支援 PWA 手機安裝。

## v6 新增功能

- 房主控制：鎖定 / 解除鎖定房間、重開本局、清除離線玩家、踢出玩家
- 全站排行榜：今日、本週、歷史最高
- 成就系統：本機解鎖成就，結算時顯示新成就
- 新手教學導覽：第一次進入自動顯示，也可以手動重看

## 既有功能

- 單人模式
- 多人合作模式：所有玩家合作打同一個團隊分數
- 多人競賽模式：每位玩家各自計分
- 房間 QR Code 與邀請連結
- 離線偵測與房間自動過期
- 20 級難度
- 多主題風格
- 內建多種地鼠圖案，也可上傳自訂圖片
- 內建多種音效，也可上傳自訂音效
- 特殊地鼠：黃金、炸彈、愛心、Boss
- 合作任務模式：限時達標、Boss 地鼠
- 手機觸控、震動與點擊特效
- PWA 手機安裝

## 專案結構

```text
ocean-whack-a-mole-firebase/
├─ index.html
├─ css/style.css
├─ js/app.js
├─ js/firebase-config.js
├─ js/firebase-game.js
├─ js/game-settings.js
├─ js/sounds.js
├─ js/qr-lite.js
├─ firebase-rules.json
├─ manifest.webmanifest
├─ service-worker.js
└─ icons/
```

## 1. 設定 Firebase

打開：

```text
js/firebase-config.js
```

把內容換成你的 Firebase Web App 設定，並確認有 `databaseURL`：

```js
export const firebaseConfig = {
  apiKey: "你的 apiKey",
  authDomain: "你的專案.firebaseapp.com",
  databaseURL: "https://你的資料庫網址.firebasedatabase.app",
  projectId: "你的專案",
  storageBucket: "你的專案.firebasestorage.app",
  messagingSenderId: "你的 sender id",
  appId: "你的 app id"
};
```

## 2. 啟用 Anonymous Authentication

Firebase Console：

```text
Authentication → Sign-in method → Anonymous → 啟用
```

## 3. 建立 Realtime Database

Firebase Console：

```text
Realtime Database → Create Database
```

建議台灣使用者選新加坡 `asia-southeast1`。

## 4. 發布 Firebase Rules

v6 新增了房主控制、踢人、鎖房、全站排行榜欄位，所以一定要重新發布規則。

打開：

```text
firebase-rules.json
```

到 Firebase Console：

```text
Realtime Database → Rules → 全部貼上 → Publish
```

## 5. 上傳 GitHub Pages

將所有檔案上傳到 GitHub repository，然後到：

```text
Settings → Pages → Deploy from a branch → main / root
```

部署後網址通常會像：

```text
https://你的帳號.github.io/你的專案/
```

## 6. 更新後看不到新版？

電腦請按：

```text
Ctrl + F5
```

Mac：

```text
Command + Shift + R
```

手機請關掉分頁重開；若已加到手機桌面，請移除舊 PWA 捷徑後重新加入。

## v6 房主控制說明

建立房間的人就是房主。房主可以：

- 鎖定房間：新玩家不能再加入
- 解除鎖定：重新開放加入
- 重開本局：用目前設定重新開始
- 清除離線玩家：移除離線或被踢出的玩家
- 踢出玩家：在房間榜中，其他玩家旁會出現「踢出」按鈕

## v6 全站排行榜說明

全站排行榜會寫入 Firebase：

```text
leaderboards/daily/YYYY-MM-DD/records
leaderboards/weekly/YYYY-Www/records
leaderboards/allTime/records
```

成績來源：

- 單人模式：送出個人成績
- 多人競賽：每位玩家送出自己的成績
- 多人合作：由房主送出團隊成績，避免重複上榜

## v6 成就系統說明

成就存放在玩家瀏覽器的 `localStorage`，不需要登入帳號。包含：

- 初次出沒
- 十連不斷
- 連擊高手
- 準度達人
- S 級鼠叔獵人
- Boss 擊破
- 合作達標
- 多人同樂
- Boss 連打手
- 百分獵人

## 注意事項

這是純前端 + Firebase Realtime Database 版本，適合朋友同玩與公開展示。若要正式比賽級防作弊，建議再加 Firebase Cloud Functions，由伺服器端驗證分數與排行榜寫入。

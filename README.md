# 海洋打地鼠｜Firebase + GitHub Pages 多人版

這是一個可直接放到 GitHub Pages 的純前端網頁小遊戲。多人模式使用 Firebase Authentication 匿名登入與 Firebase Realtime Database 同步房間、玩家、分數與地鼠位置。

## 功能

- 單人模式
- Firebase 多人即時房間
- 6 位數房號
- 每位玩家獨立計分
- 20 級難易度
- 10 種主題：海洋、護眼、電子紙、暮光、櫻花、森林、夕陽、星空、糖果、霓虹
- 響應式版面，支援電腦、平板、手機
- 手機觸控支援
- 音效
- 房間排行榜
- 本機排行榜

## 專案結構

```text
ocean-whack-a-mole-firebase/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js
│  ├─ firebase-config.js
│  ├─ firebase-game.js
│  ├─ game-settings.js
│  └─ sounds.js
├─ firebase-rules.json
└─ README.md
```

## 本機預覽

建議使用本機伺服器，不要直接雙擊 `index.html`，因為瀏覽器可能會限制 ES modules。

```bash
cd ocean-whack-a-mole-firebase
python3 -m http.server 8000
```

打開：

```text
http://localhost:8000
```

單人模式不需要 Firebase。多人模式需要完成下方 Firebase 設定。

---

# 一、建立 Firebase 專案

1. 到 Firebase Console：`https://console.firebase.google.com/`
2. 點「建立專案 / Add project」
3. 輸入專案名稱，例如：`ocean-whack-a-mole`
4. Google Analytics 可先關閉
5. 建立完成後進入專案

---

# 二、建立 Web App 並取得 firebaseConfig

1. 在 Firebase 專案首頁點 `</>` Web App
2. App nickname 可填：`ocean-whack-a-mole-web`
3. 不需要勾選 Firebase Hosting，因為網站會放 GitHub Pages
4. 建立後複製 `firebaseConfig`
5. 打開本專案的：

```text
js/firebase-config.js
```

把檔案中的範例內容換成你的 Firebase 設定，例如：

```js
export const firebaseConfig = {
  apiKey: '你的 apiKey',
  authDomain: '你的專案.firebaseapp.com',
  databaseURL: 'https://你的專案-default-rtdb.firebaseio.com',
  projectId: '你的專案',
  storageBucket: '你的專案.appspot.com',
  messagingSenderId: '你的 sender id',
  appId: '你的 app id'
};
```

重要：`databaseURL` 必須正確，Realtime Database 多人模式才會運作。

---

# 三、啟用匿名登入

1. Firebase Console 左側選單進入「Authentication」
2. 點「Get started」
3. 到「Sign-in method」
4. 啟用「Anonymous / 匿名」
5. 儲存

這樣玩家不需要註冊帳號，也能取得臨時 UID 來辨識每個玩家。

---

# 四、建立 Realtime Database

1. Firebase Console 左側選單進入「Realtime Database」
2. 點「Create Database」
3. 選擇資料庫位置
4. 初始規則可以先選 Locked mode 或 Test mode
5. 建立完成後，複製你的 Database URL
6. 確認 `js/firebase-config.js` 的 `databaseURL` 和 Firebase Console 顯示的一樣

---

# 五、套用 Realtime Database Rules

1. Firebase Console 左側進入「Realtime Database」
2. 點上方「Rules」
3. 打開本專案的 `firebase-rules.json`
4. 複製整份內容貼到 Rules 編輯器
5. 點「Publish」

這份規則的重點：

- 只有登入玩家可以讀取房間
- 建立房間的人是房主
- 只有房主可以開始遊戲、更新地鼠位置、結束遊戲
- 玩家只能更新自己的玩家資料
- 分數一般只能每次 +1，降低亂改分數的風險

這是適合小遊戲的基礎規則。若要做正式競賽、防作弊排行榜，建議改用 Firebase Cloud Functions 驗證分數。

---

# 六、上傳到 GitHub

## 方法 A：使用 GitHub 網頁介面

1. 到 GitHub：`https://github.com/`
2. 點右上角 `+` → `New repository`
3. Repository name 可填：`ocean-whack-a-mole`
4. 建議先選 Public，GitHub Free 的 Public repo 可直接使用 GitHub Pages
5. 點 `Create repository`
6. 進入新 repo 後，點 `uploading an existing file`
7. 把本專案資料夾裡的所有檔案拖進去
8. Commit message 填：`Initial Firebase game`
9. 點 `Commit changes`

## 方法 B：使用 Git 指令

```bash
cd ocean-whack-a-mole-firebase
git init
git add .
git commit -m "Initial Firebase game"
git branch -M main
git remote add origin https://github.com/你的帳號/ocean-whack-a-mole.git
git push -u origin main
```

---

# 七、啟用 GitHub Pages

1. 到 GitHub repo 頁面
2. 點 `Settings`
3. 左側點 `Pages`
4. Build and deployment 選：`Deploy from a branch`
5. Branch 選：`main`
6. Folder 選：`/ root`
7. 點 `Save`
8. 等待 GitHub 顯示網址，例如：

```text
https://你的帳號.github.io/ocean-whack-a-mole/
```

---

# 八、測試多人模式

1. 用電腦打開 GitHub Pages 網址
2. 輸入暱稱
3. 點「建立房間」
4. 複製房號
5. 用手機或另一台電腦打開同一個網址
6. 輸入房號並加入
7. 房主按「開始多人遊戲」
8. 每個裝置會獨立計分，右側房間排行榜會同步更新

---

# 九、常見問題

## 按建立房間後顯示尚未設定 Firebase

請確認 `js/firebase-config.js` 已經換成 Firebase Console 提供的設定，而且 `apiKey` 不再是 `PASTE_YOUR_API_KEY_HERE`。

## 建立房間失敗或 Permission denied

請確認：

1. Authentication 已啟用 Anonymous
2. Realtime Database 已建立
3. `firebase-rules.json` 已貼到 Realtime Database Rules 並 Publish
4. `databaseURL` 正確

## GitHub Pages 網頁空白

請打開瀏覽器 DevTools Console 查看錯誤。常見原因：

- 檔案沒有全部上傳
- `js/firebase-config.js` 檔名打錯
- GitHub Pages 還沒部署完成
- 瀏覽器快取舊檔案，可重新整理或等待幾分鐘

## Firebase API key 可以放 GitHub 嗎？

Firebase Web App 的 API key 通常可以放在前端程式裡，因為它主要用來識別 Firebase 專案，不是用來授權資料讀寫。真正要保護資料的是 Security Rules。不要把 service account 私鑰或 Admin SDK 憑證放到 GitHub。

---

# 後續可加強功能

- Cloud Functions 防作弊計分
- 全站總排行榜
- 房間密碼
- 自訂頭像
- PWA 離線安裝
- Firebase App Check

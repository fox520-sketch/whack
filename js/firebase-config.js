// 1. 到 Firebase Console 建立 Web App 後，複製 firebaseConfig 取代下面內容。
// 2. databaseURL 很重要：多人房間會使用 Realtime Database。
// 3. Firebase API key 可以放在前端；真正的保護請靠 Security Rules 與 App Check。
export const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY_HERE',
  authDomain: 'PASTE_YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://PASTE_YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'PASTE_YOUR_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID'
};

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('PASTE_') &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes('PASTE_')
  );
}

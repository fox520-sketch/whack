// 1. 到 Firebase Console 建立 Web App 後，複製 firebaseConfig 取代下面內容。
// 2. databaseURL 很重要：多人房間會使用 Realtime Database。
// 3. Firebase API key 可以放在前端；真正的保護請靠 Security Rules 與 App Check。
export const firebaseConfig = {
  apiKey: "AIzaSyDnNybBa7asOKJ_EZh8_ga2NmDP_fViRqs",
  authDomain: "ocean-whack-a-mole-firebase.firebaseapp.com",
  databaseURL: "https://ocean-whack-a-mole-firebase-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ocean-whack-a-mole-firebase",
  storageBucket: "ocean-whack-a-mole-firebase.firebasestorage.app",
  messagingSenderId: "631546730141",
  appId: "1:631546730141:web:22aeb9a7bb6fadf2c2e674"
};

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('PASTE_') &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes('PASTE_')
  );
}

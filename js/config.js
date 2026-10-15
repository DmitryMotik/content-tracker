/* =====================================================================
   КЛЮЧИ И ПАРОЛЬ. Меняешь пароль админа / API-ключи — только здесь.
   ВАЖНО: файл открыт любому посетителю сайта. Настоящая защита данных —
   это правила Firestore (Firebase Console → Firestore → Rules), а не пароль.
   YouTube/Кинопоиск ключи ограничь по домену в консоли Google / в кабинете API.
   ===================================================================== */
window.APP_CONFIG = (() => {
    const myFirebaseConfig = {
        apiKey: "AIzaSyB-cyOOrnBbj0lbWQ93NArKu-f6t3BPhg8",
        authDomain: "mytracker-457e8.firebaseapp.com",
        projectId: "mytracker-457e8",
        storageBucket: "mytracker-457e8.firebasestorage.app",
        messagingSenderId: "185340813530",
        appId: "1:185340813530:web:ca68e09929527867d7c5e3",
        measurementId: "G-4TBVP0JMFQ"
    };

    const ADMIN_PASSWORD = "222-00464Qw"; 
    const KINOPOISK_API_KEY = "87302479-2e5b-4aad-ae8d-d1ad69aa5307";
    const YOUTUBE_API_KEY = "AIzaSyCYSMX-MTO4X30XIVPp4UNSBTCN2uXp1fk";
    return { myFirebaseConfig, ADMIN_PASSWORD, KINOPOISK_API_KEY, YOUTUBE_API_KEY };
})();

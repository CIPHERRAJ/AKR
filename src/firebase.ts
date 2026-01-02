import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyD663C4LxU839Neqct0zESRODq6M4-IUuI",
    authDomain: "vimal-fb94e.firebaseapp.com",
    projectId: "vimal-fb94e",
    storageBucket: "vimal-fb94e.firebasestorage.app",
    messagingSenderId: "168626553210",
    appId: "1:168626553210:web:5cbeaf1d9c348845f116c3",
    measurementId: "G-23B6791Z1G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

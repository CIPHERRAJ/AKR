import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyD13NALWfcRdUEbESc5YkP0S509NS5ZkpI",
    authDomain: "akr-jewllery.firebaseapp.com",
    projectId: "akr-jewllery",
    storageBucket: "akr-jewllery.firebasestorage.app",
    messagingSenderId: "460103902164",
    appId: "1:460103902164:web:7fcb5f163d9574f8d92c41",
    measurementId: "G-DRLTGENE04"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

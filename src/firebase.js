// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCZKbU0bLOdTpre1vt62lw7QcBJm0oBe0M",
  authDomain: "cmb-audiovisuales.firebaseapp.com",
  databaseURL: "https://cmb-audiovisuales-default-rtdb.firebaseio.com",
  projectId: "cmb-audiovisuales",
  storageBucket: "cmb-audiovisuales.firebasestorage.app",
  messagingSenderId: "902248003924",
  appId: "1:902248003924:web:ab2f90f26efafdaa1c70c1",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export default app;

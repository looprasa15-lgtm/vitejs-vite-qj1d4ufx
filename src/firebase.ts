
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBhtv-77uYHm2-t74q3TK4rYVwaf_P6a3g",
  authDomain: 'loop-rasa-indonesia-food.firebaseapp.com',
  projectId: 'loop-rasa-indonesia-food',
  storageBucket: 'loop-rasa-indonesia-food.firebasestorage.app',
  messagingSenderId: '197761550845',
  appId: '1:197761550845:web:57f7b22a0263253183b194',
  measurementId: 'G-9HJ2VZTV59',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

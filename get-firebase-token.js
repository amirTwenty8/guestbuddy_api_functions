// Script to get a Firebase ID token for testing
const firebase = require('firebase/app');
require('firebase/auth');

// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "guestbuddy-test-3b36d.firebaseapp.com",
  projectId: "guestbuddy-test-3b36d",
  storageBucket: "guestbuddy-test-3b36d.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Sign in with email and password
async function getToken() {
  try {
    // Replace with your test user credentials
    const userCredential = await firebase.auth().signInWithEmailAndPassword(
      "test@example.com", 
      "password123"
    );
    
    // Get the ID token
    const token = await userCredential.user.getIdToken();
    console.log('Your Firebase ID token:');
    console.log(token);
  } catch (error) {
    console.error('Error getting token:', error);
  }
}

getToken(); 
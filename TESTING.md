# Testing GuestBuddy API Functions

This guide explains how to test the GuestBuddy API Functions using Postman.

## Prerequisites

1. [Postman](https://www.postman.com/downloads/) installed
2. A Firebase account with access to the GuestBuddy project
3. Node.js installed (for getting auth tokens)

## Setup

### 1. Get a Firebase Authentication Token

Since our API functions require authentication, you'll need a valid Firebase Auth token:

#### Option 1: Using the provided script

1. Edit the `get-firebase-token.js` file with your Firebase config and test user credentials
2. Install dependencies: `npm install firebase`
3. Run the script: `node get-firebase-token.js`
4. Copy the token that is printed to the console

#### Option 2: Using Firebase Auth REST API

You can also get a token using the Firebase Auth REST API:

```bash
curl -X POST \
  https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "returnSecureToken": true
  }'
```

The response will contain an `idToken` field with your authentication token.

### 2. Import the Postman Collection

1. Open Postman
2. Click "Import" and select the `GuestBuddy_API_Tests.postman_collection.json` file
3. The collection will be imported with a pre-configured request for the `createEvent` function

### 3. Configure the Collection

1. Click on the collection name "GuestBuddy API Tests" in the sidebar
2. Go to the "Authorization" tab
3. Paste your Firebase ID token in the "Token" field
4. Click "Update"

## Testing the createEvent Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/createEvent`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "test-event-123",
    "eventName": "Test Event",
    "startDateTime": "2023-08-01T18:00:00Z",
    "endDateTime": "2023-08-01T23:00:00Z",
    "companyId": "YOUR_COMPANY_ID",
    "tableLayouts": ["layout1"],
    "categories": ["VIP", "Regular"],
    "clubCardIds": ["card1", "card2"],
    "eventGenre": ["Party"]
  }
}
```

> **Important**: Replace `YOUR_COMPANY_ID` with a valid company ID from your Firestore database. Also ensure that the layouts you reference in `tableLayouts` exist in your database.

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Event created successfully",
    "data": {
      "eventId": "test-event-123"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors (401)**
   - Your token might have expired (they typically last 1 hour)
   - Generate a new token using the script or REST API

2. **Validation Errors**
   - Check the error message in the response
   - Ensure all required fields are provided and in the correct format

3. **Not Found Errors**
   - Ensure the company ID exists in your Firestore database
   - Ensure the layout names exist in your Firestore database

4. **CORS Issues**
   - If testing from a browser, you might encounter CORS issues
   - Use Postman which doesn't have CORS restrictions

## Using Firebase Emulator for Local Testing

For local testing without deploying to production, you can use the Firebase Emulator Suite:

1. Start the emulator: `firebase emulators:start`
2. Update the Postman request URL to use the local emulator URL (typically `http://localhost:5001/guestbuddy-test-3b36d/us-central1/createEvent`)

## Using the Firebase Console for Testing

You can also test callable functions directly from the Firebase Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to "Functions" in the sidebar
4. Find your function and click "Test function"
5. Enter the test data in JSON format
6. Click "Test function" to execute 
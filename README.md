# GuestBuddy API Functions

This repository contains the API functions for the GuestBuddy application. It serves as a centralized API layer for both Flutter and React applications, ensuring consistent data handling across all clients.

## Project Structure

```
functions/
├── src/
│   ├── api/                 # API endpoints organized by domain
│   │   ├── auth/            # Authentication endpoints
│   │   ├── users/           # User management endpoints
│   │   ├── data/            # Data management endpoints
│   │   ├── events/          # Event management endpoints
│   │   └── storage/         # File storage endpoints
│   ├── middleware/          # Express middleware
│   │   └── auth.ts          # Authentication middleware
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Common types used across the project
│   ├── utils/               # Utility functions
│   │   ├── error-handler.ts # Error handling utilities
│   │   └── validation.ts    # Request validation utilities
│   └── index.ts             # Main entry point
└── ...
```

## Authentication

All API endpoints are protected with Firebase Authentication. Clients must include a valid Firebase ID token in the `Authorization` header of each request:

```
Authorization: Bearer <firebase-id-token>
```

## API Endpoints

### Auth API

- **createAccount** - `createAccount`: Callable function to create a new user account with Firebase Auth and Firestore data
- **verifyEmail** - `verifyEmail`: Callable function to verify email with 6-digit verification code
- **resendVerificationEmail** - `resendVerificationEmail`: Callable function to resend verification email
- **Verify Token** - `verifyToken`: Callable function that verifies a Firebase ID token
- **Revoke User Sessions** - `revokeUserSessions`: Callable function that revokes all refresh tokens for a user (admin only)

### Users API

- **GET /users/:userId** - Get user profile
- **PUT /users/:userId** - Update user profile
- **createUserProfile** - Callable function to create a new user profile after registration

### Data API

- **GET /data** - Get all data items for the authenticated user
- **GET /data/:itemId** - Get a specific data item
- **POST /data** - Create a new data item
- **PUT /data/:itemId** - Update a data item
- **DELETE /data/:itemId** - Delete a data item
- **batchUpdateItems** - Callable function for batch operations on multiple items

### Events API

- **createEvent** - Callable function to create a new event with all related data (tables, guest lists, etc.)
- **updateEvent** - Callable function to update an existing event with table layout changes
- **deleteEvent** - Callable function to delete an event and all its subcollections

### Guests API

- **addGuest** - Callable function to add a guest to an event's guest list with summary updates
- **addMultipleGuests** - Callable function to add multiple guests from text input with draft support
- **saveGuestDraft** - Callable function to save a draft for multiple guests
- **clearGuestDraft** - Callable function to clear a saved draft for multiple guests
- **updateGuest** - Callable function to update an existing guest's details with summary recalculation
- **checkInGuest** - Callable function to check in guests or edit check-in counts with rapid tapping support

### Storage API

- **getUploadSignedUrl** - Callable function to generate a signed URL for file uploads
- **getDownloadSignedUrl** - Callable function to generate a signed URL for file downloads
- **deleteFile** - Callable function to delete a file

## Development

### Prerequisites

- Node.js 20 or higher
- Firebase CLI

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   cd functions
   npm install
   ```

### Local Development

```
npm run serve
```

This will start the Firebase emulators with the functions.

### Deployment

```
npm run deploy
```

## Testing

For testing instructions, see [TESTING.md](TESTING.md).

## Best Practices

1. **Authentication**: Always verify authentication tokens before processing requests
2. **Validation**: Validate all request data using Joi schemas
3. **Error Handling**: Use consistent error handling with appropriate HTTP status codes
4. **Security**: Implement proper authorization checks for each endpoint
5. **Logging**: Log important events and errors for debugging

## Client Integration

### Flutter

```dart
import 'package:cloud_functions/cloud_functions.dart';

Future<void> createEvent(Map<String, dynamic> eventData) async {
  try {
    // Get the callable function
    final callable = FirebaseFunctions.instance.httpsCallable('createEvent');
    
    // Call the function with event data
    final result = await callable.call(eventData);
    
    print('Event created successfully: ${result.data}');
    return result.data;
  } catch (e) {
    print('Error creating event: $e');
    throw e;
  }
}
```

### React

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

async function createEvent(eventData) {
  try {
    const functions = getFunctions();
    const createEventFunction = httpsCallable(functions, 'createEvent');
    
    const result = await createEventFunction(eventData);
    console.log('Event created successfully:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}
```

### File Upload Example

```javascript
// Get a signed URL for upload
const { data } = await callApi('getUploadSignedUrl', {
  fileName: 'profile.jpg',
  contentType: 'image/jpeg',
  folderPath: 'profiles'
});

// Upload the file directly to the signed URL
const response = await fetch(data.url, {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/jpeg',
  },
  body: fileBlob, // The actual file data
});

// Store the filePath for later use
const filePath = data.filePath;
``` 
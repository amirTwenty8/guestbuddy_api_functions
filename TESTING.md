# Testing GuestBuddy API Functions

This guide explains how to test the GuestBuddy API Functions using Postman.

## Available Functions

1. **createEvent** - Create a new event with table layouts, categories, club cards, and genres
2. **updateEvent** - Update an existing event with table layout changes
3. **deleteEvent** - Delete an event and all its subcollections
4. **addGuest** - Add a guest to an event's guest list with summary updates
5. **addMultipleGuests** - Add multiple guests from text input with draft support
6. **saveGuestDraft** - Save a draft for multiple guests
7. **clearGuestDraft** - Clear a saved draft for multiple guests
8. **updateGuest** - Update an existing guest's details with summary recalculation
9. **createAccount** - Create a new user account with Firebase Auth and Firestore data

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
    "tableLayouts": ["layout_document_id_1", "layout_document_id_2"],
    "categories": ["category_document_id_1", "category_document_id_2"],
    "clubCardIds": ["clubcard_document_id_1", "clubcard_document_id_2"],
    "eventGenre": ["genre_document_id_1", "genre_document_id_2"]
  }
}
```

> **Important**: 
> - Replace `YOUR_COMPANY_ID` with a valid company ID from your Firestore database
> - All IDs in `tableLayouts`, `categories`, `clubCardIds`, and `eventGenre` must be valid document IDs from their respective collections
> - The function will fetch the names from these documents and store both IDs and names in the event

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Event created successfully",
    "data": {
      "eventId": "test-event-123",
      "tableLayouts": [
        {"id": "layout_document_id_1", "name": "Layout Name 1"},
        {"id": "layout_document_id_2", "name": "Layout Name 2"}
      ],
      "categories": [
        {"id": "category_document_id_1", "name": "VIP"},
        {"id": "category_document_id_2", "name": "Regular"}
      ],
      "clubCardIds": [
        {"id": "clubcard_document_id_1", "name": "Gold Card"},
        {"id": "clubcard_document_id_2", "name": "Silver Card"}
      ],
      "eventGenre": [
        {"id": "genre_document_id_1", "name": "Party"},
        {"id": "genre_document_id_2", "name": "Concert"}
      ]
    }
  }
}
```

## Testing the updateEvent Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateEvent`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (Partial Updates Supported)

You can now send **only the fields you want to update**! Here are some examples:

#### Example 1: Update only the event name
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "eventName": "Updated Event Name"
  }
}
```

#### Example 2: Update only dates
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "startDateTime": "2023-08-01T18:00:00Z",
    "endDateTime": "2023-08-01T23:00:00Z"
  }
}
```

#### Example 3: Update only table layouts
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "tableLayouts": ["layout_document_id_1", "layout_document_id_3"]
  }
}
```

#### Example 4: Full update (all fields)
```json
{
  "data": {
    "eventId": "existing-event-id",
    "eventName": "Updated Event Name",
    "startDateTime": "2023-08-01T18:00:00Z",
    "endDateTime": "2023-08-01T23:00:00Z",
    "companyId": "YOUR_COMPANY_ID",
    "tableLayouts": ["layout_document_id_1", "layout_document_id_3"],
    "categories": ["category_document_id_1"],
    "clubCardIds": ["clubcard_document_id_1"],
    "eventGenre": ["genre_document_id_1"]
  }
}
```

> **Important**: 
> - **Required fields**: `eventId` and `companyId`
> - **Optional fields**: `eventName`, `startDateTime`, `endDateTime`, `tableLayouts`, `categories`, `clubCardIds`, `eventGenre`
> - Only provided fields will be updated
> - If `tableLayouts` is provided, the function will automatically calculate which layouts to add/remove
> - Table summary statistics are only updated when `tableLayouts` is provided

### Expected Response

The response will only include the fields that were updated:

#### Example 1: Name-only update response
```json
{
  "result": {
    "success": true,
    "message": "Event updated successfully",
    "data": {
      "eventId": "existing-event-id",
      "eventName": "Updated Event Name"
    }
  }
}
```

#### Example 2: Table layouts update response
```json
{
  "result": {
    "success": true,
    "message": "Event updated successfully",
    "data": {
      "eventId": "existing-event-id",
      "tableLayouts": [
        {"id": "layout_document_id_1", "name": "Layout Name 1"},
        {"id": "layout_document_id_3", "name": "Layout Name 3"}
      ],
      "changes": {
        "layoutsRemoved": ["layout_document_id_2"],
        "layoutsAdded": ["layout_document_id_3"],
        "tableChanges": {
          "totalTablesChange": 5,
          "totalGuestsChange": 25,
          "totalCheckedInChange": 0,
          "totalBookedChange": 2,
          "totalTableLimitChange": 50,
          "totalTableSpentChange": 0
        }
      }
    }
  }
}
```

#### Example 3: Full update response
```json
{
  "result": {
    "success": true,
    "message": "Event updated successfully",
    "data": {
      "eventId": "existing-event-id",
      "eventName": "Updated Event Name",
      "startDateTime": "2023-08-01T18:00:00Z",
      "endDateTime": "2023-08-01T23:00:00Z",
      "tableLayouts": [
        {"id": "layout_document_id_1", "name": "Layout Name 1"},
        {"id": "layout_document_id_3", "name": "Layout Name 3"}
      ],
      "categories": [
        {"id": "category_document_id_1", "name": "VIP"}
      ],
      "clubCardIds": [
        {"id": "clubcard_document_id_1", "name": "Gold Card"}
      ],
      "eventGenre": [
        {"id": "genre_document_id_1", "name": "Party"}
      ],
      "changes": {
        "layoutsRemoved": ["layout_document_id_2"],
        "layoutsAdded": ["layout_document_id_3"],
        "tableChanges": {
          "totalTablesChange": 5,
          "totalGuestsChange": 25,
          "totalCheckedInChange": 0,
          "totalBookedChange": 2,
          "totalTableLimitChange": 50,
          "totalTableSpentChange": 0
        }
      }
    }
  }
}
```

> **Note**: The `changes` object is only included when `tableLayouts` is provided in the request.

## Testing the deleteEvent Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/deleteEvent`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId` and `companyId`
> - The function will delete the event and ALL its subcollections (guest_lists, table_lists)
> - This operation is **irreversible** - make sure to confirm with the user
> - The function will return information about what was deleted

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Event deleted successfully",
    "data": {
      "eventId": "existing-event-id",
      "eventName": "Test Event",
      "deletedDocuments": {
        "guestLists": 3,
        "tableLists": 5,
        "total": 9
      },
      "deletedBy": "John Doe",
      "deletedAt": "2023-08-01T18:00:00.000Z"
    }
  }
}
```

### Error Response (Event Not Found)

```json
{
  "result": {
    "success": false,
    "error": "Event not found"
  }
}
```

## Testing the addGuest Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/addGuest`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestName": "John Doe",
    "normalGuests": 2,
    "freeGuests": 1,
    "comment": "VIP guest with special requirements",
    "categories": ["VIP"],
    "selectedUserId": "optional-user-id-from-search"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestName`
> - **Optional fields**: `normalGuests` (default: 0), `freeGuests` (default: 0), `comment`, `categories`, `selectedUserId`
> - At least one of `normalGuests` or `freeGuests` must be greater than 0
> - The function will automatically update guest list summary statistics
> - **User ID handling**: 
>   - If `selectedUserId` is provided (existing user from search), that ID is used
>   - If no `selectedUserId` is provided (new guest), a new user ID is auto-generated
> - All guests are added to company guests collection for tracking

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Guest added successfully",
    "data": {
      "guestId": "generated-uuid",
      "guestName": "John Doe",
      "normalGuests": 2,
      "freeGuests": 1,
      "totalGuests": 3,
      "addedBy": "John Doe",
      "addedAt": "2023-08-01T18:00:00.000Z",
      "userIdForCompanyGuests": "existing-user-id-or-generated-uuid",
      "userType": "existing"
    }
  }
}
```

### Error Response (Validation Error)

```json
{
  "result": {
    "success": false,
    "error": "At least one guest type must have a value greater than 0"
  }
}
```

## Testing the addMultipleGuests Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/addMultipleGuests`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestsText": "John Doe +2 +3\nJane Smith +1 +2\nBob Johnson +0 +1"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestsText`
> - **Format**: Each line should be "FirstName LastName +free +paid"
> - **Example**: "John Doe +2 +3" means 2 free guests and 3 paid guests
> - The function will parse each line and create individual guest entries
> - All guests are added to company guests collection for tracking

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Multiple guests added successfully",
    "data": {
      "guestsAdded": 3,
      "totalNormalGuests": 6,
      "totalFreeGuests": 3,
      "totalGuests": 9,
      "addedBy": "John Doe",
      "addedAt": "2023-08-01T18:00:00.000Z",
      "guestNames": ["John Doe", "Jane Smith", "Bob Johnson"]
    }
  }
}
```

## Testing the saveGuestDraft Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/saveGuestDraft`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id",
    "draftText": "John Doe +2 +3\nJane Smith +1 +2"
  }
}
```

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Draft saved successfully",
    "data": {
      "eventId": "existing-event-id",
      "savedAt": "2023-08-01T18:00:00.000Z"
    }
  }
}
```

## Testing the clearGuestDraft Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/clearGuestDraft`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id"
  }
}
```

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Draft cleared successfully",
    "data": {
      "eventId": "existing-event-id",
      "clearedAt": "2023-08-01T18:00:00.000Z"
    }
  }
}
```

## Testing the updateGuest Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateGuest`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestId": "existing-guest-id",
    "guestName": "Updated Guest Name",
    "normalGuests": 3,
    "freeGuests": 1,
    "comment": "Updated comment",
    "categories": ["VIP"]
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestId`
> - **Optional fields**: `guestName`, `normalGuests`, `freeGuests`, `comment`, `categories`
> - Only send the fields you want to update
> - The function will calculate differences and update summary statistics accordingly
> - Changes are logged with user information and timestamp

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Guest updated successfully",
    "data": {
      "guestId": "existing-guest-id",
      "guestName": "Updated Guest Name",
      "normalGuests": 3,
      "freeGuests": 1,
      "totalGuests": 4,
      "comment": "Updated comment",
      "categories": ["VIP"],
      "updatedBy": "John Doe",
      "updatedAt": "2023-08-01T18:00:00.000Z",
      "changes": {
        "guestName": "Updated Guest Name",
        "normalGuests": 3,
        "freeGuests": 1,
        "comment": "Updated comment",
        "categories": ["VIP"]
      },
      "summaryUpdated": true
    }
  }
}
```

### Partial Update Example

You can also update only specific fields:

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestId": "existing-guest-id",
    "guestName": "New Name Only"
  }
}
```

This will only update the guest name and leave all other fields unchanged.

## Testing the createAccount Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/createAccount`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - **Note**: No authentication required for account creation

### Request Body

```json
{
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+46732010328",
    "birthDate": "1990-01-15",
    "country": "Sweden",
    "city": "Stockholm",
    "password": "securePassword123",
    "terms": true
  }
}
```

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Account created successfully",
    "data": {
      "userId": "rd9iei8OEYbqANWbgdyFGIVjAC23",
      "email": "john.doe@example.com",
      "displayName": "John Doe"
    }
  }
}
```

### Validation Rules

- **firstName**: Required, 1-50 characters
- **lastName**: Required, 1-50 characters
- **email**: Required, valid email format
- **phoneNumber**: Required, E.164 format (e.g., +46732010328)
- **birthDate**: Required, YYYY-MM-DD format, user must be at least 16 years old
- **country**: Required, 1-100 characters
- **city**: Required, 1-100 characters
- **password**: Required, 8-128 characters
- **terms**: Required, must be true

### User Data Structure

The function creates a user document in the `users` collection with the following structure:

```json
{
  "businessMode": false,
  "companyId": [],
  "e164Number": "+46732010328",
  "phoneNumber": "0732010328",
  "userActive": true,
  "userEmail": "john.doe@example.com",
  "userFirstName": "John",
  "userLastName": "Doe",
  "birthDate": "1990-01-15",
  "country": "Sweden",
  "city": "Stockholm",
  "terms": true,
  "createdAt": "2025-01-20T10:30:00Z",
  "updatedAt": "2025-01-20T10:30:00Z"
}
```

### Phone Number Processing

The function automatically processes phone numbers based on the selected country:

- **e164Number**: Stores the full international format (e.g., "+46732010328")
- **phoneNumber**: Stores the local format with "0" prefix (e.g., "0732010328")

**Examples:**
- Sweden (+46): "+46732010328" → "0732010328"
- Germany (+49): "+49123456789" → "0123456789"
- UK (+44): "+447123456789" → "07123456789"

## Data Structure Requirements

The function expects the following Firestore collections to exist under each company:

### Table Layouts
- **Collection**: `companies/{companyId}/layouts`
- **Document Structure**: Must have a `name` field
- **Example**: `{ "name": "VIP Section", "items": [...] }`

### Categories
- **Collection**: `companies/{companyId}/categories`
- **Document Structure**: Must have a `name` field
- **Example**: `{ "name": "VIP", "description": "VIP category" }`

### Club Cards
- **Collection**: `companies/{companyId}/cards`
- **Document Structure**: Must have a `title` field
- **Example**: `{ "title": "VIP GB", "description": "VIP card description", "imageUrl": "...", "validFrom": "...", "validTo": "..." }`

### Event Genres
- **Collection**: `companies/{companyId}/genres`
- **Document Structure**: Must have a `name` field
- **Example**: `{ "name": "Party", "description": "Party events" }`

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
   - Ensure all referenced document IDs exist in their respective collections
   - Check that the documents have a `name` field

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
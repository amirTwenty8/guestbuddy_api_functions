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
9. **checkInGuest** - Check in guests or edit check-in counts with rapid tapping support
10. **createAccount** - Create a new user account with Firebase Auth and Firestore data
11. **verifyEmail** - Verify email with 6-digit verification code
12. **resendVerificationEmail** - Resend verification email to user
13. **checkExistingUser** - Check if a user exists with the given phone number (first step of table booking)
14. **bookTable** - Book a table for an event (second step of table booking, requires user choice)
15. **sendSmsNotification** - Send SMS notifications for booking confirmations or reminders
16. **updateTable** - Update table information after booking with logging and spending tracking
17. **cancelReservation** - Cancel a table reservation and remove all guest data except staff
18. **resellTable** - Re-sell a table during an event while preserving historical data

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

## Testing the Two-Step Table Booking Process

The table booking process now uses a two-step approach to handle existing users properly:

### Step 1: Check for Existing User

**Function**: `checkExistingUser`

#### Request Details
- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/checkExistingUser`
- **Method**: POST

#### Request Body
```json
{
  "data": {
    "phoneNumber": "+46732010328"
  }
}
```

**OR with email (optional):**
```json
{
  "data": {
    "email": "john@example.com"
  }
}
```

**OR with both (optional):**
```json
{
  "data": {
    "phoneNumber": "+46732010328",
    "email": "john@example.com"
  }
}
```

> **Note**: When both `phoneNumber` and `email` are provided, the function searches by phone number first. If no user is found by phone number, it then searches by email. This ensures phone number matches take priority.

#### Response if User Found
```json
{
  "result": {
    "success": true,
    "message": "Existing user found",
    "requiresUserChoice": true,
    "existingUser": {
      "userId": "existing-user-id",
      "name": "John Doe",
      "email": "john@real.com",
      "phoneNumber": "721842142",
      "e164Number": "+46732010328"
    },
    "choices": [
      "A - Use existing user: John Doe",
      "B - Cancel and change phone number"
    ]
  }
}
```

#### Response if No User Found
```json
{
  "result": {
    "success": true,
    "message": "No existing user found",
    "requiresUserChoice": false,
    "existingUser": null,
    "choices": []
  }
}
```

### Step 2: Book Table (with User Choice)

**Function**: `bookTable`

#### Request Details
- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/bookTable`
- **Method**: POST

#### Option A: Use Existing User
```json
{
  "data": {
    "userId": "existing-user-id",  // Use the userId from step 1
    "companyId": "Z640gK6OvfiuDRx069ht",
    "eventId": "41e745f0-490e-4fe2-b1b2-f0b30babcb59",
    "tableId": "Ti79EGnkyqANxiQbe3OM",
    "tableName": "101",
    "guestName": "Jason test",  // This will be ignored, user's real name used
    "phoneNumber": "+46732010328",  // This will be ignored, user's real phone used
    "email": "js@test.se",  // This will be ignored, user's real email used
    "nrOfGuests": 10,
    "tableLimit": 10000,
    "tableSpent": 0,
    "tableTimeFrom": "20:00",
    "tableTimeTo": "02:00",
    "comment": "VIP guest",
    "tableBookedBy": "Amir"
  }
}
```

#### Option B: Create New User
```json
{
  "data": {
    "userId": "new_user",  // Special flag to create new user
    "companyId": "Z640gK6OvfiuDRx069ht",
    "eventId": "41e745f0-490e-4fe2-b1b2-f0b30babcb59",
    "tableId": "Ti79EGnkyqANxiQbe3OM",
    "tableName": "101",
    "guestName": "Jason test",  // This will be used for new user
    "phoneNumber": "+46732010328",  // This will be used for new user
    "email": "js@test.se",  // This will be used for new user
    "nrOfGuests": 10,
    "tableLimit": 10000,
    "tableSpent": 0,
    "tableTimeFrom": "20:00",
    "tableTimeTo": "02:00",
    "comment": "VIP guest",
    "tableBookedBy": "Amir"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `tableId`, `tableName` are required
- `tableId` must be a valid Firestore document ID (e.g., "Ti79EGnkyqANxiQbe3OM")
- `userId` is required and must be either:
  - A valid existing user ID from step 1, or
  - A string starting with "new_" to create a new user
- `nrOfGuests` is required and must be at least 1
- `tableLimit`, `tableSpent` are optional and must be non-negative integers

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Table booked successfully",
    "data": {
      "tableId": "Ti79EGnkyqANxiQbe3OM",
      "tableName": "101",
      "layoutName": "VIP",
      "userId": "actual-user-id",
      // ACTUAL DATA SAVED TO DATABASE:
      "guestName": "John Doe", // From user database, not request
      "phoneNumber": "+46732010328", // From user database, not request
      "localPhoneNumber": "721842142", // From user database, not request
      "email": "john@real.com", // From user database, not request
      "nrOfGuests": 10,
      "tableLimit": 10000,
      "tableSpent": 0,
      "tableTimeFrom": "20:00",
      "tableTimeTo": "02:00",
      "comment": "VIP guest",
      "bookedBy": "Amir",
      // SHOWS WHETHER EXISTING USER DATA WAS USED:
      "userDataUsed": {
        "userFirstName": "John",
        "userLastName": "Doe",
        "userEmail": "john@real.com",
        "userPhoneNumber": "721842142",
        "userE164Number": "+46732010328"
      }
    }
  }
}
```

### What the Functions Do

#### checkExistingUser
1. **Phone Number Search**: Searches for existing users by E.164 and local phone number formats
2. **Email Search**: Optionally searches for existing users by email address
3. **Priority**: Phone number search takes precedence over email search
4. **User Choice**: Returns user data and choices if a match is found
5. **No Side Effects**: Only checks, doesn't create or modify anything

#### bookTable
1. **User Validation**: Verifies the provided userId exists or creates new user
2. **Table Booking**: Books the specified table with guest information
3. **Data Consistency**: Uses existing user data when available, prevents duplicates
4. **Guest Spending**: Updates guest spending data in both company and user collections
5. **Logging**: Adds booking action to table's logs array
6. **ID Consistency**: Guest document ID in `companies/{companyId}/guests/{userId}` matches the user document ID in `users/{userId}`

### Implementation Flow for Other Projects

```typescript
// Step 1: Check for existing user
// You can search by phone number, email, or both
const checkResponse = await fetch('/checkExistingUser', {
  method: 'POST',
  body: JSON.stringify({
    data: { 
      phoneNumber: '+46732010328',
      email: 'john@example.com'  // Optional
    }
  })
});

const checkResult = await checkResponse.json();

if (checkResult.result.requiresUserChoice) {
  // Show user choice dialog
  const choice = await showUserChoiceDialog(checkResult.result.choices);
  
  if (choice === 'A') {
    // Use existing user
    const bookResponse = await fetch('/bookTable', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          userId: checkResult.result.existingUser.userId,
          // ... other booking data
        }
      })
    });
  } else if (choice === 'B') {
    // Let user change phone number
    // Go back to step 1
  }
} else {
  // No existing user, create new one
  const bookResponse = await fetch('/bookTable', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        userId: 'new_user',
        // ... other booking data
      }
    })
  });
}
```

## Testing the sendSmsNotification Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/sendSmsNotification`
- **Method**: POST

### Request Body (Confirmation)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "phoneNumber": "+1234567890",
    "guestName": "John Doe",
    "tableName": "Table 1",
    "notificationType": "confirmation",
    "message": "Hi John Doe! Your table Table 1 has been booked for VIP Night at 20:00. We look forward to seeing you! - GuestBuddy"
  }
}
```

### Request Body (Reminder)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "phoneNumber": "+1234567890",
    "guestName": "John Doe",
    "tableName": "Table 1",
    "notificationType": "reminder",
    "message": "Hi John Doe! Reminder: You have a table Table 1 booked for VIP Night at 20:00 today. See you soon! - GuestBuddy",
    "reminderTime": "2025-08-19T12:00:00Z"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `phoneNumber`, `guestName`, `tableName`, `message` are required
- `phoneNumber` must be in E.164 format (+1234567890)
- `notificationType` must be either "confirmation" or "reminder"
- `message` can be any length (46elks will automatically split long messages)
- `eventName`, `eventDateTime`, `timeFrom`, `reminderTime` are optional

### Expected Response (Confirmation)

```json
{
  "result": {
    "success": true,
    "message": "SMS confirmation sent successfully",
    "data": {
      "smsId": "generated-sms-id",
      "phoneNumber": "+1234567890",
      "guestName": "John Doe",
      "tableName": "Table 1",
      "notificationType": "confirmation",
      "message": "Hi John Doe! Your table Table 1 has been booked for VIP Night at 20:00. We look forward to seeing you! - GuestBuddy",
      "status": "sent",
      "smsParts": 1,
      "totalSmsCount": 1
    }
  }
}
```

### Expected Response (Reminder - Scheduled)

```json
{
  "result": {
    "success": true,
    "message": "SMS reminder scheduled successfully",
    "data": {
      "smsId": "generated-sms-id",
      "phoneNumber": "+1234567890",
      "guestName": "John Doe",
      "tableName": "Table 1",
      "notificationType": "reminder",
      "message": "Hi John Doe! Reminder: You have a table Table 1 booked for VIP Night at 20:00 today. See you soon! - GuestBuddy",
      "status": "pending",
      "scheduledFor": "2025-08-19T12:00:00.000Z"
    }
  }
}
```

### What the Function Does

1. **Custom Messages**: Uses the message provided by the user for company-specific customization
2. **SMS Storage**: Saves SMS notification to database for tracking
3. **Scheduling**: Handles immediate sending or future scheduling for reminders
4. **Logging**: Creates a log entry for the SMS action
5. **Status Tracking**: Tracks SMS delivery status (pending/sent/failed)
6. **SMS Parts Tracking**: Captures how many SMS parts were sent (for long messages)

> **Note**: The actual SMS sending is currently logged but not implemented. You'll need to integrate with an SMS service like Twilio or SendGrid.

## Testing the updateTable Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateTable`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "layoutName": "VIP",
    "tableName": "101",
    "userId": "user-id-optional",
    "name": "John Doe",
    "phoneNr": "4808080",
    "e164Number": "+464808080",
    "tableLimit": 20000,
    "tableSpent": 15000,
    "nrOfGuests": 8,
    "tableCheckedIn": 6,
    "comment": "VIP guest with special requirements",
    "tableTimeFrom": "20:00",
    "tableTimeTo": "02:00",
    "tableBookedBy": "Amir Company Ehsani",
    "tableEmail": "john@example.com",
    "tableStaff": "Moa",
    "action": "updated"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `layoutName`, `tableName` are required
- `userId` is optional (required for spending tracking)
- All other fields are optional - only send the fields you want to update
- `action` defaults to "updated" if not provided

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Table updated successfully",
    "data": {
      "tableName": "101",
      "layoutName": "VIP",
      "changes": {
        "name": "John Doe",
        "tableLimit": 20000,
        "tableSpent": 15000,
        "nrOfGuests": 8,
        "tableCheckedIn": 6,
        "comment": "VIP guest with special requirements",
        "tableStaff": "Moa"
      },
      "updatedBy": "Amir Company Ehsani",
      "updatedAt": "2025-08-19T10:30:00.000Z",
      "logsCount": 5
    }
  }
}
```

### What the Function Does

1. **Table Update**: Updates the specified table in the table_lists collection
2. **Change Detection**: Only updates fields that have actually changed
3. **Logging**: Creates detailed logs with user information, timestamp, and changes
4. **Table Summary Update**: Automatically recalculates and updates table summary statistics:
   - `totalBooked`: Number of tables with bookings
   - `totalCheckedIn`: Total number of guests checked in
   - `totalGuests`: Total number of guests across all tables
   - `totalTableLimit`: Sum of all table spending limits
   - `totalTableSpent`: Sum of all table spending
   - `totalTables`: Total number of tables
5. **Spending Tracking**: If userId is provided and spent amount changed:
   - Updates user's event spending in `users/{userId}/eventSpending/{eventId}`
   - Updates company guest spending in `companies/{companyId}/guests/{userId}`
6. **Audit Trail**: Maintains complete history of all table changes

### Partial Update Example

You can update only specific fields:

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "layoutName": "VIP",
    "tableName": "101",
    "userId": "user-id",
    "tableSpent": 25000,
    "action": "spending updated"
  }
}
```

This will only update the spent amount and create a log entry with the action "spending updated".

## Testing the cancelReservation Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/cancelReservation`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "layoutName": "VIP",
    "tableName": "101"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `layoutName`, `tableName` are required
- The table must be currently reserved (have a userId)

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Reservation cancelled successfully",
    "data": {
      "tableName": "101",
      "layoutName": "VIP",
      "cancelledBy": "Amir Company Ehsani",
      "cancelledAt": "2025-08-19T15:30:00.000Z",
      "removedData": {
        "userId": "user-id-123",
        "name": "John Doe",
        "phoneNr": "4808080",
        "e164Number": "+464808080",
        "tableEmail": "john@example.com",
        "nrOfGuests": 8,
        "tableLimit": 20000,
        "tableSpent": 15000,
        "comment": "VIP guest"
      },
      "logsCount": 5
    }
  }
}
```

### What the Function Does

1. **Complete Data Removal**: Removes ALL guest data from the table:
   - `userId`, `name`, `phoneNr`, `e164Number`, `tableEmail`
   - `nrOfGuests`, `tableLimit`, `tableSpent`, `tableCheckedIn`
   - `tableTimeFrom`, `tableTimeTo`, `tableBookedBy`, `comment`
2. **Staff Preservation**: Keeps only the `tableStaff` field intact
3. **Event Spending Cleanup**: Removes the event from user's `eventSpending` map
4. **Company Guest Cleanup**: Removes the event from company guest's `eventSpending` map
5. **Table Summary Update**: Recalculates and updates table summary statistics
6. **Detailed Logging**: Creates comprehensive log entry with all removed data
7. **Audit Trail**: Maintains complete history of the cancellation

### Error Response (Table Not Reserved)

```json
{
  "result": {
    "success": false,
    "error": "Table is not reserved"
  }
}
```

## Testing the resellTable Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/resellTable`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "layoutName": "VIP",
    "tableName": "101"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `layoutName`, `tableName` are required
- The table must be currently reserved (have a userId)

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Table resold successfully",
    "data": {
      "tableName": "101",
      "layoutName": "VIP",
      "resoldBy": "Amir Company Ehsani",
      "resoldAt": "2025-08-19T15:30:00.000Z",
      "removedData": {
        "userId": "user-id-123",
        "name": "John Doe",
        "phoneNr": "4808080",
        "e164Number": "+464808080",
        "tableEmail": "john@example.com",
        "nrOfGuests": 8,
        "tableLimit": 20000,
        "tableSpent": 15000,
        "comment": "VIP guest"
      },
      "logsCount": 5,
      "note": "Event spending data and table summary remain unchanged for historical tracking"
    }
  }
}
```

### What the Function Does

1. **Complete Data Removal**: Removes ALL guest data from the table (same as cancelReservation):
   - `userId`, `name`, `phoneNr`, `e164Number`, `tableEmail`
   - `nrOfGuests`, `tableLimit`, `tableSpent`, `tableCheckedIn`
   - `tableTimeFrom`, `tableTimeTo`, `tableBookedBy`, `comment`
2. **Staff Preservation**: Keeps only the `tableStaff` field intact
3. **Historical Data Preservation**: 
   - Does NOT remove event from user's `eventSpending` map
   - Does NOT remove event from company guest's `eventSpending` map
   - Does NOT update table summary statistics
4. **Detailed Logging**: Creates comprehensive log entry with all removed data
5. **Audit Trail**: Maintains complete history of the resale

### Key Differences from cancelReservation

| Feature | cancelReservation | resellTable |
|---------|-------------------|-------------|
| **Removes guest data** | ✅ | ✅ |
| **Keeps staff** | ✅ | ✅ |
| **Removes from user spending** | ✅ | ❌ |
| **Removes from company guest spending** | ✅ | ❌ |
| **Updates tableSummary** | ✅ | ❌ |
| **Use case** | Pre-event cancellation | During-event resale |

### Error Response (Table Not Reserved)

```json
{
  "result": {
    "success": false,
    "error": "Table is not reserved"
  }
}
```

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

## Testing the checkInGuest Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/checkInGuest`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Increment Mode (Rapid Tapping)

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestId": "existing-guest-id",
    "normalIncrement": 1,
    "freeIncrement": 0,
    "action": "increment"
  }
}
```

### Set Mode (Manual Edit)

```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestId": "existing-guest-id",
    "normalCheckedIn": 3,
    "freeCheckedIn": 1,
    "action": "set"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestId`, `action`
> - **Increment mode**: Use `normalIncrement` and `freeIncrement` to add to existing counts
> - **Set mode**: Use `normalCheckedIn` and `freeCheckedIn` to set specific counts
> - **Action**: Must be either "increment" or "set"
> - Validates check-in limits against guest's total counts
> - Updates summary statistics automatically
> - Creates standardized log entries

### Expected Response (Increment Mode)

```json
{
  "result": {
    "success": true,
    "message": "Guests checked in successfully",
    "data": {
      "guestId": "existing-guest-id",
      "guestName": "John Doe",
      "normalCheckedIn": 3,
      "freeCheckedIn": 1,
      "totalCheckedIn": 4,
      "normalGuests": 5,
      "freeGuests": 2,
      "checkedInBy": "Amir Company Ehsani",
      "checkedInAt": "2023-08-01T18:00:00.000Z",
      "action": "increment",
      "changes": {
        "normalCheckedIn": 3
      },
      "summaryUpdated": true
    }
  }
}
```

### Expected Response (Set Mode)

```json
{
  "result": {
    "success": true,
    "message": "Check-in count updated successfully",
    "data": {
      "guestId": "existing-guest-id",
      "guestName": "John Doe",
      "normalCheckedIn": 3,
      "freeCheckedIn": 1,
      "totalCheckedIn": 4,
      "normalGuests": 5,
      "freeGuests": 2,
      "checkedInBy": "Amir Company Ehsani",
      "checkedInAt": "2023-08-01T18:00:00.000Z",
      "action": "set",
      "changes": {
        "normalCheckedIn": 3,
        "freeCheckedIn": 1
      },
      "summaryUpdated": true
    }
  }
}
```

### Error Response (Limit Exceeded)

```json
{
  "result": {
    "success": false,
    "error": "Cannot check in more than 5 normal guests"
  }
}
```

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
    "message": "Account created successfully. Please check your email for verification code.",
    "data": {
      "userId": "rd9iei8OEYbqANWbgdyFGIVjAC23",
      "email": "john.doe@example.com",
      "displayName": "John Doe",
      "verificationCode": "123456"
    }
  }
}
```

**Note**: The `verificationCode` field is included in the response for testing purposes. In production, this should be removed and the code should be sent via email instead.

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
  "emailVerified": false,
  "createdAt": "2025-01-20T10:30:00Z",
  "updatedAt": "2025-01-20T10:30:00Z"
}
```

**Note**: The `emailVerified` field starts as `false` and is updated to `true` when the user successfully verifies their email using the `verifyEmail` API.

### Verification Code System

The API implements a secure verification code system:

- **Code Generation**: Each account creation generates a unique 6-digit verification code
- **Code Storage**: Codes are stored in the `verification_codes` collection with expiration
- **Code Validation**: Codes expire after 10 minutes and can only be used once
- **Code Cleanup**: Expired codes are automatically cleaned up from the database
- **Email Sending**: Verification codes are sent via email to the user's email address

**Email Configuration**: The system now sends actual verification emails. See `EMAIL_SETUP.md` for configuration instructions.

**Verification Code Document Structure:**
```json
{
  "code": "123456",
  "email": "john.doe@example.com",
  "userId": "rd9iei8OEYbqANWbgdyFGIVjAC23",
  "createdAt": "2025-01-20T10:30:00Z",
  "expiresAt": "2025-01-20T10:40:00Z",
  "used": false
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

## Testing the verifyEmail Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/verifyEmail`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - **Note**: No authentication required for email verification

### Request Body

```json
{
  "data": {
    "email": "john.doe@example.com",
    "verificationCode": "123456"
  }
}
```

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Email verified successfully",
    "data": {
      "email": "john.doe@example.com",
      "emailVerified": true,
      "uid": "rd9iei8OEYbqANWbgdyFGIVjAC23"
    }
  }
}
```

### Validation Rules

- **email**: Required, valid email format, must exist in Firebase Auth
- **verificationCode**: Required, exactly 6 digits (0-9)

### Error Responses

**Email not found:**
```json
{
  "result": {
    "success": false,
    "error": "Email not found. Please check your email address."
  }
}
```

**Invalid verification code format:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"verificationCode\" must be a string of 6 characters"
  }
}
```

## Testing the resendVerificationEmail Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/resendVerificationEmail`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - **Note**: No authentication required for resending verification email

### Request Body

```json
{
  "data": {
    "email": "john.doe@example.com"
  }
}
```

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "New verification code sent successfully. Please check your email.",
    "data": {
      "email": "john.doe@example.com",
      "emailVerified": false,
      "verificationCode": "789012"
    }
  }
}
```

**Note**: The `verificationCode` field is included in the response for testing purposes. In production, this should be removed and the code should be sent via email instead.

### Validation Rules

- **email**: Required, valid email format, must exist in Firebase Auth

### Error Responses

**Email not found:**
```json
{
  "result": {
    "success": false,
    "error": "Email not found. Please check your email address."
  }
}
```

**Email already verified:**
```json
{
  "result": {
    "success": true,
    "message": "Email is already verified",
    "data": {
      "email": "john.doe@example.com",
      "emailVerified": true
    }
  }
}
```

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
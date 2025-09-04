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
10. **deleteGuest** - Delete one or multiple guests from guest lists with summary updates
11. **createAccount** - Create a new user account with Firebase Auth and Firestore data
12. **verifyEmail** - Verify email with 6-digit verification code
13. **resendVerificationEmail** - Resend verification email to user
14. **checkExistingUser** - Check if a user exists with the given phone number (first step of table booking)
15. **bookTable** - Book a table for an event (second step of table booking, requires user choice)
16. **sendSmsNotification** - Send SMS notifications for booking confirmations or reminders
17. **updateTable** - Update table information after booking with logging and spending tracking
18. **cancelReservation** - Cancel a table reservation and remove all guest data except staff
19. **resellTable** - Re-sell a table during an event while preserving historical data
20. **addUserToCompany** - Add users to a company, either by finding existing users or creating new ones
21. **editUserInCompany** - Edit user information and change their role within a company
22. **removeUserFromCompany** - Remove users from a company and manage their business mode
23. **createEventTicket** - Create tickets for an event with auto-generated UUID and ticket summary management
24. **createClubCard** - Create club cards with auto-generated QR codes and Firebase Storage uploads
25. **updateClubCard** - Update club card details and generate additional QR codes when needed
26. **deleteClubCard** - Delete club cards with validation that they're not in use
27. **createTableLayout** - Create table layouts from canvas objects with rotation support
28. **updateTableLayout** - Update existing table layouts with partial field updates and rotation support
29. **deleteTableLayout** - Delete table layouts with safety validation to prevent deletion of layouts in use
30. **createLandingPage** - Create custom landing pages for events with password protection and styling
31. **updateLandingPage** - Update existing landing pages with automatic slug regeneration and validation
32. **deleteLandingPage** - Delete landing pages with proper cleanup
33. **submitContactForm** - Submit support requests with attachments and email notifications

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
    "guestListId": "main",
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
> - **Optional fields**: `guestListId` (default: "main"), `normalGuests` (default: 0), `freeGuests` (default: 0), `comment`, `categories`, `selectedUserId`
> - **Guest List Selection**: 
>   - `guestListId`: "main" for default guest list, or UUID for additional guest lists
>   - If not provided, defaults to "main" (backward compatible)
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
      "userType": "existing",
      "guestListId": "main"
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

### Additional Guest List Examples

#### Add Guest to VIP List:
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestListId": "uuid-of-vip-guest-list",
    "guestName": "VIP Guest",
    "normalGuests": 3,
    "freeGuests": 0,
    "comment": "VIP section",
    "categories": ["VIP"]
  }
}
```

#### Add Guest to Staff List:
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestListId": "uuid-of-staff-list",
    "guestName": "Staff Member",
    "normalGuests": 1,
    "freeGuests": 0,
    "comment": "Event staff",
    "categories": ["Staff"]
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
    "guestListId": "main",
    "guestsText": "John Doe +2 +3\nJane Smith +1 +2\nBob Johnson +0 +1"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestsText`
> - **Optional fields**: `guestListId` (default: "main")
> - **Guest List Selection**: 
>   - `guestListId`: "main" for default guest list, or UUID for additional guest lists
>   - If not provided, defaults to "main" (backward compatible)
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
      "guestNames": ["John Doe", "Jane Smith", "Bob Johnson"],
      "guestListId": "main"
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
    "guestListId": "main",
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
> - **Optional fields**: `guestListId` (default: "main"), `guestName`, `normalGuests`, `freeGuests`, `comment`, `categories`
> - **Guest List Selection**: 
>   - `guestListId`: "main" for default guest list, or UUID for additional guest lists
>   - If not provided, defaults to "main" (backward compatible)
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
      "summaryUpdated": true,
      "guestListId": "main"
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
    "guestListId": "main",
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
    "guestListId": "main",
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
    "guestListId": "main",
    "guestId": "existing-guest-id",
    "normalCheckedIn": 3,
    "freeCheckedIn": 1,
    "action": "set"
  }
}
```

> **Important**: 
> - **Required fields**: `eventId`, `companyId`, `guestId`, `action`
> - **Optional fields**: `guestListId` (default: "main")
> - **Guest List Selection**: 
>   - `guestListId`: "main" for default guest list, or UUID for additional guest lists
>   - If not provided, defaults to "main" (backward compatible)
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
      "summaryUpdated": true,
      "guestListId": "main"
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
      "summaryUpdated": true,
      "guestListId": "main"
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

### Additional Guest List Examples

#### Check In Guest from VIP List:
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestListId": "uuid-of-vip-guest-list",
    "guestId": "vip-guest-id",
    "normalIncrement": 1,
    "freeIncrement": 0,
    "action": "increment"
  }
}
```

#### Check In Guest from Staff List:
```json
{
  "data": {
    "eventId": "existing-event-id",
    "companyId": "YOUR_COMPANY_ID",
    "guestListId": "uuid-of-staff-list",
    "guestId": "staff-guest-id",
    "normalCheckedIn": 1,
    "freeCheckedIn": 0,
    "action": "set"
  }
}
```

## Multiple Guest Lists Feature

The GuestBuddy API now supports multiple guest lists per event, allowing you to organize guests into different categories (e.g., VIP, Staff, Press, etc.) while maintaining a single event structure.

### How It Works

1. **Default Guest List**: Every event automatically has a "main" guest list
2. **Additional Guest Lists**: You can create additional guest lists when creating or updating events
3. **Dynamic Selection**: All guest functions now accept a `guestListId` parameter to specify which list to work with
4. **Backward Compatibility**: If no `guestListId` is provided, functions default to "main"

### Guest List Structure

#### Main Guest List (Default)
```
guest_lists/main
├── eventId: "event-id"
├── guestList: [array of guests]
└── lastUpdated: timestamp
```

#### Additional Guest Lists
```
guest_lists/{uuid}
├── eventId: "event-id"
├── guestList: [array of guests]
├── guestListName: "VIP Guests"  // The name you provided
└── lastUpdated: timestamp
```

### Creating Additional Guest Lists

When creating or updating an event, include the `additionalGuestLists` array:

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventName": "VIP Night",
    "startDateTime": "2025-09-01T18:00:00Z",
    "endDateTime": "2025-09-01T23:00:00Z",
    "additionalGuestLists": ["VIP Guests", "Staff", "Press"]
  }
}
```

This will create:
- `guest_lists/main` (default)
- `guest_lists/{uuid1}` with `guestListName: "VIP Guests"`
- `guest_lists/{uuid2}` with `guestListName: "Staff"`
- `guest_lists/{uuid3}` with `guestListName: "Press"`

### Using Guest Lists in Functions

All guest management functions now support the `guestListId` parameter:

#### Add Guest to VIP List
```json
{
  "data": {
    "eventId": "event-id",
    "companyId": "company-id",
    "guestListId": "uuid-of-vip-list",
    "guestName": "VIP Guest",
    "normalGuests": 3
  }
}
```

#### Update Guest in Staff List
```json
{
  "data": {
    "eventId": "event-id",
    "companyId": "company-id",
    "guestListId": "uuid-of-staff-list",
    "guestId": "guest-id",
    "normalGuests": 5
  }
}
```

#### Check In Guest from Press List
```json
{
  "data": {
    "eventId": "event-id",
    "companyId": "company-id",
    "guestListId": "uuid-of-press-list",
    "guestId": "guest-id",
    "normalIncrement": 1,
    "action": "increment"
  }
}
```

### Benefits

- **Organized Management**: Separate guest lists for different categories
- **Flexible Operations**: Add, update, and check-in guests from any list
- **Unified Summary**: All guest lists contribute to the same event summary
- **Backward Compatible**: Existing integrations continue to work with "main" list
- **Scalable**: No limit on the number of additional guest lists

## Testing the deleteGuest Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/deleteGuest`
- **Method**: `POST`
- **Content-Type**: `application/json`

### Request Body (Single Guest Deletion)

```json
{
  "data": {
    "eventId": "event-uuid-here",
    "companyId": "company-id-here",
    "guestListId": "main",
    "guestId": "guest-id-to-delete"
  }
}
```

### Request Body (Multiple Guests Deletion)

```json
{
  "data": {
    "eventId": "event-uuid-here",
    "companyId": "company-id-here",
    "guestListId": "main",
    "guestIds": ["guest-id-1", "guest-id-2", "guest-id-3"]
  }
}
```

### Request Body (Additional Guest List)

```json
{
  "data": {
    "eventId": "event-uuid-here",
    "companyId": "company-id-here",
    "guestListId": "additional-guest-list-uuid",
    "guestId": "guest-id-to-delete"
  }
}
```

### Response (Success)

```json
{
  "result": {
    "success": true,
    "message": "Guest deleted successfully",
    "data": {
      "guestsDeleted": 1,
      "guestIds": ["guest-id-to-delete"],
      "guestNames": ["John Doe"],
      "totalNormalGuestsRemoved": 2,
      "totalFreeGuestsRemoved": 1,
      "totalGuestsRemoved": 3,
      "totalCheckedInRemoved": 1,
      "deletedBy": "Admin User",
      "deletedAt": "2025-01-27T12:00:00.000Z",
      "guestListId": "main"
    }
  }
}
```

### Response (Multiple Guests Success)

```json
{
  "result": {
    "success": true,
    "message": "Guests deleted successfully",
    "data": {
      "guestsDeleted": 3,
      "guestIds": ["guest-id-1", "guest-id-2", "guest-id-3"],
      "guestNames": ["John Doe", "Jane Smith", "Bob Johnson"],
      "totalNormalGuestsRemoved": 6,
      "totalFreeGuestsRemoved": 3,
      "totalGuestsRemoved": 9,
      "totalCheckedInRemoved": 2,
      "deletedBy": "Admin User",
      "deletedAt": "2025-01-27T12:00:00.000Z",
      "guestListId": "main"
    }
  }
}
```

### Response (Error - Guest Not Found)

```json
{
  "result": {
    "success": false,
    "error": "No guests found to delete"
  }
}
```

### Response (Error - Guest List Not Found)

```json
{
  "result": {
    "success": false,
    "error": "Guest list not found"
  }
}
```

### Important Notes

> - **Required fields**: `eventId`, `companyId`, and either `guestId` OR `guestIds`
> - **Optional fields**: `guestListId` (default: "main")
> - **Guest List Selection**: 
>   - `guestListId`: "main" for default guest list, or UUID for additional guest lists
>   - If not provided, defaults to "main" (backward compatible)
> - **Deletion Options**:
>   - Single guest: Provide `guestId` (string)
>   - Multiple guests: Provide `guestIds` (array of strings)
> - **Summary Updates**: Automatically decrements all relevant summary statistics
> - **Logging**: Creates log entries for each deleted guest with deletion details
> - **Transaction Safety**: All operations are performed in a single transaction

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

## Testing the addUserToCompany Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/addUserToCompany`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (New User)

```json
{
  "data": {
    "companyId": "your-company-id",
    "email": "newuser@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "securePassword123",
    "role": "editors"
  }
}
```

### Request Body (Existing User)

```json
{
  "data": {
    "companyId": "your-company-id",
    "email": "existinguser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "promotors"
  }
}
```

### Validation Rules

- `companyId`, `email`, `firstName`, `lastName`, `role` are required
- `password` is required only for new users (not existing users)
- `role` must be one of: `admins`, `editors`, `promotors`, `tableStaff`, `staff`
- `firstName` and `lastName` must be 1-50 characters
- `password` must be 8-128 characters (if provided)
- `email` must be a valid email format

### Expected Response (New User)

```json
{
  "result": {
    "success": true,
    "message": "User created and added to company successfully",
    "data": {
      "userId": "57Z4Ji3HBNcvT1RjRucR5n6b3dZ2",
      "email": "newuser@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "editors",
      "companyId": "your-company-id",
      "isNewUser": true,
      "addedBy": "Amir Company Ehsani",
      "addedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### Expected Response (Existing User)

```json
{
  "result": {
    "success": true,
    "message": "User added to company successfully",
    "data": {
      "userId": "existing-user-id",
      "email": "existinguser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "promotors",
      "companyId": "your-company-id",
      "isNewUser": false,
      "addedBy": "Amir Company Ehsani",
      "addedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### What the Function Does

1. **User Detection**: Checks if user exists by email in the `users` collection
2. **Existing User Handling**: 
   - Adds `companyId` to user's `companyId` array
   - Enables `businessMode` for the user
   - Updates user's `updatedAt` timestamp
3. **New User Creation**:
   - Creates new Firebase Auth user with email and password
   - Creates user document in Firestore with company association
   - Sets `businessMode` to true and `emailVerified` to false
4. **Company Role Assignment**:
   - Adds user ID to the appropriate role array in company document
   - Supports roles: `admins`, `editors`, `promotors`, `tableStaff`, `staff`
   - Updates company's `updatedAt` timestamp
5. **Activity Logging**: Creates log entry in `companies/{companyId}/activityLogs`
6. **Duplicate Prevention**: Checks for existing memberships and role assignments

### Error Responses

**User already in company:**
```json
{
  "result": {
    "success": false,
    "error": "User is already a member of this company"
  }
}
```

**User already has role:**
```json
{
  "result": {
    "success": false,
    "error": "User is already assigned the role: editors"
  }
}
```

**Password required for new user:**
```json
{
  "result": {
    "success": false,
    "error": "Password is required for new users"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**Firebase Auth errors:**
```json
{
  "result": {
    "success": false,
    "error": "This email is already registered with Firebase Auth but not found in our database. Please contact support."
  }
}
```

### Role Descriptions

| Role | Description | Array Name |
|------|-------------|------------|
| `admins` | Full access to all features and statistics | `admins` |
| `editors` | Can add and edit events and manage guests and tables | `editors` |
| `promotors` | Can add and manage events and guests (restricted table access) | `promotors` |
| `tableStaff` | Can manage tables and check-in | `tableStaff` |
| `staff` | Basic access to view information and check in guests | `staff` |

### Database Changes

**User Document Updates:**
- Adds `companyId` to user's `companyId` array
- Sets `businessMode: true`
- Updates `updatedAt` timestamp

**Company Document Updates:**
- Adds user ID to appropriate role array (`admins`, `editors`, etc.)
- Updates `updatedAt` timestamp

**Activity Log Entry:**
```json
{
  "action": "user_added",
  "userId": "user-id",
  "userEmail": "user@example.com",
  "role": "editors",
  "addedBy": "Admin User",
  "timestamp": "2025-08-27T12:31:18.233Z",
  "isNewUser": true
}
```

## Testing the editUserInCompany Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/editUserInCompany`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "userId": "user-id-to-edit",
    "firstName": "John",
    "lastName": "Doe",
    "role": "editors"
  }
}
```

### Validation Rules

- `companyId`, `userId`, `firstName`, `lastName`, `role` are required
- `role` must be one of: `admins`, `editors`, `promotors`, `tableStaff`, `staff`
- `firstName` and `lastName` must be 1-50 characters
- User must be a member of the specified company

### Expected Response (Name and Role Changed)

```json
{
  "result": {
    "success": true,
    "message": "User updated successfully",
    "data": {
      "userId": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "editors",
      "companyId": "your-company-id",
      "previousRole": "staff",
      "nameChanged": true,
      "roleChanged": true,
      "editedBy": "Amir Company Ehsani",
      "editedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### Expected Response (Only Name Changed)

```json
{
  "result": {
    "success": true,
    "message": "User updated successfully",
    "data": {
      "userId": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "editors",
      "companyId": "your-company-id",
      "previousRole": "editors",
      "nameChanged": true,
      "roleChanged": false,
      "editedBy": "Amir Company Ehsani",
      "editedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### Expected Response (Only Role Changed)

```json
{
  "result": {
    "success": true,
    "message": "User updated successfully",
    "data": {
      "userId": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admins",
      "companyId": "your-company-id",
      "previousRole": "editors",
      "nameChanged": false,
      "roleChanged": true,
      "editedBy": "Amir Company Ehsani",
      "editedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### What the Function Does

1. **User Validation**: Checks if user exists and is a member of the specified company
2. **Change Detection**: Compares new values with existing values to detect actual changes
3. **Name Updates**: Updates `userFirstName` and `userLastName` in the user document if changed
4. **Role Management**: 
   - Removes user from current role array
   - Adds user to new role array
   - Updates company's `updatedAt` timestamp
5. **Activity Logging**: Creates detailed log entry with all changes and previous values
6. **Audit Trail**: Tracks who made the changes and when

### Error Responses

**User not found:**
```json
{
  "result": {
    "success": false,
    "error": "User not found"
  }
}
```

**User not in company:**
```json
{
  "result": {
    "success": false,
    "error": "User is not a member of this company"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**No changes detected:**
```json
{
  "result": {
    "success": false,
    "error": "No changes detected"
  }
}
```

### Role Descriptions

| Role | Description | Array Name |
|------|-------------|------------|
| `admins` | Full access to all features and statistics | `admins` |
| `editors` | Can add and edit events and manage guests and tables | `editors` |
| `promotors` | Can add and manage events and guests (restricted table access) | `promotors` |
| `tableStaff` | Can manage tables and check-in | `tableStaff` |
| `staff` | Basic access to view information and check in guests | `staff` |

### Database Changes

**User Document Updates (if name changed):**
- Updates `userFirstName` and `userLastName`
- Updates `updatedAt` timestamp

**Company Document Updates (if role changed):**
- Removes user ID from previous role array
- Adds user ID to new role array
- Updates `updatedAt` timestamp

**Activity Log Entry:**
```json
{
  "action": "user_edited",
  "userId": "user-id",
  "userEmail": "user@example.com",
  "previousRole": "staff",
  "newRole": "editors",
  "nameChanged": true,
  "roleChanged": true,
  "previousName": "Jane Smith",
  "newName": "John Doe",
  "editedBy": "Admin User",
  "timestamp": "2025-08-27T12:31:18.233Z"
}
```

## Testing the removeUserFromCompany Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/removeUserFromCompany`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "userId": "user-id-to-remove"
  }
}
```

### Validation Rules

- `companyId` and `userId` are required
- User must be a member of the specified company
- Cannot remove yourself if you're the only admin in the company

### Expected Response (User Removed Successfully)

```json
{
  "result": {
    "success": true,
    "message": "User removed from company successfully",
    "data": {
      "userId": "user-id",
      "email": "user@example.com",
      "companyId": "your-company-id",
      "previousRole": "editors",
      "businessModeRemains": true,
      "remainingCompanies": 2,
      "removedBy": "Amir Company Ehsani",
      "removedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### Expected Response (User Removed - No Companies Left)

```json
{
  "result": {
    "success": true,
    "message": "User removed from company successfully",
    "data": {
      "userId": "user-id",
      "email": "user@example.com",
      "companyId": "your-company-id",
      "previousRole": "staff",
      "businessModeRemains": false,
      "remainingCompanies": 0,
      "removedBy": "Amir Company Ehsani",
      "removedAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### What the Function Does

1. **User Validation**: Checks if user exists and is a member of the specified company
2. **Admin Protection**: Prevents removing yourself if you're the only admin in the company
3. **Complete Role Removal**: Removes user from all role arrays (`admins`, `editors`, `promotors`, `tableStaff`, `staff`)
4. **Company Association**: Removes `companyId` from user's `companyId` array
5. **Business Mode Management**: 
   - If user has other companies → `businessMode: true`
   - If user has no companies left → `businessMode: false`
6. **Activity Logging**: Creates detailed log entry with removal details
7. **Audit Trail**: Tracks who removed the user and when

### Error Responses

**User not found:**
```json
{
  "result": {
    "success": false,
    "error": "User not found"
  }
}
```

**User not in company:**
```json
{
  "result": {
    "success": false,
    "error": "User is not a member of this company"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**Cannot remove yourself as only admin:**
```json
{
  "result": {
    "success": false,
    "error": "Cannot remove yourself. You are the only admin in this company."
  }
}
```

### Business Mode Logic

The function automatically manages the user's `businessMode` based on their remaining company associations:

| Remaining Companies | Business Mode | Description |
|-------------------|---------------|-------------|
| 0 companies | `false` | User has no company associations |
| 1+ companies | `true` | User still belongs to other companies |

### Database Changes

**Company Document Updates:**
- Removes user ID from all role arrays (`admins`, `editors`, `promotors`, `tableStaff`, `staff`)
- Updates `updatedAt` timestamp

**User Document Updates:**
- Removes `companyId` from user's `companyId` array
- Updates `businessMode` based on remaining companies
- Updates `updatedAt` timestamp

**Activity Log Entry:**
```json
{
  "action": "user_removed",
  "userId": "user-id",
  "userEmail": "user@example.com",
  "previousRole": "editors",
  "removedBy": "Admin User",
  "timestamp": "2025-08-27T12:31:18.233Z",
  "businessModeRemains": true,
  "remainingCompanies": 2
}
```

### Security Features

- **Self-Removal Protection**: Cannot remove yourself if you're the only admin
- **Role-Based Access**: Only admins can remove users (enforced by client-side logic)
- **Complete Cleanup**: Removes user from all role arrays to prevent orphaned permissions
- **Audit Trail**: Comprehensive logging of all removal actions

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

## Testing the createEventTicket Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/createEventTicket`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (With Image URL)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "ticketData": {
      "totalTickets": 100,
      "ticketName": "VIP Ticket",
      "ticketPrice": 150.00,
      "ticketDescription": "Premium VIP experience with exclusive access",
      "ticketCategory": "VIP",
      "ticketImageUrl": "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/tickets%2Fevent123%2F1234567890_ticket.jpg?alt=media&token=abc123",
      "validFrom": "2025-08-01T00:00:00Z",
      "validTo": "2025-08-31T23:59:59Z",
      "maxTicketsPerUser": 5,
      "isActive": true
    }
  }
}
```

### Request Body (Without Image)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "ticketData": {
      "totalTickets": 50,
      "ticketName": "General Admission",
      "ticketPrice": 75.00,
      "ticketDescription": "Standard admission ticket",
      "ticketCategory": "General",
      "isActive": true
    }
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `ticketData` are required
- `ticketData.totalTickets` must be a positive integer (minimum 1)
- `ticketData.ticketName` and `ticketData.ticketPrice` are required
- `ticketData.ticketPrice` must be non-negative
- `ticketData.ticketImageUrl` is optional (any string format)
- `ticketData.validFrom` and `ticketData.validTo` must be valid ISO dates (if provided)
- `ticketData.maxTicketsPerUser` must be a positive integer (if provided)
- `ticketData.isActive` defaults to `true` if not provided

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Ticket created successfully",
    "data": {
      "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
      "eventId": "your-event-id",
      "companyId": "your-company-id",
      "ticketName": "VIP Ticket",
      "totalTickets": 100,
      "ticketPrice": 150.00,
      "isActive": true,
      "createdBy": "Amir Company Ehsani",
      "createdAt": "2025-08-27T12:31:18.233Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company and event exist
2. **UUID Generation**: Automatically generates a unique ticket ID (format: `97500513-26fc-4981-9a1d-587f2a30c021`)
3. **Ticket Summary Management**: 
   - Creates `ticketSummary` document if it doesn't exist
   - Updates existing summary with new ticket counts
4. **Ticket Creation**: Creates ticket document with tracking fields
5. **Activity Logging**: Creates log entry with ticket creation details
6. **Audit Trail**: Tracks who created the ticket and when

### Error Responses

**Event not found:**
```json
{
  "result": {
    "success": false,
    "error": "Event not found"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**Validation error:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"ticketData.totalTickets\" must be a positive number"
  }
}
```

### Database Structure

**Ticket Document:**
```json
{
  "id": "97500513-26fc-4981-9a1d-587f2a30c021",
  "totalTickets": 100,
  "ticketName": "VIP Ticket",
  "ticketPrice": 150.00,
  "ticketDescription": "Premium VIP experience",
  "ticketCategory": "VIP",
  "ticketImageUrl": "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/tickets%2Fevent123%2F1234567890_ticket.jpg?alt=media&token=abc123",
  "validFrom": "2025-08-01T00:00:00Z",
  "validTo": "2025-08-31T23:59:59Z",
  "maxTicketsPerUser": 5,
  "isActive": true,
  "soldTickets": 0,
  "revenue": 0,
  "createdAt": "2025-08-27T12:31:18.233Z",
  "updatedAt": "2025-08-27T12:31:18.233Z"
}
```

**Ticket Summary Document:**
```json
{
  "totalNrTickets": 100,
  "totalNrSoldTickets": 0,
  "totalNrTicketsLeft": 100,
  "totalTicketsRevenue": 0,
  "createdAt": "2025-08-27T12:31:18.233Z",
  "updatedAt": "2025-08-27T12:31:18.233Z"
}
```

**Activity Log Entry:**
```json
{
  "action": "ticket_created",
  "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
  "ticketName": "VIP Ticket",
  "totalTickets": 100,
  "ticketPrice": 150.00,
  "createdBy": "Admin User",
  "timestamp": "2025-08-27T12:31:18.233Z"
}
```

### Image Upload Handling

The API accepts `ticketImageUrl` as an optional string. For image uploads, use **Option 1: Client-Side Upload**:

1. **Upload to Firebase Storage** in your app
2. **Get download URL** from Firebase Storage
3. **Pass URL** to the API

**Example Implementation:**
```typescript
// Upload image to Firebase Storage
const uploadImage = async (file: File) => {
  const storageRef = ref(storage, `tickets/${eventId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// Call API with image URL
const ticketData = {
  ...otherData,
  ticketImageUrl: await uploadImage(imageFile)
};
```

### Key Features

✅ **Auto-Generated UUID** - No need to provide ticket ID  
✅ **Smart Summary Management** - Automatically creates/updates ticket summary  
✅ **Flexible Image Handling** - Accepts any string format for image URLs  
✅ **Revenue Tracking** - Initializes tracking fields for future sales  
✅ **Activity Logging** - Comprehensive audit trail  
✅ **Validation** - Ensures data integrity and proper formats

## Testing the updateEventTicket Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateEventTicket`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (Partial Update)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
    "ticketData": {
      "ticketName": "Updated VIP Ticket",
      "ticketPrice": 200.00,
      "ticketDescription": "Updated premium VIP experience",
      "totalTickets": 150
    }
  }
}
```

### Request Body (Full Update)

```json
{
  "data": {
    "companyId": "your-company-id",
    "eventId": "your-event-id",
    "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
    "ticketData": {
      "ticketName": "Premium VIP Ticket",
      "ticketPrice": 250.00,
      "ticketDescription": "Ultimate VIP experience with exclusive benefits",
      "ticketImage": "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/tickets%2Fpremium-vip.jpg?alt=media&token=xyz789",
      "totalTickets": 200,
      "saleStartDate": "2025-09-01T00:00:00Z",
      "saleEndDate": "2025-09-30T23:59:59Z",
      "freeTicket": false,
      "buyerPaysAdminFee": true
    }
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `ticketId` are required
- `ticketData` is required and must contain at least one field to update
- `totalTickets` must be a positive integer (if provided)
- `ticketPrice` must be non-negative (if provided)
- `saleStartDate` and `saleEndDate` must be valid ISO dates (if provided)
- `freeTicket` and `buyerPaysAdminFee` must be boolean (if provided)

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Event ticket updated successfully",
    "data": {
      "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
      "eventId": "your-event-id",
      "companyId": "your-company-id",
      "changes": {
        "ticketName": "Premium VIP Ticket",
        "ticketPrice": 250.00,
        "totalTickets": 200
      },
      "summaryUpdated": true,
      "updatedBy": "Amir Company Ehsani",
      "updatedAt": "2025-08-27T15:30:00.000Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company, event, and ticket exist
2. **Change Detection**: Compares new values with existing values
3. **Partial Updates**: Updates only the provided fields
4. **Summary Management**: Automatically adjusts `ticketSummary` if `totalTickets` changes
5. **Date Conversion**: Converts ISO date strings to Firestore timestamps
6. **Activity Logging**: Creates detailed audit trail of all changes

### Key Features

✅ **Partial Updates** - Only update fields you specify  
✅ **Smart Summary Management** - Automatically adjusts ticket summary  
✅ **Date Handling** - Converts strings to proper Firestore timestamps  
✅ **Change Tracking** - Detailed audit trail of all modifications  
✅ **Validation** - Ensures data integrity and proper formats  

## Testing the removeEventTicket Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/removeEventTicket`
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
    "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021"
  }
}
```

### Validation Rules

- `companyId`, `eventId`, `ticketId` are required
- Ticket must exist in the specified event
- **Cannot delete if tickets have been sold** (`ticketsLeft < totalTickets`)

### Expected Response (Success)

```json
{
  "result": {
    "success": true,
    "message": "Event ticket removed successfully",
    "data": {
      "ticketId": "97500513-26fc-4981-9a1d-587f2a30c021",
      "ticketName": "VIP Ticket",
      "eventId": "your-event-id",
      "companyId": "your-company-id",
      "removedBy": "Amir Company Ehsani",
      "removedAt": "2025-08-27T16:00:00.000Z",
      "summaryUpdated": true
    }
  }
}
```

### Error Response (Tickets Sold)

```json
{
  "result": {
    "success": false,
    "error": "Cannot remove ticket. 25 tickets have been sold. Only unsold tickets can be removed."
  }
}
```

### What the Function Does

1. **Validation**: Checks if company, event, and ticket exist
2. **Safety Check**: Verifies no tickets have been sold
3. **Deletion**: Removes ticket document from Firestore
4. **Summary Update**: Adjusts `ticketSummary` to reflect removal
5. **Activity Logging**: Creates deletion audit trail

### Key Features

✅ **Safety Validation** - Prevents deletion of tickets with sales  
✅ **Summary Management** - Automatically updates ticket summary  
✅ **Complete Removal** - Deletes ticket and adjusts totals  
✅ **Audit Trail** - Logs all deletion actions  
✅ **Data Protection** - Safeguards against accidental data loss  

## Event Ticket Workflow Examples

### Scenario 1: Create and Update

1. **Create ticket** with `createEventTicket`
2. **Update details** with `updateEventTicket`
3. **Modify pricing** or description as needed
4. **Adjust ticket count** if demand changes

### Scenario 2: Scale Down Safely

1. **Check current sales** before reducing `totalTickets`
2. **Update ticket count** only if safe
3. **Monitor summary** for accurate totals

### Scenario 3: Remove Unused Ticket

1. **Verify no sales** have occurred
2. **Remove ticket** safely with `removeEventTicket`
3. **Summary updated** automatically

### Best Practices

✅ **Start Conservative** - Begin with fewer tickets, scale up as needed  
✅ **Monitor Sales** - Check ticket status before major changes  
✅ **Regular Updates** - Keep ticket information current  
✅ **Safe Removal** - Always verify tickets can be safely deleted  
✅ **Summary Tracking** - Use ticket summary for accurate counts

## Testing the createClubCard Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/createClubCard`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "title": "VIP GB",
    "description": "Unlock exclusive access to all events with your VIP card! Skip the regular lines and enjoy VIP entry with free entry.",
    "imageUrl": "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/cards%2Fvip-card.png?alt=media&token=abc123",
    "validFrom": "2025-07-18T00:00:00Z",
    "validTo": "2026-07-18T00:00:00Z",
    "freeEntry": {
      "hours": 2,
      "minutes": 30
    },
    "events": ["event-id-1", "event-id-2"],
    "numberOfCards": 5
  }
}
```

### Validation Rules

- `companyId`, `title` are required
- `title` must be 1-100 characters
- `description` must be max 1000 characters (optional)
- `imageUrl` is optional (any string format)
- `validFrom` and `validTo` must be valid ISO dates (optional)
- `freeEntry.hours` must be 0-23 (optional)
- `freeEntry.minutes` must be 0-59 (optional)
- `events` is optional array of event IDs
- `numberOfCards` must be 1-1000 (defaults to 1)

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Club card created successfully",
    "data": {
      "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
      "title": "VIP GB",
      "numberOfCards": 5,
      "itemsGenerated": 5,
      "createdBy": "Amir Company Ehsani",
      "createdAt": "2025-07-18T14:39:26.000Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company exists
2. **UUID Generation**: Creates unique card ID (format: `1092ecce-5c4a-4d96-87e2-8c0adaad74e6`)
3. **QR Code Generation**: For each card item:
   - Generates unique UUID
   - Creates QR code image
   - Uploads to Firebase Storage
   - Makes file publicly accessible
4. **Database Creation**: Saves card with items array containing all generated cards
5. **Activity Logging**: Creates log entry with creation details

### Database Structure

**Club Card Document:**
```json
{
  "title": "VIP GB",
  "description": "Unlock exclusive access to all events with your VIP card!",
  "imageUrl": "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/cards%2Fvip-card.png?alt=media&token=abc123",
  "validFrom": "2025-07-18T00:00:00Z",
  "validTo": "2026-07-18T00:00:00Z",
  "freeEntry": {
    "hours": 2,
    "minutes": 30
  },
  "events": ["event-id-1", "event-id-2"],
  "items": [
    {
      "active": false,
      "guest": "",
      "nrUsed": 0,
      "qrCode": "https://storage.googleapis.com/your-bucket/companies/companyId/cards/cardId/qrcodes/uniqueId.png",
      "status": "unused",
      "uniqueId": "1604ec22-df04-49ac-951e-fe84d550f0a8"
    }
  ],
  "createdAt": "2025-07-18T14:39:26.000Z",
  "createdBy": "user-id"
}
```

### Key Features

✅ **Auto-Generated UUIDs** - Both card ID and individual card unique IDs  
✅ **Server-Side QR Generation** - Creates PNG QR codes automatically  
✅ **Firebase Storage Integration** - Uploads and makes QR codes public  
✅ **Flexible Card Count** - Generate 1-1000 cards per request  
✅ **Immediate Availability** - QR codes ready to scan right away  

## Testing the updateClubCard Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateClubCard`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (Update Basic Info)

```json
{
  "data": {
    "companyId": "your-company-id",
    "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
    "title": "Updated VIP GB",
    "description": "Updated description for VIP card"
  }
}
```

### Request Body (Generate More Cards)

```json
{
  "data": {
    "companyId": "your-company-id",
    "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
    "generateCards": 10
  }
}
```

### Request Body (Update Multiple Fields)

```json
{
  "data": {
    "companyId": "your-company-id",
    "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
    "title": "Premium VIP GB",
    "description": "Premium VIP experience with exclusive benefits",
    "validFrom": "2025-08-01T00:00:00Z",
    "validTo": "2026-08-01T00:00:00Z",
    "freeEntry": {
      "hours": 3,
      "minutes": 0
    },
    "events": ["event-id-3", "event-id-4"],
    "generateCards": 15
  }
}
```

### Validation Rules

- `companyId`, `cardId` are required
- All other fields are optional - only send what you want to update
- `generateCards` is request-only (not stored in database)
- Date fields must be valid ISO format if provided

### Expected Response (Basic Update)

```json
{
  "result": {
    "success": true,
    "message": "Club card updated successfully",
    "data": {
      "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
      "changes": {
        "title": "Updated VIP GB",
        "description": "Updated description for VIP card"
      },
      "updatedBy": "Amir Company Ehsani",
      "updatedAt": "2025-07-18T15:30:00.000Z"
    }
  }
}
```

### Expected Response (With Card Generation)

```json
{
  "result": {
    "success": true,
    "message": "Club card updated successfully",
    "data": {
      "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
      "changes": {
        "title": "Premium VIP GB",
        "generateCards": 15
      },
      "cardsGenerated": 10,
      "totalCards": 15,
      "updatedBy": "Amir Company Ehsani",
      "updatedAt": "2025-07-18T15:30:00.000Z"
    }
  }
}
```

### What the Function Does

1. **Change Detection**: Compares new values with existing values
2. **Field Updates**: Updates only provided fields
3. **Card Generation**: If `generateCards` specified and greater than current count:
   - Generates additional QR codes
   - Uploads to Firebase Storage
   - Adds to existing items array
4. **Logging**: Creates detailed audit trail of all changes
5. **Database Update**: Saves changes with timestamp

### Key Features

✅ **Partial Updates** - Only update fields you specify  
✅ **Automatic Card Scaling** - Generate more cards when needed  
✅ **QR Code Generation** - Creates additional codes seamlessly  
✅ **Change Tracking** - Detailed audit trail of all modifications  
✅ **Smart Detection** - Knows exactly how many new cards needed  

## Testing the deleteClubCard Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/deleteClubCard`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6"
  }
}
```

### Validation Rules

- `companyId`, `cardId` are required
- Card must exist in the specified company
- Card cannot be deleted if currently used in any events

### Expected Response (Success)

```json
{
  "result": {
    "success": true,
    "message": "Club card deleted successfully",
    "data": {
      "cardId": "1092ecce-5c4a-4d96-87e2-8c0adaad74e6",
      "title": "VIP GB",
      "deletedBy": "Amir Company Ehsani",
      "deletedAt": "2025-07-18T16:00:00.000Z",
      "itemsDeleted": 5
    }
  }
}
```

### Error Response (Card in Use)

```json
{
  "result": {
    "success": false,
    "error": "Cannot delete club card. It is currently used in 2 events."
  }
}
```

### What the Function Does

1. **Validation**: Checks if card exists and company is valid
2. **Usage Check**: Verifies card is not used in any events
3. **Deletion**: Removes card document and all associated data
4. **Storage Cleanup**: Removes QR code images from Firebase Storage
5. **Logging**: Creates deletion audit trail

### Key Features

✅ **Safety Validation** - Prevents deletion of cards in use  
✅ **Complete Cleanup** - Removes all associated data and files  
✅ **Storage Management** - Cleans up Firebase Storage files  
✅ **Audit Trail** - Logs all deletion actions  
✅ **Event Protection** - Safeguards against data loss  

## Club Card Workflow Examples

### Scenario 1: Create and Scale Up

1. **Create initial card** with 5 cards
2. **Update card** with `generateCards: 20` to add 15 more
3. **Final result**: 20 total cards with unique QR codes

### Scenario 2: Update Card Details

1. **Update title** and description
2. **Change validity dates**
3. **Modify free entry times**
4. **Add/remove events**

### Scenario 3: Delete Unused Card

1. **Check if card is used** in any events
2. **Delete card** if safe to remove
3. **Clean up** all associated data and files

### Best Practices

✅ **Start Small** - Create with fewer cards, scale up as needed  
✅ **Regular Updates** - Keep card information current  
✅ **Monitor Usage** - Track which cards are active  
✅ **Safe Deletion** - Always verify cards aren't in use  
✅ **Backup Strategy** - Consider archiving before deletion

## Testing the createTableLayout Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/createTableLayout`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (Basic Layout)

```json
{
  "data": {
    "companyId": "your-company-id",
    "name": "Main Area",
    "canvasHeight": 2000,
    "canvasWidth": 2000,
    "items": [
      {
        "tableName": "101",
        "type": "ItemType.table",
        "shape": "ItemShape.square",
        "width": 403.33,
        "height": 301.67,
        "positionX": 0,
        "positionY": 0
      },
      {
        "tableName": "102",
        "type": "ItemType.table",
        "shape": "ItemShape.circle",
        "width": 378.33,
        "height": 378.33,
        "positionX": 1621.67,
        "positionY": 0
      }
    ]
  }
}
```

### Request Body (Layout with Rotation)

```json
{
  "data": {
    "companyId": "your-company-id",
    "name": "VIP Section",
    "canvasHeight": 2000,
    "canvasWidth": 2000,
    "items": [
      {
        "tableName": "201",
        "type": "ItemType.table",
        "shape": "ItemShape.square",
        "width": 403.33,
        "height": 301.67,
        "positionX": 0,
        "positionY": 0,
        "rotation": 45
      },
      {
        "tableName": "202",
        "type": "ItemType.table",
        "shape": "ItemShape.rectangle",
        "width": 441.67,
        "height": 325,
        "positionX": 0,
        "positionY": 1675,
        "rotation": 90
      },
      {
        "objectName": "Bar",
        "type": "ItemType.object",
        "shape": "ItemShape.square",
        "width": 531.67,
        "height": 326.67,
        "positionX": 771.67,
        "positionY": 0
      }
    ]
  }
}
```

### Request Body (Complex Layout with Mixed Items)

```json
{
  "data": {
    "companyId": "your-company-id",
    "name": "Complete Venue Layout",
    "canvasHeight": 2000,
    "canvasWidth": 2000,
    "items": [
      {
        "tableName": "101",
        "type": "ItemType.table",
        "shape": "ItemShape.square",
        "width": 403.33,
        "height": 301.67,
        "positionX": 0,
        "positionY": 0,
        "rotation": 0
      },
      {
        "tableName": "102",
        "type": "ItemType.table",
        "shape": "ItemShape.circle",
        "width": 378.33,
        "height": 378.33,
        "positionX": 1621.67,
        "positionY": 0,
        "rotation": 15
      },
      {
        "tableName": "201",
        "type": "ItemType.table",
        "shape": "ItemShape.rectangle",
        "width": 441.67,
        "height": 325,
        "positionX": 0,
        "positionY": 1675,
        "rotation": 30
      },
      {
        "tableName": "202",
        "type": "ItemType.table",
        "shape": "ItemShape.oval",
        "width": 396.67,
        "height": 396.67,
        "positionX": 1603.33,
        "positionY": 1596.67,
        "rotation": 60
      },
      {
        "objectName": "Bar",
        "type": "ItemType.object",
        "shape": "ItemShape.square",
        "width": 531.67,
        "height": 326.67,
        "positionX": 771.67,
        "positionY": 0
      },
      {
        "objectName": "Dance Floor",
        "type": "ItemType.object",
        "shape": "ItemShape.circle",
        "width": 873.33,
        "height": 873.33,
        "positionX": 605,
        "positionY": 611.67
      }
    ]
  }
}
```

### Validation Rules

- `companyId`, `name`, `canvasHeight`, `canvasWidth`, `items` are required
- `name` must be 1-100 characters
- `canvasHeight` and `canvasWidth` must be 100-10000
- `items` must be an array with 1-1000 items
- Each item must have:
  - `type`: "ItemType.table" or "ItemType.object"
  - `shape`: "ItemShape.square", "ItemShape.circle", "ItemShape.rectangle", or "ItemShape.oval"
  - `width`, `height`, `positionX`, `positionY`: numbers within valid ranges
  - `tableName`: required if `type` is "ItemType.table"
  - `objectName`: required if `type` is "ItemType.object"
  - `rotation`: optional, 0-360 degrees

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Table layout created successfully",
    "data": {
      "layoutId": "auto-generated-layout-id",
      "name": "Main Area",
      "canvasHeight": 2000,
      "canvasWidth": 2000,
      "itemsCount": 2,
      "tablesCount": 2,
      "objectsCount": 0,
      "createdBy": "Amir Company Ehsani",
      "createdAt": "2025-09-03T07:07:54.000Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company exists and validates all input data
2. **Auto-Generated ID**: Creates unique document ID for the layout
3. **Item Validation**: Ensures proper field requirements for tables vs objects
4. **Database Creation**: Saves layout in `companies/{companyId}/layouts/{layoutId}`
5. **Activity Logging**: Creates log entry with creation details
6. **Statistics**: Counts tables, objects, and total items

### Database Structure

**Layout Document:**
```json
{
  "name": "Main Area",
  "canvasHeight": 2000,
  "canvasWidth": 2000,
  "createdAt": "2025-09-03T07:07:54.000Z",
  "createdBy": "user-id",
  "items": [
    {
      "tableName": "101",
      "type": "ItemType.table",
      "shape": "ItemShape.square",
      "width": 403.33,
      "height": 301.67,
      "positionX": 0,
      "positionY": 0,
      "rotation": 45
    }
  ]
}
```

### Key Features

✅ **Auto-Generated Layout ID** - No need to provide layout ID  
✅ **Rotation Support** - Tables can be rotated 0-360 degrees  
✅ **Mixed Item Types** - Supports both tables and objects  
✅ **Flexible Shapes** - Square, circle, rectangle, oval support  
✅ **Canvas Sizing** - Customizable canvas dimensions  
✅ **Smart Validation** - Ensures proper field requirements  
✅ **Activity Logging** - Comprehensive audit trail  

### Error Responses

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**Validation error:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"items[0].tableName\" is required"
  }
}
```

**Invalid rotation:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"items[0].rotation\" must be a number between 0 and 360"
  }
}
```

### Table Layout Workflow Examples

### Scenario 1: Create Basic Layout

1. **Design layout** with tables and objects
2. **Set canvas dimensions** (typically 2000x2000)
3. **Create layout** with `createTableLayout`
4. **Use layout ID** in event creation

### Scenario 2: Create Rotated Tables

1. **Add rotation angles** to table items (0-360 degrees)
2. **Mix rotated and non-rotated** tables
3. **Include objects** without rotation
4. **Save complete layout** with all positioning

### Scenario 3: Complex Venue Layout

1. **Plan multiple areas** (VIP, general, bar, dance floor)
2. **Use different shapes** for variety
3. **Position items precisely** with coordinates
4. **Add rotation** for dynamic layouts

### Best Practices

✅ **Start Simple** - Begin with basic layouts, add complexity gradually  
✅ **Use Rotation Wisely** - Rotate tables for better space utilization  
✅ **Mix Item Types** - Combine tables and objects for complete layouts  
✅ **Plan Canvas Size** - Use consistent canvas dimensions (2000x2000)  
✅ **Validate Coordinates** - Ensure items fit within canvas bounds  
✅ **Name Items Clearly** - Use descriptive table and object names  
✅ **Test Layouts** - Verify layouts work in your application

## Testing the updateTableLayout Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/updateTableLayout`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body (Update Name Only)

```json
{
  "data": {
    "companyId": "your-company-id",
    "layoutId": "existing-layout-id",
    "name": "Updated Main Area"
  }
}
```

### Request Body (Update Canvas Dimensions)

```json
{
  "data": {
    "companyId": "your-company-id",
    "layoutId": "existing-layout-id",
    "canvasHeight": 2500,
    "canvasWidth": 2500
  }
}
```

### Request Body (Update Items with Rotation)

```json
{
  "data": {
    "companyId": "your-company-id",
    "layoutId": "existing-layout-id",
    "items": [
      {
        "tableName": "101",
        "type": "ItemType.table",
        "shape": "ItemShape.square",
        "width": 403.33,
        "height": 301.67,
        "positionX": 0,
        "positionY": 0,
        "rotation": 45
      },
      {
        "tableName": "102",
        "type": "ItemType.table",
        "shape": "ItemShape.circle",
        "width": 378.33,
        "height": 378.33,
        "positionX": 1621.67,
        "positionY": 0,
        "rotation": 90
      },
      {
        "objectName": "Bar",
        "type": "ItemType.object",
        "shape": "ItemShape.square",
        "width": 531.67,
        "height": 326.67,
        "positionX": 771.67,
        "positionY": 0
      }
    ]
  }
}
```

### Request Body (Update Multiple Fields)

```json
{
  "data": {
    "companyId": "your-company-id",
    "layoutId": "existing-layout-id",
    "name": "VIP Section Updated",
    "canvasHeight": 2000,
    "canvasWidth": 2000,
    "items": [
      {
        "tableName": "201",
        "type": "ItemType.table",
        "shape": "ItemShape.rectangle",
        "width": 441.67,
        "height": 325,
        "positionX": 0,
        "positionY": 1675,
        "rotation": 30
      },
      {
        "tableName": "202",
        "type": "ItemType.table",
        "shape": "ItemShape.oval",
        "width": 396.67,
        "height": 396.67,
        "positionX": 1603.33,
        "positionY": 1596.67,
        "rotation": 60
      },
      {
        "objectName": "Dance Floor",
        "type": "ItemType.object",
        "shape": "ItemShape.circle",
        "width": 873.33,
        "height": 873.33,
        "positionX": 605,
        "positionY": 611.67
      }
    ]
  }
}
```

### Validation Rules

- `companyId`, `layoutId` are required
- All other fields are optional - only send what you want to update
- `name` must be 1-100 characters (if provided)
- `canvasHeight` and `canvasWidth` must be 100-10000 (if provided)
- `items` must be an array with 1-1000 items (if provided)
- Each item must have:
  - `type`: "ItemType.table" or "ItemType.object"
  - `shape`: "ItemShape.square", "ItemShape.circle", "ItemShape.rectangle", or "ItemShape.oval"
  - `width`, `height`, `positionX`, `positionY`: numbers within valid ranges
  - `tableName`: required if `type` is "ItemType.table"
  - `objectName`: required if `type` is "ItemType.object"
  - `rotation`: optional, 0-360 degrees

### Expected Response

```json
{
  "result": {
    "success": true,
    "message": "Table layout updated successfully",
    "data": {
      "layoutId": "existing-layout-id",
      "name": "VIP Section Updated",
      "canvasHeight": 2000,
      "canvasWidth": 2000,
      "itemsCount": 3,
      "tablesCount": 2,
      "objectsCount": 1,
      "changes": ["name", "canvasHeight", "canvasWidth", "items"],
      "updatedBy": "Amir Company Ehsani",
      "updatedAt": "2025-09-03T10:30:00.000Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company and layout exist
2. **Change Detection**: Only updates fields that are provided
3. **Item Validation**: Validates items if provided (tableName for tables, objectName for objects)
4. **Partial Updates**: Updates only the specified fields
5. **Activity Logging**: Creates detailed log entry with changes
6. **Statistics**: Calculates and returns updated counts

### Key Features

✅ **Partial Updates** - Only update fields you specify  
✅ **Smart Validation** - Ensures proper field requirements  
✅ **Rotation Support** - Full 0-360 degree rotation  
✅ **Change Detection** - Prevents unnecessary updates  
✅ **Comprehensive Logging** - Detailed audit trail  
✅ **Error Handling** - Robust validation and error messages  
✅ **Statistics** - Returns updated counts and changes  

### Error Responses

**Layout not found:**
```json
{
  "result": {
    "success": false,
    "error": "Layout not found"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**No changes detected:**
```json
{
  "result": {
    "success": false,
    "error": "No changes detected"
  }
}
```

**Validation error:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"items[0].tableName\" is required for ItemType.table"
  }
}
```

### Table Layout Update Workflow Examples

### Scenario 1: Rename Layout

1. **Update layout name** only
2. **Keep all other fields** unchanged
3. **Minimal update** with just name change

### Scenario 2: Resize Canvas

1. **Update canvas dimensions** for larger/smaller layouts
2. **Adjust items** if needed to fit new canvas
3. **Maintain layout proportions**

### Scenario 3: Add Rotation to Tables

1. **Update items array** with rotation values
2. **Mix rotated and non-rotated** tables
3. **Add new items** with rotation

### Scenario 4: Complete Layout Redesign

1. **Update multiple fields** at once
2. **Replace entire items array** with new layout
3. **Change name and dimensions** together

### Best Practices

✅ **Update Incrementally** - Make small changes and test  
✅ **Validate Changes** - Check that updates work as expected  
✅ **Use Rotation Wisely** - Rotate tables for better space utilization  
✅ **Backup Important Layouts** - Keep copies of working layouts  
✅ **Test After Updates** - Verify layouts work in your application  
✅ **Monitor Activity Logs** - Track all layout changes  
✅ **Plan Updates** - Consider impact on existing events using the layout

## Testing the deleteTableLayout Function

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/deleteTableLayout`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "data": {
    "companyId": "your-company-id",
    "layoutId": "existing-layout-id"
  }
}
```

### Validation Rules

- `companyId` and `layoutId` are required
- Layout must exist in the specified company
- Layout cannot be deleted if it's currently used in any events

### Expected Response (Success)

```json
{
  "result": {
    "success": true,
    "message": "Table layout deleted successfully",
    "data": {
      "layoutId": "existing-layout-id",
      "layoutName": "Main Area",
      "itemsCount": 5,
      "tablesCount": 3,
      "objectsCount": 2,
      "deletedBy": "Amir Company Ehsani",
      "deletedAt": "2025-09-03T11:00:00.000Z"
    }
  }
}
```

### What the Function Does

1. **Validation**: Checks if company and layout exist
2. **Usage Check**: Queries all events to see if layout is currently in use
3. **Safety Prevention**: Prevents deletion if layout is used in any events
4. **Deletion**: Removes layout document from Firestore
5. **Activity Logging**: Creates detailed log entry with layout statistics
6. **Statistics**: Returns counts of deleted items

### Key Features

✅ **Safety Validation** - Prevents deletion of layouts in use  
✅ **Event Usage Check** - Queries all events for layout usage  
✅ **Detailed Error Messages** - Shows which events are using the layout  
✅ **Complete Deletion** - Removes layout and logs action  
✅ **Audit Trail** - Comprehensive logging with layout details  
✅ **Statistics** - Returns counts of deleted items  
✅ **User Context** - Tracks who deleted the layout  

### Error Responses

**Layout not found:**
```json
{
  "result": {
    "success": false,
    "error": "Layout not found"
  }
}
```

**Company not found:**
```json
{
  "result": {
    "success": false,
    "error": "Company not found"
  }
}
```

**Layout in use (single event):**
```json
{
  "result": {
    "success": false,
    "error": "Cannot delete layout. It is currently used in 1 event(s): VIP Night"
  }
}
```

**Layout in use (multiple events):**
```json
{
  "result": {
    "success": false,
    "error": "Cannot delete layout. It is currently used in 3 event(s): VIP Night, Summer Party, New Year Event"
  }
}
```

**Validation error:**
```json
{
  "result": {
    "success": false,
    "error": "Validation error: \"layoutId\" is required"
  }
}
```

### Table Layout Deletion Workflow Examples

### Scenario 1: Delete Unused Layout

1. **Check layout usage** - Verify layout is not used in any events
2. **Delete layout** safely with `deleteTableLayout`
3. **Confirm deletion** - Layout removed and logged

### Scenario 2: Attempt to Delete Used Layout

1. **Try to delete layout** that's used in events
2. **Receive error message** with event names
3. **Remove from events first** - Update events to not use the layout
4. **Then delete layout** safely

### Scenario 3: Clean Up Old Layouts

1. **Identify unused layouts** - Check which layouts are not in use
2. **Delete multiple layouts** one by one
3. **Monitor activity logs** for deletion tracking

### Best Practices

✅ **Check Usage First** - Verify layout is not used in events before deletion  
✅ **Update Events First** - Remove layout from events before deleting  
✅ **Backup Important Layouts** - Keep copies of layouts you might need later  
✅ **Monitor Activity Logs** - Track all layout deletions  
✅ **Test After Deletion** - Verify no broken references remain  
✅ **Plan Deletions** - Consider impact on existing events  
✅ **Use Descriptive Names** - Name layouts clearly to avoid confusion  

### Safety Features

The `deleteTableLayout` function includes several safety features to prevent accidental data loss:

- **Event Usage Validation**: Automatically checks if the layout is used in any events
- **Detailed Error Messages**: Shows exactly which events are using the layout
- **Complete Audit Trail**: Logs all deletion actions with full context
- **User Tracking**: Records who performed the deletion
- **Statistics**: Returns counts of what was deleted

### Database Impact

When a layout is successfully deleted:

- **Layout Document**: Removed from `companies/{companyId}/layouts/{layoutId}`
- **Activity Log**: Entry created in `companies/{companyId}/activityLogs`
- **No Event Impact**: Events are not automatically updated (must be done manually)

### Error Prevention

The function prevents deletion in these scenarios:

- Layout is used in one or more events
- Layout doesn't exist
- Company doesn't exist
- Invalid request data

This ensures data integrity and prevents broken references in your application.

## Testing the Chat API Functions

The Chat API provides comprehensive messaging and table booking functionality with the following endpoints:

### Available Chat Endpoints

1. **Get User Conversations** - Get all conversations for a specific user
2. **Get Company Conversations** - Get all conversations for a specific company
3. **Get Messages** - Get all messages for a conversation
4. **Send Message** - Send a message in a conversation
5. **Mark Conversation as Read** - Mark all messages in a conversation as read
6. **Create Table Booking** - Create a table booking request with conversation
7. **Update Booking Status** - Update table booking status (company staff only)
8. **Get User Bookings** - Get all bookings for a specific user
9. **Get Company Bookings** - Get all bookings for a specific company

### Base URL

All chat endpoints use the following base URL:
- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat`

## Testing Get User Conversations

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/conversations/user/{userId}`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `userId`: The user ID to get conversations for

### Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": "user-id_company-id",
      "userId": "user-id",
      "companyId": "company-id",
      "userFirstName": "John",
      "userLastName": "Doe",
      "companyName": "Restaurant XYZ",
      "lastMessage": "Your table booking has been confirmed! 🎉",
      "lastUpdated": "2025-01-20T15:30:00.000Z",
      "unreadCountUser": 0,
      "unreadCountCompany": 1,
      "isActive": true,
      "createdAt": "2025-01-20T14:00:00.000Z"
    }
  ]
}
```

### Error Response (Permission Denied)

```json
{
  "success": false,
  "error": "Permission denied"
}
```

### What the Endpoint Does

1. **Permission Check**: Verifies the requesting user can access the conversations (must be the user or admin)
2. **Query Conversations**: Gets all active conversations for the user
3. **Ordering**: Returns conversations ordered by last updated (newest first)
4. **Active Filter**: Only returns conversations where `isActive` is true

## Testing Get Company Conversations

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/conversations/company/{companyId}`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `companyId`: The company ID to get conversations for

### Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": "user-id_company-id",
      "userId": "user-id",
      "companyId": "company-id",
      "userFirstName": "John",
      "userLastName": "Doe",
      "companyName": "Restaurant XYZ",
      "lastMessage": "Table booking request submitted for 1/20/2025 at 8:00:00 PM for 4 people.",
      "lastUpdated": "2025-01-20T15:30:00.000Z",
      "unreadCountUser": 1,
      "unreadCountCompany": 0,
      "isActive": true,
      "createdAt": "2025-01-20T14:00:00.000Z"
    }
  ]
}
```

### Error Response (Company Not Found)

```json
{
  "success": false,
  "error": "Company not found"
}
```

### What the Endpoint Does

1. **Company Validation**: Checks if the company exists
2. **Permission Check**: Verifies the user has access to the company (staff member or admin)
3. **Query Conversations**: Gets all active conversations for the company
4. **Role-Based Access**: Supports admins, editors, promotors, tableStaff, and staff roles

## Testing Get Messages

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/messages/{conversationId}`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `conversationId`: The conversation ID to get messages for

### Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": "message-id-1",
      "conversationId": "user-id_company-id",
      "senderId": "user-id",
      "senderType": "user",
      "message": "Hi, I'd like to book a table for tonight at 8 PM for 4 people.",
      "messageType": "text",
      "timestamp": "2025-01-20T14:00:00.000Z",
      "readStatus": true,
      "metadata": null
    },
    {
      "id": "message-id-2",
      "conversationId": "user-id_company-id",
      "senderId": "company-staff-id",
      "senderType": "company",
      "message": "Your table booking has been confirmed! 🎉",
      "messageType": "booking",
      "timestamp": "2025-01-20T15:30:00.000Z",
      "readStatus": false,
      "metadata": {
        "bookingId": "booking-id",
        "status": "confirmed"
      }
    }
  ]
}
```

### Error Response (Conversation Not Found)

```json
{
  "success": false,
  "error": "Conversation not found"
}
```

### What the Endpoint Does

1. **Conversation Validation**: Checks if the conversation exists
2. **Permission Check**: Verifies the user has access to the conversation
3. **Query Messages**: Gets all messages ordered by timestamp (oldest first)
4. **Message Structure**: Returns complete message data including metadata

## Testing Send Message

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/messages/{conversationId}`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `conversationId`: The conversation ID to send the message to

### Request Body (Text Message)

```json
{
  "message": "Thank you for the confirmation! Looking forward to dining with you tonight.",
  "messageType": "text"
}
```

### Request Body (Message with Metadata)

```json
{
  "message": "Here are the special dietary requirements for our table.",
  "messageType": "text",
  "metadata": {
    "requirements": ["vegetarian", "gluten-free"],
    "tableSize": 4
  }
}
```

### Validation Rules

- `message` is required and must be a string
- `messageType` defaults to "text" if not provided
- `metadata` is optional and can contain any additional data

### Expected Response

```json
{
  "success": true,
  "data": {
    "id": "generated-message-id",
    "conversationId": "user-id_company-id",
    "senderId": "user-id",
    "senderType": "user",
    "message": "Thank you for the confirmation! Looking forward to dining with you tonight.",
    "messageType": "text",
    "timestamp": "2025-01-20T16:00:00.000Z",
    "readStatus": false,
    "metadata": null
  }
}
```

### What the Endpoint Does

1. **Message Validation**: Ensures message is provided and valid
2. **Conversation Access**: Checks user has permission to send messages
3. **Sender Detection**: Automatically determines if sender is user or company
4. **Message Creation**: Creates message with timestamp and metadata
5. **Conversation Update**: Updates conversation with last message and unread counts
6. **Unread Counter**: Increments unread count for the recipient

## Testing Mark Conversation as Read

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/conversations/{conversationId}/read`
- **Method**: PUT
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `conversationId`: The conversation ID to mark as read

### Request Body

```json
{
  "isUser": true
}
```

### Validation Rules

- `isUser`: Boolean indicating if the user (true) or company (false) is marking as read

### Expected Response

```json
{
  "success": true,
  "message": "Conversation marked as read"
}
```

### What the Endpoint Does

1. **Conversation Validation**: Checks if conversation exists and user has access
2. **Unread Count Reset**: Resets the appropriate unread counter to 0
3. **Message Status Update**: Marks all unread messages as read
4. **Batch Operation**: Uses Firestore batch to update multiple messages efficiently

## Testing Create Table Booking

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/bookings`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### Request Body

```json
{
  "companyId": "company-id",
  "date": "2025-01-20T20:00:00Z",
  "numberOfPeople": 4,
  "comments": "Celebrating anniversary, would prefer a quiet table",
  "images": [
    "https://firebasestorage.googleapis.com/v0/b/project/o/bookings%2Fimage1.jpg",
    "https://firebasestorage.googleapis.com/v0/b/project/o/bookings%2Fimage2.jpg"
  ]
}
```

### Request Body (Minimal)

```json
{
  "companyId": "company-id",
  "date": "2025-01-20T20:00:00Z",
  "numberOfPeople": 2
}
```

### Validation Rules

- `companyId`, `date`, `numberOfPeople` are required
- `comments` and `images` are optional
- `date` must be a valid ISO date string
- `numberOfPeople` must be a positive integer

### Expected Response

```json
{
  "success": true,
  "data": {
    "bookingId": "generated-booking-id",
    "userId": "user-id",
    "companyId": "company-id",
    "conversationId": "user-id_company-id",
    "date": "2025-01-20T20:00:00.000Z",
    "numberOfPeople": 4,
    "comments": "Celebrating anniversary, would prefer a quiet table",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/project/o/bookings%2Fimage1.jpg",
      "https://firebasestorage.googleapis.com/v0/b/project/o/bookings%2Fimage2.jpg"
    ],
    "status": "pending",
    "createdAt": "2025-01-20T16:30:00.000Z",
    "userFirstName": "John",
    "userLastName": "Doe",
    "companyName": "Restaurant XYZ"
  }
}
```

### What the Endpoint Does

1. **User Authentication**: Ensures user is authenticated
2. **Company/User Validation**: Checks if both user and company exist
3. **Conversation Management**: Creates conversation if it doesn't exist
4. **Booking Creation**: Creates table booking with pending status
5. **Message Generation**: Sends booking request message to conversation
6. **Notification**: Updates conversation with new message and unread count

## Testing Update Booking Status

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/bookings/{bookingId}/status`
- **Method**: PUT
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `bookingId`: The booking ID to update

### Request Body (Confirm Booking)

```json
{
  "status": "confirmed",
  "responseMessage": "We've reserved your table for 8 PM tonight. Looking forward to seeing you!"
}
```

### Request Body (Reject Booking)

```json
{
  "status": "rejected",
  "responseMessage": "Unfortunately, we're fully booked for that time. Would 7:30 PM or 9:30 PM work for you?"
}
```

### Request Body (Cancel Booking)

```json
{
  "status": "cancelled"
}
```

### Validation Rules

- `status` is required and must be one of: "pending", "confirmed", "rejected", "cancelled"
- `responseMessage` is optional but recommended for better customer communication

### Expected Response

```json
{
  "success": true,
  "message": "Booking status updated successfully"
}
```

### What the Endpoint Does

1. **Booking Validation**: Checks if booking exists
2. **Permission Check**: Verifies user has company access (staff member)
3. **Status Update**: Updates booking status in database
4. **Message Generation**: Creates appropriate status message
5. **Conversation Update**: Sends status message to conversation
6. **Customer Notification**: Increments user's unread count

### Status Messages

- **Confirmed**: "Your table booking has been confirmed! 🎉"
- **Rejected**: "Your table booking has been rejected."
- **Cancelled**: "Your table booking has been cancelled."

## Testing Get User Bookings

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/bookings/user/{userId}`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `userId`: The user ID to get bookings for

### Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": "booking-id-1",
      "userId": "user-id",
      "companyId": "company-id",
      "conversationId": "user-id_company-id",
      "date": "2025-01-20T20:00:00.000Z",
      "numberOfPeople": 4,
      "comments": "Celebrating anniversary",
      "images": [],
      "status": "confirmed",
      "createdAt": "2025-01-20T16:30:00.000Z",
      "userFirstName": "John",
      "userLastName": "Doe",
      "companyName": "Restaurant XYZ"
    },
    {
      "id": "booking-id-2",
      "userId": "user-id",
      "companyId": "another-company-id",
      "conversationId": "user-id_another-company-id",
      "date": "2025-01-25T19:00:00.000Z",
      "numberOfPeople": 2,
      "comments": null,
      "images": [],
      "status": "pending",
      "createdAt": "2025-01-19T10:15:00.000Z",
      "userFirstName": "John",
      "userLastName": "Doe",
      "companyName": "Cafe ABC"
    }
  ]
}
```

### What the Endpoint Does

1. **Permission Check**: Verifies requesting user can access the bookings
2. **Query Bookings**: Gets all bookings for the user
3. **Ordering**: Returns bookings ordered by creation date (newest first)
4. **Complete Data**: Includes all booking details and company information

## Testing Get Company Bookings

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/chat/bookings/company/{companyId}`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN

### URL Parameters

- `companyId`: The company ID to get bookings for

### Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": "booking-id-1",
      "userId": "user-id-1",
      "companyId": "company-id",
      "conversationId": "user-id-1_company-id",
      "date": "2025-01-20T20:00:00.000Z",
      "numberOfPeople": 4,
      "comments": "Celebrating anniversary",
      "images": [],
      "status": "confirmed",
      "createdAt": "2025-01-20T16:30:00.000Z",
      "userFirstName": "John",
      "userLastName": "Doe",
      "companyName": "Restaurant XYZ"
    },
    {
      "id": "booking-id-2",
      "userId": "user-id-2",
      "companyId": "company-id",
      "conversationId": "user-id-2_company-id",
      "date": "2025-01-20T19:30:00.000Z",
      "numberOfPeople": 6,
      "comments": "Business dinner",
      "images": [],
      "status": "pending",
      "createdAt": "2025-01-20T14:00:00.000Z",
      "userFirstName": "Jane",
      "userLastName": "Smith",
      "companyName": "Restaurant XYZ"
    }
  ]
}
```

### What the Endpoint Does

1. **Company Validation**: Checks if company exists
2. **Permission Check**: Verifies user has company access (staff member)
3. **Query Bookings**: Gets all bookings for the company
4. **Ordering**: Returns bookings ordered by creation date (newest first)
5. **Staff Access**: Supports all company roles (admins, editors, promotors, tableStaff, staff)

## Chat API Workflow Examples

### Scenario 1: Customer Makes Table Booking

1. **Create Booking**: Customer calls `POST /bookings` with date and party size
2. **Automatic Conversation**: System creates conversation if it doesn't exist
3. **Booking Message**: System sends booking request message to conversation
4. **Company Notification**: Company sees new unread message about booking
5. **Status Update**: Company staff calls `PUT /bookings/{id}/status` to confirm/reject
6. **Customer Notification**: Customer receives status update message

### Scenario 2: Ongoing Conversation

1. **Get Messages**: Customer calls `GET /messages/{conversationId}` to see history
2. **Send Message**: Customer calls `POST /messages/{conversationId}` with question
3. **Company Response**: Company staff sends reply message
4. **Mark as Read**: Both parties call `PUT /conversations/{id}/read` when viewing

### Scenario 3: Company Management

1. **View All Conversations**: Staff calls `GET /conversations/company/{id}` for overview
2. **Check Bookings**: Staff calls `GET /bookings/company/{id}` for all pending bookings
3. **Update Bookings**: Staff updates booking statuses as needed
4. **Customer Communication**: Staff sends messages for clarifications

### Best Practices

✅ **Authentication Required** - All endpoints require valid Firebase Auth token  
✅ **Permission-Based Access** - Users can only access their own data or company data they have access to  
✅ **Real-time Updates** - Use Firestore listeners for real-time conversation updates  
✅ **Message Types** - Use appropriate message types ("text", "booking") for better UX  
✅ **Metadata Usage** - Include relevant metadata for booking messages  
✅ **Read Status Management** - Mark conversations as read to maintain accurate unread counts  
✅ **Error Handling** - Handle permission denied and not found errors gracefully  

### Key Features

✅ **Automatic Conversation Creation** - Conversations created automatically when needed  
✅ **Unread Count Management** - Separate counters for user and company  
✅ **Message Metadata** - Support for rich message data  
✅ **Booking Integration** - Complete table booking workflow  
✅ **Role-Based Access** - Support for different company roles  
✅ **Message History** - Complete conversation history  
✅ **Status Tracking** - Booking status management with notifications

### Database Structure

**Conversation Document:**
```json
{
  "userId": "user-id",
  "companyId": "company-id",
  "userFirstName": "John",
  "userLastName": "Doe",
  "companyName": "Restaurant XYZ",
  "lastMessage": "Your table booking has been confirmed! 🎉",
  "lastUpdated": "2025-01-20T15:30:00.000Z",
  "unreadCountUser": 0,
  "unreadCountCompany": 1,
  "isActive": true,
  "createdAt": "2025-01-20T14:00:00.000Z"
}
```

**Message Document:**
```json
{
  "conversationId": "user-id_company-id",
  "senderId": "user-id",
  "senderType": "user",
  "message": "Hi, I'd like to book a table for tonight.",
  "messageType": "text",
  "timestamp": "2025-01-20T14:00:00.000Z",
  "readStatus": false,
  "metadata": null
}
```

**Table Booking Document:**
```json
{
  "userId": "user-id",
  "companyId": "company-id",
  "conversationId": "user-id_company-id",
  "date": "2025-01-20T20:00:00.000Z",
  "numberOfPeople": 4,
  "comments": "Celebrating anniversary",
  "images": [],
  "status": "pending",
  "createdAt": "2025-01-20T16:30:00.000Z",
  "userFirstName": "John",
  "userLastName": "Doe",
  "companyName": "Restaurant XYZ"
}
```

## Testing the createLandingPage Function

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/`
- **Method**: POST
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN
  - x-company-id: YOUR_COMPANY_ID

### Request Body Examples

#### Basic Landing Page

```json
{
  "title": "Summer Music Festival 2024",
  "description": "Join us for an unforgettable night of music, food, and entertainment under the stars."
}
```

#### Landing Page with Event Association

```json
{
  "title": "VIP Table Booking - New Year's Eve",
  "description": "Reserve your VIP table for the most exclusive New Year's Eve celebration in the city.",
  "eventId": "event-123",
  "showTickets": true,
  "enableGuestRegistration": true
}
```

#### Password Protected Landing Page

```json
{
  "title": "Private Corporate Event",
  "description": "Exclusive corporate networking event for invited guests only.",
  "isPasswordProtected": true,
  "password": "corporate2024",
  "guestCategoryId": "category-456"
}
```

#### Fully Customized Landing Page

```json
{
  "title": "Elegant Wedding Reception",
  "description": "Celebrate with us as we begin our journey together. RSVP required.",
  "eventId": "wedding-event-789",
  "guestCategoryId": "wedding-guests",
  "showTickets": false,
  "enableGuestRegistration": true,
  "isPasswordProtected": true,
  "password": "wedding2024",
  "backgroundImageUrl": "https://example.com/wedding-background.jpg",
  "customStyles": {
    "primaryColor": "#d4af37",
    "textColor": "#ffffff",
    "backgroundColor": "#2c1810"
  }
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "landing-page-abc123",
    "title": "Summer Music Festival 2024",
    "description": "Join us for an unforgettable night of music, food, and entertainment under the stars.",
    "slug": "company-slug/summer-music-festival-2024",
    "eventId": null,
    "guestCategoryId": null,
    "showTickets": false,
    "enableGuestRegistration": false,
    "isPasswordProtected": false,
    "password": null,
    "backgroundImageUrl": null,
    "customStyles": {
      "primaryColor": "#3b82f6",
      "textColor": "#ffffff",
      "backgroundColor": "#111827"
    },
    "createdBy": "user-id",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "isActive": true,
    "views": 0,
    "conversions": 0,
    "url": "https://your-domain.com/landing/company-slug/summer-music-festival-2024"
  },
  "message": "Landing page created successfully"
}
```

### Error Responses

#### Missing Company ID
```json
{
  "success": false,
  "error": "Company ID is required"
}
```

#### Event Not Found
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### Guest Category Not Found
```json
{
  "success": false,
  "error": "Guest category not found"
}
```

#### Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required and must be between 1 and 200 characters"
    }
  ]
}
```

### Testing Scenarios

#### Scenario 1: Basic Landing Page Creation

1. **Prepare basic data** with title and description
2. **Create landing page** using POST endpoint
3. **Verify automatic slug generation** from title
4. **Check default values** are applied correctly
5. **Test public URL** accessibility

#### Scenario 2: Event-Associated Landing Page

1. **Create or identify target event** first
2. **Create landing page** with eventId reference
3. **Verify event validation** works correctly
4. **Test showTickets and enableGuestRegistration** flags
5. **Check event data** is properly linked

#### Scenario 3: Password Protection Setup

1. **Create password-protected landing page**
2. **Test password requirement** on public access
3. **Verify password validation** on public endpoint
4. **Check security** - password not exposed in responses

#### Scenario 4: Custom Styling

1. **Create landing page** with custom styles
2. **Verify style application** on public page
3. **Test default style fallbacks** for missing values
4. **Check color format validation** (hex codes)

#### Scenario 5: Slug Uniqueness

1. **Create landing page** with specific title
2. **Create another page** with same title
3. **Verify automatic slug differentiation** (adds counter)
4. **Check both pages** have unique, working URLs

### Best Practices

✅ **Validate References** - Ensure eventId and categoryId exist before creation  
✅ **Test Slug Generation** - Verify URLs are SEO-friendly and unique  
✅ **Secure Passwords** - Use strong passwords for protected pages  
✅ **Custom Styling** - Test color codes and visual appearance  
✅ **Public Access** - Always test the generated public URL

## Testing the getLandingPages Function

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN
  - x-company-id: YOUR_COMPANY_ID

### Query Parameters

#### Get All Landing Pages

```
GET https://landingpages-kb7sximd6a-uc.a.run.app/
```

#### Filter by Status

```
GET https://landingpages-kb7sximd6a-uc.a.run.app/?status=active
GET https://landingpages-kb7sximd6a-uc.a.run.app/?status=inactive
```

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "landing-page-1",
      "title": "Summer Music Festival 2024",
      "description": "Join us for an unforgettable night of music and entertainment",
      "slug": "company-slug/summer-music-festival-2024",
      "eventId": "event-123",
      "guestCategoryId": null,
      "showTickets": true,
      "enableGuestRegistration": true,
      "isPasswordProtected": false,
      "backgroundImageUrl": "https://example.com/background.jpg",
      "customStyles": {
        "primaryColor": "#3b82f6",
        "textColor": "#ffffff",
        "backgroundColor": "#111827"
      },
      "createdBy": "user-id",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T11:30:00.000Z",
      "isActive": true,
      "views": 150,
      "conversions": 12,
      "url": "https://your-domain.com/landing/company-slug/summer-music-festival-2024"
    },
    {
      "id": "landing-page-2",
      "title": "Private Corporate Event",
      "description": "Exclusive networking event",
      "slug": "company-slug/private-corporate-event",
      "eventId": null,
      "guestCategoryId": "corporate-guests",
      "showTickets": false,
      "enableGuestRegistration": true,
      "isPasswordProtected": true,
      "backgroundImageUrl": null,
      "customStyles": {
        "primaryColor": "#059669",
        "textColor": "#ffffff",
        "backgroundColor": "#1f2937"
      },
      "createdBy": "user-id",
      "createdAt": "2024-01-14T14:00:00.000Z",
      "updatedAt": "2024-01-14T14:00:00.000Z",
      "isActive": true,
      "views": 45,
      "conversions": 8,
      "url": "https://your-domain.com/landing/company-slug/private-corporate-event"
    }
  ]
}
```

## Testing the getLandingPage Function (Single)

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/:id`
- **Method**: GET
- **Headers**: 
  - Authorization: Bearer YOUR_FIREBASE_TOKEN
  - x-company-id: YOUR_COMPANY_ID

### Request Examples

#### Get Specific Landing Page

```
GET https://landingpages-kb7sximd6a-uc.a.run.app/landing-page-abc123
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "landing-page-abc123",
    "title": "Summer Music Festival 2024",
    "description": "Join us for an unforgettable night of music and entertainment",
    "slug": "company-slug/summer-music-festival-2024",
    "eventId": "event-123",
    "guestCategoryId": null,
    "showTickets": true,
    "enableGuestRegistration": true,
    "isPasswordProtected": false,
    "backgroundImageUrl": "https://example.com/background.jpg",
    "customStyles": {
      "primaryColor": "#3b82f6",
      "textColor": "#ffffff",
      "backgroundColor": "#111827"
    },
    "createdBy": "user-id",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:30:00.000Z",
    "isActive": true,
    "views": 150,
    "conversions": 12,
    "url": "https://your-domain.com/landing/company-slug/summer-music-festival-2024"
  }
}
```

### Error Responses

#### Landing Page Not Found
```json
{
  "success": false,
  "error": "Landing page not found"
}
```

## Testing the getPublicLandingPage Function

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/public/:slug`
- **Method**: GET
- **Headers**: None required (public endpoint)

### Request Examples

#### Access Public Landing Page

```
GET https://landingpages-kb7sximd6a-uc.a.run.app/public/company-slug/summer-music-festival-2024
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "landing-page-abc123",
    "title": "Summer Music Festival 2024",
    "description": "Join us for an unforgettable night of music and entertainment",
    "slug": "company-slug/summer-music-festival-2024",
    "eventId": "event-123",
    "showTickets": true,
    "enableGuestRegistration": true,
    "isPasswordProtected": false,
    "backgroundImageUrl": "https://example.com/background.jpg",
    "customStyles": {
      "primaryColor": "#3b82f6",
      "textColor": "#ffffff",
      "backgroundColor": "#111827"
    },
    "companyId": "company-id",
    "views": 151
  }
}
```

**Note**: Password field is never returned in public endpoints for security.

### Testing Scenarios

#### Scenario 1: Public Access

1. **Create public landing page** (not password protected)
2. **Access via public endpoint** using slug
3. **Verify view count increment** on each access
4. **Check sensitive data exclusion** (no password field)

#### Scenario 2: Password Protected Access

1. **Create password-protected landing page**
2. **Access public endpoint** and note isPasswordProtected: true
3. **Implement password verification** in your frontend
4. **Test with correct/incorrect passwords**

### Best Practices

✅ **No Authentication** - Public endpoints don't require auth tokens  
✅ **View Tracking** - Each access increments the view counter  
✅ **Security** - Sensitive data (passwords) never exposed  
✅ **SEO Friendly** - Use clean, descriptive slugs

## Testing the updateLandingPage Function

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/:id`
- **Method**: PUT
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN
  - x-company-id: YOUR_COMPANY_ID

### Request Body Examples

#### Update Title (Automatically Regenerates Slug)

```json
{
  "data": {
    "title": "Updated Event Landing Page"
  }
}
```

#### Update Multiple Fields

```json
{
  "data": {
    "title": "Summer Music Festival 2024",
    "description": "Join us for an unforgettable night of music and entertainment",
    "showTickets": true,
    "enableGuestRegistration": true,
    "backgroundImageUrl": "https://example.com/new-background.jpg",
    "customStyles": {
      "primaryColor": "#ff6b6b",
      "textColor": "#ffffff",
      "backgroundColor": "#2d3748"
    }
  }
}
```

#### Enable Password Protection

```json
{
  "data": {
    "isPasswordProtected": true,
    "password": "secret123"
  }
}
```

#### Disable Password Protection

```json
{
  "data": {
    "isPasswordProtected": false
  }
}
```

#### Update Event Association

```json
{
  "data": {
    "eventId": "event-123",
    "guestCategoryId": "category-456"
  }
}
```

#### Update Custom Styles Only

```json
{
  "data": {
    "customStyles": {
      "primaryColor": "#4ade80",
      "backgroundColor": "#1f2937"
    }
  }
}
```

#### Deactivate Landing Page

```json
{
  "data": {
    "isActive": false
  }
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "landing-page-id",
    "title": "Updated Event Landing Page",
    "description": "Join us for an unforgettable night of music and entertainment",
    "slug": "company-slug/updated-event-landing-page",
    "eventId": "event-123",
    "guestCategoryId": "category-456",
    "showTickets": true,
    "enableGuestRegistration": true,
    "isPasswordProtected": true,
    "backgroundImageUrl": "https://example.com/new-background.jpg",
    "customStyles": {
      "primaryColor": "#ff6b6b",
      "textColor": "#ffffff",
      "backgroundColor": "#2d3748"
    },
    "createdBy": "user-id",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:30:00.000Z",
    "isActive": true,
    "views": 150,
    "conversions": 12,
    "url": "https://your-domain.com/landing/company-slug/updated-event-landing-page"
  },
  "message": "Landing page updated successfully"
}
```

### Error Responses

#### Landing Page Not Found
```json
{
  "success": false,
  "error": "Landing page not found"
}
```

#### Invalid Event Reference
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### Invalid Category Reference
```json
{
  "success": false,
  "error": "Guest category not found"
}
```

#### Missing Company ID
```json
{
  "success": false,
  "error": "Company ID is required"
}
```

#### Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title must be between 1 and 200 characters"
    }
  ]
}
```

### Testing Scenarios

#### Scenario 1: Update Title and Description

1. **Get existing landing page** using GET endpoint
2. **Update title and description** with meaningful content
3. **Verify slug regeneration** in response
4. **Check public URL** works with new slug

#### Scenario 2: Change Event Association

1. **Create or identify target event** for association
2. **Update landing page** with new eventId
3. **Verify event validation** works correctly
4. **Test with invalid eventId** to ensure error handling

#### Scenario 3: Update Styling

1. **Update custom styles** with new colors
2. **Verify style merging** preserves existing styles
3. **Test partial style updates** (only primaryColor)
4. **Check visual changes** on public landing page

#### Scenario 4: Password Protection Management

1. **Enable password protection** with secure password
2. **Test password requirement** on public endpoint
3. **Update password** while keeping protection enabled
4. **Disable password protection** and verify removal

#### Scenario 5: Bulk Field Updates

1. **Prepare comprehensive update** with multiple fields
2. **Submit single request** with all changes
3. **Verify atomic update** (all changes applied)
4. **Check updated timestamp** reflects changes

### Best Practices

✅ **Validate References** - Always verify eventId and categoryId exist  
✅ **Test Slug Changes** - Confirm new slugs work in public URLs  
✅ **Secure Passwords** - Use strong passwords for protection  
✅ **Partial Updates** - Only send fields that need changing  
✅ **Error Handling** - Test invalid data and missing references

## Testing the deleteLandingPage Function

### Request Details

- **URL**: `https://landingpages-kb7sximd6a-uc.a.run.app/:id`
- **Method**: DELETE
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer YOUR_FIREBASE_TOKEN
  - x-company-id: YOUR_COMPANY_ID

### Request Examples

#### Delete Landing Page by ID

```
DELETE /landingPages/landing-page-123
```

No request body is needed for deletion.

### Success Response

```json
{
  "success": true,
  "message": "Landing page deleted successfully"
}
```

### Error Responses

#### Landing Page Not Found
```json
{
  "success": false,
  "error": "Landing page not found"
}
```

#### Missing Company ID
```json
{
  "success": false,
  "error": "Company ID is required"
}
```

#### Unauthorized Access
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### Testing Scenarios

#### Scenario 1: Successful Deletion

1. **Create a test landing page** using POST endpoint
2. **Note the landing page ID** from creation response
3. **Delete the landing page** using DELETE endpoint
4. **Verify deletion** by attempting to GET the same ID (should return 404)
5. **Check public URL** no longer accessible

#### Scenario 2: Delete Non-Existent Landing Page

1. **Use invalid or non-existent ID** in DELETE request
2. **Verify 404 error response** with appropriate message
3. **Confirm no side effects** on other landing pages

#### Scenario 3: Company Isolation

1. **Create landing page** in Company A
2. **Attempt deletion** using Company B's header
3. **Verify access denied** (landing page not found for Company B)
4. **Confirm landing page** still exists for Company A

#### Scenario 4: Cleanup Verification

1. **Delete landing page** successfully
2. **Check that slug is freed** for reuse
3. **Verify no orphaned data** remains
4. **Test creating new landing page** with same title

### Best Practices

✅ **Confirm Before Deletion** - Always verify the landing page exists and belongs to your company  
✅ **Test Access Control** - Ensure users can only delete their company's landing pages  
✅ **Document Impact** - Note which public URLs will become unavailable  
✅ **Backup Strategy** - Consider archiving important landing pages before deletion  
✅ **Monitor Usage** - Check analytics before deleting popular landing pages

### Complete Landing Page Workflow

#### Full CRUD Testing Sequence

1. **CREATE**: Use POST `/landingPages` to create a new landing page
2. **READ**: Use GET `/landingPages/:id` to retrieve the landing page
3. **UPDATE**: Use PUT `/landingPages/:id` to modify the landing page
4. **DELETE**: Use DELETE `/landingPages/:id` to remove the landing page

#### Production Considerations

- **Slug Management**: Understand that title changes regenerate slugs
- **Reference Validation**: Event and category IDs are validated on updates
- **Public Access**: Remember that public URLs become invalid after deletion
- **Analytics Impact**: Views and conversions data is lost on deletion
- **SEO Considerations**: Deleted landing pages may affect search rankings

---

## Testing the submitContactForm Function

The `submitContactForm` function handles support requests from your contact form, stores them in Firestore, and sends email notifications to your support team.

### Request Details

- **URL**: `https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/submitContactForm`
- **Method**: POST (Firebase Callable Function)
- **Authentication**: REQUIRED (user must be logged in)
- **Content-Type**: application/json

### Request Body Structure

```json
{
  "data": {
    "name": "John Smith",
    "email": "john.smith@company.com",
    "companyName": "Tech Solutions Inc",
    "companyId": "company_xyz789",
    "subject": "technical",
    "message": "I'm having trouble with the guest check-in process. When I try to check in a guest, the system shows an error message saying 'Invalid QR code' even though the code appears to be correct.",
    "attachments": [
      {
        "name": "error-screenshot.png",
        "type": "image/png",
        "size": 1048576,
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      }
    ]
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Customer's full name (1-100 characters) |
| `email` | string | ✅ | Valid email address |
| `companyName` | string | ❌ | Company name (max 100 characters) |
| `companyId` | string | ✅ | Company ID (required for authentication) |
| `subject` | string | ✅ | Subject category (see valid values below) |
| `message` | string | ✅ | Support message (10-2000 characters) |
| `attachments` | array | ❌ | Array of image attachments (max 3) |

### Valid Subject Values

- `general` - General Question
- `technical` - Technical Issue
- `billing` - Billing & Subscription
- `feature` - Feature Request
- `bug` - Bug Report
- `account` - Account Management
- `integration` - Integration Support
- `training` - Training & Onboarding
- `other` - Other

### Attachment Structure

Each attachment object must contain:

```json
{
  "name": "filename.png",
  "type": "image/png",
  "size": 1048576,
  "data": "data:image/png;base64,BASE64_STRING_HERE"
}
```

**Attachment Requirements:**
- ✅ **Max 3 attachments** per request
- ✅ **Image files only** (image/png, image/jpeg, image/gif, image/webp)
- ✅ **Max 10MB per file**
- ✅ **Base64 encoded** with data URL prefix

### Test Examples

#### Example 1: Basic Contact Form (No Attachments)

```json
{
  "data": {
    "name": "Sarah Johnson",
    "email": "sarah@startup.com",
    "companyName": "StartupCo",
    "subject": "general",
    "message": "How do I upgrade my subscription plan? I need access to more features for our growing team."
  }
}
```

#### Example 2: Technical Issue with Screenshot

```json
{
  "data": {
    "name": "Mike Chen",
    "email": "mike.chen@restaurant.com",
    "companyName": "Chen's Restaurant",
    "subject": "technical",
    "message": "The table layout is not displaying correctly on mobile devices. Tables appear overlapped and guests can't select their seats properly. This has been happening since yesterday.",
    "attachments": [
      {
        "name": "mobile-bug.png",
        "type": "image/png",
        "size": 2097152,
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      }
    ]
  }
}
```

#### Example 3: Bug Report with Multiple Images

```json
{
  "data": {
    "name": "Alex Rodriguez",
    "email": "alex@eventspace.com",
    "companyName": "EventSpace Pro",
    "subject": "bug",
    "message": "QR code scanner is not working properly. It scans the code but doesn't check in the guest. I've attached screenshots showing the issue and what should happen.",
    "attachments": [
      {
        "name": "qr-scan-error.png",
        "type": "image/png",
        "size": 1572864,
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      },
      {
        "name": "expected-behavior.jpg",
        "type": "image/jpeg",
        "size": 786432,
        "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A=="
      },
      {
        "name": "console-log.png",
        "type": "image/png",
        "size": 524288,
        "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      }
    ]
  }
}
```

### Expected Responses

#### Success Response

```json
{
  "success": true,
  "message": "Your support request has been submitted successfully. Our support team will review it and respond directly to your email.",
  "ticketId": "1K2L3M4N5P6Q"
}
```

#### Validation Error Response

```json
{
  "success": false,
  "message": "Failed to submit support request: Validation error: \"email\" must be a valid email"
}
```

#### File Size Error Response

```json
{
  "success": false,
  "message": "Failed to submit support request: Validation error: \"attachments[0].size\" must be less than or equal to 10485760"
}
```

### What Happens When You Submit

1. **✅ Data Validation** - All fields are validated according to schema
2. **🎫 Ticket Creation** - Unique ticket ID generated (e.g., `1K2L3M4N5P6Q`)
3. **💾 Database Storage** - Full ticket data saved to `support` collection
4. **📧 Email Notification** - Support team receives email at `hello@guestbuddy.net`
5. **📊 Email Tracking** - Email delivery status tracked in database

### Database Structure

The ticket is stored in Firestore at: `support/{ticketId}`

```json
{
  "name": "John Smith",
  "email": "john.smith@company.com",
  "companyName": "Tech Solutions Inc",
  "subject": "technical",
  "subjectLabel": "Technical Issue",
  "message": "I'm having trouble with...",
  "attachmentCount": 1,
  "attachments": [
    {
      "name": "error-screenshot.png",
      "type": "image/png",
      "size": 1048576,
      "sizeFormatted": "1.0 MB"
    }
  ],
  "ticketId": "1K2L3M4N5P6Q",
  "status": "new",
  "priority": "normal",
  "assignedTo": null,
  "createdAt": "2024-01-01T10:30:00Z",
  "updatedAt": "2024-01-01T10:30:00Z",
  "supportEmailSent": true,
  "confirmationEmailSent": false,
  "source": "contact_form",
  "customerResponse": null,
  "internalNotes": [],
  "tags": ["technical"]
}
```

### Email Notification

Support team receives email with subject: `Support - #1K2L3M4N5P6Q - Technical Issue`

**Email includes:**
- 🎫 Ticket ID and subject
- 👤 Customer contact information
- 💬 Full message content
- 📎 All image attachments
- ⏰ Submission timestamp
- 🏷️ Professional HTML formatting

### Testing Scenarios

#### Scenario 1: Valid Submission (No Attachments)

1. **Submit basic contact form** with required fields only
2. **Verify success response** with ticket ID
3. **Check Firestore** for created document
4. **Confirm email sent** to hello@guestbuddy.net
5. **Validate email content** and formatting

#### Scenario 2: Full Submission with Attachments

1. **Prepare test images** (convert to base64)
2. **Submit with all fields** and 2-3 attachments
3. **Verify attachments received** in email
4. **Check database** for attachment metadata
5. **Confirm file sizes** calculated correctly

#### Scenario 3: Validation Testing

1. **Test missing required fields** (name, email, subject, message)
2. **Test invalid email format** (missing @, invalid domain)
3. **Test message too short** (< 10 characters)
4. **Test message too long** (> 2000 characters)
5. **Test invalid subject** (not in allowed list)

#### Scenario 4: Attachment Validation

1. **Test too many attachments** (> 3 files)
2. **Test file too large** (> 10MB)
3. **Test invalid file type** (PDF, TXT, etc.)
4. **Test invalid base64** format
5. **Test missing attachment fields**

#### Scenario 5: Email Delivery Testing

1. **Submit valid request**
2. **Check spam folder** for email delivery
3. **Verify email formatting** in different clients
4. **Test attachment downloads** from email
5. **Confirm subject line format**

### Common Issues & Solutions

#### ❌ Email Not Received
- Check spam/junk folder
- Verify `hello@guestbuddy.net` is correct
- Check Firebase Functions logs
- Verify SMTP configuration

#### ❌ Attachment Too Large
- Resize images before converting to base64
- Use image compression tools
- Check file size before encoding
- Consider multiple smaller files

#### ❌ Base64 Conversion Issues
- Use proper data URL format: `data:image/png;base64,`
- Ensure no line breaks in base64 string
- Verify image file is valid before encoding
- Test with small image first

#### ❌ Validation Errors
- Check all required fields are present
- Verify email format is valid
- Ensure subject is from allowed list
- Check message length requirements

### Best Practices

✅ **Test with Real Data** - Use actual customer scenarios  
✅ **Verify Email Delivery** - Always check email was received  
✅ **Test All Subjects** - Try each subject category  
✅ **Check Mobile Images** - Test with mobile screenshots  
✅ **Monitor Database** - Verify tickets are stored correctly  
✅ **Test Error Cases** - Ensure proper error handling  
✅ **Performance Testing** - Test with maximum attachments

### Production Considerations

- **Rate Limiting**: Consider implementing rate limits to prevent spam
- **File Storage**: Large attachments increase email size
- **Email Deliverability**: Monitor bounce rates and spam scores
- **Database Cleanup**: Plan for ticket archival strategy
- **Response Workflow**: Set up support team processes
- **Analytics**: Track ticket volume and response times
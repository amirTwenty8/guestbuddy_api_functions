import 'package:cloud_functions/cloud_functions.dart';

class TableUpdateService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  /// Update table information after booking
  /// This replaces the existing updateTableData method in your app
  static Future<void> updateTableData({
    required String companyId,
    required String eventId,
    required String layoutName,
    required Map<String, dynamic> updatedData,
    required String userName,
    String action = 'updated',
  }) async {
    try {
      // Prepare the request data
      final requestData = {
        'companyId': companyId,
        'eventId': eventId,
        'layoutName': layoutName,
        'tableName': updatedData['tableName'],
        'action': action,
        // Add all the fields that can be updated
        if (updatedData['userId'] != null) 'userId': updatedData['userId'],
        if (updatedData['name'] != null) 'name': updatedData['name'],
        if (updatedData['phoneNr'] != null) 'phoneNr': updatedData['phoneNr'],
        if (updatedData['e164Number'] != null) 'e164Number': updatedData['e164Number'],
        if (updatedData['nrOfGuests'] != null) 'nrOfGuests': updatedData['nrOfGuests'],
        if (updatedData['comment'] != null) 'comment': updatedData['comment'],
        if (updatedData['tableLimit'] != null) 'tableLimit': updatedData['tableLimit'],
        if (updatedData['tableSpent'] != null) 'tableSpent': updatedData['tableSpent'],
        if (updatedData['tableCheckedIn'] != null) 'tableCheckedIn': updatedData['tableCheckedIn'],
        if (updatedData['tableTimeFrom'] != null) 'tableTimeFrom': updatedData['tableTimeFrom'],
        if (updatedData['tableTimeTo'] != null) 'tableTimeTo': updatedData['tableTimeTo'],
        if (updatedData['tableBookedBy'] != null) 'tableBookedBy': updatedData['tableBookedBy'],
        if (updatedData['tableEmail'] != null) 'tableEmail': updatedData['tableEmail'],
        if (updatedData['tableStaff'] != null) 'tableStaff': updatedData['tableStaff'],
      };

      // Call the Firebase function
      final HttpsCallable callable = FirebaseFunctions.instance.httpsCallable('updateTable');
      final result = await callable.call(requestData);

      // Handle the response
      if (result.data['result']['success']) {
        print('Table updated successfully');
        print('Changes: ${result.data['result']['data']['changes']}');
        print('Updated by: ${result.data['result']['data']['updatedBy']}');
        print('Logs count: ${result.data['result']['data']['logsCount']}');
      } else {
        throw Exception('Failed to update table: ${result.data['result']['error']}');
      }
    } catch (e) {
      print('Error updating table: $e');
      rethrow;
    }
  }

  /// Example usage methods
  static Future<void> updateTableSpending({
    required String companyId,
    required String eventId,
    required String layoutName,
    required String tableName,
    required String userId,
    required int newSpentAmount,
    required String userName,
  }) async {
    await updateTableData(
      companyId: companyId,
      eventId: eventId,
      layoutName: layoutName,
      updatedData: {
        'tableName': tableName,
        'userId': userId,
        'tableSpent': newSpentAmount,
      },
      userName: userName,
      action: 'spending updated',
    );
  }

  static Future<void> updateTableCheckIn({
    required String companyId,
    required String eventId,
    required String layoutName,
    required String tableName,
    required int checkedInCount,
    required String userName,
  }) async {
    await updateTableData(
      companyId: companyId,
      eventId: eventId,
      layoutName: layoutName,
      updatedData: {
        'tableName': tableName,
        'tableCheckedIn': checkedInCount,
      },
      userName: userName,
      action: 'checked in',
    );
  }

  static Future<void> updateTableStaff({
    required String companyId,
    required String eventId,
    required String layoutName,
    required String tableName,
    required String staffName,
    required String userName,
  }) async {
    await updateTableData(
      companyId: companyId,
      eventId: eventId,
      layoutName: layoutName,
      updatedData: {
        'tableName': tableName,
        'tableStaff': staffName,
      },
      userName: userName,
      action: 'staff changed',
    );
  }

  static Future<void> updateTableDetails({
    required String companyId,
    required String eventId,
    required String layoutName,
    required String tableName,
    required String guestName,
    required String phoneNumber,
    required String e164Number,
    required int numberOfGuests,
    required int tableLimit,
    required String userName,
  }) async {
    await updateTableData(
      companyId: companyId,
      eventId: eventId,
      layoutName: layoutName,
      updatedData: {
        'tableName': tableName,
        'name': guestName,
        'phoneNr': phoneNumber,
        'e164Number': e164Number,
        'nrOfGuests': numberOfGuests,
        'tableLimit': tableLimit,
      },
      userName: userName,
      action: 'details updated',
    );
  }
}

// Example usage in your app:
void exampleUsage() async {
  try {
    // Update table spending
    await TableUpdateService.updateTableSpending(
      companyId: 'Z640gK6OvfiuDRx069ht',
      eventId: '41e745f0-490e-4fe2-b1b2-f0b30babcb59',
      layoutName: 'VIP',
      tableName: '101',
      userId: 'E1HwrRzfJ4angHeaS1FTBSpQZY3e',
      newSpentAmount: 25000,
      userName: 'Amir Company Ehsani',
    );

    // Update check-in count
    await TableUpdateService.updateTableCheckIn(
      companyId: 'Z640gK6OvfiuDRx069ht',
      eventId: '41e745f0-490e-4fe2-b1b2-f0b30babcb59',
      layoutName: 'VIP',
      tableName: '101',
      checkedInCount: 8,
      userName: 'Amir Company Ehsani',
    );

    // Update staff assignment
    await TableUpdateService.updateTableStaff(
      companyId: 'Z640gK6OvfiuDRx069ht',
      eventId: '41e745f0-490e-4fe2-b1b2-f0b30babcb59',
      layoutName: 'VIP',
      tableName: '101',
      staffName: 'Moa',
      userName: 'Amir Company Ehsani',
    );

    // Update table details
    await TableUpdateService.updateTableDetails(
      companyId: 'Z640gK6OvfiuDRx069ht',
      eventId: '41e745f0-490e-4fe2-b1b2-f0b30babcb59',
      layoutName: 'VIP',
      tableName: '101',
      guestName: 'John Doe',
      phoneNumber: '4808080',
      e164Number: '+464808080',
      nrOfGuests: 10,
      tableLimit: 20000,
      userName: 'Amir Company Ehsani',
    );

  } catch (e) {
    print('Error: $e');
  }
}

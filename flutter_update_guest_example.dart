import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';

class UpdateGuestExample extends StatefulWidget {
  const UpdateGuestExample({super.key});

  @override
  State<UpdateGuestExample> createState() => _UpdateGuestExampleState();
}

class _UpdateGuestExampleState extends State<UpdateGuestExample> {
  final TextEditingController _eventIdController = TextEditingController();
  final TextEditingController _companyIdController = TextEditingController();
  final TextEditingController _guestIdController = TextEditingController();
  final TextEditingController _guestNameController = TextEditingController();
  final TextEditingController _normalGuestsController = TextEditingController();
  final TextEditingController _freeGuestsController = TextEditingController();
  final TextEditingController _commentController = TextEditingController();
  final TextEditingController _categoriesController = TextEditingController();
  
  String _status = '';
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Set default values for testing
    _eventIdController.text = 'your-event-id';
    _companyIdController.text = 'your-company-id';
    _guestIdController.text = 'your-guest-id';
    _guestNameController.text = 'John Doe';
    _normalGuestsController.text = '2';
    _freeGuestsController.text = '1';
    _commentController.text = 'VIP guest';
    _categoriesController.text = 'VIP';
  }

  @override
  void dispose() {
    _eventIdController.dispose();
    _companyIdController.dispose();
    _guestIdController.dispose();
    _guestNameController.dispose();
    _normalGuestsController.dispose();
    _freeGuestsController.dispose();
    _commentController.dispose();
    _categoriesController.dispose();
    super.dispose();
  }

  Future<void> _updateGuest() async {
    setState(() {
      _isLoading = true;
      _status = 'Updating guest...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      
      // Prepare request data
      final requestData = {
        'eventId': _eventIdController.text,
        'companyId': _companyIdController.text,
        'guestId': _guestIdController.text,
      };

      // Only add fields that have values (partial update support)
      if (_guestNameController.text.isNotEmpty) {
        requestData['guestName'] = _guestNameController.text;
      }
      
      if (_normalGuestsController.text.isNotEmpty) {
        requestData['normalGuests'] = int.tryParse(_normalGuestsController.text) ?? 0;
      }
      
      if (_freeGuestsController.text.isNotEmpty) {
        requestData['freeGuests'] = int.tryParse(_freeGuestsController.text) ?? 0;
      }
      
      if (_commentController.text.isNotEmpty) {
        requestData['comment'] = _commentController.text;
      }
      
      if (_categoriesController.text.isNotEmpty) {
        // Split categories by comma and trim whitespace
        final categories = _categoriesController.text
            .split(',')
            .map((cat) => cat.trim())
            .where((cat) => cat.isNotEmpty)
            .toList();
        requestData['categories'] = categories;
      }

      final result = await functions.httpsCallable('updateGuest').call(requestData);

      final data = result.data as Map<String, dynamic>;
      
      if (data['success'] == true) {
        final responseData = data['data'] as Map<String, dynamic>;
        final changes = responseData['changes'] as Map<String, dynamic>?;
        final summaryUpdated = responseData['summaryUpdated'] as bool;
        
        setState(() {
          _status = 'Guest updated successfully!\n'
              'Updated by: ${responseData['updatedBy']}\n'
              'Changes: ${changes?.keys.join(', ') ?? 'None'}\n'
              'Summary updated: ${summaryUpdated ? 'Yes' : 'No'}';
        });
      } else {
        setState(() {
          _status = 'Error updating guest: ${data['error']}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error updating guest: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _updateNameOnly() async {
    setState(() {
      _isLoading = true;
      _status = 'Updating guest name only...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      
      final result = await functions.httpsCallable('updateGuest').call({
        'eventId': _eventIdController.text,
        'companyId': _companyIdController.text,
        'guestId': _guestIdController.text,
        'guestName': _guestNameController.text,
      });

      final data = result.data as Map<String, dynamic>;
      
      if (data['success'] == true) {
        setState(() {
          _status = 'Guest name updated successfully!\n'
              'Updated by: ${data['data']['updatedBy']}';
        });
      } else {
        setState(() {
          _status = 'Error updating guest: ${data['error']}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error updating guest: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Guest Example'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Event and Company ID inputs
            TextField(
              controller: _eventIdController,
              decoration: const InputDecoration(
                labelText: 'Event ID',
                border: OutlineInputBorder(),
                hintText: 'Enter the event ID',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _companyIdController,
              decoration: const InputDecoration(
                labelText: 'Company ID',
                border: OutlineInputBorder(),
                hintText: 'Enter the company ID',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _guestIdController,
              decoration: const InputDecoration(
                labelText: 'Guest ID',
                border: OutlineInputBorder(),
                hintText: 'Enter the guest ID to update',
              ),
            ),
            const SizedBox(height: 24),
            
            // Guest details inputs
            TextField(
              controller: _guestNameController,
              decoration: const InputDecoration(
                labelText: 'Guest Name',
                border: OutlineInputBorder(),
                hintText: 'Enter guest name',
              ),
            ),
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _normalGuestsController,
                    decoration: const InputDecoration(
                      labelText: 'Normal Guests',
                      border: OutlineInputBorder(),
                      hintText: 'Number of paying guests',
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextField(
                    controller: _freeGuestsController,
                    decoration: const InputDecoration(
                      labelText: 'Free Guests',
                      border: OutlineInputBorder(),
                      hintText: 'Number of free guests',
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(
                labelText: 'Comment',
                border: OutlineInputBorder(),
                hintText: 'Enter guest comment',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            
            TextField(
              controller: _categoriesController,
              decoration: const InputDecoration(
                labelText: 'Categories (comma-separated)',
                border: OutlineInputBorder(),
                hintText: 'VIP, Regular, etc.',
              ),
            ),
            const SizedBox(height: 24),
            
            // Status display
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _status.contains('Error') ? Colors.red.shade50 : Colors.green.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _status.contains('Error') ? Colors.red.shade200 : Colors.green.shade200,
                ),
              ),
              child: Text(
                _status.isEmpty ? 'Ready to update guest' : _status,
                style: TextStyle(
                  color: _status.contains('Error') ? Colors.red.shade700 : Colors.green.shade700,
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _updateNameOnly,
                    icon: const Icon(Icons.edit),
                    label: const Text('Update Name Only'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _updateGuest,
                    icon: _isLoading 
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.save),
                    label: Text(_isLoading ? 'Updating...' : 'Update All Fields'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Information section
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '📝 Update Guest Features:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Text('• Partial updates supported - only send changed fields'),
                  Text('• Automatically recalculates summary statistics'),
                  Text('• Logs all changes with user information'),
                  Text('• Validates guest existence and permissions'),
                  Text('• Updates guest list and summary atomically'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Example usage in main.dart:
/*
void main() {
  runApp(MaterialApp(
    home: UpdateGuestExample(),
  ));
}
*/ 
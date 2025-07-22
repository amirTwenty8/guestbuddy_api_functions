import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AddMultipleGuestsExample extends StatefulWidget {
  const AddMultipleGuestsExample({super.key});

  @override
  State<AddMultipleGuestsExample> createState() => _AddMultipleGuestsExampleState();
}

class _AddMultipleGuestsExampleState extends State<AddMultipleGuestsExample> {
  final TextEditingController _guestsController = TextEditingController();
  final TextEditingController _eventIdController = TextEditingController();
  final TextEditingController _companyIdController = TextEditingController();
  
  String _status = '';
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Set default values for testing
    _eventIdController.text = 'your-event-id';
    _companyIdController.text = 'your-company-id';
    
    // Load any existing draft
    _loadDraft();
  }

  @override
  void dispose() {
    _guestsController.dispose();
    _eventIdController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }

  Future<void> _loadDraft() async {
    setState(() {
      _isLoading = true;
      _status = 'Loading draft...';
    });

    try {
      // Direct Firestore read for draft loading
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        if (userDoc.exists) {
          final userData = userDoc.data();
          final drafts = userData?['guestListDrafts'] as Map<String, dynamic>?;
          final draftText = drafts?[_eventIdController.text] as String?;
          
          if (draftText != null && draftText.isNotEmpty) {
            _guestsController.text = draftText;
            setState(() {
              _status = 'Draft loaded successfully!';
            });
          } else {
            setState(() {
              _status = 'No draft found for this event.';
            });
          }
        } else {
          setState(() {
            _status = 'User document not found.';
          });
        }
      } else {
        setState(() {
          _status = 'User not authenticated.';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error loading draft: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _saveDraft() async {
    setState(() {
      _isLoading = true;
      _status = 'Saving draft...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final result = await functions.httpsCallable('saveGuestDraft').call({
        'eventId': _eventIdController.text,
        'draftText': _guestsController.text,
      });

      final data = result.data as Map<String, dynamic>;
      
      if (data['success'] == true) {
        setState(() {
          _status = 'Draft saved successfully!';
        });
      } else {
        setState(() {
          _status = 'Error saving draft: ${data['error']}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error saving draft: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _clearDraft() async {
    setState(() {
      _isLoading = true;
      _status = 'Clearing draft...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final result = await functions.httpsCallable('clearGuestDraft').call({
        'eventId': _eventIdController.text,
      });

      final data = result.data as Map<String, dynamic>;
      
      if (data['success'] == true) {
        _guestsController.clear();
        setState(() {
          _status = 'Draft cleared successfully!';
        });
      } else {
        setState(() {
          _status = 'Error clearing draft: ${data['error']}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error clearing draft: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _addMultipleGuests() async {
    if (_guestsController.text.trim().isEmpty) {
      setState(() {
        _status = 'Please enter some guests first!';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _status = 'Adding multiple guests...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final result = await functions.httpsCallable('addMultipleGuests').call({
        'eventId': _eventIdController.text,
        'companyId': _companyIdController.text,
        'guestsText': _guestsController.text,
      });

      final data = result.data as Map<String, dynamic>;
      
      if (data['success'] == true) {
        final responseData = data['data'] as Map<String, dynamic>;
        final guestsAdded = responseData['guestsAdded'] as int;
        final totalGuests = responseData['totalGuests'] as int;
        final guestNames = responseData['guestNames'] as List<dynamic>;
        
        setState(() {
          _status = 'Success! Added $guestsAdded guests (${totalGuests} total guests).\n'
              'Guests: ${guestNames.join(', ')}';
        });
        
        // Clear the draft after successful addition
        await _clearDraft();
      } else {
        setState(() {
          _status = 'Error adding guests: ${data['error']}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error adding guests: $e';
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
        title: const Text('Add Multiple Guests Example'),
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
            const SizedBox(height: 24),
            
            // Format instructions
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
                    '📝 Format Instructions:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Text('• Each line: "FirstName LastName +free +paid"'),
                  Text('• Example: "John Doe +2 +3" (2 free, 3 paid guests)'),
                  Text('• Example: "Jane Smith +1 +0" (1 free guest only)'),
                  Text('• Empty lines are ignored'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Guests text input
            Expanded(
              child: TextField(
                controller: _guestsController,
                maxLines: null,
                expands: true,
                decoration: const InputDecoration(
                  labelText: 'Guests List',
                  border: OutlineInputBorder(),
                  hintText: 'Enter guests here...\nExample:\nJohn Doe +2 +3\nJane Smith +1 +2',
                  alignLabelWithHint: true,
                ),
              ),
            ),
            const SizedBox(height: 16),
            
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
                _status.isEmpty ? 'Ready to add guests' : _status,
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
                    onPressed: _isLoading ? null : _saveDraft,
                    icon: const Icon(Icons.save),
                    label: const Text('Save Draft'),
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
                    onPressed: _isLoading ? null : _clearDraft,
                    icon: const Icon(Icons.clear),
                    label: const Text('Clear Draft'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.grey,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _addMultipleGuests,
              icon: _isLoading 
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.add),
              label: Text(_isLoading ? 'Adding Guests...' : 'Add Multiple Guests'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
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
    home: AddMultipleGuestsExample(),
  ));
}
*/ 
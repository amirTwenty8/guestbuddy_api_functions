import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GuestBuddy Delete Event Test',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const DeleteEventScreen(),
    );
  }
}

class DeleteEventScreen extends StatefulWidget {
  const DeleteEventScreen({Key? key}) : super(key: key);

  @override
  State<DeleteEventScreen> createState() => _DeleteEventScreenState();
}

class _DeleteEventScreenState extends State<DeleteEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _eventIdController = TextEditingController();
  final _companyIdController = TextEditingController();
  
  bool _isLoading = false;
  String _resultMessage = '';
  
  @override
  void dispose() {
    _eventIdController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }
  
  Future<void> _deleteEvent() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    // Show confirmation dialog
    final shouldDelete = await _showDeleteConfirmation();
    if (!shouldDelete) {
      return;
    }
    
    setState(() {
      _isLoading = true;
      _resultMessage = '';
    });
    
    try {
      // Get the callable function
      final callable = FirebaseFunctions.instance.httpsCallable('deleteEvent');
      
      // Call the function with the event data
      final result = await callable.call({
        'eventId': _eventIdController.text.trim(),
        'companyId': _companyIdController.text.trim(),
      });
      
      setState(() {
        _resultMessage = 'Event deleted successfully!';
      });
      
      print('Function result: ${result.data}');
      
      // Print detailed information about what was deleted
      if (result.data['data'] != null) {
        final data = result.data['data'];
        print('Event ID: ${data['eventId']}');
        print('Event Name: ${data['eventName']}');
        print('Deleted by: ${data['deletedBy']}');
        print('Deleted at: ${data['deletedAt']}');
        
        if (data['deletedDocuments'] != null) {
          final docs = data['deletedDocuments'];
          print('Guest List Documents: ${docs['guestLists']}');
          print('Table List Documents: ${docs['tableLists']}');
          print('Total Documents Deleted: ${docs['total']}');
        }
      }
    } catch (e) {
      setState(() {
        _resultMessage = 'Error deleting event: ${e.toString()}';
      });
      print('Error calling function: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  Future<bool> _showDeleteConfirmation() async {
    return await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Delete Event'),
          content: const Text(
            'Are you sure you want to delete this event? This action cannot be undone and will delete all associated data including guest lists and table layouts.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(
                foregroundColor: Colors.red,
              ),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    ) ?? false;
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Delete Event Test'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _eventIdController,
                decoration: const InputDecoration(
                  labelText: 'Event ID (to delete)',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter an event ID';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _companyIdController,
                decoration: const InputDecoration(
                  labelText: 'Company ID',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a company ID';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _deleteEvent,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
                child: _isLoading 
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Delete Event'),
              ),
              const SizedBox(height: 16),
              if (_resultMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _resultMessage.contains('Error') 
                      ? Colors.red.shade100 
                      : Colors.green.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _resultMessage,
                    style: TextStyle(
                      color: _resultMessage.contains('Error') 
                        ? Colors.red.shade900 
                        : Colors.green.shade900,
                    ),
                  ),
                ),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade300),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '⚠️ Warning',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.orange,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'This function will permanently delete:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    const Text('• The main event document'),
                    const Text('• All guest list documents'),
                    const Text('• All table layout documents'),
                    const Text('• All associated data'),
                    const SizedBox(height: 8),
                    const Text(
                      'This action cannot be undone!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
} 
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
      title: 'GuestBuddy Update Event Test',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const UpdateEventScreen(),
    );
  }
}

class UpdateEventScreen extends StatefulWidget {
  const UpdateEventScreen({Key? key}) : super(key: key);

  @override
  State<UpdateEventScreen> createState() => _UpdateEventScreenState();
}

class _UpdateEventScreenState extends State<UpdateEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _eventIdController = TextEditingController();
  final _eventNameController = TextEditingController();
  final _companyIdController = TextEditingController();
  
  bool _isLoading = false;
  String _resultMessage = '';
  
  @override
  void dispose() {
    _eventIdController.dispose();
    _eventNameController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }
  
  Future<void> _updateEvent() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    setState(() {
      _isLoading = true;
      _resultMessage = '';
    });
    
    try {
      // Get the callable function
      final callable = FirebaseFunctions.instance.httpsCallable('updateEvent');
      
      // Prepare start and end dates (24 hours from now)
      final now = DateTime.now();
      final startDateTime = now.add(const Duration(hours: 24));
      final endDateTime = startDateTime.add(const Duration(hours: 5));
      
      // Call the function with the event data
      // Note: All IDs below should be valid document IDs from your Firestore collections
      final result = await callable.call({
        'eventId': _eventIdController.text.trim(),
        'eventName': _eventNameController.text.trim(),
        'startDateTime': startDateTime.toIso8601String(),
        'endDateTime': endDateTime.toIso8601String(),
        'companyId': _companyIdController.text.trim(),
        
        // Table Layout IDs (document IDs from companies/{companyId}/layouts collection)
        'tableLayouts': [
          'layout_document_id_1', // Replace with actual layout document ID
          'layout_document_id_3', // Replace with actual layout document ID
        ],
        
        // Category IDs (document IDs from companies/{companyId}/categories collection)
        'categories': [
          'category_document_id_1', // Replace with actual category document ID
        ],
        
        // Club Card IDs (document IDs from companies/{companyId}/cards collection)
        'clubCardIds': [
          'clubcard_document_id_1', // Replace with actual club card document ID
        ],
        
        // Event Genre IDs (document IDs from companies/{companyId}/genres collection)
        'eventGenre': [
          'genre_document_id_1', // Replace with actual genre document ID
        ],
      });
      
      setState(() {
        _resultMessage = 'Event updated successfully!';
      });
      
      print('Function result: ${result.data}');
      
      // The response will include both IDs and names for all the referenced items
      if (result.data['data'] != null) {
        print('Table Layouts: ${result.data['data']['tableLayouts']}');
        print('Categories: ${result.data['data']['categories']}');
        print('Club Cards: ${result.data['data']['clubCardIds']}');
        print('Event Genres: ${result.data['data']['eventGenre']}');
        
        // Print the changes that were made
        if (result.data['data']['changes'] != null) {
          final changes = result.data['data']['changes'];
          print('Layouts Removed: ${changes['layoutsRemoved']}');
          print('Layouts Added: ${changes['layoutsAdded']}');
          print('Table Changes: ${changes['tableChanges']}');
        }
      }
    } catch (e) {
      setState(() {
        _resultMessage = 'Error updating event: ${e.toString()}';
      });
      print('Error calling function: $e');
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
        title: const Text('Update Event Test'),
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
                  labelText: 'Event ID (existing)',
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
                controller: _eventNameController,
                decoration: const InputDecoration(
                  labelText: 'Event Name',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter an event name';
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
                onPressed: _isLoading ? null : _updateEvent,
                child: _isLoading 
                  ? const CircularProgressIndicator()
                  : const Text('Update Event'),
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
              const Text(
                'Note: This example updates an existing event with new table layouts, categories, club cards, and genres. The function will automatically:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('• Calculate which table layouts to add/remove'),
              const Text('• Update table summary statistics'),
              const Text('• Add logs to new tables'),
              const Text('• Remove old table layout documents'),
              const Text('• Update the main event document'),
            ],
          ),
        ),
      ),
    );
  }
} 
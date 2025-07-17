import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

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
      title: 'GuestBuddy API Test',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const CreateEventScreen(),
    );
  }
}

class CreateEventScreen extends StatefulWidget {
  const CreateEventScreen({Key? key}) : super(key: key);

  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _eventNameController = TextEditingController();
  final _companyIdController = TextEditingController();
  
  bool _isLoading = false;
  String _resultMessage = '';
  
  @override
  void dispose() {
    _eventNameController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }
  
  Future<void> _createEvent() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    setState(() {
      _isLoading = true;
      _resultMessage = '';
    });
    
    try {
      // Get the callable function
      final callable = FirebaseFunctions.instance.httpsCallable('createEvent');
      
      // Generate a unique event ID
      final eventId = const Uuid().v4();
      
      // Prepare start and end dates (24 hours from now)
      final now = DateTime.now();
      final startDateTime = now.add(const Duration(hours: 24));
      final endDateTime = startDateTime.add(const Duration(hours: 5));
      
      // Call the function with the event data
      // Note: All IDs below should be valid document IDs from your Firestore collections
      final result = await callable.call({
        'eventId': eventId,
        'eventName': _eventNameController.text.trim(),
        'startDateTime': startDateTime.toIso8601String(),
        'endDateTime': endDateTime.toIso8601String(),
        'companyId': _companyIdController.text.trim(),
        
        // Table Layout IDs (document IDs from companies/{companyId}/layouts collection)
        'tableLayouts': [
          'layout_document_id_1', // Replace with actual layout document ID
          'layout_document_id_2', // Replace with actual layout document ID
        ],
        
        // Category IDs (document IDs from companies/{companyId}/categories collection)
        'categories': [
          'category_document_id_1', // Replace with actual category document ID
          'category_document_id_2', // Replace with actual category document ID
        ],
        
        // Club Card IDs (document IDs from companies/{companyId}/clubCards collection)
        'clubCardIds': [
          'clubcard_document_id_1', // Replace with actual club card document ID
          'clubcard_document_id_2', // Replace with actual club card document ID
        ],
        
        // Event Genre IDs (document IDs from companies/{companyId}/genres collection)
        'eventGenre': [
          'genre_document_id_1', // Replace with actual genre document ID
          'genre_document_id_2', // Replace with actual genre document ID
        ],
      });
      
      setState(() {
        _resultMessage = 'Event created successfully! Event ID: $eventId';
      });
      
      print('Function result: ${result.data}');
      
      // The response will include both IDs and names for all the referenced items
      if (result.data['data'] != null) {
        print('Table Layouts: ${result.data['data']['tableLayouts']}');
        print('Categories: ${result.data['data']['categories']}');
        print('Club Cards: ${result.data['data']['clubCardIds']}');
        print('Event Genres: ${result.data['data']['eventGenre']}');
      }
    } catch (e) {
      setState(() {
        _resultMessage = 'Error creating event: ${e.toString()}';
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
        title: const Text('Create Event Test'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _createEvent,
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Create Event'),
              ),
              const SizedBox(height: 24),
              if (_resultMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  color: _resultMessage.contains('Error')
                      ? Colors.red.shade100
                      : Colors.green.shade100,
                  child: Text(_resultMessage),
                ),
            ],
          ),
        ),
      ),
    );
  }
} 
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
      title: 'GuestBuddy Add Guest Test',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const AddGuestScreen(),
    );
  }
}

class AddGuestScreen extends StatefulWidget {
  const AddGuestScreen({Key? key}) : super(key: key);

  @override
  State<AddGuestScreen> createState() => _AddGuestScreenState();
}

class _AddGuestScreenState extends State<AddGuestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _eventIdController = TextEditingController();
  final _companyIdController = TextEditingController();
  final _guestNameController = TextEditingController();
  final _normalGuestsController = TextEditingController();
  final _freeGuestsController = TextEditingController();
  final _commentController = TextEditingController();
  final _selectedUserIdController = TextEditingController();
  
  List<String> _categories = ['VIP', 'Regular', 'Premium'];
  String? _selectedCategory;
  
  bool _isLoading = false;
  String _resultMessage = '';
  
  @override
  void dispose() {
    _eventIdController.dispose();
    _companyIdController.dispose();
    _guestNameController.dispose();
    _normalGuestsController.dispose();
    _freeGuestsController.dispose();
    _commentController.dispose();
    _selectedUserIdController.dispose();
    super.dispose();
  }
  
  Future<void> _addGuest() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    // Validate that at least one guest type has a value
    final normalGuests = int.tryParse(_normalGuestsController.text) ?? 0;
    final freeGuests = int.tryParse(_freeGuestsController.text) ?? 0;
    
    if (normalGuests === 0 && freeGuests === 0) {
      setState(() {
        _resultMessage = 'At least one guest type must have a value greater than 0';
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _resultMessage = '';
    });
    
    try {
      // Get the callable function
      final callable = FirebaseFunctions.instance.httpsCallable('addGuest');
      
      // Call the function with the guest data
      final result = await callable.call({
        'eventId': _eventIdController.text.trim(),
        'companyId': _companyIdController.text.trim(),
        'guestName': _guestNameController.text.trim(),
        'normalGuests': normalGuests,
        'freeGuests': freeGuests,
        'comment': _commentController.text.trim(),
        'categories': _selectedCategory != null ? [_selectedCategory!] : [],
        'selectedUserId': _selectedUserIdController.text.trim().isNotEmpty 
          ? _selectedUserIdController.text.trim() 
          : null,
      });
      
      setState(() {
        _resultMessage = 'Guest added successfully!';
      });
      
      print('Function result: ${result.data}');
      
      // Print detailed information about the added guest
      if (result.data['data'] != null) {
        final data = result.data['data'];
        print('Guest ID: ${data['guestId']}');
        print('Guest Name: ${data['guestName']}');
        print('Normal Guests: ${data['normalGuests']}');
        print('Free Guests: ${data['freeGuests']}');
        print('Total Guests: ${data['totalGuests']}');
        print('Added By: ${data['addedBy']}');
        print('Added At: ${data['addedAt']}');
        print('User ID for Company Guests: ${data['userIdForCompanyGuests']}');
        print('User Type: ${data['userType']}');
      }
      
    } catch (e) {
      setState(() {
        _resultMessage = 'Error adding guest: ${e.toString()}';
      });
      print('Error calling function: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  void _selectCategory() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Select Guest Category'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  title: const Text('Clear Selection'),
                  onTap: () {
                    setState(() {
                      _selectedCategory = null;
                    });
                    Navigator.pop(context);
                  },
                ),
                const Divider(),
                ..._categories.map((category) {
                  return ListTile(
                    title: Text(category),
                    onTap: () {
                      setState(() {
                        _selectedCategory = category;
                      });
                      Navigator.pop(context);
                    },
                  );
                }).toList(),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        );
      },
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Guest Test'),
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
                  labelText: 'Event ID',
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
              const SizedBox(height: 16),
              TextFormField(
                controller: _guestNameController,
                decoration: const InputDecoration(
                  labelText: 'Guest Name',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a guest name';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _normalGuestsController,
                      decoration: const InputDecoration(
                        labelText: 'Paying Guests',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value != null && value.isNotEmpty) {
                          if (int.tryParse(value) == null) {
                            return 'Enter a valid number';
                          }
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextFormField(
                      controller: _freeGuestsController,
                      decoration: const InputDecoration(
                        labelText: 'Free Guests',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value != null && value.isNotEmpty) {
                          if (int.tryParse(value) == null) {
                            return 'Enter a valid number';
                          }
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _commentController,
                decoration: const InputDecoration(
                  labelText: 'Comment (Optional)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              TextFormField(
                readOnly: true,
                decoration: InputDecoration(
                  labelText: 'Category (Optional)',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.arrow_drop_down),
                    onPressed: _selectCategory,
                  ),
                ),
                controller: TextEditingController(text: _selectedCategory ?? ''),
                onTap: _selectCategory,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _selectedUserIdController,
                decoration: const InputDecoration(
                  labelText: 'Selected User ID (Optional)',
                  border: OutlineInputBorder(),
                  helperText: 'If user was selected from search, add their user ID here',
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _addGuest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading 
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Add Guest'),
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
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ℹ️ Information',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'This function will:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    const Text('• Add the guest to the event\'s guest list'),
                    const Text('• Update guest list summary statistics'),
                    const Text('• Create a log entry for the addition'),
                    const Text('• Add guest to company guests collection'),
                    const Text('• Auto-generate user ID for new guests'),
                    const Text('• Track genre preferences (if applicable)'),
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
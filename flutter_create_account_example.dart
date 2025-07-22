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
      title: 'GuestBuddy Create Account API Test',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const CreateAccountTestScreen(),
    );
  }
}

class CreateAccountTestScreen extends StatefulWidget {
  const CreateAccountTestScreen({Key? key}) : super(key: key);

  @override
  State<CreateAccountTestScreen> createState() => _CreateAccountTestScreenState();
}

class _CreateAccountTestScreenState extends State<CreateAccountTestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _countryController = TextEditingController();
  final _cityController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _acceptTerms = false;
  bool _isLoading = false;
  String _resultMessage = '';
  
  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _birthDateController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
  
  Future<void> _createAccount() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    if (!_acceptTerms) {
      setState(() {
        _resultMessage = 'Please accept the terms and conditions';
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _resultMessage = '';
    });
    
    try {
      // Get the callable function
      final callable = FirebaseFunctions.instance.httpsCallable('createAccount');
      
      // Call the function with the account data
      final result = await callable.call({
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'email': _emailController.text.trim(),
        'phoneNumber': _phoneController.text.trim(),
        'birthDate': _birthDateController.text.trim(),
        'country': _countryController.text.trim(),
        'city': _cityController.text.trim(),
        'password': _passwordController.text,
        'terms': _acceptTerms,
      });
      
      setState(() {
        _resultMessage = 'Account created successfully! User ID: ${result.data['data']['userId']}';
      });
      
      print('Function result: ${result.data}');
      
      // The user can now sign in with their email and password
      print('User can sign in with email: ${result.data['data']['email']}');
      
    } catch (e) {
      setState(() {
        _resultMessage = 'Error creating account: ${e.toString()}';
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
        title: const Text('Create Account API Test'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _firstNameController,
                  decoration: const InputDecoration(
                    labelText: 'First Name *',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your first name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _lastNameController,
                  decoration: const InputDecoration(
                    labelText: 'Last Name *',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your last name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email *',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your email';
                    }
                    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                      return 'Please enter a valid email address';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneController,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number * (E.164 format)',
                    border: OutlineInputBorder(),
                    hintText: '+46732010328',
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your phone number';
                    }
                    if (!value.startsWith('+')) {
                      return 'Phone number must start with + (e.g., +46...)';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _birthDateController,
                  decoration: const InputDecoration(
                    labelText: 'Birth Date * (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                    hintText: '1990-01-15',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your birth date';
                    }
                    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
                      return 'Please enter date in YYYY-MM-DD format';
                    }
                    // Check if user is at least 16 years old
                    final birthDate = DateTime.tryParse(value);
                    if (birthDate != null) {
                      final age = DateTime.now().year - birthDate.year;
                      final monthDiff = DateTime.now().month - birthDate.month;
                      final dayDiff = DateTime.now().day - birthDate.day;
                      final actualAge = monthDiff < 0 || (monthDiff == 0 && dayDiff < 0) ? age - 1 : age;
                      if (actualAge < 16) {
                        return 'You must be at least 16 years old';
                      }
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _countryController,
                  decoration: const InputDecoration(
                    labelText: 'Country *',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your country';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _cityController,
                  decoration: const InputDecoration(
                    labelText: 'City *',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your city';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  decoration: const InputDecoration(
                    labelText: 'Password *',
                    border: OutlineInputBorder(),
                  ),
                  obscureText: true,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter a password';
                    }
                    if (value.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Checkbox(
                      value: _acceptTerms,
                      onChanged: (value) {
                        setState(() {
                          _acceptTerms = value ?? false;
                        });
                      },
                    ),
                    const Expanded(
                      child: Text('I accept the terms and conditions'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _createAccount,
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Create Account'),
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
      ),
    );
  }
} 
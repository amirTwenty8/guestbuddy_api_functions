import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class EmailVerificationExample extends StatefulWidget {
  const EmailVerificationExample({super.key});

  @override
  State<EmailVerificationExample> createState() => _EmailVerificationExampleState();
}

class _EmailVerificationExampleState extends State<EmailVerificationExample> {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _verificationCodeController = TextEditingController();
  bool _isLoading = false;
  String _message = '';
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    // Set the region for Firebase Functions
    _functions.useFunctionsEmulator('localhost', 5001);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _verificationCodeController.dispose();
    super.dispose();
  }

  /// Verify email with 6-digit verification code
  Future<void> _verifyEmail() async {
    if (_emailController.text.isEmpty || _verificationCodeController.text.isEmpty) {
      _showMessage('Please fill in all fields', false);
      return;
    }

    setState(() {
      _isLoading = true;
      _message = '';
    });

    try {
      final HttpsCallable callable = _functions.httpsCallable('verifyEmail');
      
      final result = await callable.call({
        'email': _emailController.text.trim(),
        'verificationCode': _verificationCodeController.text.trim(),
      });

      final data = result.data;
      
      if (data['success'] == true) {
        _showMessage('Email verified successfully!', true);
        // Navigate to login screen or main app
        _navigateToLogin();
      } else {
        _showMessage(data['error'] ?? 'Verification failed', false);
      }
    } catch (e) {
      _showMessage('Error: ${e.toString()}', false);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Resend verification email
  Future<void> _resendVerificationEmail() async {
    if (_emailController.text.isEmpty) {
      _showMessage('Please enter your email address', false);
      return;
    }

    setState(() {
      _isLoading = true;
      _message = '';
    });

    try {
      final HttpsCallable callable = _functions.httpsCallable('resendVerificationEmail');
      
      final result = await callable.call({
        'email': _emailController.text.trim(),
      });

      final data = result.data;
      
      if (data['success'] == true) {
        _showMessage('Verification email sent successfully!', true);
      } else {
        _showMessage(data['error'] ?? 'Failed to resend email', false);
      }
    } catch (e) {
      _showMessage('Error: ${e.toString()}', false);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showMessage(String message, bool isSuccess) {
    setState(() {
      _message = message;
      _isSuccess = isSuccess;
    });

    // Auto-hide message after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _message = '';
        });
      }
    });
  }

  void _navigateToLogin() {
    // Navigate to login screen
    // Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => LoginScreen()));
    print('Navigate to login screen');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Email Verification'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Email input
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'Email Address',
                hintText: 'Enter your email address',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.email),
              ),
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              enableSuggestions: false,
            ),
            
            const SizedBox(height: 16),
            
            // Verification code input
            TextField(
              controller: _verificationCodeController,
              decoration: const InputDecoration(
                labelText: 'Verification Code',
                hintText: 'Enter 6-digit code',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.security),
              ),
              keyboardType: TextInputType.number,
              maxLength: 6,
              autocorrect: false,
              enableSuggestions: false,
            ),
            
            const SizedBox(height: 24),
            
            // Verify Email button
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _verifyEmail,
              icon: _isLoading 
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.verified),
              label: Text(_isLoading ? 'Verifying...' : 'Verify Email'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Resend Email button
            OutlinedButton.icon(
              onPressed: _isLoading ? null : _resendVerificationEmail,
              icon: const Icon(Icons.refresh),
              label: const Text('Resend Verification Email'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Message display
            if (_message.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isSuccess ? Colors.green.shade50 : Colors.red.shade50,
                  border: Border.all(
                    color: _isSuccess ? Colors.green : Colors.red,
                    width: 1,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      _isSuccess ? Icons.check_circle : Icons.error,
                      color: _isSuccess ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _message,
                        style: TextStyle(
                          color: _isSuccess ? Colors.green.shade800 : Colors.red.shade800,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            
            const Spacer(),
            
            // Instructions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Instructions:',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text('1. Enter your email address'),
                  Text('2. Enter the 6-digit verification code from your email'),
                  Text('3. Tap "Verify Email" to complete verification'),
                  Text('4. If you didn\'t receive the code, tap "Resend Verification Email"'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Example usage in your app
class EmailVerificationScreen extends StatelessWidget {
  const EmailVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmailVerificationExample();
  }
}

// Example of how to integrate with your existing app flow
class AccountVerificationFlow extends StatefulWidget {
  final String email;
  
  const AccountVerificationFlow({
    super.key,
    required this.email,
  });

  @override
  State<AccountVerificationFlow> createState() => _AccountVerificationFlowState();
}

class _AccountVerificationFlowState extends State<AccountVerificationFlow> {
  final TextEditingController _verificationCodeController = TextEditingController();
  bool _isLoading = false;
  String _message = '';
  bool _isSuccess = false;
  int _resendCooldown = 0;

  @override
  void initState() {
    super.initState();
    _startResendCooldown();
  }

  void _startResendCooldown() {
    setState(() {
      _resendCooldown = 30;
    });
    
    Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          if (_resendCooldown > 0) {
            _resendCooldown--;
          } else {
            timer.cancel();
          }
        });
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _verifyEmail() async {
    if (_verificationCodeController.text.isEmpty) {
      _showMessage('Please enter the verification code', false);
      return;
    }

    setState(() {
      _isLoading = true;
      _message = '';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final callable = functions.httpsCallable('verifyEmail');
      
      final result = await callable.call({
        'email': widget.email,
        'verificationCode': _verificationCodeController.text.trim(),
      });

      final data = result.data;
      
      if (data['success'] == true) {
        _showMessage('Email verified successfully!', true);
        // Navigate to login screen
        _navigateToLogin();
      } else {
        _showMessage(data['error'] ?? 'Verification failed', false);
      }
    } catch (e) {
      _showMessage('Error: ${e.toString()}', false);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _resendVerificationEmail() async {
    if (_resendCooldown > 0) return;

    setState(() {
      _isLoading = true;
      _message = '';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final callable = functions.httpsCallable('resendVerificationEmail');
      
      final result = await callable.call({
        'email': widget.email,
      });

      final data = result.data;
      
      if (data['success'] == true) {
        _showMessage('Verification email sent successfully!', true);
        _startResendCooldown();
      } else {
        _showMessage(data['error'] ?? 'Failed to resend email', false);
      }
    } catch (e) {
      _showMessage('Error: ${e.toString()}', false);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showMessage(String message, bool isSuccess) {
    setState(() {
      _message = message;
      _isSuccess = isSuccess;
    });
  }

  void _navigateToLogin() {
    // Navigate to login screen
    Navigator.pushReplacementNamed(context, '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Verify Your Email'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Email icon
            const Icon(
              Icons.email_outlined,
              size: 80,
              color: Colors.blue,
            ),
            
            const SizedBox(height: 24),
            
            // Title
            const Text(
              'Check Your Email',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Description
            Text(
              'We\'ve sent a verification code to:\n${widget.email}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Verification code input
            TextField(
              controller: _verificationCodeController,
              decoration: const InputDecoration(
                labelText: 'Verification Code',
                hintText: 'Enter 6-digit code',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.security),
              ),
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                letterSpacing: 8,
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Verify button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _verifyEmail,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Verify Email',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Resend button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _resendCooldown > 0 || _isLoading ? null : _resendVerificationEmail,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: Text(
                  _resendCooldown > 0 
                      ? 'Resend in $_resendCooldown seconds'
                      : 'Resend Verification Email',
                  style: const TextStyle(fontSize: 16),
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Message display
            if (_message.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isSuccess ? Colors.green.shade50 : Colors.red.shade50,
                  border: Border.all(
                    color: _isSuccess ? Colors.green : Colors.red,
                    width: 1,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      _isSuccess ? Icons.check_circle : Icons.error,
                      color: _isSuccess ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _message,
                        style: TextStyle(
                          color: _isSuccess ? Colors.green.shade800 : Colors.red.shade800,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// Don't forget to import Timer
import 'dart:async'; 
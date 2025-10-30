import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Validation flags
  const isUsernameValid = formData.username.trim().length > 0;
  const isEmailValid = formData.email.includes('@');
  const isPasswordValid = formData.password.length >= 6;
  const isRepeatPasswordValid = formData.password === formData.repeatPassword;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isUsernameValid) return setError('Username is required.');
    if (!isEmailValid) return setError('Please enter a valid email.');
    if (!isPasswordValid) return setError('Password must be at least 6 characters.');
    if (!isRepeatPasswordValid) return setError('Passwords do not match.');

    setLoading(true);

    try {
      const { email, password, username } = formData;

      // Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError('Error signing up: ' + signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('User not created. Please try again.');
        setLoading(false);
        return;
      }

      // Trigger handles the profile creation automatically
      // Don’t need to manually insert a profile

      alert('Registration successful! Please check your email to confirm.');
      navigate('/login');
    } catch (err) {
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen bg-cover bg-center relative font-sans"
      style={{ backgroundImage: "url('/mahidol_bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-white opacity-60"></div>

      <header className="relative z-10 flex justify-between items-center bg-white shadow px-6 py-4">
        <div className="flex items-center space-x-2">
          <img
            src="/forum_logo-removebg-preview.png"
            alt="Mahidol Forum Logo"
            className="h-10 w-auto object-contain"
          />
          <span className="text-lg font-semibold text-mahidol-blue">Mahidol Forum</span>
        </div>
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-gray-100 text-mahidol-blue px-4 py-2 rounded hover:bg-gray-200 transition"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="p-8 w-full max-w-md text-gray-800">
          <h1 className="text-3xl font-bold mb-2 text-mahidol-blue text-left">Welcome</h1>
          <p className="text-left text-gray-700 mb-6">Register your account here!</p>

          {error && <p className="text-red-600 text-center font-medium mb-3">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-blue bg-white"
              />
              {formData.username &&
                (isUsernameValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-2.5" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-2.5" />
                ))}
            </div>

            {/* Email */}
            <div className="relative">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-blue bg-white"
              />
              {formData.email &&
                (isEmailValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-2.5" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-2.5" />
                ))}
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-yellow bg-white"
              />
              {formData.password &&
                (isPasswordValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-2.5" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-2.5" />
                ))}
            </div>

            {/* Repeat Password */}
            <div className="relative">
              <input
                type="password"
                name="repeatPassword"
                placeholder="Repeat Password"
                value={formData.repeatPassword}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-yellow bg-white"
              />
              {formData.repeatPassword &&
                (isRepeatPasswordValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-2.5" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-2.5" />
                ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-mahidol-blue text-white py-2 rounded hover:bg-mahidol-dark transition"
            >
              {loading ? 'Registering...' : 'REGISTER'}
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-mahidol-blue font-semibold hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

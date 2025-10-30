import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { Link, useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailPattern.test(email);
  const isPasswordValid = password.length >= 6;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // Sign in with Supabase using email only
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg('Wrong password or email');
        return;
      }

      // Fetch profile from `profiles` table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileError) {
        console.log('Profile fetch error:', profileError.message);
      } else {
        console.log('Logged in as:', profileData.username);
      }

      // Redirect to home/forum page
      navigate('/home');
    } catch (err) {
      setErrorMsg('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col relative font-sans"
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
          <span className="text-lg font-semibold">Mahidol Forum</span>
        </div>
        <div className="space-x-4">
          <Link
            to="/register"
            className="bg-mahidol-blue text-white px-4 py-2 rounded hover:bg-mahidol-dark transition"
          >
            Register
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="p-8 w-full max-w-md text-gray-800">
          <h1 className="text-3xl font-bold mb-2 text-mahidol-blue">Welcome</h1>
          <p className="text-gray-700 mb-6">Log in to your account here!</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <label className="block text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-blue bg-white"
                placeholder="Enter your email"
                required
              />
              {/* Show icons only after typing a few chars */}
              {email.length > 2 &&
                (isEmailValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-9" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-9" />
                ))}
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mahidol-yellow bg-white"
                placeholder="Enter your password"
                required
              />
              {password &&
                (isPasswordValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-mahidol-blue absolute right-3 top-9" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500 absolute right-3 top-9" />
                ))}
            </div>

            {/* Error Message */}
            {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-mahidol-blue text-white py-2 rounded hover:bg-mahidol-dark transition"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

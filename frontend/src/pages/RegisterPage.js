import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: 'Ari',
    email: 'ari@student.mahidol.ac.th',
    password: '',
    repeatPassword: ''
  });

  const [errors, setErrors] = useState({
    email: 'Email already registered!'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle registration logic here
    console.log('Registration data:', formData);
  };

  const isFieldValid = (fieldName) => {
    if (fieldName === 'username' && formData.username.length > 0) return true;
    if (fieldName === 'email' && formData.email.includes('@') && !errors.email) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-gradient-to-r from-mahidol-blue to-mahidol-yellow rounded-full"></div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Register your account here!
          </p>
        </div>
    
      </div>
    </div>
  );
};

export default RegisterPage;

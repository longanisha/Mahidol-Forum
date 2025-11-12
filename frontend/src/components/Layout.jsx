import React from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className='absolute inset-0 flex flex-col h-screen bg-gray-50 antialiased'>
      <Navbar />
      <div className='flex flex-1 overflow-hidden pt1-6'>
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

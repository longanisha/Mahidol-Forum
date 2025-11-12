import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TagsPage from './pages/TagsPage.jsx';
import AnnouncementsPage from './pages/AnnouncementsPage.jsx';
import Layout from './components/Layout.jsx';
import Discussions from './pages/Discussions.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone auth routes without Layout */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path='/login' element={<LoginPage />} />
        
        {/* App routes wrapped with Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Discussions />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
        </Route>

      {/* 404 not found page */}
      <Route path="*" element={<div>404 Not Found</div>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

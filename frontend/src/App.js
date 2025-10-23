import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TagsPage from './pages/TagsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Standalone auth routes without Layout */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* App routes wrapped with Layout */}
        <Route path="/home" element={
          <Layout>
            <HomePage />
          </Layout>
        } />
        <Route path="/tags" element={
          <Layout>
            <TagsPage />
          </Layout>
        } />
        <Route path="/announcements" element={
          <Layout>
            <AnnouncementsPage />
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;

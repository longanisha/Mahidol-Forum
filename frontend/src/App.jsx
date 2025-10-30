import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import Home from './pages/Home.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TagsPage from './pages/TagsPage.jsx';
import AnnouncementsPage from './pages/AnnouncementsPage.jsx';
import Layout from './components/Layout.jsx';

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
          <Home />
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

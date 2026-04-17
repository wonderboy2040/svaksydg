import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';

function App() {
  const [status, setStatus] = useState('ready');

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Home />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import FailedNotifications from './pages/FailedNotifications';
import './index.css';

function App(){ return (
  <BrowserRouter>
    <Routes>
      <Route path='/' element={<Login/>} />
      <Route path='/notifications' element={<FailedNotifications/>} />
    </Routes>
  </BrowserRouter>
)}

createRoot(document.getElementById('root')!).render(<App/>);
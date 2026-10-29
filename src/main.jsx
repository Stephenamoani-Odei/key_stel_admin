import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { DialogProvider } from './Dialog.jsx'
import './styles.css'
createRoot(document.getElementById('root')).render(<ErrorBoundary><DialogProvider><App /></DialogProvider></ErrorBoundary>)

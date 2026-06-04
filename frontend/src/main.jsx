import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'animal-island-ui/style';
import './styles/cursors.css';
import { AppProvider } from './context/AppContext';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

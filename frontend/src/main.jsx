
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();

    deferredInstallPrompt = event;

    console.log('Natter install prompt is available');
    window.dispatchEvent(
        new CustomEvent('natter-install-available')
    );
});

window.addEventListener('appinstalled', () => {
    console.log('Natter installed');

    deferredInstallPrompt = null;

    window.dispatchEvent(
        new CustomEvent('natter-app-installed')
    );
});

window.installNatter = async () => {
    if (!deferredInstallPrompt) {
        console.log('Natter install prompt is currently unavailable');

        return false;
    }

    deferredInstallPrompt.prompt();

    const { outcome } =
        await deferredInstallPrompt.userChoice;

    console.log('Natter install result:', outcome);

    deferredInstallPrompt = null;

    return outcome === 'accepted';
};

createRoot(document.getElementById('root')).render(
        <App />
);

//
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then(reg => {
                console.log('SW registered:', reg.scope);
            })
            .catch(err => {
                console.error(
                    'SW registration failed:',
                    err
                );
            });
    });
}
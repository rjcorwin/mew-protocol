import { MultiplayerGameClient } from '../MultiplayerGameClient.js';
import { JoinFormValues } from '../types.js';

declare global {
  interface Window {
    mewGameClient?: MultiplayerGameClient;
  }
}

const statusEl = (): HTMLElement => {
  const el = document.getElementById('status');
  if (!el) {
    throw new Error('Status element missing');
  }
  return el;
};

const setStatus = (message: string, type: 'info' | 'error' = 'info'): void => {
  const el = statusEl();
  el.textContent = message;
  el.style.color = type === 'error' ? '#ff6b6b' : '#a9def9';
};

const parseForm = (form: HTMLFormElement): JoinFormValues => {
  const data = new FormData(form);
  return {
    gatewayUrl: String(data.get('gatewayUrl') || 'localhost'),
    port: Number(data.get('port') || 8080),
    username: String(data.get('username') || 'pilot'),
    token: String(data.get('token') || '')
  };
};

const disableForm = (form: HTMLFormElement, disabled: boolean): void => {
  Array.from(form.elements).forEach((element) => {
    (element as HTMLInputElement | HTMLButtonElement).disabled = disabled;
  });
};

const initialize = (): void => {
  const form = document.getElementById('join-form') as HTMLFormElement | null;
  if (!form) {
    throw new Error('Join form missing');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    disableForm(form, true);

    const values = parseForm(form);
    if (!values.token) {
      setStatus('Token is required to authenticate with the MEW gateway.', 'error');
      disableForm(form, false);
      return;
    }

    try {
      if (window.mewGameClient) {
        await window.mewGameClient.stop();
      }

      const gameClient = new MultiplayerGameClient(values, {
        containerId: 'game-root',
        description: 'Phaser isometric multiplayer scene'
      });
      window.mewGameClient = gameClient;

      setStatus('Connecting to MEW gateway...');
      await gameClient.start();
      setStatus('Connected. Use WASD or arrow keys to move around the flotilla.');
    } catch (error) {
      console.error(error);
      setStatus(`Connection failed: ${(error as Error).message}`, 'error');
    } finally {
      disableForm(form, false);
    }
  });
};

window.addEventListener('DOMContentLoaded', () => {
  try {
    initialize();
  } catch (error) {
    console.error(error);
    setStatus('Failed to bootstrap renderer. Check console for details.', 'error');
  }
});

window.addEventListener('beforeunload', async () => {
  if (window.mewGameClient) {
    await window.mewGameClient.stop();
  }
});

import Wazo from '@wazo/sdk';
import { createIcons, icons } from 'lucide';
import './style.css';

const app = document.querySelector('#app');
const remoteAudio = document.querySelector('#remote-audio');

const state = {
  connected: false,
  connecting: false,
  call: null,
  incoming: false,
  muted: false,
  held: false,
  status: 'Ready to connect',
};

const icon = (name, size = 18) => `<i data-lucide="${name}" data-size="${size}" aria-hidden="true"></i>`;

app.innerHTML = `
  <section class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Wazo Desk home">
        <span class="brand-mark">${icon('phone', 20)}</span>
        <span>Wazo Desk</span>
      </a>
      <div id="connection-pill" class="status-pill offline">
        <span class="status-dot"></span>
        <span id="connection-label">Offline</span>
      </div>
    </header>

    <div class="workspace">
      <aside class="setup-panel">
        <div class="eyebrow">Browser softphone</div>
        <h1>Your desk phone,<br />without the desk.</h1>
        <p class="intro">Connect to your Wazo server and make extension or external calls directly from this browser.</p>

        <form id="login-form" autocomplete="on">
          <label>
            Wazo server
            <span class="input-wrap">${icon('server')}<input id="host" name="host" type="text" placeholder="pbx.example.com" autocomplete="url" required /></span>
          </label>
          <label>
            Username
            <span class="input-wrap">${icon('circle-user-round')}<input id="username" name="username" type="text" placeholder="web-user" autocomplete="username" required /></span>
          </label>
          <label>
            Password
            <span class="input-wrap">${icon('log-in')}<input id="password" name="password" type="password" placeholder="••••••••••••" autocomplete="current-password" required /></span>
          </label>
          <button id="connect-button" class="primary-button" type="submit">${icon('wifi')}<span>Connect phone</span></button>
        </form>

        <button id="disconnect-button" class="text-button" type="button" hidden>${icon('log-out')}<span>Disconnect securely</span></button>
        <p class="privacy-note">Credentials are used only for this session and are not saved by the app.</p>
      </aside>

      <section class="phone-panel">
        <div class="phone-card">
          <div class="call-display">
            <div id="call-icon" class="call-icon">${icon('phone-call', 28)}</div>
            <div id="call-kicker" class="call-kicker">Phone idle</div>
            <div id="dial-number" class="dial-number" aria-live="polite">—</div>
            <div id="call-status" class="call-status">Connect your Wazo account to start calling</div>
          </div>

          <div id="dialpad" class="dialpad" aria-label="Dial pad">
            ${[
              ['1', ''],
              ['2', 'ABC'],
              ['3', 'DEF'],
              ['4', 'GHI'],
              ['5', 'JKL'],
              ['6', 'MNO'],
              ['7', 'PQRS'],
              ['8', 'TUV'],
              ['9', 'WXYZ'],
              ['*', ''],
              ['0', '+'],
              ['#', ''],
            ].map(([digit, letters]) => `<button class="key" type="button" data-digit="${digit}"><strong>${digit}</strong><small>${letters}</small></button>`).join('')}
          </div>

          <div class="call-actions">
            <button id="clear-button" class="round-button secondary" type="button" aria-label="Clear number" title="Clear number">${icon('delete', 22)}</button>
            <button id="call-button" class="round-button call" type="button" aria-label="Call" title="Call" disabled>${icon('phone', 25)}</button>
            <button id="hold-button" class="round-button secondary" type="button" aria-label="Hold" title="Hold" disabled>${icon('pause', 22)}</button>
            <button id="mute-button" class="round-button secondary" type="button" aria-label="Mute" title="Mute" disabled>${icon('mic', 22)}</button>
          </div>
          <div id="incoming-actions" class="incoming-actions" hidden>
            <button id="reject-button" class="answer-button reject" type="button">${icon('phone-off')} Reject</button>
            <button id="answer-button" class="answer-button answer" type="button">${icon('phone-call')} Answer</button>
          </div>
        </div>
        <p class="secure-caption">${icon('wifi', 15)} Audio stays on your configured Wazo calling infrastructure.</p>
      </section>
    </div>
  </section>
`;

const elements = {
  form: document.querySelector('#login-form'),
  host: document.querySelector('#host'),
  username: document.querySelector('#username'),
  password: document.querySelector('#password'),
  connect: document.querySelector('#connect-button'),
  disconnect: document.querySelector('#disconnect-button'),
  connectionPill: document.querySelector('#connection-pill'),
  connectionLabel: document.querySelector('#connection-label'),
  callKicker: document.querySelector('#call-kicker'),
  dialNumber: document.querySelector('#dial-number'),
  callStatus: document.querySelector('#call-status'),
  callIcon: document.querySelector('#call-icon'),
  call: document.querySelector('#call-button'),
  clear: document.querySelector('#clear-button'),
  hold: document.querySelector('#hold-button'),
  mute: document.querySelector('#mute-button'),
  incomingActions: document.querySelector('#incoming-actions'),
  answer: document.querySelector('#answer-button'),
  reject: document.querySelector('#reject-button'),
};

const normalizeHost = value => value.trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');

const readableError = error => {
  if (!error) return 'Something went wrong.';
  if (error.status === 401) return 'Login rejected. Check your username and password.';
  if (error.name === 'NotAllowedError') return 'Microphone access was blocked by the browser.';
  return error.message || String(error);
};

function setStatus(message, mode = '') {
  state.status = message;
  elements.callStatus.textContent = message;
  elements.callStatus.className = `call-status ${mode}`;
}

function render() {
  const hasNumber = elements.dialNumber.textContent !== '—';
  elements.connectionPill.className = `status-pill ${state.connected ? 'online' : 'offline'}`;
  elements.connectionLabel.textContent = state.connecting ? 'Connecting' : state.connected ? 'Registered' : 'Offline';
  elements.connect.disabled = state.connecting;
  elements.connect.querySelector('span').textContent = state.connecting ? 'Connecting…' : 'Connect phone';
  elements.form.querySelectorAll('input').forEach(input => { input.disabled = state.connected || state.connecting; });
  elements.disconnect.hidden = !state.connected;
  elements.call.disabled = !state.connected || (!hasNumber && !state.call);
  elements.clear.disabled = !!state.call;
  elements.hold.disabled = !state.call || state.incoming;
  elements.hold.innerHTML = icon(state.held ? 'play' : 'pause', 22);
  elements.hold.classList.toggle('active', state.held);
  elements.hold.setAttribute('aria-label', state.held ? 'Resume' : 'Hold');
  elements.hold.title = state.held ? 'Resume' : 'Hold';
  elements.mute.disabled = !state.call;
  elements.mute.innerHTML = icon(state.muted ? 'mic-off' : 'mic', 22);
  elements.mute.classList.toggle('active', state.muted);
  elements.call.classList.toggle('hangup', !!state.call);
  elements.call.innerHTML = icon(state.call ? 'phone-off' : 'phone', 25);
  elements.call.setAttribute('aria-label', state.call ? 'Hang up' : 'Call');
  elements.call.title = state.call ? 'Hang up' : 'Call';
  elements.incomingActions.hidden = !state.incoming;
  createIcons({ icons, attrs: { 'stroke-width': 2 } });
}

function bindPhoneEvents() {
  const on = (event, handler) => Wazo.Phone.on(event, handler);

  on(Wazo.Phone.ON_REGISTERED, () => {
    state.connected = true;
    state.connecting = false;
    elements.callKicker.textContent = 'Phone ready';
    setStatus('Registered and ready to call', 'success');
    render();
  });

  on(Wazo.Phone.ON_CALL_OUTGOING, callSession => {
    state.call = callSession;
    state.incoming = false;
    elements.callKicker.textContent = 'Calling';
    setStatus('Waiting for the other side…');
    render();
  });

  on(Wazo.Phone.ON_CALL_INCOMING, callSession => {
    state.call = callSession;
    state.incoming = true;
    const caller = callSession?.number || callSession?.displayName || callSession?.getId?.() || 'Incoming call';
    elements.dialNumber.textContent = caller;
    elements.callKicker.textContent = 'Incoming call';
    setStatus('Answer or reject this call');
    render();
  });

  on(Wazo.Phone.ON_CALL_ACCEPTED, callSession => {
    state.call = callSession;
    state.incoming = false;
    state.held = false;
    elements.callKicker.textContent = 'Call connected';
    setStatus('Live call', 'success');
    render();
  });

  on(Wazo.Phone.ON_CALL_ENDED, endCall);
  on(Wazo.Phone.ON_CALL_CANCELED, endCall);
  on(Wazo.Phone.ON_CALL_REJECTED, endCall);
  on(Wazo.Phone.ON_CALL_FAILED, (_call, error) => endCall(error));
  on(Wazo.Phone.ON_CALL_HELD, () => {
    state.held = true;
    setStatus('Call on hold');
    render();
  });
  const resumeCall = () => {
    state.held = false;
    setStatus('Live call', 'success');
    render();
  };
  on(Wazo.Phone.ON_CALL_UNHELD, resumeCall);
  on(Wazo.Phone.ON_CALL_RESUMED, resumeCall);
  on(Wazo.Phone.ON_CALL_ERROR, error => setStatus(readableError(error), 'error'));
  on(Wazo.Phone.ON_AUDIO_STREAM, stream => {
    remoteAudio.srcObject = stream;
    remoteAudio.play().catch(() => setStatus('Click anywhere to allow call audio.', 'error'));
  });
}

function endCall(error) {
  state.call = null;
  state.incoming = false;
  state.muted = false;
  state.held = false;
  elements.callKicker.textContent = 'Phone ready';
  elements.dialNumber.textContent = '—';
  setStatus(error instanceof Error ? readableError(error) : 'Call ended');
  render();
}

elements.form.addEventListener('submit', async event => {
  event.preventDefault();
  state.connecting = true;
  setStatus('Signing in to Wazo…');
  render();

  try {
    const host = normalizeHost(elements.host.value);
    Wazo.Auth.init('wazo-browser-softphone', 3600, null, null, false);
    Wazo.Auth.setHost(host);
    const session = await Wazo.Auth.logIn(elements.username.value.trim(), elements.password.value);
    if (!session) throw new Error('Wazo did not return a valid session.');
    await Wazo.Phone.connect({ media: { audio: true, video: false } });
    await Wazo.Phone.phone.register();
    state.connected = true;
    state.connecting = false;
    elements.password.value = '';
    elements.callKicker.textContent = 'Phone ready';
    setStatus('Registered and ready to call', 'success');
  } catch (error) {
    state.connected = false;
    state.connecting = false;
    setStatus(readableError(error), 'error');
  }
  render();
});

document.querySelectorAll('[data-digit]').forEach(button => {
  button.addEventListener('click', () => {
    if (state.call) {
      Wazo.Phone.sendDTMF(button.dataset.digit, state.call);
      return;
    }
    const current = elements.dialNumber.textContent === '—' ? '' : elements.dialNumber.textContent;
    elements.dialNumber.textContent = `${current}${button.dataset.digit}`;
    elements.callKicker.textContent = 'Dialing';
    setStatus(state.connected ? 'Ready to call' : 'Connect first to place the call');
    render();
  });
});

elements.clear.addEventListener('click', () => {
  const current = elements.dialNumber.textContent;
  elements.dialNumber.textContent = current.length > 1 ? current.slice(0, -1) : '—';
  if (elements.dialNumber.textContent === '—') elements.callKicker.textContent = state.connected ? 'Phone ready' : 'Phone idle';
  render();
});

elements.call.addEventListener('click', async () => {
  try {
    if (state.call) {
      await Wazo.Phone.hangup(state.call);
      return;
    }
    const destination = elements.dialNumber.textContent;
    if (destination === '—') return;
    state.call = await Wazo.Phone.call(destination, false, null, true);
    elements.callKicker.textContent = 'Calling';
    setStatus(`Calling ${destination}…`);
  } catch (error) {
    state.call = null;
    setStatus(readableError(error), 'error');
  }
  render();
});

elements.mute.addEventListener('click', () => {
  if (!state.call) return;
  state.muted = !state.muted;
  if (state.muted) Wazo.Phone.mute(state.call);
  else Wazo.Phone.unmute(state.call);
  setStatus(state.muted ? 'Microphone muted' : 'Live call', state.muted ? '' : 'success');
  render();
});

elements.hold.addEventListener('click', async () => {
  if (!state.call || state.incoming) return;
  try {
    if (state.held) await Wazo.Phone.unhold(state.call);
    else await Wazo.Phone.hold(state.call);
  } catch (error) {
    setStatus(readableError(error), 'error');
  }
});

elements.answer.addEventListener('click', async () => {
  if (!state.call) return;
  try {
    await Wazo.Phone.accept(state.call, false);
    state.incoming = false;
  } catch (error) {
    setStatus(readableError(error), 'error');
  }
  render();
});

elements.reject.addEventListener('click', async () => {
  if (state.call) await Wazo.Phone.reject(state.call);
  endCall();
});

elements.disconnect.addEventListener('click', async () => {
  try {
    await Wazo.Phone.disconnect();
    await Wazo.Auth.logout();
  } finally {
    state.connected = false;
    state.connecting = false;
    state.call = null;
    state.incoming = false;
    state.muted = false;
    state.held = false;
    elements.callKicker.textContent = 'Phone idle';
    elements.dialNumber.textContent = '—';
    setStatus('Disconnected');
    render();
  }
});

bindPhoneEvents();
render();

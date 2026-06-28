const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { TextureSender, sendTextureFromPaintEvent } = require('@napolab/texture-bridge-core');

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const SENDER_NAME = 'LaserVJ';
const SHOW_PREVIEW = true;

let outWin = null;
let previewWin = null;
let sender = null;
let frames = 0;

function createOutput() {
  outWin = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: {
      offscreen: { useSharedTexture: true },
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  try {
    sender = new TextureSender(SENDER_NAME, WIDTH, HEIGHT);
    console.log('[spout] sender criado:', SENDER_NAME, `${WIDTH}x${HEIGHT}`);
  } catch (e) {
    console.error('[spout] FALHA ao criar o sender:', e);
  }

  outWin.webContents.on('paint', (event) => {
    const texture = event.texture;
    if (!texture) return;
    try {
      sendTextureFromPaintEvent(sender, texture.textureInfo);
      frames++;
    } catch (e) {
      console.error('[spout] erro no envio do frame:', e);
    } finally {
      texture.release();
    }
  });

  outWin.webContents.setFrameRate(FPS);
  outWin.webContents.on('did-finish-load', () => {
    console.log('[spout] sketch carregado (offscreen). Procure "' + SENDER_NAME + '" no Resolume.');
  });

  outWin.loadFile(path.join(__dirname, '..', 'index.html'), { search: 'role=output&clean=1' });

  setInterval(() => {
    console.log(`[spout] enviando ~${frames} fps`);
    frames = 0;
  }, 1000);
}

function createPreview() {
  previewWin = new BrowserWindow({
    width: 960,
    height: 600,
    title: 'Laser VJ — controle (espelha na saida Spout)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  previewWin.loadFile(path.join(__dirname, '..', 'index.html'), { search: 'role=controller' });
}

ipcMain.on('vj-params', (event, data) => {
  if (outWin && !outWin.isDestroyed()) outWin.webContents.send('vj-params', data);
});

app.whenReady().then(() => {
  // libera o acesso ao microfone/loopback (Electron bloqueia por padrao)
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(true));
  if (session.defaultSession.setPermissionCheckHandler) {
    session.defaultSession.setPermissionCheckHandler(() => true);
  }
  createOutput();
  if (SHOW_PREVIEW) createPreview();
});

app.on('window-all-closed', () => app.quit());

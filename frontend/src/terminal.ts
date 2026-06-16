import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { ZmodemHandler } from './zmodem-handler';
import '@xterm/xterm/css/xterm.css';

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  authMethod?: 'password' | 'publickey';
  privateKey?: string;
  turnstileToken?: string | null;
}

export const THEMES = {
  cyberpunk: {
    background: '#0a0a0a',
    foreground: '#4af626',
    cursor: '#14d1ff',
    cursorAccent: '#0a0a0a',
    selectionBackground: '#273747',
  },
  glacier: {
    background: '#0a192f',
    foreground: '#64ffda',
    cursor: '#e6f1ff',
    cursorAccent: '#0a192f',
    selectionBackground: '#112240',
  },
  gruvbox: {
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#d3869b',
    cursorAccent: '#282828',
    selectionBackground: '#504945',
  }
};

export class SSHTerminal {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private webglAddon!: WebglAddon;
  private ws: WebSocket | null = null;
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;

    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      theme: THEMES.cyberpunk,
      allowProposedApi: true,
      scrollback: 10000,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());

    window.addEventListener('resize', () => this.fit());

    // Right-click paste support
    this.container.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (text && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(text);
        }
      } catch (err) {
        console.error('Failed to read clipboard', err);
      }
    });
  }

  setTheme(themeName: keyof typeof THEMES): void {
    this.terminal.options.theme = THEMES[themeName];
  }

  mount(): void {
    this.terminal.open(this.container);
    
    // Load WebGL addon after terminal is opened
    try {
      this.webglAddon = new WebglAddon();
      this.webglAddon.onContextLoss(e => {
        console.warn('WebGL context lost', e);
        this.webglAddon.dispose();
      });
      this.terminal.loadAddon(this.webglAddon);
    } catch (e) {
      console.warn('WebGL addon failed to load, falling back to canvas/dom', e);
    }

    this.fit();

    this.terminal.writeln('\x1b[1;33m╔══════════════════════════════════╗\x1b[0m');
    this.terminal.writeln('\x1b[1;33m║      Connecting to CloudSSH      ║\x1b[0m');
    this.terminal.writeln('\x1b[1;33m╚══════════════════════════════════╝\x1b[0m');
    this.terminal.writeln('');
  }

  async connect(config: SSHConnectionConfig): Promise<void> {
    const wsUrl = new URL(window.location.href);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.pathname = '/api/ssh';

    // Add Turnstile token if provided
    if (config.turnstileToken) {
      wsUrl.searchParams.set('turnstile_token', config.turnstileToken);
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        this.terminal.writeln('\x1b[32m[+] WebSocket connected, sending credentials...\x1b[0m');
        this.ws?.send(JSON.stringify({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          authMethod: config.authMethod,
          privateKey: config.privateKey,
        }));
        
        resolve();
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.terminal.writeln('\x1b[31m[-] 连接已关闭\x1b[0m');
        document.getElementById('status-text')!.innerHTML = '<span class="w-2 h-2 bg-[#353534] inline-block"></span> STATUS: OFFLINE';
      };

      // Zmodem support
      const zmodemHandler = new ZmodemHandler(
        (data) => this.terminal.write(data),
        (data) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(data);
          }
        }
      );

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case 'status':
                this.terminal.writeln(`\x1b[32m[*] ${msg.message}\x1b[0m`);
                if (msg.message === '认证成功') {
                  document.getElementById('status-text')!.innerHTML = '<span class="w-2 h-2 bg-[#4af626] inline-block animate-pulse"></span> STATUS: ONLINE';
                }
                break;
              case 'error':
                this.terminal.writeln(`\x1b[31m[!] ${msg.message}\x1b[0m`);
                break;
            }
          } catch {
            this.terminal.write(event.data);
          }
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            zmodemHandler.consume(reader.result as ArrayBuffer);
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.terminal.writeln(
          `\x1b[33m[*] Connection closed (code=${event.code})\x1b[0m`
        );
        document.getElementById('term-status')!.innerHTML = '<div class="w-2 h-2 bg-red-500"></div> Disconnected';
      };

      this.ws.onerror = () => {
        this.terminal.writeln('\x1b[31m[!] Connection error\x1b[0m');
        reject(new Error('WebSocket connection failed'));
      };

      this.terminal.onData((data) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(data);
        }
      });

      this.terminal.onResize(({ cols, rows }) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'resize',
            cols,
            rows,
          }));
        }
      });
    });
  }

  fit(): void {
    this.fitAddon.fit();
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  dispose(): void {
    this.disconnect();
    this.terminal.dispose();
  }
}

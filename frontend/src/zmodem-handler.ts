// @ts-ignore
import * as Zmodem from 'zmodem.js/src/zmodem_browser';

export class ZmodemHandler {
  private sentry: any;
  private session: any | null = null;
  private onTerminalWrite: (data: Uint8Array) => void;
  private onWsSend: (data: Uint8Array) => void;

  constructor(
    onTerminalWrite: (data: Uint8Array) => void,
    onWsSend: (data: Uint8Array) => void
  ) {
    this.onTerminalWrite = onTerminalWrite;
    this.onWsSend = onWsSend;
    this.init();
  }

  private init() {
    this.sentry = new Zmodem.Sentry({
      to_terminal: (octets: Array<number>) => {
        this.onTerminalWrite(new Uint8Array(octets));
      },
      sender: (octets: Array<number>) => {
        this.onWsSend(new Uint8Array(octets));
      },
      on_detect: (detection: any) => {
        const zsession = detection.confirm();
        this.session = zsession;
        
        if (zsession.type === 'receive') {
          this.handleReceive(zsession);
        } else {
          this.handleSend(zsession);
        }
      },
      on_retract: () => {
        this.session = null;
      }
    });
  }

  public consume(data: ArrayBuffer) {
    this.sentry.consume(data);
  }

  private handleReceive(zsession: any) {
    zsession.on('offer', (xfer: any) => {
      const name = xfer.get_details().name;
      const size = xfer.get_details().size;
      
      const accept = confirm("接受来自服务器的文件下载?\n" + name + " (" + size + " bytes)");
      if (!accept) {
        xfer.skip();
        return;
      }

      const packets: Uint8Array[] = [];
      xfer.on('input', (payload: number[]) => {
        packets.push(new Uint8Array(payload));
      });

      xfer.accept().then(() => {
        Zmodem.Browser.save_to_disk(packets, name);
      });
    });

    zsession.start();
  }

  private handleSend(zsession: any) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        Zmodem.Browser.send_files(zsession, files, {
          on_offer_response: (file: any, xfer: any) => {
            if (!xfer) console.warn('Server rejected file:', file.name);
          },
          on_progress: (file: any, xfer: any, chunk: any) => {
            // Can implement progress bar here
          },
          on_file_complete: (file: any) => {
            console.log('Finished uploading:', file.name);
          }
        }).then(() => {
          zsession.close();
          input.remove();
        });
      } else {
        zsession.close();
        input.remove();
      }
    };

    // Handle cancel (focus returns without file selection)
    const onFocusBack = () => {
      setTimeout(() => {
        if (input.files?.length === 0) {
          zsession.close();
          input.remove();
        }
      }, 1000);
      window.removeEventListener('focus', onFocusBack);
    };
    window.addEventListener('focus', onFocusBack);

    document.body.appendChild(input);
    input.click();
  }
}

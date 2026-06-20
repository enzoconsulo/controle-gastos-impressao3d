import http.server
import socketserver
import sys
import webbrowser
import threading
import time

# Porta padrão do servidor
DEFAULT_PORT = 8080

class DevHTTPServer(http.server.SimpleHTTPRequestHandler):
    """
    Servidor customizado para desenvolvimento.
    O principal objetivo desta classe é injetar cabeçalhos Anti-Cache
    para que as mudanças no CSS e JS sejam refletidas instantaneamente.
    """
    def end_headers(self):
        # Desativa o cache do navegador completamente
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        
        # Garante o charset correto
        if not self.guess_type(self.path).startswith('text/'):
            self.send_header("Access-Control-Allow-Origin", "*")
            
        super().end_headers()

    def log_message(self, format, *args):
        # Um log mais limpo no terminal (opcional)
        sys.stdout.write(f"[{self.log_date_time_string()}] {args[0]}\n")

def start_server(port):
    Handler = DevHTTPServer
    
    # Permite reutilizar a porta imediatamente caso o servidor seja reiniciado
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print("="*60)
            print(f"🚀 GESTOR 3D - SERVIDOR DE DESENVOLVIMENTO")
            print("="*60)
            print(f"🔗 URL Local: http://localhost:{port}")
            print(f"🛑 Para encerrar o servidor, pressione [Ctrl + C]")
            print("="*60)
            
            # Abre o navegador automaticamente
            threading.Thread(target=lambda: (time.sleep(0.5), webbrowser.open(f"http://localhost:{port}"))).start()
            
            # Roda o servidor infinitamente
            httpd.serve_forever()
            
    except OSError as e:
        if e.errno == 98 or e.errno == 10048:
            print(f"⚠️  A porta {port} já está em uso.")
            print(f"🔄 Tentando abrir na porta {port + 1}...")
            start_server(port + 1)
        else:
            raise e
    except KeyboardInterrupt:
        print("\n👋 Servidor encerrado com sucesso!")
        sys.exit(0)

if __name__ == "__main__":
    # Permite passar a porta via linha de comando: python server.py 9000
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    start_server(port)
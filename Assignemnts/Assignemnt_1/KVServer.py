import socket
import threading

# --- Data Storage ---
# Structure: { 'client_ip': { 'key': 'value' } }
DATA_STORE = {}
# Lock to ensure thread safety when modifying the global store
store_lock = threading.Lock()

def get_client_store(client_ip):
    """Retrieve or create the dictionary for a specific IP."""
    with store_lock:
        if client_ip not in DATA_STORE:
            DATA_STORE[client_ip] = {}
        return DATA_STORE[client_ip]

def handle_client(conn, addr):
    client_ip = addr[0]
    role = "guest"  # Default role
    
    print(f"New connection from {client_ip}")

    # Use a file-like object for easy line-by-line reading
    # 'r' = read mode, encoding handles string conversion
    input_stream = conn.makefile('r')

    try:
        # Loop to keep reading commands until client disconnects
        for line in input_stream:
            parts = line.strip().split()
            if not parts:
                continue

            command = parts[0].lower()

            if command == "put":
                if len(parts) >= 3:
                    key = parts[1]
                    value = parts[2]
                    
                    # Store in the client's specific dictionary
                    my_store = get_client_store(client_ip)
                    my_store[key] = value
                    
                    conn.sendall(b"OK\n")
                else:
                    conn.sendall(b"ERROR: Invalid PUT format\n")

            elif command == "get":
                if len(parts) >= 2:
                    key = parts[1]
                    
                    # Authorization Logic for Manager accessing others
                    # Syntax: get ip:key (Manager) or get key (Self)
                    if ":" in key and role == "manager":
                        target_ip, target_key = key.split(":", 1)
                        # Access global store with lock
                        with store_lock:
                            target_store = DATA_STORE.get(target_ip, {})
                            val = target_store.get(target_key)
                    else:
                        # Access own store
                        my_store = get_client_store(client_ip)
                        val = my_store.get(key)
                    
                    response = val if val else "<blank>"
                    conn.sendall(f"{response}\n".encode())
                else:
                    conn.sendall(b"ERROR: Invalid GET format\n")

            elif command == "auth":
                if len(parts) >= 2 and parts[1] == "admin123":
                    role = "manager"
                    conn.sendall(b"ROLE_UPDATED: You are now a Manager\n")
                else:
                    conn.sendall(b"AUTH_FAILED\n")

            else:
                conn.sendall(b"UNKNOWN_COMMAND\n")

    except Exception as e:
        print(f"Error handling client {client_ip}: {e}")
    finally:
        conn.close()

def start_server(host='0.0.0.0', port=4000):
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Allow port reuse to avoid "Address already in use" errors on restart
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server_socket.bind((host, port))
        server_socket.listen(10) # Backlog of 10 connections
        print(f"Server started on port {port}...")
        print("Admin password is 'admin123'")
        
        while True:
            conn, addr = server_socket.accept()
            # Create a new thread for every connected client
            thread = threading.Thread(target=handle_client, args=(conn, addr))
            thread.daemon = True # Daemon threads close when main program closes
            thread.start()
            
    except KeyboardInterrupt:
        print("\nServer stopping...")
    finally:
        server_socket.close()

if __name__ == "__main__":
    start_server()
    
# python KVServer.py
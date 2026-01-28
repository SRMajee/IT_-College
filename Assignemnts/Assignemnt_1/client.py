import sys
import socket


def main():
    if len(sys.argv) < 3:
        print("Usage: ./client <hostname> <port> <commands...>")
        print("Example: python client.py localhost 5555 put city Kolkata get city")
        return

    hostname = sys.argv[1]
    port = int(sys.argv[2])

    try:
        # Create a socket connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((hostname, port))

        # Use file-like object for reading responses line-by-line
        server_reader = sock.makefile("r")

        # Start parsing arguments from index 3 (after script, host, port)
        i = 3
        args = sys.argv

        while i < len(args):
            cmd = args[i]

            if cmd.lower() == "put":
                if i + 2 < len(args):
                    key = args[i + 1]
                    val = args[i + 2]

                    # Send command (must end with newline for server readline)
                    msg = f"put {key} {val}\n"
                    sock.sendall(msg.encode())

                    # Read response (Consume the "OK")
                    server_reader.readline()

                    i += 3  # Skip put, key, value
                else:
                    print("Invalid PUT arguments", file=sys.stderr)
                    break

            elif cmd.lower() == "get":
                if i + 1 < len(args):
                    key = args[i + 1]

                    # Send command
                    msg = f"get {key}\n"
                    sock.sendall(msg.encode())

                    # Read response and strip the trailing newline
                    response = server_reader.readline().strip()
                    print(response)

                    i += 2  # Skip get, key
                else:
                    print("Invalid GET arguments", file=sys.stderr)
                    break

            elif cmd.lower() == "auth":
                if i + 1 < len(args):
                    msg = f"auth {args[i + 1]}\n"
                    sock.sendall(msg.encode())

                    response = server_reader.readline().strip()
                    print(response)
                    i += 2
            else:
                # If command is unknown or just a stray argument, skip it
                i += 1

        sock.close()

    except ConnectionRefusedError:
        print(f"Error: Could not connect to server at {hostname}:{port}")
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    main()

# python client.py localhost 5555 put city Kolkata put country India get country get city get Institute
# python client.py localhost 5555 put secret HiddenTreasure
# python client.py localhost 5555 auth admin123 get 127.0.0.1:secret

extends Control

# Implements encrypted communication with trimsock, by levaraging TLS over a TCP
# connection
#
# This example acts as a client. It can connect to any server over TLS,
# including the bun-tls example in trimsock.js


@onready var logs_label := %Logs as Label

var reactor: TrimsockTLSClientReactor


func _ready():
	var host := "localhost"
	var port := 8893

	_log("Connecting to %s:%d" % [host, port])
	var stream := StreamPeerTCP.new()
	stream.connect_to_host(host, port)
	while true:
		stream.poll()
		if stream.get_status() != StreamPeerTCP.STATUS_CONNECTING:
			break
		await get_tree().process_frame
	
	if stream.get_status() != StreamPeerTCP.STATUS_CONNECTED:
		_log("Connection failed!")
		return
	else:
		_log("Success!")
	stream.set_no_delay(true)
	
	_log("Attaching TLS stream")
	var peer := StreamPeerTLS.new()
	# Note: NEVER use `TLSOptions.client_unsafe()` in production, this is for 
	# TESTING ONLY
	var err := peer.connect_to_stream(stream, "foxssake.studio", TLSOptions.client_unsafe())
	if err != OK:
		_log("TLS failed: %s" % error_string(err))
	else:
		_log("Success!")
		
	_log("Awaiting handshake")
	while peer.get_status() == StreamPeerTLS.STATUS_HANDSHAKING:
		peer.poll()
		await get_tree().process_frame

	if peer.get_status() != StreamPeerTLS.STATUS_CONNECTED:
		_log("Fail! %d" % [peer.get_status()])
		return

	reactor = TrimsockTLSClientReactor.new(peer)
	var number := randi_range(1000, 9999)
	var xchg := reactor.submit_request(TrimsockCommand.request("echo").with_params([str(number)]))
	_log("Sent number %d" % [number])
	
	_log("Waiting for response...")
	var response := await xchg.read()

	_log("Response: %s" % [response.text])

func _physics_process(_dt):
	if reactor:
		reactor.poll()

func _log(text: String):
	logs_label.text += text + "\n"

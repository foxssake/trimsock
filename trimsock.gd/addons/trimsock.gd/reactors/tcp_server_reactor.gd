extends TrimsockReactor
class_name TrimsockTCPServerReactor

var _server: TCPServer
var _streams: Array[StreamPeerTCP] = []

func _init(server: TCPServer):
	_server = server
	
	# TODO: Track sources in Reactor
	on_attach.connect(func(src): _streams.append(src))
	on_detach.connect(func(src): _streams.erase(src))

func _poll() -> void:
	# Handle incoming connections
	while _server.is_connection_available():
		attach(_server.take_connection())

	# Poll each connection
	for stream in _streams:
		# Update status
		stream.poll()

		# Detach closed connections
		# Don't process any further data from them if we can't reply
		var status := stream.get_status()
		if status == StreamPeerTCP.STATUS_NONE or status == StreamPeerTCP.STATUS_ERROR:
			detach(stream)
			continue

		# Grab available data
		var available := stream.get_available_bytes()
		var res := stream.get_partial_data(available)
		if res[0] == OK:
			_ingest(stream, res[1])

func _write(target: Variant, command: TrimsockCommand) -> void:
	assert(target is StreamPeerTCP, "Invalid target!")
	var peer := target as StreamPeerTCP
	command.serialize_to_stream(peer)

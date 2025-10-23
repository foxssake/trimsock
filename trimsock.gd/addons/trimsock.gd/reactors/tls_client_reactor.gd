extends TrimsockReactor
class_name TrimsockTLSClientReactor

var _connection: StreamPeerTLS


func _init(connection: StreamPeerTLS):
	_connection = connection
	attach(_connection)

func submit(command: TrimsockCommand) -> TrimsockExchange:
	return send(_connection, command)

func submit_request(command: TrimsockCommand) -> TrimsockExchange:
	return request(_connection, command)

func submit_stream(command: TrimsockCommand) -> TrimsockExchange:
	return stream(_connection, command)

func _poll() -> void:
	_connection.poll()

	if _connection.get_status() != StreamPeerTLS.STATUS_CONNECTED:
		# Can't read
		return

	# Grab available data
	var available := _connection.get_available_bytes()
	var res := _connection.get_partial_data(available)
	if res[0] == OK:
		_ingest(_connection, res[1])

func _write(target: Variant, command: TrimsockCommand) -> void:
	assert(target is StreamPeerTLS, "Invalid target!")
	var peer := target as StreamPeerTLS
	command.serialize_to_stream(peer)

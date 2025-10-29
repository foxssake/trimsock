extends TrimsockClientReactor
class_name TrimsockTCPClientReactor

## Client reactor communicating over TCP via [StreamPeerTCP]
##
## When creating a new instance, a [StreamPeerTCP] must be specified. This will
## be used as the host source, and will be polled every time when [method poll]
## is called.
## [br][br]
## See [TrimsockClientReactor] and [TrimsockReactor] for details.


var _connection: StreamPeerTCP


func _init(connection: StreamPeerTCP):
	_connection = connection
	attach(_connection)

func _poll() -> void:
	_connection.poll()

	if _connection.get_status() != StreamPeerTCP.STATUS_CONNECTED:
		# Can't read
		return

	# Grab available data
	var available := _connection.get_available_bytes()
	var res := _connection.get_partial_data(available)
	if res[0] == OK:
		_ingest(_connection, res[1])

func _write(target: Variant, command: TrimsockCommand) -> void:
	assert(target is StreamPeerTCP, "Invalid target!")
	var peer := target as StreamPeerTCP
	command.serialize_to_stream(peer)

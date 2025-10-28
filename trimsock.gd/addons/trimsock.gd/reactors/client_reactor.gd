extends TrimsockReactor
class_name TrimsockClientReactor


func submit(command: TrimsockCommand) -> TrimsockExchange:
	return send(_get_host(), command)

func submit_request(command: TrimsockCommand) -> TrimsockExchange:
	return request(_get_host(), command)

func submit_stream(command: TrimsockCommand) -> TrimsockExchange:
	return stream(_get_host(), command)

func _get_host():
	assert(not _sources.is_empty(), "Client is not connected to any target!")
	return _sources.front()

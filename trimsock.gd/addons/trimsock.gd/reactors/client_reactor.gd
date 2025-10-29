extends TrimsockReactor
class_name TrimsockClientReactor

## A reactor that is connected to a single host source
##
## The client reactor implements convenience methods to send commands to a
## single host source.
## [br][br]
## By default, [TrimsockReactor] assumes that it may send commands to multiple
## sources. This can be cumbersome for implementing clients, where the reactor
## communicates with a single source.


## Submit a command to host
## [br][br]
## See also: [method send]
func submit(command: TrimsockCommand) -> TrimsockExchange:
	return send(_get_host(), command)

## Submit a request to host
## [br][br]
## See also: [method request]
func submit_request(command: TrimsockCommand) -> TrimsockExchange:
	return request(_get_host(), command)

## Submit a stream to host
## [br][br]
## See also: [method stream]
func submit_stream(command: TrimsockCommand) -> TrimsockExchange:
	return stream(_get_host(), command)

func _get_host():
	assert(not _sources.is_empty(), "Client is not connected to any target!")
	return _sources.front()

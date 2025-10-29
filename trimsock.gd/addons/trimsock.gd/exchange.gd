extends RefCounted
class_name TrimsockExchange

## Represents an exchange of commands, similar to a thread on forum
##
## Whenever a command is received by the [TrimsockReactor], it either creates
## a new exchange for it, or associates it to an already running exchange.
## [br][br]
## Exchanges are then used to send and receive data belonging to the same thread
## of commands.
## [br][br]
## Exchanges keep track of who sent the initial command, and may associate
## arbitrary data with the given sender's session using [method get_session] and
## [method set_session].
## [br][br]
## Once an exchange sends or receives a message that concludes it ( e.g. an
## error response ), the exchange becomes closed. Once an exchange is closed,
## it won't send any further commands.


var _source: Variant
var _reactor: TrimsockReactor
var _command: TrimsockCommand

var _is_open: bool = true
var _queue: Array[TrimsockCommand] = []


signal _on_command(command: TrimsockCommand)


func _init(command: TrimsockCommand, source: Variant, reactor: TrimsockReactor):
	_command = command
	_source = source
	_reactor = reactor

#region Properties
## Get the exchange's initiator
func source() -> Variant:
	return _source

## Get the exchange's ID
func id() -> String:
	return _command.exchange_id

## Get the session data associated with the exchange
func session() -> Variant:
	return _reactor.get_session(_source)

## Set the session data associated with the exchange
func set_session(data: Variant) -> void:
	_reactor.set_session(_source, data)

## Return true if the exchange has not been closed yet
func is_open() -> bool:
	return _is_open

## Return true if the exchange can be replied to ( regardless if it's open )
func can_reply() -> bool:
	return _command.type != TrimsockCommand.Type.SIMPLE

## Close exchange, preventing it from sending further data
## [br][br]
## Note that the exchange is closed automatically when sending a closing
## command.
func close() -> void:
	_is_open = false
#endregion

#region Write
## Send a command over the exchange
## [br][br]
## Returns true if the command was sent.
func send(command: TrimsockCommand) -> bool:
	if not is_open():
		return false

	_reactor._write(_source, command)
	return true

## Send a command over the exchange and close it
## [br][br]
## Returns true if the command was sent.
func send_and_close(command: TrimsockCommand) -> bool:
	if not send(command):
		return false

	close()
	return true

## Send a reply over the exchange
## [br][br]
## The command will be changed if it's not a success response already.
## Returns true if the command was sent.
func reply(command: TrimsockCommand) -> bool:
	if not can_reply() or not is_open():
		return false

	command.as_success_response()
	command.name = ""
	command.exchange_id = id()

	send(command)
	close()
	return true

## Send an error response over the exchange
## [br][br]
## The command will be changed if it's not an error response already.
## Returns true if the command was sent.
func fail(command: TrimsockCommand) -> bool:
	if not can_reply() or not is_open():
		return false

	command.as_error_response()
	command.name = ""
	command.exchange_id = id()

	send(command)
	close()
	return true

## Send a stream command over the exchange
## [br][br]
## The command will be changed if it's not a stream command already.
## Returns true if the command was sent.
func stream(command: TrimsockCommand) -> bool:
	if not can_reply() or not is_open():
		return false

	command.as_stream()
	command.name = ""
	command.exchange_id = id()

	send(command)
	return true

## Send a stream finish command over the exchange
## [br][br]
## The command will be changed if it's not a stream finish command already.
## Returns true if the command was sent.
func stream_finish(command: TrimsockCommand) -> bool:
	if not can_reply() or not is_open():
		return false

	command.clear()
	command.as_stream()
	command.name = ""
	command.exchange_id = id()

	send(command)
	close()
	return true

## Send a reply or a simple command over the exchange
## [br][br]
## If the original command had an exchange ID, a success response will be sent.
## Otherwise, this method will fall back to a simple command.
## Returns true if the command was sent.
func reply_or_send(command: TrimsockCommand) -> bool:
	if not is_open():
		return false

	if not reply(command):
		send_and_close(command)

	return true

## Send an error response or a simple command over the exchange
## [br][br]
## If the original command had an exchange ID, an error response will be sent.
## Otherwise, this method will fall back to a simple command.
## Returns true if the command was sent.
func fail_or_send(command: TrimsockCommand) -> bool:
	if not is_open():
		return false

	if not fail(command):
		send_and_close(command)

	return true
#endregion

#region Read
## Push an incoming command into the exchange
## [br][br]
## This is called by [TrimsockReactor] when it receives a command that belongs
## to this exchange.
func push(command: TrimsockCommand) -> void:
	match command.type:
		TrimsockCommand.Type.SUCCESS_RESPONSE,\
		TrimsockCommand.Type.ERROR_RESPONSE,\
		TrimsockCommand.Type.STREAM_FINISH:
			close()

	_queue.append(command)
	_on_command.emit(command)

## Get the next incoming command
## [br][br]
## Commands are queued when received. If there's already a command in the queue,
## it will be returned instantly. Otherwise, this method will wait for the next
## incoming command.
func read() -> TrimsockCommand:
	while _queue.is_empty():
		await _on_command
	return _queue.pop_front()
#endregion

extends RefCounted
class_name TrimsockReactor

## Manages incoming and outgoing commands for multiple sources
##
## The reactor reads and ingests all incoming data during [method poll]. Once
## that's done, it parses incoming commands and delegates them to the
## appropriate command handler. These command handlers can be configured by
## calling [method on]. If there is no handler associated, the unknown command
## handler will be called, which can be configured using [method on_unknown].
## [br][br]
## Note that every piece of incoming data belongs to a source. The reactor can
## be notified of a source being added or removed by calling [method attach] and
## [method detach]. While implementations in general do not require this, it is
## good practice.
## [br][br]
## The reactor can also be used to associate arbitrary session data to sources,
## by calling [method set_session]. Session data can be any value, and its
## meaning is entirely up to the user.
## [br][br]
## This base class by itself does not implement any kind of communication. That
## responsibility is up to individual implementations. To build a custom
## reactor, implement [method _poll] to grab and pass incoming data to [method 
## _ingest], and [method _write] to send outgoing data.


var _sources: Array = []
var _sessions: Dictionary = {} # source to session data
var _readers: Dictionary = {} # source to reader
var _handlers: Dictionary = {} # command name to handler method
var _exchanges: Array[TrimsockExchange] = []
var _unknown_handler: Callable = func(_cmd, _xchg): pass
var _id_generator: TrimsockIDGenerator = RandomTrimsockIDGenerator.new(12)


## Emitted when a new source is attached to the reactor
signal on_attach(source: Variant)
## Emitted when a known source is detached from the reactor
signal on_detach(source: Variant)


## Poll all sources and process incoming data
func poll() -> void:
	_poll()

	for source in _sources:
		var reader := _readers[source] as TrimsockReader
		while true:
			var command := reader.read()
			if not command:
				break

			_handle(command, source)

## Send a command to the [param target] source
## [br][br]
## The returned exchange can be used for further commands.
func send(target: Variant, command: TrimsockCommand) -> TrimsockExchange:
	# Send command
	_write(target, command)

	# Ensure exchange
	var xchg := _get_exchange_for(command, target)
	if xchg == null:
		xchg = _make_exchange_for(command, target)

	return xchg

## Send a request command to the [param target] source
## [br][br]
## The returned exchange can be used for further commands. The [param command]
## will be modified if it's not a request already.
func request(target: Variant, command: TrimsockCommand) ->  TrimsockExchange:
	command.as_request()
	if not command.exchange_id:
		command.exchange_id = _id_generator.get_id()
	return send(target, command)

## Send a stream command to the [param target] source
## [br][br]
## The returned exchange can be used for further commands. The [param command]
## will be modified if it's not a stream already.
func stream(target: Variant, command: TrimsockCommand) ->  TrimsockExchange:
	command.as_stream()
	if not command.exchange_id:
		command.exchange_id = _id_generator.get_id()
	return send(target, command)

## Attach a source to the reactor
## [br][br]
## This explicitly notifies the reactor of the new source. While not required,
## this can enable specific implementations to optimize. If the source is
## already attached, nothing happens.
func attach(source: Variant) -> void:
	if _sources.has(source):
		return

	_sources.append(source)
	_readers[source] = TrimsockReader.new()
	on_attach.emit(source)

## Detach a source to the reactor
## [br][br]
## This explicitly notifies the reactor of the source being freed. While not
## required, this can enable specific implementations to optimize, e.g. by
## freeing some resources. If the source is already detached, nothing happens.
func detach(source: Variant) -> void:
	if not _sources.has(source):
		return

	_sources.erase(source)
	_sessions.erase(source)
	_readers.erase(source)
	on_detach.emit(source)

## Set session data associated to a source
func set_session(source: Variant, data: Variant) -> void:
	_sessions[source] = data

## Get session data associated to a source
func get_session(source: Variant) -> Variant:
	return _sessions.get(source)

## Set the ID generator used to generate exchange IDs
func set_id_generator(id_generator: TrimsockIDGenerator) -> void:
	_id_generator = id_generator

## Register a command handler
## [br][br]
## The [param handler] must accept a command and an exchange. Coroutines are
## supported. If a handler is already registered for the command, it will be
## replaced.
func on(command_name: String, handler: Callable) -> TrimsockReactor:
	_handlers[command_name] = handler
	return self

## Register the unknown command handler
## [br][br]
## The [param handler] must accept a command and an exchange. Coroutines are
## supported. If an unknown command handler is already registered, it will be
## replaced.
func on_unknown(handler: Callable) -> TrimsockReactor:
	_unknown_handler = handler
	return self


# Grab incoming data, call `_ingest()`
func _poll() -> void:
	pass

# Send command to target
func _write(target: Variant, command: TrimsockCommand) -> void:
	pass

func _ingest(source: Variant, data: PackedByteArray) -> Error:
	assert(_readers.has(source), "Ingesting data from unknown source! Did you call `attach()`?")
	var reader := _readers[source] as TrimsockReader
	return reader.ingest_bytes(data)

func _handle(command: TrimsockCommand, source: Variant) -> void:
	var xchg := _get_exchange_for(command, source)
	if xchg != null:
		# Known exchange, handle it there
		xchg.push(command)
	else:
		# New exchange, create instance and pass to handler
		xchg = _make_exchange_for(command, source)
		var handler := (_handlers.get(command.name) if _handlers.has(command.name) else _unknown_handler) as Callable

		var result := await handler.call(command, xchg)
		if xchg.is_open() and result is TrimsockCommand:
			xchg.send_and_close(result)

		# Free exchange if needed
		if not xchg.is_open():
			_exchanges.erase(xchg)

func _get_exchange_for(command: TrimsockCommand, source: Variant) -> TrimsockExchange:
	if not command.is_simple():
		# Try and find known exchange
		for xchg in _exchanges:
			if xchg.id() == command.exchange_id and xchg._source == source:
				return xchg

	# Command has no ID, or ID not found
	return null

func _make_exchange_for(command: TrimsockCommand, source: Variant) -> TrimsockExchange:
	var xchg := TrimsockExchange.new(command, source, self)
	if not command.is_simple():
		_exchanges.append(xchg)
	return xchg

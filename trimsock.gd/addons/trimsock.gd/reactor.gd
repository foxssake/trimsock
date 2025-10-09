extends RefCounted
class_name TrimsockReactor

var _sources: Array = []
var _readers: Dictionary = {} # source to reader
var _handlers: Dictionary = {} # command name to handler method
var _unknown_handler: Callable = func(_cmd): pass


signal on_attach(source: Variant)
signal on_detach(source: Variant)


func poll() -> void:
	_poll()

	for r in _readers.values():
		var reader := r as TrimsockReader
		while true:
			var command := reader.read()
			if not command:
				break

			_handle(command)

func send(target: Variant, command: TrimsockCommand) -> void:
	_write(target, command)

func attach(source: Variant) -> void:
	if _sources.has(source):
		return

	_sources.append(source)
	_readers[source] = TrimsockReader.new()
	on_attach.emit(source)

func detach(source: Variant) -> void:
	if not _sources.has(source):
		return

	_sources.erase(source)
	_readers.erase(source)
	on_detach.emit(source)

func on(command_name: String, handler: Callable) -> TrimsockReactor:
	_handlers[command_name] = handler
	return self

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

func _handle(command: TrimsockCommand) -> void:
	if _handlers.has(command.name):
		var handler := _handlers[command.name] as Callable
		handler.call(command)
	else:
		_unknown_handler.call(command)


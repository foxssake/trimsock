extends RefCounted
class_name TrimsockReader

## Ingests and parses incoming trimsock data
##
## As data arrives from a stream, call [method ingest_test] or
## [method ingest_bytes] to prepare the data for parsing. Internally, the data
## will be buffered.
## [br][br]
## After ingestion, call [method read] to extract commands from the ingested
## data. Data that is parsed is immediately freed from the internal buffer.
## [br][br]
## If the incoming data is malformed, it is discarded and the error is reported
## in the returned [TrimsockResult]. The reader continues parsing with the data
## following the offending command.


## Upper limit on the internal buffer's size
##
## Ingested data is buffered until [method read] can extract a full command
## from it. If this size limit is exceeded, the buffer's contents are discarded
## and [constant ERR_OUT_OF_MEMORY] is reported.
var max_size: int:
	get:
		return _line_reader.max_size
	set(value):
		_line_reader.max_size = value

var _line_reader: _TrimsockLineReader = _TrimsockLineReader.new()
var _line_parser: _TrimsockLineParser = _TrimsockLineParser.new()
var _queued_raw: TrimsockCommand = null
var _queued_raw_size := -1

## Ingest incoming text
## [br][br]
## Returns a successful result, or an error result with
## [constant ERR_OUT_OF_MEMORY] if the internal buffer can't store the data.
func ingest_text(text: String) -> TrimsockResult:
	return ingest_bytes(text.to_utf8_buffer())

## Ingest incoming binary data
## [br][br]
## Returns a successful result, or an error result with
## [constant ERR_OUT_OF_MEMORY] if the internal buffer can't store the data.
func ingest_bytes(bytes: PackedByteArray) -> TrimsockResult:
	var error := _line_reader.ingest(bytes)
	if error != OK:
		_dequeue_raw()
		return TrimsockResult.failure(error,
			"Buffer overflow! Can't ingest %d bytes without exceeding %d!" \
			% [bytes.size(), max_size])

	return TrimsockResult.success()

## Try and extract a command from the ingested data
## [br][br]
## Returns a result holding the parsed command, or a successful result without
## a command if none is available yet. Malformed data is rejected by returning
## an error result.
func read() -> TrimsockResult.Command:
	var result := _pop()
	var command := result.value()
	if command:
		_TrimsockConventions.apply(command)
	return result

func _pop() -> TrimsockResult.Command:
	# We read a raw command earlier, waiting to have enough data
	if _queued_raw:
		if not _line_reader.has_data(_queued_raw_size):
			return TrimsockResult.Command.of_success()

		var raw_command := _queued_raw
		var read_result := _line_reader.read_data(_queued_raw_size)

		_dequeue_raw()

		if not read_result.is_success():
			var error := read_result.error()
			return TrimsockResult.Command.of_error(error.code, error.message)

		raw_command.raw = read_result.value()
		raw_command.text = ""
		raw_command.chunks.clear()

		return TrimsockResult.Command.of_value(raw_command)

	# No queued command, try to read a new one
	var line := _line_reader.read_text()
	if not line:
		return TrimsockResult.Command.of_success()

	var command := _line_parser.parse(line)
	if command.is_raw:
		var data_size := _parse_data_size(command.text)
		if data_size < 0:
			return TrimsockResult.Command.of_error(ERR_INVALID_DATA,
				"Invalid raw command size: \"%s\"!" % [command.text])

		# Command is raw, we'll keep it in the queue until we read the binary
		# data for it
		_queue_raw(command, data_size)

		# Try getting it immediately, in case we already have the data in buffer
		return _pop()

	return TrimsockResult.Command.of_value(command)

# Parse the data size of a raw command or return -1 if it's invalid
func _parse_data_size(text: String) -> int:
	if not text.is_valid_int():
		return -1

	var size := text.to_int()

	# The data and its terminating newline must both fit in the buffer
	if size < 0 or size >= max_size:
		return -1

	return size

func _queue_raw(command: TrimsockCommand, data_size: int) -> void:
	_queued_raw = command
	_queued_raw_size = data_size

func _dequeue_raw() -> void:
	_queued_raw = null
	_queued_raw_size = -1

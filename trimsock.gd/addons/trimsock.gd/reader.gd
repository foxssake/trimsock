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
## in [member last_error]. The reader continues parsing with the data following
## the offending command.


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

var last_error: Error = OK
## Description of [member last_error]
var last_error_message := ""

var _line_reader: _TrimsockLineReader = _TrimsockLineReader.new()
var _line_parser: _TrimsockLineParser = _TrimsockLineParser.new()
var _queued_raw: TrimsockCommand = null
var _queued_raw_size := -1

## Ingest incoming text
## [br][br]
## Returns [constant OK] on success, or [constant ERR_OUT_OF_MEMORY] if the
## internal buffer can't store the data.
func ingest_text(text: String) -> Error:
	return ingest_bytes(text.to_utf8_buffer())

## Ingest incoming binary data
## [br][br]
## Returns [constant OK] on success, or [constant ERR_OUT_OF_MEMORY] if the
## internal buffer can't store the data.
func ingest_bytes(bytes: PackedByteArray) -> Error:
	_clear_error()

	var error := _line_reader.ingest(bytes)
	if error != OK:
		_dequeue_raw()
		_set_error(error, "Buffer overflow! Can't ingest %d bytes without exceeding %d!" \
			% [bytes.size(), max_size])

	return error

## Try and extract a command from the ingested data
## [br][br]
## Returns a parsed command, or [code]null[/code] if no command is available
## yet. Malformed data is rejected by returning [code]null[/code] and setting
## [member last_error].
func read() -> TrimsockCommand:
	_clear_error()

	var command := _pop()
	if command:
		_TrimsockConventions.apply(command)
	return command

func _pop() -> TrimsockCommand:
	# We read a raw command earlier, waiting to have enough data
	if _queued_raw:
		if not _line_reader.has_data(_queued_raw_size):
			return null

		var raw_command := _queued_raw
		var raw_size := _queued_raw_size
		var read_result := _line_reader.read_data(raw_size)

		_dequeue_raw()

		if read_result[0] != OK:
			_set_error(read_result[0], "Expected newline after %d bytes of raw data!" % [raw_size])
			return null

		raw_command.raw = read_result[1]
		raw_command.text = ""
		raw_command.chunks.clear()

		return raw_command

	# No queued command, try to read a new one
	var line := _line_reader.read_text()
	if not line:
		return null

	var command := _line_parser.parse(line)
	if command.is_raw:
		var data_size := _parse_data_size(command.text)
		if data_size < 0:
			_set_error(ERR_INVALID_DATA, "Invalid raw command size: \"%s\"!" % [command.text])
			return null

		# Command is raw, we'll keep it in the queue until we read the binary
		# data for it
		_queued_raw = command
		_queued_raw_size = data_size

		# Try getting it immediately, in case we already have the data in buffer
		return _pop()

	return command

# Parse the data size of a raw command or return -1 if it's invalid
func _parse_data_size(text: String) -> int:
	if not text.is_valid_int():
		return -1

	var size := text.to_int()

	# The data and its terminating newline must both fit in the buffer
	if size < 0 or size >= max_size:
		return -1

	return size

func _dequeue_raw() -> void:
	_queued_raw = null
	_queued_raw_size = -1

func _clear_error() -> void:
	last_error = OK
	last_error_message = ""

func _set_error(error: Error, message: String) -> void:
	last_error = error
	last_error_message = message
